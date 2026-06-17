const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const jwt = require('jsonwebtoken');

describe('sysIpjClient', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    global.fetch = jest.fn();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('firma el push con RS256 y envia payload compatible con Sys_IPJ', async () => {
    const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privateKey = pair.privateKey.export({ format: 'pem', type: 'pkcs8' });
    const publicKey = pair.publicKey.export({ format: 'pem', type: 'spki' });
    const privateKeyPath = path.join(os.tmpdir(), `api-tj-push-${Date.now()}.pem`);

    fs.writeFileSync(privateKeyPath, privateKey);

    process.env.SYS_IPJ_PUSH_URL = 'http://127.0.0.1/api/api-tj/inbound';
    process.env.API_TJ_TO_SYS_IPJ_PRIVATE_KEY_PATH = privateKeyPath;
    process.env.API_TJ_TO_SYS_IPJ_JWT_KID = 'api_tj-current';
    process.env.API_TJ_TO_SYS_IPJ_ISSUER = 'api_tj';
    process.env.API_TJ_TO_SYS_IPJ_SUBJECT = 'api_tj';
    process.env.API_TJ_TO_SYS_IPJ_AUDIENCE = 'sys_ipj';
    process.env.API_TJ_TO_SYS_IPJ_SCOPE = 'beneficiarios.staging.push';
    process.env.API_TJ_TO_SYS_IPJ_JWT_EXPIRES_IN = '5m';

    global.fetch.mockResolvedValue({
      ok: true,
      status: 201,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({ accepted: true, external_request_id: 'INF-1' })
      )
    });

    const { pushBeneficiario } = require('../src/services/sysIpjClient');
    const payload = {
      curp: 'MOCJ050521MSPNRL01',
      nombre: 'Julieta',
      apellido_paterno: 'Morales',
      apellido_materno: 'Cano',
      fecha_nacimiento: '2005-05-21',
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
    };

    const result = await pushBeneficiario({
      externalRequestId: 'INF-1',
      payload
    });

    expect(result).toMatchObject({
      ok: true,
      status: 201,
      body: { accepted: true, external_request_id: 'INF-1' }
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('http://127.0.0.1/api/api-tj/inbound');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.headers['Idempotency-Key']).toBe('INF-1');
    expect(options.headers.Authorization).toMatch(/^Bearer\s+/);

    const token = options.headers.Authorization.replace(/^Bearer\s+/i, '');
    const decodedComplete = jwt.decode(token, { complete: true });
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      audience: 'sys_ipj',
      issuer: 'api_tj'
    });
    expect(decodedComplete.header.kid).toBe('api_tj-current');
    expect(decoded.sub).toBe('api_tj');
    expect(decoded.aud).toBe('sys_ipj');
    expect(decoded.iss).toBe('api_tj');
    expect(decoded.scope).toBe('beneficiarios.staging.push');
    expect(decoded.jti).toBeTruthy();

    const requestBody = JSON.parse(options.body);
    expect(requestBody).toEqual({
      external_request_id: 'INF-1',
      source: 'api_tj',
      submitted_by: {
        system: 'api_tj'
      },
      beneficiario: payload
    });
  });

  test('usa beneficiarios.staging.push como scope por default', async () => {
    const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privateKey = pair.privateKey.export({ format: 'pem', type: 'pkcs8' });
    const publicKey = pair.publicKey.export({ format: 'pem', type: 'spki' });
    const privateKeyPath = path.join(os.tmpdir(), `api-tj-push-default-${Date.now()}.pem`);

    fs.writeFileSync(privateKeyPath, privateKey);

    process.env.SYS_IPJ_PUSH_URL = 'http://127.0.0.1/api/api-tj/inbound';
    process.env.API_TJ_TO_SYS_IPJ_PRIVATE_KEY_PATH = privateKeyPath;
    process.env.API_TJ_TO_SYS_IPJ_JWT_KID = 'api_tj-current';
    process.env.API_TJ_TO_SYS_IPJ_ISSUER = 'api_tj';
    process.env.API_TJ_TO_SYS_IPJ_SUBJECT = 'api_tj';
    process.env.API_TJ_TO_SYS_IPJ_AUDIENCE = 'sys_ipj';
    delete process.env.API_TJ_TO_SYS_IPJ_SCOPE;

    global.fetch.mockResolvedValue({
      ok: true,
      status: 202,
      text: jest.fn().mockResolvedValue('{}')
    });

    const { pushBeneficiario } = require('../src/services/sysIpjClient');
    await pushBeneficiario({
      externalRequestId: 'INF-DEFAULT-1',
      payload: { nombre: 'Prueba' }
    });

    const [, options] = global.fetch.mock.calls[0];
    const token = options.headers.Authorization.replace(/^Bearer\s+/i, '');
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      audience: 'sys_ipj',
      issuer: 'api_tj'
    });

    expect(decoded.scope).toBe('beneficiarios.staging.push');
  });

  test('reporta error claro si falta la llave privada de salida', async () => {
    process.env.SYS_IPJ_PUSH_URL = 'http://127.0.0.1/api/api-tj/inbound';
    delete process.env.API_TJ_TO_SYS_IPJ_PRIVATE_KEY_PATH;

    const { pushBeneficiario } = require('../src/services/sysIpjClient');
    const result = await pushBeneficiario({
      externalRequestId: 'INF-2',
      payload: { nombre: 'Prueba' }
    });

    expect(result).toEqual({
      ok: false,
      status: null,
      body: null,
      errorMessage: 'API_TJ_TO_SYS_IPJ_PRIVATE_KEY_PATH no configurado'
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
