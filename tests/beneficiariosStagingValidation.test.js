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

const clients = {
  unidad_informatica: {
    id: 2,
    client_code: 'unidad_informatica',
    status: 'active',
    allowed_scopes: JSON.stringify(['beneficiarios.staging.create']),
    ip_allowlist: JSON.stringify([]),
    key_id_current: 'ui-kid'
  }
};

const state = {
  jtis: new Set(),
  insertedStagingRows: []
};

function resetState() {
  state.jtis.clear();
  state.insertedStagingRows = [];
}

function makeIntegrationToken(jtiValue) {
  return jwt.sign(
    {
      iss: 'unidad_informatica',
      sub: 'unidad_informatica',
      aud: 'api_tj',
      jti: jtiValue,
      scope: 'beneficiarios.staging.create'
    },
    privateKeys.unidad_informatica,
    { algorithm: 'RS256', expiresIn: '5m', header: { kid: 'ui-kid' } }
  );
}

function buildValidPayload() {
  return {
    external_request_id: 'EXT-100',
    beneficiario: {
      curp: 'MOCJ050521MSPNRL01',
      nombre: 'Julieta',
      apellido_paterno: 'Morales',
      apellido_materno: 'Cano',
      fecha_nacimiento: '2005-05-21',
      folio_tarjeta: 'TJ-STAGING-0001',
      sexo: 'M',
      discapacidad: false,
      id_ine: 'INE123',
      telefono: '4441234567',
      domicilio: {
        calle: 'Av Revolucion',
        numero_ext: '321B',
        numero_int: null,
        colonia: 'Zona Centro',
        municipio_id: 1,
        codigo_postal: '22000',
        seccional: '0001'
      }
    }
  };
}

function mockExecuteSql(sql, params = []) {
  if (sql.includes('FROM service_clients')) {
    return [[clients[params[0]]].filter(Boolean), []];
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

  if (sql.includes('SELECT id FROM cardholders_sync WHERE curp_hash')) {
    return [[], []];
  }

  if (sql.includes('FROM beneficiario_staging') && sql.includes('WHERE external_request_id = ? OR curp_hash = ?')) {
    return [[], []];
  }

  if (sql.includes('INSERT INTO beneficiario_staging')) {
    state.insertedStagingRows.push({
      external_request_id: params[0],
      curp_hash: params[1]
    });
    return [{ insertId: state.insertedStagingRows.length, affectedRows: 1 }, []];
  }

  return [[], []];
}

jest.mock('../src/config/db', () => ({
  execute: jest.fn((sql, params) => Promise.resolve(mockExecuteSql(sql, params))),
  getConnection: jest.fn()
}));

const app = require('../src/index');

describe('beneficiarios staging validation', () => {
  beforeEach(() => {
    resetState();
    jest.clearAllMocks();
  });

  test.each([
    ['telefono debe tener 10 digitos.', (payload) => { payload.beneficiario.telefono = '444123456'; }],
    ['sexo debe ser M, F o X.', (payload) => { payload.beneficiario.sexo = 'N'; }],
    ['fecha_nacimiento no es valida.', (payload) => { payload.beneficiario.fecha_nacimiento = '2026-02-31'; }],
    ['domicilio.municipio_id debe ser un entero positivo.', (payload) => { payload.beneficiario.domicilio.municipio_id = 0; }],
    ['seccional es obligatorio.', (payload) => { payload.beneficiario.domicilio.seccional = ''; }]
  ])('rechaza staging invalido cuando %s', async (expectedMessage, mutatePayload) => {
    const payload = buildValidPayload();
    mutatePayload(payload);

    const response = await request(app)
      .post('/api/v1/beneficiarios-staging')
      .set('Authorization', `Bearer ${makeIntegrationToken(`staging-${expectedMessage}`)}`)
      .send(payload);

    expect(response.statusCode).toBe(422);
    expect(response.body).toEqual({ message: expectedMessage });
    expect(state.insertedStagingRows).toHaveLength(0);
  });

  test('acepta staging valido con contrato actual', async () => {
    const response = await request(app)
      .post('/api/v1/beneficiarios-staging')
      .set('Authorization', `Bearer ${makeIntegrationToken('staging-valid-1')}`)
      .send(buildValidPayload());

    expect(response.statusCode).toBe(202);
    expect(response.body).toMatchObject({
      created: true,
      status: 'pending',
      staging_id: 1
    });
    expect(state.insertedStagingRows).toHaveLength(1);
  });
});
