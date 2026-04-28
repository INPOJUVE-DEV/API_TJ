const jwt = require('jsonwebtoken');
const { assertValidAdminSession } = require('../services/adminAuthService');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET es obligatorio');
}

module.exports = async function verifyAdminToken(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !/^Bearer\s+\S+$/i.test(authHeader)) {
    return res.status(401).json({ message: 'Token admin requerido' });
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.token_type !== 'admin') {
      return res.status(403).json({ message: 'Acceso admin denegado' });
    }

    const user = await assertValidAdminSession({
      userId: decoded.id,
      sessionVersion: decoded.session_version
    });

    req.user = {
      id: user.id,
      role: user.role,
      status: user.status,
      tokenType: 'admin',
      sessionVersion: user.session_version
    };
    req.adminUser = user;
    return next();
  } catch (error) {
    const decoded = jwt.decode(token, { complete: true });
    const looksLikeIntegrationToken =
      decoded?.header?.alg === 'RS256' ||
      Boolean(decoded?.payload?.iss) ||
      Boolean(decoded?.payload?.scope);
    const status = looksLikeIntegrationToken ? 403 : error.statusCode === 403 ? 403 : 401;
    return res.status(status).json({
      message: status === 403 ? 'Acceso admin denegado' : 'Token admin invalido'
    });
  }
};
