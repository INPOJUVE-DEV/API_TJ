const db = require('../config/db');
const { buildCurpLookup } = require('../services/curpHashService');
const { encryptString, decryptString } = require('../services/fieldEncryptionService');
const {
  hashPassword,
  validatePassword
} = require('../services/passwordService');
const { recordSyncAudit } = require('../services/syncAuditService');
const safeLogger = require('../utils/safeLogger');
const {
  clearRefreshTokenCookie,
  getUserSessionProfileById,
  issueUserSession
} = require('../services/userSessionService');
const { publishNotification } = require('../services/adminNotificationsService');

const VALID_STATUSES = new Set(['active', 'inactive', 'blocked']);
const HASH_REGEX = /^[a-f0-9]{64}$/i;
const INTERNAL_ROLES = new Set(['admin', 'reader', 'scanner']);

function getActor(req) {
  return req.integration?.client?.client_code || (req.user?.id ? `user:${req.user.id}` : 'unknown');
}

function getRequiredString(body, field) {
  const value = body?.[field];
  if (typeof value !== 'string' || !value.trim()) {
    const error = new Error(`${field} es obligatorio.`);
    error.statusCode = 422;
    throw error;
  }
  return value.trim();
}

function getOptionalTrimmedString(body, field, maxLength) {
  const raw = body?.[field];
  if (raw === undefined || raw === null) {
    return null;
  }

  const value = String(raw).trim();
  if (!value) {
    return null;
  }
  if (maxLength && value.length > maxLength) {
    const error = new Error(`${field} no es valido.`);
    error.statusCode = 422;
    throw error;
  }

  return value;
}

function getOptionalPositiveInteger(body, field) {
  const raw = body?.[field];
  if (raw === undefined || raw === null || raw === '') {
    return null;
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    const error = new Error(`${field} no es valido.`);
    error.statusCode = 422;
    throw error;
  }

  return value;
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!email) {
    const error = new Error('email es obligatorio.');
    error.statusCode = 422;
    throw error;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const error = new Error('email no es valido.');
    error.statusCode = 422;
    throw error;
  }
  return email;
}

function ensurePasswordConfirmation(password, confirmation) {
  if (password !== confirmation) {
    const error = new Error('password_confirmation no coincide.');
    error.statusCode = 422;
    throw error;
  }
}

function handleValidationError(res, error) {
  const status = error.statusCode || 500;
  return res.status(status).json({ message: error.message || 'Solicitud invalida.' });
}

function buildSyncResult(index, status, extra = {}) {
  return {
    index,
    status,
    ...extra
  };
}

function decryptCardholderString(cardholder, fields, label) {
  try {
    return decryptString({
      payload_ciphertext: cardholder?.[fields.ciphertext],
      payload_iv: cardholder?.[fields.iv],
      payload_tag: cardholder?.[fields.tag]
    });
  } catch (error) {
    safeLogger.error(`Error al descifrar ${label} de cardholder_sync durante activacion local`, error);
    return null;
  }
}

function resolveSyncStatus({ processed, accepted, skipped, conflict, rejected }) {
  if (processed === 0) {
    return 'success';
  }
  if (accepted === processed) {
    return 'success';
  }
  if (accepted === 0 && (skipped > 0 || conflict > 0 || rejected > 0)) {
    return 'failed';
  }
  return 'partial';
}

exports.lookup = async (req, res) => {
  try {
    const curp = getRequiredString(req.body, 'curp');
    const { curpHash } = buildCurpLookup(curp);
    const [rows] = await db.execute(
      `SELECT tarjeta_numero
       FROM cardholders_sync
       WHERE curp_hash = ?
       LIMIT 1`,
      [curpHash]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        registered: false,
        message: 'La CURP no se encuentra registrada en la app'
      });
    }

    return res.status(200).json({
      registered: true,
      message: `El usuario ya se encuentra registrado con la tarjeta ${rows[0].tarjeta_numero}`,
      folio_tarjeta: rows[0].tarjeta_numero
    });
  } catch (error) {
    if (error.statusCode) {
      return handleValidationError(res, error);
    }
    safeLogger.error('Error en lookup de cardholder', error);
    return res.status(500).json({ message: 'Error al validar la tarjeta.' });
  }
};

