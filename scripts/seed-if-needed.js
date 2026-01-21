/* eslint-disable no-console */
require('dotenv').config();
const mysql = require('mysql2/promise');
const { spawn } = require('node:child_process');

function getDbConfig() {
  if (process.env.DB_URI) {
    const uri = new URL(process.env.DB_URI);
    const database = uri.pathname.replace('/', '');
    return {
      host: uri.hostname,
      port: uri.port ? Number(uri.port) : 3306,
      user: decodeURIComponent(uri.username),
      password: decodeURIComponent(uri.password),
      database,
      waitForConnections: true,
      connectionLimit: 5
    };
  }
  return {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'tarjeta_joven',
    waitForConnections: true,
    connectionLimit: 5
  };
}

function isSeedEnabled() {
  const raw = (process.env.SEED_ON_START || '').trim().toLowerCase();
  if (raw) {
    return !['0', 'false', 'no', 'off'].includes(raw);
  }
  return String(process.env.NODE_ENV || '').toLowerCase() !== 'production';
}

async function shouldSeed(pool) {
  const [[{ dbName }]] = await pool.query('SELECT DATABASE() AS dbName');
  if (!dbName) {
    throw new Error('No database selected. Set DB_NAME or DB_URI.');
  }

  const [tables] = await pool.execute(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = ? AND table_name = ?
     LIMIT 1`,
    [dbName, 'usuarios']
  );
  if (tables.length === 0) {
    return true;
  }

  const [[{ count }]] = await pool.query('SELECT COUNT(*) AS count FROM usuarios');
  return Number(count) === 0;
}

function runSeed() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/seed.js'], {
      stdio: 'inherit',
      env: process.env
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Seed failed with code ${code}`));
      }
    });
  });
}

async function main() {
  if (!isSeedEnabled()) {
    console.log('Seed deshabilitado por SEED_ON_START.');
    return;
  }

  const pool = mysql.createPool(getDbConfig());
  try {
    const needed = await shouldSeed(pool);
    if (!needed) {
      console.log('Seed omitido: ya existen datos.');
      return;
    }
    console.log('Seed requerido: ejecutando...');
    await runSeed();
  } catch (error) {
    console.error('Error en seed-if-needed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
