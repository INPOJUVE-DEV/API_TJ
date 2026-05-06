const jwt = require('jsonwebtoken');
const request = require('supertest');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
process.env.CURP_HASH_SECRET = process.env.CURP_HASH_SECRET || 'curp-test-secret';
process.env.FIELD_ENCRYPTION_KEY = process.env.FIELD_ENCRYPTION_KEY || 'field-test-secret';

const mockState = {
  users: [
    {
      id: 1,
      nombre: 'Ana',
      apellidos: 'Admin',
      email: 'ana.admin@example.com',
      role: 'admin',
      status: 'active',
      session_version: 0
    },
    {
      id: 2,
      nombre: 'Roberto',
      apellidos: 'Reader',
      email: 'roberto.reader@example.com',
      role: 'reader',
      status: 'active',
      session_version: 0
    }
  ],
  categorias: [
    { id: 1, nombre: 'Restaurantes' },
    { id: 2, nombre: 'Salud' }
  ],
  municipios: [
    { id: 1, nombre: 'San Luis Potosi' },
    { id: 2, nombre: 'Ciudad Valles' }
  ],
  adminActivities: []
};

function mockCloneUser(user) {
  return {
    ...user,
    last_login_at: null,
    last_failed_login_at: null,
    created_at: null,
    updated_at: null,
    municipio: null
  };
}

function mockGetLookupCollection(lookup) {
  if (lookup === 'categorias') {
    return mockState.categorias;
  }
  if (lookup === 'municipios') {
    return mockState.municipios;
  }
  return null;
}

function mockFindLookupById(lookup, id) {
  return mockGetLookupCollection(lookup)?.find((item) => item.id === Number(id)) || null;
}

function mockFindUserById(id) {
  return mockState.users.find((user) => user.id === Number(id)) || null;
}

function mockNormalizeSql(sql) {
  return String(sql || '').replace(/\s+/g, ' ').trim();
}

