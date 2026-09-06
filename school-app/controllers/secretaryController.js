const pool = require('../config/db');
const multer = require('multer');
const path = require('path');

const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads', 'students'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${req.params.id}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage: photoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed.'));
    }
    cb(null, true);
  },
});

// GET /api/secretary/classes — every class, with student counts split by gender
async function listClassesOverview(req, res) {
  try {
    const result = await pool.query(
      `SELECT c.id, c.class_name,
              COUNT(s.id) FILTER (WHERE s.status = 'active') AS total_students,
              COUNT(s.id) FILTER (WHERE s.status = 'active' AND s.gender = 'M') AS male_count,
              COUNT(s.id) FILTER (WHERE s.status = 'active' AND s.gender = 'F') AS female_count
       FROM classes c
       LEFT JOIN students s ON s.class_id = c.id
       GROUP BY c.id, c.class_name
       ORDER BY c.class_name`
    );
    res.json({ classes: result.rows });
  } catch (err) {
    console.error('listClassesOverview error:', err);
    res.status(500).json({ error: 'Failed to load classes overview.' });
  }
}

// GET /api/secretary/classes/:classId/students — student list for one class
async function listStudentsInClass(req, res) {
  const { classId } = req.params;
  try {
    const classResult = await pool.query('SELECT id, class_name FROM classes WHERE id = $1', [classId]);
    if (classResult.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found.' });
    }

    const studentsResult = await pool.query(
      `SELECT id, first_name, last_name, gender, admission_number
       FROM students WHERE class_id = $1 AND status = 'active'
       ORDER BY last_name, first_name`,
      [classId]
    );

    res.json({ class: classResult.rows[0], students: studentsResult.rows });
  } catch (err) {
    console.error('listStudentsInClass error:', err);
    res.status(500).json({ error: 'Failed to load students.' });
  }
}

// GET /api/secretary/students/:id — full student profile
async function getStudentProfile(req, res) {
  const { id } = req.params;
  try {
    const studentResult = await pool.query(
      `SELECT s.*, c.class_name
       FROM students s
       JOIN classes c ON c.id = s.class_id
       WHERE s.id = $1`,
      [id]
    );
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    const pickupResult = await pool.query(
      `SELECT name, contact, relationship, car_registration_no
       FROM authorized_pickup_persons WHERE student_id = $1 ORDER BY created_at`,
      [id]
    );

    res.json({ student: studentResult.rows[0], pickup_persons: pickupResult.rows });
  } catch (err) {
    console.error('getStudentProfile error:', err);
    res.status(500).json({ error: 'Failed to load student profile.' });
  }
}

// GET /api/secretary/students/search?q=... — search by name across the whole school
async function searchStudents(req, res) {
  const { q } = req.query;
  if (!q || !q.trim()) {
    return res.status(400).json({ error: 'A search term (q) is required.' });
  }

  try {
    const result = await pool.query(
      `SELECT s.id, s.first_name, s.last_name, s.gender, s.admission_number, c.class_name
       FROM students s
       JOIN classes c ON c.id = s.class_id
       WHERE s.status = 'active'
         AND (s.first_name ILIKE $1 OR s.last_name ILIKE $1 OR s.admission_number ILIKE $1)
       ORDER BY s.last_name, s.first_name
       LIMIT 50`,
      [`%${q.trim()}%`]
    );
    res.json({ results: result.rows });
  } catch (err) {
    console.error('searchStudents error:', err);
    res.status(500).json({ error: 'Search failed.' });
  }
}

