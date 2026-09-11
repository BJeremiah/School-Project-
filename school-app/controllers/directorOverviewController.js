const pool = require('../config/db');

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function isWeekday(dateStr) {
  const day = new Date(dateStr + 'T00:00:00Z').getUTCDay();
  return day !== 0 && day !== 6;
}

function weekdaysBetween(startDateStr, endDateStr) {
  const dates = [];
  const d = new Date(startDateStr + 'T00:00:00Z');
  const end = new Date(endDateStr + 'T00:00:00Z');
  while (d < end) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function getRangeDates(range, dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  if (range === 'day') return { start: dateStr, end: dateStr };
  if (range === 'week') {
    const day = d.getUTCDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
  }
  if (range === 'month') {
    const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    return { start: first.toISOString().slice(0, 10), end: last.toISOString().slice(0, 10) };
  }
  return null;
}

// Same fee-computation logic as the Accountant's controller, duplicated here since this is a read-only view
// (Director reads settle balances live, same as Accountant would, so figures always match exactly.)
async function settleBalanceReadOnly(client, studentId, feeSectionId, amount, frequency) {
  const today = todayStr();
  const balRes = await client.query(
    'SELECT balance, balance_date, started, exempted FROM student_fee_balances WHERE student_id = $1 AND fee_section_id = $2 FOR UPDATE',
    [studentId, feeSectionId]
  );
  if (balRes.rows.length === 0) return null;

  if (balRes.rows[0].exempted) {
    return { exempted: true, started: balRes.rows[0].started, balance: 0 };
  }

  const started = balRes.rows[0].started;
  if (!started) {
    return { started: false, balance: 0 };
  }

  let balance = Number(balRes.rows[0].balance);
  const balanceDateStr = balRes.rows[0].balance_date.toISOString().slice(0, 10);

  if (frequency === 'daily' && balanceDateStr < today) {
    const candidateDates = weekdaysBetween(balanceDateStr, today);
    if (candidateDates.length > 0) {
      const absentRes = await client.query(
        `SELECT absence_date FROM fee_absences WHERE student_id = $1 AND absence_date = ANY($2::date[])`,
        [studentId, candidateDates]
      );
      const absentSet = new Set(absentRes.rows.map((r) => r.absence_date.toISOString().slice(0, 10)));
      let chargeDays = 0;
      for (const dateStr of candidateDates) {
        if (!absentSet.has(dateStr)) chargeDays++;
      }
      if (chargeDays > 0) balance = balance - Number(amount) * chargeDays;
    }
  }

  await client.query(
    'UPDATE student_fee_balances SET balance = $1, balance_date = $2 WHERE student_id = $3 AND fee_section_id = $4',
    [balance, today, studentId, feeSectionId]
  );

  return { started: true, balance };
}

function buildFeeStatus(section, settled) {
  if (settled && settled.exempted) {
    return {
      section_id: section.id, section_name: section.name, amount: Number(section.amount), frequency: section.frequency,
      started: settled.started, exempted: true, balance: 0, status: 'exempt', owed: 0,
    };
  }
  if (!settled || !settled.started) {
    return {
      section_id: section.id, section_name: section.name, amount: Number(section.amount), frequency: section.frequency,
      started: false, exempted: false, balance: 0, status: 'not_started', owed: 0,
    };
  }
  const balance = settled.balance;
  const isPaid = section.frequency === 'daily' ? balance >= 0 : balance >= Number(section.amount);
  const owed = isPaid
    ? 0
    : section.frequency === 'daily'
      ? Math.round(Math.abs(balance) * 100) / 100
      : Math.round((Number(section.amount) - balance) * 100) / 100;
  return {
    section_id: section.id, section_name: section.name, amount: Number(section.amount), frequency: section.frequency,
    started: true, exempted: false, balance, status: isPaid ? 'paid' : 'unpaid', owed,
  };
}

// Same scoring formula as the Assessment controller (current model):
// Class Score = SBA + Group Research + Practical Tasks + Projects (each /25, sums to /100), halved to /50.
// Exam entered /100, halved to /50. Total = Class Score + Exam, out of 100.
function computeTotals(row) {
  const sba = row.sba_score !== null ? Number(row.sba_score) : 0;
  const research = row.group_research !== null ? Number(row.group_research) : 0;
  const practical = row.practical_tasks !== null ? Number(row.practical_tasks) : 0;
  const projects = row.projects !== null ? Number(row.projects) : 0;
  const exam = row.exam_score !== null ? Number(row.exam_score) : null;

  const hasAnyClassEntry =
    row.sba_score !== null || row.group_research !== null || row.practical_tasks !== null || row.projects !== null;

  const classRaw = sba + research + practical + projects; // out of 100
  const classScore = hasAnyClassEntry ? classRaw / 2 : null; // out of 50
  const examConverted = exam !== null ? exam / 2 : null; // out of 50

  const hasAnyEntry = hasAnyClassEntry || exam !== null;
  const total = hasAnyEntry ? (classScore || 0) + (examConverted || 0) : null;

  return {
    class_score: classScore !== null ? Math.round(classScore * 100) / 100 : null,
    exam_converted: examConverted !== null ? Math.round(examConverted * 100) / 100 : null,
    total: total !== null ? Math.round(total * 100) / 100 : null,
  };
}

// Competition-style ranking (ties share a position, next position skips accordingly)
function rankByTotal(entries) {
  const ranked = entries.filter((e) => e.total !== null).sort((a, b) => b.total - a.total);
  let position = 0, prevTotal = null, skip = 0;
  const posMap = {};
  ranked.forEach((e) => {
    if (e.total !== prevTotal) { position += 1 + skip; skip = 0; } else { skip++; }
    posMap[e.student_id] = position;
    prevTotal = e.total;
  });
  return posMap;
}

// GET /api/director/overview
async function getOverview(req, res) {
  try {
    const today = todayStr();

    const totalsResult = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'active') AS total,
              COUNT(*) FILTER (WHERE status = 'active' AND gender = 'M') AS male,
              COUNT(*) FILTER (WHERE status = 'active' AND gender = 'F') AS female
       FROM students`
    );

    const byClassResult = await pool.query(
      `SELECT c.class_name,
              COUNT(s.id) FILTER (WHERE s.status = 'active') AS total_students,
              COUNT(s.id) FILTER (WHERE s.status = 'active' AND s.gender = 'M') AS male_count,
              COUNT(s.id) FILTER (WHERE s.status = 'active' AND s.gender = 'F') AS female_count
       FROM classes c LEFT JOIN students s ON s.class_id = c.id
       GROUP BY c.class_name ORDER BY c.class_name`
    );

    const attendanceResult = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE ar.present = true) AS total_present,
         COUNT(*) FILTER (WHERE ar.present = false) AS total_absent
       FROM attendance_records ar
       JOIN attendance_days ad ON ad.id = ar.day_id
       WHERE ad.attendance_date = $1 AND ad.is_holiday = false`,
      [today]
    );

    const feesResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM fee_payments WHERE paid_date = $1`,
      [today]
    );

    const currentMonth = today.slice(0, 7) + '-01';
    const salaryResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM staff_salaries WHERE month = $1`,
      [currentMonth]
    );

    res.json({
      date: today,
      students: totalsResult.rows[0],
      by_class: byClassResult.rows,
      attendance_today: attendanceResult.rows[0],
      fees_collected_today: Number(feesResult.rows[0].total),
      salary_payout_this_month: Number(salaryResult.rows[0].total),
    });
  } catch (err) {
    console.error('getOverview error:', err);
    res.status(500).json({ error: 'Failed to load overview.' });
  }
}