jest.mock('../src/config/db', () => {
  const execute = jest.fn(async (sql, params = []) => {
    const normalizedSql = mockNormalizeSql(sql);

    if (
      normalizedSql.includes('SELECT id, nombre, apellidos, email, role, status, session_version') &&
      normalizedSql.includes('FROM usuarios')
    ) {
      const user = mockFindUserById(params[0]);
      return [user ? [mockCloneUser(user)] : [], []];
    }

    if (normalizedSql.includes('SELECT role, status, session_version FROM usuarios WHERE id = ? LIMIT 1')) {
      const user = mockFindUserById(params[0]);
      return [
        user
          ? [{ role: user.role, status: user.status, session_version: user.session_version }]
          : [],
        []
      ];
    }

    if (
      normalizedSql.includes('SELECT id, nombre, apellidos, email, role, status, session_version') &&
      normalizedSql.includes('WHERE id = ?')
    ) {
      const user = mockFindUserById(params[0]);
      return [user ? [mockCloneUser(user)] : [], []];
    }

    if (normalizedSql.includes('SELECT id, nombre FROM categorias ORDER BY nombre ASC')) {
      return [[...mockState.categorias].sort((a, b) => a.nombre.localeCompare(b.nombre)), []];
    }

    if (normalizedSql.includes('SELECT id, nombre FROM municipios ORDER BY nombre ASC')) {
      return [[...mockState.municipios].sort((a, b) => a.nombre.localeCompare(b.nombre)), []];
    }

    if (normalizedSql.includes('SELECT id, nombre FROM categorias WHERE nombre LIKE ? ORDER BY nombre ASC')) {
      const q = String(params[0] || '').replace(/%/g, '').toLowerCase();
      const rows = mockState.categorias.filter((item) => item.nombre.toLowerCase().includes(q));
      return [rows, []];
    }

    if (normalizedSql.includes('SELECT id, nombre FROM municipios WHERE nombre LIKE ? ORDER BY nombre ASC')) {
      const q = String(params[0] || '').replace(/%/g, '').toLowerCase();
      const rows = mockState.municipios.filter((item) => item.nombre.toLowerCase().includes(q));
      return [rows, []];
    }

    if (normalizedSql.includes('SELECT id, nombre FROM categorias WHERE id = ? LIMIT 1')) {
      const row = mockFindLookupById('categorias', params[0]);
      return [row ? [row] : [], []];
    }

    if (normalizedSql.includes('SELECT id, nombre FROM municipios WHERE id = ? LIMIT 1')) {
      const row = mockFindLookupById('municipios', params[0]);
      return [row ? [row] : [], []];
    }

    if (normalizedSql.includes('INSERT INTO categorias (nombre) VALUES (?)')) {
      const nombre = params[0];
      if (mockState.categorias.some((item) => item.nombre.toLowerCase() === String(nombre).toLowerCase())) {
        const error = new Error('Duplicate');
        error.code = 'ER_DUP_ENTRY';
        throw error;
      }
      const id = Math.max(...mockState.categorias.map((item) => item.id)) + 1;
      mockState.categorias.push({ id, nombre });
      return [{ insertId: id }, []];
    }

    if (normalizedSql.includes('INSERT INTO municipios (nombre) VALUES (?)')) {
      const nombre = params[0];
      if (mockState.municipios.some((item) => item.nombre.toLowerCase() === String(nombre).toLowerCase())) {
        const error = new Error('Duplicate');
        error.code = 'ER_DUP_ENTRY';
        throw error;
      }
      const id = Math.max(...mockState.municipios.map((item) => item.id)) + 1;
      mockState.municipios.push({ id, nombre });
      return [{ insertId: id }, []];
    }

    if (normalizedSql.includes('UPDATE categorias SET nombre = ? WHERE id = ?')) {
      const row = mockFindLookupById('categorias', params[1]);
      if (mockState.categorias.some((item) => item.id !== Number(params[1]) && item.nombre.toLowerCase() === String(params[0]).toLowerCase())) {
        const error = new Error('Duplicate');
        error.code = 'ER_DUP_ENTRY';
        throw error;
      }
      if (row) {
        row.nombre = params[0];
      }
      return [{ affectedRows: row ? 1 : 0 }, []];
    }

    if (normalizedSql.includes('UPDATE municipios SET nombre = ? WHERE id = ?')) {
      const row = mockFindLookupById('municipios', params[1]);
      if (mockState.municipios.some((item) => item.id !== Number(params[1]) && item.nombre.toLowerCase() === String(params[0]).toLowerCase())) {
        const error = new Error('Duplicate');
        error.code = 'ER_DUP_ENTRY';
        throw error;
      }
      if (row) {
        row.nombre = params[0];
      }
      return [{ affectedRows: row ? 1 : 0 }, []];
    }

    if (normalizedSql.includes('DELETE FROM categorias WHERE id = ?')) {
      if (Number(params[0]) === 1) {
        const error = new Error('Referenced');
        error.code = 'ER_ROW_IS_REFERENCED_2';
        throw error;
      }
      const index = mockState.categorias.findIndex((item) => item.id === Number(params[0]));
      if (index >= 0) {
        mockState.categorias.splice(index, 1);
      }
      return [{ affectedRows: index >= 0 ? 1 : 0 }, []];
    }

    if (normalizedSql.includes('DELETE FROM municipios WHERE id = ?')) {
      const index = mockState.municipios.findIndex((item) => item.id === Number(params[0]));
      if (index >= 0) {
        mockState.municipios.splice(index, 1);
      }
      return [{ affectedRows: index >= 0 ? 1 : 0 }, []];
    }

    if (normalizedSql.includes('INSERT INTO admin_activity_log')) {
      mockState.adminActivities.push(params);
      return [{ insertId: mockState.adminActivities.length }, []];
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

function makeAdminToken(userId, role) {
  return jwt.sign(
    {
      id: userId,
      sub: String(userId),
      role,
      status: 'active',
      token_type: 'admin',
      session_version: 0
    },
    process.env.ADMIN_JWT_SECRET,
    {
      issuer: 'api_tj:admin',
      audience: 'api_tj:admin'
    }
  );
}

describe('admin lookups CRUD', () => {
  const adminToken = makeAdminToken(1, 'admin');
  const readerToken = makeAdminToken(2, 'reader');

  beforeEach(() => {
    mockState.categorias = [
      { id: 1, nombre: 'Restaurantes' },
      { id: 2, nombre: 'Salud' }
    ];
    mockState.municipios = [
      { id: 1, nombre: 'San Luis Potosi' },
      { id: 2, nombre: 'Ciudad Valles' }
    ];
    mockState.adminActivities.length = 0;
  });

  test('reader puede consultar catalogos y filtrar por q', async () => {
    const aggregate = await request(app)
      .get('/api/v1/admin/lookups?include=categorias,municipios')
      .set('Authorization', `Bearer ${readerToken}`);

    expect(aggregate.statusCode).toBe(200);
    expect(aggregate.body).toHaveProperty('categorias');
    expect(aggregate.body).toHaveProperty('municipios');

    const list = await request(app)
      .get('/api/v1/admin/lookups/categorias?q=sal')
      .set('Authorization', `Bearer ${readerToken}`);

    expect(list.statusCode).toBe(200);
    expect(list.body.items).toEqual([{ id: 2, nombre: 'Salud' }]);
  });

  test('reader puede consultar detalle por id y valida ids invalidos', async () => {
    const detail = await request(app)
      .get('/api/v1/admin/lookups/municipios/1')
      .set('Authorization', `Bearer ${readerToken}`);

    expect(detail.statusCode).toBe(200);
    expect(detail.body).toEqual({ id: 1, nombre: 'San Luis Potosi' });

    const invalidId = await request(app)
      .get('/api/v1/admin/lookups/municipios/abc')
      .set('Authorization', `Bearer ${readerToken}`);

    expect(invalidId.statusCode).toBe(422);
    expect(invalidId.body).toEqual({ message: 'id debe ser un entero positivo.' });
  });

  test('admin puede crear, editar y eliminar categoria', async () => {
    const create = await request(app)
      .post('/api/v1/admin/lookups/categorias')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: 'Educacion' });

    expect(create.statusCode).toBe(201);
    expect(create.body).toEqual({ id: 3, nombre: 'Educacion' });

    const update = await request(app)
      .patch('/api/v1/admin/lookups/categorias/3')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: 'Educacion y Cultura' });

    expect(update.statusCode).toBe(200);
    expect(update.body).toEqual({ id: 3, nombre: 'Educacion y Cultura' });

    const remove = await request(app)
      .delete('/api/v1/admin/lookups/categorias/3')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(remove.statusCode).toBe(204);
    expect(mockState.categorias.find((item) => item.id === 3)).toBeUndefined();
    expect(mockState.adminActivities).toHaveLength(3);
  });

  test('reader no puede mutar catalogos', async () => {
    const response = await request(app)
      .post('/api/v1/admin/lookups/municipios')
      .set('Authorization', `Bearer ${readerToken}`)
      .send({ nombre: 'Matehuala' });

    expect(response.statusCode).toBe(403);
  });

  test('valida lookup permitido, nombre requerido y duplicados', async () => {
    const invalidLookup = await request(app)
      .get('/api/v1/admin/lookups/foo')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(invalidLookup.statusCode).toBe(422);

    const missingName = await request(app)
      .post('/api/v1/admin/lookups/categorias')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(missingName.statusCode).toBe(422);
    expect(missingName.body).toEqual({ message: 'nombre es obligatorio.' });

    const duplicate = await request(app)
      .post('/api/v1/admin/lookups/categorias')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: 'Salud' });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.body).toEqual({ message: 'El nombre ya existe en este catalogo.' });
  });

  test('rechaza eliminar catalogo en uso', async () => {
    const response = await request(app)
      .delete('/api/v1/admin/lookups/categorias/1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({
      message: 'No se puede eliminar porque el registro esta en uso.'
    });
  });
});
