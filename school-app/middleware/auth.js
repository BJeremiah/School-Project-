const jwt = require('jsonwebtoken');
const pool = require('../config/db');

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { userId, role }

    const result = await pool.query('SELECT is_blocked FROM users WHERE id = $1', [decoded.userId]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Account no longer exists.' });
    }
    if (result.rows[0].is_blocked) {
      return res.status(403).json({ error: 'This account has been blocked by the Director.' });
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// Usage: requireRole('teacher') or requireRole('director')
// The Director can always access any role-restricted endpoint.
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || (req.user.role !== role && req.user.role !== 'director')) {
      return res.status(403).json({ error: `Access restricted to ${role}s.` });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };