const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// Mockear la capa de base de datos para no depender de MySQL en las pruebas
jest.mock('../src/config/db', () => {
  const mockExecute = jest.fn().mockImplementation(async (sql) => {
    if (typeof sql === 'string' && sql.includes('SELECT role FROM usuarios')) {
      return [[{ role: 'reader' }], []];
    }
    if (typeof sql === 'string' && sql.includes('COUNT(*)')) {
      return [[{ total: 0 }], []];
    }
    return [[], []];
  });
  const mockConnection = {
    execute: mockExecute,
    release: jest.fn().mockResolvedValue(),
    beginTransaction: jest.fn().mockResolvedValue(),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue()
  };
  return {
    execute: mockExecute,
    getConnection: jest.fn().mockResolvedValue(mockConnection)
  };
});

const app = require('../src/index');

describe('Pruebas de API', () => {
  const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET);

  test('GET /health responde con 200 { ok: true }', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  test('GET /api/v1/catalog responde con 200 y estructura de lista', async () => {
    const res = await request(app)
      .get('/api/v1/catalog')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('items');
  });

  test('POST /api/v1/auth/login sin credenciales devuelve 400', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({});
    expect(res.statusCode).toBe(400);
  });

  test('POST /api/v1/register sin campos obligatorios devuelve 400', async () => {
    const res = await request(app).post('/api/v1/register').send({});
    expect(res.statusCode).toBe(400);
  });

  test('POST /api/v1/auth/otp/send sin curp devuelve 400', async () => {
    const res = await request(app).post('/api/v1/auth/otp/send').send({});
    expect(res.statusCode).toBe(400);
  });

  test('POST /api/v1/cardholders/lookup sin curp devuelve 422', async () => {
    const res = await request(app).post('/api/v1/cardholders/lookup').send({});
    expect(res.statusCode).toBe(422);
  });

  test('POST /api/v1/cardholders/ABCD001122HDFRRN07/account sin password devuelve 422', async () => {
    const res = await request(app)
      .post('/api/v1/cardholders/ABCD001122HDFRRN07/account')
      .send({ username: 'usuario.tj' });
    expect(res.statusCode).toBe(422);
  });
});
