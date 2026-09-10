const pool = require('../config/db');

async function getTeacherClassId(userId) {
  const result = await pool.query('SELECT id FROM classes WHERE teacher_id = $1', [userId]);
  return result.rows.length ? result.rows[0].id : null;
}

async function resolveClassId(req) {
  // Locked to the account's own assigned class -- a classId from the
  // request is never trusted, since each class belongs to exactly one
  // teacher account (enforced at login).
  return getTeacherClassId(req.user.userId);
}

// GET /api/students — list active students in the selected class
async function listStudents(req, res) {
  try {
    const classId = await resolveClassId(req);
    if (!classId) {
      return res.status(404).json({ error: 'No class assigned to this teacher.' });
    }
    const studentsResult = await pool.query(
      `SELECT id, first_name, last_name, gender, admission_number, status
       FROM students
       WHERE class_id = $1 AND status = 'active'
       ORDER BY last_name, first_name`,
      [classId]
    );
    res.json({ class_id: classId, students: studentsResult.rows });
  } catch (err) {
    console.error('listStudents error:', err);
    res.status(500).json({ error: 'Failed to load students.' });
  }
}

// POST /api/students — add a student to the selected class
async function addStudent(req, res) {
  const { first_name, last_name, gender, admission_number } = req.body;
  if (!first_name || !last_name || !gender) {
    return res.status(400).json({ error: 'first_name, last_name, and gender are required.' });
  }
  if (gender !== 'M' && gender !== 'F') {
    return res.status(400).json({ error: "gender must be 'M' or 'F'." });
  }
  try {
    const classId = await resolveClassId(req);
    if (!classId) {
      return res.status(404).json({ error: 'No class assigned to this teacher.' });
    }
    const insertResult = await pool.query(
      `INSERT INTO students (class_id, first_name, last_name, gender, admission_number)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, first_name, last_name, gender, admission_number, status`,
      [classId, first_name, last_name, gender, admission_number || null]
    );
    res.status(201).json({ student: insertResult.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A student with that admission number already exists.' });
    }
    console.error('addStudent error:', err);
    res.status(500).json({ error: 'Failed to add student.' });
  }
}

// DELETE /api/students/:id — soft-delete (mark inactive) a student in the selected class
async function removeStudent(req, res) {
  const { id } = req.params;
  try {
    const classId = await resolveClassId(req);
    if (!classId) {
      return res.status(404).json({ error: 'No class assigned to this teacher.' });
    }
    const result = await pool.query(
      `UPDATE students
       SET status = 'inactive'
       WHERE id = $1
         AND class_id = $2
       RETURNING id`,
      [id, classId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found in this class.' });
    }
    res.json({ message: 'Student removed.' });
  } catch (err) {
    console.error('removeStudent error:', err);
    res.status(500).json({ error: 'Failed to remove student.' });
  }
}

// GET /api/classes/all-classes — every class in the school (any teacher can pick any class to work in)
async function listAllClasses(req, res) {
  try {
    const result = await pool.query('SELECT id, class_name FROM classes ORDER BY class_name');
    res.json({ classes: result.rows });
  } catch (err) {
    console.error('listAllClasses error:', err);
    res.status(500).json({ error: 'Failed to load classes.' });
  }
}

module.exports = { listStudents, addStudent, removeStudent, listAllClasses };