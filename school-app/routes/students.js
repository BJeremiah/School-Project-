const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { listStudents, addStudent, removeStudent, listAllClasses } = require('../controllers/studentsController');

router.get('/', requireAuth, requireRole('teacher'), listStudents);
router.get('/all-classes', requireAuth, requireRole('teacher'), listAllClasses);
router.post('/', requireAuth, requireRole('teacher'), addStudent);
router.delete('/:id', requireAuth, requireRole('teacher'), removeStudent);

module.exports = router;