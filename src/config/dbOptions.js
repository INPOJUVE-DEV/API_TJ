const fs = require('fs');

function parseBoolean(rawValue, fallback = false) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return fallback;
  }

  const normalized = String(rawValue).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function parseInteger(rawValue, fallback) {
  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function looksLikeTiDbCloudHost(host = '') {
  return /(^|\.)tidbcloud\.com$/i.test(String(host).trim());
}

function looksLikeRailwayInternalHost(host = '') {
  return /(^|\.)railway\.internal$/i.test(String(host).trim());
}

function parseMysqlUri(uri) {
  const url = new URL(uri);
  if (!['mysql:', 'mysqls:'].includes(url.protocol)) {
    throw new Error(
      `DB_URI debe usar protocolo mysql:// o mysqls:// (recibido: ${url.protocol}//)`
    );
  }

  return {
    protocol: url.protocol,
    host: url.hostname,
    port: url.port
      ? Number(url.port)
      : looksLikeTiDbCloudHost(url.hostname)
        ? 4000
        : 3306,
    user: decodeURIComponent(url.username || ''),
    password: decodeURIComponent(url.password || ''),
    database: url.pathname ? url.pathname.replace(/^\//, '') : undefined
  };
}

function readCertificate(env) {
  const inlinePem = env.DB_SSL_CA || env.TIDB_CA;
  if (inlinePem) {
    return inlinePem.replace(/\\n/g, '\n');
  }

  const base64Pem = env.DB_SSL_CA_BASE64 || env.TIDB_CA_BASE64;
  if (base64Pem) {
    return Buffer.from(base64Pem, 'base64').toString('utf8');
  }

  const filePath = env.DB_SSL_CA_PATH || env.TIDB_CA_PATH;
  if (filePath) {
    return fs.readFileSync(filePath, 'utf8');
  }

  return undefined;
}

function getSslConfig(env, connectionConfig) {
  const isRailwayMySql =
    Boolean(env.MYSQL_URL || env.MYSQLHOST || env.MYSQLPORT) ||
    looksLikeRailwayInternalHost(connectionConfig.host);

  if (isRailwayMySql) {
    return undefined;
  }

  const sslEnabled = parseBoolean(
    env.DB_SSL ?? env.DB_SSL_ENABLED ?? env.TIDB_ENABLE_SSL,
    connectionConfig.protocol === 'mysqls:' || looksLikeTiDbCloudHost(connectionConfig.host)
  );

  if (!sslEnabled) {
    return undefined;
  }

  const sslConfig = {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: parseBoolean(
      env.DB_SSL_REJECT_UNAUTHORIZED ?? env.TIDB_SSL_REJECT_UNAUTHORIZED,
      true
    )
  };

  const ca = readCertificate(env);
  if (ca) {
    sslConfig.ca = ca;
  }

  const servername = env.DB_SSL_SERVERNAME || env.TIDB_SSL_SERVERNAME || connectionConfig.host;
  if (servername) {
    sslConfig.servername = servername;
  }

  return sslConfig;
}

function resolveBaseConnection(env) {
  const connectionUri = env.DB_URI || env.MYSQL_URL;
  if (connectionUri) {
    return parseMysqlUri(connectionUri);
  }

  const host = env.DB_HOST || env.MYSQLHOST || env.TIDB_HOST || 'localhost';
  const defaultPort = env.TIDB_HOST || looksLikeTiDbCloudHost(host) ? 4000 : 3306;

  return {
    protocol: 'mysql:',
    host,
    port: parseInteger(env.DB_PORT || env.MYSQLPORT || env.TIDB_PORT, defaultPort),
    user: env.DB_USER || env.MYSQLUSER || env.TIDB_USER || 'root',
    password: env.DB_PASSWORD || env.MYSQLPASSWORD || env.TIDB_PASSWORD || '',
    database: env.DB_NAME || env.MYSQLDATABASE || env.TIDB_DATABASE || 'tarjeta_joven'
  };
}

function getDbConfig(env = process.env) {
  const baseConnection = resolveBaseConnection(env);
  const ssl = getSslConfig(env, baseConnection);

  return {
    host: baseConnection.host,
    port: baseConnection.port,
    user: baseConnection.user,
    password: baseConnection.password,
    database: baseConnection.database,
    waitForConnections: true,
    connectionLimit: parseInteger(env.DB_CONNECTION_LIMIT, 10),
    queueLimit: 0,
    enableKeepAlive: true,
    supportBigNumbers: true,
    ...(ssl ? { ssl } : {})
  };
}

module.exports = {
  getDbConfig,
  looksLikeTiDbCloudHost,
  looksLikeRailwayInternalHost,
  parseBoolean
};
