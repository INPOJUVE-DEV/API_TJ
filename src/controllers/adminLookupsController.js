const db = require('../config/db');
const { getClientIp, recordAdminActivity } = require('../services/adminActivityService');
const safeLogger = require('../utils/safeLogger');

const ALLOWED_LOOKUPS = new Set(['municipios', 'categorias']);
const MAX_NAME_LENGTH = 120;

function normalizeLookupType(value) {
  const lookup = String(value || '').trim().toLowerCase();
  if (!ALLOWED_LOOKUPS.has(lookup)) {
    const error = new Error(`Lookup no permitido: ${lookup || '(vacio)'}`);
    error.statusCode = 422;
    throw error;
  }
  return lookup;
}

function normalizeRequiredName(value) {
  if (typeof value !== 'string' || !value.trim()) {
    const error = new Error('nombre es obligatorio.');
    error.statusCode = 422;
    throw error;
  }
  const normalized = value.trim();
  if (normalized.length > MAX_NAME_LENGTH) {
    const error = new Error('nombre excede la longitud permitida.');
    error.statusCode = 422;
    throw error;
  }
  return normalized;
}

function normalizePositiveInt(value, field = 'id') {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error(`${field} debe ser un entero positivo.`);
    error.statusCode = 422;
    throw error;
  }
  return parsed;
}

async function fetchLookupRows(lookup, q = '') {
  const normalizedQuery = String(q || '').trim();
  if (normalizedQuery) {
    const [rows] = await db.execute(
      `SELECT id, nombre
       FROM ${lookup}
       WHERE nombre LIKE ?
       ORDER BY nombre ASC`,
      [`%${normalizedQuery}%`]
    );
    return rows;
  }

  const [rows] = await db.execute(`SELECT id, nombre FROM ${lookup} ORDER BY nombre ASC`);
  return rows;
}

async function fetchLookupRowById(lookup, id) {
  const [rows] = await db.execute(
    `SELECT id, nombre
     FROM ${lookup}
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function auditLookupMutation(req, action, lookup, entityId, payload) {
  if (!req.user?.id) {
    return;
  }
  await recordAdminActivity({
    actorUserId: req.user.id,
    entityType: lookup,
    entityId: String(entityId),
    action,
    ipAddress: getClientIp(req),
    payload
  });
}

function handleError(res, error, fallbackMessage) {
  if (error?.statusCode) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  if (error?.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ message: 'El nombre ya existe en este catalogo.' });
  }
  if (error?.code === 'ER_ROW_IS_REFERENCED_2' || error?.code === 'ER_ROW_IS_REFERENCED') {
    return res.status(409).json({ message: 'No se puede eliminar porque el registro esta en uso.' });
  }
  safeLogger.error('Error en catalogos admin', error);
  return res.status(500).json({ message: fallbackMessage });
}

exports.getLookups = async (req, res) => {
  const requested = String(req.query?.include || 'municipios,categorias')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const lookups = requested.length > 0 ? requested : ['municipios', 'categorias'];

  try {
    for (const lookup of lookups) {
      normalizeLookupType(lookup);
    }

    const response = {};
    for (const lookup of lookups) {
      response[lookup] = await fetchLookupRows(lookup);
    }
    return res.json(response);
  } catch (error) {
    return handleError(res, error, 'Error al cargar catalogos base.');
  }
};

exports.listLookupItems = async (req, res) => {
  try {
    const lookup = normalizeLookupType(req.params.lookup);
    const items = await fetchLookupRows(lookup, req.query?.q);
    return res.json({ items });
  } catch (error) {
    return handleError(res, error, 'Error al listar catalogo.');
  }
};

exports.getLookupItemById = async (req, res) => {
  try {
    const lookup = normalizeLookupType(req.params.lookup);
    const id = normalizePositiveInt(req.params.id);
    const item = await fetchLookupRowById(lookup, id);
    if (!item) {
      return res.status(404).json({ message: 'Registro no encontrado.' });
    }
    return res.json(item);
  } catch (error) {
    return handleError(res, error, 'Error al consultar catalogo.');
  }
};

exports.createLookupItem = async (req, res) => {
  try {
    const lookup = normalizeLookupType(req.params.lookup);
    const nombre = normalizeRequiredName(req.body?.nombre);
    const [result] = await db.execute(`INSERT INTO ${lookup} (nombre) VALUES (?)`, [nombre]);
    const created = await fetchLookupRowById(lookup, result.insertId);
    await auditLookupMutation(req, 'create', lookup, result.insertId, { nombre });
    return res.status(201).json(created);
  } catch (error) {
    return handleError(res, error, 'Error al crear registro de catalogo.');
  }
};

exports.updateLookupItem = async (req, res) => {
  try {
    const lookup = normalizeLookupType(req.params.lookup);
    const id = normalizePositiveInt(req.params.id);
    const nombre = normalizeRequiredName(req.body?.nombre);
    const existing = await fetchLookupRowById(lookup, id);
    if (!existing) {
      return res.status(404).json({ message: 'Registro no encontrado.' });
    }
    await db.execute(`UPDATE ${lookup} SET nombre = ? WHERE id = ?`, [nombre, id]);
    const updated = await fetchLookupRowById(lookup, id);
    await auditLookupMutation(req, 'update', lookup, id, { nombre });
    return res.json(updated);
  } catch (error) {
    return handleError(res, error, 'Error al actualizar registro de catalogo.');
  }
};

exports.deleteLookupItem = async (req, res) => {
  try {
    const lookup = normalizeLookupType(req.params.lookup);
    const id = normalizePositiveInt(req.params.id);
    const existing = await fetchLookupRowById(lookup, id);
    if (!existing) {
      return res.status(404).json({ message: 'Registro no encontrado.' });
    }
    await db.execute(`DELETE FROM ${lookup} WHERE id = ?`, [id]);
    await auditLookupMutation(req, 'delete', lookup, id, { deleted: true, nombre: existing.nombre });
    return res.status(204).send();
  } catch (error) {
    return handleError(res, error, 'Error al eliminar registro de catalogo.');
  }
};
