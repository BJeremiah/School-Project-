const pool = require('../config/db');
const { getIO } = require('../config/socket');

async function submitReport(req, res) {
  const client = await pool.connect();

  try {
    const teacherId = req.user.userId;
    const {
      present_count,
      absent_count,
      tuition_arrears = 0,
      canteen_fees = 0,
      bus_fares = 0,
    } = req.body;

    if (present_count === undefined || absent_count === undefined) {
      return res.status(400).json({ error: 'present_count and absent_count are required.' });
    }
    if (present_count < 0 || absent_count < 0) {
      return res.status(400).json({ error: 'Counts cannot be negative.' });
    }
    const financeFields = { tuition_arrears, canteen_fees, bus_fares };
    for (const [key, value] of Object.entries(financeFields)) {
      if (typeof value !== 'number' || value < 0) {
        return res.status(400).json({ error: `${key} must be a non-negative number.` });
      }
    }

    const classResult = await client.query(
      'SELECT id FROM classes WHERE teacher_id = $1 LIMIT 1',
      [teacherId]
    );
    if (classResult.rows.length === 0) {
      return res.status(404).json({ error: 'No class is assigned to this teacher.' });
    }
    const classId = classResult.rows[0].id;

    const total = Number(tuition_arrears) + Number(canteen_fees) + Number(bus_fares);

    await client.query('BEGIN');

    let logResult;
    try {
      logResult = await client.query(
        `INSERT INTO daily_logs (class_id, date, present_count, absent_count)
         VALUES ($1, CURRENT_DATE, $2, $3)
         RETURNING id, date, present_count, absent_count, submitted_at`,
        [classId, present_count, absent_count]
      );
    } catch (err) {
      if (err.code === '23505') {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: 'A report has already been submitted for this class today.',
        });
      }
      throw err;
    }

    const log = logResult.rows[0];

    const financeResult = await client.query(
      `INSERT INTO daily_finances (log_id, tuition_arrears, canteen_fees, bus_fares, total_calculated)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, tuition_arrears, canteen_fees, bus_fares, total_calculated, submitted_at`,
      [log.id, tuition_arrears, canteen_fees, bus_fares, total]
    );

    await client.query('COMMIT');

    const finance = financeResult.rows[0];

    try {
      const io = getIO();
      io.emit('new_submission', {
        log_id: log.id,
        class_id: classId,
        date: log.date,
        present_count: log.present_count,
        absent_count: log.absent_count,
        total_calculated: finance.total_calculated,
        submitted_at: log.submitted_at,
      });
    } catch (socketErr) {
      console.warn('Socket emit skipped:', socketErr.message);
    }

    return res.status(201).json({
      message: 'Report submitted successfully.',
      log,
      finance,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Submit report error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
}

// Director-only: deletes today's log (and its finance row, via cascade)
// for a given class, so the teacher gets another chance to submit.
async function resetTodayReport(req, res) {
  try {
    const { classId } = req.params;

    const result = await pool.query(
      `DELETE FROM daily_logs
       WHERE class_id = $1 AND date = CURRENT_DATE
       RETURNING id`,
      [classId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No submission found for this class today.' });
    }

    return res.status(200).json({
      message: 'Today\'s report was reset. The teacher can submit again.',
      deleted_log_id: result.rows[0].id,
    });
  } catch (err) {
    console.error('Reset report error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = { submitReport, resetTodayReport };
