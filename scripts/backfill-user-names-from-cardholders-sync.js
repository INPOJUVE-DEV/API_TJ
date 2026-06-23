/* eslint-disable no-console */
require('dotenv').config();

const db = require('../src/config/db');
const { decryptString } = require('../src/services/fieldEncryptionService');

const DEFAULT_BATCH_SIZE = 100;

function parseArgs(argv) {
  const args = Array.from(argv || []);
  const dryRun = args.includes('--dry-run');

  let batchSize = DEFAULT_BATCH_SIZE;
  const batchSizeIndex = args.findIndex((arg) => arg === '--batch-size');
  if (batchSizeIndex !== -1 && args[batchSizeIndex + 1]) {
    batchSize = parseBatchSize(args[batchSizeIndex + 1]);
  }

  const inlineBatchSize = args.find((arg) => arg.startsWith('--batch-size='));
  if (inlineBatchSize) {
    batchSize = parseBatchSize(inlineBatchSize.split('=')[1]);
  }

  return { dryRun, batchSize };
}

function parseBatchSize(rawValue) {
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_BATCH_SIZE;
  }
  return parsed;
}

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

function decryptCardholderString(row, prefix) {
  try {
    return decryptString({
      payload_ciphertext: row?.[`${prefix}_ciphertext`],
      payload_iv: row?.[`${prefix}_iv`],
      payload_tag: row?.[`${prefix}_tag`]
    });
  } catch {
    return null;
  }
}

function buildSelectQuery() {
  return `SELECT
            u.id,
            u.nombre,
            u.apellidos,
            u.municipio_id,
            cs.nombres_ciphertext,
            cs.nombres_iv,
            cs.nombres_tag,
            cs.apellido_ciphertext,
            cs.apellido_iv,
            cs.apellido_tag,
            cs.municipio_id AS sync_municipio_id
          FROM usuarios u
          JOIN cardholders_sync cs ON cs.id = u.cardholder_sync_id
          WHERE u.role = 'beneficiary'
            AND (
              u.nombre IS NULL OR u.nombre = ''
              OR u.apellidos IS NULL OR u.apellidos = ''
              OR u.municipio_id IS NULL
            )
            AND u.id > ?
          ORDER BY u.id ASC
          LIMIT ?`;
}

function resolvePendingUpdate(row) {
  const update = {};

  if (isBlank(row.nombre)) {
    const nombre = decryptCardholderString(row, 'nombres');
    if (!isBlank(nombre)) {
      update.nombre = String(nombre).trim();
    }
  }

  if (isBlank(row.apellidos)) {
    const apellidos = decryptCardholderString(row, 'apellido');
    if (!isBlank(apellidos)) {
      update.apellidos = String(apellidos).trim();
    }
  }

  if (row.municipio_id === null && row.sync_municipio_id) {
    update.municipio_id = row.sync_municipio_id;
  }

  return update;
}

async function processBatch(connection, rows, dryRun, summary) {
  for (const row of rows) {
    summary.scanned += 1;

    try {
      const pendingUpdate = resolvePendingUpdate(row);
      const fields = Object.keys(pendingUpdate);

      if (fields.length === 0) {
        summary.skipped += 1;
        continue;
      }

      if (dryRun) {
        summary.updated += 1;
        continue;
      }

      const assignments = fields.map((field) => `${field} = ?`);
      const values = fields.map((field) => pendingUpdate[field]);
      values.push(row.id);

      const [result] = await connection.execute(
        `UPDATE usuarios
         SET ${assignments.join(', ')}
         WHERE id = ?`,
        values
      );

      if (Number(result.affectedRows || 0) > 0) {
        summary.updated += 1;
      } else {
        summary.skipped += 1;
      }
    } catch (error) {
      summary.failed += 1;
      console.error(`No se pudo procesar el usuario ${row.id}:`, error.message);
    }
  }
}

async function main() {
  const { dryRun, batchSize } = parseArgs(process.argv.slice(2));
  const summary = {
    scanned: 0,
    updated: 0,
    skipped: 0,
    failed: 0
  };

  let connection;
  let lastId = 0;

  try {
    connection = await db.getConnection();

    while (true) {
      const [rows] = await connection.execute(buildSelectQuery(), [lastId, batchSize]);
      if (rows.length === 0) {
        break;
      }

      await processBatch(connection, rows, dryRun, summary);
      lastId = rows[rows.length - 1].id;
    }

    console.log(
      JSON.stringify(
        {
          mode: dryRun ? 'dry-run' : 'apply',
          batchSize,
          ...summary
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error('Error en backfill de usuarios desde cardholders_sync:', error.message);
    process.exitCode = 1;
  } finally {
    if (connection) {
      connection.release();
    }
    if (typeof db.end === 'function') {
      await db.end();
    }
  }
}

main();
