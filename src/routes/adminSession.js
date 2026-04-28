const express = require('express');
const controller = require('../controllers/adminAuthController');
const verifyAdminToken = require('../middleware/adminAuth');
const noStore = require('../middleware/noStore');

const router = express.Router();

router.get('/session', verifyAdminToken, noStore, controller.session);

module.exports = router;
