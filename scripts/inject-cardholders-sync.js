/* eslint-disable no-console */
require('dotenv').config();
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const { getDbConfig } = require('./seed');

const DEFAULT_FIXTURE = path.join(__dirname, 'fixtures', 'cardholders-sync.payload.json');
const DEFAULT_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';
const DEFAULT_CLIENT = 'sys_ipj';
const DEFAULT_KID = 'sys-ipj-local-fixture';

async function ensureServiceClientKey(pool, clientCode, kid, publicKeyPem) {
  const [rows] = await pool.execute(
    'SELECT id FROM service_clients WHERE client_code = ? LIMIT 1',
    [clientCode]
  );
  if (rows.length === 0) {
    throw new Error(`No existe service_client para ${clientCode}. Ejecuta primero npm run seed.`);
  }

  const clientId = rows[0].id;
  await pool.execute(
    `UPDATE service_clients
     SET status = 'active', key_id_current = ?
     WHERE id = ?`,
    [kid, clientId]
  );
  await pool.execute(
    `INSERT INTO service_client_keys (client_id, kid, public_key, status, valid_from)
     VALUES (?, ?, ?, 'active', ?)
     ON DUPLICATE KEY UPDATE
      public_key = VALUES(public_key),
      status = 'active',
      valid_from = VALUES(valid_from),
      valid_until = NULL`,
    [clientId, kid, publicKeyPem, new Date()]
  );
}

function buildToken({ clientCode, kid, privateKeyPem }) {
  return jwt.sign(
    {
      iss: clientCode,
      sub: clientCode,
      aud: process.env.INTEGRATION_JWT_AUDIENCE || 'api_tj',
      jti: `inject-${Date.now()}`,
      scope: 'cardholders.sync'
    },
    privateKeyPem,
    {
      algorithm: 'RS256',
      expiresIn: '5m',
      header: { kid }
    }
  );
}

async function main() {
  const fixturePath = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : DEFAULT_FIXTURE;
  const baseUrl = process.argv[3] || DEFAULT_BASE_URL;

  const raw = await fs.readFile(fixturePath, 'utf8');
  const payload = JSON.parse(raw);

  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048
  });
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });

  const pool = mysql.createPool(getDbConfig());
  try {
    await ensureServiceClientKey(pool, DEFAULT_CLIENT, DEFAULT_KID, publicKeyPem);
  } finally {
    await pool.end();
  }

  const token = buildToken({
    clientCode: DEFAULT_CLIENT,
    kid: DEFAULT_KID,
    privateKeyPem
  });

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/v1/cardholders/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (error) {
    body = text;
  }

  console.log(
    JSON.stringify(
      {
        request_fixture: fixturePath,
        base_url: baseUrl,
        status: response.status,
        body
      },
      null,
      2
    )
  );

  if (!response.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Error al inyectar fixture de cardholders_sync:', error);
  process.exitCode = 1;
});
