// ---------------------------------------------------------------------------
// Grader service — runs as its own process (npm run grader), separate from the
// API, so heavy CPU work never slows down page loads and each side scales on
// its own. Run as many grader processes, on as many machines, as you like:
// FOR UPDATE SKIP LOCKED guarantees each job is claimed by exactly one.
//
// Lifecycle of a job (a row in `submissions`):
//   API inserts it (queued) + NOTIFY submission_queued '<track>'
//   → that track's lane claims it (running, lease = now + leaseMs, attempts + 1)
//   → acquires a sandbox for the track, runs the harness on ALL tests
//   → writes the verdict + marks the problem solved, in one transaction,
//     fenced on its own lease (status done)
//   If the grader dies mid-job, the lease expires and the reaper re-queues it;
//   after maxAttempts it's marked failed instead of looping forever.
//
// Lanes ("bulkheads", docs/ARCHITECTURE.md §7.5): every track has its own
// claim loop, concurrency limit and sandbox pool, so a burst of slow PySpark
// jobs can't starve fast SQL or Python ones.
//
// Sandbox policy per track (§7.3):
//   sql      reusable — learner code is SQL only, run on a fresh, locked-down
//            in-memory DuckDB per test; nothing Python-level persists.
//   python   single-use — learner code is Python and could tamper with the
//            interpreter for the next job (e.g. patch the harness), so every
//            job gets a fresh sandbox, restored from a memory snapshot (~0.1 s).
//   pyspark  single-use, booted normally (~3 s; DuckDB can't be snapshotted),
//            with pre-warmed spares to hide the start-up time.
// ---------------------------------------------------------------------------
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fork } from 'node:child_process';
import { createRequire } from 'node:module';
import pg from 'pg';
import { config, SERVER_DIR, REPO_DIR } from '../src/config.js';
import { logger as baseLogger } from '../src/logger.js';
import { createPool } from '../src/db.js';
import { buildPayload, verdictOf } from '../../shared/grader/payload.js';
import { pointsFor } from '../../shared/grader/points.js';
import { refreshStandings } from '../src/contests/standings.js';

const logger = baseLogger.child({ svc: 'grader' });
const WORKER_ID = `${os.hostname()}:${process.pid}`;
const SANDBOX_SCRIPT = path.join(SERVER_DIR, 'grader', 'sandbox.js');
const HARNESS = path.join(REPO_DIR, 'shared', 'grader', 'harness.py');
const PYODIDE_DIR = path.dirname(createRequire(import.meta.url).resolve('pyodide/package.json'));
const SNAPSHOT_FILE = path.join(os.tmpdir(), `datadrill-python-${process.pid}.snapshot`);
// SQL and shell input is never executed as Python/JS (DuckDB SQL; just-bash
// interpreter), and each test gets a fresh database/shell — safe to reuse.
const REUSABLE = new Set(['sql', 'shell']);
// just-bash doesn't export package.json, so derive its directory from the entry point.
const JUST_BASH_DIR = (() => {
  const entry = createRequire(import.meta.url).resolve('just-bash');
  const marker = `${path.sep}node_modules${path.sep}just-bash${path.sep}`;
  return entry.slice(0, entry.lastIndexOf(marker) + marker.length - 1);
})();
const SHELL_HARNESS = path.join(REPO_DIR, 'shared', 'grader', 'shell.js');
const SANDBOX_READY_TIMEOUT_MS = 60_000;

const db = createPool({ max: 4, name: 'grader' });
const { grader: G } = config;
let pythonSnapshot = null; // path once built
let stopping = false;

// ---- sandboxes -----------------------------------------------------------------

function sandboxArgs(extraRead = []) {
  return [
    '--permission',
    `--allow-fs-read=${PYODIDE_DIR}`,
    `--allow-fs-read=${G.wheelsDir}`,
    `--allow-fs-read=${path.dirname(SANDBOX_SCRIPT)}`,
    `--allow-fs-read=${HARNESS}`,
    `--allow-fs-read=${SHELL_HARNESS}`,
    `--allow-fs-read=${JUST_BASH_DIR}`,
    ...extraRead.map((p) => `--allow-fs-read=${p}`),
    `--max-old-space-size=${G.sandboxMemoryMb}`,
  ];
}

