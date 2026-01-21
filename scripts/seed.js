/* eslint-disable no-console */
require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

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

const MUNICIPIOS = ['Tijuana', 'Mexicali', 'Ensenada', 'Tecate'];
const CATEGORIAS = ['Restaurantes', 'Salud', 'Tecnologia', 'Entretenimiento', 'Educacion'];

const BENEFICIOS = [
  {
    nombre: 'Cafe Frontera',
    categoria: 'Restaurantes',
    municipio: 'Tijuana',
    descuento: '20% en consumo presentando la tarjeta',
    direccion: 'Av. Revolucion 123, Zona Centro',
    horario: 'L-D 08:00 - 22:00',
    descripcion: 'Coffee shop local con descuentos especiales para estudiantes.',
    lat: 32.52151,
    lng: -117.02454
  },
  {
    nombre: 'Gimnasio Vitalia',
    categoria: 'Salud',
    municipio: 'Mexicali',
    descuento: 'Inscripcion gratis + 15% mensualidad',
    direccion: 'Calz. Cetys 456, Col. Alameda',
    horario: 'L-S 06:00 - 23:00',
    descripcion: 'Gimnasio con entrenamiento funcional y clases grupales.',
    lat: 32.62498,
    lng: -115.45226
  },
  {
    nombre: 'Cine Pacifico',
    categoria: 'Entretenimiento',
    municipio: 'Ensenada',
    descuento: '2x1 en taquilla martes y jueves',
    direccion: 'Blvd. Costero 789, Zona Centro',
    horario: 'L-D 12:00 - 23:59',
    descripcion: 'Cadena local de cines con estrenos y funciones especiales.',
    lat: 31.86021,
    lng: -116.60573
  },
  {
    nombre: 'Coding Lab BC',
    categoria: 'Tecnologia',
    municipio: 'Tijuana',
    descuento: 'Beca del 30% en cursos intensivos',
    direccion: 'Av. Innovacion 321, Col. Chapultepec',
    horario: 'L-V 09:00 - 19:00',
    descripcion: 'Aceleradora de talento digital con programas de programacion.',
    lat: 32.49283,
    lng: -116.99911
  }
];

const USUARIOS = [
  {
    nombre: 'Ana',
    apellidos: 'Hernandez Ruiz',
    curp: 'HERL020101MBCNRZ01',
    email: 'ana.hernandez@example.com',
    telefono: '6641234567',
    municipio: 'Tijuana',
    password: getSeedPassword('SEED_ADMIN_PASSWORD', 'Test1234!'),
    role: 'admin'
  },
  {
    nombre: 'Carlos',
    apellidos: 'Lopez Mendez',
    curp: 'LOMC990505HBCLPM02',
    email: 'carlos.lopez@example.com',
    telefono: '6869876543',
    municipio: 'Mexicali',
    password: getSeedPassword('SEED_READER1_PASSWORD', 'Secret456!'),
    role: 'reader'
  },
  {
    nombre: 'Maria',
    apellidos: 'Soto Aguilar',
    curp: 'SOAM010910MBCSGR03',
    email: 'maria.soto@example.com',
    telefono: '6465551122',
    municipio: 'Ensenada',
    password: getSeedPassword('SEED_READER2_PASSWORD', 'Password789!'),
    role: 'reader'
  },
  {
    nombre: 'Scanner',
    apellidos: 'Operador',
    curp: 'SCAN010101HBCNPR01',
    email: 'scanner@tj.local',
    telefono: null,
    municipio: 'Tijuana',
    password: getSeedPassword('SEED_SCANNER_PASSWORD', 'Scan1234!'),
    role: 'scanner'
  }
];

const CARDHOLDERS = [
  {
    curp: 'HERL020101MBCNRZ01',
    nombres: 'Ana',
    apellidos: 'Hernandez Ruiz',
    municipio: 'Tijuana',
    tarjeta: 'TJ-0001',
    status: 'active',
    linkToUserEmail: 'ana.hernandez@example.com'
  },
  {
    curp: 'LOMC990505HBCLPM02',
    nombres: 'Carlos',
    apellidos: 'Lopez Mendez',
    municipio: 'Mexicali',
    tarjeta: 'TJ-0002',
    status: 'active',
    linkToUserEmail: 'carlos.lopez@example.com'
  },
  {
    curp: 'MELR000202MBCSRD06',
    nombres: 'Melissa',
    apellidos: 'Rios Delgado',
    municipio: 'Tecate',
    tarjeta: 'TJ-0080',
    status: 'active'
  },
  {
    curp: 'SAQP950101HBCQRP07',
    nombres: 'Santiago',
    apellidos: 'Quintero Perez',
    municipio: 'Tijuana',
    tarjeta: 'TJ-0099',
    status: 'inactive'
  }
];

