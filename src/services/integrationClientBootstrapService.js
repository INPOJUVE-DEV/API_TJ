const db = require('../config/db');
const safeLogger = require('../utils/safeLogger');

function normalizePem(value) {
  return String(value || '')
    .trim()
    .replace(/\\n/g, '\n');
}

function parseList(value, fallback = []) {
  if (value === undefined || value === null || value === '') {
    return [...fallback];
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  const raw = String(value).trim();
  if (!raw) {
    return [...fallback];
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch (error) {
    // Fallback to delimited strings below.
  }

  return raw
    .split(/[,\n\r\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildClientConfigs(env = process.env) {
  const clients = [
    {
      clientCode: 'sys_ipj',
      name: 'Sys_IPJ',
      publicKey: normalizePem(env.SYS_IPJ_JWT_PUBLIC_KEY),
      kid: String(env.SYS_IPJ_JWT_KID || 'sys_ipj-current').trim(),
      scopes: parseList(env.SYS_IPJ_ALLOWED_SCOPES, ['cardholders.sync']),
      ipAllowlist: parseList(env.SYS_IPJ_IP_ALLOWLIST, [])
    },
    {
      clientCode: 'unidad_informatica',
      name: 'Unidad de Informatica',
      publicKey: normalizePem(env.INFORMATICA_JWT_PUBLIC_KEY),
      kid: String(env.INFORMATICA_JWT_KID || 'unidad_informatica-current').trim(),
      scopes: parseList(env.INFORMATICA_ALLOWED_SCOPES, [
        'cardholders.lookup',
        'beneficiarios.staging.create'
      ]),
      ipAllowlist: parseList(env.INFORMATICA_IP_ALLOWLIST, [])
    }
  ];

  return clients.filter((client) => client.publicKey);
}

async function upsertIntegrationClient(clientConfig, executor = db) {
  await executor.execute(
    `INSERT INTO service_clients
      (client_code, name, status, allowed_scopes, ip_allowlist, key_id_current)
     VALUES (?, ?, 'active', ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      status = 'active',
      allowed_scopes = VALUES(allowed_scopes),
      ip_allowlist = VALUES(ip_allowlist),
      key_id_current = VALUES(key_id_current)`,
    [
      clientConfig.clientCode,
      clientConfig.name,
      JSON.stringify(clientConfig.scopes),
      JSON.stringify(clientConfig.ipAllowlist),
      clientConfig.kid
    ]
  );

  const [rows] = await executor.execute(
    'SELECT id FROM service_clients WHERE client_code = ? LIMIT 1',
    [clientConfig.clientCode]
  );
  const clientId = rows[0]?.id;
  if (!clientId) {
    throw new Error(`No se pudo resolver service_client para ${clientConfig.clientCode}.`);
  }

  await executor.execute(
    `INSERT INTO service_client_keys
      (client_id, kid, public_key, status, valid_from, valid_until)
     VALUES (?, ?, ?, 'active', ?, NULL)
     ON DUPLICATE KEY UPDATE
      public_key = VALUES(public_key),
      status = 'active',
      valid_from = VALUES(valid_from),
      valid_until = NULL`,
    [clientId, clientConfig.kid, clientConfig.publicKey, new Date()]
  );
}

async function bootstrapIntegrationClients(env = process.env, executor = db) {
  const clients = buildClientConfigs(env);
  if (clients.length === 0) {
    safeLogger.info('Bootstrap de integracion omitido: no hay llaves publicas configuradas.');
    return { configured: 0 };
  }

  for (const client of clients) {
    await upsertIntegrationClient(client, executor);
    safeLogger.info(`Cliente de integracion listo: ${client.clientCode} (${client.kid})`);
  }

  return { configured: clients.length };
}

module.exports = {
  bootstrapIntegrationClients,
  buildClientConfigs,
  normalizePem,
  parseList,
  upsertIntegrationClient
};
