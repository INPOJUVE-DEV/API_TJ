/* eslint-disable no-console */
require('dotenv').config();
const mysql = require('mysql2/promise');
const { ensureSchema, getDbConfig } = require('./seed');
const { buildCurpLookup } = require('../src/services/curpHashService');
const { encryptString } = require('../src/services/fieldEncryptionService');
const { hashPassword, validatePassword } = require('../src/services/passwordService');

const ENABLE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const ADMIN_ROLES = new Set(['admin', 'reader']);
const USER_STATUSES = new Set(['active', 'blocked', 'pending']);
const CARDHOLDER_STATUSES = new Set(['active', 'inactive', 'blocked']);
const INTERNAL_ROLES = new Set(['admin', 'reader', 'scanner']);

function isBootstrapEnabled() {
  return ENABLE_VALUES.has(String(process.env.BOOTSTRAP_USERS_ON_DEPLOY || '').trim().toLowerCase());
}

function optionalString(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed || null;
}

function requiredString(value, field) {
  const normalized = optionalString(value);
  if (!normalized) {
    throw new Error(`${field} es obligatorio.`);
  }
  return normalized;
}

function normalizeEmail(value, field = 'email') {
  const email = requiredString(value, field).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`${field} no es valido.`);
  }
  return email;
}

function normalizePositiveInt(value, field) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${field} debe ser un entero positivo.`);
  }
  return parsed;
}

function normalizeEnum(value, allowedValues, field, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (!allowedValues.has(normalized)) {
    throw new Error(`${field} invalido.`);
  }
  return normalized;
}

function extractPrimaryLastName(value) {
  const tokens = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return tokens[0] || null;
}

function parseBeneficiariesJson() {
  const raw = process.env.BOOTSTRAP_BENEFICIARIES_JSON || '';
  if (!raw.trim()) {
    return [];
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error('BOOTSTRAP_BENEFICIARIES_JSON no contiene JSON valido.');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('BOOTSTRAP_BENEFICIARIES_JSON debe ser un arreglo JSON.');
  }
  return parsed;
}

function normalizeAdminConfig() {
  const email = optionalString(process.env.BOOTSTRAP_ADMIN_EMAIL);
  const password = optionalString(process.env.BOOTSTRAP_ADMIN_PASSWORD);

  if (!email && !password) {
    return null;
  }

  const normalizedEmail = normalizeEmail(email, 'BOOTSTRAP_ADMIN_EMAIL');
  const safePassword = validatePassword(
    requiredString(password, 'BOOTSTRAP_ADMIN_PASSWORD'),
    { email: normalizedEmail }
  );

  return {
    nombre: optionalString(process.env.BOOTSTRAP_ADMIN_NOMBRE),
    apellidos: optionalString(process.env.BOOTSTRAP_ADMIN_APELLIDOS),
    email: normalizedEmail,
    telefono: optionalString(process.env.BOOTSTRAP_ADMIN_TELEFONO),
    municipioId: normalizePositiveInt(process.env.BOOTSTRAP_ADMIN_MUNICIPIO_ID, 'BOOTSTRAP_ADMIN_MUNICIPIO_ID'),
    role: normalizeEnum(process.env.BOOTSTRAP_ADMIN_ROLE, ADMIN_ROLES, 'BOOTSTRAP_ADMIN_ROLE', 'admin'),
    status: normalizeEnum(process.env.BOOTSTRAP_ADMIN_STATUS, USER_STATUSES, 'BOOTSTRAP_ADMIN_STATUS', 'active'),
    password: safePassword
  };
}

function normalizeBeneficiaryConfig(entry, index) {
  const label = `beneficiario[${index}]`;
  const email = normalizeEmail(entry?.email, `${label}.email`);
  const tarjetaNumero = requiredString(entry?.tarjeta_numero, `${label}.tarjeta_numero`);
  const safePassword = validatePassword(
    requiredString(entry?.password, `${label}.password`),
    { email, forbiddenValues: [tarjetaNumero] }
  );
  const { normalized, curpHash, curpMasked } = buildCurpLookup(
    requiredString(entry?.curp, `${label}.curp`)
  );

  return {
    nombre: optionalString(entry?.nombre),
    apellidos: optionalString(entry?.apellidos),
    curp: normalized,
    curpHash,
    curpMasked,
    tarjetaNumero,
    email,
    telefono: optionalString(entry?.telefono),
    municipioId: normalizePositiveInt(entry?.municipio_id, `${label}.municipio_id`),
    role: 'beneficiary',
    userStatus: normalizeEnum(entry?.user_status, USER_STATUSES, `${label}.user_status`, 'active'),
    cardholderStatus: normalizeEnum(
      entry?.cardholder_status,
      CARDHOLDER_STATUSES,
      `${label}.cardholder_status`,
      'active'
    ),
    password: safePassword
  };
}

async function upsertAdmin(connection, admin) {
  const passwordHash = await hashPassword(admin.password);
  const [rows] = await connection.execute(
    'SELECT id FROM usuarios WHERE email = ? LIMIT 1 FOR UPDATE',
    [admin.email]
  );

  if (rows.length > 0) {
    const userId = rows[0].id;
    await connection.execute(
      `UPDATE usuarios
       SET nombre = ?, apellidos = ?, telefono = ?, municipio_id = ?, password_hash = ?,
           role = ?, status = ?, session_version = session_version + 1, auth0_user_id = NULL
       WHERE id = ?`,
      [
        admin.nombre,
        admin.apellidos,
        admin.telefono,
        admin.municipioId,
        passwordHash,
        admin.role,
        admin.status,
        userId
      ]
    );
    return { id: userId, created: false };
  }

  const [result] = await connection.execute(
    `INSERT INTO usuarios
      (nombre, apellidos, email, telefono, municipio_id, password_hash, role, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      admin.nombre,
      admin.apellidos,
      admin.email,
      admin.telefono,
      admin.municipioId,
      passwordHash,
      admin.role,
      admin.status
    ]
  );
  return { id: result.insertId, created: true };
}

