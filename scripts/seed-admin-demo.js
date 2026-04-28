/* eslint-disable no-console */
require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const { ensureSchema, getDbConfig } = require('./seed');
const { buildCurpLookup } = require('../src/services/curpHashService');
const { encryptJson } = require('../src/services/fieldEncryptionService');

const SALT_ROUNDS = 10;
const DEMO_MARKER = 'admin-demo-seed';
const DEMO_ACTIVITY_EMAIL = 'admin-demo-seed@local';

const DEMO_USERS = [
  {
    email: 'brenda.admin@example.com',
    nombre: 'Brenda',
    apellidos: 'Castillo Vera',
    telefono: '4442001001',
    role: 'admin',
    status: 'active',
    municipioNeedle: 'san luis',
    password: 'AdminDemo123!',
    lastLoginAt: '2026-04-28 09:40:00',
    lastFailedLoginAt: null
  },
  {
    email: 'roberto.reader@example.com',
    nombre: 'Roberto',
    apellidos: 'Luna Garcia',
    telefono: '4813002002',
    role: 'reader',
    status: 'active',
    municipioNeedle: 'ciudad valles',
    password: 'ReaderDemo123!',
    lastLoginAt: '2026-04-28 08:15:00',
    lastFailedLoginAt: '2026-04-27 18:45:00'
  },
  {
    email: 'lucia.reader@example.com',
    nombre: 'Lucia',
    apellidos: 'Navarro Soto',
    telefono: '4442003003',
    role: 'reader',
    status: 'active',
    municipioNeedle: 'soledad',
    password: 'ReaderDemo123!',
    lastLoginAt: '2026-04-27 16:20:00',
    lastFailedLoginAt: null
  },
  {
    email: 'patricia.reader@example.com',
    nombre: 'Patricia',
    apellidos: 'Medina Torres',
    telefono: '4884004004',
    role: 'reader',
    status: 'pending',
    municipioNeedle: 'matehuala',
    password: 'ReaderDemo123!',
    lastLoginAt: null,
    lastFailedLoginAt: null
  },
  {
    email: 'hector.reader@example.com',
    nombre: 'Hector',
    apellidos: 'Roman Diaz',
    telefono: '4445005005',
    role: 'reader',
    status: 'blocked',
    municipioNeedle: 'san luis',
    password: 'ReaderDemo123!',
    lastLoginAt: '2026-04-22 12:00:00',
    lastFailedLoginAt: '2026-04-28 09:58:00'
  }
];

const DEMO_BENEFITS = [
  {
    nombre: 'Biblioteca Digital Centro',
    descripcion: 'Espacio con internet, cursos y asesoria academica.',
    categoriaNeedle: 'educacion',
    municipioNeedle: 'san luis',
    descuento: 'Acceso preferente y 25% en talleres',
    direccion: 'Av. Universidad 150, Centro',
    horario: 'L-V 08:00 - 20:00',
    lat: 22.1511,
    lng: -100.9767
  },
  {
    nombre: 'Optica Huasteca',
    descripcion: 'Examen visual y descuentos para estudiantes.',
    categoriaNeedle: 'salud',
    municipioNeedle: 'ciudad valles',
    descuento: '15% en armazones y micas',
    direccion: 'Blvd. Mexico-Laredo 455, Altavista',
    horario: 'L-S 10:00 - 19:00',
    lat: 21.9967,
    lng: -99.0133
  },
  {
    nombre: 'Laboratorio Maker Soledad',
    descripcion: 'Talleres de impresion 3D, robotica y prototipado.',
    categoriaNeedle: 'tecnologia',
    municipioNeedle: 'soledad',
    descuento: '30% en membresia mensual',
    direccion: 'Av. San Pedro 220, Cabecera',
    horario: 'L-V 09:00 - 18:00',
    lat: 22.1831,
    lng: -100.9416
  }
];

