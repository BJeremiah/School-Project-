const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  getReportCardRemarks,
  saveReportCardRemarks,
  generateReportCardPdf,
} = require('../controllers/reportCardController');

router.get('/:studentId', requireAuth, requireRole('teacher'), getReportCardRemarks);
router.post('/:studentId', requireAuth, requireRole('teacher'), saveReportCardRemarks);
router.get('/:studentId/pdf', requireAuth, requireRole('teacher'), generateReportCardPdf);

module.exports = router;