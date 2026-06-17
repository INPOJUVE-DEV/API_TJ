const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { sanitize } = require('../utils/safeLogger');

const REQUEST_TIMEOUT_MS = Number(process.env.SYS_IPJ_PUSH_TIMEOUT_MS || 8000);
const OUTBOUND_ISSUER = String(process.env.API_TJ_TO_SYS_IPJ_ISSUER || 'api_tj').trim();
const OUTBOUND_SUBJECT = String(process.env.API_TJ_TO_SYS_IPJ_SUBJECT || OUTBOUND_ISSUER).trim();
const OUTBOUND_AUDIENCE = String(process.env.API_TJ_TO_SYS_IPJ_AUDIENCE || 'sys_ipj').trim();
const OUTBOUND_SCOPE = String(
  process.env.API_TJ_TO_SYS_IPJ_SCOPE || 'beneficiarios.create'
).trim();
const OUTBOUND_KID = String(
  process.env.API_TJ_TO_SYS_IPJ_JWT_KID || 'api_tj-current'
).trim();
const OUTBOUND_EXPIRES_IN = String(
  process.env.API_TJ_TO_SYS_IPJ_JWT_EXPIRES_IN || '5m'
).trim();

function buildAuthorizationHeader() {
  const privateKeyPath = String(process.env.API_TJ_TO_SYS_IPJ_PRIVATE_KEY_PATH || '').trim();
  if (!privateKeyPath) {
    throw new Error('API_TJ_TO_SYS_IPJ_PRIVATE_KEY_PATH no configurado');
  }

  let privateKey;
  try {
    privateKey = fs.readFileSync(privateKeyPath, 'utf8');
  } catch (error) {
    throw new Error('No se pudo leer API_TJ_TO_SYS_IPJ_PRIVATE_KEY_PATH');
  }

  const token = jwt.sign(
    {
      iss: OUTBOUND_ISSUER,
      sub: OUTBOUND_SUBJECT,
      aud: OUTBOUND_AUDIENCE,
      scope: OUTBOUND_SCOPE,
      jti: crypto.randomUUID()
    },
    privateKey,
    {
      algorithm: 'RS256',
      expiresIn: OUTBOUND_EXPIRES_IN,
      header: { kid: OUTBOUND_KID }
    }
  );

  return `Bearer ${token}`;
}

async function pushBeneficiario({ externalRequestId, payload }) {
  const url = process.env.SYS_IPJ_PUSH_URL;
  if (!url) {
    return {
      ok: false,
      status: null,
      body: null,
      errorMessage: 'SYS_IPJ_PUSH_URL no configurado'
    };
  }

  let authorization;
  try {
    authorization = buildAuthorizationHeader();
  } catch (error) {
    return {
      ok: false,
      status: null,
      body: null,
      errorMessage: sanitize(error?.message)
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': externalRequestId,
        Authorization: authorization
      },
      body: JSON.stringify({
        external_request_id: externalRequestId,
        beneficiario: payload,
        records: [payload]
      }),
      signal: controller.signal
    });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch (error) {
      body = text ? sanitize(text) : null;
    }
    return {
      ok: response.ok,
      status: response.status,
      body,
      errorMessage: response.ok ? null : sanitize(text || 'Error al enviar a Sys_IPJ')
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      body: null,
      errorMessage:
        error?.name === 'AbortError' ? 'Timeout al enviar a Sys_IPJ' : sanitize(error?.message)
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  pushBeneficiario
};