const DEMO_STAGING = [
  {
    externalRequestId: 'ADMIN-DEMO-STG-001',
    status: 'pending',
    submittedBySystem: 'unidad_informatica',
    submittedAt: '2026-04-28 08:00:00',
    sentAt: null,
    resolvedAt: null,
    sysIpjResponseCode: null,
    errorMessage: null,
    lockedAt: null,
    lockedBy: null,
    payload: {
      curp: 'MOCJ050521MSPNRL01',
      nombre: 'Julieta',
      apellido_paterno: 'Morales',
      apellido_materno: 'Cano',
      fecha_nacimiento: '2005-05-21',
      sexo: 'M',
      discapacidad: false,
      id_ine: 'INE123456',
      telefono: '4441234567',
      domicilio: {
        calle: 'Av Revolucion',
        numero_ext: '321B',
        numero_int: null,
        colonia: 'Zona Centro',
        municipio_id: 1,
        codigo_postal: '78000',
        seccional: '001'
      }
    }
  },
  {
    externalRequestId: 'ADMIN-DEMO-STG-002',
    status: 'accepted',
    submittedBySystem: 'unidad_informatica',
    submittedAt: '2026-04-27 10:00:00',
    sentAt: '2026-04-27 10:12:00',
    resolvedAt: '2026-04-27 10:15:00',
    sysIpjResponseCode: 202,
    errorMessage: null,
    lockedAt: null,
    lockedBy: null,
    payload: {
      curp: 'CAGA060303HSPMNN04',
      nombre: 'Gabriel',
      apellido_paterno: 'Campos',
      apellido_materno: 'Aguilar',
      fecha_nacimiento: '2006-03-03',
      sexo: 'H',
      discapacidad: false,
      id_ine: 'INE223344',
      telefono: '4445678910',
      domicilio: {
        calle: 'Sierra Leona',
        numero_ext: '88',
        numero_int: '2',
        colonia: 'Lomas',
        municipio_id: 1,
        codigo_postal: '78210',
        seccional: '114'
      }
    }
  },
  {
    externalRequestId: 'ADMIN-DEMO-STG-003',
    status: 'rejected',
    submittedBySystem: 'unidad_informatica',
    submittedAt: '2026-04-27 11:30:00',
    sentAt: '2026-04-27 11:42:00',
    resolvedAt: '2026-04-27 11:45:00',
    sysIpjResponseCode: 422,
    errorMessage: 'CURP ya existe en padron destino.',
    lockedAt: null,
    lockedBy: null,
    payload: {
      curp: 'HEGM040812HSPRRN02',
      nombre: 'Miriam',
      apellido_paterno: 'Herrera',
      apellido_materno: 'Guzman',
      fecha_nacimiento: '2004-08-12',
      sexo: 'M',
      discapacidad: false,
      id_ine: 'INE334455',
      telefono: '4811234567',
      domicilio: {
        calle: 'Juarez',
        numero_ext: '45',
        numero_int: null,
        colonia: 'Obrera',
        municipio_id: 3,
        codigo_postal: '79010',
        seccional: '009'
      }
    }
  },
  {
    externalRequestId: 'ADMIN-DEMO-STG-004',
    status: 'error',
    submittedBySystem: 'unidad_informatica',
    submittedAt: '2026-04-28 09:10:00',
    sentAt: '2026-04-28 09:18:00',
    resolvedAt: '2026-04-28 09:19:00',
    sysIpjResponseCode: 500,
    errorMessage: 'Timeout al comunicarse con Sys_IPJ.',
    lockedAt: null,
    lockedBy: null,
    payload: {
      curp: 'LOPJ031115MSPRRR03',
      nombre: 'Josefina',
      apellido_paterno: 'Lopez',
      apellido_materno: 'Perez',
      fecha_nacimiento: '2003-11-15',
      sexo: 'M',
      discapacidad: true,
      id_ine: 'INE445566',
      telefono: '4449998877',
      domicilio: {
        calle: 'Carranza',
        numero_ext: '905',
        numero_int: null,
        colonia: 'Tequis',
        municipio_id: 1,
        codigo_postal: '78250',
        seccional: '071'
      }
    }
  },
  {
    externalRequestId: 'ADMIN-DEMO-STG-005',
    status: 'sent',
    submittedBySystem: 'unidad_informatica',
    submittedAt: '2026-04-28 09:30:00',
    sentAt: '2026-04-28 09:35:00',
    resolvedAt: null,
    sysIpjResponseCode: null,
    errorMessage: null,
    lockedAt: '2026-04-28 09:36:00',
    lockedBy: 'admin-demo-lock',
    payload: {
      curp: 'PELS020101MSPXRN05',
      nombre: 'Sarai',
      apellido_paterno: 'Perez',
      apellido_materno: 'Lozano',
      fecha_nacimiento: '2002-01-01',
      sexo: 'M',
      discapacidad: false,
      id_ine: 'INE556677',
      telefono: '4447776655',
      domicilio: {
        calle: 'Hidalgo',
        numero_ext: '17',
        numero_int: null,
        colonia: 'San Felipe',
        municipio_id: 2,
        codigo_postal: '78430',
        seccional: '021'
      }
    }
  }
];

