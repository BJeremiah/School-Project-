const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  listClassesOverview,
  listStudentsInClass,
  getStudentProfile,
  searchStudents,
  getAdmissionsList,
  admitStudent,
  updateStudent,
  uploadStudentPhoto,
  upload,
  getNotifications,
  markNotificationRead,
  markNotificationCalled,
} = require('../controllers/secretaryController');

const {
  listStaff,
  addStaff,
  updateStaff,
  removeStaff,
  listInactiveStaff,
  reactivateStaff,
  permanentlyDeleteStaff,
  getSalariesForMonth,
  setSalary,
} = require('../controllers/salariesController');

router.get('/classes', requireAuth, requireRole('secretary'), listClassesOverview);
router.get('/classes/:classId/students', requireAuth, requireRole('secretary'), listStudentsInClass);
router.get('/students/search', requireAuth, requireRole('secretary'), searchStudents);
router.get('/students/:id', requireAuth, requireRole('secretary'), getStudentProfile);
router.get('/admissions', requireAuth, requireRole('secretary'), getAdmissionsList);
router.post('/admissions', requireAuth, requireRole('secretary'), admitStudent);
router.post('/admissions', requireAuth, requireRole('secretary'), admitStudent);
router.put('/students/:id', requireAuth, requireRole('secretary'), updateStudent);
router.post('/students/:id/photo', requireAuth, requireRole('secretary'), upload.single('photo'), uploadStudentPhoto);
router.get('/notifications', requireAuth, requireRole('secretary'), getNotifications);
router.post('/notifications/:id/read', requireAuth, requireRole('secretary'), markNotificationRead);
router.post("/notifications/:id/called", requireAuth, requireRole("secretary"), markNotificationCalled);
router.get('/staff', requireAuth, requireRole('secretary'), listStaff);
router.post('/staff', requireAuth, requireRole('secretary'), addStaff);
router.put('/staff/:id', requireAuth, requireRole('secretary'), updateStaff);
router.delete('/staff/:id', requireAuth, requireRole('secretary'), removeStaff);
router.get('/staff/inactive', requireAuth, requireRole('secretary'), listInactiveStaff);
router.put('/staff/:id/reactivate', requireAuth, requireRole('secretary'), reactivateStaff);
router.delete('/staff/:id/permanent', requireAuth, requireRole('secretary'), permanentlyDeleteStaff);
router.get('/salaries', requireAuth, requireRole('secretary'), getSalariesForMonth);
router.post('/salaries', requireAuth, requireRole('secretary'), setSalary);

module.exports = router;