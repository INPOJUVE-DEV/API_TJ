const express = require('express');
const cardholderController = require('../controllers/cardholderController');

const router = express.Router();

router.post('/lookup', cardholderController.lookup);
router.post('/:curp/account', cardholderController.createAccount);

module.exports = router;
