const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const request = require('supertest');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.CURP_HASH_SECRET = process.env.CURP_HASH_SECRET || 'curp-test-secret';
process.env.FIELD_ENCRYPTION_KEY = process.env.FIELD_ENCRYPTION_KEY || 'field-test-secret';
process.env.PASSWORD_RESET_DEBUG = 'true';
process.env.PASSWORD_RESET_URL_BASE = 'https://beneficiario.example.com/reset-password';

const { buildCurpLookup } = require('../src/services/curpHashService');
const { encryptString } = require('../src/services/fieldEncryptionService');
const {
  JWT_SECRET,
  USER_TOKEN_AUDIENCE,
  USER_TOKEN_ISSUER
} = require('../src/config/tokenConfig');

const BENEFICIARY_CURP = 'LOMC990505HSPLPM02';
const ACTIVATION_CURP = 'MELR000202MSPSRD06';
const BENEFICIARY_CARD = 'TJ-1000';
const ACTIVATION_CARD = 'TJ-2000';

function buildEncryptedPayload(value) {
  const encrypted = encryptString(value);
  return {
    payload_ciphertext: encrypted?.payload_ciphertext || null,
    payload_iv: encrypted?.payload_iv || null,
    payload_tag: encrypted?.payload_tag || null
  };
}

const catalogItems = [
  {
    id: 1,
    nombre: 'Cafe Frontera',
    categoria: 'Restaurantes',
    municipio: 'Tijuana',
    descuento: '20% en consumo presentando la tarjeta',
    direccion: 'Av. Revolucion 123',
    horario: 'L-D 08:00 - 22:00',
    descripcion: 'Coffee shop',
    lat: '32.52151000',
    lng: '-117.02454000'
  }
];

const baseState = () => {
  const beneficiaryLookup = buildCurpLookup(BENEFICIARY_CURP);
  const activationLookup = buildCurpLookup(ACTIVATION_CURP);
  const beneficiaryNombre = buildEncryptedPayload('Carlos');
  const beneficiaryApellido = buildEncryptedPayload('Lopez Mendez');
  const activationNombre = buildEncryptedPayload('Mariana');
  const activationApellido = buildEncryptedPayload('Estrada Ruiz');
  return {
    users: [
      {
        id: 1,
        nombre: 'Carlos',
        apellidos: 'Lopez Mendez',
        email: 'beneficiary@example.com',
        telefono: '6641234567',
        municipio_id: 1,
        municipio: 'Tijuana',
        password_hash: bcrypt.hashSync('LegacyPassword1!', 4),
        role: 'beneficiary',
        status: 'active',
        session_version: 0,
        cardholder_sync_id: 1,
        creditos: 0,
        foto_url: null,
        portada_url: null,
        last_login_at: null,
        last_failed_login_at: null
      },
      {
        id: 2,
        nombre: 'Roberto',
        apellidos: 'Reader',
        email: 'reader.admin@example.com',
        telefono: '6649999999',
        municipio_id: 1,
        municipio: 'Tijuana',
        password_hash: bcrypt.hashSync('Reader1234!xx', 4),
        role: 'reader',
        status: 'active',
        session_version: 0,
        cardholder_sync_id: null,
        creditos: 0,
        foto_url: null,
        portada_url: null,
        last_login_at: null,
        last_failed_login_at: null
      }
    ],
    cardholdersSync: [
      {
        id: 1,
        curp_hash: beneficiaryLookup.curpHash,
        curp_masked: beneficiaryLookup.curpMasked,
        tarjeta_numero: BENEFICIARY_CARD,
        status: 'active',
        account_user_id: 1,
        activation_verified_until: null,
        auth0_user_id: null,
        nombres_ciphertext: beneficiaryNombre.payload_ciphertext,
        nombres_iv: beneficiaryNombre.payload_iv,
        nombres_tag: beneficiaryNombre.payload_tag,
        apellido_ciphertext: beneficiaryApellido.payload_ciphertext,
        apellido_iv: beneficiaryApellido.payload_iv,
        apellido_tag: beneficiaryApellido.payload_tag,
        municipio_id: 1
      },
      {
        id: 2,
        curp_hash: activationLookup.curpHash,
        curp_masked: activationLookup.curpMasked,
        tarjeta_numero: ACTIVATION_CARD,
        status: 'active',
        account_user_id: null,
        activation_verified_until: null,
        auth0_user_id: null,
        nombres_ciphertext: activationNombre.payload_ciphertext,
        nombres_iv: activationNombre.payload_iv,
        nombres_tag: activationNombre.payload_tag,
        apellido_ciphertext: activationApellido.payload_ciphertext,
        apellido_iv: activationApellido.payload_iv,
        apellido_tag: activationApellido.payload_tag,
        municipio_id: 2
      }
    ],
    refreshTokens: [],
    passwordResetTokens: [],
    userQrTokens: [
      {
        id: 1,
        user_id: 1,
        token_value: 'TOKENBENEF',
        valid_from: '2026-06-01',
        valid_until: '2026-06-30',
        status: 'active'
      }
    ],
    nextUserId: 3,
    nextRefreshTokenId: 1,
    nextPasswordResetId: 1
  };
};

