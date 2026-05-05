const jwt = require('jsonwebtoken');
const request = require('supertest');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
process.env.CURP_HASH_SECRET = process.env.CURP_HASH_SECRET || 'curp-test-secret';
process.env.FIELD_ENCRYPTION_KEY = process.env.FIELD_ENCRYPTION_KEY || 'field-test-secret';

const createMockState = () => ({
  users: [
    {
      id: 1,
      nombre: 'Carlos',
      apellidos: 'Lopez',
      email: 'beneficiary@example.com',
      role: 'beneficiary',
      status: 'active',
      session_version: 0
    },
    {
      id: 2,
      nombre: 'Ana',
      apellidos: 'Admin',
      email: 'admin@example.com',
      role: 'admin',
      status: 'active',
      session_version: 0
    }
  ],
  categorias: [
    { id: 1, nombre: 'Restaurantes' },
    { id: 2, nombre: 'Salud' }
  ],
  municipios: [
    { id: 1, nombre: 'Tijuana' },
    { id: 2, nombre: 'Mexicali' }
  ],
  beneficios: [
    {
      id: 1,
      nombre: 'Cafe Centro',
      descripcion: 'Cafe con descuento.',
      categoria_id: 1,
      municipio_id: 1,
      descuento: '20% de descuento',
      direccion: 'Av. Uno 123',
      horario: '08:00 - 20:00',
      lat: '32.514900',
      lng: '-117.038200',
      is_active: 1,
      is_visible_to_beneficiary: 1,
      published_at: new Date('2026-04-29T15:00:00Z'),
      headline: 'Nuevo beneficio en cafeterias',
      summary: 'Aprovecha 20% de descuento en bebidas participantes.',
      image_url: 'https://cdn.example.com/cafe-centro.jpg'
    },
    {
      id: 2,
      nombre: 'Gym Norte',
      descripcion: 'Mensualidad con descuento.',
      categoria_id: 2,
      municipio_id: 2,
      descuento: '15% de descuento',
      direccion: 'Av. Dos 456',
      horario: '06:00 - 22:00',
      lat: '32.624500',
      lng: '-115.452300',
      is_active: 1,
      is_visible_to_beneficiary: 1,
      published_at: new Date('2026-04-30T15:00:00Z'),
      headline: 'Nuevo beneficio para activarte',
      summary: 'Mensualidad con descuento especial.',
      image_url: null
    },
    {
      id: 3,
      nombre: 'Oculto',
      descripcion: 'No visible',
      categoria_id: 1,
      municipio_id: 1,
      descuento: '5%',
      direccion: null,
      horario: null,
      lat: null,
      lng: null,
      is_active: 1,
      is_visible_to_beneficiary: 0,
      published_at: new Date('2026-05-01T10:00:00Z'),
      headline: null,
      summary: null,
      image_url: null
    },
    {
      id: 4,
      nombre: 'Inactivo',
      descripcion: 'No activo',
      categoria_id: 1,
      municipio_id: 1,
      descuento: '10%',
      direccion: null,
      horario: null,
      lat: null,
      lng: null,
      is_active: 0,
      is_visible_to_beneficiary: 1,
      published_at: new Date('2026-05-01T11:00:00Z'),
      headline: null,
      summary: null,
      image_url: null
    }
  ],
  nextBenefitId: 5,
  adminActivities: []
});

let mockState = createMockState();

function mockFindUserById(id) {
  return mockState.users.find((user) => user.id === Number(id)) || null;
}

function mockFindCategoriaById(id) {
  return mockState.categorias.find((item) => item.id === Number(id)) || null;
}

function mockFindMunicipioById(id) {
  return mockState.municipios.find((item) => item.id === Number(id)) || null;
}

function mockBuildBenefitRow(benefit) {
  return {
    id: benefit.id,
    nombre: benefit.nombre,
    categoria: mockFindCategoriaById(benefit.categoria_id)?.nombre || null,
    municipio: mockFindMunicipioById(benefit.municipio_id)?.nombre || null,
    descuento: benefit.descuento,
    direccion: benefit.direccion,
    horario: benefit.horario,
    descripcion: benefit.descripcion,
    lat: benefit.lat,
    lng: benefit.lng,
    is_active: benefit.is_active,
    is_visible_to_beneficiary: benefit.is_visible_to_beneficiary,
    published_at: benefit.published_at,
    headline: benefit.headline,
    summary: benefit.summary,
    image_url: benefit.image_url
  };
}

