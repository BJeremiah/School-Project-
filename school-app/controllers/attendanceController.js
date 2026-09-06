const pool = require('../config/db');

// Helper: true if today (server date, UTC) falls on a Saturday or Sunday
function isTodayWeekend() {
  const day = new Date().getUTCDay(); // 0 = Sunday, 6 = Saturday
  return day === 0 || day === 6;
}

// Helper: get the Monday and Friday of the calendar week containing a given date
function getWeekRange(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diffToMonday);
  const friday = new Date(monday);
  friday.setUTCDate(monday.getUTCDate() + 4);
  const toISO = (dt) => dt.toISOString().slice(0, 10);
  return { monday: toISO(monday), friday: toISO(friday) };
}

async function getTeacherClassId(userId) {
  const result = await pool.query('SELECT id FROM classes WHERE teacher_id = $1', [userId]);
  return result.rows.length ? result.rows[0].id : null;
}

// Resolve which class this request is working in: prefer an explicit classId
// (sent by the frontend once a teacher has picked a class), falling back to
// the old "class this account owns" lookup if none was provided.
async function resolveClassId(req) {
  const explicitClassId = req.query.classId || req.body.classId;
  if (explicitClassId) {
    const check = await pool.query('SELECT id FROM classes WHERE id = $1', [explicitClassId]);
    return check.rows.length ? check.rows[0].id : null;
  }
  return getTeacherClassId(req.user.userId);
}

// GET /api/attendance/today — roster + today's marks (if any) + register status
async function getTodayAttendance(req, res) {
  try {
    const classId = await resolveClassId(req);
    if (!classId) return res.status(404).json({ error: 'No class assigned to this teacher.' });

    const statusResult = await pool.query(
      'SELECT term_ended FROM class_register_status WHERE class_id = $1',
      [classId]
    );
    const termEnded = statusResult.rows.length ? statusResult.rows[0].term_ended : false;

    const studentsResult = await pool.query(
      `SELECT id, first_name, last_name, gender FROM students
       WHERE class_id = $1 AND status = 'active' ORDER BY last_name, first_name`,
      [classId]
    );

    const isWeekend = isTodayWeekend();

    if (isWeekend) {
      return res.json({
        class_id: classId,
        term_ended: termEnded,
        submitted: false,
        is_holiday: false,
        is_weekend: true,
        students: studentsResult.rows,
        marks: {},
      });
    }

    const dayResult = await pool.query(
      `SELECT id, is_holiday FROM attendance_days WHERE class_id = $1 AND attendance_date = CURRENT_DATE`,
      [classId]
    );

    let marks = {};
    let isHoliday = false;
    let submitted = false;

    if (dayResult.rows.length) {
      submitted = true;
      isHoliday = dayResult.rows[0].is_holiday;
      const dayId = dayResult.rows[0].id;
      const recordsResult = await pool.query(
        'SELECT student_id, present FROM attendance_records WHERE day_id = $1',
        [dayId]
      );
      recordsResult.rows.forEach((r) => { marks[r.student_id] = r.present; });
    }

    res.json({
      class_id: classId,
      term_ended: termEnded,
      submitted,
      is_holiday: isHoliday,
      is_weekend: false,
      students: studentsResult.rows,
      marks,
    });
  } catch (err) {
    console.error('getTodayAttendance error:', err);
    res.status(500).json({ error: 'Failed to load today\'s attendance.' });
  }
}

