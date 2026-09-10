const express = require('express');
const router = express.Router();
const { login } = require('../controllers/authController');
const { getSchoolName } = require('../controllers/settingsController');
const pool = require('../config/db');

// POST /api/auth/login
router.post('/login', login);

// GET /api/auth/school-name — public, shown on the login screen
router.get('/school-name', getSchoolName);

// GET /api/auth/classes — public, lets the Teacher login screen show a class picker
router.get('/classes', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, class_name FROM classes ORDER BY class_name');
    res.json({ classes: result.rows });
  } catch (err) {
    console.error('getClasses (public) error:', err);
    res.status(500).json({ error: 'Failed to load classes.' });
  }
});

module.exports = router;