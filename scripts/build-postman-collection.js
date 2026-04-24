const fs = require('fs');
const path = require('path');

const outputPath = path.join(__dirname, 'fixtures', 'API_TJ_local.postman_collection.json');

function jsonBody(payload) {
  return {
    mode: 'raw',
    raw: JSON.stringify(payload, null, 2),
    options: {
      raw: {
        language: 'json'
      }
    }
  };
}

function script(lines) {
  return {
    type: 'text/javascript',
    exec: lines
  };
}

function event(listen, lines) {
  return {
    listen,
    script: script(lines)
  };
}

function requestItem(name, method, pathParts, { body, authTokenVar, events = [], headers = [] } = {}) {
  return {
    name,
    event: events,
    request: {
      method,
      header: [
        ...headers,
        ...(body ? [{ key: 'Content-Type', value: 'application/json' }] : []),
        ...(authTokenVar ? [{ key: 'Authorization', value: `Bearer {{${authTokenVar}}}` }] : [])
      ],
      body,
      url: {
        raw: `{{base_url}}${pathParts.join('')}`,
        host: ['{{base_url}}'],
        path: pathParts
      }
    }
  };
}

const issueIntegrationTokenScript = (clientCode, scopes) => [
  `pm.sendRequest({`,
  `  url: pm.environment.get('mock_base_url') + '/integration/issue-token',`,
  `  method: 'POST',`,
  `  header: { 'Content-Type': 'application/json' },`,
  `  body: {`,
  `    mode: 'raw',`,
  `    raw: JSON.stringify({ client_code: '${clientCode}', scopes: ${JSON.stringify(scopes)} })`,
  `  }`,
  `}, function (err, res) {`,
  `  if (err) { throw err; }`,
  `  const data = res.json();`,
  `  pm.environment.set('integration_token', data.token);`,
  `});`
];

const issueAuth0IdTokenScript = [
  `const seed = Date.now();`,
  `pm.sendRequest({`,
  `  url: pm.environment.get('mock_base_url') + '/auth0/issue-id-token',`,
  `  method: 'POST',`,
  `  header: { 'Content-Type': 'application/json' },`,
  `  body: {`,
  `    mode: 'raw',`,
  `    raw: JSON.stringify({`,
  `      sub: 'auth0|postman-local-' + seed,`,
  `      email: 'postman.local.' + seed + '@example.com',`,
  `      aud: 'postman-local-client',`,
  `      issuer_base: 'http://host.docker.internal:9091/auth0'`,
  `    })`,
  `  }`,
  `}, function (err, res) {`,
  `  if (err) { throw err; }`,
  `  const data = res.json();`,
  `  pm.environment.set('auth0_id_token_ok', data.token);`,
  `});`
];

const setSyncIdScript = [
  `pm.environment.set('sync_id', 'SYNC-' + Date.now());`
];

const setUniqueStagingScript = [
  `if (!pm.environment.get('staging_external_request_id')) {`,
  `  pm.environment.set('staging_external_request_id', 'INF-' + Date.now());`,
  `}`,
  `if (!pm.environment.get('staging_curp_new')) {`,
  `  const seed = Date.now();`,
  `  const alnum = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'[seed % 36];`,
  `  pm.environment.set('staging_curp_new', 'MELR000202MBCSRD' + alnum + (seed % 10));`,
  `}`
];

const setNewMissingStagingScript = [
  `pm.environment.set('staging_external_request_id_missing', 'INF-MISS-' + Date.now());`,
  `const seed = Date.now() + 1;`,
  `const alnum = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'[seed % 36];`,
  `pm.environment.set('staging_curp_missing', 'MELR000202MBCSRD' + alnum + (seed % 10));`
];

const loginTests = [
  `pm.test('Login 200', function () { pm.response.to.have.status(200); });`,
  `const data = pm.response.json();`,
  `pm.environment.set('admin_token', data.accessToken);`
];

const createdStagingTests = [
  `pm.test('Staging 202', function () { pm.response.to.have.status(202); });`,
  `const data = pm.response.json();`,
  `pm.test('Created true', function () { pm.expect(data.created).to.eql(true); });`,
  `pm.environment.set('staging_id', data.staging_id);`
];

