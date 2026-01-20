// middleware para verificar JWT
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

exports.getProfile = async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ message: 'Token requerido' });
  }
  const [, token] = authHeader.split(' ');
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;
    const [rows] = await db.execute(
      `SELECT u.id, u.nombre, u.apellidos, u.curp, u.email, m.nombre AS municipio, u.telefono
       FROM usuarios u
       LEFT JOIN municipios m ON u.municipio_id = m.id
       WHERE u.id = ?`,
      [userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    return res.json(rows[0]);
  } catch (err) {
    return res.status(401).json({ message: 'Token inválido' });
  }
};
