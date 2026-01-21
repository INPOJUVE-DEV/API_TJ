const rateLimit = require('express-rate-limit');

function buildLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message }
  });
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const THIRTY_MINUTES = 30 * 60 * 1000;

const loginLimiter = buildLimiter({
  windowMs: FIFTEEN_MINUTES,
  max: 10,
  message: 'Demasiados intentos de inicio de sesion. Intenta mas tarde.'
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

const qrScanLimiter = buildLimiter({
  windowMs: FIFTEEN_MINUTES,
  max: 120,
  message: 'Demasiados escaneos. Intenta mas tarde.'
});

module.exports = {
  loginLimiter,
  otpLimiter,
  lookupLimiter,
  accountLimiter,
  qrScanLimiter
};