const DEMO_SYNC_RUNS = [
  {
    direction: 'SYS_IPJ_TO_API_TJ',
    executedBy: DEMO_MARKER,
    requestCount: 55,
    insertedCount: 40,
    updatedCount: 10,
    skippedCount: 3,
    conflictCount: 2,
    status: 'partial',
    checksum: 'demo-sync-partial-001',
    startedAt: '2026-04-27 07:30:00',
    finishedAt: '2026-04-27 07:36:00',
    errorMessage: 'Dos registros con folio duplicado.'
  },
  {
    direction: 'SYS_IPJ_TO_API_TJ',
    executedBy: DEMO_MARKER,
    requestCount: 145,
    insertedCount: 120,
    updatedCount: 20,
    skippedCount: 5,
    conflictCount: 0,
    status: 'success',
    checksum: 'demo-sync-success-002',
    startedAt: '2026-04-28 06:00:00',
    finishedAt: '2026-04-28 06:07:00',
    errorMessage: null
  }
];

const DEMO_INTEGRATION_AUDIT = [
  {
    clientCode: DEMO_MARKER,
    method: 'POST',
    path: '/api/v1/cardholders/lookup',
    requiredScope: 'cardholders.lookup',
    ipAddress: '10.20.0.10',
    statusCode: 401,
    createdAt: '2026-04-28 07:40:00'
  },
  {
    clientCode: DEMO_MARKER,
    method: 'POST',
    path: '/api/v1/beneficiarios-staging',
    requiredScope: 'beneficiarios.staging.create',
    ipAddress: '10.20.0.11',
    statusCode: 403,
    createdAt: '2026-04-28 07:45:00'
  },
  {
    clientCode: DEMO_MARKER,
    method: 'POST',
    path: '/api/v1/cardholders/sync',
    requiredScope: 'cardholders.sync',
    ipAddress: '10.20.0.12',
    statusCode: 500,
    createdAt: '2026-04-28 08:10:00'
  },
  {
    clientCode: DEMO_MARKER,
    method: 'POST',
    path: '/api/v1/cardholders/lookup',
    requiredScope: 'cardholders.lookup',
    ipAddress: '10.20.0.13',
    statusCode: 422,
    createdAt: '2026-04-26 08:10:00'
  }
];

