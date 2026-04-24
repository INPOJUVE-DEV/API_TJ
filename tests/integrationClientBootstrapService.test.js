const {
  bootstrapIntegrationClients,
  buildClientConfigs,
  normalizePem
} = require('../src/services/integrationClientBootstrapService');

describe('integrationClientBootstrapService', () => {
  test('normalizePem soporta saltos escapados', () => {
    expect(normalizePem('LINEA1\\nLINEA2')).toBe('LINEA1\nLINEA2');
  });

  test('buildClientConfigs omite clientes sin llave publica', () => {
    const configs = buildClientConfigs({
      INFORMATICA_JWT_PUBLIC_KEY: '',
      SYS_IPJ_JWT_PUBLIC_KEY: ''
    });

    expect(configs).toEqual([]);
  });

  test('bootstrapIntegrationClients hace upsert con valores de entorno', async () => {
    const execute = jest.fn(async (sql, params = []) => {
      if (sql.includes('SELECT id FROM service_clients')) {
        return [[{ id: 7 }], []];
      }
      return [{ affectedRows: 1 }, []];
    });
    const executor = { execute };

    const result = await bootstrapIntegrationClients(
      {
        INFORMATICA_JWT_PUBLIC_KEY: '-----BEGIN PUBLIC KEY-----\\nABC\\n-----END PUBLIC KEY-----',
        INFORMATICA_JWT_KID: 'ui-railway-kid',
        INFORMATICA_ALLOWED_SCOPES: '["cardholders.lookup","beneficiarios.staging.create"]',
        INFORMATICA_IP_ALLOWLIST: '["10.10.10.10"]'
      },
      executor
    );

    expect(result).toEqual({ configured: 1 });
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO service_clients'),
      [
        'unidad_informatica',
        'Unidad de Informatica',
        JSON.stringify(['cardholders.lookup', 'beneficiarios.staging.create']),
        JSON.stringify(['10.10.10.10']),
        'ui-railway-kid'
      ]
    );
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO service_client_keys'),
      [
        7,
        'ui-railway-kid',
        '-----BEGIN PUBLIC KEY-----\nABC\n-----END PUBLIC KEY-----',
        expect.any(Date)
      ]
    );
  });
});
