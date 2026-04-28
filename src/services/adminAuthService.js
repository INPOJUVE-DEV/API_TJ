const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET es obligatorio');
}

const ADMIN_JWT_EXPIRATION = process.env.ADMIN_JWT_EXPIRATION || '8h';
const ADMIN_ROLES = new Set(['admin', 'reader']);

const ROLE_PERMISSIONS = {
  admin: [
    'dashboard.read',
    'convenios.read',
    'convenios.write',
    'users.read',
    'users.write',
    'staging.read',
    'staging.push',
    'lookups.read'
  ],
  reader: ['dashboard.read', 'convenios.read', 'users.read', 'staging.read', 'lookups.read']
};

function buildAdminToken(user) {
  return jwt.sign(
    {
      id: user.id,
      sub: String(user.id),
      role: user.role,
      status: user.status,
      token_type: 'admin',
      session_version: Number(user.session_version || 0)
    },
    JWT_SECRET,
    { expiresIn: ADMIN_JWT_EXPIRATION }
  );
}

function getPermissions(role) {
  return ROLE_PERMISSIONS[String(role || '').toLowerCase()] || [];
}

function isAdminRole(role) {
  return ADMIN_ROLES.has(String(role || '').toLowerCase());
}

async function getUserByEmail(email, executor = db) {
  const [rows] = await executor.execute(
    `SELECT id, nombre, apellidos, email, password_hash, role, status, session_version,
            last_login_at, last_failed_login_at
     FROM usuarios
     WHERE email = ?
     LIMIT 1`,
    [String(email || '').trim().toLowerCase()]
  );
  return rows[0] || null;
}

async function getUserById(id, executor = db) {
  const [rows] = await executor.execute(
    `SELECT u.id, u.nombre, u.apellidos, u.email, u.role, u.status, u.session_version,
            u.last_login_at, u.last_failed_login_at, u.created_at, u.updated_at,
            m.nombre AS municipio
     FROM usuarios u
     LEFT JOIN municipios m ON m.id = u.municipio_id
     WHERE u.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function touchLoginSuccess(userId, executor = db) {
  await executor.execute(
    'UPDATE usuarios SET last_login_at = ?, last_failed_login_at = NULL WHERE id = ?',
    [new Date(), userId]
  );
}

async function touchLoginFailure(userId, executor = db) {
  await executor.execute('UPDATE usuarios SET last_failed_login_at = ? WHERE id = ?', [new Date(), userId]);
}

async function invalidateAdminSessions(userId, executor = db) {
  await executor.execute(
    'UPDATE usuarios SET session_version = session_version + 1 WHERE id = ?',
    [userId]
  );
}

async function assertValidAdminSession({ userId, sessionVersion }, executor = db) {
  const [rows] = await executor.execute(
    `SELECT id, nombre, apellidos, email, role, status, session_version
     FROM usuarios
     WHERE id = ?
     LIMIT 1`,
    [userId]
  );

  if (rows.length === 0) {
    const error = new Error('Sesion admin invalida.');
    error.statusCode = 401;
    throw error;
  }

  const user = rows[0];
  if (!isAdminRole(user.role) || user.status !== 'active') {
    const error = new Error('Sesion admin no autorizada.');
    error.statusCode = 403;
    throw error;
  }
  if (Number(user.session_version || 0) !== Number(sessionVersion || 0)) {
    const error = new Error('Sesion admin expirada.');
    error.statusCode = 401;
    throw error;
  }
  return user;
}

function buildSessionResponse(user) {
  const role = String(user.role || '').toLowerCase();
  return {
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      nombreCompleto: [user.nombre, user.apellidos].filter(Boolean).join(' ').trim() || null,
      role,
      status: user.status,
      municipio: user.municipio || null
    },
    role,
    status: user.status,
    permissions: getPermissions(role)
  };
}

module.exports = {
  ADMIN_JWT_EXPIRATION,
  buildAdminToken,
  buildSessionResponse,
  getPermissions,
  getUserByEmail,
  getUserById,
  invalidateAdminSessions,
  isAdminRole,
  assertValidAdminSession,
  touchLoginSuccess,
  touchLoginFailure
};
