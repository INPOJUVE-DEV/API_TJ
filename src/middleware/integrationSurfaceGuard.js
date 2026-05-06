const jwt = require('jsonwebtoken');

const CLIENT_ROUTE_ALLOWLIST = {
  unidad_informatica: [
    { method: 'POST', path: '/api/v1/cardholders/lookup' },
    { method: 'POST', path: '/api/v1/beneficiarios-staging' }
  ],
  sys_ipj: [{ method: 'POST', path: '/api/v1/cardholders/sync' }]
};

const GENERIC_INTEGRATION_ROUTES = Object.values(CLIENT_ROUTE_ALLOWLIST).flat();

function normalizePath(pathname) {
  const normalized = String(pathname || '')
    .split('?')[0]
    .trim()
    .replace(/\/+$/, '');
  return normalized || '/';
}

function isAllowedRoute(allowlist, method, path) {
  return allowlist.some((entry) => entry.method === method && entry.path === path);
}

function decodeBearerToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !/^Bearer\s+\S+$/i.test(authHeader)) {
    return null;
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');
  return jwt.decode(token, { complete: true });
}

function looksLikeIntegrationToken(decoded) {
  if (!decoded) {
    return false;
  }
  return (
    decoded?.header?.alg === 'RS256' ||
    Boolean(decoded?.header?.kid) ||
    Boolean(decoded?.payload?.scope) ||
    Object.prototype.hasOwnProperty.call(CLIENT_ROUTE_ALLOWLIST, String(decoded?.payload?.iss || ''))
  );
}

module.exports = function integrationSurfaceGuard(req, res, next) {
  if (req.method === 'OPTIONS') {
    return next();
  }

  const decoded = decodeBearerToken(req);
  if (!looksLikeIntegrationToken(decoded)) {
    return next();
  }

  const clientCode = String(decoded?.payload?.iss || '').trim();
  const allowlist = CLIENT_ROUTE_ALLOWLIST[clientCode] || GENERIC_INTEGRATION_ROUTES;
  const method = String(req.method || '').toUpperCase();
  const path = normalizePath(req.path || req.originalUrl || req.url);

  if (isAllowedRoute(allowlist, method, path)) {
    return next();
  }

  return res.status(403).json({
    message: 'Token de integracion no autorizado para este endpoint.'
  });
};