async function getExistingCardholder(connection, beneficiary) {
  const [rows] = await connection.execute(
    `SELECT id, curp_hash, tarjeta_numero, status, account_user_id
     FROM cardholders_sync
     WHERE curp_hash = ? OR tarjeta_numero = ?
     LIMIT 1
     FOR UPDATE`,
    [beneficiary.curpHash, beneficiary.tarjetaNumero]
  );
  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  if (row.curp_hash !== beneficiary.curpHash || row.tarjeta_numero !== beneficiary.tarjetaNumero) {
    throw new Error(
      `Conflicto al bootstrapear ${beneficiary.email}: la tarjeta o la CURP ya pertenecen a otro registro.`
    );
  }
  return row;
}

async function getUserById(connection, userId) {
  const [rows] = await connection.execute(
    `SELECT id, email, role, status, cardholder_sync_id, password_hash
     FROM usuarios
     WHERE id = ?
     LIMIT 1
     FOR UPDATE`,
    [userId]
  );
  return rows[0] || null;
}

async function getUserByEmail(connection, email) {
  const [rows] = await connection.execute(
    `SELECT id, email, role, status, cardholder_sync_id, password_hash
     FROM usuarios
     WHERE email = ?
     LIMIT 1
     FOR UPDATE`,
    [email]
  );
  return rows[0] || null;
}

