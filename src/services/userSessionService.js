const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const {
  JWT_SECRET,
  USER_TOKEN_AUDIENCE,
  USER_TOKEN_ISSUER
} = require('../config/tokenConfig');

const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '15m';
const REFRESH_TOKEN_TTL_DAYS = Math.max(Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7), 1);
const REFRESH_COOKIE_NAME = process.env.REFRESH_TOKEN_COOKIE_NAME || 'tj_refresh_token';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

function isPublicUserRole(role) {
  return String(role || '').toLowerCase() === 'beneficiary';
}

function hashOpaqueToken(token) {
  return crypto.createHash('sha256').update(String(token || ''), 'utf8').digest('hex');
}

function generateOpaqueToken() {
  return crypto.randomBytes(48).toString('base64url');
}

function parseCookieHeader(headerValue) {
  return String(headerValue || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, item) => {
      const separatorIndex = item.indexOf('=');
      if (separatorIndex === -1) {
        return acc;
      }
      const key = item.slice(0, separatorIndex).trim();
      const rawValue = item.slice(separatorIndex + 1).trim();
      acc[key] = decodeURIComponent(rawValue);
      return acc;
    }, {});
}

function shouldUseSecureCookies() {
  return (
    String(process.env.AUTH_COOKIE_SECURE || '').toLowerCase() === 'true' ||
    String(process.env.NODE_ENV || '').toLowerCase() === 'production'
  );
}

function serializeCookie(name, value, options = {}) {
  const segments = [`${name}=${encodeURIComponent(value)}`];
  segments.push(`Path=${options.path || '/'}`);
  if (options.httpOnly) {
    segments.push('HttpOnly');
  }
  if (options.sameSite) {
    segments.push(`SameSite=${options.sameSite}`);
  }
  if (options.secure) {
    segments.push('Secure');
  }
  if (typeof options.maxAge === 'number') {
    segments.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }
  if (options.expires instanceof Date) {
    segments.push(`Expires=${options.expires.toUTCString()}`);
  }
  return segments.join('; ');
}

function getRefreshCookieOptions(expiresAt) {
  const secondsUntilExpiry = Math.max(
    0,
    Math.floor((expiresAt.getTime() - Date.now()) / 1000)
  );
  return {
    path: REFRESH_COOKIE_PATH,
    httpOnly: true,
    sameSite: 'Lax',
    secure: shouldUseSecureCookies(),
    expires: expiresAt,
    maxAge: secondsUntilExpiry
  };
}

function buildUserAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      sub: String(user.id),
      role: user.role,
      status: user.status,
      token_type: 'user',
      session_version: Number(user.session_version || 0)
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRATION,
      issuer: USER_TOKEN_ISSUER,
      audience: USER_TOKEN_AUDIENCE
    }
  );
}

function getAccessTokenExpiresInSeconds(accessToken) {
  const decoded = jwt.decode(accessToken);
  if (!decoded?.exp || !decoded?.iat) {
    return null;
  }
  return Math.max(0, Number(decoded.exp) - Number(decoded.iat));
}

function buildSessionUser(user) {
  return {
    id: user.id,
    email: user.email,
    nombreCompleto: [user.nombre, user.apellidos].filter(Boolean).join(' ').trim() || null,
    role: user.role,
    status: user.status,
    cardholderSyncId: user.cardholder_sync_id || null,
    tarjetaNumero: user.tarjeta_numero || null
  };
}

function buildSessionPayload(user) {
  const accessToken = buildUserAccessToken(user);
  return {
    accessToken,
    expiresIn: getAccessTokenExpiresInSeconds(accessToken),
    user: buildSessionUser(user)
  };
}

