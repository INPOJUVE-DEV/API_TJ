const jwt = require('jsonwebtoken');
const db = require('../config/db');

const INTEGRATION_AUDIENCE = process.env.INTEGRATION_JWT_AUDIENCE || 'api_tj';

function parseJsonList(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map(String);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(String);
      }
    } catch (error) {
      return value
        .split(/[,\s]+/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || null;
}

function scopeSet(value) {
  if (Array.isArray(value)) {
    return new Set(value.map(String));
  }
  return new Set(
    String(value || '')
      .split(/\s+/)
      .map((scope) => scope.trim())
      .filter(Boolean)
  );
}

function hasRequiredScope(tokenScopes, requiredScope) {
  if (!requiredScope) {
    return true;
  }
  return scopeSet(tokenScopes).has(requiredScope);
}

async function resolveClientAndKey({ issuer, kid }) {
  const [clients] = await db.execute(
    `SELECT id, client_code, status, allowed_scopes, ip_allowlist, key_id_current
     FROM service_clients
     WHERE client_code = ?
     LIMIT 1`,
    [issuer]
  );
  if (clients.length === 0 || clients[0].status !== 'active') {
    const error = new Error('Cliente de integracion no autorizado.');
    error.statusCode = 401;
    throw error;
  }

  const [keys] = await db.execute(
    `SELECT kid, public_key, status, valid_from, valid_until
     FROM service_client_keys
     WHERE client_id = ? AND kid = ? AND status = 'active'
     LIMIT 1`,
    [clients[0].id, kid]
  );
  if (keys.length === 0) {
    const error = new Error('Llave de integracion no autorizada.');
    error.statusCode = 401;
    throw error;
  }

  const now = Date.now();
  const key = keys[0];
  if (key.valid_from && new Date(key.valid_from).getTime() > now) {
    const error = new Error('Llave de integracion aun no vigente.');
    error.statusCode = 401;
    throw error;
  }
  if (key.valid_until && new Date(key.valid_until).getTime() < now) {
    const error = new Error('Llave de integracion expirada.');
    error.statusCode = 401;
    throw error;
  }

  return { client: clients[0], key };
}

async function registerJti({ clientId, jti, expiresAt }) {
  try {
    await db.execute('DELETE FROM integration_jti_log WHERE client_id = ? AND expires_at < ?', [
      clientId,
      new Date()
    ]);
    await db.execute(
      `INSERT INTO integration_jti_log (client_id, jti, expires_at)
       VALUES (?, ?, ?)`,
      [clientId, jti, expiresAt]
    );
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      const replay = new Error('Token de integracion reutilizado.');
      replay.statusCode = 401;
      throw replay;
    }
    throw error;
  }
}

async function verifyIntegrationRequest(req, requiredScope) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !/^Bearer\s+\S+$/i.test(authHeader)) {
    const error = new Error('Token requerido.');
    error.statusCode = 401;
    throw error;
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded?.header?.kid || !decoded?.payload?.iss || !decoded?.payload?.jti) {
    const error = new Error('Token de integracion incompleto.');
    error.statusCode = 401;
    throw error;
  }

  const { client, key } = await resolveClientAndKey({
    issuer: decoded.payload.iss,
    kid: decoded.header.kid
  });

  const payload = jwt.verify(token, key.public_key, {
    algorithms: ['RS256'],
    audience: INTEGRATION_AUDIENCE,
    issuer: client.client_code
  });

  const allowedScopes = new Set(parseJsonList(client.allowed_scopes));
  const tokenScopes = scopeSet(payload.scope);
  for (const tokenScope of tokenScopes) {
    if (!allowedScopes.has(tokenScope)) {
      const error = new Error('Scope no permitido para el cliente.');
      error.statusCode = 403;
      throw error;
    }
  }
  if (!hasRequiredScope(payload.scope, requiredScope)) {
    const error = new Error('Scope requerido no incluido.');
    error.statusCode = 403;
    throw error;
  }

  const allowedIps = parseJsonList(client.ip_allowlist);
  const clientIp = getClientIp(req);
  if (allowedIps.length > 0 && !allowedIps.includes(clientIp)) {
    const error = new Error('IP no permitida.');
    error.statusCode = 403;
    throw error;
  }

  await registerJti({
    clientId: client.id,
    jti: payload.jti,
    expiresAt: new Date(payload.exp * 1000)
  });
  await db.execute('UPDATE service_clients SET last_used_at = ? WHERE id = ?', [
    new Date(),
    client.id
  ]);

  return {
    client,
    payload,
    scopes: [...tokenScopes],
    ip: clientIp
  };
}

module.exports = {
  verifyIntegrationRequest,
  parseJsonList,
  scopeSet
};
