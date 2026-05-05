const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const request = require('supertest');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
process.env.CURP_HASH_SECRET = process.env.CURP_HASH_SECRET || 'curp-test-secret';
process.env.FIELD_ENCRYPTION_KEY = process.env.FIELD_ENCRYPTION_KEY || 'field-test-secret';
process.env.ADMIN_FRONTEND_ORIGIN = 'https://admin.example.com';
process.env.ADMIN_JWT_EXPIRATION = '8h';

const adminPassword = 'Admin1234!';
const readerPassword = 'Reader1234!';
const adminPasswordHash = bcrypt.hashSync(adminPassword, 4);
const readerPasswordHash = bcrypt.hashSync(readerPassword, 4);

const mockState = {
  users: [
    {
      id: 1,
      nombre: 'Ana',
      apellidos: 'Hernandez Ruiz',
      email: 'ana.hernandez@example.com',
      telefono: '4441234567',
      municipio_id: 1,
      municipio: 'San Luis Potosi',
      password_hash: adminPasswordHash,
      role: 'admin',
      status: 'active',
      session_version: 0,
      last_login_at: null,
      last_failed_login_at: null,
      cardholder_sync_id: null,
      auth0_user_id: null,
      created_at: new Date('2026-04-01T00:00:00Z'),
      updated_at: new Date('2026-04-01T00:00:00Z')
    },
    {
      id: 2,
      nombre: 'Carlos',
      apellidos: 'Lopez Mendez',
      email: 'carlos.lopez@example.com',
      telefono: '4819876543',
      municipio_id: 2,
      municipio: 'Ciudad Valles',
      password_hash: readerPasswordHash,
      role: 'reader',
      status: 'active',
      session_version: 0,
      last_login_at: null,
      last_failed_login_at: null,
      cardholder_sync_id: null,
      auth0_user_id: null,
      created_at: new Date('2026-04-02T00:00:00Z'),
      updated_at: new Date('2026-04-02T00:00:00Z')
    },
    {
      id: 3,
      nombre: 'Scanner',
      apellidos: 'Operador',
      email: 'scanner@tj.local',
      telefono: null,
      municipio_id: 1,
      municipio: 'San Luis Potosi',
      password_hash: bcrypt.hashSync('Scan1234!', 4),
      role: 'scanner',
      status: 'active',
      session_version: 0,
      last_login_at: null,
      last_failed_login_at: null,
      cardholder_sync_id: null,
      auth0_user_id: null,
      created_at: new Date('2026-04-03T00:00:00Z'),
      updated_at: new Date('2026-04-03T00:00:00Z')
    }
  ],
  adminActivities: []
};

function mockCloneUser(user) {
  return {
    ...user,
    created_at: user.created_at,
    updated_at: user.updated_at,
    last_login_at: user.last_login_at,
    last_failed_login_at: user.last_failed_login_at
  };
}

function mockFindUserByEmail(email) {
  return mockState.users.find((user) => user.email === email) || null;
}

function mockFindUserById(id) {
  return mockState.users.find((user) => user.id === id) || null;
}

jest.mock('../src/config/db', () => {
  const execute = jest.fn(async (sql, params = []) => {
    if (sql.includes('FROM usuarios') && sql.includes('WHERE email = ?')) {
      const user = mockFindUserByEmail(params[0]);
      return [user ? [mockCloneUser(user)] : [], []];
    }

    if (sql.includes('FROM usuarios u') && sql.includes('WHERE u.id = ?')) {
      const user = mockFindUserById(Number(params[0]));
      return [user ? [mockCloneUser(user)] : [], []];
    }

    if (sql.includes('FROM usuarios') && sql.includes('WHERE id = ?') && !sql.includes('WHERE u.id = ?')) {
      const user = mockFindUserById(Number(params[0]));
      return [user ? [mockCloneUser(user)] : [], []];
    }

    if (sql.includes('SELECT role, status, session_version FROM usuarios WHERE id = ?')) {
      const user = mockFindUserById(Number(params[0]));
      return [user ? [{ role: user.role, status: user.status, session_version: user.session_version }] : [], []];
    }

    if (sql.includes('UPDATE usuarios SET last_login_at = ?')) {
      const user = mockFindUserById(Number(params[1]));
      if (user) {
        user.last_login_at = params[0];
        user.last_failed_login_at = null;
      }
      return [{ affectedRows: user ? 1 : 0 }, []];
    }

    if (sql.includes('UPDATE usuarios SET last_failed_login_at = ?')) {
      const user = mockFindUserById(Number(params[1]));
      if (user) {
        user.last_failed_login_at = params[0];
      }
      return [{ affectedRows: user ? 1 : 0 }, []];
    }

    if (sql.includes('UPDATE usuarios SET session_version = session_version + 1')) {
      const user = mockFindUserById(Number(params[0]));
      if (user) {
        user.session_version += 1;
      }
      return [{ affectedRows: user ? 1 : 0 }, []];
    }

    if (sql.includes('INSERT INTO admin_activity_log')) {
      mockState.adminActivities.push(params);
      return [{ insertId: mockState.adminActivities.length }, []];
    }

    if (sql.includes('SELECT COUNT(*) AS total FROM beneficios')) {
      return [[{ total: 7 }], []];
    }

    if (sql.includes('FROM beneficiario_staging') && sql.includes('GROUP BY status')) {
      return [[
        { status: 'pending', total: 3 },
        { status: 'accepted', total: 9 },
        { status: 'rejected', total: 1 },
        { status: 'error', total: 2 }
      ], []];
    }

    if (sql.includes('FROM sync_audit_log')) {
      return [[{ lastRunAt: new Date('2026-04-28T10:00:00Z'), lastStatus: 'success', processed: 120 }], []];
    }

    if (sql.includes('SELECT role, status, COUNT(*) AS total') && sql.includes('GROUP BY role, status')) {
      return [[
        { role: 'admin', status: 'active', total: 1 },
        { role: 'reader', status: 'active', total: 1 },
        { role: 'scanner', status: 'active', total: 1 }
      ], []];
    }

    if (sql.includes('FROM integration_audit_log')) {
      return [[{ total: 4 }], []];
    }

    if (sql.includes('FROM staging_push_attempts')) {
      return [[{ attempted_at: new Date('2026-04-28T11:00:00Z'), status: 'accepted', response_status: 200 }], []];
    }

    if (sql.includes('SELECT COUNT(*) AS total') && sql.includes('FROM usuarios u')) {
      const total = mockState.users.filter((user) => ['admin', 'reader'].includes(user.role)).length;
      return [[{ total }], []];
    }

    if (sql.includes('FROM usuarios u') && sql.includes('ORDER BY u.created_at DESC')) {
      const rows = mockState.users
        .filter((user) => ['admin', 'reader'].includes(user.role))
        .map((user) => mockCloneUser(user));
      return [rows, []];
    }

    return [[], []];
  });

  return {
    execute,
    getConnection: jest.fn().mockResolvedValue({
      execute,
      release: jest.fn().mockResolvedValue(),
      beginTransaction: jest.fn().mockResolvedValue(),
      commit: jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue()
    })
  };
});

