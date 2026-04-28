const express = require('express');
const controller = require('../controllers/adminLookupsController');
const verifyAdminToken = require('../middleware/adminAuth');
const authorizeRole = require('../middleware/authorizeRole');

const router = express.Router();

router.get('/lookups', verifyAdminToken, authorizeRole(['admin', 'reader']), controller.getLookups);

module.exports = router;