// GET /api/director/classes
async function listClasses(req, res) {
  try {
    const result = await pool.query(
      `SELECT c.id, c.class_name,
              COUNT(s.id) FILTER (WHERE s.status = 'active') AS total_students,
              COUNT(s.id) FILTER (WHERE s.status = 'active' AND s.gender = 'M') AS male_count,
              COUNT(s.id) FILTER (WHERE s.status = 'active' AND s.gender = 'F') AS female_count
       FROM classes c LEFT JOIN students s ON s.class_id = c.id
       GROUP BY c.id, c.class_name ORDER BY c.class_name`
    );
    res.json({ classes: result.rows });
  } catch (err) {
    console.error('listClasses error:', err);
    res.status(500).json({ error: 'Failed to load classes.' });
  }
}

// GET /api/director/teacher-assignments — all classes and all teacher accounts, with current ownership
async function listTeacherAssignments(req, res) {
  try {
    const [classesResult, teachersResult] = await Promise.all([
      pool.query(
        `SELECT c.id, c.class_name, c.teacher_id,
                u.name AS teacher_name,
                u.email AS teacher_email
         FROM classes c
         LEFT JOIN users u ON u.id = c.teacher_id
         ORDER BY c.class_name`
      ),
      pool.query(
        `SELECT id, name, email FROM users WHERE role = 'teacher' ORDER BY name`
      )
    ]);

    res.json({
      classes: classesResult.rows,
      teachers: teachersResult.rows,
    });
  } catch (err) {
    console.error('listTeacherAssignments error:', err);
    res.status(500).json({ error: 'Failed to load teacher assignments.' });
  }
}

