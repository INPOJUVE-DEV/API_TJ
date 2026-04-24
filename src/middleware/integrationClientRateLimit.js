const safeLogger = require('../utils/safeLogger');

const buckets = new Map();

function cleanup(now) {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

function integrationClientRateLimit({
  windowMs = Number(process.env.INTEGRATION_RATE_WINDOW_MS || 15 * 60 * 1000),
  max = Number(process.env.INTEGRATION_RATE_MAX || 300)
} = {}) {
  return function integrationClientRateLimitMiddleware(req, res, next) {
    const clientCode = req.integration?.client?.client_code;
    if (!clientCode) {
      return res.status(401).json({ message: 'Cliente de integracion requerido.' });
    }

    const now = Date.now();
    cleanup(now);

    const key = `${clientCode}:${req.path}`;
    const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs };
    if (bucket.resetAt <= now) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }

    bucket.count += 1;
    buckets.set(key, bucket);

    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', Math.max(max - bucket.count, 0));
    res.setHeader('RateLimit-Reset', Math.ceil(bucket.resetAt / 1000));

    if (bucket.count > max) {
      safeLogger.warn('Rate limit de integracion excedido', { clientCode, path: req.path });
      return res.status(429).json({ message: 'Demasiadas solicitudes de integracion.' });
    }

    return next();
  };
}

module.exports = {
  integrationClientRateLimit
};
