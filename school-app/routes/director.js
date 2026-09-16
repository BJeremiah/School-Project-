const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { getDashboard } = require('../controllers/dashboardController');
const { getRates, updateRates } = require('../controllers/ratesController');
const { resetTodayReport } = require('../controllers/reportsController');
const {
  getOverview,
  listClasses,
  getClassDetail,
  listTeacherAssignments,
  updateClassTeacher,
  createTeacherAccount,
  searchStudents,
  getStudentMasterProfile,
  getRecords,
  getAbsenceNotifications,
  getAdmissionNotifications,
  listStaffAccounts,
  blockStaff,
  unblockStaff,
  resetStaffPassword,
  getStatistics,
  getStatisticsTimeseries,
} = require('../controllers/directorOverviewController');
const { updateSchoolName } = require('../controllers/settingsController');

const directorOnly = [requireAuth, requireRole('director')];

// Legacy fee-dashboard routes (kept for now, not yet retired)
router.get('/dashboard', ...directorOnly, getDashboard);
router.get('/rates', ...directorOnly, getRates);
router.put('/rates', ...directorOnly, updateRates);
router.delete('/reports/:classId/today', ...directorOnly, resetTodayReport);

// New overview/master-view routes
router.get('/overview', ...directorOnly, getOverview);
router.get('/all-classes', ...directorOnly, listClasses);
router.get('/all-classes/:classId', ...directorOnly, getClassDetail);
router.get('/teacher-assignments', ...directorOnly, listTeacherAssignments);
router.post('/teacher-accounts', ...directorOnly, createTeacherAccount);
router.put('/classes/:classId/teacher', ...directorOnly, updateClassTeacher);
router.get('/all-students/search', ...directorOnly, searchStudents);
router.get('/all-students/:id', ...directorOnly, getStudentMasterProfile);
router.get('/all-records', ...directorOnly, getRecords);
router.get('/notifications/absences', ...directorOnly, getAbsenceNotifications);
router.get('/notifications/admissions', ...directorOnly, getAdmissionNotifications);
router.get('/staff', ...directorOnly, listStaffAccounts);
router.post('/staff/:id/block', ...directorOnly, blockStaff);
router.post('/staff/:id/unblock', ...directorOnly, unblockStaff);
router.post('/staff/:id/reset-password', ...directorOnly, resetStaffPassword);
router.get('/statistics', ...directorOnly, getStatistics);
router.get('/statistics/timeseries', ...directorOnly, getStatisticsTimeseries);
router.put('/settings/school-name', ...directorOnly, updateSchoolName);
module.exports = router;