const { verifyIntegrationRequest } = require('../services/integrationAuthService');
const db = require('../config/db');
const safeLogger = require('../utils/safeLogger');

function auditIntegrationCall(req, res, requiredScope) {
  res.on('finish', async () => {
    try {
      if (!req.integration?.client) {
        return;
      }
      await db.execute(
        `INSERT INTO integration_audit_log
          (client_id, client_code, method, path, required_scope, ip_address, status_code)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          req.integration.client.id,
          req.integration.client.client_code,
          req.method,
          req.originalUrl || req.url,
          requiredScope || null,
          req.integration.ip || null,
          res.statusCode
        ]
      );
    } catch (error) {
      safeLogger.error('Error al auditar llamada de integracion', error);
    }
  });
}

function requireIntegrationScope(requiredScope) {
  return async function integrationAuthMiddleware(req, res, next) {
    try {
      req.integration = await verifyIntegrationRequest(req, requiredScope);
      auditIntegrationCall(req, res, requiredScope);
      return next();
    } catch (error) {
      const status = error.statusCode === 403 ? 403 : 401;
      if (status >= 500) {
        safeLogger.error('Error en autenticacion de integracion', error);
      }
      return res.status(status).json({
        message: status === 403 ? 'Permisos insuficientes.' : 'Token de integracion invalido.'
      });
    }
  };
}

module.exports = {
  requireIntegrationScope
};
