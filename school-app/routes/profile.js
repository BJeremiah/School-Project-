const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getProfile, updateName, updatePassword } = require('../controllers/profileController');

router.get('/', requireAuth, getProfile);
router.put('/name', requireAuth, updateName);
router.put('/password', requireAuth, updatePassword);

module.exports = router;