// ---------------------------------------------------------------------------
// Configuration — every tunable in one place, read once from the environment
// (server/.env in development). Values are validated at startup so a bad
// deploy fails immediately instead of misbehaving under load.
// ---------------------------------------------------------------------------
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

export const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_DIR = path.resolve(SERVER_DIR, '..');
dotenv.config({ path: path.join(SERVER_DIR, '.env') });

const env = process.env;
const int = (name, fallback) => {
  const v = env[name];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Config ${name} must be a number, got "${v}"`);
  return n;
};

const isProd = env.NODE_ENV === 'production';
const isTest = env.NODE_ENV === 'test';

const DEV_JWT_SECRET = 'dev-only-secret-change-me-dev-only-secret-change-me';
const jwtSecret = env.JWT_SECRET || DEV_JWT_SECRET;
if (isProd && (jwtSecret === DEV_JWT_SECRET || jwtSecret.length < 32)) {
  throw new Error('JWT_SECRET must be set to a random string of at least 32 characters in production.');
}

export const config = {
  env: env.NODE_ENV || 'development',
  isProd,
  isTest,
  port: int('PORT', 3001),
  // Public URL of the web app — used in password-reset emails.
  appUrl: env.APP_URL || 'http://localhost:5173',
  trustProxy: env.TRUST_PROXY || (isProd ? '1' : false),
  logLevel: env.LOG_LEVEL || (isTest ? 'silent' : 'info'),

  // API processes per machine (node:cluster). The API is I/O bound, so one per core.
  webConcurrency: int('WEB_CONCURRENCY', isProd ? os.availableParallelism() : 2),

  postgres: {
    url: env.POSTGRES_URL || (isTest ? 'postgres://localhost:5432/datadrill_test' : 'postgres://localhost:5432/datadrill'),
    // Per process. Total connections = processes × poolMax (+ grader) — keep it
    // under Postgres max_connections (100 by default), or put PgBouncer in front.
    poolMax: int('PG_POOL_MAX', 10),
    connectTimeoutMs: int('PG_CONNECT_TIMEOUT_MS', 3000),
    statementTimeoutMs: int('PG_STATEMENT_TIMEOUT_MS', 5000),
  },
  // Legacy portfolio CMS (blog, bookings, site content) stays on MongoDB.
  mongoUrl: env.MONGO_URL || env.DATABASE || '',

  auth: {
    jwtSecret,
    accessTtlSec: int('ACCESS_TTL_SEC', 15 * 60),
    refreshTtlDays: int('REFRESH_TTL_DAYS', 30),
    cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : isProd,
    maxFailedLogins: int('MAX_FAILED_LOGINS', 5),
    lockoutMinutes: int('LOCKOUT_MINUTES', 15),
    resetTokenMinutes: int('RESET_TOKEN_MINUTES', 30),
  },
  legacyAdminPassword: env.ADMIN_PASSWORD || '',

  // Per-IP abuse limits (token buckets). Tests and load tests drive everything
  // from one IP, so these are configurable.
  limits: {
    signupPer10Min: int('LIMIT_SIGNUP_PER_10MIN', isTest ? 100_000 : 5),
    loginPer5Min: int('LIMIT_LOGIN_PER_5MIN', isTest ? 100_000 : 20),
    resetPer15Min: int('LIMIT_RESET_PER_15MIN', isTest ? 100_000 : 5),
    apiPerMinute: int('LIMIT_API_PER_MINUTE', isTest ? 1_000_000 : 600),
  },

  // Content (courses, problems) changes rarely; cache reads in-process.
  contentCacheTtlMs: int('CONTENT_CACHE_TTL_MS', 60_000),

  submissions: {
    maxCodeBytes: int('MAX_CODE_BYTES', 64 * 1024),
    perUserPerMinute: int('SUBMISSIONS_PER_MINUTE', 10),
    maxPendingPerUser: int('MAX_PENDING_PER_USER', 2),
    // Backpressure: beyond this many queued jobs, new submissions get 503.
    maxQueueDepth: int('MAX_QUEUE_DEPTH', 2000),
  },

  // Contests (docs §12).
  contests: {
    maxPlayers: int('CONTEST_MAX_PLAYERS', 10),           // joined participants per contest, host included
    maxOpenPerHost: int('CONTEST_MAX_OPEN_PER_HOST', 3),  // lobbies + running contests one user may host
    maxProblems: int('CONTEST_MAX_PROBLEMS', 8),
  },

  grader: {
    // One lane per track ("bulkhead"): its own job concurrency and its own
    // pre-warmed spare sandboxes, so one slow track can't starve the others.
    // Each sandbox is a Node process running Pyodide: ~200 MB for Python,
    // ~600 MB with DuckDB. Size lanes to the machine's cores and RAM.
    lanes: {
      sql: { concurrency: int('GRADER_SQL_CONCURRENCY', Math.max(1, Math.min(4, os.availableParallelism() >> 1))), warm: int('GRADER_WARM_SQL', 1) },
      python: { concurrency: int('GRADER_PYTHON_CONCURRENCY', Math.max(1, Math.min(4, os.availableParallelism() >> 1))), warm: int('GRADER_WARM_PYTHON', 2) },
      pyspark: { concurrency: int('GRADER_PYSPARK_CONCURRENCY', Math.max(1, Math.min(3, os.availableParallelism() >> 2))), warm: int('GRADER_WARM_PYSPARK', 2) },
      pandas: { concurrency: int('GRADER_PANDAS_CONCURRENCY', Math.max(1, Math.min(3, os.availableParallelism() >> 2))), warm: int('GRADER_WARM_PANDAS', 1) },
      shell: { concurrency: int('GRADER_SHELL_CONCURRENCY', 2), warm: int('GRADER_WARM_SHELL', 1) },
    },
    // Restore Python sandboxes from a memory snapshot (~0.1s) instead of
    // booting the interpreter (~1s). Set to 0 to disable.
    pythonSnapshot: int('GRADER_PYTHON_SNAPSHOT', 1) === 1,
    jobTimeoutMs: int('GRADER_JOB_TIMEOUT_MS', 20_000),
    leaseMs: int('GRADER_LEASE_MS', 60_000),
    maxAttempts: int('GRADER_MAX_ATTEMPTS', 3),
    sandboxMemoryMb: int('GRADER_SANDBOX_HEAP_MB', 512),
    pollIntervalMs: int('GRADER_POLL_MS', 2000),
    wheelsDir: path.join(SERVER_DIR, 'grader', 'wheels'),
  },
};
