const rateLimit = require('express-rate-limit');

function buildLimiter({ windowMs, max, message, keyGenerator }) {
  return rateLimit({
    windowMs,
    max,
    keyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message }
  });
}

function normalizeIdentifier(rawValue) {
  return String(rawValue || '')
    .trim()
    .toLowerCase();
}

function buildBodyIdentifierLimiter({ windowMs, max, message, fields }) {
  return buildLimiter({
    windowMs,
    max,
    message,
    keyGenerator(req) {
      const identifier = fields
        .map((field) => normalizeIdentifier(req?.body?.[field]))
        .find(Boolean);
      return identifier ? `${req.ip || 'unknown'}:${identifier}` : req.ip || 'unknown';
    }
  });
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const THIRTY_MINUTES = 30 * 60 * 1000;

const loginLimiter = buildLimiter({
  windowMs: FIFTEEN_MINUTES,
  max: 10,
  message: 'Demasiados intentos de inicio de sesion. Intenta mas tarde.'
});

const loginIdentifierLimiter = buildBodyIdentifierLimiter({
  windowMs: FIFTEEN_MINUTES,
  max: 5,
  message: 'Demasiados intentos para esta cuenta. Intenta mas tarde.',
  fields: ['username', 'email']
});

const adminLoginLimiter = buildLimiter({
  windowMs: FIFTEEN_MINUTES,
  max: 6,
  message: 'Demasiados intentos de acceso administrativo. Intenta mas tarde.'
});

const otpLimiter = buildLimiter({
  windowMs: FIFTEEN_MINUTES,
  max: 8,
  message: 'Demasiados intentos de OTP. Intenta mas tarde.'
});

const lookupLimiter = buildLimiter({
  windowMs: FIFTEEN_MINUTES,
  max: 10,
  message: 'Demasiadas consultas. Intenta mas tarde.'
});

const accountLimiter = buildLimiter({
  windowMs: THIRTY_MINUTES,
  max: 6,
  message: 'Demasiadas solicitudes de cuenta. Intenta mas tarde.'
});

const refreshLimiter = buildLimiter({
  windowMs: FIFTEEN_MINUTES,
  max: 30,
  message: 'Demasiados intentos de renovacion. Intenta mas tarde.'
});

const forgotPasswordLimiter = buildLimiter({
  windowMs: THIRTY_MINUTES,
  max: 6,
  message: 'Demasiadas solicitudes de recuperacion. Intenta mas tarde.'
});

const forgotPasswordSubjectLimiter = buildBodyIdentifierLimiter({
  windowMs: THIRTY_MINUTES,
  max: 3,
  message: 'Demasiadas solicitudes para esta cuenta. Intenta mas tarde.',
  fields: ['email']
});

const resetPasswordLimiter = buildLimiter({
  windowMs: THIRTY_MINUTES,
  max: 8,
  message: 'Demasiados intentos de restablecimiento. Intenta mas tarde.'
});

const qrScanLimiter = buildLimiter({
  windowMs: FIFTEEN_MINUTES,
  max: 120,
  message: 'Demasiados escaneos. Intenta mas tarde.'
});

module.exports = {
  accountLimiter,
  adminLoginLimiter,
  forgotPasswordLimiter,
  forgotPasswordSubjectLimiter,
  loginIdentifierLimiter,
  loginLimiter,
  lookupLimiter,
  otpLimiter,
  qrScanLimiter,
  refreshLimiter,
  resetPasswordLimiter
};
