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
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(getAlgorithm(), getKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    payload_ciphertext: ciphertext.toString('base64'),
    payload_iv: iv.toString('base64'),
    payload_tag: tag.toString('base64')
  };
}

function decryptJson({ payload_ciphertext, payload_iv, payload_tag }) {
  const decipher = crypto.createDecipheriv(
    getAlgorithm(),
    getKey(),
    Buffer.from(payload_iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(payload_tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload_ciphertext, 'base64')),
    decipher.final()
  ]);
  return JSON.parse(plaintext.toString('utf8'));
}

module.exports = {
  encryptJson,
  decryptJson
};
