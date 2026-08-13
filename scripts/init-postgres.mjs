import { initDb, closeDb } from '../src/db/index.ts';

try {
  await initDb();
  console.log('PostgreSQL schema initialized.');
} finally {
  await closeDb();
}
