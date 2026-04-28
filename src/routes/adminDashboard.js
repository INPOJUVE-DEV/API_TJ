const express = require('express');
const controller = require('../controllers/adminDashboardController');
const verifyAdminToken = require('../middleware/adminAuth');
const authorizeRole = require('../middleware/authorizeRole');

const router = express.Router();

router.get('/dashboard', verifyAdminToken, authorizeRole(['admin', 'reader']), controller.getDashboard);

module.exports = router;
