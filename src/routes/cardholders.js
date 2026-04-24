const express = require('express');
const cardholderController = require('../controllers/cardholderController');
const { lookupLimiter, accountLimiter } = require('../middleware/rateLimiters');
const { requireIntegrationScope } = require('../middleware/integrationAuth');
const { integrationClientRateLimit } = require('../middleware/integrationClientRateLimit');

const router = express.Router();

router.post(
  '/lookup',
  requireIntegrationScope('cardholders.lookup'),
  integrationClientRateLimit(),
  cardholderController.lookup
);
router.post(
  '/sync',
  requireIntegrationScope('cardholders.sync'),
  integrationClientRateLimit(),
  cardholderController.sync
);
router.post('/verify-activation', cardholderController.verifyActivation);
router.post('/complete-activation', accountLimiter, cardholderController.completeActivation);
router.post('/:curp/account', accountLimiter, cardholderController.createAccount);

module.exports = router;