// PUT /api/director/classes/:classId/teacher
async function updateClassTeacher(req, res) {
  const { classId } = req.params;
  const { teacher_id } = req.body;

  if (teacher_id !== null && teacher_id !== undefined && teacher_id !== '') {
    const teacherResult = await pool.query(
      'SELECT id, name FROM users WHERE id = $1 AND role = $2',
      [teacher_id, 'teacher']
    );
    if (teacherResult.rows.length === 0) {
      return res.status(404).json({ error: 'Teacher account not found.' });
    }

    const existingClass = await pool.query(
      'SELECT id FROM classes WHERE teacher_id = $1 AND id <> $2 LIMIT 1',
      [teacher_id, classId]
    );
    if (existingClass.rows.length > 0) {
      return res.status(409).json({ error: 'This teacher is already assigned to another class.' });
    }
  }

  try {
    const result = await pool.query(
      `UPDATE classes
       SET teacher_id = $1
       WHERE id = $2
       RETURNING id, class_name, teacher_id`,
      [teacher_id || null, classId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found.' });
    }

    const updatedClass = result.rows[0];
    const teacherName = updatedClass.teacher_id
      ? (await pool.query('SELECT name FROM users WHERE id = $1', [updatedClass.teacher_id])).rows[0]?.name || null
      : null;

    res.json({
      class: {
        id: updatedClass.id,
        class_name: updatedClass.class_name,
        teacher_id: updatedClass.teacher_id,
        teacher_name: teacherName,
      },
      message: updatedClass.teacher_id ? 'Teacher assigned.' : 'Teacher unassigned.',
    });
  } catch (err) {
    console.error('updateClassTeacher error:', err);
    res.status(500).json({ error: 'Failed to update teacher assignment.' });
  }
}

// GET /api/director/classes/:classId — students with today's attendance + fee summary
async function getClassDetail(req, res) {
  const { classId } = req.params;
  try {
    const classResult = await pool.query('SELECT id, class_name FROM classes WHERE id = $1', [classId]);
    if (classResult.rows.length === 0) return res.status(404).json({ error: 'Class not found.' });

    const studentsResult = await pool.query(
      `SELECT id, first_name, last_name, gender FROM students
       WHERE class_id = $1 AND status = 'active' ORDER BY last_name, first_name`,
      [classId]
    );

    const today = todayStr();
    const dayResult = await pool.query(
      'SELECT id, is_holiday FROM attendance_days WHERE class_id = $1 AND attendance_date = $2',
      [classId, today]
    );

    let attendanceMap = {};
    if (dayResult.rows.length && !dayResult.rows[0].is_holiday) {
      const recordsResult = await pool.query(
        'SELECT student_id, present FROM attendance_records WHERE day_id = $1',
        [dayResult.rows[0].id]
      );
      recordsResult.rows.forEach((r) => { attendanceMap[r.student_id] = r.present; });
    }

    const students = studentsResult.rows.map((s) => ({
      ...s,
      attendance_today: dayResult.rows.length
        ? (dayResult.rows[0].is_holiday ? 'holiday' : (attendanceMap[s.id] !== undefined ? (attendanceMap[s.id] ? 'present' : 'absent') : 'not_submitted'))
        : 'not_submitted',
    }));

    res.json({ class: classResult.rows[0], date: today, students });
  } catch (err) {
    console.error('getClassDetail error:', err);
    res.status(500).json({ error: 'Failed to load class detail.' });
  }
}

// GET /api/director/students/search?q=...
async function searchStudents(req, res) {
  const { q } = req.query;
  if (!q || !q.trim()) return res.status(400).json({ error: 'A search term (q) is required.' });

  try {
    const result = await pool.query(
      `SELECT s.id, s.first_name, s.last_name, s.gender, s.admission_number, c.class_name
       FROM students s JOIN classes c ON c.id = s.class_id
       WHERE s.status = 'active'
         AND (s.first_name ILIKE $1 OR s.last_name ILIKE $1 OR s.admission_number ILIKE $1)
       ORDER BY s.last_name, s.first_name LIMIT 50`,
      [`%${q.trim()}%`]
    );
    res.json({ results: result.rows });
  } catch (err) {
    console.error('searchStudents error:', err);
    res.status(500).json({ error: 'Search failed.' });
  }
}

// GET /api/director/students/:id — full master profile: admission + attendance + assessment + fees
async function getStudentMasterProfile(req, res) {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    const studentResult = await client.query(
      `SELECT s.*, c.class_name FROM students s JOIN classes c ON c.id = s.class_id WHERE s.id = $1`,
      [id]
    );
    if (studentResult.rows.length === 0) return res.status(404).json({ error: 'Student not found.' });
    const student = studentResult.rows[0];
    const classId = student.class_id;

    const pickupResult = await client.query(
      `SELECT name, contact, relationship, car_registration_no FROM authorized_pickup_persons WHERE student_id = $1`,
      [id]
    );

    // Attendance summary
    const attendanceStatsResult = await client.query(
      `SELECT
         COUNT(*) FILTER (WHERE ar.present = true) AS total_present,
         COUNT(*) FILTER (WHERE ar.present = false) AS total_absent
       FROM attendance_records ar JOIN attendance_days ad ON ad.id = ar.day_id
       WHERE ar.student_id = $1 AND ad.is_holiday = false`,
      [id]
    );
    const totalPresent = Number(attendanceStatsResult.rows[0].total_present);
    const totalAbsent = Number(attendanceStatsResult.rows[0].total_absent);
    const totalDays = totalPresent + totalAbsent;
    const attendanceRate = totalDays > 0 ? Math.round((totalPresent / totalDays) * 1000) / 10 : null;

    // Assessment: per-subject totals + rank within class, plus overall rank within class
    const subjectsResult = await client.query('SELECT id, name FROM subjects WHERE class_id = $1 ORDER BY name', [classId]);
    const perSubject = [];
    const overallTotals = {}; // student_id -> { total, count }

    for (const subject of subjectsResult.rows) {
      const rowsResult = await client.query(
        `SELECT s.id AS student_id, a.sba_score, a.group_research, a.practical_tasks, a.projects, a.exam_score
         FROM students s LEFT JOIN assessment_scores a ON a.student_id = s.id AND a.subject_id = $1
         WHERE s.class_id = $2 AND s.status = 'active'`,
        [subject.id, classId]
      );
      const withTotals = rowsResult.rows.map((r) => ({ student_id: r.student_id, ...computeTotals(r) }));
      const posMap = rankByTotal(withTotals);
      const mine = withTotals.find((r) => r.student_id === id);

      withTotals.forEach((r) => {
        if (r.total !== null) {
          if (!overallTotals[r.student_id]) overallTotals[r.student_id] = { total: 0, count: 0 };
          overallTotals[r.student_id].total += r.total;
          overallTotals[r.student_id].count += 1;
        }
      });

      perSubject.push({
        subject_id: subject.id,
        subject_name: subject.name,
        class_score: mine ? mine.class_score : null,
        exam_converted: mine ? mine.exam_converted : null,
        total: mine ? mine.total : null,
        position: posMap[id] || null,
      });
    }

    const overallEntries = Object.entries(overallTotals).map(([studentId, v]) => ({
      student_id: studentId, total: Math.round(v.total * 100) / 100,
    }));
    const overallPosMap = rankByTotal(overallEntries);
    const myOverall = overallTotals[id];

    // Fees
    const sectionsResult = await client.query('SELECT id, name, amount, frequency FROM fee_sections ORDER BY name');
    await client.query('BEGIN');
    const fees = [];
    for (const section of sectionsResult.rows) {
      const settled = await settleBalanceReadOnly(client, id, section.id, section.amount, section.frequency);
      fees.push(buildFeeStatus(section, settled));
    }
    await client.query('COMMIT');

    const paymentHistoryResult = await client.query(
      `SELECT fp.amount, fp.paid_date, fs.name AS section_name
       FROM fee_payments fp JOIN fee_sections fs ON fs.id = fp.fee_section_id
       WHERE fp.student_id = $1 ORDER BY fp.paid_date DESC, fp.created_at DESC LIMIT 50`,
      [id]
    );

    res.json({
      student,
      pickup_persons: pickupResult.rows,
      attendance: {
        total_present: totalPresent,
        total_absent: totalAbsent,
        total_days_recorded: totalDays,
        attendance_rate_percent: attendanceRate,
      },
      assessment: {
        subjects: perSubject,
        overall: {
          total: myOverall ? Math.round(myOverall.total * 100) / 100 : null,
          position: overallPosMap[id] || null,
        },
      },
      fees: {
        sections: fees,
        payment_history: paymentHistoryResult.rows,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('getStudentMasterProfile error:', err);
    res.status(500).json({ error: 'Failed to load student profile.' });
  } finally {
    client.release();
  }
}

// GET /api/director/records?range=day|week|month&date=YYYY-MM-DD — school-wide fee totals, by class
async function getRecords(req, res) {
  const { range = 'day', date } = req.query;
  const refDate = date || todayStr();
  const dates = getRangeDates(range, refDate);
  if (!dates) return res.status(400).json({ error: "range must be 'day', 'week', or 'month'." });

  try {
    const totalResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM fee_payments WHERE paid_date BETWEEN $1 AND $2`,
      [dates.start, dates.end]
    );
    const byClassResult = await pool.query(
      `SELECT c.class_name, COALESCE(SUM(fp.amount), 0) AS total
       FROM classes c
       LEFT JOIN students s ON s.class_id = c.id
       LEFT JOIN fee_payments fp ON fp.student_id = s.id AND fp.paid_date BETWEEN $1 AND $2
       GROUP BY c.class_name ORDER BY c.class_name`,
      [dates.start, dates.end]
    );
    const grossResult = await pool.query('SELECT COALESCE(SUM(amount), 0) AS total FROM fee_payments');

    res.json({
      range, start: dates.start, end: dates.end,
      total: Number(totalResult.rows[0].total),
      by_class: byClassResult.rows.map((r) => ({ class_name: r.class_name, total: Number(r.total) })),
      gross_total_all_time: Number(grossResult.rows[0].total),
    });
  } catch (err) {
    console.error('getRecords error:', err);
    res.status(500).json({ error: 'Failed to load records.' });
  }
}

// GET /api/director/notifications/absences — same feed the Secretary sees
async function getAbsenceNotifications(req, res) {
  try {
    const result = await pool.query(
      `SELECT n.id, n.attendance_date, n.is_read, n.called, n.created_at,
              s.first_name, s.last_name, s.guardian_name, s.guardian_phone,
              c.class_name
       FROM absence_notifications n
       JOIN students s ON s.id = n.student_id
       JOIN classes c ON c.id = n.class_id
       ORDER BY n.created_at DESC LIMIT 100`
    );
    res.json({ notifications: result.rows });
  } catch (err) {
    console.error('getAbsenceNotifications error:', err);
    res.status(500).json({ error: 'Failed to load absence notifications.' });
  }
}

// GET /api/director/notifications/admissions
async function getAdmissionNotifications(req, res) {
  try {
    const result = await pool.query(
      `SELECT n.id, n.is_read, n.created_at,
              s.first_name, s.last_name, s.gender, s.admission_number,
              c.class_name
       FROM admission_notifications n
       JOIN students s ON s.id = n.student_id
       JOIN classes c ON c.id = n.class_id
       ORDER BY n.created_at DESC LIMIT 100`
    );
    res.json({ notifications: result.rows });
  } catch (err) {
    console.error('getAdmissionNotifications error:', err);
    res.status(500).json({ error: 'Failed to load admission notifications.' });
  }
}

// GET /api/director/staff — every staff account (excluding other directors) with block status
async function listStaffAccounts(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, is_blocked, created_at
       FROM users WHERE role != 'director' ORDER BY role, name`
    );
    res.json({ staff: result.rows });
  } catch (err) {
    console.error('listStaffAccounts error:', err);
    res.status(500).json({ error: 'Failed to load staff accounts.' });
  }
}

// POST /api/director/staff/:id/block
async function blockStaff(req, res) {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE users SET is_blocked = true WHERE id = $1 AND role != 'director' RETURNING id, name, role`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Staff account not found.' });
    }
    res.json({ message: 'Account blocked.', user: result.rows[0] });
  } catch (err) {
    console.error('blockStaff error:', err);
    res.status(500).json({ error: 'Failed to block account.' });
  }
}

// POST /api/director/staff/:id/unblock
async function unblockStaff(req, res) {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE users SET is_blocked = false WHERE id = $1 AND role != 'director' RETURNING id, name, role`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Staff account not found.' });
    }
    res.json({ message: 'Account unblocked.', user: result.rows[0] });
  } catch (err) {
    console.error('unblockStaff error:', err);
    res.status(500).json({ error: 'Failed to unblock account.' });
  }
}

