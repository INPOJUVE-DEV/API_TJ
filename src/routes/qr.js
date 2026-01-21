const express = require('express');
const qrController = require('../controllers/qrController');
const verifyToken = require('../middleware/auth');
const authorizeRole = require('../middleware/authorizeRole');
const { qrScanLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.post('/scan', verifyToken, authorizeRole(['scanner', 'admin']), qrScanLimiter, qrController.scan);

module.exports = router;
