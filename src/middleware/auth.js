const jwt = require('jsonwebtoken');
const {
  ADMIN_JWT_SECRET,
  JWT_SECRET,
  getAdminTokenVerifyOptions,
  getUserTokenVerifyOptions
} = require('../config/tokenConfig');

function verifyAppToken(token) {
  const attempts = [
    {
      secret: JWT_SECRET,
      verifyOptions: getUserTokenVerifyOptions(),
      tokenType: 'user'
    },
    {
      secret: ADMIN_JWT_SECRET,
      verifyOptions: getAdminTokenVerifyOptions(),
      tokenType: 'admin'
    }
  ];

  let lastError;
  for (const attempt of attempts) {
    try {
      const decoded = jwt.verify(token, attempt.secret, attempt.verifyOptions);
      if (decoded.token_type !== attempt.tokenType) {
        const error = new Error('Tipo de token invalido');
        error.statusCode = 403;
        throw error;
      }
      return decoded;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

module.exports = function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) {
    return res.status(401).json({ message: 'Token no proporcionado' });
  }
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ message: 'Formato de token invalido' });
  }

  const token = parts[1];
  try {
    const decoded = verifyAppToken(token);
    req.user = {
      id: decoded.id,
      role: decoded.role,
      status: decoded.status,
      tokenType: decoded.token_type,
      sessionVersion: decoded.session_version
    };
    return next();
  } catch (err) {
    const decoded = jwt.decode(token, { complete: true });
    const looksLikeIntegrationToken =
      decoded?.header?.alg === 'RS256' ||
      Boolean(decoded?.header?.kid) ||
      Boolean(decoded?.payload?.scope);
    return res
      .status(looksLikeIntegrationToken ? 403 : 401)
      .json({ message: looksLikeIntegrationToken ? 'Acceso denegado' : 'Token invalido' });
  }
};
