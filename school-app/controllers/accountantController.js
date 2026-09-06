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

function formatFriendlyDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const weekdays = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const weekday = weekdays[d.getUTCDay()];
  const month = months[d.getUTCMonth()];
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();
  return `${weekday}, ${month} ${day}, ${year}`;
}

async function settleBalance(client, studentId, feeSectionId, amount, frequency) {
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
      if (chargeDays > 0) {
        balance = balance - Number(amount) * chargeDays;
      }
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
      section_id: section.id,
      section_name: section.name,
      amount: Number(section.amount),
      frequency: section.frequency,
      started: settled.started,
      exempted: true,
      balance: 0,
      status: 'exempt',
      owed: 0,
    };
  }

  if (!settled || !settled.started) {
    return {
      section_id: section.id,
      section_name: section.name,
      amount: Number(section.amount),
      frequency: section.frequency,
      started: false,
      exempted: false,
      balance: 0,
      status: 'not_started',
      owed: 0,
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
    section_id: section.id,
    section_name: section.name,
    amount: Number(section.amount),
    frequency: section.frequency,
    started: true,
    exempted: false,
    balance,
    status: isPaid ? 'paid' : 'unpaid',
    owed,
  };
}

async function getToday(req, res) {
  const today = todayStr();
  res.json({ date: today, formatted: formatFriendlyDate(today) });
}

async function listSections(req, res) {
  try {
    const result = await pool.query('SELECT id, name, amount, frequency FROM fee_sections ORDER BY name');
    res.json({ sections: result.rows });
  } catch (err) {
    console.error('listSections error:', err);
    res.status(500).json({ error: 'Failed to load fee sections.' });
  }
}

async function addSection(req, res) {
  const { name, amount, frequency } = req.body;

  if (!name || !name.trim() || amount === undefined || amount === null || !frequency) {
    return res.status(400).json({ error: 'name, amount, and frequency are required.' });
  }
  if (frequency !== 'once' && frequency !== 'daily') {
    return res.status(400).json({ error: "frequency must be 'once' or 'daily'." });
  }
  if (Number(amount) < 0) {
    return res.status(400).json({ error: 'amount cannot be negative.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const sectionResult = await client.query(
      `INSERT INTO fee_sections (name, amount, frequency) VALUES ($1, $2, $3)
       RETURNING id, name, amount, frequency`,
      [name.trim(), amount, frequency]
    );
    const section = sectionResult.rows[0];

    const studentsResult = await client.query(`SELECT id FROM students WHERE status = 'active'`);
    for (const s of studentsResult.rows) {
      await client.query(
        `INSERT INTO student_fee_balances (student_id, fee_section_id, balance, balance_date, started)
         VALUES ($1, $2, 0, CURRENT_DATE, false)
         ON CONFLICT (student_id, fee_section_id) DO NOTHING`,
        [s.id, section.id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ section });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A fee section with that name already exists.' });
    }
    console.error('addSection error:', err);
    res.status(500).json({ error: 'Failed to add fee section.' });
  } finally {
    client.release();
  }
}

async function updateSection(req, res) {
  const { id } = req.params;
  const { amount, frequency } = req.body;

  const client = await pool.connect();
  try {
    const currentResult = await client.query('SELECT id, name, amount, frequency FROM fee_sections WHERE id = $1', [id]);
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Fee section not found.' });
    }
    const current = currentResult.rows[0];

    await client.query('BEGIN');

    const balancesResult = await client.query(
      'SELECT student_id FROM student_fee_balances WHERE fee_section_id = $1',
      [id]
    );
    for (const row of balancesResult.rows) {
      await settleBalance(client, row.student_id, id, current.amount, current.frequency);
    }

    const newAmount = amount !== undefined && amount !== null ? amount : current.amount;
    const newFrequency = frequency || current.frequency;

    if (newFrequency !== 'once' && newFrequency !== 'daily') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "frequency must be 'once' or 'daily'." });
    }
    if (Number(newAmount) < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'amount cannot be negative.' });
    }

    const updateResult = await client.query(
      `UPDATE fee_sections SET amount = $1, frequency = $2, updated_at = now()
       WHERE id = $3 RETURNING id, name, amount, frequency`,
      [newAmount, newFrequency, id]
    );

    await client.query('COMMIT');
    res.json({ section: updateResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('updateSection error:', err);
    res.status(500).json({ error: 'Failed to update fee section.' });
  } finally {
    client.release();
  }
}