let state = baseState();

function findUserById(id) {
  return state.users.find((user) => user.id === Number(id)) || null;
}

function findUserByEmail(email) {
  return state.users.find((user) => user.email === String(email).trim().toLowerCase()) || null;
}

function findCardholderByTarjeta(tarjetaNumero) {
  return state.cardholdersSync.find((item) => item.tarjeta_numero === tarjetaNumero) || null;
}

function buildSessionRow(user) {
  const cardholder = state.cardholdersSync.find((item) => item.id === user.cardholder_sync_id) || null;
  return {
    id: user.id,
    nombre: user.nombre,
    apellidos: user.apellidos,
    email: user.email,
    password_hash: user.password_hash,
    role: user.role,
    status: user.status,
    session_version: user.session_version,
    cardholder_sync_id: user.cardholder_sync_id,
    tarjeta_numero: cardholder?.tarjeta_numero || null,
    nombres_ciphertext: cardholder?.nombres_ciphertext || null,
    nombres_iv: cardholder?.nombres_iv || null,
    nombres_tag: cardholder?.nombres_tag || null,
    apellido_ciphertext: cardholder?.apellido_ciphertext || null,
    apellido_iv: cardholder?.apellido_iv || null,
    apellido_tag: cardholder?.apellido_tag || null,
    municipio_id: cardholder?.municipio_id || null
  };
}

function buildProfileRow(user) {
  const cardholder = state.cardholdersSync.find((item) => item.id === user.cardholder_sync_id) || null;
  return {
    id: user.id,
    nombre: user.nombre,
    apellidos: user.apellidos,
    email: user.email,
    telefono: user.telefono,
    creditos: user.creditos,
    role: user.role,
    status: user.status,
    fotoUrl: user.foto_url,
    portadaUrl: user.portada_url,
    cardholderSyncId: user.cardholder_sync_id,
    municipio: user.municipio,
    tarjetaNumero: cardholder?.tarjeta_numero || null,
    nombres_ciphertext: cardholder?.nombres_ciphertext || null,
    nombres_iv: cardholder?.nombres_iv || null,
    nombres_tag: cardholder?.nombres_tag || null,
    apellido_ciphertext: cardholder?.apellido_ciphertext || null,
    apellido_iv: cardholder?.apellido_iv || null,
    apellido_tag: cardholder?.apellido_tag || null
  };
}