const collection = {
  info: {
    name: 'API_TJ Local Flow',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    description: 'Coleccion local para recorrer las pruebas de docs/pruebas_postman_API_TJ.md'
  },
  item: [
    {
      name: '00 Login Admin',
      item: [
        requestItem('Login admin local', 'POST', ['/api/v1/auth/login'], {
          body: jsonBody({
            username: 'ana.hernandez@example.com',
            password: 'Test1234!'
          }),
          events: [event('test', loginTests)]
        })
      ]
    },
    {
      name: '01 Sync',
      item: [
        requestItem('Sync valido', 'POST', ['/api/v1/cardholders/sync'], {
          authTokenVar: 'integration_token',
          body: jsonBody({
            sync_id: '{{sync_id}}',
            items: [
              {
                curp_hash: '{{curp_hash_ok}}',
                curp_masked: '{{curp_masked_ok}}',
                tarjeta_numero: '{{tarjeta_numero_ok}}',
                status: 'active'
              }
            ]
          }),
          events: [
            event('prerequest', setSyncIdScript.concat(issueIntegrationTokenScript('sys_ipj', ['cardholders.sync']))),
            event('test', [
              `pm.test('Status 200/201', function () { pm.expect([200, 201]).to.include(pm.response.code); });`,
              `const data = pm.response.json();`,
              `pm.test('Processed 1', function () { pm.expect(data.processed).to.eql(1); });`
            ])
          ]
        }),
        requestItem('Sync con token invalido', 'POST', ['/api/v1/cardholders/sync'], {
          headers: [{ key: 'Authorization', value: 'Bearer bad.token' }],
          body: jsonBody({
            sync_id: '{{sync_id}}',
            items: []
          }),
          events: [event('test', [`pm.test('Status 401', function () { pm.response.to.have.status(401); });`])]
        }),
        requestItem('Sync con scope incorrecto', 'POST', ['/api/v1/cardholders/sync'], {
          authTokenVar: 'integration_token',
          body: jsonBody({
            sync_id: '{{sync_id}}',
            items: []
          }),
          events: [
            event('prerequest', issueIntegrationTokenScript('unidad_informatica', ['cardholders.lookup'])),
            event('test', [`pm.test('Status 403', function () { pm.response.to.have.status(403); });`])
          ]
        }),
        requestItem('Sync duplicado idempotente', 'POST', ['/api/v1/cardholders/sync'], {
          authTokenVar: 'integration_token',
          body: jsonBody({
            sync_id: '{{sync_id}}',
            items: [
              {
                curp_hash: '{{curp_hash_ok}}',
                curp_masked: '{{curp_masked_ok}}',
                tarjeta_numero: '{{tarjeta_numero_ok}}',
                status: 'active'
              }
            ]
          }),
          events: [
            event('prerequest', issueIntegrationTokenScript('sys_ipj', ['cardholders.sync'])),
            event('test', [
              `pm.test('Status 200/201', function () { pm.expect([200, 201]).to.include(pm.response.code); });`,
              `const data = pm.response.json();`,
              `pm.test('Updated or skipped', function () { pm.expect((data.updated || 0) + (data.skipped || 0)).to.be.above(0); });`
            ])
          ]
        }),
        requestItem('Sync con cambio de tarjeta', 'POST', ['/api/v1/cardholders/sync'], {
          authTokenVar: 'integration_token',
          body: jsonBody({
            sync_id: '{{sync_id}}-ALT',
            items: [
              {
                curp_hash: '{{curp_hash_ok}}',
                curp_masked: '{{curp_masked_ok}}',
                tarjeta_numero: '{{tarjeta_numero_alt}}',
                status: 'active'
              }
            ]
          }),
          events: [
            event('prerequest', issueIntegrationTokenScript('sys_ipj', ['cardholders.sync'])),
            event('test', [`pm.test('Status 200/201', function () { pm.expect([200, 201]).to.include(pm.response.code); });`])
          ]
        })
      ]
    },
    {
      name: '02 Lookup',
      item: [
        requestItem('Lookup existente', 'POST', ['/api/v1/cardholders/lookup'], {
          authTokenVar: 'integration_token',
          body: jsonBody({ curp: '{{curp_ok}}' }),
          events: [
            event('prerequest', issueIntegrationTokenScript('unidad_informatica', ['cardholders.lookup'])),
            event('test', [
              `pm.test('Status 200', function () { pm.response.to.have.status(200); });`,
              `const data = pm.response.json();`,
              `pm.test('registered true', function () { pm.expect(data.registered).to.eql(true); });`,
              `pm.test('sin CURP', function () { pm.expect(data.curp).to.eql(undefined); });`
            ])
          ]
        }),
        requestItem('Lookup inexistente', 'POST', ['/api/v1/cardholders/lookup'], {
          authTokenVar: 'integration_token',
          body: jsonBody({ curp: '{{curp_bad}}' }),
          events: [
            event('prerequest', issueIntegrationTokenScript('unidad_informatica', ['cardholders.lookup'])),
            event('test', [`pm.test('Status 404', function () { pm.response.to.have.status(404); });`])
          ]
        }),
        requestItem('Lookup con formato invalido', 'POST', ['/api/v1/cardholders/lookup'], {
          authTokenVar: 'integration_token',
          body: jsonBody({ curp: '123' }),
          events: [
            event('prerequest', issueIntegrationTokenScript('unidad_informatica', ['cardholders.lookup'])),
            event('test', [`pm.test('Status 422', function () { pm.response.to.have.status(422); });`])
          ]
        }),
        requestItem('Lookup con token de Sys_IPJ', 'POST', ['/api/v1/cardholders/lookup'], {
          authTokenVar: 'integration_token',
          body: jsonBody({ curp: '{{curp_ok}}' }),
          events: [
            event('prerequest', issueIntegrationTokenScript('sys_ipj', ['cardholders.sync'])),
            event('test', [`pm.test('Status 403', function () { pm.response.to.have.status(403); });`])
          ]
        })
      ]
    },
    {
      name: '03 Staging',
      item: [
        requestItem('Crear staging valido', 'POST', ['/api/v1/beneficiarios-staging'], {
          authTokenVar: 'integration_token',
          body: jsonBody({
            external_request_id: '{{staging_external_request_id}}',
            beneficiario: {
              curp: '{{staging_curp_new}}',
              nombre: 'MELISSA',
              apellido_paterno: 'RIOS',
              apellido_materno: 'DELGADO',
              fecha_nacimiento: '2000-02-02',
              sexo: 'M',
              discapacidad: false,
              id_ine: 'INE0001',
              telefono: '6641234567',
              domicilio: {
                calle: 'CALLE 1',
                numero_ext: '10',
                numero_int: '2',
                colonia: 'CENTRO',
                municipio_id: 1,
                codigo_postal: '22000',
                seccional: '0001'
              }
            }
          }),
          events: [
            event('prerequest', setUniqueStagingScript.concat(issueIntegrationTokenScript('unidad_informatica', ['beneficiarios.staging.create']))),
            event('test', createdStagingTests)
          ]
        }),
        requestItem('Crear staging duplicado', 'POST', ['/api/v1/beneficiarios-staging'], {
          authTokenVar: 'integration_token',
          body: jsonBody({
            external_request_id: '{{staging_external_request_id}}',
            beneficiario: {
              curp: '{{staging_curp_new}}',
              nombre: 'MELISSA',
              apellido_paterno: 'RIOS',
              apellido_materno: 'DELGADO',
              fecha_nacimiento: '2000-02-02',
              sexo: 'M',
              discapacidad: false,
              id_ine: 'INE0001',
              telefono: '6641234567',
              domicilio: {
                calle: 'CALLE 1',
                numero_ext: '10',
                numero_int: '2',
                colonia: 'CENTRO',
                municipio_id: 1,
                codigo_postal: '22000',
                seccional: '0001'
              }
            }
          }),
          events: [
            event('prerequest', issueIntegrationTokenScript('unidad_informatica', ['beneficiarios.staging.create'])),
            event('test', [`pm.test('Status 409', function () { pm.response.to.have.status(409); });`])
          ]
        }),
        requestItem('Crear staging para CURP sincronizada', 'POST', ['/api/v1/beneficiarios-staging'], {
          authTokenVar: 'integration_token',
          body: jsonBody({
            external_request_id: '{{staging_external_request_id}}-SYNC',
            beneficiario: {
              curp: '{{curp_ok}}',
              nombre: 'MELISSA',
              apellido_paterno: 'RIOS',
              apellido_materno: 'DELGADO',
              fecha_nacimiento: '2000-02-02',
              sexo: 'M',
              discapacidad: false,
              id_ine: 'INE0001',
              telefono: '6641234567',
              domicilio: {
                calle: 'CALLE 1',
                numero_ext: '10',
                numero_int: '2',
                colonia: 'CENTRO',
                municipio_id: 1,
                codigo_postal: '22000',
                seccional: '0001'
              }
            }
          }),
          events: [
            event('prerequest', issueIntegrationTokenScript('unidad_informatica', ['beneficiarios.staging.create'])),
            event('test', [`pm.test('Status 409', function () { pm.response.to.have.status(409); });`])
          ]
        }),
        requestItem('Crear staging con faltantes en domicilio', 'POST', ['/api/v1/beneficiarios-staging'], {
          authTokenVar: 'integration_token',
          body: jsonBody({
            external_request_id: '{{staging_external_request_id_missing}}',
            beneficiario: {
              curp: '{{staging_curp_missing}}',
              nombre: 'MELISSA',
              apellido_paterno: 'RIOS',
              apellido_materno: 'DELGADO',
              fecha_nacimiento: '2000-02-02',
              sexo: 'M',
              discapacidad: false,
              id_ine: 'INE0002',
              telefono: '6641234568',
              domicilio: {
                calle: 'CALLE 1',
                numero_ext: '10',
                numero_int: '2',
                colonia: 'CENTRO',
                municipio_id: 1,
                codigo_postal: '',
                seccional: '0001'
              }
            }
          }),
          events: [
            event('prerequest', setNewMissingStagingScript.concat(issueIntegrationTokenScript('unidad_informatica', ['beneficiarios.staging.create']))),
            event('test', [`pm.test('Status 422', function () { pm.response.to.have.status(422); });`])
          ]
        }),
        requestItem('Crear staging con token invalido', 'POST', ['/api/v1/beneficiarios-staging'], {
          headers: [{ key: 'Authorization', value: 'Bearer bad.token' }],
          body: jsonBody({
            external_request_id: 'INF-BAD-TOKEN',
            beneficiario: {
              curp: 'MELR000202MBCSRD08',
              nombre: 'MELISSA',
              apellido_paterno: 'RIOS',
              apellido_materno: 'DELGADO',
              fecha_nacimiento: '2000-02-02',
              sexo: 'M',
              discapacidad: false,
              id_ine: 'INE0003',
              telefono: '6641234569',
              domicilio: {
                calle: 'CALLE 1',
                numero_ext: '10',
                numero_int: '2',
                colonia: 'CENTRO',
                municipio_id: 1,
                codigo_postal: '22000',
                seccional: '0001'
              }
            }
          }),
          events: [event('test', [`pm.test('Status 401', function () { pm.response.to.have.status(401); });`])]
        })
      ]
    },
    {
      name: '04 Staging Admin',
      item: [
        requestItem('Listado con admin interno', 'GET', ['/api/v1/beneficiarios-staging?status=pending'], {
          authTokenVar: 'admin_token',
          events: [
            event('test', [
              `pm.test('Status 200', function () { pm.response.to.have.status(200); });`,
              `const data = pm.response.json();`,
              `pm.test('Hay items', function () { pm.expect(Array.isArray(data.items)).to.eql(true); });`
            ])
          ]
        }),
        requestItem('Listado con token de Informatica', 'GET', ['/api/v1/beneficiarios-staging?status=pending'], {
          authTokenVar: 'integration_token',
          events: [
            event('prerequest', issueIntegrationTokenScript('unidad_informatica', ['beneficiarios.staging.create'])),
            event('test', [`pm.test('Status 403', function () { pm.response.to.have.status(403); });`])
          ]
        }),
        requestItem('Push valido', 'POST', ['/api/v1/beneficiarios-staging/{{staging_id}}/push'], {
          authTokenVar: 'admin_token',
          body: jsonBody({}),
          events: [
            event('test', [
              `pm.test('Status 200', function () { pm.response.to.have.status(200); });`,
              `const data = pm.response.json();`,
              `pm.test('sent true', function () { pm.expect(data.sent).to.eql(true); });`
            ])
          ]
        }),
        requestItem('Push duplicado', 'POST', ['/api/v1/beneficiarios-staging/{{staging_id}}/push'], {
          authTokenVar: 'admin_token',
          body: jsonBody({}),
          events: [event('test', [`pm.test('Status 409', function () { pm.response.to.have.status(409); });`])]
        }),
        requestItem('Push con staging inexistente', 'POST', ['/api/v1/beneficiarios-staging/999999/push'], {
          authTokenVar: 'admin_token',
          body: jsonBody({}),
          events: [event('test', [`pm.test('Status 404', function () { pm.response.to.have.status(404); });`])]
        })
      ]
    },
    {
      name: '05 Activacion',
      item: [
        requestItem('Verify activation correcto', 'POST', ['/api/v1/cardholders/verify-activation'], {
          body: jsonBody({
            tarjeta_numero: '{{tarjeta_numero_alt}}',
            curp: '{{curp_ok}}'
          }),
          events: [
            event('test', [
              `pm.test('Status 200', function () { pm.response.to.have.status(200); });`,
              `pm.test('can_activate true', function () { pm.expect(pm.response.json().can_activate).to.eql(true); });`
            ])
          ]
        }),
        requestItem('Verify activation con tarjeta incorrecta', 'POST', ['/api/v1/cardholders/verify-activation'], {
          body: jsonBody({
            tarjeta_numero: '{{tarjeta_numero_bad}}',
            curp: '{{curp_ok}}'
          }),
          events: [event('test', [`pm.test('Status 403 o 422', function () { pm.expect([403, 422]).to.include(pm.response.code); });`])]
        }),
        requestItem('Verify activation con CURP incorrecta', 'POST', ['/api/v1/cardholders/verify-activation'], {
          body: jsonBody({
            tarjeta_numero: '{{tarjeta_numero_alt}}',
            curp: '{{curp_bad}}'
          }),
          events: [event('test', [`pm.test('Status 403 o 422', function () { pm.expect([403, 422]).to.include(pm.response.code); });`])]
        }),
        requestItem('Verify activation para usuario ya vinculado', 'POST', ['/api/v1/cardholders/verify-activation'], {
          body: jsonBody({
            tarjeta_numero: 'TJ-0001',
            curp: 'HERL020101MSPNRZ01'
          }),
          events: [event('test', [`pm.test('Status 409', function () { pm.response.to.have.status(409); });`])]
        }),
        requestItem('Complete activation valido', 'POST', ['/api/v1/cardholders/complete-activation'], {
          body: jsonBody({
            tarjeta_numero: '{{tarjeta_numero_alt}}',
            auth0_id_token: '{{auth0_id_token_ok}}'
          }),
          events: [
            event('prerequest', issueAuth0IdTokenScript),
            event('test', [
              `pm.test('Status 200', function () { pm.response.to.have.status(200); });`,
              `pm.test('activated true', function () { pm.expect(pm.response.json().activated).to.eql(true); });`
            ])
          ]
        }),
        requestItem('Complete activation con token Auth0 invalido', 'POST', ['/api/v1/cardholders/complete-activation'], {
          body: jsonBody({
            tarjeta_numero: '{{tarjeta_numero_alt}}',
            auth0_id_token: '{{auth0_id_token_bad}}'
          }),
          events: [event('test', [`pm.test('Status 401 o 403', function () { pm.expect([401, 403]).to.include(pm.response.code); });`])]
        }),
        requestItem('Complete activation para tarjeta ya vinculada', 'POST', ['/api/v1/cardholders/complete-activation'], {
          body: jsonBody({
            tarjeta_numero: '{{tarjeta_numero_alt}}',
            auth0_id_token: '{{auth0_id_token_ok}}'
          }),
          events: [
            event('prerequest', issueAuth0IdTokenScript),
            event('test', [`pm.test('Status 409', function () { pm.response.to.have.status(409); });`])
          ]
        })
      ]
    },
    {
      name: '06 Legacy',
      item: [
        requestItem('Cuenta local legacy retirada', 'POST', ['/api/v1/cardholders/MELR000202MSPSRD06/account'], {
          body: jsonBody({}),
          events: [event('test', [`pm.test('Status 410', function () { pm.response.to.have.status(410); });`])]
        }),
        requestItem('Register legacy retirado', 'POST', ['/api/v1/register'], {
          body: jsonBody({}),
          events: [event('test', [`pm.test('Status 410', function () { pm.response.to.have.status(410); });`])]
        })
      ]
    }
  ]
};

fs.writeFileSync(outputPath, JSON.stringify(collection, null, 2));
console.log(`Coleccion Postman generada en ${outputPath}`);
