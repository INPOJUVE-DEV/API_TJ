require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { buildCurpLookup } = require('../src/services/curpHashService');

function loadEnvData() {
  const filePath = process.env.POSTMAN_LOCAL_ENV_FILE ||
    path.join(__dirname, 'fixtures', 'postman-local-env.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadKeyData() {
  const filePath = process.env.POSTMAN_LOCAL_KEYS_FILE ||
    path.join(__dirname, 'fixtures', 'postman-local-keys.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function requestJson({ method, url, token, body }) {
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (error) {
    json = text;
  }
  return { status: response.status, body: json };
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function buildSyntheticCurp(prefix) {
  const seed = Date.now();
  const alnum = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'[seed % 36];
  const digit = String(seed % 10);
  return `${prefix}${alnum}${digit}`;
}

async function issueAuth0Token(mockBaseUrl) {
  const seed = Date.now();
  const issuerBaseForApi = process.env.AUTH0_TOKEN_ISSUER_BASE || 'http://host.docker.internal:9091/auth0';
  const response = await fetch(`${mockBaseUrl}/auth0/issue-id-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sub: `auth0|postman-local-${seed}`,
      email: `postman.local.${seed}@example.com`,
      aud: 'postman-local-client',
      issuer_base: issuerBaseForApi
    })
  });
  if (!response.ok) {
    throw new Error(`No se pudo emitir token Auth0 mock (${response.status}).`);
  }
  const data = await response.json();
  return data.token;
}

async function main() {
  const env = loadEnvData();
  const keys = loadKeyData();
  const curpLookup = buildCurpLookup(env.curp_ok);
  const auth0TokenOk = await issueAuth0Token(env.mock_base_url || 'http://127.0.0.1:9091');
  const makeIntegrationToken = (clientCode, scopes) => {
    const keyData = keys[clientCode];
    return jwt.sign(
      {
        iss: keyData.client_code,
        sub: keyData.client_code,
        aud: keys.audience,
        jti: crypto.randomUUID(),
        scope: scopes.join(' ')
      },
      keyData.private_key,
      {
        algorithm: 'RS256',
        expiresIn: '15m',
        header: { kid: keyData.kid }
      }
    );
  };
  const syncPayload = {
    sync_id: env.sync_id,
    items: [
      {
        curp_hash: curpLookup.curpHash,
        curp_masked: curpLookup.curpMasked,
        tarjeta_numero: env.tarjeta_numero_ok,
        status: 'active'
      }
    ]
  };
  const activationCurp = buildSyntheticCurp('MELR000202MBCSRD');
  const activationLookup = buildCurpLookup(activationCurp);
  const activationCard = `TJ-ACT-${Date.now()}`;

  const syncValid = await requestJson({
    method: 'POST',
    url: `${env.base_url}/api/v1/cardholders/sync`,
    token: makeIntegrationToken('sys_ipj', ['cardholders.sync']),
    body: syncPayload
  });
  assertCondition([200, 201].includes(syncValid.status), 'Sync valido no paso.');
  assertCondition(syncValid.body.processed === 1, 'Sync valido no proceso un item.');

  const syncInvalidToken = await requestJson({
    method: 'POST',
    url: `${env.base_url}/api/v1/cardholders/sync`,
    token: 'bad.token',
    body: syncPayload
  });
  assertCondition(syncInvalidToken.status === 401, 'Sync con token invalido no devolvio 401.');

  const syncWrongScope = await requestJson({
    method: 'POST',
    url: `${env.base_url}/api/v1/cardholders/sync`,
    token: makeIntegrationToken('unidad_informatica', ['cardholders.lookup']),
    body: syncPayload
  });
  assertCondition(syncWrongScope.status === 403, 'Sync con scope incorrecto no devolvio 403.');

  const syncDuplicate = await requestJson({
    method: 'POST',
    url: `${env.base_url}/api/v1/cardholders/sync`,
    token: makeIntegrationToken('sys_ipj', ['cardholders.sync']),
    body: syncPayload
  });
  assertCondition([200, 201].includes(syncDuplicate.status), 'Sync duplicado fallo.');
  assertCondition(
    Number(syncDuplicate.body.updated || 0) + Number(syncDuplicate.body.skipped || 0) >= 1,
    'Sync duplicado no fue idempotente.'
  );

  const syncCardChange = await requestJson({
    method: 'POST',
    url: `${env.base_url}/api/v1/cardholders/sync`,
    token: makeIntegrationToken('sys_ipj', ['cardholders.sync']),
    body: {
      sync_id: `${env.sync_id}-card-change`,
      items: [
        {
          ...syncPayload.items[0],
          tarjeta_numero: `${env.tarjeta_numero_ok}-ALT`
        }
      ]
    }
  });
  assertCondition([200, 201].includes(syncCardChange.status), 'Sync con cambio de tarjeta fallo.');

  const activationSync = await requestJson({
    method: 'POST',
    url: `${env.base_url}/api/v1/cardholders/sync`,
    token: makeIntegrationToken('sys_ipj', ['cardholders.sync']),
    body: {
      sync_id: `${env.sync_id}-activation`,
      items: [
        {
          curp_hash: activationLookup.curpHash,
          curp_masked: activationLookup.curpMasked,
          tarjeta_numero: activationCard,
          status: 'active'
        }
      ]
    }
  });
  assertCondition([200, 201].includes(activationSync.status), 'Sync para activacion no paso.');

  const lookupExisting = await requestJson({
    method: 'POST',
    url: `${env.base_url}/api/v1/cardholders/lookup`,
    token: makeIntegrationToken('unidad_informatica', ['cardholders.lookup']),
    body: { curp: env.curp_ok }
  });
  assertCondition(lookupExisting.status === 200, 'Lookup existente no devolvio 200.');
  assertCondition(lookupExisting.body.registered === true, 'Lookup existente no marco registered.');
  assertCondition(Boolean(lookupExisting.body.folio_tarjeta), 'Lookup existente no regreso folio.');
  assertCondition(!('curp' in lookupExisting.body), 'Lookup existente filtro CURP.');

  const lookupMissing = await requestJson({
    method: 'POST',
    url: `${env.base_url}/api/v1/cardholders/lookup`,
    token: makeIntegrationToken('unidad_informatica', ['cardholders.lookup']),
    body: { curp: env.curp_bad }
  });
  assertCondition(lookupMissing.status === 404, 'Lookup inexistente no devolvio 404.');

  const lookupInvalid = await requestJson({
    method: 'POST',
    url: `${env.base_url}/api/v1/cardholders/lookup`,
    token: makeIntegrationToken('unidad_informatica', ['cardholders.lookup']),
    body: { curp: '123' }
  });
  assertCondition(lookupInvalid.status === 422, 'Lookup con formato invalido no devolvio 422.');

  const lookupWrongScope = await requestJson({
    method: 'POST',
    url: `${env.base_url}/api/v1/cardholders/lookup`,
    token: makeIntegrationToken('sys_ipj', ['cardholders.sync']),
    body: { curp: env.curp_ok }
  });
  assertCondition(lookupWrongScope.status === 403, 'Lookup con token Sys_IPJ no devolvio 403.');

  const stagingBody = {
    external_request_id: `INF-${Date.now()}`,
    beneficiario: {
      curp: buildSyntheticCurp('MELR000202MBCSRD'),
      nombre: 'MELISSA',
      apellido_paterno: 'RIOS',
      apellido_materno: 'DELGADO',
      fecha_nacimiento: '2000-02-02',
      sexo: 'M',
      discapacidad: false,
      id_ine: 'INE0001',
      telefono: '6641234567',
      domicilio: {
        calle: 'CALLE 1',
        numero_ext: '10',
        numero_int: '2',
        colonia: 'CENTRO',
        municipio_id: 1,
        codigo_postal: '22000',
        seccional: '0001'
      }
    }
  };

  const stagingValid = await requestJson({
    method: 'POST',
    url: `${env.base_url}/api/v1/beneficiarios-staging`,
    token: makeIntegrationToken('unidad_informatica', ['beneficiarios.staging.create']),
    body: stagingBody
  });
  assertCondition(stagingValid.status === 202, 'Create staging valido no devolvio 202.');
  assertCondition(stagingValid.body.created === true, 'Create staging valido no marco created.');
  const stagingId = stagingValid.body.staging_id;

  const stagingDuplicate = await requestJson({
    method: 'POST',
    url: `${env.base_url}/api/v1/beneficiarios-staging`,
    token: makeIntegrationToken('unidad_informatica', ['beneficiarios.staging.create']),
    body: stagingBody
  });
  assertCondition(stagingDuplicate.status === 409, 'Staging duplicado no devolvio 409.');

  const stagingSyncedCurp = await requestJson({
    method: 'POST',
    url: `${env.base_url}/api/v1/beneficiarios-staging`,
    token: makeIntegrationToken('unidad_informatica', ['beneficiarios.staging.create']),
    body: {
      ...stagingBody,
      external_request_id: `${stagingBody.external_request_id}-sync-curp`,
      beneficiario: {
        ...stagingBody.beneficiario,
        curp: env.curp_ok
      }
    }
  });
  assertCondition(stagingSyncedCurp.status === 409, 'Staging para CURP sincronizada no devolvio 409.');

  const stagingMissingAddress = await requestJson({
    method: 'POST',
    url: `${env.base_url}/api/v1/beneficiarios-staging`,
    token: makeIntegrationToken('unidad_informatica', ['beneficiarios.staging.create']),
    body: {
      ...stagingBody,
      external_request_id: `${stagingBody.external_request_id}-missing-address`,
      beneficiario: {
        ...stagingBody.beneficiario,
        curp: buildSyntheticCurp('MELR000202MBCSRD'),
        domicilio: {
          ...stagingBody.beneficiario.domicilio,
          codigo_postal: ''
        }
      }
    }
  });
  assertCondition(stagingMissingAddress.status === 422, 'Staging con faltantes no devolvio 422.');

  const stagingInvalidToken = await requestJson({
    method: 'POST',
    url: `${env.base_url}/api/v1/beneficiarios-staging`,
    token: 'bad.token',
    body: stagingBody
  });
  assertCondition(stagingInvalidToken.status === 401, 'Staging con token invalido no devolvio 401.');

  const listAdmin = await requestJson({
    method: 'GET',
    url: `${env.base_url}/api/v1/beneficiarios-staging?status=pending`,
    token: env.admin_token
  });
  assertCondition(listAdmin.status === 200, 'Listado admin no devolvio 200.');
  assertCondition(Array.isArray(listAdmin.body.items), 'Listado admin no devolvio items.');
  assertCondition(!JSON.stringify(listAdmin.body).includes(stagingBody.beneficiario.curp), 'Listado admin filtro CURP en claro.');
  assertCondition(!JSON.stringify(listAdmin.body).includes('payload_ciphertext'), 'Listado admin expuso payload.');

  const listWithIntegration = await requestJson({
    method: 'GET',
    url: `${env.base_url}/api/v1/beneficiarios-staging?status=pending`,
    token: makeIntegrationToken('unidad_informatica', ['beneficiarios.staging.create'])
  });
  assertCondition(listWithIntegration.status === 403, 'Listado con token de integracion no devolvio 403.');

  const pushValid = await requestJson({
    method: 'POST',
    url: `${env.base_url}/api/v1/beneficiarios-staging/${stagingId}/push`,
    token: env.admin_token,
    body: {}
  });
  assertCondition(pushValid.status === 200, 'Push valido no devolvio 200.');
  assertCondition(pushValid.body.sent === true, 'Push valido no marco sent.');

  const pushDuplicate = await requestJson({
    method: 'POST',
    url: `${env.base_url}/api/v1/beneficiarios-staging/${stagingId}/push`,
    token: env.admin_token,
    body: {}
  });
  assertCondition(pushDuplicate.status === 409, 'Push duplicado no devolvio 409.');

  const pushMissing = await requestJson({
    method: 'POST',
    url: `${env.base_url}/api/v1/beneficiarios-staging/999999/push`,
    token: env.admin_token,
    body: {}
  });
  assertCondition(pushMissing.status === 404, 'Push inexistente no devolvio 404.');

  const verifyOk = await requestJson({
    method: 'POST',
    url: `${env.base_url}/api/v1/cardholders/verify-activation`,
    body: {
      tarjeta_numero: activationCard,
      curp: activationCurp
    }
  });
  assertCondition(verifyOk.status === 200, 'Verify activation correcto no devolvio 200.');
  assertCondition(verifyOk.body.can_activate === true, 'Verify activation correcto no marco can_activate.');

  const verifyWrongCard = await requestJson({
    method: 'POST',
    url: `${env.base_url}/api/v1/cardholders/verify-activation`,
    body: {
      tarjeta_numero: env.tarjeta_numero_bad,
      curp: activationCurp
    }
  });
  assertCondition([403, 422].includes(verifyWrongCard.status), 'Verify con tarjeta incorrecta no devolvio 403/422.');

  const verifyWrongCurp = await requestJson({
    method: 'POST',
    url: `${env.base_url}/api/v1/cardholders/verify-activation`,
    body: {
      tarjeta_numero: activationCard,
      curp: env.curp_bad
    }
  });
  assertCondition([403, 422].includes(verifyWrongCurp.status), 'Verify con CURP incorrecta no devolvio 403/422.');

  const verifyLinked = await requestJson({
    method: 'POST',
    url: `${env.base_url}/api/v1/cardholders/verify-activation`,
    body: {
      tarjeta_numero: 'TJ-0001',
      curp: 'HERL020101MSPNRZ01'
    }
  });
  assertCondition(verifyLinked.status === 409, 'Verify de usuario ya vinculado no devolvio 409.');

  const completeValid = await requestJson({
    method: 'POST',
    url: `${env.base_url}/api/v1/cardholders/complete-activation`,
    body: {
      tarjeta_numero: activationCard,
      auth0_id_token: auth0TokenOk
    }
  });
  assertCondition(completeValid.status === 200, 'Complete activation valido no devolvio 200.');
  assertCondition(completeValid.body.activated === true, 'Complete activation valido no marco activated.');

  const completeBadToken = await requestJson({
    method: 'POST',
    url: `${env.base_url}/api/v1/cardholders/complete-activation`,
    body: {
      tarjeta_numero: activationCard,
      auth0_id_token: env.auth0_id_token_bad
    }
  });
  assertCondition([401, 403].includes(completeBadToken.status), 'Complete activation con token invalido no devolvio 401/403.');

  const completeAlreadyLinked = await requestJson({
    method: 'POST',
    url: `${env.base_url}/api/v1/cardholders/complete-activation`,
    body: {
      tarjeta_numero: activationCard,
      auth0_id_token: auth0TokenOk
    }
  });
  assertCondition(completeAlreadyLinked.status === 409, 'Complete activation ya vinculado no devolvio 409.');

  console.log('Smoke Postman completado correctamente.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
