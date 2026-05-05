/* eslint-disable no-console */
require('dotenv').config();
const mysql = require('mysql2/promise');
const { getDbConfig } = require('../src/config/dbOptions');
const { buildCurpLookup } = require('../src/services/curpHashService');
const { hashPassword } = require('../src/services/passwordService');
const { buildDeviceTestFixtures } = require('./fixtures/deviceTestBeneficiaries');

const NODE_ENV = String(process.env.NODE_ENV || '').toLowerCase();
const ALLOW_PROD_SEED = String(process.env.ALLOW_PROD_SEED || '').toLowerCase() === 'true';

function getSeedPassword(envKey, fallback) {
  const envValue = process.env[envKey];
  if (envValue) {
    return envValue;
  }
  if (NODE_ENV === 'production' && ALLOW_PROD_SEED) {
    throw new Error(`Falta configurar ${envKey} para el seed en produccion.`);
  }
  return fallback;
}

const MUNICIPIOS = [
  'San Luis Potosí',
  'Soledad de Graciano Sánchez',
  'Ciudad Valles',
  'Matehuala',
  'Villa de Pozos',
  'Rioverde',
  'Tancanhuitz'
];

function normalizeFixtureMunicipioName(value) {
  if (value === 'San Luis Potosi') {
    return MUNICIPIOS[0];
  }
  if (value === 'Soledad de Graciano Sanchez') {
    return MUNICIPIOS[1];
  }
  return value;
}

const DEVICE_TEST_FIXTURES = buildDeviceTestFixtures({
  passwordOverride: process.env.SEED_DEVICE_TEST_PASSWORD || null
}).map(({ user, cardholder, ...meta }) => ({
  ...meta,
  user: {
    ...user,
    municipio: normalizeFixtureMunicipioName(user.municipio)
  },
  cardholder: {
    ...cardholder,
    municipio: normalizeFixtureMunicipioName(cardholder.municipio)
  }
}));

const CATEGORIAS = ['Restaurantes', 'Salud', 'Tecnologia', 'Entretenimiento', 'Educacion'];

const BENEFICIOS = [
  {
    nombre: 'Cafe Huasteco',
    categoria: 'Restaurantes',
    municipio: 'Ciudad Valles',
    descuento: '20% en consumo presentando la tarjeta',
    direccion: 'Blvd. México-Laredo 123, Centro',
    horario: 'L-D 08:00 - 22:00',
    descripcion: 'Coffee shop local con descuentos especiales para estudiantes.',
    headline: 'Nuevo beneficio en cafeterias',
    summary: 'Aprovecha 20% de descuento en bebidas y alimentos participantes.',
    imageUrl: 'https://cdn.tarjetajoven.gob.mx/benefits/cafe-huasteco.jpg',
    publishedAt: '2026-04-28T15:00:00Z',
    lat: 21.9833,
    lng: -99.0167,
    isActive: true,
    isVisibleToBeneficiary: true
  },
  {
    nombre: 'Gimnasio Potosino',
    categoria: 'Salud',
    municipio: 'San Luis Potosí',
    descuento: 'Inscripcion gratis + 15% mensualidad',
    direccion: 'Av. Venustiano Carranza 456, Morales',
    horario: 'L-S 06:00 - 23:00',
    descripcion: 'Gimnasio con entrenamiento funcional y clases grupales.',
    headline: 'Nuevo beneficio para activarte',
    summary: 'Inscripcion gratis y 15% de descuento en mensualidad.',
    imageUrl: 'https://cdn.tarjetajoven.gob.mx/benefits/gimnasio-potosino.jpg',
    publishedAt: '2026-04-30T15:00:00Z',
    lat: 22.1565,
    lng: -100.9754,
    isActive: true,
    isVisibleToBeneficiary: true
  },
  {
    nombre: 'Cine Centro',
    categoria: 'Entretenimiento',
    municipio: 'Soledad de Graciano Sánchez',
    descuento: '2x1 en taquilla martes y jueves',
    direccion: 'Plaza Principal 789, Zona Centro',
    horario: 'L-D 12:00 - 23:59',
    descripcion: 'Cadena local de cines con estrenos y funciones especiales.',
    headline: null,
    summary: null,
    imageUrl: null,
    publishedAt: '2026-04-20T12:00:00Z',
    lat: 22.1818,
    lng: -100.9388,
    isActive: true,
    isVisibleToBeneficiary: true
  },
  {
    nombre: 'Tech Lab SLP',
    categoria: 'Tecnologia',
    municipio: 'San Luis Potosí',
    descuento: 'Beca del 30% en cursos intensivos',
    direccion: 'Av. Himalaya 321, Lomas',
    horario: 'L-V 09:00 - 19:00',
    descripcion: 'Aceleradora de talento digital con programas de programacion.',
    headline: null,
    summary: 'Beca especial para cursos intensivos de talento digital.',
    imageUrl: null,
    publishedAt: '2026-04-18T10:00:00Z',
    lat: 22.1408,
    lng: -101.0184,
    isActive: true,
    isVisibleToBeneficiary: true
  }
];

