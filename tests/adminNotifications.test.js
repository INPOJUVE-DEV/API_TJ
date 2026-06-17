const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const request = require('supertest');

process.env.JWT_SECRET = 'test-secret';
process.env.ADMIN_JWT_SECRET = 'admin-test-secret';
process.env.CURP_HASH_SECRET = 'curp-test-secret';
process.env.FIELD_ENCRYPTION_KEY = 'field-test-secret';
process.env.INTEGRATION_JWT_AUDIENCE = 'api_tj';
process.env.INTEGRATION_RATE_MAX = '1000';

const keys = {
  sys_ipj: crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
};

const publicKeys = {
  sys_ipj: keys.sys_ipj.publicKey.export({ type: 'spki', format: 'pem' })
};

const privateKeys = {
  sys_ipj: keys.sys_ipj.privateKey.export({ type: 'pkcs8', format: 'pem' })
};

const state = {
  jtis: new Set(),
  cardholdersSync: new Map()
};

const clients = {
  sys_ipj: {
    id: 1,
    client_code: 'sys_ipj',
    status: 'active',
    allowed_scopes: JSON.stringify(['cardholders.sync']),
    ip_allowlist: JSON.stringify([]),
    key_id_current: 'sys-kid'
  }
};

const adminUser = {
  id: 91,
  nombre: 'Admin',
  apellidos: 'Local',
  email: 'admin@example.com',
  role: 'admin',
  status: 'active',
  session_version: 0
};

function makeIntegrationToken(jti) {
  return jwt.sign(
    {
      iss: 'sys_ipj',
      sub: 'sys_ipj',
      aud: 'api_tj',
      jti,
      scope: 'cardholders.sync'
    },
    privateKeys.sys_ipj,
    { algorithm: 'RS256', expiresIn: '5m', header: { kid: 'sys-kid' } }
  );
}

function makeAdminToken() {
  return jwt.sign(
    {
      id: adminUser.id,
      sub: String(adminUser.id),
      role: adminUser.role,
      status: adminUser.status,
      token_type: 'admin',
      session_version: adminUser.session_version
    },
    process.env.ADMIN_JWT_SECRET,
    {
      expiresIn: '30m',
      issuer: 'api_tj:admin',
      audience: 'api_tj:admin'
    }
  );
}

function mockExecuteSql(sql, params = []) {
  if (sql.includes('FROM service_clients')) {
    return [[clients[params[0]]].filter(Boolean), []];
  }

  if (sql.includes('FROM service_client_keys')) {
    if (params[0] !== 1 || params[1] !== 'sys-kid') {
      return [[], []];
    }
    return [[{ kid: 'sys-kid', public_key: publicKeys.sys_ipj, status: 'active' }], []];
  }

  if (sql.includes('DELETE FROM integration_jti_log')) {
    return [{ affectedRows: 0 }, []];
  }

  if (sql.includes('INSERT INTO integration_jti_log')) {
    const key = `${params[0]}:${params[1]}`;
    if (state.jtis.has(key)) {
      const error = new Error('Duplicate jti');
      error.code = 'ER_DUP_ENTRY';
      throw error;
    }
    state.jtis.add(key);
    return [{ insertId: state.jtis.size }, []];
  }

  if (sql.includes('UPDATE service_clients SET last_used_at')) {
    return [{ affectedRows: 1 }, []];
  }

  if (sql.includes('INSERT INTO integration_audit_log')) {
    return [{ insertId: 1 }, []];
  }

  if (sql.includes('SELECT role, status, session_version FROM usuarios WHERE id = ? LIMIT 1')) {
    return [[adminUser], []];
  }

  if (
    sql.includes('SELECT id, nombre, apellidos, email, role, status, session_version') &&
    sql.includes('FROM usuarios')
  ) {
    return [[adminUser], []];
  }

  return [[], []];
}

