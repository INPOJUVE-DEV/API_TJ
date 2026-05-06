function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`${name} es obligatorio`);
  }
  return value;
}

function validateRuntimeConfig() {
  const jwtSecret = getRequiredEnv('JWT_SECRET');
  getRequiredEnv('CURP_HASH_SECRET');
  getRequiredEnv('FIELD_ENCRYPTION_KEY');
  if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
    const adminJwtSecret = getRequiredEnv('ADMIN_JWT_SECRET');
    if (adminJwtSecret === jwtSecret) {
      throw new Error('ADMIN_JWT_SECRET debe ser distinto de JWT_SECRET en produccion');
    }
  }
}

module.exports = {
  getRequiredEnv,
  validateRuntimeConfig
};