const USUARIOS = [
  {
    nombre: 'Ana',
    apellidos: 'Hernandez Ruiz',
    curp: 'HERL020101MSPNRZ01',
    email: 'ana.hernandez@example.com',
    telefono: '4441234567',
    municipio: 'San Luis Potosí',
    password: getSeedPassword('SEED_ADMIN_PASSWORD', 'Test1234!'),
    role: 'admin'
  },
  {
    nombre: 'Carlos',
    apellidos: 'Lopez Mendez',
    curp: 'LOMC990505HSPLPM02',
    email: 'carlos.lopez@example.com',
    telefono: '4819876543',
    municipio: 'Ciudad Valles',
    password: getSeedPassword('SEED_READER1_PASSWORD', 'Secret456!'),
    role: 'beneficiary'
  },
  {
    nombre: 'Maria',
    apellidos: 'Soto Aguilar',
    curp: 'SOAM010910MSPSGR03',
    email: 'maria.soto@example.com',
    telefono: '4885551122',
    municipio: 'Matehuala',
    password: getSeedPassword('SEED_READER2_PASSWORD', 'Password789!'),
    role: 'reader'
  },
  {
    nombre: 'Scanner',
    apellidos: 'Operador',
    curp: 'SCAN010101HSPNPR01',
    email: 'scanner@tj.local',
    telefono: null,
    municipio: 'San Luis Potosí',
    password: getSeedPassword('SEED_SCANNER_PASSWORD', 'Scan1234!'),
    role: 'scanner'
  },
  ...DEVICE_TEST_FIXTURES.map((fixture) => fixture.user)
];

const CARDHOLDERS = [
  {
    curp: 'HERL020101MSPNRZ01',
    nombres: 'Ana',
    apellidos: 'Hernandez Ruiz',
    municipio: 'San Luis Potosí',
    tarjeta: 'TJ-0001',
    status: 'active',
    linkToUserEmail: 'ana.hernandez@example.com'
  },
  {
    curp: 'LOMC990505HSPLPM02',
    nombres: 'Carlos',
    apellidos: 'Lopez Mendez',
    municipio: 'Ciudad Valles',
    tarjeta: 'TJ-0002',
    status: 'active',
    linkToUserEmail: 'carlos.lopez@example.com'
  },
  {
    curp: 'MELR000202MSPSRD06',
    nombres: 'Melissa',
    apellidos: 'Rios Delgado',
    municipio: 'Soledad de Graciano Sánchez',
    tarjeta: 'TJ-0080',
    status: 'active'
  },
  {
    curp: 'SAQP950101HSPQRP07',
    nombres: 'Santiago',
    apellidos: 'Quintero Perez',
    municipio: 'San Luis Potosí',
    tarjeta: 'TJ-0099',
    status: 'inactive'
  },
  ...DEVICE_TEST_FIXTURES.map((fixture) => fixture.cardholder)
];

const SOLICITUDES = [
  {
    nombres: 'Fernanda',
    apellidos: 'Salas Quiroz',
    fechaNacimiento: '2003-04-15',
    curp: 'SAQF030415MSPSLQ04',
    username: 'fernanda.salas@example.com',
    colonia: 'Zona Centro',
    municipio: 'San Luis Potosí',
    calle: 'Av. Himno Nacional',
    numero: '1204',
    cp: '78280',
    password: getSeedPassword('SEED_SOLICITUD_1_PASSWORD', 'Temporal123!'),
    status: 'pending',
    aceptaTerminos: true,
    docIne: 'fernanda-ine.pdf',
    docComprobante: 'fernanda-comprobante.pdf',
    docCurp: 'fernanda-curp.pdf'
  },
  {
    nombres: 'Luis',
    apellidos: 'Camacho Torres',
    fechaNacimiento: '2002-11-02',
    curp: 'CATL021102HSPCMT05',
    username: 'luis.camacho@example.com',
    colonia: 'Centro',
    municipio: 'Ciudad Valles',
    calle: 'Calle 10',
    numero: '543B',
    cp: '79000',
    password: getSeedPassword('SEED_SOLICITUD_2_PASSWORD', 'Temporal456!'),
    status: 'approved',
    aceptaTerminos: true,
    docIne: 'luis-ine.png',
    docComprobante: 'luis-comprobante.png',
    docCurp: 'luis-curp.png'
  }
];

