const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const verifyToken = require('../middleware/auth');
const authorizeRole = require('../middleware/authorizeRole');
const noStore = require('../middleware/noStore');

router.get(
  '/me',
  verifyToken,
  authorizeRole(['admin', 'reader', 'scanner', 'beneficiary']),
  noStore,
  userController.getProfile
);

module.exports = router;
