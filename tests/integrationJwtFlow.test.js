const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const request = require('supertest');

process.env.JWT_SECRET = 'test-secret';
process.env.CURP_HASH_SECRET = 'curp-test-secret';
process.env.FIELD_ENCRYPTION_KEY = 'field-test-secret';
process.env.INTEGRATION_JWT_AUDIENCE = 'api_tj';
process.env.INTEGRATION_RATE_MAX = '1000';

const keys = {
  sys_ipj: crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }),
  unidad_informatica: crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
};

const publicKeys = {
  sys_ipj: keys.sys_ipj.publicKey.export({ type: 'spki', format: 'pem' }),
  unidad_informatica: keys.unidad_informatica.publicKey.export({ type: 'spki', format: 'pem' })
};

const privateKeys = {
  sys_ipj: keys.sys_ipj.privateKey.export({ type: 'pkcs8', format: 'pem' }),
  unidad_informatica: keys.unidad_informatica.privateKey.export({ type: 'pkcs8', format: 'pem' })
};

const state = {
  jtis: new Set(),
  cardholdersSync: new Map(),
  staging: new Map(),
  nextStagingId: 1
};

const clients = {
  sys_ipj: {
    id: 1,
    client_code: 'sys_ipj',
    status: 'active',
    allowed_scopes: JSON.stringify(['cardholders.sync']),
    ip_allowlist: JSON.stringify([]),
    key_id_current: 'sys-kid'
  },
  unidad_informatica: {
    id: 2,
    client_code: 'unidad_informatica',
    status: 'active',
    allowed_scopes: JSON.stringify(['cardholders.lookup', 'beneficiarios.staging.create']),
    ip_allowlist: JSON.stringify([]),
    key_id_current: 'ui-kid'
  }
};

function makeToken(clientCode, scope, jti) {
  const kid = clientCode === 'sys_ipj' ? 'sys-kid' : 'ui-kid';
  return jwt.sign(
    {
      iss: clientCode,
      sub: clientCode,
      aud: 'api_tj',
      jti,
      scope
    },
    privateKeys[clientCode],
    { algorithm: 'RS256', expiresIn: '5m', header: { kid } }
  );
}