function mockExecuteSql(sql, params = []) {
  if (sql.includes('SELECT role, status, session_version FROM usuarios WHERE id = ?')) {
    const user = findUserById(params[0]);
    return [user ? [{ role: user.role, status: user.status, session_version: user.session_version }] : [], []];
  }

  if (sql.includes('SELECT COUNT(*) AS total') && sql.includes('FROM beneficios b')) {
    return [[{ total: catalogItems.length }], []];
  }

  if (sql.includes('FROM beneficios b') && sql.includes('LIMIT')) {
    return [catalogItems, []];
  }

  if (
    sql.includes('SELECT u.id, u.nombre, u.apellidos, u.email, u.telefono, u.creditos, u.role, u.status') &&
    sql.includes('WHERE u.id = ?')
  ) {
    const user = findUserById(params[0]);
    return [user ? [buildProfileRow(user)] : [], []];
  }

  if (
    sql.includes('SELECT u.id, u.nombre, u.apellidos, u.email, u.password_hash, u.role, u.status') &&
    sql.includes('WHERE u.email = ?')
  ) {
    const user = findUserByEmail(params[0]);
    return [user ? [buildSessionRow(user)] : [], []];
  }

  if (
    sql.includes('SELECT u.id, u.nombre, u.apellidos, u.email, u.password_hash, u.role, u.status') &&
    sql.includes('WHERE u.id = ?')
  ) {
    const user = findUserById(params[0]);
    return [user ? [buildSessionRow(user)] : [], []];
  }

  if (
    sql.includes('SELECT id, token_value, valid_from') &&
    sql.includes('FROM user_qr_tokens') &&
    sql.includes('WHERE user_id = ?')
  ) {
    const token =
      state.userQrTokens.find((item) => item.user_id === Number(params[0]) && item.status === 'active') || null;
    return [token ? [token] : [], []];
  }

  if (sql.includes('UPDATE usuarios SET last_login_at = ?')) {
    const user = findUserById(params[1]);
    if (user) {
      user.last_login_at = params[0];
      user.last_failed_login_at = null;
    }
    return [{ affectedRows: user ? 1 : 0 }, []];
  }

  if (sql.includes('UPDATE usuarios SET last_failed_login_at = ?')) {
    const user = findUserById(params[1]);
    if (user) {
      user.last_failed_login_at = params[0];
    }
    return [{ affectedRows: user ? 1 : 0 }, []];
  }

  if (sql.includes('UPDATE usuarios SET password_hash = ? WHERE id = ?')) {
    const user = findUserById(params[1]);
    if (user) {
      user.password_hash = params[0];
    }
    return [{ affectedRows: user ? 1 : 0 }, []];
  }

  if (sql.includes('INSERT INTO refresh_tokens')) {
    const token = {
      id: state.nextRefreshTokenId++,
      usuario_id: params[0],
      refresh_token: params[1],
      expiry_date: params[2],
      revoked_at: null,
      rotated_from: params[3]
    };
    state.refreshTokens.push(token);
    return [{ insertId: token.id, affectedRows: 1 }, []];
  }

  if (sql.includes('FROM refresh_tokens rt') && sql.includes('WHERE rt.refresh_token = ?')) {
    const token = state.refreshTokens.find((item) => item.refresh_token === params[0]) || null;
    if (!token) {
      return [[], []];
    }
    const user = findUserById(token.usuario_id);
    const sessionRow = buildSessionRow(user);
    return [[{
      id: token.id,
      usuario_id: token.usuario_id,
      refresh_token: token.refresh_token,
      expiry_date: token.expiry_date,
      revoked_at: token.revoked_at,
      rotated_from: token.rotated_from,
      user_id: user.id,
      nombre: sessionRow.nombre,
      apellidos: sessionRow.apellidos,
      email: sessionRow.email,
      password_hash: sessionRow.password_hash,
      role: sessionRow.role,
      status: sessionRow.status,
      session_version: sessionRow.session_version,
      cardholder_sync_id: sessionRow.cardholder_sync_id,
      tarjeta_numero: sessionRow.tarjeta_numero,
      nombres_ciphertext: sessionRow.nombres_ciphertext,
      nombres_iv: sessionRow.nombres_iv,
      nombres_tag: sessionRow.nombres_tag,
      apellido_ciphertext: sessionRow.apellido_ciphertext,
      apellido_iv: sessionRow.apellido_iv,
      apellido_tag: sessionRow.apellido_tag,
      municipio_id: sessionRow.municipio_id
    }], []];
  }

  if (sql.includes('UPDATE refresh_tokens') && sql.includes('WHERE id = ?')) {
    const token = state.refreshTokens.find((item) => item.id === Number(params[1])) || null;
    if (token && !token.revoked_at) {
      token.revoked_at = params[0];
    }
    return [{ affectedRows: token ? 1 : 0 }, []];
  }

  if (sql.includes('UPDATE refresh_tokens') && sql.includes('WHERE usuario_id = ?')) {
    for (const token of state.refreshTokens.filter((item) => item.usuario_id === Number(params[1]))) {
      if (!token.revoked_at) {
        token.revoked_at = params[0];
      }
    }
    return [{ affectedRows: 1 }, []];
  }

  if (sql.includes('UPDATE usuarios SET session_version = session_version + 1 WHERE id = ?')) {
    const user = findUserById(params[0]);
    if (user) {
      user.session_version += 1;
    }
    return [{ affectedRows: user ? 1 : 0 }, []];
  }

  if (
    sql.includes('SELECT cs.id, cs.curp_hash, cs.status, cs.account_user_id') &&
    sql.includes('WHERE cs.tarjeta_numero = ?')
  ) {
    const cardholder = findCardholderByTarjeta(params[0]);
    if (!cardholder) {
      return [[], []];
    }
    const linkedUser = cardholder.account_user_id ? findUserById(cardholder.account_user_id) : null;
    return [[{
      id: cardholder.id,
      curp_hash: cardholder.curp_hash,
      status: cardholder.status,
      account_user_id: cardholder.account_user_id,
      linked_password_hash: linkedUser?.password_hash || null
    }], []];
  }

  if (
    sql.includes('SELECT id, status, account_user_id, activation_verified_until') &&
    sql.includes('FROM cardholders_sync')
  ) {
    const cardholder = findCardholderByTarjeta(params[0]);
    return [cardholder ? [{
      id: cardholder.id,
      status: cardholder.status,
      account_user_id: cardholder.account_user_id,
      activation_verified_until: cardholder.activation_verified_until,
      nombres_ciphertext: cardholder.nombres_ciphertext,
      nombres_iv: cardholder.nombres_iv,
      nombres_tag: cardholder.nombres_tag,
      apellido_ciphertext: cardholder.apellido_ciphertext,
      apellido_iv: cardholder.apellido_iv,
      apellido_tag: cardholder.apellido_tag,
      municipio_id: cardholder.municipio_id
    }] : [], []];
  }

  if (sql.includes('UPDATE cardholders_sync') && sql.includes('SET activation_verified_until = ?')) {
    const cardholder = state.cardholdersSync.find((item) => item.id === Number(params[1])) || null;
    if (cardholder) {
      cardholder.activation_verified_until = params[0];
    }
    return [{ affectedRows: cardholder ? 1 : 0 }, []];
  }

  if (
    sql.includes('SELECT id, email, role, status, cardholder_sync_id, password_hash') &&
    sql.includes('WHERE id = ?')
  ) {
    const user = findUserById(params[0]);
    return [user ? [{
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      cardholder_sync_id: user.cardholder_sync_id,
      password_hash: user.password_hash
    }] : [], []];
  }

  if (
    sql.includes('SELECT id, role, status, cardholder_sync_id, password_hash') &&
    sql.includes('WHERE email = ?')
  ) {
    const user = findUserByEmail(params[0]);
    return [user ? [{
      id: user.id,
      role: user.role,
      status: user.status,
      cardholder_sync_id: user.cardholder_sync_id,
      password_hash: user.password_hash
    }] : [], []];
  }

  if (sql.includes('UPDATE usuarios') && sql.includes("role = 'beneficiary'")) {
    const user = findUserById(params[6]);
    if (user) {
      user.nombre = params[0] || user.nombre;
      user.apellidos = params[1] || user.apellidos;
      user.email = params[2];
      user.municipio_id = params[3] || user.municipio_id;
      user.password_hash = params[4];
      user.cardholder_sync_id = params[5];
      user.role = 'beneficiary';
      user.status = 'active';
      user.session_version += 1;
    }
    return [{ affectedRows: user ? 1 : 0 }, []];
  }

  if (sql.includes('INSERT INTO usuarios') && sql.includes("'beneficiary'")) {
    const user = {
      id: state.nextUserId++,
      nombre: params[0],
      apellidos: params[1],
      email: params[2],
      telefono: null,
      municipio_id: params[3],
      municipio: null,
      password_hash: params[4],
      role: 'beneficiary',
      status: 'active',
      session_version: 0,
      cardholder_sync_id: params[5],
      creditos: 0,
      foto_url: null,
      portada_url: null,
      last_login_at: null,
      last_failed_login_at: null
    };
    state.users.push(user);
    return [{ insertId: user.id, affectedRows: 1 }, []];
  }

  if (sql.includes('UPDATE cardholders_sync') && sql.includes('SET account_user_id = ?')) {
    const cardholder = state.cardholdersSync.find((item) => item.id === Number(params[1])) || null;
    if (cardholder) {
      cardholder.account_user_id = Number(params[0]);
      cardholder.auth0_user_id = null;
      cardholder.activation_verified_until = null;
    }
    return [{ affectedRows: cardholder ? 1 : 0 }, []];
  }

  if (sql.includes('UPDATE password_reset_tokens') && sql.includes('WHERE usuario_id = ?')) {
    for (const token of state.passwordResetTokens.filter((item) => item.usuario_id === Number(params[1]))) {
      if (!token.consumed_at) {
        token.consumed_at = params[0];
      }
    }
    return [{ affectedRows: 1 }, []];
  }

  if (sql.includes('INSERT INTO password_reset_tokens')) {
    const token = {
      id: state.nextPasswordResetId++,
      usuario_id: params[0],
      token_hash: params[1],
      expires_at: params[2],
      consumed_at: null
    };
    state.passwordResetTokens.push(token);
    return [{ insertId: token.id, affectedRows: 1 }, []];
  }

  if (sql.includes('FROM password_reset_tokens prt') && sql.includes('WHERE prt.token_hash = ?')) {
    const token = state.passwordResetTokens.find((item) => item.token_hash === params[0]) || null;
    if (!token) {
      return [[], []];
    }
    const user = findUserById(token.usuario_id);
    return [[{
      id: token.id,
      usuario_id: token.usuario_id,
      expires_at: token.expires_at,
      consumed_at: token.consumed_at,
      user_id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      session_version: user.session_version
    }], []];
  }

  if (sql.includes('UPDATE password_reset_tokens') && sql.includes('WHERE id = ?')) {
    const token = state.passwordResetTokens.find((item) => item.id === Number(params[1])) || null;
    if (token && !token.consumed_at) {
      token.consumed_at = params[0];
    }
    return [{ affectedRows: token ? 1 : 0 }, []];
  }

  if (
    sql.includes("UPDATE usuarios") &&
    sql.includes("status = 'active'") &&
    sql.includes('session_version = session_version + 1')
  ) {
    const user = findUserById(params[1]);
    if (user) {
      user.password_hash = params[0];
      user.status = 'active';
      user.session_version += 1;
    }
    return [{ affectedRows: user ? 1 : 0 }, []];
  }

  return [[], []];
}

