import 'dotenv/config';
import { Pool, type QueryResult, type QueryResultRow } from 'pg';
import bcrypt from 'bcryptjs';
import * as fs from 'fs';
import path from 'path';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required. Set it to your PostgreSQL connection string.');
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.DB_POOL_MAX ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

let initialized = false;

async function query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

async function runSchemaMigrations() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      username TEXT UNIQUE,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      age INTEGER NOT NULL DEFAULT 0,
      role TEXT NOT NULL DEFAULT 'student',
      all_unlocked BOOLEAN NOT NULL DEFAULT FALSE,
      email_verified_at TIMESTAMPTZ,
      disabled_at TIMESTAMPTZ,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT users_login_identity_check CHECK (username IS NOT NULL OR email IS NOT NULL)
    );
  `);

  await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;');
  await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;');
  await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;');
  await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;');
  await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;');
  await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();');
  await query('CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique_idx ON users(username);');
  await query('CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users(email);');

  await query(`
    CREATE TABLE IF NOT EXISTS otp_codes (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      purpose TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ip_address TEXT,
      user_agent TEXT
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS user_lesson_progress (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      group_id INTEGER NOT NULL,
      letter_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed',
      stars INTEGER NOT NULL DEFAULT 0 CHECK (stars >= 0 AND stars <= 3),
      xp INTEGER NOT NULL DEFAULT 0,
      best_score INTEGER NOT NULL DEFAULT 0,
      attempts_count INTEGER NOT NULL DEFAULT 0,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, group_id, letter_id)
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS lesson_attempts (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      group_id INTEGER NOT NULL,
      letter_id TEXT NOT NULL,
      stars_earned INTEGER NOT NULL DEFAULT 0 CHECK (stars_earned >= 0 AND stars_earned <= 3),
      xp_earned INTEGER NOT NULL DEFAULT 0,
      score INTEGER NOT NULL DEFAULT 0,
      duration_seconds INTEGER,
      completed BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS group_exam_attempts (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      group_id INTEGER NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      passed BOOLEAN NOT NULL DEFAULT FALSE,
      xp_earned INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS user_stats (
      user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      total_xp INTEGER NOT NULL DEFAULT 0,
      total_stars INTEGER NOT NULL DEFAULT 0,
      current_streak_days INTEGER NOT NULL DEFAULT 0,
      longest_streak_days INTEGER NOT NULL DEFAULT 0,
      last_activity_date DATE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS daily_activity (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      activity_date DATE NOT NULL,
      lessons_completed INTEGER NOT NULL DEFAULT 0,
      xp_earned INTEGER NOT NULL DEFAULT 0,
      stars_earned INTEGER NOT NULL DEFAULT 0,
      UNIQUE (user_id, activity_date)
    );
  `);

  await query('CREATE INDEX IF NOT EXISTS idx_user_lesson_progress_user ON user_lesson_progress(user_id);');
  await query('CREATE INDEX IF NOT EXISTS idx_lesson_attempts_user_created ON lesson_attempts(user_id, created_at DESC);');
  await query('CREATE INDEX IF NOT EXISTS idx_group_exam_attempts_user_group ON group_exam_attempts(user_id, group_id);');
  await query('CREATE INDEX IF NOT EXISTS idx_otp_codes_email_purpose ON otp_codes(email, purpose);');
  await query('CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);');
}

async function seedDevAccount() {
  const devEmail = 'dev@dev.dev';
  const passwordHash = await bcrypt.hash('1111', 12);
  const existing = await query<{ id: string }>(
    'SELECT id FROM users WHERE username = $1 OR email IN ($2, $3) ORDER BY id LIMIT 1',
    ['dev', devEmail, 'dev@example.local']
  );
  let devUserId = existing.rows[0]?.id;

  if (devUserId) {
    await query(
      `UPDATE users
       SET username = $1,
           email = $2,
           password_hash = $3,
           name = 'Developer',
           age = 0,
           role = 'developer',
           all_unlocked = TRUE,
           email_verified_at = COALESCE(email_verified_at, NOW()),
           disabled_at = NULL,
           updated_at = NOW()
       WHERE id = $4`,
      ['dev', devEmail, passwordHash, devUserId]
    );
  } else {
    const inserted = await query<{ id: string }>(
      `INSERT INTO users (username, email, password_hash, name, age, role, all_unlocked, email_verified_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING id`,
      ['dev', devEmail, passwordHash, 'Developer', 0, 'developer', true]
    );
    devUserId = inserted.rows[0].id;
  }

  await query(
    `INSERT INTO user_stats (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [devUserId]
  );

  const curriculumPath = path.join(process.cwd(), 'src', 'data', 'curriculum.json');
  const curriculumData = JSON.parse(fs.readFileSync(curriculumPath, 'utf-8')) as any;

  for (const group of curriculumData.groups) {
    for (const letter of group.letters) {
      await query(
        `INSERT INTO user_lesson_progress
          (user_id, group_id, letter_id, status, stars, xp, best_score, attempts_count, started_at, completed_at)
         VALUES ($1, $2, $3, 'completed', 3, 30, 100, 1, NOW(), NOW())
         ON CONFLICT (user_id, group_id, letter_id)
         DO UPDATE SET
          stars = GREATEST(user_lesson_progress.stars, EXCLUDED.stars),
          xp = GREATEST(user_lesson_progress.xp, EXCLUDED.xp),
          best_score = GREATEST(user_lesson_progress.best_score, EXCLUDED.best_score),
          status = 'completed',
          completed_at = COALESCE(user_lesson_progress.completed_at, NOW()),
          updated_at = NOW()`,
        [devUserId, group.id, letter.id]
      );
    }
  }

  await refreshUserStats(Number(devUserId));
}

async function seedTrialAccount() {
  const trialEmail = 'trial@trial.dev';
  const passwordHash = await bcrypt.hash('2222', 12);
  const result = await query<{ id: string }>(
    `INSERT INTO users
      (username, email, password_hash, name, age, role, all_unlocked, email_verified_at)
     VALUES ($1, $2, $3, $4, $5, 'student', FALSE, NOW())
     ON CONFLICT (email)
     DO UPDATE SET
       username = EXCLUDED.username,
       password_hash = EXCLUDED.password_hash,
       name = EXCLUDED.name,
       age = EXCLUDED.age,
       role = 'student',
       all_unlocked = FALSE,
       email_verified_at = COALESCE(users.email_verified_at, NOW()),
       disabled_at = NULL,
       updated_at = NOW()
     RETURNING id`,
    ['trial', trialEmail, passwordHash, 'Trial Student', 7]
  );

  await query(
    `INSERT INTO user_stats (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [result.rows[0].id]
  );
}

async function refreshUserStats(userId: number) {
  await query(
    `INSERT INTO user_stats (user_id, total_xp, total_stars, updated_at)
     SELECT $1, COALESCE(SUM(xp), 0)::INTEGER, COALESCE(SUM(stars), 0)::INTEGER, NOW()
     FROM user_lesson_progress
     WHERE user_id = $1
     ON CONFLICT (user_id)
     DO UPDATE SET
      total_xp = EXCLUDED.total_xp,
      total_stars = EXCLUDED.total_stars,
      updated_at = NOW()`,
    [userId]
  );
}

async function initDb() {
  if (initialized) return pool;
  await runSchemaMigrations();
  await seedDevAccount();
  await seedTrialAccount();
  initialized = true;
  return pool;
}

function getDb() {
  return { query };
}

async function closeDb() {
  await pool.end();
}

export { closeDb, getDb, initDb, query, refreshUserStats };
export default getDb;
