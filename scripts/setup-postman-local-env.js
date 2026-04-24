require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const { buildCurpLookup } = require('../src/services/curpHashService');

function getDbConfig() {
  if (process.env.DB_URI) {
    const url = new URL(process.env.DB_URI);
    return {
      host: url.hostname,
      port: url.port ? Number(url.port) : 3306,
      user: decodeURIComponent(url.username || ''),
      password: decodeURIComponent(url.password || ''),
      database: url.pathname.replace(/^\//, '')
    };
  }
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'tarjeta_joven'
  };
}

function generateIntegrationKey(clientCode) {
  const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    clientCode,
    kid: `${clientCode}-postman-local`,
    publicKey: pair.publicKey.export({ format: 'pem', type: 'spki' }),
    privateKey: pair.privateKey.export({ format: 'pem', type: 'pkcs8' })
  };
}

function signIntegrationToken({ privateKey, kid, clientCode, scopes, audience }) {
  return jwt.sign(
    {
      iss: clientCode,
      sub: clientCode,
      aud: audience,
      jti: crypto.randomUUID(),
      scope: scopes.join(' ')
    },
    privateKey,
    {
      algorithm: 'RS256',
      expiresIn: '15m',
      header: { kid }
    }
  );
}

async function fetchAuth0IdToken() {
  const auth0Base = process.env.MOCK_AUTH0_ISSUER || 'http://127.0.0.1:9091/auth0';
  const issuerBaseForApi =
    process.env.AUTH0_TOKEN_ISSUER_BASE || 'http://host.docker.internal:9091/auth0';
  const response = await fetch(`${auth0Base.replace(/\/$/, '')}/issue-id-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sub: 'auth0|postman-local-user',
      email: 'postman.local@example.com',
      aud: process.env.AUTH0_CLIENT_ID || 'postman-local-client',
      issuer_base: issuerBaseForApi
    })
  });

  if (!response.ok) {
    throw new Error(`No se pudo obtener token Auth0 mock: ${response.status}`);
  }

  const data = await response.json();
  return data.token;
}

async function upsertClient(pool, clientCode, scopes, keyMaterial) {
  await pool.execute(
    `INSERT INTO service_clients
      (client_code, name, status, allowed_scopes, ip_allowlist, key_id_current)
     VALUES (?, ?, 'active', ?, JSON_ARRAY(), ?)
     ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      status = 'active',
      allowed_scopes = VALUES(allowed_scopes),
      key_id_current = VALUES(key_id_current)`,
    [clientCode, clientCode, JSON.stringify(scopes), keyMaterial.kid]
  );

  const [rows] = await pool.execute(
    'SELECT id FROM service_clients WHERE client_code = ? LIMIT 1',
    [clientCode]
  );
  const clientId = rows[0]?.id;
  if (!clientId) {
    throw new Error(`No se pudo resolver service_client para ${clientCode}`);
  }

  await pool.execute(
    `INSERT INTO service_client_keys
      (client_id, kid, public_key, status, valid_from, valid_until)
     VALUES (?, ?, ?, 'active', ?, NULL)
     ON DUPLICATE KEY UPDATE
      public_key = VALUES(public_key),
      status = 'active',
      valid_from = VALUES(valid_from),
      valid_until = NULL`,
    [clientId, keyMaterial.kid, keyMaterial.publicKey, new Date()]
  );
}

async function getAdminUserId(pool) {
  const [rows] = await pool.execute(
    "SELECT id FROM usuarios WHERE role = 'admin' ORDER BY id ASC LIMIT 1"
  );
  if (!rows[0]?.id) {
    throw new Error('No existe usuario admin para generar admin_token.');
  }
  return rows[0].id;
}

async function main() {
  const audience = process.env.INTEGRATION_JWT_AUDIENCE || 'api_tj';
  const baseUrl = process.env.BASE_URL || `http://127.0.0.1:${process.env.PORT || 8080}`;
  const outputPath = path.join(__dirname, 'fixtures', 'postman-local-env.json');
  const keysPath = path.join(__dirname, 'fixtures', 'postman-local-keys.json');
  const pool = await mysql.createPool({
    ...getDbConfig(),
    waitForConnections: true,
    connectionLimit: 5
  });

  try {
    const sysIpjKey = generateIntegrationKey('sys_ipj');
    const informaticaKey = generateIntegrationKey('unidad_informatica');
    const { curpHash, curpMasked } = buildCurpLookup('MELR000202MSPSRD06');

    await upsertClient(pool, 'sys_ipj', ['cardholders.sync'], sysIpjKey);
    await upsertClient(
      pool,
      'unidad_informatica',
      ['cardholders.lookup', 'beneficiarios.staging.create'],
      informaticaKey
    );

    const adminUserId = await getAdminUserId(pool);
    const sysIpjToken = signIntegrationToken({
      privateKey: sysIpjKey.privateKey,
      kid: sysIpjKey.kid,
      clientCode: 'sys_ipj',
      scopes: ['cardholders.sync'],
      audience
    });
    const informaticaToken = signIntegrationToken({
      privateKey: informaticaKey.privateKey,
      kid: informaticaKey.kid,
      clientCode: 'unidad_informatica',
      scopes: ['cardholders.lookup', 'beneficiarios.staging.create'],
      audience
    });
    const adminToken = jwt.sign({ id: adminUserId }, process.env.JWT_SECRET, {
      expiresIn: '30m'
    });
    const auth0IdTokenOk = await fetchAuth0IdToken();

    const envData = {
      base_url: baseUrl,
      mock_base_url: process.env.MOCK_BASE_URL || 'http://127.0.0.1:9091',
      sys_ipj_token: sysIpjToken,
      informatica_token: informaticaToken,
      admin_token: adminToken,
      sync_id: `SYNC-${Date.now()}`,
      staging_id: '',
      staging_external_request_id: '',
      staging_external_request_id_missing: '',
      staging_curp_new: '',
      staging_curp_missing: '',
      integration_token: '',
      tarjeta_numero_ok: 'TJ-0080',
      tarjeta_numero_alt: 'TJ-0080-ALT',
      tarjeta_numero_bad: 'TJ-4040',
      curp_ok: 'MELR000202MSPSRD06',
      curp_bad: 'XEXX010101HNEXXXA8',
      curp_hash_ok: curpHash,
      curp_masked_ok: curpMasked,
      auth0_id_token_ok: auth0IdTokenOk,
      auth0_id_token_bad: 'bad.mock.token'
    };
    const keysData = {
      audience,
      sys_ipj: {
        client_code: 'sys_ipj',
        kid: sysIpjKey.kid,
        private_key: sysIpjKey.privateKey,
        scopes: ['cardholders.sync']
      },
      unidad_informatica: {
        client_code: 'unidad_informatica',
        kid: informaticaKey.kid,
        private_key: informaticaKey.privateKey,
        scopes: ['cardholders.lookup', 'beneficiarios.staging.create']
      }
    };

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(envData, null, 2));
    fs.writeFileSync(keysPath, JSON.stringify(keysData, null, 2));

    console.log(`Entorno Postman local generado en ${outputPath}`);
    console.log(`Llaves locales guardadas en ${keysPath}`);
    console.log(JSON.stringify(envData, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
