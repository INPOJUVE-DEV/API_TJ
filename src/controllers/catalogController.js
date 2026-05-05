const db = require('../config/db');
const { getClientIp, recordAdminActivity } = require('../services/adminActivityService');
const safeLogger = require('../utils/safeLogger');

const MAX_NAME_LENGTH = 160;
const MAX_DESC_LENGTH = 2000;
const MAX_DESCUENTO_LENGTH = 80;
const MAX_DIRECCION_LENGTH = 200;
const MAX_HORARIO_LENGTH = 120;
const MAX_SUMMARY_LENGTH = 255;
const MAX_IMAGE_URL_LENGTH = 255;
const MAX_LOOKUP_NAME_LENGTH = 120;
const LOOKUP_TABLES = new Set(['categorias', 'municipios']);
const HIGHLIGHTS_DEFAULT_LIMIT = 1;
const HIGHLIGHTS_MAX_LIMIT = 3;
const ISO_8601_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

const BASE_SELECT_QUERY = `SELECT b.id, b.nombre, c.nombre AS categoria, m.nombre AS municipio,
  b.descuento, b.direccion, b.horario, b.descripcion, b.lat, b.lng, b.is_active,
  b.is_visible_to_beneficiary, b.published_at, b.headline, b.summary, b.image_url
  FROM beneficios b
  LEFT JOIN categorias c ON b.categoria_id = c.id
  LEFT JOIN municipios m ON b.municipio_id = m.id`;

function buildError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function normalizeRequiredString(value, field, maxLength) {
  if (typeof value !== 'string') {
    throw buildError(422, `El campo ${field} es obligatorio.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw buildError(422, `El campo ${field} es obligatorio.`);
  }
  if (trimmed.length > maxLength) {
    throw buildError(422, `El campo ${field} excede la longitud permitida.`);
  }
  return trimmed;
}

function normalizeOptionalString(value, field, maxLength) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    throw buildError(422, `El campo ${field} debe ser texto.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > maxLength) {
    throw buildError(422, `El campo ${field} excede la longitud permitida.`);
  }
  return trimmed;
}

function normalizeOptionalBoolean(value, field) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'boolean') {
    throw buildError(422, `El campo ${field} debe ser booleano.`);
  }
  return value;
}

function parsePositiveInt(value, field) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw buildError(422, `El campo ${field} debe ser un entero positivo.`);
  }
  return parsed;
}

function parseOptionalNumber(value, field, min, max) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw buildError(422, `El campo ${field} debe ser numerico.`);
  }
  if (parsed < min || parsed > max) {
    throw buildError(422, `El campo ${field} esta fuera de rango.`);
  }
  return parsed;
}

function normalizeDateValue(value) {
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return null;
  }
  return value.toISOString();
}

function mapBenefitRow(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    categoria: row.categoria || null,
    municipio: row.municipio || null,
    descuento: row.descuento || null,
    direccion: row.direccion || null,
    horario: row.horario || null,
    descripcion: row.descripcion || null,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    isActive: row.is_active === null || row.is_active === undefined ? true : Boolean(row.is_active),
    isVisibleToBeneficiary:
      row.is_visible_to_beneficiary === null || row.is_visible_to_beneficiary === undefined
        ? true
        : Boolean(row.is_visible_to_beneficiary),
    publishedAt: normalizeDateValue(row.published_at),
    headline: row.headline || null,
    summary: row.summary || null,
    imageUrl: row.image_url || null
  };
}

function parseHighlightsSince(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string' || !ISO_8601_REGEX.test(value.trim())) {
    throw buildError(422, 'El parametro since debe tener formato ISO 8601.');
  }
  const parsed = new Date(value.trim());
  if (Number.isNaN(parsed.getTime())) {
    throw buildError(422, 'El parametro since debe tener formato ISO 8601.');
  }
  return parsed;
}

function parseHighlightsLimit(value) {
  if (value === undefined || value === null || value === '') {
    return HIGHLIGHTS_DEFAULT_LIMIT;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > HIGHLIGHTS_MAX_LIMIT) {
    throw buildError(
      422,
      `El parametro limit debe ser un entero entre 1 y ${HIGHLIGHTS_MAX_LIMIT}.`
    );
  }
  return parsed;
}

