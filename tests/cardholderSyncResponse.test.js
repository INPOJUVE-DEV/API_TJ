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

const state = {
  jtis: new Set(),
  cardholdersSync: new Map()
};

function resetState() {
  state.jtis.clear();
  state.cardholdersSync.clear();
}

function makeIntegrationToken(jtiValue) {
  return jwt.sign(
    {
      iss: 'sys_ipj',
      sub: 'sys_ipj',
      aud: 'api_tj',
      jti: jtiValue,
      scope: 'cardholders.sync'
    },
    privateKeys.sys_ipj,
    { algorithm: 'RS256', expiresIn: '5m', header: { kid: 'sys-kid' } }
  );
}

function findCardholderByTarjeta(tarjetaNumero) {
  return [...state.cardholdersSync.values()].find((item) => item.tarjeta_numero === tarjetaNumero) || null;
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
    return [{ insertId: state.jtis.size, affectedRows: 1 }, []];
  }

  if (sql.includes('UPDATE service_clients SET last_used_at')) {
    return [{ affectedRows: 1 }, []];
  }

  if (sql.includes('INSERT INTO integration_audit_log')) {
    return [{ insertId: 1, affectedRows: 1 }, []];
  }

  return [[], []];
}

function mockConnectionExecute(sql, params = []) {
  if (sql.includes('FROM cardholders_sync WHERE tarjeta_numero')) {
    const existing = findCardholderByTarjeta(params[0]);
    const matchesConflict = existing && existing.curp_hash !== params[1];
    return [matchesConflict ? [{ id: existing.id, curp_hash: existing.curp_hash }] : [], []];
  }

  if (sql.includes('SELECT id, tarjeta_numero, status FROM cardholders_sync')) {
    const row = state.cardholdersSync.get(params[0]) || null;
    return [row ? [{ id: row.id, tarjeta_numero: row.tarjeta_numero, status: row.status }] : [], []];
  }

  if (sql.includes('INSERT INTO cardholders_sync')) {
    const row = {
      id: state.cardholdersSync.size + 1,
      curp_hash: params[0],
      curp_masked: params[1],
      tarjeta_numero: params[2],
      status: params[3],
      municipio_id: params[12] || null
    };
    state.cardholdersSync.set(row.curp_hash, row);
    return [{ insertId: row.id, affectedRows: 1 }, []];
  }

  if (sql.includes('UPDATE cardholders_sync')) {
    const row = state.cardholdersSync.get(params[12]) || null;
    if (row) {
      row.curp_masked = params[0];
      row.tarjeta_numero = params[1];
      row.status = params[2];
      row.municipio_id = params[11] ?? row.municipio_id;
    }
    return [{ affectedRows: row ? 1 : 0 }, []];
  }

  if (sql.includes('INSERT INTO sync_audit_log')) {
    return [{ insertId: 1, affectedRows: 1 }, []];
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

describe('cardholders sync response contract', () => {
  beforeEach(() => {
    resetState();
    jest.clearAllMocks();
  });

  test('reporta success cuando todos los items son aceptados', async () => {
    const response = await request(app)
      .post('/api/v1/cardholders/sync')
      .set('Authorization', `Bearer ${makeIntegrationToken('sync-success-1')}`)
      .send({
        sync_id: 'SYNC-OK-1',
        items: [
          {
            curp_hash: 'a'.repeat(64),
            curp_masked: 'AAAA**********01',
            tarjeta_numero: 'TJ-OK-0001',
            status: 'active',
            municipio_id: 1
          },
          {
            curp_hash: 'b'.repeat(64),
            curp_masked: 'BBBB**********02',
            tarjeta_numero: 'TJ-OK-0002',
            status: 'inactive',
            municipio_id: 2
          }
        ]
      });

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      accepted: 2,
      status: 'success',
      processed: 2,
      inserted: 2,
      updated: 0,
      skipped: 0,
      conflict: 0
    });
    expect(response.body.results).toEqual([
      { index: 0, status: 'accepted', action: 'inserted' },
      { index: 1, status: 'accepted', action: 'inserted' }
    ]);
  });

  test('reporta partial cuando hay items aceptados y skipped', async () => {
    const response = await request(app)
      .post('/api/v1/cardholders/sync')
      .set('Authorization', `Bearer ${makeIntegrationToken('sync-partial-1')}`)
      .send({
        sync_id: 'SYNC-PARTIAL-1',
        items: [
          {
            curp_hash: 'c'.repeat(64),
            curp_masked: 'CCCC**********03',
            tarjeta_numero: 'TJ-PARTIAL-0001',
            status: 'active',
            municipio_id: 1
          },
          {
            curp_hash: 'invalido',
            curp_masked: 'DDDD**********04',
            tarjeta_numero: 'TJ-PARTIAL-0002',
            status: 'active',
            municipio_id: 1
          }
        ]
      });

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      accepted: 1,
      status: 'partial',
      processed: 2,
      inserted: 1,
      updated: 0,
      skipped: 1,
      conflict: 0
    });
    expect(response.body.results).toEqual([
      { index: 0, status: 'accepted', action: 'inserted' },
      { index: 1, status: 'skipped', reason: 'invalid_item' }
    ]);
  });

  test('reporta conflict por tarjeta_numero ya asignado a otra CURP', async () => {
    state.cardholdersSync.set('e'.repeat(64), {
      id: 1,
      curp_hash: 'e'.repeat(64),
      curp_masked: 'EEEE**********05',
      tarjeta_numero: 'TJ-CONFLICT-0001',
      status: 'active'
    });

    const response = await request(app)
      .post('/api/v1/cardholders/sync')
      .set('Authorization', `Bearer ${makeIntegrationToken('sync-conflict-1')}`)
      .send({
        sync_id: 'SYNC-CONFLICT-1',
        items: [
          {
            curp_hash: 'f'.repeat(64),
            curp_masked: 'FFFF**********06',
            tarjeta_numero: 'TJ-CONFLICT-0001',
            status: 'active',
            municipio_id: 1
          }
        ]
      });

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      accepted: 0,
      status: 'failed',
      processed: 1,
      inserted: 0,
      updated: 0,
      skipped: 0,
      conflict: 1
    });
    expect(response.body.results).toEqual([
      { index: 0, status: 'conflict', reason: 'tarjeta_numero_already_assigned' }
    ]);
  });

  test('rechaza payload invalido cuando items no es arreglo', async () => {
    const response = await request(app)
      .post('/api/v1/cardholders/sync')
      .set('Authorization', `Bearer ${makeIntegrationToken('sync-invalid-1')}`)
      .send({
        sync_id: 'SYNC-INVALID-1',
        items: null
      });

    expect(response.statusCode).toBe(422);
    expect(response.body).toEqual({
      message: 'items debe ser un arreglo.'
    });
  });
});
