// controllers/settingsController.js
// School-wide settings (currently just the school name). Reading is public
// (needed on the login screen, before anyone is authenticated); writing is
// Director-only.

const pool = require('../config/db');

// GET /api/settings/school-name — public, no auth required
async function getSchoolName(req, res) {
  try {
    const result = await pool.query('SELECT school_name FROM school_settings WHERE id = 1');
    const schoolName = result.rows.length ? result.rows[0].school_name : 'School';
    res.json({ school_name: schoolName });
  } catch (err) {
    console.error('getSchoolName error:', err);
    res.status(500).json({ error: 'Failed to load school name.' });
  }
}

// PUT /api/director/settings/school-name — Director only
async function updateSchoolName(req, res) {
  try {
    const { school_name } = req.body;
    if (!school_name || !school_name.trim()) {
      return res.status(400).json({ error: 'School name is required.' });
    }
    const result = await pool.query(
      `INSERT INTO school_settings (id, school_name) VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE SET school_name = $1
       RETURNING school_name`,
      [school_name.trim()]
    );
    res.json({ school_name: result.rows[0].school_name });
  } catch (err) {
    console.error('updateSchoolName error:', err);
    res.status(500).json({ error: 'Failed to update school name.' });
  }
}

module.exports = { getSchoolName, updateSchoolName };