// GET /api/secretary/admissions — school-wide admission list with male/female breakdown
async function getAdmissionsList(req, res) {
  try {
    const totalsResult = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'active') AS total_students,
         COUNT(*) FILTER (WHERE status = 'active' AND gender = 'M') AS total_male,
         COUNT(*) FILTER (WHERE status = 'active' AND gender = 'F') AS total_female
       FROM students`
    );

    const listResult = await pool.query(
      `SELECT s.id, s.first_name, s.last_name, s.gender, s.admission_number,
              s.date_of_admission, c.class_name
       FROM students s
       JOIN classes c ON c.id = s.class_id
       WHERE s.status = 'active'
       ORDER BY s.date_of_admission DESC NULLS LAST, s.last_name`
    );

    res.json({ totals: totalsResult.rows[0], students: listResult.rows });
  } catch (err) {
    console.error('getAdmissionsList error:', err);
    res.status(500).json({ error: 'Failed to load admissions list.' });
  }
}

// POST /api/secretary/admissions — admit a new student (full admission form)
async function admitStudent(req, res) {
  const {
    first_name, last_name, gender, class_id,
    date_of_birth, nationality, home_town, chronic_illnesses,
    guardian_name, guardian_occupation, guardian_phone, guardian_employer,
    guardian_nationality, guardian_address,
    date_of_acceptance, date_of_admission, remarks, admission_officer_name,
    admission_number,
    pickup_persons, // array of { name, contact, relationship, car_registration_no }
  } = req.body;

  if (!first_name || !last_name || !gender || !class_id) {
    return res.status(400).json({ error: 'first_name, last_name, gender, and class_id are required.' });
  }
  if (gender !== 'M' && gender !== 'F') {
    return res.status(400).json({ error: "gender must be 'M' or 'F'." });
  }

  const client = await pool.connect();
  try {
    const classCheck = await client.query('SELECT id FROM classes WHERE id = $1', [class_id]);
    if (classCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found.' });
    }

    await client.query('BEGIN');

    const insertResult = await client.query(
      `INSERT INTO students (
         class_id, first_name, last_name, gender, admission_number,
         date_of_birth, nationality, home_town, chronic_illnesses,
         guardian_name, guardian_occupation, guardian_phone, guardian_employer,
         guardian_nationality, guardian_address,
         date_of_acceptance, date_of_admission, remarks, admission_officer_name
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING id`,
      [
        class_id, first_name, last_name, gender, admission_number || null,
        date_of_birth || null, nationality || null, home_town || null, chronic_illnesses || null,
        guardian_name || null, guardian_occupation || null, guardian_phone || null, guardian_employer || null,
        guardian_nationality || null, guardian_address || null,
        date_of_acceptance || null, date_of_admission || null, remarks || null, admission_officer_name || null,
      ]
    );

    const studentId = insertResult.rows[0].id;

    if (Array.isArray(pickup_persons)) {
      for (const p of pickup_persons) {
        if (p && p.name) {
          await client.query(
            `INSERT INTO authorized_pickup_persons (student_id, name, contact, relationship, car_registration_no)
             VALUES ($1, $2, $3, $4, $5)`,
            [studentId, p.name, p.contact || null, p.relationship || null, p.car_registration_no || null]
          );
        }
      }
    }
    // Auto-enroll this new student into every existing fee section, so the Accountant sees them immediately (not yet started)
    const sectionsResult = await client.query('SELECT id FROM fee_sections');
    for (const section of sectionsResult.rows) {
      await client.query(
        `INSERT INTO student_fee_balances (student_id, fee_section_id, balance, balance_date, started)
         VALUES ($1, $2, 0, CURRENT_DATE, false)
         ON CONFLICT (student_id, fee_section_id) DO NOTHING`,
        [studentId, section.id]
      );
    }
// Notify the Director of this new admission
    await client.query(
      `INSERT INTO admission_notifications (student_id, class_id) VALUES ($1, $2)`,
      [studentId, class_id]
    );

    await client.query('COMMIT');
    res.status(201).json({ student_id: studentId, message: 'Student admitted successfully.' });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A student with that admission number already exists.' });
    }
    console.error('admitStudent error:', err);
    res.status(500).json({ error: 'Failed to admit student.' });
  } finally {
    client.release();
  }
}

// PUT /api/secretary/students/:id — edit an existing student's details
async function updateStudent(req, res) {
  const { id } = req.params;
  const {
    first_name, last_name, gender,
    date_of_birth, nationality, home_town, chronic_illnesses,
    guardian_name, guardian_occupation, guardian_phone, guardian_employer,
    guardian_nationality, guardian_address,
    date_of_acceptance, date_of_admission, remarks, admission_officer_name,
    admission_number,
  } = req.body;

  if (!first_name || !last_name || !gender) {
    return res.status(400).json({ error: 'first_name, last_name, and gender are required.' });
  }
  if (gender !== 'M' && gender !== 'F') {
    return res.status(400).json({ error: "gender must be 'M' or 'F'." });
  }

  try {
    const result = await pool.query(
      `UPDATE students SET
         first_name = $1, last_name = $2, gender = $3,
         date_of_birth = $4, nationality = $5, home_town = $6, chronic_illnesses = $7,
         guardian_name = $8, guardian_occupation = $9, guardian_phone = $10, guardian_employer = $11,
         guardian_nationality = $12, guardian_address = $13,
         date_of_acceptance = $14, date_of_admission = $15, remarks = $16, admission_officer_name = $17,
         admission_number = $18
       WHERE id = $19
       RETURNING id`,
      [
        first_name, last_name, gender,
        date_of_birth || null, nationality || null, home_town || null, chronic_illnesses || null,
        guardian_name || null, guardian_occupation || null, guardian_phone || null, guardian_employer || null,
        guardian_nationality || null, guardian_address || null,
        date_of_acceptance || null, date_of_admission || null, remarks || null, admission_officer_name || null,
        admission_number || null,
        id,
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found.' });
    }
    res.json({ message: 'Student updated successfully.' });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A student with that admission number already exists.' });
    }
    console.error('updateStudent error:', err);
    res.status(500).json({ error: 'Failed to update student.' });
  }
}

// POST /api/secretary/students/:id/photo — upload/replace a student's photo
async function uploadStudentPhoto(req, res) {
  const { id } = req.params;
  if (!req.file) {
    return res.status(400).json({ error: 'No photo file was uploaded.' });
  }
  const photoUrl = `/uploads/students/${req.file.filename}`;
  try {
    const result = await pool.query(
      'UPDATE students SET photo_url = $1 WHERE id = $2 RETURNING id, photo_url',
      [photoUrl, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found.' });
    }
    res.json({ photo_url: result.rows[0].photo_url });
  } catch (err) {
    console.error('uploadStudentPhoto error:', err);
    res.status(500).json({ error: 'Failed to save photo.' });
  }
}

// GET /api/secretary/notifications — absence notifications, most recent first
async function getNotifications(req, res) {
  try {
    const result = await pool.query(
      `SELECT n.id, n.attendance_date, n.is_read, n.called, n.created_at,
              s.first_name, s.last_name, s.guardian_name, s.guardian_phone,
              c.class_name
       FROM absence_notifications n
       JOIN students s ON s.id = n.student_id
       JOIN classes c ON c.id = n.class_id
       ORDER BY n.created_at DESC
       LIMIT 100`
    );
    res.json({ notifications: result.rows });
  } catch (err) {
    console.error('getNotifications error:', err);
    res.status(500).json({ error: 'Failed to load notifications.' });
  }
}
// POST /api/secretary/notifications/:id/read — mark one notification as read
async function markNotificationRead(req, res) {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'UPDATE absence_notifications SET is_read = true WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found.' });
    }
    res.json({ message: 'Marked as read.' });
  } catch (err) {
    console.error('markNotificationRead error:', err);
    res.status(500).json({ error: 'Failed to update notification.' });
  }
}

// POST /api/secretary/notifications/:id/called -- mark one notification as called (or uncalled)
async function markNotificationCalled(req, res) {
  const { id } = req.params;
  const { called } = req.body;
  try {
    const result = await pool.query(
      "UPDATE absence_notifications SET called = $1 WHERE id = $2 RETURNING id, called",
      [called === true, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Notification not found." });
    }
    res.json({ id: result.rows[0].id, called: result.rows[0].called });
  } catch (err) {
    console.error("markNotificationCalled error:", err);
    res.status(500).json({ error: "Failed to update notification." });
  }
}

module.exports = {
  listClassesOverview,
  listStudentsInClass,
  getStudentProfile,
  searchStudents,
  getAdmissionsList,
  admitStudent,
  updateStudent,
  uploadStudentPhoto,
  upload,
  getNotifications,
  markNotificationRead,
  markNotificationCalled,
};