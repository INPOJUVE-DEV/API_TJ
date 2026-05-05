const express = require('express');
const router = express.Router();
const catalogController = require('../controllers/catalogController');
const verifyToken = require('../middleware/auth');
const verifyAdminToken = require('../middleware/adminAuth');
const authorizeRole = require('../middleware/authorizeRole');

const CAN_READ = authorizeRole(['admin', 'reader', 'beneficiary']);
const CAN_WRITE = authorizeRole(['admin']);

router.get('/catalog', verifyToken, CAN_READ, catalogController.getCatalog);
router.get('/catalog/highlights', verifyToken, CAN_READ, catalogController.getCatalogHighlights);
router.get('/catalog/:id', verifyToken, CAN_READ, catalogController.getBenefitById);
router.post('/catalog', verifyAdminToken, CAN_WRITE, catalogController.createBenefit);
router.put('/catalog/:id', verifyAdminToken, CAN_WRITE, catalogController.updateBenefit);
router.delete('/catalog/:id', verifyAdminToken, CAN_WRITE, catalogController.deleteBenefit);

module.exports = router;