const SOLICITUDES = [
  {
    nombres: 'Fernanda',
    apellidos: 'Salas Quiroz',
    fechaNacimiento: '2003-04-15',
    curp: 'SAQF030415MBCSLQ04',
    username: 'fernanda.salas@example.com',
    colonia: 'Zona Centro',
    municipio: 'Tijuana',
    calle: 'Av. Hidalgo',
    numero: '1204',
    cp: '22000',
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
    curp: 'CATL021102HBCCMT05',
    username: 'luis.camacho@example.com',
    colonia: 'Col. Libertad',
    municipio: 'Mexicali',
    calle: 'Calle 10',
    numero: '543B',
    cp: '21010',
    password: getSeedPassword('SEED_SOLICITUD_2_PASSWORD', 'Temporal456!'),
    status: 'approved',
    aceptaTerminos: true,
    docIne: 'luis-ine.png',
    docComprobante: 'luis-comprobante.png',
    docCurp: 'luis-curp.png'
  }
];

const SALT_ROUNDS = 10;

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
      connectionLimit: 10
    };
  }
  return {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'tarjeta_joven',
    waitForConnections: true,
    connectionLimit: 10
  };
}

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
      nombre VARCHAR(120) NOT NULL,
      apellidos VARCHAR(150) NOT NULL,
      curp VARCHAR(20) NOT NULL UNIQUE,
      email VARCHAR(150) NOT NULL UNIQUE,
      telefono VARCHAR(20),
      municipio_id INT,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin','reader','scanner') NOT NULL DEFAULT 'reader',
      creditos INT NOT NULL DEFAULT 0,
      foto_url VARCHAR(255),
      portada_url VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
      refresh_token VARCHAR(255) NOT NULL UNIQUE,
      expiry_date DATETIME NOT NULL,
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
  await ensureUsuariosRoleEnum(pool, dbName);
  await ensureSolicitudesColumns(pool, dbName);
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
    "ENUM('admin','reader','scanner') NOT NULL DEFAULT 'reader'"
  );
  await ensureColumn(pool, dbName, 'usuarios', 'creditos', 'INT NOT NULL DEFAULT 0');
  await ensureColumn(pool, dbName, 'usuarios', 'foto_url', 'VARCHAR(255) NULL');
  await ensureColumn(pool, dbName, 'usuarios', 'portada_url', 'VARCHAR(255) NULL');
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
  if (!columnType.includes('scanner')) {
    await pool.execute(
      "ALTER TABLE usuarios MODIFY COLUMN role ENUM('admin','reader','scanner') NOT NULL DEFAULT 'reader'"
    );
  }
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
        (nombre, descripcion, categoria_id, municipio_id, descuento, direccion, horario, lat, lng)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        descripcion = VALUES(descripcion),
        categoria_id = VALUES(categoria_id),
        municipio_id = VALUES(municipio_id),
        descuento = VALUES(descuento),
        direccion = VALUES(direccion),
        horario = VALUES(horario),
        lat = VALUES(lat),
        lng = VALUES(lng)`,
      [
        beneficio.nombre,
        beneficio.descripcion,
        categoriaId,
        municipioId,
        beneficio.descuento,
        beneficio.direccion,
        beneficio.horario,
        beneficio.lat,
        beneficio.lng
      ]
    );
  }
}

async function seedUsuarios(pool, municipioMap) {
  for (const usuario of USUARIOS) {
    const passwordHash = await bcrypt.hash(usuario.password, SALT_ROUNDS);
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
         SET account_user_id = ?
         WHERE id = ?`,
        [userId, cardholderId]
      );
    }
  }
}

async function seedSolicitudes(pool, municipioMap) {
  for (const solicitud of SOLICITUDES) {
    const passwordHash = await bcrypt.hash(solicitud.password, SALT_ROUNDS);
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
