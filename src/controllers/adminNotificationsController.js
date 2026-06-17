const path = require('path');
const {
  ADMIN_STREAM_TOKEN_EXPIRATION,
  assertValidAdminSession,
  buildAdminStreamToken,
  verifyAdminStreamToken
} = require('../services/adminAuthService');
const {
  getRecentNotifications,
  subscribeToNotifications
} = require('../services/adminNotificationsService');
const safeLogger = require('../utils/safeLogger');

function getStreamUrl(token) {
  return `/api/v1/admin/notifications/stream?stream_token=${encodeURIComponent(token)}`;
}

exports.issueStreamToken = async (req, res) => {
  try {
    const token = buildAdminStreamToken(req.user);
    return res.json({
      streamToken: token,
      streamTokenTtl: ADMIN_STREAM_TOKEN_EXPIRATION,
      streamUrl: getStreamUrl(token)
    });
  } catch (error) {
    safeLogger.error('Error al emitir token de stream admin', error);
    return res.status(500).json({ message: 'Error al preparar notificaciones.' });
  }
};

exports.getRecent = async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(Number(req.query?.limit) || 20, 50));
    return res.json({
      items: getRecentNotifications({
        role: req.user?.role,
        limit
      })
    });
  } catch (error) {
    safeLogger.error('Error al listar notificaciones admin', error);
    return res.status(500).json({ message: 'Error al cargar notificaciones.' });
  }
};

exports.stream = async (req, res) => {
  const streamToken = String(req.query?.stream_token || '').trim();
  if (!streamToken) {
    return res.status(401).json({ message: 'stream_token requerido' });
  }

  try {
    const decoded = verifyAdminStreamToken(streamToken);
    const user = await assertValidAdminSession({
      userId: decoded.id,
      sessionVersion: decoded.session_version
    });

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const close = subscribeToNotifications({
      res,
      role: user.role,
      lastEventId: req.header('Last-Event-ID') || req.query?.last_event_id
    });

    req.on('close', close);
    req.on('end', close);
    return undefined;
  } catch (error) {
    const status = error.statusCode === 403 ? 403 : 401;
    return res.status(status).json({
      message: status === 403 ? 'Acceso admin denegado' : 'Stream admin invalido'
    });
  }
};

exports.demoPage = (req, res) => {
  return res.sendFile(path.resolve(__dirname, '../views/admin-notifications-demo.html'));
};