let nextMsgId = 0;
class Sandbox {
  constructor(track) {
    this.track = track;
    this.alive = true;
    this.pending = null;
    const snap = track === 'python' && pythonSnapshot ? [pythonSnapshot] : [];
    this.proc = fork(SANDBOX_SCRIPT, [track, G.wheelsDir, HARNESS, ...snap], {
      env: {},                                     // no secrets inside the sandbox
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
      execArgv: sandboxArgs(snap),
    });
    let stderr = '';
    this.proc.stderr.on('data', (d) => { stderr = (stderr + d).slice(-2000); });
    this.ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.kill(); reject(new Error('sandbox start timed out')); }, SANDBOX_READY_TIMEOUT_MS);
      this.proc.once('message', (m) => { clearTimeout(timer); m?.type === 'ready' ? resolve(this) : reject(new Error('bad handshake')); });
      this.proc.once('exit', (code) => { clearTimeout(timer); reject(new Error(`sandbox exited during start (${code}): ${stderr.slice(-300)}`)); });
    });
    this.ready.catch(() => {});
    this.proc.on('message', (m) => {
      if (m?.type === 'result' && this.pending?.id === m.id) this.pending.resolve(m.results);
    });
    this.proc.on('exit', (code, signal) => {
      this.alive = false;
      this.pending?.reject(Object.assign(new Error(`sandbox died (${signal || code})`), { crash: true }));
    });
  }

  run(payload, timeoutMs) {
    const id = String(++nextMsgId);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending = null;
        this.kill();                                   // the only way to stop a synchronous runaway loop
        reject(Object.assign(new Error('time limit exceeded'), { timeout: true }));
      }, timeoutMs);
      this.pending = {
        id,
        resolve: (r) => { clearTimeout(timer); this.pending = null; resolve(r); },
        reject: (e) => { clearTimeout(timer); this.pending = null; reject(e); },
      };
      this.proc.send({ id, payload });
    });
  }

  kill() {
    if (this.alive) this.proc.kill('SIGKILL');
    this.alive = false;
  }
}

// Builds the Python memory snapshot in a locked-down child (same permissions
// as a sandbox) and stores it in a temp file the Python sandboxes may read.
async function buildPythonSnapshot() {
  const started = Date.now();
  const child = fork(SANDBOX_SCRIPT, ['make-python-snapshot', G.wheelsDir, HARNESS], {
    env: {}, stdio: ['ignore', 'ignore', 'pipe', 'ipc'], serialization: 'advanced', execArgv: sandboxArgs(),
  });
  const bytes = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('snapshot timed out')); }, SANDBOX_READY_TIMEOUT_MS);
    child.once('message', (m) => { clearTimeout(timer); m?.type === 'snapshot' ? resolve(m.bytes) : reject(new Error('bad snapshot message')); });
    child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`snapshot child exited (${code})`)); });
  });
  await fs.writeFile(SNAPSHOT_FILE, bytes);
  logger.info({ mb: +(bytes.length / 1e6).toFixed(1), ms: Date.now() - started }, 'python snapshot ready');
  return SNAPSHOT_FILE;
}

// One pool per track. `max` sandboxes alive at once (= concurrency + warm),
// `warm` idle ones kept ready so a burst starts without waiting for boot.
class TrackPool {
  constructor(track, { concurrency, warm }) {
    this.track = track;
    this.warm = warm;
    this.max = concurrency + warm;
    this.idle = [];
    this.alive = 0;
    this.waiters = [];
  }

  spawn() {
    this.alive += 1;
    const sb = new Sandbox(this.track);
    sb.proc.once('exit', () => { this.alive -= 1; this.wake(); this.replenish(); });
    return sb;
  }

  async acquire() {
    for (;;) {
      while (this.idle.length) {
        const sb = this.idle.shift();
        if (!sb.alive) continue;
        this.replenish();
        try { return await sb.ready; } catch { /* died while warming — try the next */ }
      }
      if (this.alive < this.max) {
        const sb = this.spawn();
        return sb.ready;
      }
      await new Promise((resolve) => this.waiters.push(resolve));
    }
  }

  release(sb) {
    if (sb.alive && REUSABLE.has(sb.track) && !stopping) this.idle.push(sb);
    else sb.kill();
    this.wake();
  }

  wake() {
    this.waiters.shift()?.();
  }

  replenish() {
    if (stopping) return;
    // Drop dead entries in place — acquire() may hold a reference to this array.
    for (let i = this.idle.length - 1; i >= 0; i--) if (!this.idle[i].alive) this.idle.splice(i, 1);
    while (this.idle.length < this.warm && this.alive < this.max) this.idle.push(this.spawn());
  }

  killAll() {
    this.idle.forEach((s) => s.kill());
  }
}

