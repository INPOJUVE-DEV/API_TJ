const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const verifyToken = require('../middleware/auth');
const noStore = require('../middleware/noStore');

router.get('/me', verifyToken, noStore, userController.getProfile);

module.exports = router;
