const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const verifyToken = require('../middleware/auth');
const { loginLimiter, otpLimiter } = require('../middleware/rateLimiters');
const noStore = require('../middleware/noStore');

router.post('/login', loginLimiter, noStore, authController.login);
router.post('/logout', verifyToken, authController.logout);
router.post('/otp/send', otpLimiter, authController.sendOtp);
router.post('/otp/verify', otpLimiter, noStore, authController.verifyOtp);

module.exports = router;