function mockExecuteSql(sql, params = []) {
  if (sql.includes('FROM service_clients')) {
    return [[clients[params[0]]].filter(Boolean), []];
  }

  if (sql.includes('FROM service_client_keys')) {
    const client = Object.values(clients).find((item) => item.id === params[0]);
    const expectedKid = client?.client_code === 'sys_ipj' ? 'sys-kid' : 'ui-kid';
    if (!client || params[1] !== expectedKid) {
      return [[], []];
    }
    return [
      [
        {
          kid: expectedKid,
          public_key: publicKeys[client.client_code],
          status: 'active',
          valid_from: null,
          valid_until: null
        }
      ],
      []
    ];
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

  if (sql.includes('SELECT tarjeta_numero') && sql.includes('FROM cardholders_sync')) {
    const row = state.cardholdersSync.get(params[0]);
    return [row ? [{ tarjeta_numero: row.tarjeta_numero }] : [], []];
  }

  if (sql.includes('SELECT id FROM cardholders_sync WHERE curp_hash')) {
    const row = state.cardholdersSync.get(params[0]);
    return [row ? [{ id: row.id }] : [], []];
  }

  if (sql.includes('SELECT id, status') && sql.includes('FROM beneficiario_staging')) {
    const existing = [...state.staging.values()].find(
      (item) => item.external_request_id === params[0] || item.curp_hash === params[1]
    );
    return [existing ? [{ id: existing.id, status: existing.status }] : [], []];
  }

  if (sql.includes('INSERT INTO beneficiario_staging')) {
    const id = state.nextStagingId++;
    state.staging.set(id, {
      id,
      external_request_id: params[0],
      curp_hash: params[1],
      curp_masked: params[2],
      status: 'pending',
      payload_ciphertext: params[3]
    });
    return [{ insertId: id, affectedRows: 1 }, []];
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
    const row = [...state.cardholdersSync.values()].find((item) => item.id === params[5]);
    if (row) {
      row.curp_masked = params[0];
      row.tarjeta_numero = params[1];
      row.status = params[2];
    }
    return [{ affectedRows: row ? 1 : 0 }, []];
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
const db = require('../src/config/db');
const { buildCurpLookup } = require('../src/services/curpHashService');

describe('Flujo completo de integracion con JWT RS256', () => {
  beforeEach(() => {
    state.jtis.clear();
    state.cardholdersSync.clear();
    state.staging.clear();
    state.nextStagingId = 1;
    jest.clearAllMocks();
  });

  test('sync -> lookup -> staging con tokens firmados y scopes correctos', async () => {
    const curp = 'MELR000202MSPSRD06';
    const lookupData = buildCurpLookup(curp);
    const syncToken = makeToken('sys_ipj', 'cardholders.sync', 'sync-jti-1');

    const syncResponse = await request(app)
      .post('/api/v1/cardholders/sync')
      .set('Authorization', `Bearer ${syncToken}`)
      .send({
        sync_id: 'SYNC-JWT-1',
        items: [
          {
            curp_hash: lookupData.curpHash,
            curp_masked: lookupData.curpMasked,
            tarjeta_numero: 'TJ-0080',
            status: 'active'
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

    const lookupToken = makeToken('unidad_informatica', 'cardholders.lookup', 'lookup-jti-1');
    const lookupResponse = await request(app)
      .post('/api/v1/cardholders/lookup')
      .set('Authorization', `Bearer ${lookupToken}`)
      .send({ curp });

    expect(lookupResponse.statusCode).toBe(200);
    expect(lookupResponse.body).toEqual({
      registered: true,
      message: 'El usuario ya se encuentra registrado con la tarjeta TJ-0080',
      folio_tarjeta: 'TJ-0080'
    });
    expect(lookupResponse.body).not.toHaveProperty('curp');
    expect(lookupResponse.body).not.toHaveProperty('curp_masked');
    expect(lookupResponse.body).not.toHaveProperty('nombres');

    const stagingToken = makeToken(
      'unidad_informatica',
      'beneficiarios.staging.create',
      'staging-jti-1'
    );
    const stagingResponse = await request(app)
      .post('/api/v1/beneficiarios-staging')
      .set('Authorization', `Bearer ${stagingToken}`)
      .send({
        external_request_id: 'UI-JWT-1',
        beneficiario: {
          nombre: 'Julieta',
          apellido_paterno: 'Morales',
          apellido_materno: 'Cano',
          curp: 'MOCJ050521MSPNRL01',
          fecha_nacimiento: '2005-05-21',
          sexo: 'M',
          discapacidad: false,
          id_ine: 'INE-LOCAL-001',
          telefono: '4441234567',
          domicilio: {
            calle: 'Av. Revolucion',
            numero_ext: '321B',
            numero_int: '2',
            colonia: 'Zona Centro',
            municipio_id: 1,
            codigo_postal: '22000',
            seccional: '0001'
          }
        }
      });

    expect(stagingResponse.statusCode).toBe(202);
    expect(stagingResponse.body).toMatchObject({
      created: true,
      status: 'pending',
      staging_id: 1
    });
    expect([...state.staging.values()][0].payload_ciphertext).not.toContain('MOCJ050521MSPNRL01');

    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO integration_jti_log'),
      expect.arrayContaining([1, 'sync-jti-1'])
    );
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO integration_jti_log'),
      expect.arrayContaining([2, 'lookup-jti-1'])
    );
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO integration_audit_log'),
      expect.any(Array)
    );
  });

  test('unidad_informatica no puede invocar sync por scope', async () => {
    const badToken = makeToken('unidad_informatica', 'cardholders.lookup', 'bad-scope-jti-1');
    const response = await request(app)
      .post('/api/v1/cardholders/sync')
      .set('Authorization', `Bearer ${badToken}`)
      .send({ sync_id: 'BAD', items: [] });

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ message: 'Permisos insuficientes.' });
  });

  test('rechaza replay de jti', async () => {
    const token = makeToken('unidad_informatica', 'cardholders.lookup', 'replay-jti-1');

    const first = await request(app)
      .post('/api/v1/cardholders/lookup')
      .set('Authorization', `Bearer ${token}`)
      .send({ curp: 'MELR000202MSPSRD06' });
    const second = await request(app)
      .post('/api/v1/cardholders/lookup')
      .set('Authorization', `Bearer ${token}`)
      .send({ curp: 'MELR000202MSPSRD06' });

    expect(first.statusCode).toBe(404);
    expect(second.statusCode).toBe(401);
  });

  test('token de integracion no puede usar endpoints internos de admin', async () => {
    const token = makeToken(
      'unidad_informatica',
      'beneficiarios.staging.create',
      'admin-route-jti-1'
    );

    const response = await request(app)
      .get('/api/v1/beneficiarios-staging?status=pending')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ message: 'Acceso admin denegado' });
  });

  test('staging rechaza payload sin discapacidad obligatoria', async () => {
    const stagingToken = makeToken(
      'unidad_informatica',
      'beneficiarios.staging.create',
      'staging-jti-missing-discapacidad'
    );

    const response = await request(app)
      .post('/api/v1/beneficiarios-staging')
      .set('Authorization', `Bearer ${stagingToken}`)
      .send({
        external_request_id: 'UI-JWT-MISSING-DISCAPACIDAD',
        beneficiario: {
          nombre: 'Julieta',
          apellido_paterno: 'Morales',
          apellido_materno: 'Cano',
          curp: 'MOCJ050521MSPNRL01',
          fecha_nacimiento: '2005-05-21',
          sexo: 'M',
          id_ine: 'INE-LOCAL-001',
          telefono: '4441234567',
          domicilio: {
            calle: 'Av. Revolucion',
            numero_ext: '321B',
            numero_int: '2',
            colonia: 'Zona Centro',
            municipio_id: 1,
            codigo_postal: '22000',
            seccional: '0001'
          }
        }
      });

    expect(response.statusCode).toBe(422);
    expect(response.body).toEqual({ message: 'discapacidad es obligatorio.' });
  });

  test('staging rechaza discapacidad con tipo invalido', async () => {
    const stagingToken = makeToken(
      'unidad_informatica',
      'beneficiarios.staging.create',
      'staging-jti-invalid-discapacidad'
    );

    const response = await request(app)
      .post('/api/v1/beneficiarios-staging')
      .set('Authorization', `Bearer ${stagingToken}`)
      .send({
        external_request_id: 'UI-JWT-INVALID-DISCAPACIDAD',
        beneficiario: {
          nombre: 'Julieta',
          apellido_paterno: 'Morales',
          apellido_materno: 'Cano',
          curp: 'MOCJ050521MSPNRL01',
          fecha_nacimiento: '2005-05-21',
          sexo: 'M',
          discapacidad: 'false',
          id_ine: 'INE-LOCAL-001',
          telefono: '4441234567',
          domicilio: {
            calle: 'Av. Revolucion',
            numero_ext: '321B',
            numero_int: '2',
            colonia: 'Zona Centro',
            municipio_id: 1,
            codigo_postal: '22000',
            seccional: '0001'
          }
        }
      });

    expect(response.statusCode).toBe(422);
    expect(response.body).toEqual({ message: 'discapacidad debe ser booleano.' });
  });
});
