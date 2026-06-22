#!/usr/bin/env node

const {
  getConfig,
  loadFixture,
  requestJson,
  materializeLookupCase,
  buildIntegrationToken,
  printJson
} = require('./lib/unidadInformaticaSeedUtils');

async function main() {
  const config = getConfig();
  const fixture = loadFixture(config.fixturePath);
  const lookupCases = Array.isArray(fixture.lookup_cases) ? fixture.lookup_cases : [];

  if (lookupCases.length === 0) {
    throw new Error('El fixture no incluye lookup_cases.');
  }

  const seed = Date.now();
  console.log(`API_TJ lookup endpoint: ${config.apiBaseUrl}${config.lookupPath}`);
  console.log(`Casos de lookup: ${lookupCases.length}`);

  let passed = 0;

  for (let index = 0; index < lookupCases.length; index += 1) {
    const testCase = materializeLookupCase(lookupCases[index], index, seed);
    const token = await buildIntegrationToken('cardholders.lookup', config);
    const response = await requestJson({
      method: 'POST',
      url: `${config.apiBaseUrl}${config.lookupPath}`,
      token,
      body: { curp: testCase.curp }
    });

    const expectedStatus = Number(testCase.expect_status || 200);
    const ok = response.status === expectedStatus;
    if (ok) {
      passed += 1;
    }

    console.log(
      `[${ok ? 'OK' : 'FAIL'}] ${testCase.label || `lookup-${index + 1}`} -> HTTP ${response.status} (esperado ${expectedStatus})`
    );
    printJson(response.body);
  }

  console.log('\nResumen lookup');
  console.log(`Casos correctos: ${passed}`);
  console.log(`Casos fallidos: ${lookupCases.length - passed}`);

  if (passed !== lookupCases.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Error ejecutando seed de lookup Unidad Informatica:', error.message || error);
  process.exit(1);
});
