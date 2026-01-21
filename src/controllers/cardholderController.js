const bcrypt = require('bcrypt');
const db = require('../config/db');

const CURP_REGEX = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[0-9A-Z]{2}$/;
const PASSWORD_MIN_LENGTH = 8;
const LOOKUP_RATE_LIMIT = 5;
const LOOKUP_RATE_WINDOW_MINUTES = 15;
const LOOKUP_BLOCK_MINUTES = 15;
const ACCOUNT_WINDOW_MINUTES = 15;
const SALT_ROUNDS = 10;
const EXPOSE_PII = String(process.env.EXPOSE_PII || '').toLowerCase() === 'true';

function normalizeCurp(curp = '') {
  return curp.trim().toUpperCase();
}

function maskCurp(curp) {
  if (!curp) {
    return null;
  }
  const value = String(curp);
  if (value.length <= 6) {
    return '*'.repeat(value.length);
  }
  const prefix = value.slice(0, 4);
  const suffix = value.slice(-2);
  return `${prefix}${'*'.repeat(value.length - 6)}${suffix}`;
}

function minutesToMs(minutes) {
  return minutes * 60 * 1000;
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || null;
}

async function logAudit(cardholderId, action, req, executor = db) {
  await executor.execute(
    `INSERT INTO cardholder_audit_logs (cardholder_id, action, ip_address)
     VALUES (?, ?, ?)`,
    [cardholderId, action, getClientIp(req)]
  );
}

exports.lookup = async (req, res) => {
  const normalizedCurp = normalizeCurp(req.body?.curp || '');
  if (!normalizedCurp) {
    return res.status(422).json({ message: 'El CURP es obligatorio.' });
  }
  if (!CURP_REGEX.test(normalizedCurp)) {
    return res.status(422).json({ message: 'Formato de CURP invalido.' });
  }

  try {
    const [rows] = await db.execute(
      `SELECT ch.id, ch.curp, ch.nombres, ch.apellidos, ch.status,
              ch.lookup_attempts, ch.last_lookup_attempt_at,
              ch.lookup_blocked_until, ch.pending_account_until,
              ch.account_user_id, m.nombre AS municipio
       FROM cardholders ch
       LEFT JOIN municipios m ON ch.municipio_id = m.id
       WHERE ch.curp = ?`,
      [normalizedCurp]
    );

    if (rows.length === 0 || rows[0].status !== 'active') {
      return res.status(404).json({ message: 'La tarjeta no se encuentra activa.' });
    }

    const cardholder = rows[0];
    const hasAccount = Boolean(cardholder.account_user_id);
    if (hasAccount) {
      return res.status(409).json({
        message: 'La CURP ya cuenta con credenciales activas.',
        hasAccount: true
      });
    }

    const now = new Date();
    if (cardholder.lookup_blocked_until && new Date(cardholder.lookup_blocked_until) > now) {
      return res.status(429).json({
        message: 'Se excedio el numero de intentos. Intenta nuevamente mas tarde.'
      });
    }

    let attempts = cardholder.lookup_attempts || 0;
    if (
      !cardholder.last_lookup_attempt_at ||
      now - new Date(cardholder.last_lookup_attempt_at) > minutesToMs(LOOKUP_RATE_WINDOW_MINUTES)
    ) {
      attempts = 0;
    }
    attempts += 1;

    if (attempts > LOOKUP_RATE_LIMIT) {
      const blockedUntil = new Date(now.getTime() + minutesToMs(LOOKUP_BLOCK_MINUTES));
      await db.execute(
        `UPDATE cardholders
         SET lookup_attempts = ?,
             lookup_blocked_until = ?,
             last_lookup_attempt_at = ?
         WHERE id = ?`,
        [attempts, blockedUntil, now, cardholder.id]
      );
      return res.status(429).json({
        message: 'Se excedio el numero de intentos. Intenta nuevamente mas tarde.'
      });
    }

    const pendingUntil = new Date(now.getTime() + minutesToMs(ACCOUNT_WINDOW_MINUTES));
    await db.execute(
      `UPDATE cardholders
       SET lookup_attempts = ?,
           lookup_blocked_until = NULL,
           last_lookup_attempt_at = ?,
           pending_account_until = ?
       WHERE id = ?`,
      [attempts, now, pendingUntil, cardholder.id]
    );

    await logAudit(cardholder.id, 'lookup', req);

    const response = {
      curpMasked: maskCurp(cardholder.curp),
      nombres: cardholder.nombres,
      apellidos: cardholder.apellidos,
      municipio: cardholder.municipio,
      hasAccount: false
    };
    if (EXPOSE_PII) {
      response.curp = cardholder.curp;
    }
    return res.json(response);
  } catch (error) {
    console.error('Error en lookup de cardholder', error);
    return res.status(500).json({ message: 'Error al validar la tarjeta.' });
  }
};

