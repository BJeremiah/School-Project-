const express = require('express');
const router = express.Router();
const { login } = require('../controllers/authController');
const { getSchoolName } = require('../controllers/settingsController');
// POST /api/auth/login
router.post('/login', login);
// GET /api/auth/school-name — public, shown on the login screen
router.get('/school-name', getSchoolName);
module.exports = router;