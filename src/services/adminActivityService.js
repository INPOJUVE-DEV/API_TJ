const db = require('../config/db');
const { sanitize } = require('../utils/safeLogger');

function getClientIp(req) {
  const forwarded = req?.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req?.ip || req?.socket?.remoteAddress || null;
}

function redactSensitiveFields(value) {
  if (Array.isArray(value)) {
    return value.map(redactSensitiveFields);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  const redacted = {};
  for (const [key, item] of Object.entries(value)) {
    const lowered = String(key).toLowerCase();
    if (['password', 'password_hash', 'refresh_token', 'accesstoken'].includes(lowered)) {
      redacted[key] = '[REDACTED]';
      continue;
    }
    redacted[key] = redactSensitiveFields(item);
  }
  return redacted;
}

async function recordAdminActivity(
  {
    actorUserId = null,
    actorEmail = null,
    entityType,
    entityId,
    action,
    payload = null,
    ipAddress = null
  },
  executor = db
) {
  await executor.execute(
    `INSERT INTO admin_activity_log
      (actor_user_id, actor_email, entity_type, entity_id, action, ip_address, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      actorUserId,
      actorEmail,
      entityType,
      String(entityId),
      action,
      ipAddress,
      payload ? JSON.stringify(sanitize(redactSensitiveFields(payload))) : null
    ]
  );
}

module.exports = {
  getClientIp,
  recordAdminActivity
};
