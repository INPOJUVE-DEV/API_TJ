const crypto = require('crypto');
const { getRequiredEnv } = require('../config/runtimeConfig');

const DEFAULT_ALGORITHM = 'aes-256-gcm';

function getAlgorithm() {
  const algorithm = process.env.FIELD_ENCRYPTION_ALGORITHM || DEFAULT_ALGORITHM;
  if (algorithm !== DEFAULT_ALGORITHM) {
    throw new Error('FIELD_ENCRYPTION_ALGORITHM solo soporta aes-256-gcm');
  }
  return algorithm;
}

function getKey() {
  const raw = getRequiredEnv('FIELD_ENCRYPTION_KEY');

  if (/^[a-f0-9]{64}$/i.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(raw)) {
    const decoded = Buffer.from(raw, 'base64');
    if (decoded.length === 32) {
      return decoded;
    }
  }
  return crypto.createHash('sha256').update(raw, 'utf8').digest();
}

function encryptJson(payload) {
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  return encryptBuffer(plaintext);
}

function encryptString(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value);
  if (!normalized) {
    return null;
  }

  return encryptBuffer(Buffer.from(normalized, 'utf8'));
}

function encryptBuffer(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(getAlgorithm(), getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    payload_ciphertext: ciphertext.toString('base64'),
    payload_iv: iv.toString('base64'),
    payload_tag: tag.toString('base64')
  };
}

function decryptJson({ payload_ciphertext, payload_iv, payload_tag }) {
  return JSON.parse(decryptBuffer({ payload_ciphertext, payload_iv, payload_tag }).toString('utf8'));
}

function decryptString(payload) {
  if (!payload?.payload_ciphertext || !payload?.payload_iv || !payload?.payload_tag) {
    return null;
  }

  return decryptBuffer(payload).toString('utf8');
}

function decryptBuffer({ payload_ciphertext, payload_iv, payload_tag }) {
  const decipher = crypto.createDecipheriv(
    getAlgorithm(),
    getKey(),
    Buffer.from(payload_iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(payload_tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(payload_ciphertext, 'base64')),
    decipher.final()
  ]);
}

module.exports = {
  encryptJson,
  encryptString,
  decryptJson,
  decryptString
};