async function getUserSessionProfileById(userId, executor = db) {
  const [rows] = await executor.execute(
    `SELECT u.id, u.nombre, u.apellidos, u.email, u.password_hash, u.role, u.status,
            u.session_version, u.cardholder_sync_id, cs.tarjeta_numero
     FROM usuarios u
     LEFT JOIN cardholders_sync cs ON cs.id = u.cardholder_sync_id
     WHERE u.id = ?
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function getUserSessionProfileByEmail(email, executor = db) {
  const [rows] = await executor.execute(
    `SELECT u.id, u.nombre, u.apellidos, u.email, u.password_hash, u.role, u.status,
            u.session_version, u.cardholder_sync_id, cs.tarjeta_numero
     FROM usuarios u
     LEFT JOIN cardholders_sync cs ON cs.id = u.cardholder_sync_id
     WHERE u.email = ?
     LIMIT 1`,
    [String(email || '').trim().toLowerCase()]
  );
  return rows[0] || null;
}

async function createRefreshTokenRecord(userId, executor = db, rotatedFrom = null) {
  const rawToken = generateOpaqueToken();
  const tokenHash = hashOpaqueToken(rawToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  const [result] = await executor.execute(
    `INSERT INTO refresh_tokens
      (usuario_id, refresh_token, expiry_date, revoked_at, rotated_from)
     VALUES (?, ?, ?, NULL, ?)`,
    [userId, tokenHash, expiresAt, rotatedFrom]
  );

  return {
    id: result.insertId,
    rawToken,
    tokenHash,
    expiresAt
  };
}

async function issueUserSession(res, user, executor = db) {
  const refreshToken = await createRefreshTokenRecord(user.id, executor);
  setRefreshTokenCookie(res, refreshToken.rawToken, refreshToken.expiresAt);
  return buildSessionPayload(user);
}

function setRefreshTokenCookie(res, rawToken, expiresAt) {
  res.append(
    'Set-Cookie',
    serializeCookie(
      REFRESH_COOKIE_NAME,
      rawToken,
      getRefreshCookieOptions(expiresAt)
    )
  );
}

function clearRefreshTokenCookie(res) {
  res.append(
    'Set-Cookie',
    serializeCookie(REFRESH_COOKIE_NAME, '', {
      path: REFRESH_COOKIE_PATH,
      httpOnly: true,
      sameSite: 'Lax',
      secure: shouldUseSecureCookies(),
      expires: new Date(0),
      maxAge: 0
    })
  );
}

function getRefreshTokenFromRequest(req) {
  const cookies = parseCookieHeader(req?.headers?.cookie || '');
  const rawToken = cookies[REFRESH_COOKIE_NAME];
  return typeof rawToken === 'string' && rawToken.trim() ? rawToken.trim() : null;
}

async function getRefreshTokenSession(rawToken, executor = db) {
  const tokenHash = hashOpaqueToken(rawToken);
  const [rows] = await executor.execute(
    `SELECT rt.id, rt.usuario_id, rt.refresh_token, rt.expiry_date, rt.revoked_at, rt.rotated_from,
            u.id AS user_id, u.nombre, u.apellidos, u.email, u.password_hash, u.role, u.status,
            u.session_version, u.cardholder_sync_id, cs.tarjeta_numero
     FROM refresh_tokens rt
     JOIN usuarios u ON u.id = rt.usuario_id
     LEFT JOIN cardholders_sync cs ON cs.id = u.cardholder_sync_id
     WHERE rt.refresh_token = ?
     LIMIT 1`,
    [tokenHash]
  );
  return rows[0] || null;
}

async function revokeRefreshTokenById(refreshTokenId, executor = db) {
  await executor.execute(
    `UPDATE refresh_tokens
     SET revoked_at = COALESCE(revoked_at, ?)
     WHERE id = ?`,
    [new Date(), refreshTokenId]
  );
}

async function revokeAllRefreshTokensForUser(userId, executor = db) {
  await executor.execute(
    `UPDATE refresh_tokens
     SET revoked_at = COALESCE(revoked_at, ?)
     WHERE usuario_id = ?`,
    [new Date(), userId]
  );
}

async function rotateRefreshToken(session, executor = db) {
  const nextToken = await createRefreshTokenRecord(session.usuario_id, executor, session.id);
  await revokeRefreshTokenById(session.id, executor);
  return nextToken;
}

module.exports = {
  buildSessionPayload,
  buildSessionUser,
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
};