const pools = Object.fromEntries(Object.entries(G.lanes).map(([track, lane]) => [track, new TrackPool(track, lane)]));

// ---- problems (cached per version) ------------------------------------------

const problemCache = new Map(); // `${id}@${version}` → { problem, tests }
async function loadProblem(id) {
  const { rows: [p] } = await db.query(
    'SELECT id, track_id, version, entry, schema, output_columns, points FROM problems WHERE id = $1', [id]);
  if (!p) return null;
  const key = `${p.id}@${p.version}`;
  if (!problemCache.has(key)) {
    const { rows } = await db.query(
      'SELECT name, hidden, ordered, input, expected FROM problem_tests WHERE problem_id = $1 ORDER BY position', [id]);
    problemCache.set(key, {
      version: p.version,
      basePoints: p.points,
      problem: { track: p.track_id, entry: p.entry, schema: p.schema, outputColumns: p.output_columns },
      tests: rows.map((t) => ({ name: t.name, hidden: t.hidden, ordered: t.ordered, ...t.input, expected: t.expected })),
    });
    if (problemCache.size > 500) problemCache.delete(problemCache.keys().next().value);
  }
  return problemCache.get(key);
}

// ---- results -----------------------------------------------------------------

// Hidden tests must not reveal their data: no inputs, outputs, stdout or
// tracebacks — only pass/fail, a shape-level message and the exception type.
function redact(results) {
  let hiddenNo = 0;
  return results.map((r) => {
    if (!r.hidden) return { ...r, stdout: (r.stdout || '').slice(0, 10_000) };
    hiddenNo += 1;
    const message = r.status === 'error'
      ? `${String(r.message).split(':')[0]} raised on this hidden test.`
      : r.message;
    return { name: `Hidden test ${hiddenNo}`, hidden: true, status: r.status, message, ms: r.ms };
  });
}

// ---- queue -------------------------------------------------------------------

async function claim(track) {
  const { rows: [job] } = await db.query(
    `UPDATE submissions SET status = 'running', attempts = attempts + 1, worker_id = $1,
       locked_until = now() + make_interval(secs => $2), started_at = coalesce(started_at, now())
     WHERE id = (
       SELECT id FROM submissions WHERE status = 'queued' AND track = $3
       ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
     )
     RETURNING id, user_id, problem_id, code, attempts, created_at, contest_id`,
    [WORKER_ID, G.leaseMs / 1000, track]);
  return job || null;
}