async function ensureSchema(pool) {
  const ddlStatements = [
    `CREATE TABLE IF NOT EXISTS municipios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(120) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS categorias (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(120) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS usuarios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(120) NULL,
      apellidos VARCHAR(150) NULL,
      curp VARCHAR(20) NULL UNIQUE,
      email VARCHAR(150) NOT NULL UNIQUE,
      telefono VARCHAR(20),
      municipio_id INT,
      password_hash VARCHAR(255) NULL,
      role ENUM('admin','reader','scanner','beneficiary') NOT NULL DEFAULT 'beneficiary',
      creditos INT NOT NULL DEFAULT 0,
      foto_url VARCHAR(255),
      portada_url VARCHAR(255),
      auth0_user_id VARCHAR(191) UNIQUE NULL,
      cardholder_sync_id INT NULL,
      status ENUM('pending','active','blocked') NOT NULL DEFAULT 'active',
      session_version INT NOT NULL DEFAULT 0,
      last_login_at DATETIME NULL,
      last_failed_login_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (municipio_id) REFERENCES municipios(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS cardholders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      curp VARCHAR(20) NOT NULL UNIQUE,
      nombres VARCHAR(120) NOT NULL,
      apellidos VARCHAR(150) NOT NULL,
      municipio_id INT,
      tarjeta_numero VARCHAR(50),
      status ENUM('active','inactive','blocked') DEFAULT 'active',
      lookup_attempts INT DEFAULT 0,
      last_lookup_attempt_at DATETIME NULL,
      lookup_blocked_until DATETIME NULL,
      pending_account_until DATETIME NULL,
      account_user_id INT UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (municipio_id) REFERENCES municipios(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
      FOREIGN KEY (account_user_id) REFERENCES usuarios(id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS beneficios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(160) NOT NULL,
      descripcion TEXT,
      categoria_id INT,
      municipio_id INT,
      descuento VARCHAR(80),
      direccion VARCHAR(200),
      horario VARCHAR(120),
      lat DECIMAL(10,8),
      lng DECIMAL(11,8),
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      is_visible_to_beneficiary TINYINT(1) NOT NULL DEFAULT 1,
      published_at DATETIME NULL,
      headline VARCHAR(160) NULL,
      summary VARCHAR(255) NULL,
      image_url VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_beneficios_nombre (nombre),
      FOREIGN KEY (categoria_id) REFERENCES categorias(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
      FOREIGN KEY (municipio_id) REFERENCES municipios(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS cardholder_audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      cardholder_id INT NOT NULL,
      action ENUM('lookup','account_created') NOT NULL,
      ip_address VARCHAR(45),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cardholder_id) REFERENCES cardholders(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS cardholders_sync (
      id INT AUTO_INCREMENT PRIMARY KEY,
      curp_hash CHAR(64) NOT NULL UNIQUE,
      curp_masked VARCHAR(20) NOT NULL,
      tarjeta_numero VARCHAR(50) NOT NULL UNIQUE,
      status ENUM('active','inactive','blocked') NOT NULL DEFAULT 'active',
      sync_source VARCHAR(120),
      synced_at DATETIME NOT NULL,
      account_user_id INT UNIQUE NULL,
      auth0_user_id VARCHAR(191) UNIQUE NULL,
      activation_verified_until DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (account_user_id) REFERENCES usuarios(id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS beneficiario_staging (
      id INT AUTO_INCREMENT PRIMARY KEY,
      external_request_id VARCHAR(120) NOT NULL UNIQUE,
      curp_hash CHAR(64) NOT NULL,
      curp_masked VARCHAR(20) NOT NULL,
      payload_ciphertext LONGTEXT NOT NULL,
      payload_iv VARCHAR(64) NOT NULL,
      payload_tag VARCHAR(64) NOT NULL,
      status ENUM('pending','sent','accepted','rejected','error') NOT NULL DEFAULT 'pending',
      submitted_by_system VARCHAR(120) NOT NULL,
      submitted_at DATETIME NOT NULL,
      sent_at DATETIME NULL,
      resolved_at DATETIME NULL,
      sys_ipj_response_code INT NULL,
      error_message TEXT NULL,
      locked_at DATETIME NULL,
      locked_by VARCHAR(120) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_beneficiario_staging_curp_hash (curp_hash),
      INDEX idx_beneficiario_staging_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS sync_audit_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      direction ENUM('SYS_IPJ_TO_API_TJ','API_TJ_TO_SYS_IPJ') NOT NULL,
      executed_by VARCHAR(120),
      request_count INT NOT NULL DEFAULT 0,
      inserted_count INT NOT NULL DEFAULT 0,
      updated_count INT NOT NULL DEFAULT 0,
      skipped_count INT NOT NULL DEFAULT 0,
      conflict_count INT NOT NULL DEFAULT 0,
      status ENUM('success','partial','failed') NOT NULL,
      request_checksum CHAR(64),
      started_at DATETIME NOT NULL,
      finished_at DATETIME NOT NULL,
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS service_clients (
      id INT AUTO_INCREMENT PRIMARY KEY,
      client_code VARCHAR(80) NOT NULL UNIQUE,
      name VARCHAR(160) NOT NULL,
      status ENUM('active','inactive','blocked') NOT NULL DEFAULT 'active',
      allowed_scopes JSON NOT NULL,
      ip_allowlist JSON NULL,
      key_id_current VARCHAR(120) NULL,
      last_used_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS service_client_keys (
      id INT AUTO_INCREMENT PRIMARY KEY,
      client_id INT NOT NULL,
      kid VARCHAR(120) NOT NULL UNIQUE,
      public_key TEXT NOT NULL,
      status ENUM('active','inactive','revoked') NOT NULL DEFAULT 'active',
      valid_from DATETIME NULL,
      valid_until DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES service_clients(id)
        ON DELETE CASCADE,
      INDEX idx_service_client_keys_client (client_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS integration_jti_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      client_id INT NOT NULL,
      jti VARCHAR(191) NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_integration_jti_client (client_id, jti),
      FOREIGN KEY (client_id) REFERENCES service_clients(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS integration_audit_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      client_id INT NULL,
      client_code VARCHAR(80) NULL,
      method VARCHAR(12) NOT NULL,
      path VARCHAR(255) NOT NULL,
      required_scope VARCHAR(120) NULL,
      ip_address VARCHAR(45) NULL,
      status_code INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_integration_audit_client_created (client_code, created_at),
      FOREIGN KEY (client_id) REFERENCES service_clients(id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS admin_activity_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      actor_user_id INT NULL,
      actor_email VARCHAR(150) NULL,
      entity_type VARCHAR(80) NOT NULL,
      entity_id VARCHAR(120) NOT NULL,
      action VARCHAR(80) NOT NULL,
      ip_address VARCHAR(45) NULL,
      payload JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_admin_activity_created (created_at),
      INDEX idx_admin_activity_entity (entity_type, entity_id),
      FOREIGN KEY (actor_user_id) REFERENCES usuarios(id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS staging_push_attempts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      staging_id INT NOT NULL,
      external_request_id VARCHAR(120) NOT NULL,
      actor VARCHAR(120),
      request_checksum CHAR(64),
      response_status INT,
      status ENUM('accepted','rejected','error') NOT NULL,
      error_message TEXT,
      attempted_at DATETIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (staging_id) REFERENCES beneficiario_staging(id)
        ON DELETE CASCADE,
      INDEX idx_staging_push_attempts_staging (staging_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS solicitudes_registro (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombres VARCHAR(120) NOT NULL,
      apellidos VARCHAR(150) NOT NULL,
      fecha_nacimiento DATE NOT NULL,
      curp VARCHAR(20) NOT NULL UNIQUE,
      username VARCHAR(150) DEFAULT NULL,
      calle VARCHAR(150) DEFAULT NULL,
      numero VARCHAR(20) DEFAULT NULL,
      cp CHAR(5) DEFAULT NULL,
      colonia VARCHAR(150),
      municipio_id INT,
      password_hash VARCHAR(255) NOT NULL,
      status ENUM('pending','approved','rejected') DEFAULT 'pending',
      acepta_terminos TINYINT(1) DEFAULT 0,
      doc_ine VARCHAR(255),
      doc_comprobante VARCHAR(255),
      doc_curp VARCHAR(255),
      folio VARCHAR(20),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (municipio_id) REFERENCES municipios(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS beneficiarios_sync_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      solicitud_id INT,
      curp VARCHAR(20) NOT NULL,
      payload JSON NOT NULL,
      status ENUM('sent','failed','rejected','skipped') NOT NULL,
      response_status INT,
      total_count INT,
      inserted_count INT,
      rejected_count INT,
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (solicitud_id) REFERENCES solicitudes_registro(id)
        ON DELETE SET NULL,
      INDEX idx_beneficiarios_sync_curp (curp)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      refresh_token CHAR(64) NOT NULL UNIQUE,
      expiry_date DATETIME NOT NULL,
      revoked_at DATETIME NULL,
      rotated_from INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      token_hash CHAR(64) NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      consumed_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS otp_codes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      curp VARCHAR(20) NOT NULL,
      code VARCHAR(10) NOT NULL,
      expiry_date DATETIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_otp_codes_curp (curp)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS user_qr_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token_value VARCHAR(64) NOT NULL,
      token_hash CHAR(64) NOT NULL,
      status ENUM('active','rotated','revoked') NOT NULL DEFAULT 'active',
      valid_from DATE NOT NULL,
      valid_until DATE NOT NULL,
      last_used_at DATETIME NULL,
      revoked_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_qr_token_hash (token_hash),
      UNIQUE KEY uq_user_qr_token_month (user_id, valid_from),
      FOREIGN KEY (user_id) REFERENCES usuarios(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS coin_daily_awards (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      award_date DATE NOT NULL,
      scanner_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_coin_daily_user (user_id, award_date),
      FOREIGN KEY (user_id) REFERENCES usuarios(id)
        ON DELETE CASCADE,
      FOREIGN KEY (scanner_id) REFERENCES usuarios(id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS coin_transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      delta INT NOT NULL,
      type ENUM('scan_reward') NOT NULL,
      scanner_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES usuarios(id)
        ON DELETE CASCADE,
      FOREIGN KEY (scanner_id) REFERENCES usuarios(id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  ];

  for (const sql of ddlStatements) {
    await pool.query(sql);
  }

  const [[{ dbName }]] = await pool.query('SELECT DATABASE() AS dbName');
  await ensureUsuariosColumns(pool, dbName);
  await ensureRefreshTokenColumns(pool, dbName);
  await relaxUsuariosForAuth0(pool, dbName);
  await ensureUsuariosRoleEnum(pool, dbName);
  await migrateBeneficiaryRoles(pool);
  await ensureSolicitudesColumns(pool, dbName);
  await ensureNewPatchColumns(pool, dbName);
}

async function ensureColumn(pool, dbName, table, column, definition) {
  const [existing] = await pool.execute(
    `SELECT 1
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [dbName, table, column]
  );
  if (existing.length === 0) {
    await pool.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function ensureSolicitudesColumns(pool, dbName) {
  await ensureColumn(pool, dbName, 'solicitudes_registro', 'username', 'VARCHAR(150) DEFAULT NULL AFTER curp');
  await ensureColumn(pool, dbName, 'solicitudes_registro', 'calle', 'VARCHAR(150) DEFAULT NULL AFTER username');
  await ensureColumn(pool, dbName, 'solicitudes_registro', 'numero', 'VARCHAR(20) DEFAULT NULL AFTER calle');
  await ensureColumn(pool, dbName, 'solicitudes_registro', 'cp', 'CHAR(5) DEFAULT NULL AFTER numero');
  await ensureColumn(pool, dbName, 'solicitudes_registro', 'acepta_terminos', 'TINYINT(1) DEFAULT 0 AFTER status');
  await ensureColumn(pool, dbName, 'solicitudes_registro', 'folio', 'VARCHAR(20) DEFAULT NULL AFTER doc_curp');
}

async function ensureUsuariosColumns(pool, dbName) {
  await ensureColumn(
    pool,
    dbName,
    'usuarios',
    'role',
    "ENUM('admin','reader','scanner','beneficiary') NOT NULL DEFAULT 'beneficiary'"
  );
  await ensureColumn(pool, dbName, 'usuarios', 'creditos', 'INT NOT NULL DEFAULT 0');
  await ensureColumn(pool, dbName, 'usuarios', 'foto_url', 'VARCHAR(255) NULL');
  await ensureColumn(pool, dbName, 'usuarios', 'portada_url', 'VARCHAR(255) NULL');
  await ensureColumn(pool, dbName, 'usuarios', 'auth0_user_id', 'VARCHAR(191) UNIQUE NULL');
  await ensureColumn(pool, dbName, 'usuarios', 'cardholder_sync_id', 'INT NULL');
  await ensureColumn(
    pool,
    dbName,
    'usuarios',
    'status',
    "ENUM('pending','active','blocked') NOT NULL DEFAULT 'active'"
  );
  await ensureColumn(
    pool,
    dbName,
    'usuarios',
    'updated_at',
    'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
  );
  await ensureColumn(pool, dbName, 'usuarios', 'session_version', 'INT NOT NULL DEFAULT 0');
  await ensureColumn(pool, dbName, 'usuarios', 'last_login_at', 'DATETIME NULL');
  await ensureColumn(pool, dbName, 'usuarios', 'last_failed_login_at', 'DATETIME NULL');
}

async function ensureRefreshTokenColumns(pool, dbName) {
  await ensureColumn(pool, dbName, 'refresh_tokens', 'revoked_at', 'DATETIME NULL');
  await ensureColumn(pool, dbName, 'refresh_tokens', 'rotated_from', 'INT NULL');
}

async function relaxUsuariosForAuth0(pool, dbName) {
  const [rows] = await pool.execute(
    `SELECT COLUMN_NAME, IS_NULLABLE
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'usuarios'
       AND COLUMN_NAME IN ('nombre','apellidos','curp','password_hash')`,
    [dbName]
  );
  const nullable = rows.reduce((acc, row) => {
    acc[row.COLUMN_NAME] = row.IS_NULLABLE === 'YES';
    return acc;
  }, {});
  if (!nullable.nombre) {
    await pool.execute('ALTER TABLE usuarios MODIFY COLUMN nombre VARCHAR(120) NULL');
  }
  if (!nullable.apellidos) {
    await pool.execute('ALTER TABLE usuarios MODIFY COLUMN apellidos VARCHAR(150) NULL');
  }
  if (!nullable.curp) {
    await pool.execute('ALTER TABLE usuarios MODIFY COLUMN curp VARCHAR(20) NULL');
  }
  if (!nullable.password_hash) {
    await pool.execute('ALTER TABLE usuarios MODIFY COLUMN password_hash VARCHAR(255) NULL');
  }
}

async function ensureNewPatchColumns(pool, dbName) {
  await ensureColumn(pool, dbName, 'beneficiario_staging', 'locked_at', 'DATETIME NULL');
  await ensureColumn(pool, dbName, 'beneficiario_staging', 'locked_by', 'VARCHAR(120) NULL');
  await ensureColumn(
    pool,
    dbName,
    'cardholders_sync',
    'activation_verified_until',
    'DATETIME NULL'
  );
  await ensureColumn(pool, dbName, 'beneficios', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1');
  await ensureColumn(
    pool,
    dbName,
    'beneficios',
    'is_visible_to_beneficiary',
    'TINYINT(1) NOT NULL DEFAULT 1'
  );
  await ensureColumn(pool, dbName, 'beneficios', 'published_at', 'DATETIME NULL');
  await ensureColumn(pool, dbName, 'beneficios', 'headline', 'VARCHAR(160) NULL');
  await ensureColumn(pool, dbName, 'beneficios', 'summary', 'VARCHAR(255) NULL');
  await ensureColumn(pool, dbName, 'beneficios', 'image_url', 'VARCHAR(255) NULL');
}

async function backfillBeneficiosPublicationFields(pool) {
  await pool.execute(
    `UPDATE beneficios
     SET is_active = COALESCE(is_active, 1),
         is_visible_to_beneficiary = COALESCE(is_visible_to_beneficiary, 1)`
  );
  await pool.execute(
    `UPDATE beneficios
     SET published_at = created_at
     WHERE published_at IS NULL`
  );
}

async function ensureUsuariosRoleEnum(pool, dbName) {
  const [rows] = await pool.execute(
    `SELECT COLUMN_TYPE
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'role'
     LIMIT 1`,
    [dbName]
  );
  if (rows.length === 0) {
    return;
  }
  const columnType = String(rows[0].COLUMN_TYPE || '');
  if (!columnType.includes('scanner') || !columnType.includes('beneficiary')) {
    await pool.execute(
      "ALTER TABLE usuarios MODIFY COLUMN role ENUM('admin','reader','scanner','beneficiary') NOT NULL DEFAULT 'beneficiary'"
    );
  }
}

async function migrateBeneficiaryRoles(pool) {
  await pool.execute(
    `UPDATE usuarios
     SET role = 'beneficiary'
     WHERE role = 'reader'
       AND cardholder_sync_id IS NOT NULL`
  );
}

async function seedMunicipios(pool) {
  for (const nombre of MUNICIPIOS) {
    await pool.execute(
      `INSERT INTO municipios (nombre)
       VALUES (?)
       ON DUPLICATE KEY UPDATE nombre = VALUES(nombre)`,
      [nombre]
    );
  }
  const [rows] = await pool.query('SELECT id, nombre FROM municipios');
  return rows.reduce((acc, row) => {
    acc[row.nombre] = row.id;
    return acc;
  }, {});
}

async function seedCardholders(pool, municipioMap) {
  for (const holder of CARDHOLDERS) {
    const municipioId = municipioMap[holder.municipio] || null;
    await pool.execute(
      `INSERT INTO cardholders
        (curp, nombres, apellidos, municipio_id, tarjeta_numero, status)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        nombres = VALUES(nombres),
        apellidos = VALUES(apellidos),
        municipio_id = VALUES(municipio_id),
        tarjeta_numero = VALUES(tarjeta_numero),
        status = VALUES(status)`,
      [
        holder.curp,
        holder.nombres,
        holder.apellidos,
        municipioId,
        holder.tarjeta || null,
        holder.status || 'active'
      ]
    );
  }
  const [rows] = await pool.query('SELECT id, curp FROM cardholders');
  return rows.reduce((acc, row) => {
    acc[row.curp] = row.id;
    return acc;
  }, {});
}

async function seedCardholdersSync(pool, userMap) {
  for (const holder of CARDHOLDERS) {
    const { curpHash, curpMasked } = buildCurpLookup(holder.curp);
    const userId =
      (holder.linkToUserEmail && userMap.byEmail[holder.linkToUserEmail]) ||
      (holder.linkToUserCurp && userMap.byCurp[holder.linkToUserCurp]) ||
      null;
    await pool.execute(
      `INSERT INTO cardholders_sync
        (curp_hash, curp_masked, tarjeta_numero, status, sync_source, synced_at, account_user_id)
       VALUES (?, ?, ?, ?, 'seed-backfill', ?, ?)
       ON DUPLICATE KEY UPDATE
        curp_masked = VALUES(curp_masked),
        tarjeta_numero = VALUES(tarjeta_numero),
        status = VALUES(status),
        sync_source = VALUES(sync_source),
        synced_at = VALUES(synced_at),
        account_user_id = COALESCE(cardholders_sync.account_user_id, VALUES(account_user_id))`,
      [
        curpHash,
        curpMasked,
        holder.tarjeta || null,
        holder.status || 'active',
        new Date(),
        userId
      ]
    );
  }
}

async function syncUsuariosCardholderSyncIds(pool) {
  await pool.execute(
    `UPDATE usuarios u
     JOIN cardholders_sync cs ON cs.account_user_id = u.id
     SET u.cardholder_sync_id = cs.id
     WHERE u.cardholder_sync_id IS NULL`
  );
}

async function seedServiceClients(pool) {
  const clients = [
    {
      clientCode: 'sys_ipj',
      name: 'Sys_IPJ',
      scopes: ['cardholders.sync'],
      kid: 'sys_ipj-current',
      publicKey: process.env.SYS_IPJ_JWT_PUBLIC_KEY || ''
    },
    {
      clientCode: 'unidad_informatica',
      name: 'Unidad de Informatica',
      scopes: ['cardholders.lookup', 'beneficiarios.staging.create'],
      kid: 'unidad_informatica-current',
      publicKey: process.env.INFORMATICA_JWT_PUBLIC_KEY || ''
    }
  ];

  for (const client of clients) {
    await pool.execute(
      `INSERT INTO service_clients
        (client_code, name, status, allowed_scopes, ip_allowlist, key_id_current)
       VALUES (?, ?, 'active', ?, JSON_ARRAY(), ?)
       ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        allowed_scopes = VALUES(allowed_scopes),
        key_id_current = VALUES(key_id_current)`,
      [client.clientCode, client.name, JSON.stringify(client.scopes), client.kid]
    );

    if (client.publicKey) {
      const [rows] = await pool.execute(
        'SELECT id FROM service_clients WHERE client_code = ? LIMIT 1',
        [client.clientCode]
      );
      await pool.execute(
        `INSERT INTO service_client_keys
          (client_id, kid, public_key, status, valid_from)
         VALUES (?, ?, ?, 'active', ?)
         ON DUPLICATE KEY UPDATE
          public_key = VALUES(public_key),
          status = 'active',
          valid_from = VALUES(valid_from)`,
        [rows[0].id, client.kid, client.publicKey, new Date()]
      );
    }
  }
}

async function seedCategorias(pool) {
  for (const nombre of CATEGORIAS) {
    await pool.execute(
      `INSERT INTO categorias (nombre)
       VALUES (?)
       ON DUPLICATE KEY UPDATE nombre = VALUES(nombre)`,
      [nombre]
    );
  }
  const [rows] = await pool.query('SELECT id, nombre FROM categorias');
  return rows.reduce((acc, row) => {
    acc[row.nombre] = row.id;
    return acc;
  }, {});
}

async function seedBeneficios(pool, categoriaMap, municipioMap) {
  for (const beneficio of BENEFICIOS) {
    const categoriaId = categoriaMap[beneficio.categoria] || null;
    const municipioId = municipioMap[beneficio.municipio] || null;
    await pool.execute(
      `INSERT INTO beneficios
        (nombre, descripcion, categoria_id, municipio_id, descuento, direccion, horario, lat, lng,
         is_active, is_visible_to_beneficiary, published_at, headline, summary, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        descripcion = VALUES(descripcion),
        categoria_id = VALUES(categoria_id),
        municipio_id = VALUES(municipio_id),
        descuento = VALUES(descuento),
        direccion = VALUES(direccion),
        horario = VALUES(horario),
        lat = VALUES(lat),
        lng = VALUES(lng),
        is_active = VALUES(is_active),
        is_visible_to_beneficiary = VALUES(is_visible_to_beneficiary),
        published_at = VALUES(published_at),
        headline = VALUES(headline),
        summary = VALUES(summary),
        image_url = VALUES(image_url)`,
      [
        beneficio.nombre,
        beneficio.descripcion,
        categoriaId,
        municipioId,
        beneficio.descuento,
        beneficio.direccion,
        beneficio.horario,
        beneficio.lat,
        beneficio.lng,
        beneficio.isActive ? 1 : 0,
        beneficio.isVisibleToBeneficiary ? 1 : 0,
        beneficio.publishedAt ? new Date(beneficio.publishedAt) : new Date(),
        beneficio.headline || null,
        beneficio.summary || null,
        beneficio.imageUrl || null
      ]
    );
  }
}

async function seedUsuarios(pool, municipioMap) {
  for (const usuario of USUARIOS) {
    const passwordHash = await hashPassword(usuario.password);
    const municipioId = municipioMap[usuario.municipio] || null;
    await pool.execute(
      `INSERT INTO usuarios
        (nombre, apellidos, curp, email, telefono, municipio_id, password_hash, role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        nombre = VALUES(nombre),
        apellidos = VALUES(apellidos),
        telefono = VALUES(telefono),
        municipio_id = VALUES(municipio_id),
        password_hash = VALUES(password_hash),
        role = VALUES(role)`,
      [
        usuario.nombre,
        usuario.apellidos,
        usuario.curp,
        usuario.email,
        usuario.telefono,
        municipioId,
        passwordHash,
        usuario.role || 'reader'
      ]
    );
  }
  const [rows] = await pool.query('SELECT id, email, curp FROM usuarios');
  const byEmail = {};
  const byCurp = {};
  for (const row of rows) {
    if (row.email) {
      byEmail[row.email] = row.id;
    }
    if (row.curp) {
      byCurp[row.curp] = row.id;
    }
  }
  return { byEmail, byCurp };
}

async function linkCardholdersToUsers(pool, cardholderMap, userMap) {
  for (const holder of CARDHOLDERS) {
    if (!holder.linkToUserEmail && !holder.linkToUserCurp) {
      continue;
    }
    const cardholderId = cardholderMap[holder.curp];
    const userId =
      (holder.linkToUserEmail && userMap.byEmail[holder.linkToUserEmail]) ||
      (holder.linkToUserCurp && userMap.byCurp[holder.linkToUserCurp]) ||
      userMap.byCurp[holder.curp];
    if (cardholderId && userId) {
      await pool.execute(
        `UPDATE cardholders
         SET account_user_id = NULL
         WHERE account_user_id = ? AND id <> ?`,
        [userId, cardholderId]
      );
      await pool.execute(
        `UPDATE cardholders
         SET account_user_id = ?
         WHERE id = ?`,
        [userId, cardholderId]
      );
    }
  }
}

async function seedSolicitudes(pool, municipioMap) {
  for (const solicitud of SOLICITUDES) {
    const passwordHash = await hashPassword(solicitud.password);
    const municipioId = municipioMap[solicitud.municipio] || null;
    await pool.execute(
      `INSERT INTO solicitudes_registro
        (nombres, apellidos, fecha_nacimiento, curp, username, calle, numero, cp, colonia, municipio_id, password_hash, status, acepta_terminos, doc_ine, doc_comprobante, doc_curp, folio)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        username = VALUES(username),
        calle = VALUES(calle),
        numero = VALUES(numero),
        cp = VALUES(cp),
        colonia = VALUES(colonia),
        municipio_id = VALUES(municipio_id),
        status = VALUES(status),
        acepta_terminos = VALUES(acepta_terminos),
        doc_ine = VALUES(doc_ine),
        doc_comprobante = VALUES(doc_comprobante),
        doc_curp = VALUES(doc_curp),
        password_hash = VALUES(password_hash),
        folio = VALUES(folio)`,
      [
        solicitud.nombres,
        solicitud.apellidos,
        solicitud.fechaNacimiento,
        solicitud.curp,
        solicitud.username || null,
        solicitud.calle || null,
        solicitud.numero || null,
        solicitud.cp || null,
        solicitud.colonia,
        municipioId,
        passwordHash,
        solicitud.status,
        solicitud.aceptaTerminos ? 1 : 0,
        solicitud.docIne,
        solicitud.docComprobante,
        solicitud.docCurp,
        solicitud.folio || null
      ]
    );
  }
}

async function main() {
  if (NODE_ENV === 'production' && !ALLOW_PROD_SEED) {
    throw new Error(
      'Seed deshabilitado en produccion. Define ALLOW_PROD_SEED=true para forzarlo.'
    );
  }
  const pool = mysql.createPool(getDbConfig());
  console.log('Iniciando seed de datos...');
  try {
    await ensureSchema(pool);
    console.log('Esquema verificado.');
    await backfillBeneficiosPublicationFields(pool);
    console.log('Beneficios historicos normalizados.');

    const municipioMap = await seedMunicipios(pool);
    console.log('Municipios listos.');

    const cardholderMap = await seedCardholders(pool, municipioMap);
    console.log('Cardholders listos.');

    const categoriaMap = await seedCategorias(pool);
    console.log('Categorias listas.');

    await seedBeneficios(pool, categoriaMap, municipioMap);
    console.log('Beneficios listos.');

    const userMap = await seedUsuarios(pool, municipioMap);
    console.log('Usuarios listos.');

    await linkCardholdersToUsers(pool, cardholderMap, userMap);
    console.log('Cardholders asociados a usuarios.');

    await seedCardholdersSync(pool, userMap);
    await syncUsuariosCardholderSyncIds(pool);
    console.log('Padron sincronizado de ejemplo listo.');

    await seedServiceClients(pool);
    console.log('Clientes de integracion listos.');

    await seedSolicitudes(pool, municipioMap);
    console.log('Solicitudes de registro listas.');

    console.log('Seed completado con exito.');
  } catch (error) {
    console.error('Error durante el seed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

module.exports = { ensureSchema, getDbConfig };

if (require.main === module) {
  main();
}