const DEMO_PUSH_ATTEMPTS = [
  {
    externalRequestId: 'ADMIN-DEMO-STG-002',
    actor: 'brenda.admin@example.com',
    requestChecksum: 'push-demo-accepted-001',
    responseStatus: 202,
    status: 'accepted',
    errorMessage: null,
    attemptedAt: '2026-04-27 10:12:00'
  },
  {
    externalRequestId: 'ADMIN-DEMO-STG-003',
    actor: 'brenda.admin@example.com',
    requestChecksum: 'push-demo-rejected-001',
    responseStatus: 422,
    status: 'rejected',
    errorMessage: 'Folio duplicado en destino.',
    attemptedAt: '2026-04-27 11:42:00'
  },
  {
    externalRequestId: 'ADMIN-DEMO-STG-004',
    actor: 'brenda.admin@example.com',
    requestChecksum: 'push-demo-error-001',
    responseStatus: 500,
    status: 'error',
    errorMessage: 'Sys_IPJ no respondio a tiempo.',
    attemptedAt: '2026-04-28 09:18:00'
  }
];

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function findLookupId(rows, needle, label) {
  const normalizedNeedle = normalizeText(needle);
  const row = rows.find((item) => normalizeText(item.nombre).includes(normalizedNeedle));
  if (!row) {
    throw new Error(`No se encontro ${label} para "${needle}".`);
  }
  return row.id;
}

async function loadLookups(connection) {
  const [municipios] = await connection.execute('SELECT id, nombre FROM municipios');
  const [categorias] = await connection.execute('SELECT id, nombre FROM categorias');
  return { municipios, categorias };
}

async function upsertUsers(connection, municipios) {
  const idsByEmail = new Map();

  for (const user of DEMO_USERS) {
    const municipioId = findLookupId(municipios, user.municipioNeedle, 'municipio');
    const passwordHash = await bcrypt.hash(user.password, SALT_ROUNDS);
    const [rows] = await connection.execute(
      'SELECT id FROM usuarios WHERE email = ? LIMIT 1',
      [user.email]
    );

    if (rows.length > 0) {
      await connection.execute(
        `UPDATE usuarios
         SET nombre = ?, apellidos = ?, telefono = ?, municipio_id = ?, password_hash = ?,
             role = ?, status = ?, last_login_at = ?, last_failed_login_at = ?
         WHERE email = ?`,
        [
          user.nombre,
          user.apellidos,
          user.telefono,
          municipioId,
          passwordHash,
          user.role,
          user.status,
          user.lastLoginAt,
          user.lastFailedLoginAt,
          user.email
        ]
      );
      idsByEmail.set(user.email, rows[0].id);
      continue;
    }

    const [result] = await connection.execute(
      `INSERT INTO usuarios
        (nombre, apellidos, email, telefono, municipio_id, password_hash, role, status,
         last_login_at, last_failed_login_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.nombre,
        user.apellidos,
        user.email,
        user.telefono,
        municipioId,
        passwordHash,
        user.role,
        user.status,
        user.lastLoginAt,
        user.lastFailedLoginAt
      ]
    );
    idsByEmail.set(user.email, result.insertId);
  }

  return idsByEmail;
}

async function upsertBenefits(connection, municipios, categorias) {
  for (const benefit of DEMO_BENEFITS) {
    const municipioId = findLookupId(municipios, benefit.municipioNeedle, 'municipio');
    const categoriaId = findLookupId(categorias, benefit.categoriaNeedle, 'categoria');
    const [rows] = await connection.execute(
      'SELECT id FROM beneficios WHERE nombre = ? LIMIT 1',
      [benefit.nombre]
    );

    if (rows.length > 0) {
      await connection.execute(
        `UPDATE beneficios
         SET descripcion = ?, categoria_id = ?, municipio_id = ?, descuento = ?,
             direccion = ?, horario = ?, lat = ?, lng = ?
         WHERE id = ?`,
        [
          benefit.descripcion,
          categoriaId,
          municipioId,
          benefit.descuento,
          benefit.direccion,
          benefit.horario,
          benefit.lat,
          benefit.lng,
          rows[0].id
        ]
      );
      continue;
    }

    await connection.execute(
      `INSERT INTO beneficios
        (nombre, descripcion, categoria_id, municipio_id, descuento, direccion, horario, lat, lng)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        benefit.nombre,
        benefit.descripcion,
        categoriaId,
        municipioId,
        benefit.descuento,
        benefit.direccion,
        benefit.horario,
        benefit.lat,
        benefit.lng
      ]
    );
  }
}

