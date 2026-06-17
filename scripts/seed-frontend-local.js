/* eslint-disable no-console */
require('dotenv').config();
const mysql = require('mysql2/promise');
const { ensureSchema, getDbConfig } = require('./seed');
const { encryptString } = require('../src/services/fieldEncryptionService');
const { hashPassword } = require('../src/services/passwordService');
const { buildCurpLookup } = require('../src/services/curpHashService');
const { buildDeviceTestFixtures } = require('./fixtures/deviceTestBeneficiaries');

const MUNICIPIOS = [
  'San Luis Potosi',
  'Soledad de Graciano Sanchez',
  'Ciudad Valles',
  'Matehuala',
  'Villa de Pozos',
  'Rioverde',
  'Tancanhuitz'
];

const LOGIN_FIXTURE = {
  nombre: 'Carlos',
  apellidos: 'Lopez Mendez',
  curp: 'LOMC990505HSPLPM02',
  email: 'carlos.lopez@example.com',
  telefono: '4819876543',
  municipio: 'Ciudad Valles',
  password: 'Secret456!',
  tarjetaNumero: 'TJ-0002',
  status: 'active'
};

const ACTIVATION_FIXTURE = {
  curp: 'MELR000202MSPSRD06',
  nombres: 'Melissa',
  apellidos: 'Rios Delgado',
  municipio: 'Soledad de Graciano Sanchez',
  tarjetaNumero: 'TJ-0080',
  status: 'active'
};

const INACTIVE_FIXTURE = {
  curp: 'SAQP950101HSPQRP07',
  nombres: 'Santiago',
  apellidos: 'Quintero Perez',
  municipio: 'San Luis Potosi',
  tarjetaNumero: 'TJ-0099',
  status: 'inactive'
};

const DEVICE_TEST_FIXTURES = buildDeviceTestFixtures({
  passwordOverride: process.env.SEED_DEVICE_TEST_PASSWORD || null
});

function extractPrimaryLastName(value) {
  const tokens = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return tokens[0] || null;
}

async function ensureMunicipios(connection) {
  for (const nombre of MUNICIPIOS) {
    await connection.execute(
      `INSERT INTO municipios (nombre)
       VALUES (?)
       ON DUPLICATE KEY UPDATE nombre = VALUES(nombre)`,
      [nombre]
    );
  }

  const [rows] = await connection.query('SELECT id, nombre FROM municipios');
  return rows.reduce((acc, row) => {
    acc[row.nombre] = row.id;
    return acc;
  }, {});
}

async function upsertCardholder(connection, fixture, municipioId, accountUserId = null) {
  if (accountUserId) {
    const lookup = buildCurpLookup(fixture.curp);
    await connection.execute(
      `UPDATE cardholders_sync
       SET account_user_id = NULL
       WHERE account_user_id = ? AND curp_hash <> ?`,
      [accountUserId, lookup.curpHash]
    );
  }

  const lookup = buildCurpLookup(fixture.curp);
  const encryptedNombres = encryptString(fixture.nombres || fixture.nombre);
  const encryptedApellido = encryptString(extractPrimaryLastName(fixture.apellidos));
  await connection.execute(
    `INSERT INTO cardholders_sync
      (curp_hash, curp_masked, tarjeta_numero, status, sync_source, synced_at, account_user_id,
       activation_verified_until, nombres_ciphertext, nombres_iv, nombres_tag,
       apellido_ciphertext, apellido_iv, apellido_tag, municipio_id)
     VALUES (?, ?, ?, ?, 'frontend-local-seed', ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      curp_masked = VALUES(curp_masked),
      tarjeta_numero = VALUES(tarjeta_numero),
      status = VALUES(status),
      sync_source = VALUES(sync_source),
      synced_at = VALUES(synced_at),
      account_user_id = VALUES(account_user_id),
      activation_verified_until = VALUES(activation_verified_until),
      nombres_ciphertext = VALUES(nombres_ciphertext),
      nombres_iv = VALUES(nombres_iv),
      nombres_tag = VALUES(nombres_tag),
      apellido_ciphertext = VALUES(apellido_ciphertext),
      apellido_iv = VALUES(apellido_iv),
      apellido_tag = VALUES(apellido_tag),
      municipio_id = VALUES(municipio_id)`,
    [
      lookup.curpHash,
      lookup.curpMasked,
      fixture.tarjetaNumero,
      fixture.status,
      new Date(),
      accountUserId,
      encryptedNombres?.payload_ciphertext || null,
      encryptedNombres?.payload_iv || null,
      encryptedNombres?.payload_tag || null,
      encryptedApellido?.payload_ciphertext || null,
      encryptedApellido?.payload_iv || null,
      encryptedApellido?.payload_tag || null,
      municipioId
    ]
  );

  const [rows] = await connection.execute(
    `SELECT id
     FROM cardholders_sync
     WHERE curp_hash = ?
     LIMIT 1`,
    [lookup.curpHash]
  );

  return rows[0]?.id || null;
}

