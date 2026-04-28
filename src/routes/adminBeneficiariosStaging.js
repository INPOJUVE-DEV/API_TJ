const express = require('express');
const controller = require('../controllers/adminBeneficiariosStagingController');
const verifyAdminToken = require('../middleware/adminAuth');
const authorizeRole = require('../middleware/authorizeRole');

const router = express.Router();

router.get(
  '/beneficiarios-staging',
  verifyAdminToken,
  authorizeRole(['admin', 'reader']),
  controller.list
);
router.get(
  '/beneficiarios-staging/:id',
  verifyAdminToken,
  authorizeRole(['admin', 'reader']),
  controller.getById
);
router.get(
  '/beneficiarios-staging/:id/attempts',
  verifyAdminToken,
  authorizeRole(['admin', 'reader']),
  controller.getAttempts
);
router.post(
  '/beneficiarios-staging/:id/push',
  verifyAdminToken,
  authorizeRole(['admin']),
  controller.push
);

module.exports = router;