async function upsertStaging(connection) {
  const idsByExternalRequestId = new Map();

  for (const item of DEMO_STAGING) {
    const lookup = buildCurpLookup(item.payload.curp);
    const encrypted = encryptJson(item.payload);
    await connection.execute(
      `INSERT INTO beneficiario_staging
        (external_request_id, curp_hash, curp_masked, payload_ciphertext, payload_iv, payload_tag,
         status, submitted_by_system, submitted_at, sent_at, resolved_at, sys_ipj_response_code,
         error_message, locked_at, locked_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         curp_hash = VALUES(curp_hash),
         curp_masked = VALUES(curp_masked),
         payload_ciphertext = VALUES(payload_ciphertext),
         payload_iv = VALUES(payload_iv),
         payload_tag = VALUES(payload_tag),
         status = VALUES(status),
         submitted_by_system = VALUES(submitted_by_system),
         submitted_at = VALUES(submitted_at),
         sent_at = VALUES(sent_at),
         resolved_at = VALUES(resolved_at),
         sys_ipj_response_code = VALUES(sys_ipj_response_code),
         error_message = VALUES(error_message),
         locked_at = VALUES(locked_at),
         locked_by = VALUES(locked_by)`,
      [
        item.externalRequestId,
        lookup.curpHash,
        lookup.curpMasked,
        encrypted.payload_ciphertext,
        encrypted.payload_iv,
        encrypted.payload_tag,
        item.status,
        item.submittedBySystem,
        item.submittedAt,
        item.sentAt,
        item.resolvedAt,
        item.sysIpjResponseCode,
        item.errorMessage,
        item.lockedAt,
        item.lockedBy
      ]
    );
  }

  const [rows] = await connection.query(
    `SELECT id, external_request_id
     FROM beneficiario_staging
     WHERE external_request_id IN (?)`,
    [DEMO_STAGING.map((item) => item.externalRequestId)]
  );

  for (const row of rows) {
    idsByExternalRequestId.set(row.external_request_id, row.id);
  }

  return idsByExternalRequestId;
}

async function reseedPushAttempts(connection, stagingIds) {
  await connection.query(
    'DELETE FROM staging_push_attempts WHERE external_request_id IN (?)',
    [DEMO_PUSH_ATTEMPTS.map((item) => item.externalRequestId)]
  );

  for (const item of DEMO_PUSH_ATTEMPTS) {
    const stagingId = stagingIds.get(item.externalRequestId);
    if (!stagingId) {
      throw new Error(`No se encontro staging para ${item.externalRequestId}.`);
    }

    await connection.execute(
      `INSERT INTO staging_push_attempts
        (staging_id, external_request_id, actor, request_checksum, response_status, status,
         error_message, attempted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        stagingId,
        item.externalRequestId,
        item.actor,
        item.requestChecksum,
        item.responseStatus,
        item.status,
        item.errorMessage,
        item.attemptedAt
      ]
    );
  }
}

async function reseedSyncAudit(connection) {
  await connection.execute('DELETE FROM sync_audit_log WHERE executed_by = ?', [DEMO_MARKER]);

  for (const item of DEMO_SYNC_RUNS) {
    await connection.execute(
      `INSERT INTO sync_audit_log
        (direction, executed_by, request_count, inserted_count, updated_count, skipped_count,
         conflict_count, status, request_checksum, started_at, finished_at, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.direction,
        item.executedBy,
        item.requestCount,
        item.insertedCount,
        item.updatedCount,
        item.skippedCount,
        item.conflictCount,
        item.status,
        item.checksum,
        item.startedAt,
        item.finishedAt,
        item.errorMessage
      ]
    );
  }
}

