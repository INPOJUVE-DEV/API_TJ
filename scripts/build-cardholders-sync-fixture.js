/* eslint-disable no-console */
require('dotenv').config();
const fs = require('fs/promises');
const path = require('path');
const { buildCurpLookup } = require('../src/services/curpHashService');

const DEFAULT_SOURCE = path.join(__dirname, 'fixtures', 'cardholders-sync-source.sample.json');
const DEFAULT_OUTPUT = path.join(__dirname, 'fixtures', 'cardholders-sync.payload.json');

async function main() {
  const sourcePath = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : DEFAULT_SOURCE;
  const outputPath = process.argv[3]
    ? path.resolve(process.cwd(), process.argv[3])
    : DEFAULT_OUTPUT;

  const raw = await fs.readFile(sourcePath, 'utf8');
  const parsed = JSON.parse(raw);
  const items = Array.isArray(parsed.items) ? parsed.items : [];

  const payload = {
    sync_id: parsed.sync_id || `SYNC-${new Date().toISOString()}`,
    items: items.map((item) => {
      const lookup = buildCurpLookup(item.curp);
      return {
        curp_hash: lookup.curpHash,
        curp_masked: lookup.curpMasked,
        tarjeta_numero: String(item.tarjeta_numero || '').trim(),
        status: String(item.status || 'active').trim().toLowerCase()
      };
    })
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(`${outputPath}`, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log(`Fixture generado en: ${outputPath}`);
  console.log(`Registros: ${payload.items.length}`);
}

main().catch((error) => {
  console.error('Error al generar fixture de cardholders_sync:', error);
  process.exitCode = 1;
});
