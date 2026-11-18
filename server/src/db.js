// ---------------------------------------------------------------------------
// PostgreSQL access: one bounded connection pool per process, a transaction
// helper, and the migration runner.
//
// Failure behaviour (see docs/ARCHITECTURE.md §9):
//   * pool exhausted / DB unreachable → acquiring a client fails after
//     connectTimeoutMs, the request gets 503 — requests never hang forever;
//   * a slow query is killed by statement_timeout instead of holding a
//     connection hostage;
//   * an idle client erroring (DB restart) is logged, not a process crash.
// ---------------------------------------------------------------------------
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { config, SERVER_DIR } from './config.js';
import { logger } from './logger.js';

// COUNT(*) and BIGINT come back as strings by default; they fit in a JS number here.
pg.types.setTypeParser(20, (v) => Number(v));

export function createPool({ max = config.postgres.poolMax, name = 'api' } = {}) {
  const pool = new pg.Pool({
    connectionString: config.postgres.url,
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: config.postgres.connectTimeoutMs,
    statement_timeout: config.postgres.statementTimeoutMs,
    query_timeout: config.postgres.statementTimeoutMs + 1000,
    application_name: `datadrill-${name}`,
  });
  pool.on('error', (err) => logger.warn({ err: err.message }, 'idle postgres client error'));
  return pool;
}

export const pool = createPool();
export const query = (text, params) => pool.query(text, params);

// Runs fn(client) inside BEGIN/COMMIT; any throw rolls back.
export async function tx(fn, db = pool) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Applies migrations/*.sql in order, once each. A Postgres advisory lock makes
// concurrent starters (several API processes booting at once) take turns, so
// a migration can never run twice.
const MIGRATION_LOCK = 727_001;
export async function migrate(db = pool) {
  const client = await db.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    const { rows } = await client.query('SELECT version FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.version));
    const dir = path.join(SERVER_DIR, 'migrations');
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await fs.readFile(path.join(dir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        logger.info({ migration: file }, 'migration applied');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${err.message}`);
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK]).catch(() => {});
    client.release();
  }
}
