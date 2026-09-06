const pool = require('../config/db');

// Normalize any date string to the 1st of that month, e.g. "2026-07-15" -> "2026-07-01"
function toMonthStart(monthStr) {
  const d = new Date(monthStr + '-01T00:00:00Z');
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

// GET /api/secretary/staff — list all active staff (no salary data, just the roster)
async function listStaff(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, name, position, account_number FROM staff_members
       WHERE status = 'active' ORDER BY name`
    );
    res.json({ staff: result.rows });
  } catch (err) {
    console.error('listStaff error:', err);
    res.status(500).json({ error: 'Failed to load staff.' });
  }
}

// POST /api/secretary/staff — add a new staff member
async function addStaff(req, res) {
  const { name, position, account_number } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Staff name is required.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO staff_members (name, position, account_number)
       VALUES ($1, $2, $3) RETURNING id, name, position, account_number`,
      [name.trim(), position || null, account_number || null]
    );
    res.status(201).json({ staff: result.rows[0] });
  } catch (err) {
    console.error('addStaff error:', err);
    res.status(500).json({ error: 'Failed to add staff member.' });
  }
}

// PUT /api/secretary/staff/:id — edit a staff member's details
async function updateStaff(req, res) {
  const { id } = req.params;
  const { name, position, account_number } = req.body;

  try {
    const result = await pool.query(
      `UPDATE staff_members SET
         name = COALESCE($1, name),
         position = COALESCE($2, position),
         account_number = COALESCE($3, account_number)
       WHERE id = $4 AND status = 'active'
       RETURNING id, name, position, account_number`,
      [name || null, position || null, account_number || null, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Staff member not found.' });
    }
    res.json({ staff: result.rows[0] });
  } catch (err) {
    console.error('updateStaff error:', err);
    res.status(500).json({ error: 'Failed to update staff member.' });
  }
}

// DELETE /api/secretary/staff/:id — soft-delete a staff member
async function removeStaff(req, res) {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE staff_members SET status = 'inactive' WHERE id = $1 RETURNING id`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Staff member not found.' });
    }
    res.json({ message: 'Staff member removed.' });
  } catch (err) {
    console.error('removeStaff error:', err);
    res.status(500).json({ error: 'Failed to remove staff member.' });
  }
}

// GET /api/secretary/staff/inactive — list removed staff
async function listInactiveStaff(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, name, position, account_number FROM staff_members
       WHERE status = 'inactive' ORDER BY name`
    );
    res.json({ staff: result.rows });
  } catch (err) {
    console.error('listInactiveStaff error:', err);
    res.status(500).json({ error: 'Failed to load removed staff.' });
  }
}

// PUT /api/secretary/staff/:id/reactivate — restore a removed staff member
async function reactivateStaff(req, res) {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE staff_members SET status = 'active' WHERE id = $1 AND status = 'inactive' RETURNING id, name, position, account_number`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Removed staff member not found.' });
    }
    res.json({ staff: result.rows[0] });
  } catch (err) {
    console.error('reactivateStaff error:', err);
    res.status(500).json({ error: 'Failed to reactivate staff member.' });
  }
}

// DELETE /api/secretary/staff/:id/permanent — permanently delete a staff member and their salary history
async function permanentlyDeleteStaff(req, res) {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `DELETE FROM staff_members WHERE id = $1 AND status = 'inactive' RETURNING id`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Removed staff member not found. Only removed staff can be permanently deleted.' });
    }
    res.json({ message: 'Staff member permanently deleted.' });
  } catch (err) {
    console.error('permanentlyDeleteStaff error:', err);
    res.status(500).json({ error: 'Failed to permanently delete staff member.' });
  }
}

// GET /api/secretary/salaries?month=2026-07 — every active staff member + their salary for that month, plus the running total
async function getSalariesForMonth(req, res) {
  const { month } = req.query;
  if (!month) {
    return res.status(400).json({ error: 'A month is required, e.g. ?month=2026-07' });
  }

  const monthStart = toMonthStart(month);
  if (!monthStart) {
    return res.status(400).json({ error: 'Invalid month format. Use YYYY-MM, e.g. 2026-07' });
  }

  try {
    const result = await pool.query(
      `SELECT sm.id AS staff_id, sm.name, sm.position, sm.account_number,
              ss.id AS salary_id, ss.amount
       FROM staff_members sm
       LEFT JOIN staff_salaries ss ON ss.staff_id = sm.id AND ss.month = $1
       WHERE sm.status = 'active'
       ORDER BY sm.name`,
      [monthStart]
    );

    const staff = result.rows.map((r) => ({
      staff_id: r.staff_id,
      name: r.name,
      position: r.position,
      account_number: r.account_number,
      salary_id: r.salary_id,
      amount: r.amount !== null ? Number(r.amount) : null,
    }));

    const total = staff.reduce((sum, s) => sum + (s.amount || 0), 0);

    res.json({ month: monthStart, staff, total: Math.round(total * 100) / 100 });
  } catch (err) {
    console.error('getSalariesForMonth error:', err);
    res.status(500).json({ error: 'Failed to load salaries.' });
  }
}

// POST /api/secretary/salaries — set/update one staff member's salary for a given month
// body: { staff_id, month: "2026-07", amount: 1500.00 }
async function setSalary(req, res) {
  const { staff_id, month, amount } = req.body;

  if (!staff_id || !month || amount === undefined || amount === null) {
    return res.status(400).json({ error: 'staff_id, month, and amount are required.' });
  }
  if (Number(amount) < 0) {
    return res.status(400).json({ error: 'amount cannot be negative.' });
  }

  const monthStart = toMonthStart(month);
  if (!monthStart) {
    return res.status(400).json({ error: 'Invalid month format. Use YYYY-MM, e.g. 2026-07' });
  }

  try {
    const staffCheck = await pool.query('SELECT id FROM staff_members WHERE id = $1', [staff_id]);
    if (staffCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Staff member not found.' });
    }

    const result = await pool.query(
      `INSERT INTO staff_salaries (staff_id, month, amount)
       VALUES ($1, $2, $3)
       ON CONFLICT (staff_id, month)
       DO UPDATE SET amount = $3, updated_at = now()
       RETURNING id, staff_id, month, amount`,
      [staff_id, monthStart, amount]
    );

    res.status(200).json({ salary: result.rows[0] });
  } catch (err) {
    console.error('setSalary error:', err);
    res.status(500).json({ error: 'Failed to save salary.' });
  }
}

module.exports = {
  listStaff,
  addStaff,
  updateStaff,
  removeStaff,
  listInactiveStaff,
  reactivateStaff,
  permanentlyDeleteStaff,
  getSalariesForMonth,
  setSalary,
};