async function upsertBeneficiary(connection, beneficiary) {
  let cardholder = await getExistingCardholder(connection, beneficiary);
  const encryptedNombres = encryptString(beneficiary.nombre);
  const encryptedApellido = encryptString(extractPrimaryLastName(beneficiary.apellidos));

  if (!cardholder) {
    const [result] = await connection.execute(
      `INSERT INTO cardholders_sync
        (curp_hash, curp_masked, tarjeta_numero, status, sync_source, synced_at,
         nombres_ciphertext, nombres_iv, nombres_tag,
         apellido_ciphertext, apellido_iv, apellido_tag, municipio_id)
       VALUES (?, ?, ?, ?, 'bootstrap-env', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        beneficiary.curpHash,
        beneficiary.curpMasked,
        beneficiary.tarjetaNumero,
        beneficiary.cardholderStatus,
        new Date(),
        encryptedNombres?.payload_ciphertext || null,
        encryptedNombres?.payload_iv || null,
        encryptedNombres?.payload_tag || null,
        encryptedApellido?.payload_ciphertext || null,
        encryptedApellido?.payload_iv || null,
        encryptedApellido?.payload_tag || null,
        beneficiary.municipioId
      ]
    );
    cardholder = {
      id: result.insertId,
      account_user_id: null
    };
  } else {
    await connection.execute(
      `UPDATE cardholders_sync
       SET curp_masked = ?, status = ?, sync_source = 'bootstrap-env', synced_at = ?,
           nombres_ciphertext = COALESCE(?, nombres_ciphertext),
           nombres_iv = COALESCE(?, nombres_iv),
           nombres_tag = COALESCE(?, nombres_tag),
           apellido_ciphertext = COALESCE(?, apellido_ciphertext),
           apellido_iv = COALESCE(?, apellido_iv),
           apellido_tag = COALESCE(?, apellido_tag),
           municipio_id = COALESCE(?, municipio_id)
       WHERE id = ?`,
      [
        beneficiary.curpMasked,
        beneficiary.cardholderStatus,
        new Date(),
        encryptedNombres?.payload_ciphertext || null,
        encryptedNombres?.payload_iv || null,
        encryptedNombres?.payload_tag || null,
        encryptedApellido?.payload_ciphertext || null,
        encryptedApellido?.payload_iv || null,
        encryptedApellido?.payload_tag || null,
        beneficiary.municipioId,
        cardholder.id
      ]
    );
  }

  const linkedUser = cardholder.account_user_id
    ? await getUserById(connection, cardholder.account_user_id)
    : null;
  const existingByEmail = await getUserByEmail(connection, beneficiary.email);

  if (linkedUser && existingByEmail && linkedUser.id !== existingByEmail.id) {
    throw new Error(
      `Conflicto al bootstrapear ${beneficiary.email}: la tarjeta ya esta vinculada a otro usuario.`
    );
  }

  let targetUser = linkedUser || existingByEmail;

  if (targetUser?.cardholder_sync_id && targetUser.cardholder_sync_id !== cardholder.id) {
    throw new Error(
      `Conflicto al bootstrapear ${beneficiary.email}: el email ya esta ligado a otra tarjeta.`
    );
  }

  if (targetUser && INTERNAL_ROLES.has(String(targetUser.role || '').toLowerCase())) {
    throw new Error(
      `Conflicto al bootstrapear ${beneficiary.email}: el email ya existe como usuario interno.`
    );
  }

  const passwordHash = await hashPassword(beneficiary.password);
  let created = false;
  let userId;

  if (targetUser) {
    userId = targetUser.id;
    await connection.execute(
      `UPDATE usuarios
       SET nombre = ?, apellidos = ?, curp = ?, email = ?, telefono = ?, municipio_id = ?,
           password_hash = ?, role = 'beneficiary', cardholder_sync_id = ?, status = ?,
           auth0_user_id = NULL, session_version = session_version + 1
       WHERE id = ?`,
      [
        beneficiary.nombre,
        beneficiary.apellidos,
        beneficiary.curp,
        beneficiary.email,
        beneficiary.telefono,
        beneficiary.municipioId,
        passwordHash,
        cardholder.id,
        beneficiary.userStatus,
        userId
      ]
    );
  } else {
    const [result] = await connection.execute(
      `INSERT INTO usuarios
        (nombre, apellidos, curp, email, telefono, municipio_id, password_hash, role,
         cardholder_sync_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'beneficiary', ?, ?)`,
      [
        beneficiary.nombre,
        beneficiary.apellidos,
        beneficiary.curp,
        beneficiary.email,
        beneficiary.telefono,
        beneficiary.municipioId,
        passwordHash,
        cardholder.id,
        beneficiary.userStatus
      ]
    );
    userId = result.insertId;
    created = true;
  }

  await connection.execute(
    `UPDATE cardholders_sync
     SET account_user_id = ?, auth0_user_id = NULL, activation_verified_until = NULL
     WHERE id = ?`,
    [userId, cardholder.id]
  );

  return {
    id: userId,
    cardholderSyncId: cardholder.id,
    created
  };
}

async function main() {
  if (!isBootstrapEnabled()) {
    console.log('Bootstrap de usuarios omitido: BOOTSTRAP_USERS_ON_DEPLOY no esta habilitado.');
    return;
  }

  const admin = normalizeAdminConfig();
  const beneficiaries = parseBeneficiariesJson().map(normalizeBeneficiaryConfig);

  if (!admin && beneficiaries.length === 0) {
    console.log('Bootstrap de usuarios omitido: no hay usuarios configurados.');
    return;
  }

  const pool = mysql.createPool(getDbConfig());
  let connection;

  try {
    await ensureSchema(pool);
    connection = await pool.getConnection();
    await connection.beginTransaction();

    if (admin) {
      const result = await upsertAdmin(connection, admin);
      console.log(
        `${result.created ? 'Creado' : 'Actualizado'} admin interno: ${admin.email} (id ${result.id})`
      );
    }

    for (const beneficiary of beneficiaries) {
      const result = await upsertBeneficiary(connection, beneficiary);
      console.log(
        `${result.created ? 'Creado' : 'Actualizado'} beneficiario: ${beneficiary.email} -> ${beneficiary.tarjetaNumero} (usuario ${result.id}, cardholder_sync ${result.cardholderSyncId})`
      );
    }

    await connection.commit();
    console.log('Bootstrap de usuarios completado con exito.');
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Error al revertir bootstrap de usuarios:', rollbackError);
      }
    }
    console.error('Error durante bootstrap de usuarios:', error);
    process.exitCode = 1;
  } finally {
    if (connection) {
      connection.release();
    }
    await pool.end();
  }
}

if (require.main === module) {
  main();
}
