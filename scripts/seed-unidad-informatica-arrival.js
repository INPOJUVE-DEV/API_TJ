#!/usr/bin/env node

const {
  getConfig,
  loadFixture,
  requestJson,
  materializeArrivalCase,
  buildIntegrationToken,
  printJson
} = require('./lib/unidadInformaticaSeedUtils');

async function lookupCurp(curp, config) {
  const token = await buildIntegrationToken('cardholders.lookup', config);
  return requestJson({
    method: 'POST',
    url: `${config.apiBaseUrl}${config.lookupPath}`,
    token,
    body: { curp }
  });
}

async function createStaging(record, config) {
  const token = await buildIntegrationToken('beneficiarios.staging.create', config);
  return requestJson({
    method: 'POST',
    url: `${config.apiBaseUrl}${config.stagingPath}`,
    token,
    body: record
  });
}

async function main() {
  const config = getConfig();
  const fixture = loadFixture(config.fixturePath);
  const arrivalCases = Array.isArray(fixture.arrival_cases) ? fixture.arrival_cases : [];

  if (arrivalCases.length === 0) {
    throw new Error('El fixture no incluye arrival_cases.');
  }

  const seed = Date.now();
  console.log(`API_TJ lookup endpoint: ${config.apiBaseUrl}${config.lookupPath}`);
  console.log(`API_TJ staging endpoint: ${config.apiBaseUrl}${config.stagingPath}`);
  console.log(`Casos de llegada Unidad Informatica: ${arrivalCases.length}`);

  let passed = 0;
  const createdStagingIds = [];

  for (let index = 0; index < arrivalCases.length; index += 1) {
    const testCase = materializeArrivalCase(arrivalCases[index], index, seed);
    const label = testCase.label || `arrival-${index + 1}`;

    const lookupResponse = await lookupCurp(testCase.beneficiario.curp, config);
    const expectedLookupStatus = Number(testCase.expect_lookup_status || 404);
    const lookupOk = lookupResponse.status === expectedLookupStatus;

    console.log(
      `[${lookupOk ? 'OK' : 'FAIL'}] ${label} lookup -> HTTP ${lookupResponse.status} (esperado ${expectedLookupStatus})`
    );
    printJson(lookupResponse.body);

    let stagingOk = true;
    if (lookupResponse.status === 404) {
      const stagingResponse = await createStaging(testCase, config);
      const expectedStagingStatus = Number(testCase.expect_staging_status || 202);
      stagingOk = stagingResponse.status === expectedStagingStatus;

      console.log(
        `[${stagingOk ? 'OK' : 'FAIL'}] ${label} staging -> HTTP ${stagingResponse.status} (esperado ${expectedStagingStatus})`
      );
      printJson(stagingResponse.body);

      if (stagingResponse.body?.staging_id) {
        createdStagingIds.push({
          label,
          staging_id: stagingResponse.body.staging_id,
          external_request_id: testCase.external_request_id
        });
      }
    } else {
      console.log(`[SKIP] ${label} staging no ejecutado porque lookup no devolvio 404.`);
    }

    if (lookupOk && stagingOk) {
      passed += 1;
    }
  }

  console.log('\nResumen llegada Unidad Informatica');
  console.log(`Casos correctos: ${passed}`);
  console.log(`Casos fallidos: ${arrivalCases.length - passed}`);
  console.log(`Staging creados: ${createdStagingIds.length}`);
  if (createdStagingIds.length > 0) {
    printJson(createdStagingIds);
  }

  if (passed !== arrivalCases.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Error ejecutando seed de llegada Unidad Informatica:', error.message || error);
  process.exit(1);
});
