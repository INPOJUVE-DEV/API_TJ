const express = require('express');
const controller = require('../controllers/adminLookupsController');
const verifyAdminToken = require('../middleware/adminAuth');
const authorizeRole = require('../middleware/authorizeRole');

const router = express.Router();

router.get('/lookups', verifyAdminToken, authorizeRole(['admin', 'reader']), controller.getLookups);
router.get('/lookups/:lookup', verifyAdminToken, authorizeRole(['admin', 'reader']), controller.listLookupItems);
router.get('/lookups/:lookup/:id', verifyAdminToken, authorizeRole(['admin', 'reader']), controller.getLookupItemById);
router.post('/lookups/:lookup', verifyAdminToken, authorizeRole(['admin']), controller.createLookupItem);
router.patch('/lookups/:lookup/:id', verifyAdminToken, authorizeRole(['admin']), controller.updateLookupItem);
router.delete('/lookups/:lookup/:id', verifyAdminToken, authorizeRole(['admin']), controller.deleteLookupItem);

module.exports = router;
