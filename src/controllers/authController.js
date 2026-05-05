const db = require('../config/db');
const {
  createPasswordResetToken,
  consumePasswordResetToken,
  getActivePasswordResetToken
} = require('../services/passwordResetService');
const {
  hashPassword,
  validatePassword,
  verifyPassword
} = require('../services/passwordService');
const safeLogger = require('../utils/safeLogger');
const {
  buildSessionPayload,
  clearRefreshTokenCookie,
  getRefreshTokenFromRequest,
  getRefreshTokenSession,
  getUserSessionProfileByEmail,
  getUserSessionProfileById,
  isPublicUserRole,
  issueUserSession,
  revokeAllRefreshTokensForUser,
  revokeRefreshTokenById,
  rotateRefreshToken,
  setRefreshTokenCookie
} = require('../services/userSessionService');

function invalidCredentials(res) {
  return res.status(401).json({ message: 'Credenciales invalidas' });
}

function buildValidationError(message) {
  const error = new Error(message);
  error.statusCode = 422;
  return error;
}

function normalizeEmail(value, field = 'email') {
  if (typeof value !== 'string' || !value.trim()) {
    const error = new Error(`${field} es obligatorio`);
    error.statusCode = 400;
    throw error;
  }
  const normalized = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    const error = new Error(`${field} no es valido`);
    error.statusCode = 422;
    throw error;
  }
  return normalized;
}

function normalizePasswordConfirmation(password, passwordConfirmation) {
  if (password !== passwordConfirmation) {
    throw buildValidationError('password_confirmation no coincide.');
  }
}

async function touchLoginSuccess(userId, executor = db) {
  await executor.execute(
    'UPDATE usuarios SET last_login_at = ?, last_failed_login_at = NULL WHERE id = ?',
    [new Date(), userId]
  );
}

async function touchLoginFailure(userId, executor = db) {
  await executor.execute('UPDATE usuarios SET last_failed_login_at = ? WHERE id = ?', [
    new Date(),
    userId
  ]);
}

async function invalidateUserSessions(userId, executor = db) {
  await executor.execute(
    'UPDATE usuarios SET session_version = session_version + 1 WHERE id = ?',
    [userId]
  );
  await revokeAllRefreshTokensForUser(userId, executor);
}

function getGenericForgotPasswordResponse(debugPayload = null) {
  const response = {
    message:
      'Si el correo existe y esta habilitado, recibira instrucciones para restablecer la contrasena.'
  };
  if (debugPayload) {
    response.debug = debugPayload;
  }
  return response;
}