async function startFeeTracking(req, res) {
  const { studentId, sectionId } = req.params;
  const client = await pool.connect();
  try {
    const sectionResult = await client.query('SELECT amount, frequency FROM fee_sections WHERE id = $1', [sectionId]);
    if (sectionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Fee section not found.' });
    }
    const { amount, frequency } = sectionResult.rows[0];

    const balResult = await client.query(
      'SELECT started FROM student_fee_balances WHERE student_id = $1 AND fee_section_id = $2',
      [studentId, sectionId]
    );
    if (balResult.rows.length === 0) {
      return res.status(404).json({ error: 'Fee balance record not found for this student. They may not be enrolled in this section.' });
    }
    if (balResult.rows[0].started) {
      return res.status(409).json({ error: 'This fee has already been started for this student.' });
    }

    const today = todayStr();

    const absentResult = await client.query(
      'SELECT 1 FROM fee_absences WHERE student_id = $1 AND absence_date = $2',
      [studentId, today]
    );
    const isAbsentToday = absentResult.rows.length > 0;

    const initialBalance = (frequency === 'daily' && isWeekday(today) && !isAbsentToday) ? -Number(amount) : 0;

    await client.query(
      `UPDATE student_fee_balances SET started = true, started_date = $1, balance = $2, balance_date = $1
       WHERE student_id = $3 AND fee_section_id = $4`,
      [today, initialBalance, studentId, sectionId]
    );

    res.status(200).json({ message: 'Fee tracking started.', balance: initialBalance });
  } catch (err) {
    console.error('startFeeTracking error:', err);
    res.status(500).json({ error: 'Failed to start fee tracking.' });
  } finally {
    client.release();
  }
}

