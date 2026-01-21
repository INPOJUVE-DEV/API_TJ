const express = require('express');
const router = express.Router();
const catalogController = require('../controllers/catalogController');
const verifyToken = require('../middleware/auth');
const authorizeRole = require('../middleware/authorizeRole');

const CAN_READ = authorizeRole(['admin', 'reader']);
const CAN_WRITE = authorizeRole(['admin']);

router.get('/catalog', verifyToken, CAN_READ, catalogController.getCatalog);
router.get('/catalog/:id', verifyToken, CAN_READ, catalogController.getBenefitById);
router.post('/catalog', verifyToken, CAN_WRITE, catalogController.createBenefit);
router.put('/catalog/:id', verifyToken, CAN_WRITE, catalogController.updateBenefit);
router.delete('/catalog/:id', verifyToken, CAN_WRITE, catalogController.deleteBenefit);

module.exports = router;