function mockFilterHighlights(params = [], limit = null) {
  let items = mockState.beneficios.filter(
    (benefit) => benefit.is_active === 1 && benefit.is_visible_to_beneficiary === 1 && benefit.published_at
  );

  if (params.length > 0) {
    const since = new Date(params[0]);
    items = items.filter((benefit) => benefit.published_at > since);
  }

  const sorted = items
    .sort((left, right) => {
      if (right.published_at.getTime() !== left.published_at.getTime()) {
        return right.published_at.getTime() - left.published_at.getTime();
      }
      return right.id - left.id;
    })
    .map(mockBuildBenefitRow);

  return typeof limit === 'number' ? sorted.slice(0, limit) : sorted;
}

jest.mock('../src/config/db', () => {
  const execute = jest.fn(async (sql, params = []) => {
    if (sql.includes('SELECT role, status, session_version FROM usuarios WHERE id = ?')) {
      const user = mockFindUserById(params[0]);
      return [user ? [{ role: user.role, status: user.status, session_version: user.session_version }] : [], []];
    }

    if (
      sql.includes('SELECT id, nombre, apellidos, email, role, status, session_version') &&
      sql.includes('FROM usuarios')
    ) {
      const user = mockFindUserById(params[0]);
      return [user ? [user] : [], []];
    }

    if (sql.includes('SELECT id FROM categorias WHERE id = ?')) {
      const categoria = mockFindCategoriaById(params[0]);
      return [categoria ? [{ id: categoria.id }] : [], []];
    }

    if (sql.includes('SELECT id FROM municipios WHERE id = ?')) {
      const municipio = mockFindMunicipioById(params[0]);
      return [municipio ? [{ id: municipio.id }] : [], []];
    }

    if (sql.includes('SELECT COUNT(*) AS total') && sql.includes('FROM beneficios b')) {
      return [[{ total: mockState.beneficios.length }], []];
    }

    if (
      sql.includes('FROM beneficios b') &&
      sql.includes('WHERE b.is_active = 1 AND b.is_visible_to_beneficiary = 1 AND b.published_at IS NOT NULL')
    ) {
      const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
      const limit = limitMatch ? Number(limitMatch[1]) : null;
      return [mockFilterHighlights(params, limit), []];
    }

    if (sql.includes('SELECT id FROM beneficios WHERE id = ?')) {
      const benefit = mockState.beneficios.find((item) => item.id === Number(params[0])) || null;
      return [benefit ? [{ id: benefit.id }] : [], []];
    }

    if (sql.includes('INSERT INTO beneficios')) {
      const benefit = {
        id: mockState.nextBenefitId++,
        nombre: params[0],
        descripcion: params[1],
        categoria_id: params[2],
        municipio_id: params[3],
        descuento: params[4],
        direccion: params[5],
        horario: params[6],
        lat: params[7],
        lng: params[8],
        is_active: params[9],
        is_visible_to_beneficiary: params[10],
        published_at: params[11],
        headline: params[12],
        summary: params[13],
        image_url: params[14]
      };
      mockState.beneficios.push(benefit);
      return [{ insertId: benefit.id, affectedRows: 1 }, []];
    }

    if (sql.includes('UPDATE beneficios SET')) {
      const benefitId = Number(params[params.length - 1]);
      const benefit = mockState.beneficios.find((item) => item.id === benefitId) || null;
      if (!benefit) {
        return [{ affectedRows: 0 }, []];
      }

      const assignments = sql
        .split('UPDATE beneficios SET ')[1]
        .split(' WHERE id = ?')[0]
        .split(',')
        .map((item) => item.trim().replace(' = ?', ''));

      assignments.forEach((field, index) => {
        benefit[field] = params[index];
      });

      return [{ affectedRows: 1 }, []];
    }

    if (sql.includes('INSERT INTO admin_activity_log')) {
      mockState.adminActivities.push(params);
      return [{ insertId: mockState.adminActivities.length, affectedRows: 1 }, []];
    }

    if (
      sql.includes('FROM beneficios b') &&
      sql.includes('LEFT JOIN categorias c ON b.categoria_id = c.id') &&
      sql.includes('WHERE b.id = ?')
    ) {
      const benefit = mockState.beneficios.find((item) => item.id === Number(params[0])) || null;
      return [benefit ? [mockBuildBenefitRow(benefit)] : [], []];
    }

    if (
      sql.includes('FROM beneficios b') &&
      sql.includes('LEFT JOIN categorias c ON b.categoria_id = c.id') &&
      sql.includes('LIMIT')
    ) {
      return [mockState.beneficios.map(mockBuildBenefitRow), []];
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

describe('catalog highlights and publication fields', () => {
  const beneficiaryToken = jwt.sign(
    {
      id: 1,
      sub: '1',
      role: 'beneficiary',
      status: 'active',
      token_type: 'user',
      session_version: 0
    },
    process.env.JWT_SECRET,
    {
      issuer: 'api_tj:user',
      audience: 'api_tj:public'
    }
  );

  const adminToken = jwt.sign(
    {
      id: 2,
      sub: '2',
      role: 'admin',
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

  beforeEach(() => {
    mockState = createMockState();
    jest.clearAllMocks();
  });

  test('GET /api/v1/catalog/highlights devuelve el beneficio mas reciente por default', async () => {
    const response = await request(app)
      .get('/api/v1/catalog/highlights')
      .set('Authorization', `Bearer ${beneficiaryToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      id: 2,
      nombre: 'Gym Norte',
      publishedAt: '2026-04-30T15:00:00.000Z',
      headline: 'Nuevo beneficio para activarte'
    });
    expect(response.body).toHaveProperty('generatedAt');
  });

  test('GET /api/v1/catalog/highlights filtra por since y devuelve [] si no hay novedades', async () => {
    const response = await request(app)
      .get('/api/v1/catalog/highlights?since=2026-04-30T15:00:00Z')
      .set('Authorization', `Bearer ${beneficiaryToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.items).toEqual([]);
  });

  test('GET /api/v1/catalog/highlights respeta limit y excluye beneficios inactivos o invisibles', async () => {
    const response = await request(app)
      .get('/api/v1/catalog/highlights?limit=3')
      .set('Authorization', `Bearer ${beneficiaryToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.items).toHaveLength(2);
    expect(response.body.items.map((item) => item.id)).toEqual([2, 1]);
  });

  test('GET /api/v1/catalog/highlights rechaza since y limit invalidos', async () => {
    const invalidSince = await request(app)
      .get('/api/v1/catalog/highlights?since=no-es-fecha')
      .set('Authorization', `Bearer ${beneficiaryToken}`);
    expect(invalidSince.statusCode).toBe(422);
    expect(invalidSince.body).toEqual({
      message: 'El parametro since debe tener formato ISO 8601.'
    });

    const invalidLimit = await request(app)
      .get('/api/v1/catalog/highlights?limit=0')
      .set('Authorization', `Bearer ${beneficiaryToken}`);
    expect(invalidLimit.statusCode).toBe(422);
    expect(invalidLimit.body).toEqual({
      message: 'El parametro limit debe ser un entero entre 1 y 3.'
    });
  });

  test('POST /api/v1/catalog setea publishedAt y persiste campos nuevos', async () => {
    const response = await request(app)
      .post('/api/v1/catalog')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nombre: 'Spa Joven',
        descripcion: 'Nuevo spa',
        categoriaId: 2,
        municipioId: 1,
        descuento: '25%',
        direccion: 'Av. Tres 789',
        horario: '09:00 - 18:00',
        lat: 32.5,
        lng: -117.0,
        isActive: true,
        isVisibleToBeneficiary: true,
        headline: 'Nuevo beneficio de bienestar',
        summary: 'Spa con descuento para beneficiarios.',
        imageUrl: 'https://cdn.example.com/spa-joven.jpg'
      });

    expect(response.statusCode).toBe(201);
    expect(response.body).toMatchObject({
      nombre: 'Spa Joven',
      isActive: true,
      isVisibleToBeneficiary: true,
      headline: 'Nuevo beneficio de bienestar',
      summary: 'Spa con descuento para beneficiarios.',
      imageUrl: 'https://cdn.example.com/spa-joven.jpg'
    });
    expect(response.body.publishedAt).toMatch(/2026|20\d{2}/);
  });

  test('PUT /api/v1/catalog/:id no modifica publishedAt y actualiza nuevos campos', async () => {
    const originalPublishedAt = mockState.beneficios[0].published_at.toISOString();

    const response = await request(app)
      .put('/api/v1/catalog/1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        headline: 'Titulo actualizado',
        summary: 'Resumen actualizado',
        imageUrl: 'https://cdn.example.com/cafe-centro-nuevo.jpg',
        isActive: false,
        isVisibleToBeneficiary: false
      });

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      id: 1,
      headline: 'Titulo actualizado',
      summary: 'Resumen actualizado',
      imageUrl: 'https://cdn.example.com/cafe-centro-nuevo.jpg',
      isActive: false,
      isVisibleToBeneficiary: false,
      publishedAt: originalPublishedAt
    });
  });
});