function mockConnectionExecute(sql, params = []) {
  if (sql.includes('FROM cardholders_sync WHERE tarjeta_numero')) {
    const existing = [...state.cardholdersSync.values()].find(
      (item) => item.tarjeta_numero === params[0] && item.curp_hash !== params[1]
    );
    return [existing ? [{ id: existing.id, curp_hash: existing.curp_hash }] : [], []];
  }

  if (sql.includes('SELECT id, tarjeta_numero, status FROM cardholders_sync')) {
    const row = state.cardholdersSync.get(params[0]);
    return [row ? [{ id: row.id, tarjeta_numero: row.tarjeta_numero, status: row.status }] : [], []];
  }

  if (sql.includes('INSERT INTO cardholders_sync')) {
    const row = {
      id: state.cardholdersSync.size + 1,
      curp_hash: params[0],
      curp_masked: params[1],
      tarjeta_numero: params[2],
      status: params[3]
    };
    state.cardholdersSync.set(row.curp_hash, row);
    return [{ insertId: row.id, affectedRows: 1 }, []];
  }

  if (sql.includes('UPDATE cardholders_sync')) {
    return [{ affectedRows: 1 }, []];
  }

  if (sql.includes('INSERT INTO sync_audit_log')) {
    return [{ insertId: 1 }, []];
  }

  return mockExecuteSql(sql, params);
}

jest.mock('../src/config/db', () => {
  const execute = jest.fn((sql, params) => Promise.resolve(mockExecuteSql(sql, params)));
  const connection = {
    execute: jest.fn((sql, params) => Promise.resolve(mockConnectionExecute(sql, params))),
    beginTransaction: jest.fn().mockResolvedValue(),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
    release: jest.fn()
  };
  return {
    execute,
    getConnection: jest.fn().mockResolvedValue(connection),
    __connection: connection
  };
});

const app = require('../src/index');
const notifications = require('../src/services/adminNotificationsService');

describe('Admin notifications realtime bridge', () => {
  beforeEach(() => {
    state.jtis.clear();
    state.cardholdersSync.clear();
    notifications.__resetForTests();
    jest.clearAllMocks();
  });

  test('publica notificaciones admin cuando llega un sync desde Sys_IPJ', async () => {
    const adminToken = makeAdminToken();

    const initialRecent = await request(app)
      .get('/api/v1/admin/notifications/recent')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(initialRecent.statusCode).toBe(200);
    expect(initialRecent.body).toEqual({ items: [] });

    const syncResponse = await request(app)
      .post('/api/v1/cardholders/sync')
      .set('Authorization', `Bearer ${makeIntegrationToken('sync-notify-jti-1')}`)
      .send({
        sync_id: 'SYNC-NOTIFY-1',
        items: [
          {
            curp_hash: 'b258cf64a82639d20af53f7f6f1f1ee2e9f8f0ce7ff4f45f0816fef8f8aa5c0c',
            curp_masked: 'MORL**********02',
            tarjeta_numero: 'TJ-NOTIFY-0001',
            status: 'active',
            municipio_id: 1
          }
        ]
      });

    expect(syncResponse.statusCode).toBe(200);
    expect(syncResponse.body).toMatchObject({
      processed: 1,
      inserted: 1,
      updated: 0,
      skipped: 0,
      conflict: 0
    });

    const recentResponse = await request(app)
      .get('/api/v1/admin/notifications/recent?limit=5')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(recentResponse.statusCode).toBe(200);
    expect(recentResponse.body.items).toHaveLength(1);
    expect(recentResponse.body.items[0]).toMatchObject({
      type: 'cardholders_sync.received',
      title: 'Padron recibido desde Sys_IPJ',
      source: 'sys_ipj'
    });
    expect(recentResponse.body.items[0].payload).toMatchObject({
      sync_id: 'SYNC-NOTIFY-1',
      processed: 1,
      inserted: 1,
      updated: 0,
      skipped: 0,
      conflict: 0
    });
    expect(recentResponse.body.items[0].payload.itemsPreview).toEqual([
      expect.objectContaining({
        tarjeta_numero: 'TJ-NOTIFY-0001',
        curp_masked: 'MORL**********02',
        status: 'active'
      })
    ]);

    const streamTokenResponse = await request(app)
      .get('/api/v1/admin/notifications/stream-token')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(streamTokenResponse.statusCode).toBe(200);
    expect(streamTokenResponse.body.streamToken).toEqual(expect.any(String));
    expect(streamTokenResponse.body.streamUrl).toContain(
      '/api/v1/admin/notifications/stream?stream_token='
    );

    const demoResponse = await request(app).get('/api/v1/admin/notifications/demo');
    expect(demoResponse.statusCode).toBe(200);
    expect(demoResponse.text).toContain('Monitor de sincronizacion Sys_IPJ');
  });
});