jest.mock('../src/config/db', () => {
  const execute = jest.fn((sql, params) => Promise.resolve(mockExecuteSql(sql, params)));
  const connection = {
    execute: jest.fn((sql, params) => Promise.resolve(mockExecuteSql(sql, params))),
    beginTransaction: jest.fn().mockResolvedValue(),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
    release: jest.fn()
  };

  return {
    execute,
    getConnection: jest.fn().mockResolvedValue(connection),
    __connection: connection
  };
});

const app = require('../src/index');

describe('beneficiary local auth flow', () => {
  beforeEach(() => {
    state = baseState();
    jest.clearAllMocks();
  });

  test('login rehashea bcrypt a argon2 y permite consumir catalogo', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'beneficiary@example.com', password: 'LegacyPassword1!' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('accessToken');
    expect(response.body.user).toMatchObject({
      email: 'beneficiary@example.com',
      role: 'beneficiary'
    });
    expect(response.headers['set-cookie'][0]).toContain('tj_refresh_token=');
    expect(findUserById(1).password_hash.startsWith('$argon2id$')).toBe(true);

    const catalog = await request(app)
      .get('/api/v1/catalog')
      .set('Authorization', `Bearer ${response.body.accessToken}`);
    expect(catalog.statusCode).toBe(200);
    expect(catalog.body.items).toHaveLength(1);
  });

  test('verify-activation + complete-activation crea cuenta local y entrega sesion inicial', async () => {
    const verify = await request(app)
      .post('/api/v1/cardholders/verify-activation')
      .send({ tarjeta_numero: ACTIVATION_CARD, curp: ACTIVATION_CURP });
    expect(verify.statusCode).toBe(200);

    const complete = await request(app)
      .post('/api/v1/cardholders/complete-activation')
      .send({
        tarjeta_numero: ACTIVATION_CARD,
        email: 'nuevo.beneficiario@example.com',
        password: 'NuevaPassword123!',
        password_confirmation: 'NuevaPassword123!'
      });

    expect(complete.statusCode).toBe(200);
    expect(complete.body).toMatchObject({
      activated: true,
      user: {
        email: 'nuevo.beneficiario@example.com',
        role: 'beneficiary'
      }
    });
    expect(complete.headers['set-cookie'][0]).toContain('tj_refresh_token=');
    expect(findCardholderByTarjeta(ACTIVATION_CARD).account_user_id).toBe(3);
    expect(findUserById(3)).toMatchObject({
      nombre: 'Mariana',
      apellidos: 'Estrada Ruiz',
      municipio_id: 2
    });
  });

  test('login y refresh usan fallback desde cardholders_sync si nombre y apellidos del usuario estan vacios', async () => {
    const beneficiary = findUserById(1);
    beneficiary.nombre = null;
    beneficiary.apellidos = null;

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'beneficiary@example.com', password: 'LegacyPassword1!' });

    expect(login.statusCode).toBe(200);
    expect(login.body.user).toMatchObject({
      email: 'beneficiary@example.com',
      nombreCompleto: 'Carlos Lopez Mendez'
    });

    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', login.headers['set-cookie'][0]);

    expect(refresh.statusCode).toBe(200);
    expect(refresh.body.user).toMatchObject({
      email: 'beneficiary@example.com',
      nombreCompleto: 'Carlos Lopez Mendez'
    });
  });

  test('GET /me usa cardholders_sync cifrado como fallback cuando usuarios.nombre y apellidos son null', async () => {
    const beneficiary = findUserById(1);
    beneficiary.nombre = null;
    beneficiary.apellidos = null;
    const accessToken = jwt.sign(
      {
        id: beneficiary.id,
        sub: String(beneficiary.id),
        role: beneficiary.role,
        status: beneficiary.status,
        token_type: 'user',
        session_version: beneficiary.session_version
      },
      JWT_SECRET,
      {
        issuer: USER_TOKEN_ISSUER,
        audience: USER_TOKEN_AUDIENCE
      }
    );

    const profile = await request(app)
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(profile.statusCode).toBe(200);
    expect(profile.body).toMatchObject({
      id: 1,
      nombre: 'Carlos',
      apellidos: 'Lopez Mendez',
      nombreCompleto: 'Carlos Lopez Mendez',
      titular: {
        nombre: 'Carlos',
        primerApellido: 'Lopez'
      },
      titularNombre: 'Carlos',
      titularPrimerApellido: 'Lopez',
      nombreTitular: 'Carlos',
      primerApellidoTitular: 'Lopez',
      email: 'beneficiary@example.com',
      cardholderSyncId: 1,
      tarjetaNumero: BENEFICIARY_CARD
    });
    expect(profile.body).not.toHaveProperty('nombres_ciphertext');
    expect(profile.body).not.toHaveProperty('nombres_iv');
    expect(profile.body).not.toHaveProperty('nombres_tag');
    expect(profile.body).not.toHaveProperty('apellido_ciphertext');
    expect(profile.body).not.toHaveProperty('apellido_iv');
    expect(profile.body).not.toHaveProperty('apellido_tag');
  });

  test('refresh rota cookie y el reuse invalida sesiones previas', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'beneficiary@example.com', password: 'LegacyPassword1!' });
    const originalAccessToken = login.body.accessToken;
    const originalCookie = login.headers['set-cookie'][0];

    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', originalCookie);
    expect(refresh.statusCode).toBe(200);
    const rotatedCookie = refresh.headers['set-cookie'][0];
    expect(rotatedCookie).not.toBe(originalCookie);

    const reuse = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', originalCookie);
    expect(reuse.statusCode).toBe(401);

    const catalogWithOldAccessToken = await request(app)
      .get('/api/v1/catalog')
      .set('Authorization', `Bearer ${originalAccessToken}`);
    expect(catalogWithOldAccessToken.statusCode).toBe(401);
  });

  test('forgot-password emite token debug y reset-password invalida sesiones previas', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'beneficiary@example.com', password: 'LegacyPassword1!' });
    const oldCookie = login.headers['set-cookie'][0];

    const forgot = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'beneficiary@example.com' });
    expect(forgot.statusCode).toBe(200);
    expect(forgot.body.debug).toHaveProperty('resetToken');

    const reset = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        token: forgot.body.debug.resetToken,
        password: 'PasswordNueva123!',
        password_confirmation: 'PasswordNueva123!'
      });
    expect(reset.statusCode).toBe(200);
    expect(reset.body).toEqual({
      reset: true,
      message: 'Contrasena actualizada correctamente.'
    });

    const refreshOldSession = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', oldCookie);
    expect(refreshOldSession.statusCode).toBe(401);

    const relogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'beneficiary@example.com', password: 'PasswordNueva123!' });
    expect(relogin.statusCode).toBe(200);
  });
});
