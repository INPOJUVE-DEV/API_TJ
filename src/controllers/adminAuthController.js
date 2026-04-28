const bcrypt = require('bcrypt');
const db = require('../config/db');
const {
  buildAdminToken,
  buildSessionResponse,
  getUserByEmail,
  getUserById,
  invalidateAdminSessions,
  isAdminRole,
  touchLoginFailure,
  touchLoginSuccess
} = require('../services/adminAuthService');
const { getClientIp, recordAdminActivity } = require('../services/adminActivityService');
const safeLogger = require('../utils/safeLogger');

function invalidCredentials(res) {
  return res.status(401).json({ message: 'Credenciales invalidas' });
}

exports.login = async (req, res) => {
  const username = String(req.body?.username || req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!username || !password) {
    return res.status(400).json({ message: 'username y password son obligatorios' });
  }

  try {
    const user = await getUserByEmail(username);
    if (!user) {
      await recordAdminActivity({
        actorEmail: username,
        entityType: 'admin_auth',
        entityId: username,
        action: 'login_failed',
        ipAddress: getClientIp(req),
        payload: { reason: 'invalid_credentials' }
      });
      return invalidCredentials(res);
    }

    const passwordMatches = user.password_hash
      ? await bcrypt.compare(password, user.password_hash)
      : false;

    if (!passwordMatches) {
      await touchLoginFailure(user.id);
      await recordAdminActivity({
        actorUserId: user.id,
        actorEmail: user.email,
        entityType: 'admin_auth',
        entityId: String(user.id),
        action: 'login_failed',
        ipAddress: getClientIp(req),
        payload: { reason: 'invalid_credentials' }
      });
      return invalidCredentials(res);
    }

    if (!isAdminRole(user.role) || user.status !== 'active') {
      await touchLoginFailure(user.id);
      await recordAdminActivity({
        actorUserId: user.id,
        actorEmail: user.email,
        entityType: 'admin_auth',
        entityId: String(user.id),
        action: 'login_failed',
        ipAddress: getClientIp(req),
        payload: { reason: 'role_or_status_not_allowed', role: user.role, status: user.status }
      });
      return invalidCredentials(res);
    }

    await touchLoginSuccess(user.id);
    const freshUser = await getUserById(user.id);
    const accessToken = buildAdminToken({
      ...freshUser,
      session_version: user.session_version,
      role: user.role,
      status: user.status
    });
    const session = buildSessionResponse({
      ...freshUser,
      role: user.role,
      status: user.status
    });

    await recordAdminActivity({
      actorUserId: user.id,
      actorEmail: user.email,
      entityType: 'admin_auth',
      entityId: String(user.id),
      action: 'login_succeeded',
      ipAddress: getClientIp(req),
      payload: { role: user.role }
    });

    return res.json({
      accessToken,
      ...session
    });
  } catch (error) {
    safeLogger.error('Error en login admin', error);
    return res.status(500).json({ message: 'Error interno' });
  }
};

exports.logout = async (req, res) => {
  try {
    await invalidateAdminSessions(req.user.id);
    const user = await getUserById(req.user.id);
    await recordAdminActivity({
      actorUserId: req.user.id,
      actorEmail: user?.email || null,
      entityType: 'admin_auth',
      entityId: String(req.user.id),
      action: 'logout',
      ipAddress: getClientIp(req),
      payload: { sessionVersionInvalidated: true }
    });
    return res.status(204).send();
  } catch (error) {
    safeLogger.error('Error en logout admin', error);
    return res.status(500).json({ message: 'Error interno' });
  }
};

exports.session = async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    return res.json(buildSessionResponse(user));
  } catch (error) {
    safeLogger.error('Error al consultar sesion admin', error);
    return res.status(500).json({ message: 'Error interno' });
  }
};
