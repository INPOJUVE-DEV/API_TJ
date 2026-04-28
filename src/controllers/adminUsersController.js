const bcrypt = require('bcrypt');
const db = require('../config/db');
const { invalidateAdminSessions } = require('../services/adminAuthService');
const { getClientIp, recordAdminActivity } = require('../services/adminActivityService');
const safeLogger = require('../utils/safeLogger');

const SALT_ROUNDS = 10;
const ALLOWED_ROLES = new Set(['admin', 'reader']);
const ALLOWED_STATUSES = new Set(['active', 'blocked', 'pending']);

function maskPhone(phone) {
  if (!phone) {
    return null;
  }
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) {
    return null;
  }
  return `***${digits.slice(-4)}`;
}

function normalizeOptionalString(value, maxLength, field) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    throw buildError(422, `${field} debe ser texto.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > maxLength) {
    throw buildError(422, `${field} excede la longitud permitida.`);
  }
  return trimmed;
}

function normalizeRequiredString(value, maxLength, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw buildError(422, `${field} es obligatorio.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw buildError(422, `${field} excede la longitud permitida.`);
  }
  return trimmed;
}

function normalizeEmail(value, required = false) {
  if (!required && value === undefined) {
    return undefined;
  }
  const normalized = normalizeRequiredString(value, 150, 'email').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw buildError(422, 'email no es valido.');
  }
  return normalized;
}

function normalizeRole(value, required = false) {
  if (!required && value === undefined) {
    return undefined;
  }
  const role = String(value || '').trim().toLowerCase();
  if (!ALLOWED_ROLES.has(role)) {
    throw buildError(422, 'role invalido.');
  }
  return role;
}

function normalizeStatus(value, required = false) {
  if (!required && value === undefined) {
    return undefined;
  }
  const status = String(value || '').trim().toLowerCase();
  if (!ALLOWED_STATUSES.has(status)) {
    throw buildError(422, 'status invalido.');
  }
  return status;
}

function normalizePositiveInt(value, field, required = false) {
  if (!required && value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw buildError(422, `${field} debe ser un entero positivo.`);
  }
  return parsed;
}

function buildError(status, message) {
  const error = new Error(message);
  error.statusCode = status;
  return error;
}

