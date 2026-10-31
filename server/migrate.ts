import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadServerConfig } from './config';
import { closeDatabase, getDatabase } from './db';

export async function runMigrations(): Promise<void> {
  const config = loadServerConfig();
  const db = getDatabase(config);
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const directory = path.resolve(process.cwd(), 'server/migrations');
  const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort();

  for (const file of files) {
    const exists = await db.query('SELECT 1 FROM schema_migrations WHERE migration_id = $1', [file]);
    if (exists.rowCount) continue;

    const sql = await readFile(path.join(directory, file), 'utf8');
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (migration_id) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`Applied migration ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (entryPath && fileURLToPath(import.meta.url) === entryPath) {
  runMigrations()
    .then(() => closeDatabase())
    .catch(async (error) => {
      console.error(error);
      await closeDatabase();
      process.exit(1);
    });
}
