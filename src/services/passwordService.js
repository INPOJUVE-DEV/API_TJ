const argon2 = require('argon2');
const bcrypt = require('bcrypt');

const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;

function buildValidationError(message) {
  const error = new Error(message);
  error.statusCode = 422;
  return error;
}

function normalizeComparableValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function validatePassword(password, options = {}) {
  if (typeof password !== 'string') {
    throw buildValidationError('password es obligatorio.');
  }

  const trimmed = password.trim();
  if (trimmed.length < MIN_PASSWORD_LENGTH) {
    throw buildValidationError(
      `password debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`
    );
  }
  if (trimmed.length > MAX_PASSWORD_LENGTH) {
    throw buildValidationError(
      `password excede la longitud maxima de ${MAX_PASSWORD_LENGTH} caracteres.`
    );
  }

  const comparablePassword = normalizeComparableValue(trimmed);
  const forbiddenValues = [
    options.email,
    ...(Array.isArray(options.forbiddenValues) ? options.forbiddenValues : [])
  ]
    .map(normalizeComparableValue)
    .filter(Boolean);

  for (const forbiddenValue of forbiddenValues) {
    if (
      comparablePassword === forbiddenValue ||
      comparablePassword === forbiddenValue.split('@')[0]
    ) {
      throw buildValidationError('password no puede coincidir con identificadores del usuario.');
    }
  }

  return trimmed;
}

async function hashPassword(password) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1
  });
}

async function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') {
    return { valid: false, needsRehash: false };
  }

  if (storedHash.startsWith('$argon2')) {
    const valid = await argon2.verify(storedHash, password);
    return {
      valid,
      needsRehash: valid ? argon2.needsRehash(storedHash, {
        type: argon2.argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1
      }) : false
    };
  }

  if (storedHash.startsWith('$2')) {
    const valid = await bcrypt.compare(password, storedHash);
    return { valid, needsRehash: valid };
  }

  return { valid: false, needsRehash: false };
}

module.exports = {
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  hashPassword,
  validatePassword,
  verifyPassword
};
