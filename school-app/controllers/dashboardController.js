const pool = require('../config/db');

async function getDashboard(req, res) {
  try {
    const [attendanceResult, revenueResult, feedResult, trendResult, ratesResult] = await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(present_count),0) AS total_present,
                COALESCE(SUM(absent_count),0) AS total_absent
         FROM daily_logs
         WHERE date = CURRENT_DATE`
      ),
      pool.query(
        `SELECT COALESCE(SUM(df.tuition_arrears),0) AS tuition_arrears,
                COALESCE(SUM(df.canteen_fees),0) AS canteen_fees,
                COALESCE(SUM(df.bus_fares),0) AS bus_fares,
                COALESCE(SUM(df.total_calculated),0) AS total_revenue
         FROM daily_finances df
         JOIN daily_logs dl ON df.log_id = dl.id
         WHERE dl.date = CURRENT_DATE`
      ),
      pool.query(
        `SELECT dl.id AS log_id, c.id AS class_id, c.class_name, u.name AS teacher_name,
                dl.present_count, dl.absent_count,
                df.canteen_fees, df.bus_fares, df.total_calculated, dl.submitted_at
         FROM daily_logs dl
         JOIN classes c ON dl.class_id = c.id
         LEFT JOIN users u ON c.teacher_id = u.id
         JOIN daily_finances df ON df.log_id = dl.id
         WHERE dl.date = CURRENT_DATE
         ORDER BY dl.submitted_at DESC
         LIMIT 20`
      ),
      pool.query(
        `SELECT dl.date, COALESCE(SUM(df.total_calculated),0) AS total
         FROM daily_logs dl
         JOIN daily_finances df ON df.log_id = dl.id
         WHERE dl.date >= CURRENT_DATE - INTERVAL '13 days'
         GROUP BY dl.date
         ORDER BY dl.date ASC`
      ),
      pool.query('SELECT * FROM fee_rates WHERE id = 1'),
    ]);

    const { total_present, total_absent } = attendanceResult.rows[0];
    const presentNum = Number(total_present);
    const absentNum = Number(total_absent);
    const totalStudents = presentNum + absentNum;
    const attendancePercent = totalStudents > 0
      ? Number(((presentNum / totalStudents) * 100).toFixed(1))
      : 0;

    const rates = ratesResult.rows[0];
    const canteenRate = Number(rates.canteen_rate_per_student);
    const busRate = Number(rates.bus_rate_per_student);
    const thresholdPct = Number(rates.anomaly_threshold_pct) / 100;

    const liveFeedWithFlags = feedResult.rows.map((row) => {
      const expectedCanteen = row.present_count * canteenRate;
      const expectedBus = row.present_count * busRate;
      const actualCanteen = Number(row.canteen_fees);
      const actualBus = Number(row.bus_fares);

      const canteenLow = expectedCanteen > 0 && actualCanteen < expectedCanteen * thresholdPct;
      const busLow = expectedBus > 0 && actualBus < expectedBus * thresholdPct;

      return {
        ...row,
        expected_canteen_fees: Number(expectedCanteen.toFixed(2)),
        expected_bus_fares: Number(expectedBus.toFixed(2)),
        is_anomaly: canteenLow || busLow,
        anomaly_reasons: [
          ...(canteenLow ? [`Canteen fees are below expected (GHS ${expectedCanteen.toFixed(2)} expected).`] : []),
          ...(busLow ? [`Bus fares are below expected (GHS ${expectedBus.toFixed(2)} expected).`] : []),
        ],
      };
    });

    return res.status(200).json({
      attendance: {
        total_present: presentNum,
        total_absent: absentNum,
        attendance_percent: attendancePercent,
      },
      revenue: revenueResult.rows[0],
      live_feed: liveFeedWithFlags,
      trend_last_14_days: trendResult.rows,
      current_rates: rates,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = { getDashboard };