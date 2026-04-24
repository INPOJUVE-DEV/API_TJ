const CURP_PATTERN = /\b[A-Z][AEIOUX][A-Z]{2}\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])[HM](?:AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z]\d\b/g;

function sanitize(value) {
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
    return value.map(sanitize);
  }
  if (value && typeof value === 'object') {
    const redacted = {};
    for (const [key, item] of Object.entries(value)) {
      if (String(key).toLowerCase() === 'curp') {
        redacted[key] = '[CURP_REDACTED]';
      } else {
        redacted[key] = sanitize(item);
      }
    }
    return redacted;
  }
  return value;
}

function error(...args) {
  console.error(...args.map(sanitize));
}

function warn(...args) {
  console.warn(...args.map(sanitize));
}

function info(...args) {
  console.info(...args.map(sanitize));
}

module.exports = {
  sanitize,
  error,
  warn,
  info
};