async function resolveLookupId({ idValue, nameValue, table, label }) {
  if (!LOOKUP_TABLES.has(table)) {
    throw buildError(500, 'Tabla de catalogo no permitida.');
  }
  if (idValue !== undefined) {
    if (idValue === null || idValue === '') {
      return null;
    }
    const parsedId = parsePositiveInt(idValue, `${label}Id`);
    const [rows] = await db.execute(`SELECT id FROM ${table} WHERE id = ?`, [parsedId]);
    if (rows.length === 0) {
      throw buildError(422, `El ${label} indicado no existe.`);
    }
    return parsedId;
  }

  if (nameValue !== undefined) {
    if (nameValue === null || nameValue === '') {
      return null;
    }
    if (typeof nameValue !== 'string') {
      throw buildError(422, `El ${label} debe ser texto.`);
    }
    const trimmed = nameValue.trim();
    if (!trimmed) {
      return null;
    }
    if (trimmed.length > MAX_LOOKUP_NAME_LENGTH) {
      throw buildError(422, `El ${label} excede la longitud permitida.`);
    }
    const [rows] = await db.execute(
      `SELECT id FROM ${table} WHERE nombre = ? LIMIT 1`,
      [trimmed]
    );
    if (rows.length === 0) {
      throw buildError(422, `El ${label} indicado no existe.`);
    }
    return rows[0].id;
  }

  return null;
}

function handleError(res, error, fallbackMessage) {
  if (error?.status) {
    return res.status(error.status).json({ message: error.message });
  }
  if (error?.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ message: 'El beneficio ya existe.' });
  }
  safeLogger.error('Error en catalogo', error);
  return res.status(500).json({ message: fallbackMessage });
}

async function fetchBenefitById(id) {
  const [rows] = await db.execute(`${BASE_SELECT_QUERY} WHERE b.id = ?`, [id]);
  return rows.length > 0 ? mapBenefitRow(rows[0]) : null;
}

async function auditCatalogMutation(req, action, benefitId, payload) {
  if (!req.user?.id) {
    return;
  }
  await recordAdminActivity({
    actorUserId: req.user.id,
    entityType: 'beneficios',
    entityId: String(benefitId),
    action,
    ipAddress: getClientIp(req),
    payload
  });
}

exports.getCatalog = async (req, res) => {
  try {
    const q = req.query.q ? `%${req.query.q}%` : null;
    const categoria = req.query.categoria;
    const municipio = req.query.municipio;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    let pageSize = parseInt(req.query.pageSize, 10) || 20;
    pageSize = Math.min(Math.max(pageSize, 1), 100);
    const offset = (page - 1) * pageSize;

    let where = 'WHERE 1=1';
    const params = [];
    if (q) {
      where += ' AND (b.nombre LIKE ? OR b.descripcion LIKE ?)';
      params.push(q, q);
    }
    if (categoria) {
      where += ' AND c.nombre = ?';
      params.push(categoria);
    }
    if (municipio) {
      where += ' AND m.nombre = ?';
      params.push(municipio);
    }

    const countQuery = `SELECT COUNT(*) AS total
      FROM beneficios b
      LEFT JOIN categorias c ON b.categoria_id = c.id
      LEFT JOIN municipios m ON b.municipio_id = m.id
      ${where}`;
    const [countRows] = await db.execute(countQuery, params);
    const total = countRows[0].total;

    const safePageSize = Number(pageSize);
    const safeOffset = Number(offset);
    const selectQuery = `${BASE_SELECT_QUERY}
      ${where}
      LIMIT ${safePageSize} OFFSET ${safeOffset}`;
    const [rows] = await db.execute(selectQuery, params);
    const items = rows.map(mapBenefitRow);

    const totalPages = Math.ceil(total / pageSize);
    return res.json({ items, total, page, pageSize, totalPages });
  } catch (err) {
    return handleError(res, err, 'Error al consultar catalogo');
  }
};

exports.getBenefitById = async (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id, 'id');
    const benefit = await fetchBenefitById(id);
    if (!benefit) {
      return res.status(404).json({ message: 'Beneficio no encontrado.' });
    }
    return res.json(benefit);
  } catch (err) {
    return handleError(res, err, 'Error al consultar beneficio');
  }
};