async function markAbsent(req, res) {
  const { studentId } = req.params;
  const { date } = req.body;
  const absenceDate = date || todayStr();

  try {
    const studentCheck = await pool.query(`SELECT id FROM students WHERE id = $1 AND status = 'active'`, [studentId]);
    if (studentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    await pool.query(
      `INSERT INTO fee_absences (student_id, absence_date) VALUES ($1, $2)
       ON CONFLICT (student_id, absence_date) DO NOTHING`,
      [studentId, absenceDate]
    );

    res.status(201).json({ message: 'Marked absent for fee purposes.', date: absenceDate });
  } catch (err) {
    console.error('markAbsent error:', err);
    res.status(500).json({ error: 'Failed to mark absent.' });
  }
}

async function unmarkAbsent(req, res) {
  const { studentId } = req.params;
  const { date } = req.query;
  const absenceDate = date || todayStr();

  try {
    await pool.query('DELETE FROM fee_absences WHERE student_id = $1 AND absence_date = $2', [studentId, absenceDate]);
    res.json({ message: 'Absence mark removed.', date: absenceDate });
  } catch (err) {
    console.error('unmarkAbsent error:', err);
    res.status(500).json({ error: 'Failed to remove absence mark.' });
  }
}

async function setExempt(req, res) {
  const { studentId, sectionId } = req.params;
  try {
    const result = await pool.query(
      `UPDATE student_fee_balances SET exempted = true, balance = 0, balance_date = CURRENT_DATE
       WHERE student_id = $1 AND fee_section_id = $2 RETURNING id`,
      [studentId, sectionId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fee balance record not found for this student/section.' });
    }
    res.json({ message: 'Student exempted from this fee.' });
  } catch (err) {
    console.error('setExempt error:', err);
    res.status(500).json({ error: 'Failed to exempt student.' });
  }
}

async function removeExempt(req, res) {
  const { studentId, sectionId } = req.params;
  try {
    const result = await pool.query(
      `UPDATE student_fee_balances SET exempted = false, balance = 0, balance_date = CURRENT_DATE
       WHERE student_id = $1 AND fee_section_id = $2 RETURNING id`,
      [studentId, sectionId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fee balance record not found for this student/section.' });
    }
    res.json({ message: 'Exemption removed.' });
  } catch (err) {
    console.error('removeExempt error:', err);
    res.status(500).json({ error: 'Failed to remove exemption.' });
  }
}

async function listClassesOverview(req, res) {
  try {
    const result = await pool.query(
      `SELECT c.id, c.class_name,
              COUNT(s.id) FILTER (WHERE s.status = 'active') AS total_students
       FROM classes c
       LEFT JOIN students s ON s.class_id = c.id
       GROUP BY c.id, c.class_name
       ORDER BY c.class_name`
    );
    res.json({ classes: result.rows });
  } catch (err) {
    console.error('listClassesOverview error:', err);
    res.status(500).json({ error: 'Failed to load classes.' });
  }
}

async function getClassStudentsStatus(req, res) {
  const { classId } = req.params;
  const client = await pool.connect();
  try {
    const classResult = await client.query('SELECT id, class_name FROM classes WHERE id = $1', [classId]);
    if (classResult.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found.' });
    }

    const studentsResult = await client.query(
      `SELECT id, first_name, last_name FROM students
       WHERE class_id = $1 AND status = 'active' ORDER BY last_name, first_name`,
      [classId]
    );

    const sectionsResult = await client.query('SELECT id, name, amount, frequency FROM fee_sections ORDER BY name');
    const sections = sectionsResult.rows;

    const today = todayStr();
    const studentIds = studentsResult.rows.map((s) => s.id);
    const todaysAbsencesResult = studentIds.length
      ? await client.query(
          `SELECT student_id FROM fee_absences WHERE absence_date = $1 AND student_id = ANY($2::uuid[])`,
          [today, studentIds]
        )
      : { rows: [] };
    const absentTodaySet = new Set(todaysAbsencesResult.rows.map((r) => r.student_id));

    await client.query('BEGIN');

    const students = [];
    for (const student of studentsResult.rows) {
      const feeStatuses = [];
      for (const section of sections) {
        const settled = await settleBalance(client, student.id, section.id, section.amount, section.frequency);
        feeStatuses.push(buildFeeStatus(section, settled));
      }
      students.push({
        student_id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        absent_today: absentTodaySet.has(student.id),
        fees: feeStatuses,
      });
    }

    await client.query('COMMIT');
    res.json({ class: classResult.rows[0], date: today, students });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('getClassStudentsStatus error:', err);
    res.status(500).json({ error: 'Failed to load class fee status.' });
  } finally {
    client.release();
  }
}

async function getStudentFeeProfile(req, res) {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    const studentResult = await client.query(
      `SELECT s.id, s.first_name, s.last_name, c.class_name
       FROM students s JOIN classes c ON c.id = s.class_id WHERE s.id = $1`,
      [id]
    );
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    const sectionsResult = await client.query('SELECT id, name, amount, frequency FROM fee_sections ORDER BY name');

    const today = todayStr();
    const absentTodayResult = await client.query(
      'SELECT 1 FROM fee_absences WHERE student_id = $1 AND absence_date = $2',
      [id, today]
    );

    await client.query('BEGIN');
    const fees = [];
    for (const section of sectionsResult.rows) {
      const settled = await settleBalance(client, id, section.id, section.amount, section.frequency);
      fees.push(buildFeeStatus(section, settled));
    }
    await client.query('COMMIT');

    const historyResult = await client.query(
      `SELECT fp.amount, fp.paid_date, fs.name AS section_name
       FROM fee_payments fp JOIN fee_sections fs ON fs.id = fp.fee_section_id
       WHERE fp.student_id = $1 ORDER BY fp.paid_date DESC, fp.created_at DESC LIMIT 50`,
      [id]
    );

    res.json({
      student: studentResult.rows[0],
      absent_today: absentTodayResult.rows.length > 0,
      fees,
      payment_history: historyResult.rows,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('getStudentFeeProfile error:', err);
    res.status(500).json({ error: 'Failed to load student fee profile.' });
  } finally {
    client.release();
  }
}

async function recordPayment(req, res) {
  const { student_id, fee_section_id, amount, paid_date } = req.body;

  if (!student_id || !fee_section_id || !amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'student_id, fee_section_id, and a positive amount are required.' });
  }

  const client = await pool.connect();
  try {
    const sectionResult = await client.query('SELECT id, amount, frequency FROM fee_sections WHERE id = $1', [fee_section_id]);
    if (sectionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Fee section not found.' });
    }
    const section = sectionResult.rows[0];

    const studentCheck = await client.query(`SELECT id FROM students WHERE id = $1 AND status = 'active'`, [student_id]);
    if (studentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    await client.query('BEGIN');

    const settled = await settleBalance(client, student_id, fee_section_id, section.amount, section.frequency);
    if (settled === null) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'This student is not enrolled in this fee section.' });
    }
    if (!settled.started) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This fee has not been started for this student yet. Click Start first.' });
    }

    const newBalance = settled.balance + Number(amount);
    await client.query(
      'UPDATE student_fee_balances SET balance = $1 WHERE student_id = $2 AND fee_section_id = $3',
      [newBalance, student_id, fee_section_id]
    );

    await client.query(
      `INSERT INTO fee_payments (student_id, fee_section_id, amount, paid_date)
       VALUES ($1, $2, $3, $4)`,
      [student_id, fee_section_id, amount, paid_date || todayStr()]
    );

    await client.query('COMMIT');

    const isPaid = section.frequency === 'daily' ? newBalance >= 0 : newBalance >= Number(section.amount);
    res.status(201).json({
      message: 'Payment recorded.',
      new_balance: newBalance,
      status: isPaid ? 'paid' : 'unpaid',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('recordPayment error:', err);
    res.status(500).json({ error: 'Failed to record payment.' });
  } finally {
    client.release();
  }
}

function getRangeDates(range, dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  if (range === 'day') {
    return { start: dateStr, end: dateStr };
  }
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

async function getClassRecords(req, res) {
  const { classId } = req.params;
  const { range = 'day', date } = req.query;
  const refDate = date || todayStr();
  const dates = getRangeDates(range, refDate);
  if (!dates) return res.status(400).json({ error: "range must be 'day', 'week', or 'month'." });

  try {
    const result = await pool.query(
      `SELECT COALESCE(SUM(fp.amount), 0) AS total
       FROM fee_payments fp JOIN students s ON s.id = fp.student_id
       WHERE s.class_id = $1 AND fp.paid_date BETWEEN $2 AND $3`,
      [classId, dates.start, dates.end]
    );
    res.json({ class_id: classId, range, start: dates.start, end: dates.end, total: Number(result.rows[0].total) });
  } catch (err) {
    console.error('getClassRecords error:', err);
    res.status(500).json({ error: 'Failed to load class records.' });
  }
}

async function getSchoolRecords(req, res) {
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

    res.json({
      range, start: dates.start, end: dates.end,
      total: Number(totalResult.rows[0].total),
      by_class: byClassResult.rows.map((r) => ({ class_name: r.class_name, total: Number(r.total) })),
    });
  } catch (err) {
    console.error('getSchoolRecords error:', err);
    res.status(500).json({ error: 'Failed to load school records.' });
  }
}

async function getGrossTotal(req, res) {
  try {
    const result = await pool.query('SELECT COALESCE(SUM(amount), 0) AS total FROM fee_payments');
    res.json({ gross_total: Number(result.rows[0].total) });
  } catch (err) {
    console.error('getGrossTotal error:', err);
    res.status(500).json({ error: 'Failed to load gross total.' });
  }
}

module.exports = {
  getToday,
  listSections,
  addSection,
  updateSection,
  startFeeTracking,
  markAbsent,
  unmarkAbsent,
  setExempt,
  removeExempt,
  listClassesOverview,
  getClassStudentsStatus,
  getStudentFeeProfile,
  recordPayment,
  getClassRecords,
  getSchoolRecords,
  getGrossTotal,
};