exports.sync = async (req, res) => {
  const startedAt = new Date();
  const actor = getActor(req);
  const items = Array.isArray(req.body?.items) ? req.body.items : null;
  if (!items) {
    return res.status(422).json({ message: 'items debe ser un arreglo.' });
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let conflict = 0;
  let rejected = 0;
  const itemsPreview = [];
  const results = [];

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];

      try {
        const curpHash = String(item?.curp_hash || '').trim().toLowerCase();
        const curpMasked = String(item?.curp_masked || '').trim();
        const tarjetaNumero = String(item?.tarjeta_numero || '').trim();
        const status = String(item?.status || 'active').trim();
        const nombres = getOptionalTrimmedString(item, 'nombres', 120);
        const apellido = getOptionalTrimmedString(item, 'apellido', 150);
        const municipioId = getOptionalPositiveInteger(item, 'municipio_id');
        const encryptedNombres = encryptString(nombres);
        const encryptedApellido = encryptString(apellido);

        if (
          !HASH_REGEX.test(curpHash) ||
          !curpMasked ||
          !tarjetaNumero ||
          !VALID_STATUSES.has(status)
        ) {
          skipped += 1;
          results.push(
            buildSyncResult(index, 'skipped', {
              reason: 'invalid_item'
            })
          );
          continue;
        }

        const [existingCard] = await connection.execute(
          'SELECT id, curp_hash FROM cardholders_sync WHERE tarjeta_numero = ? AND curp_hash <> ? LIMIT 1',
          [tarjetaNumero, curpHash]
        );
        if (existingCard.length > 0) {
          conflict += 1;
          results.push(
            buildSyncResult(index, 'conflict', {
              reason: 'tarjeta_numero_already_assigned'
            })
          );
          continue;
        }

        const [existing] = await connection.execute(
          'SELECT id, tarjeta_numero, status FROM cardholders_sync WHERE curp_hash = ? LIMIT 1',
          [curpHash]
        );

        if (existing.length === 0) {
          await connection.execute(
            `INSERT INTO cardholders_sync
              (curp_hash, curp_masked, tarjeta_numero, status, sync_source, synced_at,
               nombres_ciphertext, nombres_iv, nombres_tag,
               apellido_ciphertext, apellido_iv, apellido_tag, municipio_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              curpHash,
              curpMasked,
              tarjetaNumero,
              status,
              actor,
              new Date(),
              encryptedNombres?.payload_ciphertext || null,
              encryptedNombres?.payload_iv || null,
              encryptedNombres?.payload_tag || null,
              encryptedApellido?.payload_ciphertext || null,
              encryptedApellido?.payload_iv || null,
              encryptedApellido?.payload_tag || null,
              municipioId
            ]
          );
          inserted += 1;
          results.push(
            buildSyncResult(index, 'accepted', {
              action: 'inserted'
            })
          );
        } else {
          await connection.execute(
            `UPDATE cardholders_sync
             SET curp_masked = ?, tarjeta_numero = ?, status = ?, sync_source = ?, synced_at = ?,
                 nombres_ciphertext = COALESCE(?, nombres_ciphertext),
                 nombres_iv = COALESCE(?, nombres_iv),
                 nombres_tag = COALESCE(?, nombres_tag),
                 apellido_ciphertext = COALESCE(?, apellido_ciphertext),
                 apellido_iv = COALESCE(?, apellido_iv),
                 apellido_tag = COALESCE(?, apellido_tag),
                 municipio_id = COALESCE(?, municipio_id)
             WHERE id = ?`,
            [
              curpMasked,
              tarjetaNumero,
              status,
              actor,
              new Date(),
              encryptedNombres?.payload_ciphertext || null,
              encryptedNombres?.payload_iv || null,
              encryptedNombres?.payload_tag || null,
              encryptedApellido?.payload_ciphertext || null,
              encryptedApellido?.payload_iv || null,
              encryptedApellido?.payload_tag || null,
              municipioId,
              existing[0].id
            ]
          );
          updated += 1;
          results.push(
            buildSyncResult(index, 'accepted', {
              action: 'updated'
            })
          );
        }

        if (itemsPreview.length < 5) {
          itemsPreview.push({
            tarjeta_numero: tarjetaNumero,
            curp_masked: curpMasked,
            status,
            municipio_id: municipioId
          });
        }
      } catch (error) {
        if (error.statusCode) {
          rejected += 1;
          results.push(
            buildSyncResult(index, 'rejected', {
              reason: error.message
            })
          );
          continue;
        }
        throw error;
      }
    }

    const accepted = inserted + updated;
    const finalStatus = resolveSyncStatus({
      processed: items.length,
      accepted,
      skipped,
      conflict,
      rejected
    });
    await recordSyncAudit(
      {
        direction: 'SYS_IPJ_TO_API_TJ',
        executedBy: actor,
        requestCount: items.length,
        insertedCount: inserted,
        updatedCount: updated,
        skippedCount: skipped,
        conflictCount: conflict,
        status: finalStatus,
        request: {
          sync_id: req.body?.sync_id || null,
          item_count: items.length
        },
        startedAt,
        finishedAt: new Date()
      },
      connection
    );

    await connection.commit();
    try {
      publishNotification({
        type: 'cardholders_sync.received',
        title: 'Padron recibido desde Sys_IPJ',
        message: `Se recibio un lote con ${items.length} registro(s) de Sys_IPJ.`,
        source: actor,
        audience: ['admin', 'reader'],
        payload: {
          sync_id: req.body?.sync_id || null,
          processed: items.length,
          inserted,
          updated,
          skipped,
          conflict,
          itemsPreview
        }
      });
    } catch (notificationError) {
      safeLogger.error('Error al publicar notificacion admin de sync', notificationError);
    }

    return res.json({
      accepted,
      status: finalStatus,
      results,
      processed: items.length,
      inserted,
      updated,
      skipped,
      conflict
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        safeLogger.error('Error al revertir sync de padron', rollbackError);
      }
    }
    safeLogger.error('Error en sync de padron', error);
    return res.status(500).json({ message: 'Error al sincronizar padron.' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

exports.verifyActivation = async (req, res) => {
  try {
    const tarjetaNumero = getRequiredString(req.body, 'tarjeta_numero');
    const curp = getRequiredString(req.body, 'curp');
    const { curpHash } = buildCurpLookup(curp);
    const [rows] = await db.execute(
      `SELECT cs.id, cs.curp_hash, cs.status, cs.account_user_id,
              u.password_hash AS linked_password_hash
       FROM cardholders_sync cs
       LEFT JOIN usuarios u ON u.id = cs.account_user_id
       WHERE cs.tarjeta_numero = ?
       LIMIT 1`,
      [tarjetaNumero]
    );

    if (rows.length === 0 || rows[0].curp_hash !== curpHash) {
      return res.status(403).json({
        can_activate: false,
        message: 'La tarjeta no esta disponible para activacion.'
      });
    }
    if (rows[0].status !== 'active') {
      return res.status(409).json({
        can_activate: false,
        message: 'La tarjeta no esta activa.'
      });
    }
    if (rows[0].account_user_id && rows[0].linked_password_hash) {
      return res.status(409).json({
        can_activate: false,
        message: 'La tarjeta ya cuenta con una cuenta vinculada.'
      });
    }

    await db.execute(
      `UPDATE cardholders_sync
       SET activation_verified_until = ?
       WHERE id = ?`,
      [new Date(Date.now() + 15 * 60 * 1000), rows[0].id]
    );

    return res.json({
      can_activate: true,
      message: 'Validacion correcta'
    });
  } catch (error) {
    if (error.statusCode) {
      return handleValidationError(res, error);
    }
    safeLogger.error('Error en verificacion de activacion', error);
    return res.status(500).json({ message: 'Error al validar activacion.' });
  }
};

exports.completeActivation = async (req, res) => {
  let connection;
  let finished = false;
  try {
    const tarjetaNumero = getRequiredString(req.body, 'tarjeta_numero');
    const email = normalizeEmail(req.body?.email);
    const password = getRequiredString(req.body, 'password');
    const passwordConfirmation = getRequiredString(req.body, 'password_confirmation');
    ensurePasswordConfirmation(password, passwordConfirmation);
    const safePassword = validatePassword(password, {
      email,
      forbiddenValues: [tarjetaNumero]
    });
    const passwordHash = await hashPassword(safePassword);

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [cardholders] = await connection.execute(
      `SELECT id, status, account_user_id, activation_verified_until,
              nombres_ciphertext, nombres_iv, nombres_tag,
              apellido_ciphertext, apellido_iv, apellido_tag,
              municipio_id
       FROM cardholders_sync
       WHERE tarjeta_numero = ?
       LIMIT 1
       FOR UPDATE`,
      [tarjetaNumero]
    );
    if (cardholders.length === 0 || cardholders[0].status !== 'active') {
      await connection.rollback();
      finished = true;
      return res.status(404).json({ message: 'La tarjeta no esta disponible.' });
    }
    if (
      !cardholders[0].activation_verified_until ||
      new Date(cardholders[0].activation_verified_until) < new Date()
    ) {
      await connection.rollback();
      finished = true;
      return res.status(403).json({
        message: 'Debes validar tarjeta y CURP antes de completar la activacion.'
      });
    }

    const cardholder = cardholders[0];
    const cardholderSyncId = cardholder.id;
    const nombreDesdeSync = decryptCardholderString(
      cardholder,
      {
        ciphertext: 'nombres_ciphertext',
        iv: 'nombres_iv',
        tag: 'nombres_tag'
      },
      'nombres'
    );
    const apellidosDesdeSync = decryptCardholderString(
      cardholder,
      {
        ciphertext: 'apellido_ciphertext',
        iv: 'apellido_iv',
        tag: 'apellido_tag'
      },
      'apellidos'
    );
    const municipioIdDesdeSync = cardholder.municipio_id || null;
    let linkedUser = null;
    if (cardholder.account_user_id) {
      const [linkedUsers] = await connection.execute(
        `SELECT id, email, role, status, cardholder_sync_id, password_hash
         FROM usuarios
         WHERE id = ?
         LIMIT 1
         FOR UPDATE`,
        [cardholder.account_user_id]
      );
      linkedUser = linkedUsers[0] || null;
      if (linkedUser?.cardholder_sync_id && linkedUser.cardholder_sync_id !== cardholderSyncId) {
        await connection.rollback();
        finished = true;
        return res.status(409).json({ message: 'La tarjeta ya esta vinculada a otra cuenta.' });
      }
      if (linkedUser?.password_hash) {
        await connection.rollback();
        finished = true;
        return res.status(409).json({ message: 'La tarjeta ya esta vinculada.' });
      }
    }

    const [emailMatches] = await connection.execute(
      `SELECT id, role, status, cardholder_sync_id, password_hash
       FROM usuarios
       WHERE email = ?
       LIMIT 1
       FOR UPDATE`,
      [email]
    );
    const existingUserByEmail = emailMatches[0] || null;

    if (linkedUser && existingUserByEmail && existingUserByEmail.id !== linkedUser.id) {
      await connection.rollback();
      finished = true;
      return res.status(409).json({ message: 'El email ya esta vinculado a otra cuenta.' });
    }

    let targetUser = linkedUser;
    if (!targetUser && existingUserByEmail) {
      if (
        existingUserByEmail.cardholder_sync_id &&
        existingUserByEmail.cardholder_sync_id !== cardholderSyncId
      ) {
        await connection.rollback();
        finished = true;
        return res.status(409).json({ message: 'El email ya esta vinculado a otra tarjeta.' });
      }
      if (
        INTERNAL_ROLES.has(String(existingUserByEmail.role || '').toLowerCase()) &&
        !existingUserByEmail.cardholder_sync_id
      ) {
        await connection.rollback();
        finished = true;
        return res.status(409).json({ message: 'El email ya existe en otra cuenta.' });
      }
      targetUser = existingUserByEmail;
    }

    let userId;
    if (targetUser) {
      userId = targetUser.id;
      await connection.execute(
        `UPDATE usuarios
         SET nombre = COALESCE(?, nombre),
             apellidos = COALESCE(?, apellidos),
             email = ?, municipio_id = COALESCE(?, municipio_id),
             password_hash = ?, cardholder_sync_id = ?, role = 'beneficiary',
             status = 'active', auth0_user_id = NULL, session_version = session_version + 1
         WHERE id = ?`,
        [
          nombreDesdeSync,
          apellidosDesdeSync,
          email,
          municipioIdDesdeSync,
          passwordHash,
          cardholderSyncId,
          userId
        ]
      );
    } else {
      const [insertResult] = await connection.execute(
        `INSERT INTO usuarios
          (nombre, apellidos, curp, email, telefono, municipio_id, password_hash, role,
           cardholder_sync_id, status)
         VALUES (?, ?, NULL, ?, NULL, ?, ?, 'beneficiary', ?, 'active')`,
        [
          nombreDesdeSync,
          apellidosDesdeSync,
          email,
          municipioIdDesdeSync,
          passwordHash,
          cardholderSyncId
        ]
      );
      userId = insertResult.insertId;
    }

    await connection.execute(
      `UPDATE cardholders_sync
       SET account_user_id = ?, auth0_user_id = NULL, activation_verified_until = NULL
       WHERE id = ?`,
      [userId, cardholderSyncId]
    );

    const freshUser = await getUserSessionProfileById(userId, connection);
    const sessionPayload = await issueUserSession(res, freshUser, connection);

    await connection.commit();
    finished = true;
    return res.status(200).json({
      activated: true,
      message: 'Cuenta activada correctamente',
      ...sessionPayload
    });
  } catch (error) {
    if (connection && !finished) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        safeLogger.error('Error al revertir activacion local', rollbackError);
      }
    }
    clearRefreshTokenCookie(res);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'El email ya existe.' });
    }
    if (error.statusCode) {
      return handleValidationError(res, error);
    }
    safeLogger.error('Error al completar activacion local', error);
    return res.status(500).json({ message: 'Error al activar cuenta.' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

exports.createAccount = async (req, res) => {
  return res.status(410).json({
    message:
      'El alta legacy fue retirada. Usa /api/v1/cardholders/verify-activation y /complete-activation.'
  });
};
