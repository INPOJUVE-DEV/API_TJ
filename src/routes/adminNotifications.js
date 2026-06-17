const express = require('express');
const controller = require('../controllers/adminNotificationsController');
const verifyAdminToken = require('../middleware/adminAuth');
const authorizeRole = require('../middleware/authorizeRole');
const noStore = require('../middleware/noStore');

const router = express.Router();

router.get(
  '/notifications/stream-token',
  verifyAdminToken,
  authorizeRole(['admin', 'reader']),
  noStore,
  controller.issueStreamToken
);
router.get(
  '/notifications/recent',
  verifyAdminToken,
  authorizeRole(['admin', 'reader']),
  noStore,
  controller.getRecent
);
router.get('/notifications/stream', noStore, controller.stream);
router.get('/notifications/demo', noStore, controller.demoPage);

module.exports = router;
