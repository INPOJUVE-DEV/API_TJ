const db = require('../config/db');
const { buildCurpLookup } = require('../services/curpHashService');
const { encryptJson, decryptJson } = require('../services/fieldEncryptionService');
const { pushBeneficiario } = require('../services/sysIpjClient');
const { recordSyncAudit } = require('../services/syncAuditService');
const safeLogger = require('../utils/safeLogger');

const PUSHABLE_STATUSES = new Set(['pending', 'error']);
const FINAL_STATUSES = new Set(['accepted', 'rejected']);

function getActor(req) {
  return req.integration?.client?.client_code || (req.user?.id ? `user:${req.user.id}` : 'unknown');
}

function requiredString(body, field) {
  const value = body?.[field];
  if (typeof value !== 'string' || !value.trim()) {
    const error = new Error(`${field} es obligatorio.`);
    error.statusCode = 422;
    throw error;
  }
  return value.trim();
}

function requiredObject(body, field) {
  const value = body?.[field];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    const error = new Error(`${field} es obligatorio.`);
    error.statusCode = 422;
    throw error;
  }
  return value;
}

function requiredBoolean(body, field) {
  const source = body && typeof body === 'object' ? body : {};
  if (!Object.prototype.hasOwnProperty.call(source, field)) {
    const error = new Error(`${field} es obligatorio.`);
    error.statusCode = 422;
    throw error;
  }

  if (typeof source[field] !== 'boolean') {
    const error = new Error(`${field} debe ser booleano.`);
    error.statusCode = 422;
    throw error;
  }

  return source[field];
}

function optionalString(body, field) {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return String(value).trim();
}

function normalizeBeneficiarioPayload(body) {
  const beneficiario = body?.beneficiario && typeof body.beneficiario === 'object'
    ? body.beneficiario
    : body;
  const domicilio = requiredObject(beneficiario, 'domicilio');

  return {
    curp: requiredString(beneficiario, 'curp'),
    nombre: requiredString(beneficiario, 'nombre'),
    apellido_paterno: requiredString(beneficiario, 'apellido_paterno'),
    apellido_materno: requiredString(beneficiario, 'apellido_materno'),
    fecha_nacimiento: requiredString(beneficiario, 'fecha_nacimiento'),
    sexo: requiredString(beneficiario, 'sexo'),
    discapacidad: requiredBoolean(beneficiario, 'discapacidad'),
    id_ine: requiredString(beneficiario, 'id_ine'),
    telefono: requiredString(beneficiario, 'telefono'),
    domicilio: {
      calle: requiredString(domicilio, 'calle'),
      numero_ext: requiredString(domicilio, 'numero_ext'),
      numero_int: optionalString(domicilio, 'numero_int'),
      colonia: requiredString(domicilio, 'colonia'),
      municipio_id: Number(domicilio?.municipio_id),
      codigo_postal: requiredString(domicilio, 'codigo_postal'),
      seccional: requiredString(domicilio, 'seccional')
    }
  };
}

function validateBeneficiarioPayload(payload) {
  if (!Number.isInteger(payload.domicilio.municipio_id) || payload.domicilio.municipio_id <= 0) {
    const error = new Error('domicilio.municipio_id es obligatorio.');
    error.statusCode = 422;
    throw error;
  }
}

function mapSysIpjStatus(result) {
  if (!result.ok) {
    return 'error';
  }
  if (result.status >= 200 && result.status < 300) {
    return 'accepted';
  }
  if (result.status >= 400 && result.status < 500) {
    return 'rejected';
  }
  return 'error';
}

exports.create = async (req, res) => {
  let curpData;
  try {
    const externalRequestId = requiredString(req.body, 'external_request_id');
    const beneficiario = normalizeBeneficiarioPayload(req.body);
    validateBeneficiarioPayload(beneficiario);
    curpData = buildCurpLookup(beneficiario.curp);

    const [existingCardholder] = await db.execute(
      'SELECT id FROM cardholders_sync WHERE curp_hash = ? LIMIT 1',
      [curpData.curpHash]
    );
    if (existingCardholder.length > 0) {
      return res.status(409).json({ message: 'La CURP ya existe en el padron sincronizado.' });
    }

    const [existingStaging] = await db.execute(
      `SELECT id, status
       FROM beneficiario_staging
       WHERE external_request_id = ? OR curp_hash = ?
       LIMIT 1`,
      [externalRequestId, curpData.curpHash]
    );
    if (existingStaging.length > 0) {
      return res.status(409).json({ message: 'Ya existe un expediente staging para esta solicitud.' });
    }

    const encrypted = encryptJson(beneficiario);
    const [result] = await db.execute(
      `INSERT INTO beneficiario_staging
        (external_request_id, curp_hash, curp_masked, payload_ciphertext, payload_iv,
         payload_tag, status, submitted_by_system, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        externalRequestId,
        curpData.curpHash,
        curpData.curpMasked,
        encrypted.payload_ciphertext,
        encrypted.payload_iv,
        encrypted.payload_tag,
        getActor(req),
        new Date()
      ]
    );

    return res.status(202).json({
      created: true,
      status: 'pending',
      staging_id: result.insertId
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    safeLogger.error('Error al crear staging de beneficiario', error);
    return res.status(500).json({ message: 'Error al crear expediente temporal.' });
  }
};

exports.list = async (req, res) => {
  const status = String(req.query?.status || 'pending').trim();
  const params = [];
  let where = '';
  if (status) {
    where = 'WHERE status = ?';
    params.push(status);
  }

  try {
    const [rows] = await db.execute(
      `SELECT id, external_request_id, curp_masked, status, submitted_at, sent_at,
              resolved_at, error_message
       FROM beneficiario_staging
       ${where}
       ORDER BY submitted_at DESC
       LIMIT 100`,
      params
    );
    return res.json({ items: rows });
  } catch (error) {
    safeLogger.error('Error al listar staging', error);
    return res.status(500).json({ message: 'Error al listar staging.' });
  }
};

exports.cleanupExpired = async (req, res) => {
  const ttlDays = Number(req.query?.ttlDays || process.env.STAGING_TTL_DAYS || 30);
  if (!Number.isFinite(ttlDays) || ttlDays <= 0) {
    return res.status(422).json({ message: 'ttlDays debe ser un numero positivo.' });
  }

  const dryRun = String(req.query?.dryRun || '').toLowerCase() === 'true';
  const cutoff = new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000);

  try {
    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total
       FROM beneficiario_staging
       WHERE status IN ('pending','error')
         AND locked_at IS NULL
         AND submitted_at < ?`,
      [cutoff]
    );
    const total = Number(countRows[0]?.total || 0);

    if (!dryRun && total > 0) {
      await db.execute(
        `DELETE FROM beneficiario_staging
         WHERE status IN ('pending','error')
           AND locked_at IS NULL
           AND submitted_at < ?`,
        [cutoff]
      );
    }

    return res.json({
      dryRun,
      ttlDays,
      cutoff,
      deleted: dryRun ? 0 : total,
      matched: total
    });
  } catch (error) {
    safeLogger.error('Error al limpiar staging expirado', error);
    return res.status(500).json({ message: 'Error al limpiar staging expirado.' });
  }
};