// GET /api/director/statistics — this period vs last period, for revenue, admissions, and attendance
async function getStatistics(req, res) {
  try {
    const today = todayStr();
    const thisWeek = getRangeDates('week', today);
    const lastWeekDate = new Date(thisWeek.start + 'T00:00:00Z');
    lastWeekDate.setUTCDate(lastWeekDate.getUTCDate() - 7);
    const lastWeek = getRangeDates('week', lastWeekDate.toISOString().slice(0, 10));

    const thisMonth = getRangeDates('month', today);
    const lastMonthDate = new Date(thisMonth.start + 'T00:00:00Z');
    lastMonthDate.setUTCDate(0); // last day of previous month
    const lastMonth = getRangeDates('month', lastMonthDate.toISOString().slice(0, 10));

    async function revenueTotal(range) {
      const r = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM fee_payments WHERE paid_date BETWEEN $1 AND $2`,
        [range.start, range.end]
      );
      return Number(r.rows[0].total);
    }

    async function admissionsCount(range) {
      const r = await pool.query(
        `SELECT COUNT(*) AS count FROM students WHERE date_of_admission BETWEEN $1 AND $2`,
        [range.start, range.end]
      );
      return Number(r.rows[0].count);
    }

    async function attendanceRate(range) {
      const r = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE ar.present = true) AS present,
           COUNT(*) AS total
         FROM attendance_records ar
         JOIN attendance_days ad ON ad.id = ar.day_id
         WHERE ad.attendance_date BETWEEN $1 AND $2 AND ad.is_holiday = false`,
        [range.start, range.end]
      );
      const present = Number(r.rows[0].present);
      const total = Number(r.rows[0].total);
      return total > 0 ? Math.round((present / total) * 1000) / 10 : null;
    }

    function trend(current, previous) {
      if (previous === 0) return current > 0 ? 'up' : 'flat';
      const change = ((current - previous) / previous) * 100;
      return { direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat', percent_change: Math.round(change * 10) / 10 };
    }

    const [revThisWeek, revLastWeek, revThisMonth, revLastMonth] = await Promise.all([
      revenueTotal(thisWeek), revenueTotal(lastWeek), revenueTotal(thisMonth), revenueTotal(lastMonth),
    ]);
    const [admThisMonth, admLastMonth] = await Promise.all([
      admissionsCount(thisMonth), admissionsCount(lastMonth),
    ]);
    const [attThisWeek, attLastWeek] = await Promise.all([
      attendanceRate(thisWeek), attendanceRate(lastWeek),
    ]);

    const totalStudentsResult = await pool.query(`SELECT COUNT(*) AS count FROM students WHERE status = 'active'`);

    res.json({
      revenue: {
        this_week: revThisWeek, last_week: revLastWeek, week_trend: trend(revThisWeek, revLastWeek),
        this_month: revThisMonth, last_month: revLastMonth, month_trend: trend(revThisMonth, revLastMonth),
      },
      admissions: {
        this_month: admThisMonth, last_month: admLastMonth, trend: trend(admThisMonth, admLastMonth),
        total_active_students: Number(totalStudentsResult.rows[0].count),
      },
      attendance: {
        this_week_rate_percent: attThisWeek, last_week_rate_percent: attLastWeek,
        trend: (attThisWeek !== null && attLastWeek !== null) ? trend(attThisWeek, attLastWeek) : null,
      },
    });
  } catch (err) {
    console.error('getStatistics error:', err);
    res.status(500).json({ error: 'Failed to load statistics.' });
  }
}

