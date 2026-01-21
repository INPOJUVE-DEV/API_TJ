const crypto = require('crypto');
const db = require('../config/db');

const TOKEN_BYTES_RAW = Number(process.env.QR_TOKEN_BYTES || 16);
const TOKEN_BYTES = Number.isFinite(TOKEN_BYTES_RAW) && TOKEN_BYTES_RAW > 0 ? TOKEN_BYTES_RAW : 16;
const QR_PREFIX = (process.env.QR_PREFIX || 'TJ1').trim().toUpperCase();
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function bufferToBase32(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function generateTokenValue() {
  return bufferToBase32(crypto.randomBytes(TOKEN_BYTES));
}

function hashTokenValue(tokenValue) {
  return crypto.createHash('sha256').update(tokenValue).digest('hex');
}

function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

function getMonthWindow(date = new Date()) {
  const year = date.getFullYear();
  const monthIndex = date.getMonth();
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  const yearMonth = `${year}${String(monthIndex + 1).padStart(2, '0')}`;
  return {
    yearMonth,
    validFrom: toDateString(start),
    validUntil: toDateString(end)
  };
}

function formatBarcodeValue(tokenValue, yearMonth) {
  return `${QR_PREFIX}-${tokenValue}-${yearMonth}`;
}

function parseBarcodeValue(barcodeValue) {
  if (typeof barcodeValue !== 'string') {
    return null;
  }
  const trimmed = barcodeValue.trim().toUpperCase();
  if (!trimmed.startsWith(`${QR_PREFIX}-`)) {
    return null;
  }
  const parts = trimmed.split('-').filter(Boolean);
  if (parts.length < 2) {
    return null;
  }
  const tokenValue = parts[1];
  if (!tokenValue || !/^[A-Z2-7]+$/.test(tokenValue)) {
    return null;
  }
  return tokenValue;
}

async function getActiveTokenForUser(userId, date = new Date(), executor = db) {
  const today = toDateString(date);
  const [rows] = await executor.execute(
    `SELECT id, token_value, valid_from
     FROM user_qr_tokens
     WHERE user_id = ? AND status = 'active' AND valid_from <= ? AND valid_until >= ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, today, today]
  );
  return rows[0] || null;
}

async function createMonthlyToken(userId, date = new Date(), executor = db) {
  const { validFrom, validUntil } = getMonthWindow(date);
  const tokenValue = generateTokenValue();
  const tokenHash = hashTokenValue(tokenValue);
  await executor.execute(
    `INSERT INTO user_qr_tokens
      (user_id, token_value, token_hash, status, valid_from, valid_until)
     VALUES (?, ?, ?, 'active', ?, ?)`,
    [userId, tokenValue, tokenHash, validFrom, validUntil]
  );
  const token = await getActiveTokenForUser(userId, date, executor);
  if (!token) {
    return null;
  }
  return token;
}

async function getOrCreateActiveToken(userId, date = new Date(), executor = db) {
  const active = await getActiveTokenForUser(userId, date, executor);
  if (active) {
    return active;
  }
  const { validFrom } = getMonthWindow(date);
  await executor.execute(
    `UPDATE user_qr_tokens
     SET status = 'rotated', revoked_at = NOW()
     WHERE user_id = ? AND status = 'active' AND valid_until < ?`,
    [userId, validFrom]
  );
  try {
    const token = await createMonthlyToken(userId, date, executor);
    return token;
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      return getActiveTokenForUser(userId, date, executor);
    }
    throw error;
  }
}

async function findTokenByBarcode(barcodeValue, date = new Date(), executor = db) {
  const tokenValue = parseBarcodeValue(barcodeValue);
  if (!tokenValue) {
    return null;
  }
  const tokenHash = hashTokenValue(tokenValue);
  const today = toDateString(date);
  const [rows] = await executor.execute(
    `SELECT id, user_id
     FROM user_qr_tokens
     WHERE token_hash = ? AND status = 'active' AND valid_from <= ? AND valid_until >= ?
     LIMIT 1`,
    [tokenHash, today, today]
  );
  return rows[0] || null;
}

module.exports = {
  formatBarcodeValue,
  getMonthWindow,
  getOrCreateActiveToken,
  findTokenByBarcode,
  parseBarcodeValue
};
