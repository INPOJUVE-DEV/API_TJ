const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const verifyToken = require('../middleware/auth');

router.post('/login', authController.login);
router.post('/logout', verifyToken, authController.logout);
router.post('/otp/send', authController.sendOtp);
router.post('/otp/verify', authController.verifyOtp);

module.exports = router;
