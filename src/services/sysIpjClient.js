const { sanitize } = require('../utils/safeLogger');

const REQUEST_TIMEOUT_MS = Number(process.env.SYS_IPJ_PUSH_TIMEOUT_MS || 8000);

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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': externalRequestId
      },
      body: JSON.stringify({
        external_request_id: externalRequestId,
        beneficiario: payload
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
