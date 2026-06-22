const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const DEFAULT_FIXTURE_PATH = path.join(
  __dirname,
  '..',
  'fixtures',
  'unidad-informatica-arrival.payload.json'
);

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function getConfig() {
  return {
    apiBaseUrl: String(process.env.API_BASE_URL || 'http://127.0.0.1:8081')
      .trim()
      .replace(/\/+$/, ''),
    mockBaseUrl: String(process.env.MOCK_BASE_URL || '')
      .trim()
      .replace(/\/+$/, ''),
    lookupPath: String(process.env.UI_LOOKUP_PATH || '/api/v1/cardholders/lookup').trim(),
    stagingPath: String(process.env.UI_STAGING_PATH || '/api/v1/beneficiarios-staging').trim(),
    clientCode: String(process.env.UI_CLIENT_CODE || 'unidad_informatica').trim(),
    kid: String(process.env.UI_KID || 'unidad_informatica-current').trim(),
    audience: String(process.env.UI_AUDIENCE || 'api_tj').trim(),
    expiresIn: String(process.env.UI_EXPIRES_IN || '5m').trim(),
    privateKeyPath: String(process.env.UI_PRIVATE_KEY_PATH || '').trim(),
    integrationToken: String(process.env.UI_INTEGRATION_TOKEN || '').trim(),
    lookupToken: String(process.env.UI_LOOKUP_TOKEN || '').trim(),
    stagingToken: String(process.env.UI_STAGING_TOKEN || '').trim(),
    fixturePath: String(process.env.UI_SEED_FIXTURE || DEFAULT_FIXTURE_PATH).trim()
  };
}

function loadFixture(fixturePath) {
  return JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function requestJson({ method, url, token, body }) {
  const response = await fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text || null;
  }

  return {
    ok: response.ok,
    status: response.status,
    body: parsed
  };
}

function buildRandomSuffix(seed) {
  return `${ALPHABET[seed % ALPHABET.length]}${seed % 10}`;
}

function buildSyntheticCurp(prefix, seed) {
  if (typeof prefix !== 'string' || prefix.trim().length !== 16) {
    throw new Error(
      `curp_template_prefix debe tener 16 caracteres validos. Recibido: ${prefix || '<vacio>'}`
    );
  }
  return `${prefix.trim().toUpperCase()}${buildRandomSuffix(seed)}`;
}

function buildUniqueExternalRequestId(prefix, seed, index) {
  const normalizedPrefix = String(prefix || 'UI-SEED')
    .trim()
    .replace(/\s+/g, '-')
    .toUpperCase();
  return `${normalizedPrefix}-${seed}-${String(index + 1).padStart(2, '0')}`;
}

function materializeLookupCase(input, index, seed) {
  const item = clone(input);
  if (!item.curp && item.curp_template_prefix) {
    item.curp = buildSyntheticCurp(item.curp_template_prefix, seed + index);
  }
  if (!item.curp) {
    throw new Error(`lookup_cases[${index}] no incluye curp ni curp_template_prefix.`);
  }
  return item;
}

function materializeArrivalCase(input, index, seed) {
  const item = clone(input);
  const beneficiario = item.beneficiario && typeof item.beneficiario === 'object'
    ? item.beneficiario
    : null;

  if (!beneficiario) {
    throw new Error(`arrival_cases[${index}] no incluye beneficiario.`);
  }

  if (!beneficiario.curp && beneficiario.curp_template_prefix) {
    beneficiario.curp = buildSyntheticCurp(beneficiario.curp_template_prefix, seed + index);
    delete beneficiario.curp_template_prefix;
  }

  if (!beneficiario.curp) {
    throw new Error(`arrival_cases[${index}] no incluye curp ni curp_template_prefix.`);
  }

  if (!item.external_request_id) {
    item.external_request_id = buildUniqueExternalRequestId(
      item.external_request_id_prefix || 'UI-SEED',
      seed,
      index
    );
  }

  delete item.external_request_id_prefix;
  return item;
}

function signToken(scope, config) {
  const privateKey = fs.readFileSync(config.privateKeyPath, 'utf8');
  return jwt.sign(
    {
      iss: config.clientCode,
      sub: config.clientCode,
      aud: config.audience,
      jti: crypto.randomUUID(),
      scope
    },
    privateKey,
    {
      algorithm: 'RS256',
      expiresIn: config.expiresIn,
      header: { kid: config.kid }
    }
  );
}

async function issueMockToken(scope, config) {
  const response = await requestJson({
    method: 'POST',
    url: `${config.mockBaseUrl}/integration/issue-token`,
    body: {
      client_code: config.clientCode,
      scopes: [scope]
    }
  });

  if (response.status !== 200 || !response.body?.token) {
    throw new Error(
      `No se pudo emitir token mock para scope ${scope}. HTTP ${response.status}.`
    );
  }

  return response.body.token;
}

async function buildIntegrationToken(scope, config) {
  if (scope === 'cardholders.lookup' && config.lookupToken) {
    return config.lookupToken;
  }
  if (scope === 'beneficiarios.staging.create' && config.stagingToken) {
    return config.stagingToken;
  }
  if (config.privateKeyPath) {
    return signToken(scope, config);
  }
  if (config.integrationToken) {
    return config.integrationToken;
  }
  if (config.mockBaseUrl) {
    return issueMockToken(scope, config);
  }

  throw new Error(
    'Configura UI_PRIVATE_KEY_PATH, MOCK_BASE_URL, UI_LOOKUP_TOKEN/UI_STAGING_TOKEN o UI_INTEGRATION_TOKEN.'
  );
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

module.exports = {
  getConfig,
  loadFixture,
  requestJson,
  materializeLookupCase,
  materializeArrivalCase,
  buildIntegrationToken,
  printJson
};