// POST /api/attendance/today — submit today's present/absent marks
// body: { marks: { studentId: true/false, ... }, classId? }
async function submitTodayAttendance(req, res) {
  const { marks } = req.body;

  if (!marks || typeof marks !== 'object' || Array.isArray(marks)) {
    return res.status(400).json({ error: 'marks object is required, e.g. { "studentId": true }' });
  }

  if (isTodayWeekend()) {
    return res.status(403).json({ error: 'Attendance cannot be taken on a weekend.' });
  }

  const client = await pool.connect();
  try {
    const classId = await resolveClassId(req);
    if (!classId) return res.status(404).json({ error: 'No class assigned to this teacher.' });

    const statusResult = await pool.query(
      'SELECT term_ended FROM class_register_status WHERE class_id = $1',
      [classId]
    );
    if (statusResult.rows.length && statusResult.rows[0].term_ended) {
      return res.status(403).json({ error: 'The register has been ended for this term. Attendance can no longer be taken.' });
    }

    const studentIds = Object.keys(marks);
    if (studentIds.length === 0) {
      return res.status(400).json({ error: 'At least one student mark is required.' });
    }

    // Confirm every studentId actually belongs to this class
    const validStudents = await client.query(
      `SELECT id FROM students WHERE class_id = $1 AND id = ANY($2::uuid[])`,
      [classId, studentIds]
    );
    if (validStudents.rows.length !== studentIds.length) {
      return res.status(400).json({ error: 'One or more students do not belong to this class.' });
    }

    await client.query('BEGIN');

    const dayResult = await client.query(
      `INSERT INTO attendance_days (class_id, attendance_date, is_holiday)
       VALUES ($1, CURRENT_DATE, false)
       ON CONFLICT (class_id, attendance_date)
       DO UPDATE SET is_holiday = false
       RETURNING id`,
      [classId]
    );
    const dayId = dayResult.rows[0].id;

    // Clear any previous marks for today (allows re-submission / corrections same day)
    await client.query('DELETE FROM attendance_records WHERE day_id = $1', [dayId]);

    const absentStudentIds = [];

    for (const studentId of studentIds) {
      const isPresent = marks[studentId] === true;
      await client.query(
        'INSERT INTO attendance_records (day_id, student_id, present) VALUES ($1, $2, $3)',
        [dayId, studentId, isPresent]
      );
      if (!isPresent) absentStudentIds.push(studentId);
    }

    // Create a Secretary notification for each absent student today (skip duplicates for the same day)
    for (const studentId of absentStudentIds) {
      await client.query(
        `INSERT INTO absence_notifications (student_id, class_id, attendance_date)
         VALUES ($1, $2, CURRENT_DATE)
         ON CONFLICT (student_id, attendance_date) DO NOTHING`,
        [studentId, classId]
      );
    }

    await client.query('COMMIT');

    const io = require('../config/socket').getIO();
    try {
      io.emit('attendance_submitted', { class_id: classId, date: new Date().toISOString().slice(0, 10) });

      if (absentStudentIds.length > 0) {
        const absentDetails = await pool.query(
          `SELECT s.id, s.first_name, s.last_name, s.guardian_name, s.guardian_phone, c.class_name
           FROM students s JOIN classes c ON c.id = s.class_id
           WHERE s.id = ANY($1::uuid[])`,
          [absentStudentIds]
        );
        io.emit('absence_notification', { students: absentDetails.rows, date: new Date().toISOString().slice(0, 10) });
      }
    } catch (e) {
      // socket failure should never break the request
    }

    res.status(201).json({ message: 'Attendance saved for today.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('submitTodayAttendance error:', err);
    res.status(500).json({ error: 'Failed to save attendance.' });
  } finally {
    client.release();
  }
}

// POST /api/attendance/holiday — mark today as a holiday (no attendance taken)
async function declareHoliday(req, res) {
  try {
    const classId = await resolveClassId(req);
    if (!classId) return res.status(404).json({ error: 'No class assigned to this teacher.' });

    const statusResult = await pool.query(
      'SELECT term_ended FROM class_register_status WHERE class_id = $1',
      [classId]
    );
    if (statusResult.rows.length && statusResult.rows[0].term_ended) {
      return res.status(403).json({ error: 'The register has been ended for this term.' });
    }

    await pool.query(
      `INSERT INTO attendance_days (class_id, attendance_date, is_holiday)
       VALUES ($1, CURRENT_DATE, true)
       ON CONFLICT (class_id, attendance_date)
       DO UPDATE SET is_holiday = true`,
      [classId]
    );

    // Remove any marks if a holiday is declared after marks were already taken today
    const dayResult = await pool.query(
      'SELECT id FROM attendance_days WHERE class_id = $1 AND attendance_date = CURRENT_DATE',
      [classId]
    );
    if (dayResult.rows.length) {
      await pool.query('DELETE FROM attendance_records WHERE day_id = $1', [dayResult.rows[0].id]);
    }

    res.json({ message: 'Today has been marked as a holiday.' });
  } catch (err) {
    console.error('declareHoliday error:', err);
    res.status(500).json({ error: 'Failed to declare holiday.' });
  }
}

// POST /api/attendance/end-term — lock the register for this class for the rest of the term
async function endRegisterForTerm(req, res) {
  try {
    const classId = await resolveClassId(req);
    if (!classId) return res.status(404).json({ error: 'No class assigned to this teacher.' });

    await pool.query(
      `INSERT INTO class_register_status (class_id, term_ended, term_ended_at)
       VALUES ($1, true, now())
       ON CONFLICT (class_id) DO UPDATE SET term_ended = true, term_ended_at = now()`,
      [classId]
    );

    res.json({ message: 'The register has been ended for this term.' });
  } catch (err) {
    console.error('endRegisterForTerm error:', err);
    res.status(500).json({ error: 'Failed to end the register.' });
  }
}

// POST /api/attendance/reopen — reopen the register (new term)
async function reopenRegister(req, res) {
  try {
    const classId = await resolveClassId(req);
    if (!classId) return res.status(404).json({ error: 'No class assigned to this teacher.' });

    await pool.query(
      `INSERT INTO class_register_status (class_id, term_ended, term_ended_at)
       VALUES ($1, false, NULL)
       ON CONFLICT (class_id) DO UPDATE SET term_ended = false, term_ended_at = NULL`,
      [classId]
    );

    res.json({ message: 'The register has been reopened.' });
  } catch (err) {
    console.error('reopenRegister error:', err);
    res.status(500).json({ error: 'Failed to reopen the register.' });
  }
}

// GET /api/attendance/day/:date — full detail for one specific day (YYYY-MM-DD)
async function getDayDetail(req, res) {
  const { date } = req.params;

  try {
    const classId = await resolveClassId(req);
    if (!classId) return res.status(404).json({ error: 'No class assigned to this teacher.' });

    const dayResult = await pool.query(
      'SELECT id, is_holiday, submitted_at FROM attendance_days WHERE class_id = $1 AND attendance_date = $2',
      [classId, date]
    );

    if (dayResult.rows.length === 0) {
      return res.json({ date, exists: false });
    }

    const day = dayResult.rows[0];

    if (day.is_holiday) {
      return res.json({ date, exists: true, is_holiday: true });
    }

    const recordsResult = await pool.query(
      `SELECT s.id, s.first_name, s.last_name, s.gender, ar.present
       FROM attendance_records ar
       JOIN students s ON s.id = ar.student_id
       WHERE ar.day_id = $1
       ORDER BY s.last_name, s.first_name`,
      [day.id]
    );

    const rows = recordsResult.rows;
    const summary = {
      boys_present: rows.filter((r) => r.gender === 'M' && r.present).length,
      girls_present: rows.filter((r) => r.gender === 'F' && r.present).length,
      total_present: rows.filter((r) => r.present).length,
      total_absent: rows.filter((r) => !r.present).length,
      absent_students: rows.filter((r) => !r.present).map((r) => `${r.first_name} ${r.last_name}`),
    };

    res.json({ date, exists: true, is_holiday: false, submitted_at: day.submitted_at, summary, students: rows });
  } catch (err) {
    console.error('getDayDetail error:', err);
    res.status(500).json({ error: 'Failed to load that day.' });
  }
}

// GET /api/attendance/weeks — list of all weeks that have at least one recorded day, most recent first
async function listWeeks(req, res) {
  try {
    const classId = await resolveClassId(req);
    if (!classId) return res.status(404).json({ error: 'No class assigned to this teacher.' });

    const daysResult = await pool.query(
      'SELECT attendance_date FROM attendance_days WHERE class_id = $1 ORDER BY attendance_date',
      [classId]
    );

    const weekMap = new Map();
    daysResult.rows.forEach((row) => {
      const dateStr = row.attendance_date.toISOString().slice(0, 10);
      const { monday, friday } = getWeekRange(dateStr);
      const key = monday;
      if (!weekMap.has(key)) weekMap.set(key, { week_start: monday, week_end: friday });
    });

    const weeks = Array.from(weekMap.values()).sort((a, b) => (a.week_start < b.week_start ? 1 : -1));
    res.json({ weeks });
  } catch (err) {
    console.error('listWeeks error:', err);
    res.status(500).json({ error: 'Failed to load weeks.' });
  }
}

// GET /api/attendance/week/:weekStart — full breakdown for one week (weekStart = the Monday, YYYY-MM-DD)
async function getWeekDetail(req, res) {
  const { weekStart } = req.params;

  try {
    const classId = await resolveClassId(req);
    if (!classId) return res.status(404).json({ error: 'No class assigned to this teacher.' });

    const { monday, friday } = getWeekRange(weekStart);

    const daysResult = await pool.query(
      `SELECT id, attendance_date, is_holiday FROM attendance_days
       WHERE class_id = $1 AND attendance_date BETWEEN $2 AND $3
       ORDER BY attendance_date`,
      [classId, monday, friday]
    );

    const days = [];
    let weekBoysPresent = 0;
    let weekGirlsPresent = 0;
    let weekTotalPresent = 0;
    let weekTotalAbsent = 0;

    for (const day of daysResult.rows) {
      const dateStr = day.attendance_date.toISOString().slice(0, 10);

      if (day.is_holiday) {
        days.push({ date: dateStr, is_holiday: true });
        continue;
      }

      const recordsResult = await pool.query(
        `SELECT s.gender, ar.present FROM attendance_records ar
         JOIN students s ON s.id = ar.student_id
         WHERE ar.day_id = $1`,
        [day.id]
      );
      const rows = recordsResult.rows;
      const boysPresent = rows.filter((r) => r.gender === 'M' && r.present).length;
      const girlsPresent = rows.filter((r) => r.gender === 'F' && r.present).length;
      const totalPresent = rows.filter((r) => r.present).length;
      const totalAbsent = rows.filter((r) => !r.present).length;

      weekBoysPresent += boysPresent;
      weekGirlsPresent += girlsPresent;
      weekTotalPresent += totalPresent;
      weekTotalAbsent += totalAbsent;

      days.push({
        date: dateStr,
        is_holiday: false,
        boys_present: boysPresent,
        girls_present: girlsPresent,
        total_present: totalPresent,
        total_absent: totalAbsent,
      });
    }

    res.json({
      week_start: monday,
      week_end: friday,
      days,
      week_totals: {
        boys_present: weekBoysPresent,
        girls_present: weekGirlsPresent,
        total_present: weekTotalPresent,
        total_absent: weekTotalAbsent,
      },
    });
  } catch (err) {
    console.error('getWeekDetail error:', err);
    res.status(500).json({ error: 'Failed to load that week.' });
  }
}

module.exports = {
  getTodayAttendance,
  submitTodayAttendance,
  declareHoliday,
  endRegisterForTerm,
  reopenRegister,
  getDayDetail,
  listWeeks,
  getWeekDetail,
};