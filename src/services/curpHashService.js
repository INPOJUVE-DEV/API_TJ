const crypto = require('crypto');
const { getRequiredEnv } = require('../config/runtimeConfig');

const CURP_REGEX =
  /^[A-Z][AEIOUX][A-Z]{2}\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])[HM](?:AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z]\d$/;

function getSecret() {
  return getRequiredEnv('CURP_HASH_SECRET');
}

function normalizeCurp(curp = '') {
  return String(curp).trim().toUpperCase();
}

function assertValidCurp(curp) {
  if (!CURP_REGEX.test(curp)) {
    const error = new Error('Formato de CURP invalido.');
    error.statusCode = 422;
    throw error;
  }
}

function hashCurp(curp) {
  const normalized = normalizeCurp(curp);
  assertValidCurp(normalized);
  return crypto.createHmac('sha256', getSecret()).update(normalized, 'utf8').digest('hex');
}

function maskCurp(curp) {
  const normalized = normalizeCurp(curp);
  if (!normalized) {
    return null;
  }
  if (normalized.length <= 6) {
    return '*'.repeat(normalized.length);
  }
  return `${normalized.slice(0, 4)}${'*'.repeat(normalized.length - 6)}${normalized.slice(-2)}`;
}

function buildCurpLookup(curp) {
  const normalized = normalizeCurp(curp);
  assertValidCurp(normalized);
  return {
    normalized,
    curpHash: hashCurp(normalized),
    curpMasked: maskCurp(normalized)
  };
}

module.exports = {
  CURP_REGEX,
  normalizeCurp,
  assertValidCurp,
  hashCurp,
  maskCurp,
  buildCurpLookup
};
