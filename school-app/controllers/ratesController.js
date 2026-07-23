const pool = require('../config/db');

async function getRates(req, res) {
  try {
    const result = await pool.query('SELECT * FROM fee_rates WHERE id = 1');
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Get rates error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

async function updateRates(req, res) {
  try {
    const { canteen_rate_per_student, bus_rate_per_student, anomaly_threshold_pct } = req.body;

    const fields = [];
    const values = [];
    let i = 1;

    if (canteen_rate_per_student !== undefined) {
      if (typeof canteen_rate_per_student !== 'number' || canteen_rate_per_student < 0) {
        return res.status(400).json({ error: 'canteen_rate_per_student must be a non-negative number.' });
      }
      fields.push(`canteen_rate_per_student = $${i++}`);
      values.push(canteen_rate_per_student);
    }
    if (bus_rate_per_student !== undefined) {
      if (typeof bus_rate_per_student !== 'number' || bus_rate_per_student < 0) {
        return res.status(400).json({ error: 'bus_rate_per_student must be a non-negative number.' });
      }
      fields.push(`bus_rate_per_student = $${i++}`);
      values.push(bus_rate_per_student);
    }
    if (anomaly_threshold_pct !== undefined) {
      if (typeof anomaly_threshold_pct !== 'number' || anomaly_threshold_pct < 0 || anomaly_threshold_pct > 100) {
        return res.status(400).json({ error: 'anomaly_threshold_pct must be between 0 and 100.' });
      }
      fields.push(`anomaly_threshold_pct = $${i++}`);
      values.push(anomaly_threshold_pct);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields provided to update.' });
    }

    fields.push(`updated_at = now()`);

    const result = await pool.query(
      `UPDATE fee_rates SET ${fields.join(', ')} WHERE id = 1 RETURNING *`,
      values
    );

    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Update rates error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = { getRates, updateRates };