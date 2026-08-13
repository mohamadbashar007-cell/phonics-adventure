import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
});

try {
  const tables = await pool.query("select count(1)::int as count from information_schema.tables where table_schema = 'public'");
  const users = await pool.query('select username, role, all_unlocked from users order by id limit 3');
  console.log(JSON.stringify({ tables: tables.rows[0].count, users: users.rows }));
} finally {
  await pool.end();
}
