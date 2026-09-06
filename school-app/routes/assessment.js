const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  listSubjects,
  addSubject,
  removeSubject,
  getSubjectScores,
  saveSubjectScores,
  getOverallRankings,
} = require('../controllers/assessmentController');

router.get('/subjects', requireAuth, requireRole('teacher'), listSubjects);
router.post('/subjects', requireAuth, requireRole('teacher'), addSubject);
router.delete('/subjects/:id', requireAuth, requireRole('teacher'), removeSubject);
router.get('/subject/:subjectId/scores', requireAuth, requireRole('teacher'), getSubjectScores);
router.post('/subject/:subjectId/scores', requireAuth, requireRole('teacher'), saveSubjectScores);
router.get('/rankings', requireAuth, requireRole('teacher'), getOverallRankings);

module.exports = router;