const db = require('../config/db');

module.exports = function authorizeRole(allowedRoles = []) {
  const allowed = new Set(allowedRoles.map((role) => String(role).toLowerCase()));
  return async function authorizeRoleMiddleware(req, res, next) {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    try {
      const [rows] = await db.execute('SELECT role FROM usuarios WHERE id = ? LIMIT 1', [
        req.user.id
      ]);
      if (rows.length === 0) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
      const role = String(rows[0].role || '').toLowerCase();
      if (!allowed.has(role)) {
        return res.status(403).json({ message: 'Acceso denegado' });
      }
      req.user.role = role;
      return next();
    } catch (error) {
      console.error('Error al validar rol', error);
      return res.status(500).json({ message: 'Error al validar permisos' });
    }
  };
};
