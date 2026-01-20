const mysql = require('mysql2/promise');

function parseMysqlUri(uri) {
  const url = new URL(uri);
  if (url.protocol !== 'mysql:') {
    throw new Error(`DB_URI debe usar protocolo mysql:// (recibido: ${url.protocol}//)`);
  }

  const database = url.pathname ? url.pathname.replace(/^\//, '') : '';

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username || ''),
    password: decodeURIComponent(url.password || ''),
    database: database || undefined
  };
}

const baseConfig = process.env.DB_URI
  ? parseMysqlUri(process.env.DB_URI)
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'tarjeta_joven'
    };

const pool = mysql.createPool({
  ...baseConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;
