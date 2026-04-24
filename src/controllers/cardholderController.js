const db = require('../config/db');
const { buildCurpLookup } = require('../services/curpHashService');
const { recordSyncAudit } = require('../services/syncAuditService');
const { verifyIdToken } = require('../services/auth0Service');
const safeLogger = require('../utils/safeLogger');

const VALID_STATUSES = new Set(['active', 'inactive', 'blocked']);
const HASH_REGEX = /^[a-f0-9]{64}$/i;

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

function handleValidationError(res, error) {
  const status = error.statusCode || 500;
  return res.status(status).json({ message: error.message || 'Solicitud invalida.' });
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

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    for (const item of items) {
      const curpHash = String(item?.curp_hash || '').trim().toLowerCase();
      const curpMasked = String(item?.curp_masked || '').trim();
      const tarjetaNumero = String(item?.tarjeta_numero || '').trim();
      const status = String(item?.status || 'active').trim();

      if (
        !HASH_REGEX.test(curpHash) ||
        !curpMasked ||
        !tarjetaNumero ||
        !VALID_STATUSES.has(status)
      ) {
        skipped += 1;
        continue;
      }

      const [existingCard] = await connection.execute(
        'SELECT id, curp_hash FROM cardholders_sync WHERE tarjeta_numero = ? AND curp_hash <> ? LIMIT 1',
        [tarjetaNumero, curpHash]
      );
      if (existingCard.length > 0) {
        conflict += 1;
        continue;
      }

      const [existing] = await connection.execute(
        'SELECT id, tarjeta_numero, status FROM cardholders_sync WHERE curp_hash = ? LIMIT 1',
        [curpHash]
      );

      if (existing.length === 0) {
        await connection.execute(
          `INSERT INTO cardholders_sync
            (curp_hash, curp_masked, tarjeta_numero, status, sync_source, synced_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [curpHash, curpMasked, tarjetaNumero, status, actor, new Date()]
        );
        inserted += 1;
      } else {
        await connection.execute(
          `UPDATE cardholders_sync
           SET curp_masked = ?, tarjeta_numero = ?, status = ?, sync_source = ?, synced_at = ?
           WHERE id = ?`,
          [curpMasked, tarjetaNumero, status, actor, new Date(), existing[0].id]
        );
        updated += 1;
      }
    }

    const finalStatus = conflict > 0 || skipped > 0 ? 'partial' : 'success';
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
    return res.json({
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
      `SELECT id, curp_hash, status, account_user_id, auth0_user_id
       FROM cardholders_sync
       WHERE tarjeta_numero = ?
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
    if (rows[0].account_user_id || rows[0].auth0_user_id) {
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
  const tarjetaNumero = String(req.body?.tarjeta_numero || '').trim();
  const idToken = String(req.body?.auth0_id_token || '').trim();
  if (!tarjetaNumero || !idToken) {
    return res
      .status(422)
      .json({ message: 'tarjeta_numero y auth0_id_token son obligatorios.' });
  }

  let auth0Payload;
  try {
    auth0Payload = await verifyIdToken(idToken);
  } catch (error) {
    const status = error.statusCode === 500 ? 500 : 401;
    if (status === 500) {
      safeLogger.error('Error de configuracion Auth0', error);
    }
    return res.status(status).json({ message: 'Token Auth0 invalido.' });
  }

  const auth0UserId = auth0Payload.sub;
  const email = String(auth0Payload.email || '').trim().toLowerCase();
  if (!email) {
    return res.status(422).json({ message: 'El token Auth0 debe incluir email.' });
  }

  let connection;
  let finished = false;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [cardholders] = await connection.execute(
      `SELECT id, status, account_user_id, auth0_user_id, activation_verified_until
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
    if (cardholders[0].account_user_id || cardholders[0].auth0_user_id) {
      await connection.rollback();
      finished = true;
      return res.status(409).json({ message: 'La tarjeta ya esta vinculada.' });
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

    const cardholderSyncId = cardholders[0].id;
    const [existingUsers] = await connection.execute(
      `SELECT id, cardholder_sync_id
       FROM usuarios
       WHERE auth0_user_id = ? OR email = ?
       LIMIT 1
       FOR UPDATE`,
      [auth0UserId, email]
    );

    let userId;
    if (existingUsers.length > 0) {
      if (
        existingUsers[0].cardholder_sync_id &&
        existingUsers[0].cardholder_sync_id !== cardholderSyncId
      ) {
        await connection.rollback();
        finished = true;
        return res.status(409).json({ message: 'El usuario ya esta vinculado a otra tarjeta.' });
      }
      userId = existingUsers[0].id;
      await connection.execute(
        `UPDATE usuarios
         SET auth0_user_id = ?, email = ?, cardholder_sync_id = ?, status = 'active'
         WHERE id = ?`,
        [auth0UserId, email, cardholderSyncId, userId]
      );
    } else {
      const [insertResult] = await connection.execute(
        `INSERT INTO usuarios
          (nombre, apellidos, curp, email, telefono, municipio_id, password_hash, role,
           auth0_user_id, cardholder_sync_id, status)
         VALUES (NULL, NULL, NULL, ?, NULL, NULL, NULL, 'reader', ?, ?, 'active')`,
        [email, auth0UserId, cardholderSyncId]
      );
      userId = insertResult.insertId;
    }

    await connection.execute(
      `UPDATE cardholders_sync
       SET account_user_id = ?, auth0_user_id = ?, activation_verified_until = NULL
       WHERE id = ?`,
      [userId, auth0UserId, cardholderSyncId]
    );

    await connection.commit();
    finished = true;
    return res.status(200).json({
      activated: true,
      message: 'Cuenta vinculada correctamente'
    });
  } catch (error) {
    if (connection && !finished) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        safeLogger.error('Error al revertir activacion', rollbackError);
      }
    }
    safeLogger.error('Error al completar activacion', error);
    return res.status(500).json({ message: 'Error al vincular cuenta.' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

exports.createAccount = async (req, res) => {
  return res.status(410).json({
    message: 'El alta local con contrasena fue retirada. Usa el flujo de activacion con Auth0.'
  });
};
