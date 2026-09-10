const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

async function login(req, res) {
  try {
    const { email, password, classId } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const result = await pool.query(
      'SELECT id, name, email, password_hash, role, is_blocked FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    if (result.rows.length === 0) {
      // Deliberately generic message — don't reveal whether the
      // email exists to reduce user-enumeration risk.
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    if (user.is_blocked) {
      return res.status(403).json({ error: 'This account has been blocked by the Director.' });
    }

    let classInfo = null;
    if (user.role === 'teacher') {
      if (!classId) {
        return res.status(400).json({ error: 'Please select your class before logging in.' });
      }
      const classResult = await pool.query(
        'SELECT id, class_name FROM classes WHERE id = $1 AND teacher_id = $2',
        [classId, user.id]
      );
      if (classResult.rows.length === 0) {
        return res.status(403).json({ error: 'This account is not assigned to that class.' });
      }
      classInfo = classResult.rows[0];
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      class: classInfo ? { id: classInfo.id, name: classInfo.class_name } : undefined,
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = { login };