// GET /api/director/statistics/timeseries — day-by-day data for revenue, attendance rate, and admissions,
// from the earliest recorded activity through today. Grows automatically as new days pass.
async function getStatisticsTimeseries(req, res) {
  try {
    const earliestResult = await pool.query(
      `SELECT LEAST(
         COALESCE((SELECT MIN(paid_date) FROM fee_payments), CURRENT_DATE),
         COALESCE((SELECT MIN(attendance_date) FROM attendance_days), CURRENT_DATE),
         COALESCE((SELECT MIN(date_of_admission) FROM students WHERE date_of_admission IS NOT NULL), CURRENT_DATE)
       ) AS start_date`
    );
    const startDate = earliestResult.rows[0].start_date.toISOString().slice(0, 10);

    const revenueResult = await pool.query(
      `WITH date_range AS (
         SELECT generate_series($1::date, CURRENT_DATE, '1 day'::interval)::date AS day
       )
       SELECT dr.day, COALESCE(SUM(fp.amount), 0) AS revenue
       FROM date_range dr
       LEFT JOIN fee_payments fp ON fp.paid_date = dr.day
       GROUP BY dr.day ORDER BY dr.day`,
      [startDate]
    );

    const attendanceResult = await pool.query(
      `WITH date_range AS (
         SELECT generate_series($1::date, CURRENT_DATE, '1 day'::interval)::date AS day
       )
       SELECT dr.day,
              COUNT(ar.id) FILTER (WHERE ar.present = true) AS present,
              COUNT(ar.id) AS total
       FROM date_range dr
       LEFT JOIN attendance_days ad ON ad.attendance_date = dr.day AND ad.is_holiday = false
       LEFT JOIN attendance_records ar ON ar.day_id = ad.id
       GROUP BY dr.day ORDER BY dr.day`,
      [startDate]
    );

    const admissionsResult = await pool.query(
      `WITH date_range AS (
         SELECT generate_series($1::date, CURRENT_DATE, '1 day'::interval)::date AS day
       )
       SELECT dr.day, COUNT(s.id) AS new_admissions
       FROM date_range dr
       LEFT JOIN students s ON s.date_of_admission = dr.day
       GROUP BY dr.day ORDER BY dr.day`,
      [startDate]
    );

    const baselineResult = await pool.query(
      `SELECT COUNT(*) AS count FROM students
       WHERE status = 'active' AND (date_of_admission IS NULL OR date_of_admission < $1)`,
      [startDate]
    );
    let cumulative = Number(baselineResult.rows[0].count);

    const revenue_by_day = revenueResult.rows.map((r) => ({
      date: r.day.toISOString().slice(0, 10),
      revenue: Number(r.revenue),
    }));

    const attendance_by_day = attendanceResult.rows.map((r) => {
      const present = Number(r.present);
      const total = Number(r.total);
      return {
        date: r.day.toISOString().slice(0, 10),
        rate_percent: total > 0 ? Math.round((present / total) * 1000) / 10 : null,
        total_present: present,
        total_absent: total - present,
      };
    });

    const admissions_by_day = admissionsResult.rows.map((r) => {
      const newAdmissions = Number(r.new_admissions);
      cumulative += newAdmissions;
      return {
        date: r.day.toISOString().slice(0, 10),
        new_admissions: newAdmissions,
        cumulative_total: cumulative,
      };
    });

        const allScoresResult = await pool.query(
      `SELECT sba_score, group_research, practical_tasks, projects, exam_score, updated_at::date AS entered_date
       FROM assessment_scores
       ORDER BY entered_date`
    );

    const performance_by_day = [];
    let scoreSum = 0;
    let scoreCount = 0;
    let scoreIndex = 0;
    const allDays = revenue_by_day.map((r) => r.date);

    for (const dateStr of allDays) {
      while (
        scoreIndex < allScoresResult.rows.length &&
        allScoresResult.rows[scoreIndex].entered_date.toISOString().slice(0, 10) <= dateStr
      ) {
        const row = allScoresResult.rows[scoreIndex];
        const totals = computeTotals(row);
        if (totals.total !== null) {
          scoreSum += totals.total;
          scoreCount += 1;
        }
        scoreIndex += 1;
      }
      performance_by_day.push({
        date: dateStr,
        avg_score: scoreCount > 0 ? Math.round((scoreSum / scoreCount) * 10) / 10 : null,
        entries_counted: scoreCount,
      });
    }

    res.json({
      start_date: startDate,
      end_date: todayStr(),
      revenue_by_day,
      attendance_by_day,
      admissions_by_day,
      performance_by_day,
    });
  } catch (err) {
    console.error('getStatisticsTimeseries error:', err);
    res.status(500).json({ error: 'Failed to load statistics timeseries.' });
  }
}

module.exports = {
  getOverview,
  listClasses,
  listTeacherAssignments,
  updateClassTeacher,
  getClassDetail,
  searchStudents,
  getStatisticsTimeseries,
  getStudentMasterProfile,
  getRecords,
  getAbsenceNotifications,
  getAdmissionNotifications,
  listStaffAccounts,
  blockStaff,
  unblockStaff,
  getStatistics,
};