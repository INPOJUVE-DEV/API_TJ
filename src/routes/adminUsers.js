const express = require('express');
const controller = require('../controllers/adminUsersController');
const verifyAdminToken = require('../middleware/adminAuth');
const authorizeRole = require('../middleware/authorizeRole');

const router = express.Router();

router.get('/users', verifyAdminToken, authorizeRole(['admin', 'reader']), controller.listUsers);
router.get('/users/:id', verifyAdminToken, authorizeRole(['admin', 'reader']), controller.getUserById);
router.post('/users', verifyAdminToken, authorizeRole(['admin']), controller.createUser);
router.patch('/users/:id', verifyAdminToken, authorizeRole(['admin']), controller.updateUser);
router.post('/users/:id/set-password', verifyAdminToken, authorizeRole(['admin']), controller.setPassword);

module.exports = router;
