const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const {
  forgotPasswordLimiter,
  forgotPasswordSubjectLimiter,
  loginIdentifierLimiter,
  loginLimiter,
  otpLimiter,
  refreshLimiter,
  resetPasswordLimiter
} = require('../middleware/rateLimiters');
const noStore = require('../middleware/noStore');

router.post('/login', loginLimiter, loginIdentifierLimiter, noStore, authController.login);
router.post('/refresh', refreshLimiter, noStore, authController.refresh);
router.post('/logout', noStore, authController.logout);
router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  forgotPasswordSubjectLimiter,
  noStore,
  authController.forgotPassword
);
router.post('/reset-password', resetPasswordLimiter, noStore, authController.resetPassword);
router.post('/otp/send', otpLimiter, authController.sendOtp);
router.post('/otp/verify', otpLimiter, noStore, authController.verifyOtp);

module.exports = router;
