const { Pool } = require('pg');
require('dotenv').config();

// A single shared connection pool for the whole app.
// pg handles connection reuse/queueing for us — never open a raw
// client per-request in route handlers.
//
// If DATABASE_URL is set (production / Neon), use it directly.
// Otherwise fall back to the individual DB_* vars (local development).
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : new Pool({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
    });

// Neon's pooled connection (PgBouncer) doesn't allow search_path as a
// startup parameter, so set it explicitly on every new connection instead.
pool.on('connect', (client) => {
  client.query('SET search_path TO public').catch(() => {});
});

pool.on('error', (err) => {
  // Catches errors on idle clients (e.g. DB restarts) so they don't
  // crash the whole Node process.
  console.error('Unexpected PostgreSQL pool error:', err);
});

module.exports = pool;