exports.getCatalogHighlights = async (req, res) => {
  try {
    const since = parseHighlightsSince(req.query?.since);
    const limit = parseHighlightsLimit(req.query?.limit);
    let where = 'WHERE b.is_active = 1 AND b.is_visible_to_beneficiary = 1 AND b.published_at IS NOT NULL';
    const params = [];

    if (since) {
      where += ' AND b.published_at > ?';
      params.push(since);
    }

    const [rows] = await db.execute(
      `${BASE_SELECT_QUERY}
       ${where}
       ORDER BY b.published_at DESC, b.id DESC
       LIMIT ${Number(limit)}`,
      params
    );

    return res.json({
      items: rows.map(mapBenefitRow),
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    return handleError(res, err, 'Error al consultar novedades de catalogo');
  }
};

exports.createBenefit = async (req, res) => {
  try {
    const body = req.body || {};
    const nombre = normalizeRequiredString(body.nombre, 'nombre', MAX_NAME_LENGTH);
    const descripcion = normalizeOptionalString(body.descripcion, 'descripcion', MAX_DESC_LENGTH);
    const descuento = normalizeOptionalString(body.descuento, 'descuento', MAX_DESCUENTO_LENGTH);
    const direccion = normalizeOptionalString(body.direccion, 'direccion', MAX_DIRECCION_LENGTH);
    const horario = normalizeOptionalString(body.horario, 'horario', MAX_HORARIO_LENGTH);
    const headline = normalizeOptionalString(body.headline, 'headline', MAX_NAME_LENGTH);
    const summary = normalizeOptionalString(body.summary, 'summary', MAX_SUMMARY_LENGTH);
    const imageUrl = normalizeOptionalString(body.imageUrl, 'imageUrl', MAX_IMAGE_URL_LENGTH);
    const lat = parseOptionalNumber(body.lat, 'lat', -90, 90);
    const lng = parseOptionalNumber(body.lng, 'lng', -180, 180);
    const isActive = normalizeOptionalBoolean(body.isActive, 'isActive');
    const isVisibleToBeneficiary = normalizeOptionalBoolean(
      body.isVisibleToBeneficiary,
      'isVisibleToBeneficiary'
    );
    const categoriaId = await resolveLookupId({
      idValue: body.categoriaId,
      nameValue: body.categoria,
      table: 'categorias',
      label: 'categoria'
    });
    const municipioId = await resolveLookupId({
      idValue: body.municipioId,
      nameValue: body.municipio,
      table: 'municipios',
      label: 'municipio'
    });

    const [result] = await db.execute(
      `INSERT INTO beneficios
        (nombre, descripcion, categoria_id, municipio_id, descuento, direccion, horario, lat, lng,
         is_active, is_visible_to_beneficiary, published_at, headline, summary, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre,
        descripcion,
        categoriaId,
        municipioId,
        descuento,
        direccion,
        horario,
        lat,
        lng,
        isActive === null ? 1 : isActive ? 1 : 0,
        isVisibleToBeneficiary === null ? 1 : isVisibleToBeneficiary ? 1 : 0,
        new Date(),
        headline,
        summary,
        imageUrl
      ]
    );

    const benefit = await fetchBenefitById(result.insertId);
    await auditCatalogMutation(req, 'create', result.insertId, {
      nombre,
      categoriaId,
      municipioId,
      isActive: benefit?.isActive ?? true,
      isVisibleToBeneficiary: benefit?.isVisibleToBeneficiary ?? true
    });
    return res.status(201).json(benefit);
  } catch (err) {
    return handleError(res, err, 'Error al crear beneficio');
  }
};

exports.updateBenefit = async (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id, 'id');
    const body = req.body || {};

    const [existingRows] = await db.execute('SELECT id FROM beneficios WHERE id = ?', [id]);
    if (existingRows.length === 0) {
      return res.status(404).json({ message: 'Beneficio no encontrado.' });
    }

    const updates = [];
    const params = [];

    if (hasOwn(body, 'nombre')) {
      const nombre = normalizeRequiredString(body.nombre, 'nombre', MAX_NAME_LENGTH);
      updates.push('nombre = ?');
      params.push(nombre);
    }
    if (hasOwn(body, 'descripcion')) {
      const descripcion = normalizeOptionalString(body.descripcion, 'descripcion', MAX_DESC_LENGTH);
      updates.push('descripcion = ?');
      params.push(descripcion);
    }
    if (hasOwn(body, 'descuento')) {
      const descuento = normalizeOptionalString(body.descuento, 'descuento', MAX_DESCUENTO_LENGTH);
      updates.push('descuento = ?');
      params.push(descuento);
    }
    if (hasOwn(body, 'direccion')) {
      const direccion = normalizeOptionalString(body.direccion, 'direccion', MAX_DIRECCION_LENGTH);
      updates.push('direccion = ?');
      params.push(direccion);
    }
    if (hasOwn(body, 'horario')) {
      const horario = normalizeOptionalString(body.horario, 'horario', MAX_HORARIO_LENGTH);
      updates.push('horario = ?');
      params.push(horario);
    }
    if (hasOwn(body, 'lat')) {
      const lat = parseOptionalNumber(body.lat, 'lat', -90, 90);
      updates.push('lat = ?');
      params.push(lat);
    }
    if (hasOwn(body, 'lng')) {
      const lng = parseOptionalNumber(body.lng, 'lng', -180, 180);
      updates.push('lng = ?');
      params.push(lng);
    }
    if (hasOwn(body, 'headline')) {
      const headline = normalizeOptionalString(body.headline, 'headline', MAX_NAME_LENGTH);
      updates.push('headline = ?');
      params.push(headline);
    }
    if (hasOwn(body, 'summary')) {
      const summary = normalizeOptionalString(body.summary, 'summary', MAX_SUMMARY_LENGTH);
      updates.push('summary = ?');
      params.push(summary);
    }
    if (hasOwn(body, 'imageUrl')) {
      const imageUrl = normalizeOptionalString(body.imageUrl, 'imageUrl', MAX_IMAGE_URL_LENGTH);
      updates.push('image_url = ?');
      params.push(imageUrl);
    }
    if (hasOwn(body, 'isActive')) {
      const isActive = normalizeOptionalBoolean(body.isActive, 'isActive');
      updates.push('is_active = ?');
      params.push(isActive ? 1 : 0);
    }
    if (hasOwn(body, 'isVisibleToBeneficiary')) {
      const isVisibleToBeneficiary = normalizeOptionalBoolean(
        body.isVisibleToBeneficiary,
        'isVisibleToBeneficiary'
      );
      updates.push('is_visible_to_beneficiary = ?');
      params.push(isVisibleToBeneficiary ? 1 : 0);
    }

    if (hasOwn(body, 'categoriaId') || hasOwn(body, 'categoria')) {
      const categoriaId = await resolveLookupId({
        idValue: hasOwn(body, 'categoriaId') ? body.categoriaId : undefined,
        nameValue: hasOwn(body, 'categoria') ? body.categoria : undefined,
        table: 'categorias',
        label: 'categoria'
      });
      updates.push('categoria_id = ?');
      params.push(categoriaId);
    }

    if (hasOwn(body, 'municipioId') || hasOwn(body, 'municipio')) {
      const municipioId = await resolveLookupId({
        idValue: hasOwn(body, 'municipioId') ? body.municipioId : undefined,
        nameValue: hasOwn(body, 'municipio') ? body.municipio : undefined,
        table: 'municipios',
        label: 'municipio'
      });
      updates.push('municipio_id = ?');
      params.push(municipioId);
    }

    if (updates.length === 0) {
      throw buildError(422, 'No hay campos para actualizar.');
    }

    await db.execute(`UPDATE beneficios SET ${updates.join(', ')} WHERE id = ?`, [...params, id]);
    const benefit = await fetchBenefitById(id);
    await auditCatalogMutation(req, 'update', id, body);
    return res.json(benefit);
  } catch (err) {
    return handleError(res, err, 'Error al actualizar beneficio');
  }
};

exports.deleteBenefit = async (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id, 'id');
    const [existingRows] = await db.execute('SELECT id FROM beneficios WHERE id = ?', [id]);
    if (existingRows.length === 0) {
      return res.status(404).json({ message: 'Beneficio no encontrado.' });
    }
    await db.execute('DELETE FROM beneficios WHERE id = ?', [id]);
    await auditCatalogMutation(req, 'delete', id, { deleted: true });
    return res.status(204).send();
  } catch (err) {
    return handleError(res, err, 'Error al eliminar beneficio');
  }
};
