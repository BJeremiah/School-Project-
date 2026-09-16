// controllers/profileController.js
// Profile self-service: view own details, update name, change password.
// Works for any authenticated user regardless of role.

const bcrypt = require('bcryptjs');
const pool = require('../config/db');

// GET /api/profile
async function getProfile(req, res) {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role FROM users WHERE id = $1',
      [req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    return res.status(200).json({ user: result.rows[0] });
  } catch (err) {
    console.error('getProfile error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// PUT /api/profile/name
async function updateName(req, res) {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required.' });
    }
    const result = await pool.query(
      'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, email, role',
      [name.trim(), req.user.userId]
    );
    return res.status(200).json({ user: result.rows[0] });
  } catch (err) {
    console.error('updateName error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// PUT /api/profile/password
async function updatePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword) {
      return res.status(400).json({ error: 'A new password is required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const result = await pool.query(
      'SELECT password_hash, must_change_password FROM users WHERE id = $1',
      [req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = result.rows[0];
    const requiresCurrentPassword = !(user.must_change_password === true);

    if (requiresCurrentPassword && !currentPassword) {
      return res.status(400).json({ error: 'Current password is required.' });
    }

    if (requiresCurrentPassword) {
      const matches = await bcrypt.compare(currentPassword, user.password_hash);
      if (!matches) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
      }
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2',
      [newHash, req.user.userId]
    );

    return res.status(200).json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('updatePassword error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = { getProfile, updateName, updatePassword };