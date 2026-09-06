const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  getTodayAttendance,
  submitTodayAttendance,
  declareHoliday,
  endRegisterForTerm,
  reopenRegister,
  getDayDetail,
  listWeeks,
  getWeekDetail,
} = require('../controllers/attendanceController');

router.get('/today', requireAuth, requireRole('teacher'), getTodayAttendance);
router.post('/today', requireAuth, requireRole('teacher'), submitTodayAttendance);
router.post('/holiday', requireAuth, requireRole('teacher'), declareHoliday);
router.post('/end-term', requireAuth, requireRole('teacher'), endRegisterForTerm);
router.post('/reopen', requireAuth, requireRole('teacher'), reopenRegister);
router.get('/day/:date', requireAuth, requireRole('teacher'), getDayDetail);
router.get('/weeks', requireAuth, requireRole('teacher'), listWeeks);
router.get('/week/:weekStart', requireAuth, requireRole('teacher'), getWeekDetail);

module.exports = router;