const db = require('../config/db');

exports.getCatalog = async (req, res) => {
  try {
    const q = req.query.q ? `%${req.query.q}%` : null;
    const categoria = req.query.categoria;
    const municipio = req.query.municipio;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    let pageSize = parseInt(req.query.pageSize, 10) || 20;
    pageSize = Math.min(Math.max(pageSize, 1), 100);
    const offset = (page - 1) * pageSize;

    // Construir cláusulas dinámicas
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

    // Consultar el total de registros
    const countQuery = `SELECT COUNT(*) AS total
      FROM beneficios b
      LEFT JOIN categorias c ON b.categoria_id = c.id
      LEFT JOIN municipios m ON b.municipio_id = m.id
      ${where}`;
    const [countRows] = await db.execute(countQuery, params);
    const total = countRows[0].total;

    const selectQuery = `SELECT b.id, b.nombre, c.nombre AS categoria, m.nombre AS municipio,
      b.descuento, b.direccion, b.horario, b.descripcion, b.lat, b.lng
      FROM beneficios b
      LEFT JOIN categorias c ON b.categoria_id = c.id
      LEFT JOIN municipios m ON b.municipio_id = m.id
      ${where}
      LIMIT ${pageSize} OFFSET ${offset}`;
    const [items] = await db.execute(selectQuery, params);

    const totalPages = Math.ceil(total / pageSize);
    return res.json({ items, total, page, pageSize, totalPages });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error al consultar catalogo' });
  }
};


