const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { submitReport } = require('../controllers/reportsController');

router.post('/submit', requireAuth, requireRole('teacher'), submitReport);

module.exports = router;