function mapUserRow(row) {
  return {
    id: row.id,
    nombre: row.nombre || null,
    apellidos: row.apellidos || null,
    nombreCompleto: [row.nombre, row.apellidos].filter(Boolean).join(' ').trim() || null,
    email: row.email,
    telefono: maskPhone(row.telefono),
    municipioId: row.municipio_id || null,
    municipio: row.municipio || null,
    role: row.role,
    status: row.status,
    cardholderSyncId: row.cardholder_sync_id || null,
    auth0UserId: row.auth0_user_id || null,
    lastLoginAt: row.last_login_at || null,
    lastFailedLoginAt: row.last_failed_login_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
}

async function fetchUserById(id) {
  const [rows] = await db.execute(
    `SELECT u.id, u.nombre, u.apellidos, u.email, u.telefono, u.municipio_id, u.role, u.status,
            u.cardholder_sync_id, u.auth0_user_id, u.last_login_at, u.last_failed_login_at,
            u.created_at, u.updated_at, m.nombre AS municipio
     FROM usuarios u
     LEFT JOIN municipios m ON m.id = u.municipio_id
     WHERE u.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

exports.listUsers = async (req, res) => {
  try {
    const page = Math.max(Number(req.query?.page || 1), 1);
    const pageSize = Math.min(Math.max(Number(req.query?.pageSize || 20), 1), 100);
    const offset = (page - 1) * pageSize;
    const q = String(req.query?.q || '').trim();
    const role = req.query?.role ? normalizeRole(req.query.role, true) : null;
    const status = req.query?.status ? normalizeStatus(req.query.status, true) : null;

    let where = 'WHERE u.role IN (\'admin\',\'reader\')';
    const params = [];

    if (q) {
      where += ' AND (u.nombre LIKE ? OR u.apellidos LIKE ? OR u.email LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    if (role) {
      where += ' AND u.role = ?';
      params.push(role);
    }
    if (status) {
      where += ' AND u.status = ?';
      params.push(status);
    }

    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total
       FROM usuarios u
       ${where}`,
      params
    );
    const [rows] = await db.execute(
      `SELECT u.id, u.nombre, u.apellidos, u.email, u.telefono, u.municipio_id, u.role, u.status,
              u.cardholder_sync_id, u.auth0_user_id, u.last_login_at, u.last_failed_login_at,
              u.created_at, u.updated_at, m.nombre AS municipio
       FROM usuarios u
       LEFT JOIN municipios m ON m.id = u.municipio_id
       ${where}
       ORDER BY u.created_at DESC
       LIMIT ${Number(pageSize)} OFFSET ${Number(offset)}`,
      params
    );

    const total = Number(countRows[0]?.total || 0);
    return res.json({
      items: rows.map(mapUserRow),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    safeLogger.error('Error al listar usuarios admin', error);
    return res.status(500).json({ message: 'Error al listar usuarios.' });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const id = normalizePositiveInt(req.params.id, 'id', true);
    const row = await fetchUserById(id);
    if (!row || !ALLOWED_ROLES.has(String(row.role || '').toLowerCase())) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }
    return res.json(mapUserRow(row));
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    safeLogger.error('Error al consultar usuario admin', error);
    return res.status(500).json({ message: 'Error al consultar usuario.' });
  }
};

exports.createUser = async (req, res) => {
  try {
    const nombre = normalizeRequiredString(req.body?.nombre, 120, 'nombre');
    const apellidos = normalizeRequiredString(req.body?.apellidos, 150, 'apellidos');
    const email = normalizeEmail(req.body?.email, true);
    const telefono = normalizeOptionalString(req.body?.telefono, 20, 'telefono');
    const municipioId = normalizePositiveInt(req.body?.municipioId, 'municipioId');
    const role = normalizeRole(req.body?.role, true);
    const status = normalizeStatus(req.body?.status, true);
    const password = normalizeRequiredString(req.body?.password, 120, 'password');
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const [result] = await db.execute(
      `INSERT INTO usuarios
        (nombre, apellidos, email, telefono, municipio_id, password_hash, role, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [nombre, apellidos, email, telefono, municipioId, passwordHash, role, status]
    );

    const created = await fetchUserById(result.insertId);
    await recordAdminActivity({
      actorUserId: req.user.id,
      entityType: 'usuarios',
      entityId: String(result.insertId),
      action: 'create',
      ipAddress: getClientIp(req),
      payload: {
        role,
        status,
        email
      }
    });
    return res.status(201).json(mapUserRow(created));
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'El email ya existe.' });
    }
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    safeLogger.error('Error al crear usuario admin', error);
    return res.status(500).json({ message: 'Error al crear usuario.' });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const id = normalizePositiveInt(req.params.id, 'id', true);
    const current = await fetchUserById(id);
    if (!current || !ALLOWED_ROLES.has(String(current.role || '').toLowerCase())) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    const fields = [];
    const params = [];
    const auditPayload = {};
    let mustInvalidateSession = false;

    const nombre = normalizeOptionalString(req.body?.nombre, 120, 'nombre');
    if (nombre !== undefined) {
      fields.push('nombre = ?');
      params.push(nombre);
      auditPayload.nombre = nombre;
    }

    const apellidos = normalizeOptionalString(req.body?.apellidos, 150, 'apellidos');
    if (apellidos !== undefined) {
      fields.push('apellidos = ?');
      params.push(apellidos);
      auditPayload.apellidos = apellidos;
    }

    const telefono = normalizeOptionalString(req.body?.telefono, 20, 'telefono');
    if (telefono !== undefined) {
      fields.push('telefono = ?');
      params.push(telefono);
      auditPayload.telefono = telefono;
    }

    const email = req.body && Object.prototype.hasOwnProperty.call(req.body, 'email')
      ? normalizeEmail(req.body.email, true)
      : undefined;
    if (email !== undefined) {
      fields.push('email = ?');
      params.push(email);
      auditPayload.email = email;
    }

    const municipioId = normalizePositiveInt(req.body?.municipioId, 'municipioId');
    if (municipioId !== undefined) {
      fields.push('municipio_id = ?');
      params.push(municipioId);
      auditPayload.municipioId = municipioId;
    }

    const role = normalizeRole(req.body?.role);
    if (role !== undefined) {
      fields.push('role = ?');
      params.push(role);
      auditPayload.role = role;
      mustInvalidateSession = mustInvalidateSession || role !== current.role;
    }

    const status = normalizeStatus(req.body?.status);
    if (status !== undefined) {
      fields.push('status = ?');
      params.push(status);
      auditPayload.status = status;
      mustInvalidateSession = mustInvalidateSession || status !== current.status;
    }

    if (fields.length === 0) {
      return res.status(422).json({ message: 'No hay campos para actualizar.' });
    }

    await db.execute(`UPDATE usuarios SET ${fields.join(', ')} WHERE id = ?`, [...params, id]);
    if (mustInvalidateSession) {
      await invalidateAdminSessions(id);
    }
    const updated = await fetchUserById(id);
    await recordAdminActivity({
      actorUserId: req.user.id,
      entityType: 'usuarios',
      entityId: String(id),
      action: 'update',
      ipAddress: getClientIp(req),
      payload: auditPayload
    });
    return res.json(mapUserRow(updated));
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'El email ya existe.' });
    }
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    safeLogger.error('Error al actualizar usuario admin', error);
    return res.status(500).json({ message: 'Error al actualizar usuario.' });
  }
};

exports.setPassword = async (req, res) => {
  try {
    const id = normalizePositiveInt(req.params.id, 'id', true);
    const password = normalizeRequiredString(req.body?.password, 120, 'password');
    const current = await fetchUserById(id);
    if (!current || !ALLOWED_ROLES.has(String(current.role || '').toLowerCase())) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await db.execute('UPDATE usuarios SET password_hash = ? WHERE id = ?', [passwordHash, id]);
    await invalidateAdminSessions(id);
    await recordAdminActivity({
      actorUserId: req.user.id,
      entityType: 'usuarios',
      entityId: String(id),
      action: 'set_password',
      ipAddress: getClientIp(req),
      payload: { passwordReset: true }
    });
    return res.status(204).send();
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    safeLogger.error('Error al cambiar password admin', error);
    return res.status(500).json({ message: 'Error al actualizar password.' });
  }
};