// Writes the verdict only if this grader still holds the lease ("fencing"):
// if we stalled past the lease and another grader re-ran the job, our late
// result is discarded instead of overwriting theirs.
//
// In the same transaction it scores the submission (shared/grader/points.js):
// the user_problems row is locked FOR UPDATE first, so two submissions for the
// same problem finishing at once can't both claim the first-solve award.
async function finish(job, outcome) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: [sub] } = await client.query(
      `UPDATE submissions SET status = 'done', verdict = $3, passed = $4, total = $5, runtime_ms = $6,
         results = $7, problem_version = $8, finished_at = now(), locked_until = NULL
       WHERE id = $1 AND worker_id = $2 AND status = 'running'
       RETURNING created_at`,
      [job.id, WORKER_ID, outcome.verdict, outcome.passed, outcome.total, outcome.runtimeMs, JSON.stringify(outcome.results), outcome.version]);
    let points = 0;
    if (sub) {
      await client.query(
        'INSERT INTO user_problems (user_id, problem_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [job.user_id, job.problem_id]);
      const { rows: [up] } = await client.query(
        'SELECT solved_at, revealed_at FROM user_problems WHERE user_id = $1 AND problem_id = $2 FOR UPDATE',
        [job.user_id, job.problem_id]);
      const counts = outcome.verdict !== 'Internal Error';
      let attemptNo = null;
      if (counts) {
        // Attempt number = position among this user's countable submissions
        // for the problem, in the order they were SUBMITTED (not graded).
        // Compared inside SQL: a JS Date would truncate Postgres' microsecond
        // timestamps and miss this very submission.
        const { rows: [a] } = await client.query(
          `SELECT count(*) AS n FROM submissions s, (SELECT created_at, id FROM submissions WHERE id = $3) me
           WHERE s.user_id = $1 AND s.problem_id = $2 AND s.status <> 'failed' AND coalesce(s.verdict, '') <> 'Internal Error'
             AND (s.created_at, s.id) <= (me.created_at, me.id)`,
          [job.user_id, job.problem_id, job.id]);
        attemptNo = a.n;
      }
      const accepted = outcome.verdict === 'Accepted';
      const firstSolve = accepted && !up.solved_at;
      if (firstSolve) {
        points = pointsFor(outcome.basePoints, attemptNo, {
          revealedBeforeSolve: Boolean(up.revealed_at && up.revealed_at <= sub.created_at),
        });
      }
      await client.query('UPDATE submissions SET attempt_no = $2, points_awarded = $3 WHERE id = $1', [job.id, attemptNo, points]);
      await client.query(
        `UPDATE user_problems SET
           submissions_count = submissions_count + CASE WHEN $3 THEN 1 ELSE 0 END,
           status = CASE WHEN $4 OR status = 'solved' THEN 'solved' ELSE 'attempted' END,
           solved_at = CASE WHEN $5 THEN now() ELSE solved_at END,
           solved_attempt = CASE WHEN $5 THEN $6 ELSE solved_attempt END,
           points = points + $7,
           updated_at = now()
         WHERE user_id = $1 AND problem_id = $2`,
        [job.user_id, job.problem_id, counts, accepted, firstSolve, attemptNo, points]);
      if (points) await client.query('UPDATE users SET points = points + $2 WHERE id = $1', [job.user_id, points]);
      // Acceptance counters (docs §9.5): O(1) per verdict instead of a periodic full scan.
      if (counts) {
        await client.query(
          `INSERT INTO problem_stats (problem_id, submissions, accepted, solvers) VALUES ($1, 1, $2, $3)
           ON CONFLICT (problem_id) DO UPDATE SET submissions = problem_stats.submissions + 1,
             accepted = problem_stats.accepted + $2, solvers = problem_stats.solvers + $3`,
          [job.problem_id, accepted ? 1 : 0, firstSolve ? 1 : 0]);
      }
      // Contest submission: the standings move in the same transaction as the
      // verdict, and NOTIFY (on commit) pushes the change to every player.
      if (job.contest_id) await refreshStandings(client, job.contest_id);
    }
    await client.query('COMMIT');
    return { written: Boolean(sub), points };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function grade(job, track, timing) {
  const started = Date.now();
  const data = await loadProblem(job.problem_id);
  if (!data) return { verdict: 'Internal Error', passed: 0, total: 0, runtimeMs: 0, results: [], version: 0 };
  const payload = buildPayload(data.problem, data.tests, job.code);
  const base = { total: data.tests.length, version: data.version, basePoints: data.basePoints };
  const sb = await pools[track].acquire();
  timing.acquireMs = Date.now() - started;
  try {
    const results = await sb.run(payload, G.jobTimeoutMs);
    timing.runMs = Date.now() - started - timing.acquireMs;
    return {
      ...base,
      verdict: verdictOf(results, 'submit'),
      passed: results.filter((r) => r.status === 'passed').length,
      runtimeMs: Math.round(results.reduce((n, r) => n + r.ms, 0)),
      results: redact(results),
    };
  } catch (err) {
    if (err.timeout) {
      return { ...base, verdict: 'Time Limit Exceeded', passed: 0, runtimeMs: G.jobTimeoutMs,
        results: [{ name: 'All tests', status: 'error', message: `Your code ran longer than ${G.jobTimeoutMs / 1000}s — look for an infinite loop or a very slow approach.` }] };
    }
    if (err.crash) {
      return { ...base, verdict: 'Runtime Error', passed: 0, runtimeMs: Date.now() - started,
        results: [{ name: 'All tests', status: 'error', message: 'Your code crashed the runtime — usually this means it used too much memory.' }] };
    }
    throw err;
  } finally {
    pools[track].release(sb);
  }
}

// ---- lanes -------------------------------------------------------------------

const inflight = Object.fromEntries(Object.keys(G.lanes).map((t) => [t, 0]));
const pumping = new Set();

async function processJob(job, track) {
  const log = logger.child({ submission: job.id, problem: job.problem_id, track, attempt: job.attempts });
  // queueMs: waited in the queue · acquireMs: waited for a sandbox · runMs: tests ran
  const timing = { queueMs: Date.now() - new Date(job.created_at).getTime() };
  try {
    const outcome = await grade(job, track, timing);
    const { written, points } = await finish(job, outcome);
    log.info({ verdict: outcome.verdict, passed: outcome.passed, total: outcome.total, written, points, ...timing }, 'graded');
  } catch (err) {
    // Infrastructure failure (DB blip, sandbox wouldn't start). Leave the job
    // 'running'; its lease expires and the reaper retries it.
    log.error({ err: err.message }, 'grading failed — will retry after lease expiry');
  }
}

// Claim as many jobs for this track as its lane allows. Called on NOTIFY, on a
// timer (in case a notification was missed) and whenever a job finishes.
async function pump(track) {
  if (pumping.has(track) || stopping) return;
  pumping.add(track);
  try {
    while (!stopping && inflight[track] < G.lanes[track].concurrency) {
      const job = await claim(track);
      if (!job) break;
      inflight[track] += 1;
      processJob(job, track).finally(() => { inflight[track] -= 1; setImmediate(() => pump(track)); });
    }
  } catch (err) {
    logger.warn({ err: err.message, track }, 'claim failed');
  } finally {
    pumping.delete(track);
  }
}
const pumpAll = () => Object.keys(G.lanes).forEach((t) => pump(t));

// Jobs whose grader died: re-queue, or give up after maxAttempts.
async function reap() {
  try {
    const { rows } = await db.query(
      `UPDATE submissions SET
         status   = CASE WHEN attempts >= $1 THEN 'failed' ELSE 'queued' END,
         verdict  = CASE WHEN attempts >= $1 THEN 'Internal Error' ELSE NULL END,
         finished_at = CASE WHEN attempts >= $1 THEN now() END,
         locked_until = NULL, worker_id = NULL
       WHERE status = 'running' AND locked_until < now()
       RETURNING id, status, contest_id`, [G.maxAttempts]);
    if (rows.length) {
      logger.warn({ jobs: rows.map(({ id, status }) => ({ id, status })) }, 'reaped expired leases');
      setImmediate(pumpAll);
    }
    // A contest job given up on stops showing as "grading…" on the board.
    for (const contestId of new Set(rows.filter((r) => r.status === 'failed' && r.contest_id).map((r) => r.contest_id))) {
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        await refreshStandings(client, contestId);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        logger.warn({ err: err.message, contestId }, 'standings refresh failed');
      } finally {
        client.release();
      }
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'reaper failed');
  }
}

