const express = require('express');
const cardholderController = require('../controllers/cardholderController');
const { lookupLimiter, accountLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.post('/lookup', lookupLimiter, cardholderController.lookup);
router.post('/:curp/account', accountLimiter, cardholderController.createAccount);

module.exports = router;