async function reseedIntegrationAudit(connection) {
  await connection.execute('DELETE FROM integration_audit_log WHERE client_code = ?', [DEMO_MARKER]);

  for (const item of DEMO_INTEGRATION_AUDIT) {
    await connection.execute(
      `INSERT INTO integration_audit_log
        (client_id, client_code, method, path, required_scope, ip_address, status_code, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        null,
        item.clientCode,
        item.method,
        item.path,
        item.requiredScope,
        item.ipAddress,
        item.statusCode,
        item.createdAt
      ]
    );
  }
}

async function reseedAdminActivity(connection, userIds, stagingIds) {
  await connection.execute('DELETE FROM admin_activity_log WHERE actor_email = ?', [DEMO_ACTIVITY_EMAIL]);

  const brendaId = userIds.get('brenda.admin@example.com') || null;
  const robertoId = userIds.get('roberto.reader@example.com') || null;
  const errorStagingId = stagingIds.get('ADMIN-DEMO-STG-004') || null;

  const entries = [
    {
      actorUserId: brendaId,
      entityType: 'usuarios',
      entityId: String(robertoId || '0'),
      action: 'update',
      ipAddress: '127.0.0.1',
      payload: JSON.stringify({ status: 'active', note: 'demo data refreshed' })
    },
    {
      actorUserId: brendaId,
      entityType: 'beneficiario_staging',
      entityId: String(errorStagingId || '0'),
      action: 'push',
      ipAddress: '127.0.0.1',
      payload: JSON.stringify({ result: 'error', responseStatus: 500 })
    },
    {
      actorUserId: brendaId,
      entityType: 'integrations',
      entityId: DEMO_MARKER,
      action: 'review_failed_calls',
      ipAddress: '127.0.0.1',
      payload: JSON.stringify({ failedCallsLast24h: 3 })
    }
  ];

  for (const entry of entries) {
    await connection.execute(
      `INSERT INTO admin_activity_log
        (actor_user_id, actor_email, entity_type, entity_id, action, ip_address, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.actorUserId,
        DEMO_ACTIVITY_EMAIL,
        entry.entityType,
        entry.entityId,
        entry.action,
        entry.ipAddress,
        entry.payload
      ]
    );
  }
}

function parseJsonSummary(value) {
  if (!value) {
    return {};
  }
  if (typeof value === 'string') {
    return JSON.parse(value);
  }
  return value;
}

async function buildSummary(connection) {
  const [[usersByStatus]] = await connection.execute(
    `SELECT JSON_OBJECTAGG(status, total) AS summary
     FROM (
       SELECT status, COUNT(*) AS total
       FROM usuarios
       WHERE role IN ('admin', 'reader')
       GROUP BY status
     ) statuses`
  );
  const [[stagingByStatus]] = await connection.execute(
    `SELECT JSON_OBJECTAGG(status, total) AS summary
     FROM (
       SELECT status, COUNT(*) AS total
       FROM beneficiario_staging
       GROUP BY status
     ) statuses`
  );
  const [[benefitsRow]] = await connection.execute('SELECT COUNT(*) AS total FROM beneficios');
  const [[failedIntegrationRow]] = await connection.execute(
    `SELECT COUNT(*) AS total
     FROM integration_audit_log
     WHERE status_code >= 400
       AND created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)`
  );

  return {
    usersByStatus: parseJsonSummary(usersByStatus.summary),
    stagingByStatus: parseJsonSummary(stagingByStatus.summary),
    benefits: Number(benefitsRow.total || 0),
    failedIntegrationsLast24h: Number(failedIntegrationRow.total || 0)
  };
}

async function main() {
  const pool = mysql.createPool(getDbConfig());
  const connection = await pool.getConnection();

  console.log('Iniciando seed admin demo...');

  try {
    await ensureSchema(pool);
    await connection.beginTransaction();

    const { municipios, categorias } = await loadLookups(connection);
    const userIds = await upsertUsers(connection, municipios);
    await upsertBenefits(connection, municipios, categorias);
    const stagingIds = await upsertStaging(connection);
    await reseedPushAttempts(connection, stagingIds);
    await reseedSyncAudit(connection);
    await reseedIntegrationAudit(connection);
    await reseedAdminActivity(connection, userIds, stagingIds);

    await connection.commit();

    const summary = await buildSummary(connection);
    console.log('Seed admin demo completado con exito.');
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    await connection.rollback();
    console.error('Error durante el seed admin demo:', error);
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
}

if (require.main === module) {
  main();
}
