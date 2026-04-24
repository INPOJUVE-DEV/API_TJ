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
}

module.exports = {
  getRequiredEnv,
  validateRuntimeConfig
};
