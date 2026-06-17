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
  unidad_informatica: crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
};

const publicKeys = {
  unidad_informatica: keys.unidad_informatica.publicKey.export({ type: 'spki', format: 'pem' })
};

const privateKeys = {
  unidad_informatica: keys.unidad_informatica.privateKey.export({ type: 'pkcs8', format: 'pem' })
};

const client = {
  id: 2,
  client_code: 'unidad_informatica',
  status: 'active',
  allowed_scopes: JSON.stringify(['cardholders.lookup', 'beneficiarios.staging.create']),
  ip_allowlist: JSON.stringify([]),
  key_id_current: 'ui-kid'
};

const state = {
  jtis: new Set()
};

function makeToken({ scope = 'cardholders.lookup', jti = 'edge-jti-1', kid = 'ui-kid', aud = 'api_tj' } = {}) {
  return jwt.sign(
    {
      iss: 'unidad_informatica',
      sub: 'unidad_informatica',
      aud,
      jti,
      scope
    },
    privateKeys.unidad_informatica,
    { algorithm: 'RS256', expiresIn: '5m', header: { kid } }
  );
}

function mockExecuteSql(sql, params = []) {
  if (sql.includes('FROM service_clients')) {
    return [[client], []];
  }

  if (sql.includes('FROM service_client_keys')) {
    if (params[0] !== 2 || params[1] !== 'ui-kid') {
      return [[], []];
    }
    return [[{ kid: 'ui-kid', public_key: publicKeys.unidad_informatica, status: 'active' }], []];
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

  if (sql.includes('SELECT tarjeta_numero') && sql.includes('FROM cardholders_sync')) {
    return [[], []];
  }

  return [[], []];
}

jest.mock('../src/config/db', () => ({
  execute: jest.fn((sql, params) => Promise.resolve(mockExecuteSql(sql, params))),
  getConnection: jest.fn()
}));

const app = require('../src/index');

describe('integration JWT edge cases', () => {
  beforeEach(() => {
    state.jtis.clear();
    jest.clearAllMocks();
  });

  test('rechaza token malformado con 401', async () => {
    const response = await request(app)
      .post('/api/v1/cardholders/lookup')
      .set('Authorization', 'Bearer not-a-jwt')
      .send({ curp: 'MELR000202MSPSRD06' });

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ message: 'Token de integracion invalido.' });
  });

  test('rechaza kid no registrado con 401', async () => {
    const response = await request(app)
      .post('/api/v1/cardholders/lookup')
      .set('Authorization', `Bearer ${makeToken({ kid: 'unknown-kid', jti: 'edge-kid-1' })}`)
      .send({ curp: 'MELR000202MSPSRD06' });

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ message: 'Token de integracion invalido.' });
  });

  test('rechaza audiencia incorrecta con 401', async () => {
    const response = await request(app)
      .post('/api/v1/cardholders/lookup')
      .set('Authorization', `Bearer ${makeToken({ aud: 'otra_api', jti: 'edge-aud-1' })}`)
      .send({ curp: 'MELR000202MSPSRD06' });

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ message: 'Token de integracion invalido.' });
  });

  test('rechaza scope faltante con 403', async () => {
    const response = await request(app)
      .post('/api/v1/cardholders/lookup')
      .set(
        'Authorization',
        `Bearer ${makeToken({
          scope: 'beneficiarios.staging.create',
          jti: 'edge-scope-missing-1'
        })}`
      )
      .send({ curp: 'MELR000202MSPSRD06' });

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ message: 'Permisos insuficientes.' });
  });

  test('rechaza scope no permitido con 403', async () => {
    const response = await request(app)
      .post('/api/v1/cardholders/lookup')
      .set(
        'Authorization',
        `Bearer ${makeToken({ scope: 'admin.super', jti: 'edge-scope-forbidden-1' })}`
      )
      .send({ curp: 'MELR000202MSPSRD06' });

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ message: 'Permisos insuficientes.' });
  });
});
