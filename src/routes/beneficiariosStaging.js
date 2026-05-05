const express = require('express');
const controller = require('../controllers/beneficiariosStagingController');
const verifyAdminToken = require('../middleware/adminAuth');
const authorizeRole = require('../middleware/authorizeRole');
const { requireIntegrationScope } = require('../middleware/integrationAuth');
const { integrationClientRateLimit } = require('../middleware/integrationClientRateLimit');

const router = express.Router();

router.post(
  '/',
  requireIntegrationScope('beneficiarios.staging.create'),
  integrationClientRateLimit(),
  controller.create
);
router.get('/', verifyAdminToken, authorizeRole(['admin']), controller.list);
router.delete('/expired', verifyAdminToken, authorizeRole(['admin']), controller.cleanupExpired);
router.post('/:id/push', verifyAdminToken, authorizeRole(['admin']), controller.push);

module.exports = router;