exports.push = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(422).json({ message: 'id invalido.' });
  }

  const startedAt = new Date();
  const actor = getActor(req);
  let connection;
  let staging;
  let payload;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT id, external_request_id, status, payload_ciphertext, payload_iv, payload_tag,
              locked_at, locked_by
       FROM beneficiario_staging
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [id]
    );
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Staging no encontrado.' });
    }
    staging = rows[0];
    if (FINAL_STATUSES.has(staging.status) || !PUSHABLE_STATUSES.has(staging.status)) {
      await connection.rollback();
      return res.status(409).json({ message: 'El staging no esta disponible para envio.' });
    }

    await connection.execute(
      `UPDATE beneficiario_staging
       SET locked_at = ?, locked_by = ?
       WHERE id = ?`,
      [new Date(), actor, id]
    );
    await connection.commit();
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        safeLogger.error('Error al revertir lock de staging', rollbackError);
      }
    }
    safeLogger.error('Error al preparar push de staging', error);
    return res.status(500).json({ message: 'Error al preparar envio.' });
  } finally {
    if (connection) {
      connection.release();
    }
  }

  try {
    payload = decryptJson(staging);
  } catch (error) {
    safeLogger.error('Error al descifrar staging', error);
    await db.execute(
      `UPDATE beneficiario_staging
       SET status = 'error', locked_at = NULL, locked_by = NULL, error_message = ?
       WHERE id = ?`,
      ['No se pudo descifrar el expediente.', id]
    );
    return res.status(500).json({ message: 'No se pudo descifrar el expediente.' });
  }

  const result = await pushBeneficiario({
    externalRequestId: staging.external_request_id,
    payload
  });
  const nextStatus = mapSysIpjStatus(result);
  const now = new Date();

  try {
    await db.execute(
      `INSERT INTO staging_push_attempts
        (staging_id, external_request_id, actor, request_checksum, response_status,
         status, error_message, attempted_at)
       VALUES (?, ?, ?, SHA2(?, 256), ?, ?, ?, ?)`,
      [
        id,
        staging.external_request_id,
        actor,
        JSON.stringify({ external_request_id: staging.external_request_id, payload }),
        result.status,
        nextStatus,
        result.errorMessage || null,
        now
      ]
    );
    await db.execute(
      `UPDATE beneficiario_staging
       SET status = ?, sent_at = COALESCE(sent_at, ?), resolved_at = ?,
           sys_ipj_response_code = ?, error_message = ?, locked_at = NULL, locked_by = NULL
       WHERE id = ?`,
      [
        nextStatus,
        now,
        nextStatus === 'error' ? null : now,
        result.status,
        result.errorMessage || null,
        id
      ]
    );
    await recordSyncAudit({
      direction: 'API_TJ_TO_SYS_IPJ',
      executedBy: actor,
      requestCount: 1,
      insertedCount: nextStatus === 'accepted' ? 1 : 0,
      skippedCount: 0,
      conflictCount: nextStatus === 'rejected' ? 1 : 0,
      status: nextStatus === 'accepted' ? 'success' : 'failed',
      request: { staging_id: id, external_request_id: staging.external_request_id },
      errorMessage: result.errorMessage || null,
      startedAt,
      finishedAt: now
    });
  } catch (error) {
    safeLogger.error('Error al auditar push de staging', error);
    return res.status(500).json({ message: 'El envio termino, pero fallo la auditoria.' });
  }

  const statusCode = nextStatus === 'accepted' ? 200 : 502;
  return res.status(statusCode).json({
    sent: nextStatus === 'accepted',
    message:
      nextStatus === 'accepted'
        ? 'Beneficiario enviado a Sys_IPJ'
        : 'No se pudo completar el envio a Sys_IPJ',
    sys_ipj_status: result.status
  });
};
