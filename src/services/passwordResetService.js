const crypto = require('crypto');
const db = require('../config/db');

const PASSWORD_RESET_TOKEN_TTL_MINUTES = Math.max(
  Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES || 15),
  1
);

function hashResetToken(token) {
  return crypto.createHash('sha256').update(String(token || ''), 'utf8').digest('hex');
}

function generateResetToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function buildResetUrl(rawToken) {
  const baseUrl = String(process.env.PASSWORD_RESET_URL_BASE || '').trim();
  if (!baseUrl) {
    return null;
  }
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}token=${encodeURIComponent(rawToken)}`;
}

async function createPasswordResetToken(userId, executor = db) {
  const rawToken = generateResetToken();
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  await executor.execute(
    `UPDATE password_reset_tokens
     SET consumed_at = COALESCE(consumed_at, ?)
     WHERE usuario_id = ?
       AND consumed_at IS NULL`,
    [new Date(), userId]
  );

  await executor.execute(
    `INSERT INTO password_reset_tokens
      (usuario_id, token_hash, expires_at)
     VALUES (?, ?, ?)`,
    [userId, tokenHash, expiresAt]
  );

  return {
    rawToken,
    resetUrl: buildResetUrl(rawToken),
    expiresAt
  };
}

async function getActivePasswordResetToken(rawToken, executor = db) {
  const tokenHash = hashResetToken(rawToken);
  const [rows] = await executor.execute(
    `SELECT prt.id, prt.usuario_id, prt.expires_at, prt.consumed_at,
            u.id AS user_id, u.email, u.role, u.status, u.session_version
     FROM password_reset_tokens prt
     JOIN usuarios u ON u.id = prt.usuario_id
     WHERE prt.token_hash = ?
     LIMIT 1`,
    [tokenHash]
  );
  return rows[0] || null;
}

async function consumePasswordResetToken(tokenId, executor = db) {
  await executor.execute(
    `UPDATE password_reset_tokens
     SET consumed_at = COALESCE(consumed_at, ?)
     WHERE id = ?`,
    [new Date(), tokenId]
  );
}

module.exports = {
  buildResetUrl,
  createPasswordResetToken,
  getActivePasswordResetToken,
  consumePasswordResetToken
};
