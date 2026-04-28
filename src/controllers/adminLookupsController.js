const db = require('../config/db');
const safeLogger = require('../utils/safeLogger');

const ALLOWED_LOOKUPS = new Set(['municipios', 'categorias']);

exports.getLookups = async (req, res) => {
  const requested = String(req.query?.include || 'municipios,categorias')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const lookups = requested.length > 0 ? requested : ['municipios', 'categorias'];

  for (const lookup of lookups) {
    if (!ALLOWED_LOOKUPS.has(lookup)) {
      return res.status(422).json({ message: `Lookup no permitido: ${lookup}` });
    }
  }

  try {
    const response = {};
    for (const lookup of lookups) {
      const [rows] = await db.execute(`SELECT id, nombre FROM ${lookup} ORDER BY nombre ASC`);
      response[lookup] = rows;
    }
    return res.json(response);
  } catch (error) {
    safeLogger.error('Error al cargar lookups admin', error);
    return res.status(500).json({ message: 'Error al cargar catalogos base.' });
  }
};
