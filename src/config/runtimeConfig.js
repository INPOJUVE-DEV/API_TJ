function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`${name} es obligatorio`);
  }
  return value;
}

function validateRuntimeConfig() {
  getRequiredEnv('JWT_SECRET');
  getRequiredEnv('CURP_HASH_SECRET');
  getRequiredEnv('FIELD_ENCRYPTION_KEY');
  if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
    getRequiredEnv('ADMIN_JWT_SECRET');
  }
}

module.exports = {
  getRequiredEnv,
  validateRuntimeConfig
};