function listen() {
  let delay = 1000;
  const connect = async () => {
    if (stopping) return;
    const client = new pg.Client({ connectionString: config.postgres.url, application_name: 'datadrill-grader-listen' });
    client.on('error', () => {});
    client.on('end', () => { if (!stopping) setTimeout(connect, delay = Math.min(delay * 2, 30_000)); });
    client.on('notification', (n) => {
      if (n.channel === 'content_changed') problemCache.clear();
      else if (G.lanes[n.payload]) pump(n.payload);
      else pumpAll();
    });
    try {
      await client.connect();
      await client.query('LISTEN submission_queued');
      await client.query('LISTEN content_changed');
      delay = 1000;
      pumpAll();
    } catch {
      client.end().catch(() => {});
    }
  };
  connect();
}

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  const busy = () => Object.values(inflight).reduce((a, b) => a + b, 0);
  logger.info({ signal, inflight: busy() }, 'grader stopping: finishing in-flight jobs');
  const deadline = Date.now() + 25_000;
  while (busy() > 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 200));
  // Anything still ours goes straight back to the queue for another grader.
  await db.query(
    `UPDATE submissions SET status = 'queued', locked_until = NULL, worker_id = NULL, attempts = greatest(attempts - 1, 0)
     WHERE worker_id = $1 AND status = 'running'`, [WORKER_ID]).catch(() => {});
  Object.values(pools).forEach((p) => p.killAll());
  await fs.rm(SNAPSHOT_FILE, { force: true });
  await db.end().catch(() => {});
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => { logger.fatal({ err: err.message, stack: err.stack }, 'grader crashed'); process.exit(1); });

logger.info({ worker: WORKER_ID, lanes: G.lanes }, 'grader starting');
if (G.pythonSnapshot) {
  try {
    pythonSnapshot = await buildPythonSnapshot();
  } catch (err) {
    logger.warn({ err: err.message }, 'python snapshot unavailable — python sandboxes will boot normally');
  }
}
Object.values(pools).forEach((p) => p.replenish());
listen();
await reap();
setInterval(pumpAll, G.pollIntervalMs).unref();
setInterval(reap, 15_000).unref();
setInterval(() => logger.info({
  inflight,
  sandboxes: Object.fromEntries(Object.entries(pools).map(([t, p]) => [t, { alive: p.alive, idle: p.idle.length }])),
}, 'grader stats'), 60_000).unref();
// The grader is a long-running daemon: keep the event loop alive even while
// the LISTEN connection is between reconnect attempts.
setInterval(() => {}, 60 * 60 * 1000);
