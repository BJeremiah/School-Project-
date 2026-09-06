const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  getToday,
  listSections,
  addSection,
  updateSection,
  startFeeTracking,
  markAbsent,
  unmarkAbsent,
  setExempt,
  removeExempt,
  listClassesOverview,
  getClassStudentsStatus,
  getStudentFeeProfile,
  recordPayment,
  getClassRecords,
  getSchoolRecords,
  getGrossTotal,
} = require('../controllers/accountantController');

router.get('/today', requireAuth, requireRole('accountant'), getToday);
router.get('/sections', requireAuth, requireRole('accountant'), listSections);
router.post('/sections', requireAuth, requireRole('accountant'), addSection);
router.put('/sections/:id', requireAuth, requireRole('accountant'), updateSection);
router.get('/classes', requireAuth, requireRole('accountant'), listClassesOverview);
router.get('/classes/:classId/students', requireAuth, requireRole('accountant'), getClassStudentsStatus);
router.get('/students/:id', requireAuth, requireRole('accountant'), getStudentFeeProfile);
router.post('/payments', requireAuth, requireRole('accountant'), recordPayment);
router.post('/students/:studentId/fees/:sectionId/start', requireAuth, requireRole('accountant'), startFeeTracking);
router.post('/students/:studentId/absent', requireAuth, requireRole('accountant'), markAbsent);
router.delete('/students/:studentId/absent', requireAuth, requireRole('accountant'), unmarkAbsent);
router.post('/students/:studentId/fees/:sectionId/exempt', requireAuth, requireRole('accountant'), setExempt);
router.delete('/students/:studentId/fees/:sectionId/exempt', requireAuth, requireRole('accountant'), removeExempt);
router.get('/records/gross', requireAuth, requireRole('accountant'), getGrossTotal);
router.get('/records/school', requireAuth, requireRole('accountant'), getSchoolRecords);
router.get('/records/class/:classId', requireAuth, requireRole('accountant'), getClassRecords);

module.exports = router;