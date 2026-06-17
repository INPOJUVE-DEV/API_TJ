const { getRequiredEnv } = require('./runtimeConfig');

const JWT_SECRET = getRequiredEnv('JWT_SECRET');
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || JWT_SECRET;

const USER_TOKEN_ISSUER = process.env.USER_TOKEN_ISSUER || 'api_tj:user';
const USER_TOKEN_AUDIENCE = process.env.USER_TOKEN_AUDIENCE || 'api_tj:public';
const ADMIN_TOKEN_ISSUER = process.env.ADMIN_TOKEN_ISSUER || 'api_tj:admin';
const ADMIN_TOKEN_AUDIENCE = process.env.ADMIN_TOKEN_AUDIENCE || 'api_tj:admin';
const ADMIN_STREAM_TOKEN_ISSUER = process.env.ADMIN_STREAM_TOKEN_ISSUER || ADMIN_TOKEN_ISSUER;
const ADMIN_STREAM_TOKEN_AUDIENCE =
  process.env.ADMIN_STREAM_TOKEN_AUDIENCE || `${ADMIN_TOKEN_AUDIENCE}:stream`;

function getUserTokenVerifyOptions() {
  return {
    issuer: USER_TOKEN_ISSUER,
    audience: USER_TOKEN_AUDIENCE
  };
}

function getAdminTokenVerifyOptions() {
  return {
    issuer: ADMIN_TOKEN_ISSUER,
    audience: ADMIN_TOKEN_AUDIENCE
  };
}

function getAdminStreamTokenVerifyOptions() {
  return {
    issuer: ADMIN_STREAM_TOKEN_ISSUER,
    audience: ADMIN_STREAM_TOKEN_AUDIENCE
  };
}

module.exports = {
  JWT_SECRET,
  ADMIN_JWT_SECRET,
  USER_TOKEN_ISSUER,
  USER_TOKEN_AUDIENCE,
  ADMIN_TOKEN_ISSUER,
  ADMIN_TOKEN_AUDIENCE,
  ADMIN_STREAM_TOKEN_ISSUER,
  ADMIN_STREAM_TOKEN_AUDIENCE,
  getUserTokenVerifyOptions,
  getAdminTokenVerifyOptions,
  getAdminStreamTokenVerifyOptions
};