exports.login = async (req, res) => {
  const username = String(req.body?.username || req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!username || !password) {
    return res.status(400).json({ message: 'username y password son obligatorios' });
  }

  let connection;
  try {
    connection = await db.getConnection();
    const user = await getUserSessionProfileByEmail(normalizeEmail(username, 'username'), connection);
    if (!user || !user.password_hash || !isPublicUserRole(user.role) || user.status !== 'active') {
      if (user?.id) {
        await touchLoginFailure(user.id, connection);
      }
      return invalidCredentials(res);
    }

    const passwordState = await verifyPassword(password, user.password_hash);
    if (!passwordState.valid) {
      await touchLoginFailure(user.id, connection);
      return invalidCredentials(res);
    }

    if (passwordState.needsRehash) {
      const updatedHash = await hashPassword(password);
      await connection.execute('UPDATE usuarios SET password_hash = ? WHERE id = ?', [
        updatedHash,
        user.id
      ]);
    }

    await touchLoginSuccess(user.id, connection);
    const freshUser = await getUserSessionProfileById(user.id, connection);
    return res.json(await issueUserSession(res, freshUser, connection));
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    safeLogger.error('Error en login de beneficiario', error);
    return res.status(500).json({ message: 'Error interno' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

exports.refresh = async (req, res) => {
  const rawRefreshToken = getRefreshTokenFromRequest(req);
  if (!rawRefreshToken) {
    clearRefreshTokenCookie(res);
    return res.status(401).json({ message: 'Sesion no disponible.' });
  }

  let connection;
  let finished = false;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const session = await getRefreshTokenSession(rawRefreshToken, connection);
    if (!session) {
      await connection.rollback();
      finished = true;
      clearRefreshTokenCookie(res);
      return res.status(401).json({ message: 'Sesion no disponible.' });
    }

    if (session.revoked_at) {
      await invalidateUserSessions(session.user_id, connection);
      await connection.commit();
      finished = true;
      clearRefreshTokenCookie(res);
      return res.status(401).json({ message: 'Sesion no disponible.' });
    }

    if (new Date(session.expiry_date) <= new Date()) {
      await revokeRefreshTokenById(session.id, connection);
      await connection.commit();
      finished = true;
      clearRefreshTokenCookie(res);
      return res.status(401).json({ message: 'Sesion no disponible.' });
    }

    if (!isPublicUserRole(session.role) || session.status !== 'active') {
      await revokeRefreshTokenById(session.id, connection);
      await connection.commit();
      finished = true;
      clearRefreshTokenCookie(res);
      return res.status(401).json({ message: 'Sesion no disponible.' });
    }

    const rotatedToken = await rotateRefreshToken(session, connection);
    const freshUser = await getUserSessionProfileById(session.user_id, connection);
    const payload = buildSessionPayload(freshUser);

    await connection.commit();
    finished = true;
    setRefreshTokenCookie(res, rotatedToken.rawToken, rotatedToken.expiresAt);
    return res.json(payload);
  } catch (error) {
    if (connection && !finished) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        safeLogger.error('Error al revertir refresh de beneficiario', rollbackError);
      }
    }
    safeLogger.error('Error al refrescar sesion de beneficiario', error);
    clearRefreshTokenCookie(res);
    return res.status(500).json({ message: 'Error interno' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

exports.logout = async (req, res) => {
  const rawRefreshToken = getRefreshTokenFromRequest(req);

  try {
    if (rawRefreshToken) {
      const session = await getRefreshTokenSession(rawRefreshToken);
      if (session && !session.revoked_at) {
        await revokeRefreshTokenById(session.id);
      }
    }
    clearRefreshTokenCookie(res);
    return res.status(204).send();
  } catch (error) {
    safeLogger.error('Error en logout de beneficiario', error);
    clearRefreshTokenCookie(res);
    return res.status(500).json({ message: 'Error interno' });
  }
};

exports.forgotPassword = async (req, res) => {
  let email;
  try {
    email = normalizeEmail(req.body?.email);
  } catch (error) {
    return res.status(error.statusCode || 400).json({ message: error.message });
  }

  try {
    const user = await getUserSessionProfileByEmail(email);
    if (!user || !isPublicUserRole(user.role) || user.status !== 'active') {
      return res.json(getGenericForgotPasswordResponse());
    }

    const resetToken = await createPasswordResetToken(user.id);
    const debugEnabled =
      String(process.env.PASSWORD_RESET_DEBUG || '').toLowerCase() === 'true' &&
      String(process.env.NODE_ENV || '').toLowerCase() !== 'production';

    return res.json(
      getGenericForgotPasswordResponse(
        debugEnabled
          ? {
              resetToken: resetToken.rawToken,
              resetUrl: resetToken.resetUrl,
              expiresAt: resetToken.expiresAt.toISOString()
            }
          : null
      )
    );
  } catch (error) {
    safeLogger.error('Error en forgot-password de beneficiario', error);
    return res.status(500).json({ message: 'Error interno' });
  }
};

exports.resetPassword = async (req, res) => {
  const token = String(req.body?.token || '').trim();
  const password = String(req.body?.password || '');
  const passwordConfirmation = String(req.body?.password_confirmation || '');

  if (!token || !password || !passwordConfirmation) {
    return res.status(400).json({
      message: 'token, password y password_confirmation son obligatorios.'
    });
  }

  let connection;
  let finished = false;
  try {
    normalizePasswordConfirmation(password, passwordConfirmation);
    connection = await db.getConnection();
    await connection.beginTransaction();

    const tokenRecord = await getActivePasswordResetToken(token, connection);
    if (
      !tokenRecord ||
      tokenRecord.consumed_at ||
      new Date(tokenRecord.expires_at) <= new Date() ||
      !isPublicUserRole(tokenRecord.role)
    ) {
      await connection.rollback();
      finished = true;
      clearRefreshTokenCookie(res);
      return res.status(400).json({ message: 'Token de restablecimiento invalido o expirado.' });
    }

    const safePassword = validatePassword(password, {
      email: tokenRecord.email,
      forbiddenValues: [tokenRecord.email]
    });
    const passwordHash = await hashPassword(safePassword);

    await connection.execute(
      `UPDATE usuarios
       SET password_hash = ?, status = 'active', session_version = session_version + 1
       WHERE id = ?`,
      [passwordHash, tokenRecord.user_id]
    );
    await revokeAllRefreshTokensForUser(tokenRecord.user_id, connection);
    await consumePasswordResetToken(tokenRecord.id, connection);

    await connection.commit();
    finished = true;
    clearRefreshTokenCookie(res);
    return res.json({
      reset: true,
      message: 'Contrasena actualizada correctamente.'
    });
  } catch (error) {
    if (connection && !finished) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        safeLogger.error('Error al revertir reset-password de beneficiario', rollbackError);
      }
    }
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    safeLogger.error('Error en reset-password de beneficiario', error);
    return res.status(500).json({ message: 'Error interno' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

exports.sendOtp = async (req, res) => {
  return res.status(410).json({
    message: 'El flujo OTP por CURP fue retirado. Usa la activacion local del beneficiario.'
  });
};

exports.verifyOtp = async (req, res) => {
  return res.status(410).json({
    message: 'El flujo OTP por CURP fue retirado. Usa la activacion local del beneficiario.'
  });
};
