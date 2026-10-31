import { Pool as PgPool, type Pool, type PoolClient } from 'pg';
import type { ServerConfig } from './config';

let pool: Pool | undefined;

export function getDatabase(config: ServerConfig): Pool {
  if (!pool) {
    pool = new PgPool({
      connectionString: config.databaseUrl,
      max: config.nodeEnv === 'production' ? 20 : 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      application_name: 'pet-os-api',
      ssl: config.nodeEnv === 'production' && !config.databaseUrl.includes('sslmode=disable')
        ? { rejectUnauthorized: true }
        : undefined,
    });
  }
  return pool;
}

export async function withTenantTransaction<T>(
  config: ServerConfig,
  actorUserId: string,
  householdId: string | undefined,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getDatabase(config).connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.user_id', $1, true)`, [actorUserId]);
    await client.query(`SELECT set_config('app.household_id', $1, true)`, [householdId || '']);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