const app = require('../src/index');

describe('admin patch backend', () => {
  beforeEach(() => {
    mockState.users[0].session_version = 0;
    mockState.users[1].session_version = 0;
    mockState.users[0].last_login_at = null;
    mockState.users[0].last_failed_login_at = null;
    mockState.users[1].last_login_at = null;
    mockState.users[1].last_failed_login_at = null;
    mockState.adminActivities.length = 0;
  });

  test('admin login devuelve token y sesion enriquecida', async () => {
    const response = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: 'ana.hernandez@example.com', password: adminPassword });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('accessToken');
    expect(response.body).toMatchObject({
      authenticated: true,
      role: 'admin',
      status: 'active'
    });
  });

  test('scanner no puede iniciar sesion admin', async () => {
    const response = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: 'scanner@tj.local', password: 'Scan1234!' });

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ message: 'Credenciales invalidas' });
  });

  test('logout invalida el token admin por session_version', async () => {
    const login = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: 'ana.hernandez@example.com', password: adminPassword });
    const token = login.body.accessToken;

    const sessionBefore = await request(app)
      .get('/api/v1/admin/session')
      .set('Authorization', `Bearer ${token}`);
    expect(sessionBefore.statusCode).toBe(200);

    const logout = await request(app)
      .post('/api/v1/admin/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(logout.statusCode).toBe(204);

    const sessionAfter = await request(app)
      .get('/api/v1/admin/session')
      .set('Authorization', `Bearer ${token}`);
    expect(sessionAfter.statusCode).toBe(401);
  });

  test('reader puede consultar usuarios pero no crear', async () => {
    const readerToken = jwt.sign(
      {
        id: 2,
        sub: '2',
        role: 'reader',
        status: 'active',
        token_type: 'admin',
        session_version: 0
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h', issuer: 'api_tj:admin', audience: 'api_tj:admin' }
    );

    const listResponse = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${readerToken}`);
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.body.items).toHaveLength(2);

    const createResponse = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${readerToken}`)
      .send({
        nombre: 'Nuevo',
        apellidos: 'Usuario',
        email: 'nuevo@example.com',
        role: 'reader',
        status: 'active',
        password: 'Password123!'
      });
    expect(createResponse.statusCode).toBe(403);
  });

  test('dashboard admin entrega indicadores y rutas admin rechazan token no admin', async () => {
    const adminToken = jwt.sign(
      {
        id: 1,
        sub: '1',
        role: 'admin',
        status: 'active',
        token_type: 'admin',
        session_version: 0
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h', issuer: 'api_tj:admin', audience: 'api_tj:admin' }
    );
    const nonAdminToken = jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });

    const dashboardResponse = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Origin', 'https://admin.example.com');
    expect(dashboardResponse.statusCode).toBe(200);
    expect(dashboardResponse.body).toMatchObject({
      catalog: { benefits: 7 },
      integration: { failedCallsLast24h: 4 }
    });
    expect(dashboardResponse.headers['access-control-allow-origin']).toBe('https://admin.example.com');

    const forbidden = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${nonAdminToken}`);
    expect(forbidden.statusCode).toBe(401);
  });
});
