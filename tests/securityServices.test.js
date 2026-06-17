const crypto = require('crypto');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.CURP_HASH_SECRET = 'curp-test-secret';
process.env.FIELD_ENCRYPTION_KEY = 'field-test-secret';
process.env.INTEGRATION_JWT_AUDIENCE = 'api_tj';

describe('Servicios de seguridad', () => {
  test('curpHashService genera hash estable y mascara sin exponer CURP completa', () => {
    const { buildCurpLookup } = require('../src/services/curpHashService');
    const first = buildCurpLookup('MELR000202MSPSRD06');
    const second = buildCurpLookup('melr000202mspsrd06');

    expect(first.curpHash).toBe(second.curpHash);
    expect(first.curpHash).toHaveLength(64);
    expect(first.curpHash).not.toContain('MELR000202MSPSRD06');
    expect(first.curpMasked).toBe('MELR************06');
  });

  test('fieldEncryptionService cifra payload sensible y permite descifrarlo', () => {
    const { encryptJson, decryptJson } = require('../src/services/fieldEncryptionService');
    const payload = {
      external_request_id: 'REQ-1',
      curp: 'MELR000202MSPSRD06',
      nombre: 'Melissa'
    };

    const encrypted = encryptJson(payload);
    expect(encrypted.payload_ciphertext).not.toContain(payload.curp);
    expect(decryptJson(encrypted)).toEqual(payload);
  });

  test('fieldEncryptionService cifra strings para cardholders_sync y permite descifrarlos', () => {
    const { encryptString, decryptString } = require('../src/services/fieldEncryptionService');
    const encrypted = encryptString('Melissa');

    expect(encrypted.payload_ciphertext).not.toContain('Melissa');
    expect(decryptString(encrypted)).toBe('Melissa');
  });

  test('safeLogger sanitiza CURP en objetos y strings', () => {
    const { sanitize } = require('../src/utils/safeLogger');
    expect(sanitize('CURP MELR000202MSPSRD06')).not.toContain('MELR000202MSPSRD06');
    expect(sanitize({ curp: 'MELR000202MSPSRD06' })).toEqual({
      curp: '[CURP_REDACTED]'
    });
  });
});

describe('integrationAuthService', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('valida JWT RS256 con kid, scope y jti', async () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048
    });
    const publicPem = publicKey.export({ type: 'spki', format: 'pem' });
    const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
    const dbExecute = jest.fn().mockImplementation(async (sql) => {
      if (sql.includes('FROM service_clients')) {
        return [
          [
            {
              id: 1,
              client_code: 'sys_ipj',
              status: 'active',
              allowed_scopes: JSON.stringify(['cardholders.sync']),
              ip_allowlist: JSON.stringify([]),
              key_id_current: 'kid-1'
            }
          ],
          []
        ];
      }
      if (sql.includes('FROM service_client_keys')) {
        return [
          [
            {
              kid: 'kid-1',
              public_key: publicPem,
              status: 'active',
              valid_from: null,
              valid_until: null
            }
          ],
          []
        ];
      }
      return [[], []];
    });

    jest.doMock('../src/config/db', () => ({ execute: dbExecute }));
    const { verifyIntegrationRequest } = require('../src/services/integrationAuthService');
    const token = jwt.sign(
      {
        sub: 'sys_ipj',
        aud: 'api_tj',
        iss: 'sys_ipj',
        jti: 'jti-1',
        scope: 'cardholders.sync'
      },
      privatePem,
      { algorithm: 'RS256', expiresIn: '5m', header: { kid: 'kid-1' } }
    );

    const result = await verifyIntegrationRequest(
      {
        headers: { authorization: `Bearer ${token}` },
        ip: '127.0.0.1'
      },
      'cardholders.sync'
    );

    expect(result.client.client_code).toBe('sys_ipj');
    expect(dbExecute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO integration_jti_log'),
      expect.arrayContaining([1, 'jti-1'])
    );
  });
});