exports.createAccount = async (req, res) => {
  const normalizedCurp = normalizeCurp(req.params.curp || '');
  if (!normalizedCurp || !CURP_REGEX.test(normalizedCurp)) {
    return res.status(422).json({ message: 'CURP invalido.' });
  }

  const username = (req.body?.username || '').trim();
  const password = req.body?.password || '';
  const confirmPassword = req.body?.confirmPassword ?? req.body?.passwordConfirmation;

  if (!username) {
    return res.status(422).json({ message: 'El nombre de usuario es obligatorio.' });
  }
  if (!/^[A-Za-z0-9._-]{4,50}$/.test(username)) {
    return res
      .status(422)
      .json({ message: 'El nombre de usuario debe tener entre 4 y 50 caracteres alfanumericos.' });
  }
  if (!password) {
    return res.status(422).json({ message: 'La contraseña es obligatoria.' });
  }
  if (password.length < PASSWORD_MIN_LENGTH || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return res.status(422).json({
      message: 'La contraseña debe tener al menos 8 caracteres, incluyendo letras y numeros.'
    });
  }
  if (!confirmPassword || confirmPassword !== password) {
    return res.status(422).json({ message: 'La confirmacion de contraseña no coincide.' });
  }

  let connection;
  let transactionFinished = false;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT ch.id, ch.curp, ch.nombres, ch.apellidos, ch.status,
              ch.pending_account_until, ch.account_user_id, ch.municipio_id
       FROM cardholders ch
       WHERE ch.curp = ?
       FOR UPDATE`,
      [normalizedCurp]
    );

    if (rows.length === 0 || rows[0].status !== 'active') {
      await connection.rollback();
      transactionFinished = true;
      return res.status(404).json({ message: 'La tarjeta no esta disponible para crear cuenta.' });
    }

    const cardholder = rows[0];
    if (cardholder.account_user_id) {
      await connection.rollback();
      transactionFinished = true;
      return res.status(409).json({ message: 'Ya existe un usuario vinculado a esta CURP.' });
    }

    if (
      !cardholder.pending_account_until ||
      new Date(cardholder.pending_account_until) < new Date()
    ) {
      await connection.rollback();
      transactionFinished = true;
      return res.status(404).json({
        message: 'Debes validar tu CURP antes de crear la cuenta. Intenta el lookup nuevamente.'
      });
    }

    const [existingUsers] = await connection.execute(
      'SELECT id FROM usuarios WHERE email = ? OR curp = ? LIMIT 1',
      [username, normalizedCurp]
    );
    if (existingUsers.length > 0) {
      await connection.rollback();
      transactionFinished = true;
      return res.status(409).json({ message: 'El usuario o CURP ya estan registrados.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const [insertResult] = await connection.execute(
      `INSERT INTO usuarios
        (nombre, apellidos, curp, email, telefono, municipio_id, password_hash, role)
       VALUES (?, ?, ?, ?, NULL, ?, ?, ?)`,
      [
        cardholder.nombres,
        cardholder.apellidos,
        cardholder.curp,
        username,
        cardholder.municipio_id || null,
        passwordHash,
        'reader'
      ]
    );

    await connection.execute(
      `UPDATE cardholders
       SET account_user_id = ?, pending_account_until = NULL, lookup_attempts = 0
       WHERE id = ?`,
      [insertResult.insertId, cardholder.id]
    );

    await logAudit(cardholder.id, 'account_created', req, connection);

    await connection.commit();
    transactionFinished = true;
    return res.status(201).json({ message: 'Cuenta creada. Ya puedes iniciar sesion.' });
  } catch (error) {
    if (connection && !transactionFinished) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Error al revertir la transaccion', rollbackError);
      }
    }
    console.error('Error al crear cuenta para cardholder', error);
    return res.status(500).json({ message: 'Error al crear la cuenta.' });
  } finally {
    if (connection) {
      await connection.release();
    }
  }
};
