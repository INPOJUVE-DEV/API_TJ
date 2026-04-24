const express = require('express');
const controller = require('../controllers/beneficiariosStagingController');
const verifyToken = require('../middleware/auth');
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
router.get('/', verifyToken, authorizeRole(['admin']), controller.list);
router.delete('/expired', verifyToken, authorizeRole(['admin']), controller.cleanupExpired);
router.post('/:id/push', verifyToken, authorizeRole(['admin']), controller.push);

module.exports = router;
