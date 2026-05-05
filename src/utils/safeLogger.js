const CURP_PATTERN = /\b[A-Z][AEIOUX][A-Z]{2}\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])[HM](?:AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z]\d\b/g;
const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'password_confirmation',
  'refresh_token',
  'access_token',
  'accesstoken',
  'token',
  'token_hash',
  'reset_token',
  'auth0_id_token',
  'cookie'
]);

function sanitize(value, parentKey = '') {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitize(value.message),
      code: value.code || undefined
    };
  }
  if (typeof value === 'string') {
    return value.replace(CURP_PATTERN, '[CURP_REDACTED]');
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, parentKey));
  }
  if (value && typeof value === 'object') {
    const redacted = {};
    for (const [key, item] of Object.entries(value)) {
      const lowered = String(key).toLowerCase();
      if (lowered === 'curp') {
        redacted[key] = '[CURP_REDACTED]';
      } else if (SENSITIVE_KEYS.has(lowered)) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = sanitize(item, key);
      }
    }
    return redacted;
  }
  return value;
}

function error(...args) {
  console.error(...args.map((item) => sanitize(item)));
}

function warn(...args) {
  console.warn(...args.map((item) => sanitize(item)));
}

function info(...args) {
  console.info(...args.map((item) => sanitize(item)));
}

module.exports = {
  sanitize,
  error,
  warn,
  info
};
