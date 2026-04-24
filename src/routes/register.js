const express = require('express');
const router = express.Router();
const registerController = require('../controllers/registerController');

router.post('/register', registerController.deprecatedRegister);
router.post('/register/register', registerController.deprecatedRegister);

module.exports = router;
