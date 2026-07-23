const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { getDashboard } = require('../controllers/dashboardController');
const { getRates, updateRates } = require('../controllers/ratesController');
const { resetTodayReport } = require('../controllers/reportsController');

const directorOnly = [requireAuth, requireRole('director')];

router.get('/dashboard', ...directorOnly, getDashboard);
router.get('/rates', ...directorOnly, getRates);
router.put('/rates', ...directorOnly, updateRates);
router.delete('/reports/:classId/today', ...directorOnly, resetTodayReport);

module.exports = router;