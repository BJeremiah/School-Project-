const { Pool } = require('pg');
require('dotenv').config();

// A single shared connection pool for the whole app.
// pg handles connection reuse/queueing for us — never open a raw
// client per-request in route handlers.
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

pool.on('error', (err) => {
  // Catches errors on idle clients (e.g. DB restarts) so they don't
  // crash the whole Node process.
  console.error('Unexpected PostgreSQL pool error:', err);
});

module.exports = pool;
