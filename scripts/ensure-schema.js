/* eslint-disable no-console */
require('dotenv').config();
const mysql = require('mysql2/promise');
const { ensureSchema, getDbConfig } = require('./seed');

async function main() {
  const pool = mysql.createPool(getDbConfig());
  console.log('Verificando esquema...');
  try {
    await ensureSchema(pool);
    console.log('Esquema actualizado.');
  } catch (error) {
    console.error('Error al verificar esquema:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}
