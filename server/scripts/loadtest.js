// ---------------------------------------------------------------------------
// Load test: "100 requests at a time from ~1000 users".
//
// Prerequisites: API + grader running, and — because every request here
// comes from ONE IP — the per-IP abuse limit raised for the API, e.g.
//   LIMIT_API_PER_MINUTE=100000000 npm start      (in server/)
//   npm run grader
//   npm run loadtest
//
// Scenarios (100 concurrent connections each):
//   1. public catalog              (content cache, no DB)
//   2. problem page, signed in     (content cache + 1 DB read per request)
//   3. draft autosave, signed in   (1 DB write per request)
//   4. submission burst            (100 users submit at the same instant;
//                                   measures time until every verdict is in)
// Test users are created directly in the database and cleaned up at the end.
// ---------------------------------------------------------------------------
import autocannon from 'autocannon';
import crypto from 'node:crypto';
import { query, pool } from '../src/db.js';
import { hashPassword } from '../src/lib/crypto.js';
import { signAccessToken } from '../src/middleware/auth.js';
import { PROBLEMS } from '../content/problems/index.js';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001';
const USERS = Number(process.env.LOADTEST_USERS || 1000);
const CONNECTIONS = Number(process.env.LOADTEST_CONNECTIONS || 100);
const DURATION = Number(process.env.LOADTEST_SECONDS || 15);

// ---- setup: N users with valid access tokens -------------------------------
const tag = `loadtest-${Date.now()}`;
const hash = await hashPassword('load-test-password');
const { rows: users } = await query(
  `INSERT INTO users (email, name, password_hash)
   SELECT $1 || '-' || g || '@load.test', 'Load User ' || g, $2 FROM generate_series(1, $3) g
   RETURNING id, role`, [tag, hash, USERS]);
const cookies = users.map((u) => `dd_at=${signAccessToken(u)}`);
console.log(`created ${users.length} test users`);

const headersFor = (i) => ({ cookie: cookies[i % cookies.length], 'x-requested-with': 'datadrill', 'content-type': 'application/json' });

function bench(title, opts) {
  return new Promise((resolve) => {
    let n = 0;
    autocannon({
      url: BASE,
      connections: CONNECTIONS,
      duration: DURATION,
      ...opts,
      // rotate through all users so per-user work is spread like real traffic
      setupClient: (client) => client.on('response', () => { n += 1; }),
      requests: opts.requests.map((r) => ({
        ...r,
        setupRequest: (req) => ({ ...req, headers: headersFor(Math.floor(Math.random() * users.length)) }),
      })),
    }, (err, res) => {
      if (err) throw err;
      const non2xx = res.non2xx;
      console.log(`\n▶ ${title}`);
      console.log(`  requests: ${res.requests.total} in ${res.duration}s → ${Math.round(res.requests.average)} req/s`);
      console.log(`  latency:  p50 ${res.latency.p50} ms · p90 ${res.latency.p90} ms · p99 ${res.latency.p99} ms · max ${res.latency.max} ms`);
      console.log(`  errors:   ${res.errors} socket errors · ${res.timeouts} timeouts · ${non2xx} non-2xx`);
      resolve({ title, rps: Math.round(res.requests.average), p50: res.latency.p50, p99: res.latency.p99, errors: res.errors + res.timeouts + non2xx });
    });
  });
}

const summary = [];
summary.push(await bench('public catalog (GET /api/catalog)', { requests: [{ method: 'GET', path: '/api/catalog' }] }));
summary.push(await bench('problem page, signed in (GET /api/problems/:id)', { requests: [{ method: 'GET', path: '/api/problems/top-customers-by-region' }] }));
summary.push(await bench('draft autosave, signed in (PUT /api/problems/:id/draft)', {
  requests: [{ method: 'PUT', path: '/api/problems/dedupe-retried-events/draft', body: JSON.stringify({ code: 'def dedupe_events(events):\n    return events\n' }) }],
}));

// ---- submission burst ---------------------------------------------------------
// 100 different users press Submit at the same instant: 60 SQL, 25 Python,
// 15 PySpark (all correct reference solutions → every verdict should be Accepted).
const mix = [['sql', 60], ['python', 25], ['pyspark', 15]];
const byTrack = Object.fromEntries(PROBLEMS.map((p) => [p.track, p]));
const jobs = mix.flatMap(([track, n]) => Array.from({ length: n }, () => byTrack[track]));
const t0 = Date.now();
const created = await Promise.all(jobs.map(async (p, i) => {
  const res = await fetch(`${BASE}/api/submissions`, {
    method: 'POST', headers: headersFor(i),
    body: JSON.stringify({ problemId: p.id, code: p.solution, clientToken: crypto.randomUUID() }),
  });
  const body = await res.json();
  return { status: res.status, id: body.submission?.id, track: p.track, user: i };
}));
const accepted = created.filter((c) => c.status === 202);
console.log(`\n▶ submission burst: ${jobs.length} simultaneous submits → ${accepted.length} accepted for grading in ${Date.now() - t0} ms` +
  (accepted.length < jobs.length ? ` (statuses: ${[...new Set(created.map((c) => c.status))].join(',')})` : ''));

const done = new Map();
while (done.size < accepted.length && Date.now() - t0 < 300_000) {
  await new Promise((r) => setTimeout(r, 1000));
  const { rows } = await query(
    "SELECT id, status, verdict, finished_at, created_at FROM submissions WHERE id = ANY($1) AND status IN ('done', 'failed')",
    [accepted.map((c) => c.id)]);
  for (const r of rows) if (!done.has(r.id)) done.set(r.id, r);
}
const latencies = [...done.values()].map((r) => r.finished_at - r.created_at).sort((a, b) => a - b);
const pct = (q) => latencies[Math.min(latencies.length - 1, Math.floor(q * latencies.length))];
const verdicts = {};
for (const r of done.values()) verdicts[r.verdict || r.status] = (verdicts[r.verdict || r.status] || 0) + 1;
const perTrack = {};
for (const c of accepted) {
  const r = done.get(c.id);
  if (r) (perTrack[c.track] ||= []).push(r.finished_at - r.created_at);
}
console.log(`  all graded in ${((Date.now() - t0) / 1000).toFixed(1)} s · ${done.size}/${accepted.length} finished`);
console.log(`  time to verdict: p50 ${(pct(0.5) / 1000).toFixed(1)} s · p90 ${(pct(0.9) / 1000).toFixed(1)} s · max ${(latencies.at(-1) / 1000).toFixed(1)} s`);
for (const [t, l] of Object.entries(perTrack)) console.log(`  ${t.padEnd(8)} max ${(Math.max(...l) / 1000).toFixed(1)} s over ${l.length} jobs`);
console.log('  verdicts:', verdicts);

// ---- cleanup -----------------------------------------------------------------
await query("DELETE FROM users WHERE email LIKE $1", [`${tag}-%`]);
await pool.end();
console.log('\nsummary:', JSON.stringify(summary));
