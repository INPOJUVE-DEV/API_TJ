process.env.CURP_HASH_SECRET = process.env.CURP_HASH_SECRET || 'curp-test-secret';
process.env.FIELD_ENCRYPTION_KEY = process.env.FIELD_ENCRYPTION_KEY || 'field-test-secret';

const mockState = {
  connectionRows: [],
  executeCalls: []
};

function mockMakeConnection() {
  return {
    beginTransaction: jest.fn().mockResolvedValue(),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
    release: jest.fn(),
    execute: jest.fn(async (sql, params = []) => {
      if (sql.includes('FROM beneficiario_staging') && sql.includes('FOR UPDATE')) {
        return [mockState.connectionRows, []];
      }
      return [{ affectedRows: 1 }, []];
    })
  };
}

jest.mock('../src/config/db', () => ({
  execute: jest.fn(async (sql, params = []) => {
    mockState.executeCalls.push({ sql, params });
    return [{ affectedRows: 1, insertId: mockState.executeCalls.length }, []];
  }),
  getConnection: jest.fn(async () => mockMakeConnection())
}));

jest.mock('../src/services/fieldEncryptionService', () => ({
  decryptJson: jest.fn(() => ({
    curp: 'MOCJ050521MSPNRL01',
    nombre: 'Julieta',
    domicilio: { municipio_id: 1 }
  }))
}));

jest.mock('../src/services/sysIpjClient', () => ({
  pushBeneficiario: jest.fn()
}));

jest.mock('../src/services/adminActivityService', () => ({
  getClientIp: jest.fn(() => '127.0.0.1'),
  recordAdminActivity: jest.fn().mockResolvedValue()
}));

jest.mock('../src/services/syncAuditService', () => ({
  recordSyncAudit: jest.fn().mockResolvedValue()
}));

const db = require('../src/config/db');
const { pushBeneficiario } = require('../src/services/sysIpjClient');
const controller = require('../src/controllers/beneficiariosStagingController');

function buildResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

function findExecuteCall(fragment) {
  return mockState.executeCalls.find((call) => call.sql.includes(fragment));
}

describe('beneficiariosStagingController.push', () => {
  beforeEach(() => {
    mockState.connectionRows = [
      {
        id: 1,
        external_request_id: 'EXT-1',
        status: 'pending',
        payload_ciphertext: 'cipher',
        payload_iv: 'iv',
        payload_tag: 'tag',
        locked_at: null,
        locked_by: null
      }
    ];
    mockState.executeCalls = [];
    jest.clearAllMocks();
  });

  test('marca rejected cuando Sys_IPJ responde 4xx y registra intento', async () => {
    pushBeneficiario.mockResolvedValue({
      ok: false,
      status: 422,
      body: { message: 'Payload invalido' },
      errorMessage: 'Payload invalido'
    });

    const req = {
      params: { id: '1' },
      user: { id: 99, role: 'admin' },
      headers: {},
      ip: '127.0.0.1'
    };
    const res = buildResponse();

    await controller.push(req, res);

    expect(pushBeneficiario).toHaveBeenCalledWith({
      externalRequestId: 'EXT-1',
      payload: {
        curp: 'MOCJ050521MSPNRL01',
        nombre: 'Julieta',
        domicilio: { municipio_id: 1 }
      }
    });
    expect(findExecuteCall('INSERT INTO staging_push_attempts')?.params[5]).toBe('rejected');
    expect(findExecuteCall('UPDATE beneficiario_staging')?.params[0]).toBe('rejected');
    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({
      sent: false,
      message: 'No se pudo completar el envio a Sys_IPJ',
      sys_ipj_status: 422
    });
  });

  test('marca accepted cuando Sys_IPJ responde 2xx', async () => {
    pushBeneficiario.mockResolvedValue({
      ok: true,
      status: 201,
      body: { accepted: true },
      errorMessage: null
    });

    const req = {
      params: { id: '1' },
      user: { id: 100, role: 'admin' },
      headers: {},
      ip: '127.0.0.1'
    };
    const res = buildResponse();

    await controller.push(req, res);

    expect(findExecuteCall('INSERT INTO staging_push_attempts')?.params[5]).toBe('accepted');
    expect(findExecuteCall('UPDATE beneficiario_staging')?.params[0]).toBe('accepted');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      sent: true,
      message: 'Beneficiario enviado a Sys_IPJ',
      sys_ipj_status: 201
    });
  });

  test('marca error cuando Sys_IPJ falla por timeout o 5xx', async () => {
    pushBeneficiario.mockResolvedValue({
      ok: false,
      status: null,
      body: null,
      errorMessage: 'Timeout al enviar a Sys_IPJ'
    });

    const req = {
      params: { id: '1' },
      user: { id: 101, role: 'admin' },
      headers: {},
      ip: '127.0.0.1'
    };
    const res = buildResponse();

    await controller.push(req, res);

    expect(findExecuteCall('INSERT INTO staging_push_attempts')?.params[5]).toBe('error');
    expect(findExecuteCall('UPDATE beneficiario_staging')?.params[0]).toBe('error');
    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({
      sent: false,
      message: 'No se pudo completar el envio a Sys_IPJ',
      sys_ipj_status: null
    });
  });
});
