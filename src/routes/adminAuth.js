const express = require('express');
const adminAuthController = require('../controllers/adminAuthController');
const verifyAdminToken = require('../middleware/adminAuth');
const { adminLoginLimiter } = require('../middleware/rateLimiters');
const noStore = require('../middleware/noStore');

const router = express.Router();

router.post('/login', adminLoginLimiter, noStore, adminAuthController.login);
router.post('/logout', verifyAdminToken, noStore, adminAuthController.logout);
router.get('/session', verifyAdminToken, noStore, adminAuthController.session);

module.exports = router;
