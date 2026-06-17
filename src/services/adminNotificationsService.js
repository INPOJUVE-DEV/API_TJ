const { EventEmitter } = require('events');

const emitter = new EventEmitter();
const recentNotifications = [];
const activeClients = new Map();

const MAX_BUFFER_SIZE = Math.max(1, Number(process.env.ADMIN_NOTIFICATIONS_BUFFER_SIZE || 50));
const HEARTBEAT_MS = Math.max(5000, Number(process.env.ADMIN_SSE_HEARTBEAT_MS || 25000));

let nextNotificationId = 1;
let nextClientId = 1;

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function normalizeAudience(audience) {
  if (!Array.isArray(audience) || audience.length === 0) {
    return ['admin', 'reader'];
  }

  const normalized = audience
    .map((entry) => normalizeRole(entry))
    .filter(Boolean);

  return normalized.length > 0 ? Array.from(new Set(normalized)) : ['admin', 'reader'];
}

function canReceive(role, notification) {
  return notification.audience.includes(normalizeRole(role));
}

function serializeSse(eventName, notification) {
  return [
    `id: ${notification.id}`,
    `event: ${eventName}`,
    `data: ${JSON.stringify(notification)}`,
    '',
    ''
  ].join('\n');
}

function storeNotification(notification) {
  recentNotifications.unshift(notification);
  if (recentNotifications.length > MAX_BUFFER_SIZE) {
    recentNotifications.length = MAX_BUFFER_SIZE;
  }
}

function buildNotification(input = {}) {
  return {
    id: nextNotificationId++,
    type: String(input.type || 'admin.notification'),
    severity: String(input.severity || 'info'),
    title: String(input.title || 'Notificacion'),
    message: String(input.message || ''),
    source: String(input.source || 'system'),
    audience: normalizeAudience(input.audience),
    createdAt: new Date().toISOString(),
    payload: input.payload || {}
  };
}

function publishNotification(input = {}) {
  const notification = buildNotification(input);
  storeNotification(notification);
  emitter.emit('notification', notification);
  return notification;
}

function getRecentNotifications({ role, limit = 20 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, MAX_BUFFER_SIZE));
  return recentNotifications.filter((item) => canReceive(role, item)).slice(0, safeLimit);
}

function subscribeToNotifications({ res, role, lastEventId } = {}) {
  const normalizedRole = normalizeRole(role);
  const clientId = nextClientId++;
  const lastSeenId = Number(lastEventId || 0);

  const write = (chunk) => {
    try {
      res.write(chunk);
      return true;
    } catch {
      return false;
    }
  };

  const sendNotification = (notification) => {
    if (!canReceive(normalizedRole, notification)) {
      return true;
    }
    return write(serializeSse('notification', notification));
  };

  const onNotification = (notification) => {
    if (!sendNotification(notification)) {
      cleanup();
    }
  };

  const heartbeat = setInterval(() => {
    write(`event: heartbeat\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
  }, HEARTBEAT_MS);

  const cleanup = () => {
    clearInterval(heartbeat);
    emitter.off('notification', onNotification);
    activeClients.delete(clientId);
  };

  activeClients.set(clientId, { cleanup, role: normalizedRole });
  emitter.on('notification', onNotification);

  write('retry: 10000\n\n');
  const backlog = getRecentNotifications({ role: normalizedRole, limit: MAX_BUFFER_SIZE })
    .filter((notification) => notification.id > lastSeenId)
    .reverse();

  for (const notification of backlog) {
    if (!sendNotification(notification)) {
      cleanup();
      break;
    }
  }

  return cleanup;
}

function resetForTests() {
  for (const client of activeClients.values()) {
    client.cleanup();
  }
  activeClients.clear();
  recentNotifications.length = 0;
  nextNotificationId = 1;
  nextClientId = 1;
}

module.exports = {
  publishNotification,
  getRecentNotifications,
  subscribeToNotifications,
  __resetForTests: resetForTests
};
