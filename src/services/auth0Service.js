const crypto = require('crypto');
const jwt = require('jsonwebtoken');

let jwksCache = null;
let jwksFetchedAt = 0;
const JWKS_TTL_MS = 10 * 60 * 1000;

function getAuth0Config() {
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  if (!domain || !clientId) {
    const error = new Error('AUTH0_DOMAIN y AUTH0_CLIENT_ID son obligatorios');
    error.statusCode = 500;
    throw error;
  }
  let issuer;
  if (domain.startsWith('https://') || domain.startsWith('http://')) {
    issuer = `${domain.replace(/\/$/, '')}/`;
  } else {
    issuer = `https://${domain}/`;
  }
  return {
    issuer,
    audience: clientId,
    jwksUrl: `${issuer}.well-known/jwks.json`
  };
}

async function fetchJwks() {
  const now = Date.now();
  if (jwksCache && now - jwksFetchedAt < JWKS_TTL_MS) {
    return jwksCache;
  }

  const { jwksUrl } = getAuth0Config();
  const response = await fetch(jwksUrl);
  if (!response.ok) {
    const error = new Error('No se pudo obtener JWKS de Auth0');
    error.statusCode = 401;
    throw error;
  }
  jwksCache = await response.json();
  jwksFetchedAt = now;
  return jwksCache;
}

async function getPublicKey(kid) {
  const jwks = await fetchJwks();
  const jwk = jwks.keys?.find((key) => key.kid === kid && key.kty === 'RSA');
  if (!jwk) {
    const error = new Error('Llave Auth0 no encontrada');
    error.statusCode = 401;
    throw error;
  }
  return crypto.createPublicKey({ key: jwk, format: 'jwk' }).export({
    format: 'pem',
    type: 'spki'
  });
}

async function verifyIdToken(idToken) {
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded?.header?.kid) {
    const error = new Error('Token Auth0 incompleto');
    error.statusCode = 401;
    throw error;
  }

  const publicKey = await getPublicKey(decoded.header.kid);
  const { issuer, audience } = getAuth0Config();
  const payload = jwt.verify(idToken, publicKey, {
    algorithms: ['RS256'],
    issuer,
    audience
  });
  if (!payload.sub) {
    const error = new Error('Token Auth0 sin subject');
    error.statusCode = 401;
    throw error;
  }
  return payload;
}

module.exports = {
  verifyIdToken,
  getAuth0Config
};
