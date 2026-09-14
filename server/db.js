let pool;

function getPool() {
  if (pool) return pool;
  if (!process.env.DATABASE_URL) return null;

  // Render connects to Supabase through the encrypted pooler URL.
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
  return pool;
}

async function checkDatabase() {
  const database = getPool();
  if (!database) return { configured: false, connected: false };
  await database.query('select 1');
  return { configured: true, connected: true };
}

module.exports = { getPool, checkDatabase };