async function upsertBeneficiaryUser(connection, fixture, municipioId) {
  const passwordHash = await hashPassword(fixture.password);
  const [existingRows] = await connection.execute(
    `SELECT id
     FROM usuarios
     WHERE email = ? OR curp = ?
     LIMIT 1`,
    [fixture.email, fixture.curp]
  );

  if (existingRows.length > 0) {
    await connection.execute(
      `UPDATE usuarios
       SET nombre = ?, apellidos = ?, curp = ?, email = ?, telefono = ?, municipio_id = ?, password_hash = ?,
           role = 'beneficiary', status = 'active'
       WHERE id = ?`,
      [
        fixture.nombre,
        fixture.apellidos,
        fixture.curp,
        fixture.email,
        fixture.telefono,
        municipioId,
        passwordHash,
        existingRows[0].id
      ]
    );
    return existingRows[0].id;
  }

  const [result] = await connection.execute(
    `INSERT INTO usuarios
      (nombre, apellidos, curp, email, telefono, municipio_id, password_hash, role, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'beneficiary', 'active')`,
    [
      fixture.nombre,
      fixture.apellidos,
      fixture.curp,
      fixture.email,
      fixture.telefono,
      municipioId,
      passwordHash
    ]
  );

  return result.insertId;
}

async function syncBeneficiaryUser(connection, fixture, userId, cardholderSyncId) {
  await connection.execute(
    `UPDATE usuarios
     SET cardholder_sync_id = ?
     WHERE id = ?`,
    [cardholderSyncId, userId]
  );

  await connection.execute(
    `UPDATE cardholders_sync
     SET account_user_id = ?, activation_verified_until = NULL
     WHERE id = ?`,
    [userId, cardholderSyncId]
  );
}

async function main() {
  const pool = mysql.createPool(getDbConfig());
  const connection = await pool.getConnection();

  console.log('Preparando fixtures locales para frontend...');

  try {
    await ensureSchema(pool);
    await connection.beginTransaction();

    const municipioMap = await ensureMunicipios(connection);

    const loginUserId = await upsertBeneficiaryUser(
      connection,
      LOGIN_FIXTURE,
      municipioMap[LOGIN_FIXTURE.municipio]
    );
    const loginCardholderSyncId = await upsertCardholder(
      connection,
      {
        curp: LOGIN_FIXTURE.curp,
        nombres: LOGIN_FIXTURE.nombre,
        apellidos: LOGIN_FIXTURE.apellidos,
        municipio: LOGIN_FIXTURE.municipio,
        tarjetaNumero: LOGIN_FIXTURE.tarjetaNumero,
        status: LOGIN_FIXTURE.status
      },
      municipioMap[LOGIN_FIXTURE.municipio],
      loginUserId
    );
    await syncBeneficiaryUser(connection, LOGIN_FIXTURE, loginUserId, loginCardholderSyncId);

    for (const fixture of DEVICE_TEST_FIXTURES) {
      const userId = await upsertBeneficiaryUser(
        connection,
        fixture.user,
        municipioMap[fixture.user.municipio]
      );
      const cardholderSyncId = await upsertCardholder(
        connection,
        {
          curp: fixture.cardholder.curp,
          nombres: fixture.cardholder.nombres,
          apellidos: fixture.cardholder.apellidos,
          municipio: fixture.cardholder.municipio,
          tarjetaNumero: fixture.cardholder.tarjetaNumero,
          status: fixture.cardholder.status
        },
        municipioMap[fixture.cardholder.municipio],
        userId
      );
      await syncBeneficiaryUser(connection, fixture.user, userId, cardholderSyncId);
    }

    await upsertCardholder(
      connection,
      ACTIVATION_FIXTURE,
      municipioMap[ACTIVATION_FIXTURE.municipio],
      null
    );
    await upsertCardholder(
      connection,
      INACTIVE_FIXTURE,
      municipioMap[INACTIVE_FIXTURE.municipio],
      null
    );

    await connection.commit();

    console.log('Seed frontend local completado con exito.');
    console.log(
      JSON.stringify(
        {
          login: {
            email: LOGIN_FIXTURE.email,
            password: LOGIN_FIXTURE.password,
            tarjetaNumero: LOGIN_FIXTURE.tarjetaNumero
          },
          servicePointLogins: DEVICE_TEST_FIXTURES.map((fixture) => ({
            pointName: fixture.pointName,
            region: fixture.region,
            delegacion: fixture.delegacion,
            municipio: fixture.user.municipio,
            direccion: fixture.direccion,
            horario: fixture.horario,
            email: fixture.user.email,
            password: fixture.user.password,
            tarjetaNumero: fixture.cardholder.tarjetaNumero
          })),
          activation: {
            tarjetaNumero: ACTIVATION_FIXTURE.tarjetaNumero,
            curp: ACTIVATION_FIXTURE.curp
          },
          inactiveCard: {
            tarjetaNumero: INACTIVE_FIXTURE.tarjetaNumero,
            curp: INACTIVE_FIXTURE.curp
          }
        },
        null,
        2
      )
    );
  } catch (error) {
    await connection.rollback();
    console.error('Error durante el seed frontend local:', error);
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
}

if (require.main === module) {
  main();
}
