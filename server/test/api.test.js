// ---------------------------------------------------------------------------
// Integration tests: real HTTP against a real Postgres (datadrill_test) and a
// real grader process. Run with `npm test` (from server/).
// ---------------------------------------------------------------------------
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { SERVER_DIR } from '../src/config.js';
import { pool, query, migrate } from '../src/db.js';
import { createApp } from '../src/app.js';
import { clearContentCache } from '../src/content/store.js';

let server;
let base;

before(async () => {
  await migrate();
  await query('TRUNCATE users, submissions, user_problems, problem_stats, module_progress, course_visits, sessions, password_resets CASCADE');
  // Seed content into the test database (child process, same code path as `npm run seed`).
  await new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['scripts/seed.js'], { cwd: SERVER_DIR, env: { ...process.env, NODE_ENV: 'test' }, stdio: 'ignore' });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`seed exited ${code}`))));
  });
  clearContentCache();
  server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server?.close();
  await pool.end();
});

// Minimal browser: keeps cookies, sends the CSRF header on writes.
function client() {
  const jar = new Map();
  return async function call(method, url, body, { csrf = true } = {}) {
    const headers = { 'content-type': 'application/json' };
    if (csrf) headers['x-requested-with'] = 'datadrill';
    if (jar.size) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(base + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const [k, v] = pair.split('=');
      if (/Expires=Thu, 01 Jan 1970/.test(c) || v === '') jar.delete(k); else jar.set(k, v);
    }
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, jar };
  };
}

const uniqueEmail = () => `u${crypto.randomUUID().slice(0, 8)}@test.dev`;
async function signedIn() {
  const c = client();
  const email = uniqueEmail();
  const r = await c('POST', '/api/auth/signup', { name: 'Test User', email, password: 'correct horse battery' });
  assert.equal(r.status, 201);
  return { c, email, user: r.body.user };
}

// ---- auth --------------------------------------------------------------------

test('signup signs you in; duplicate email (any case) is rejected', async () => {
  const { c, email } = await signedIn();
  const me = await c('GET', '/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, email);
  const dup = await client()('POST', '/api/auth/signup', { name: 'X', email: email.toUpperCase(), password: 'another password' });
  assert.equal(dup.status, 409);
});

test('password rules and email validation', async () => {
  const r = await client()('POST', '/api/auth/signup', { name: 'X', email: 'not-an-email', password: 'short' });
  assert.equal(r.status, 400);
});

test('wrong password → 401 with a generic message; 5 failures lock the account', async () => {
  const { email } = await signedIn();
  const c = client();
  for (let i = 0; i < 5; i++) {
    const r = await c('POST', '/api/auth/login', { email, password: 'wrong password!' });
    assert.equal(r.status, 401);
    assert.equal(r.body.error.message, 'Incorrect email or password.');
  }
  const locked = await c('POST', '/api/auth/login', { email, password: 'correct horse battery' });
  assert.equal(locked.status, 429);
});

test('unknown email gets the same response as a wrong password', async () => {
  const r = await client()('POST', '/api/auth/login', { email: uniqueEmail(), password: 'whatever123' });
  assert.equal(r.status, 401);
  assert.equal(r.body.error.message, 'Incorrect email or password.');
});

test('refresh rotates the token; replaying an old token revokes the session family', async () => {
  const { c } = await signedIn();
  const oldRefresh = (await c('GET', '/api/auth/me')).jar.get('dd_rt');
  const r1 = await c('POST', '/api/auth/refresh');
  assert.equal(r1.status, 200);
  assert.notEqual(r1.jar.get('dd_rt'), oldRefresh);
  // Age the old token past the multi-tab grace window, then replay it.
  await query("UPDATE sessions SET revoked_at = now() - interval '5 minutes' WHERE revoke_reason = 'rotated'");
  // An attacker replays the stolen, already-rotated token.
  const replay = await fetch(`${base}/api/auth/refresh`, { method: 'POST', headers: { 'x-requested-with': 'datadrill', cookie: `dd_rt=${oldRefresh}` } });
  assert.equal(replay.status, 401);
  // The legitimate (newer) token is now revoked too.
  const r2 = await c('POST', '/api/auth/refresh');
  assert.equal(r2.status, 401);
});

test('two tabs refreshing at once both succeed (grace window)', async () => {
  const { c } = await signedIn();
  const rt = (await c('GET', '/api/auth/me')).jar.get('dd_rt');
  const send = () => fetch(`${base}/api/auth/refresh`, { method: 'POST', headers: { 'x-requested-with': 'datadrill', cookie: `dd_rt=${rt}` } });
  assert.equal((await send()).status, 200);
  assert.equal((await send()).status, 200); // second tab, same (now rotated) token
});

test('logout revokes the session immediately (no grace)', async () => {
  const { c } = await signedIn();
  const rt = (await c('GET', '/api/auth/me')).jar.get('dd_rt');
  assert.equal((await c('POST', '/api/auth/logout')).status, 204);
  const res = await fetch(`${base}/api/auth/refresh`, { method: 'POST', headers: { 'x-requested-with': 'datadrill', cookie: `dd_rt=${rt}` } });
  assert.equal(res.status, 401);
});

test('state-changing requests without the CSRF header are rejected', async () => {
  const r = await client()('POST', '/api/auth/login', { email: 'a@b.co', password: 'x' }, { csrf: false });
  assert.equal(r.status, 403);
});

test('forgot-password answers identically for unknown emails; reset flow works', async () => {
  const { email } = await signedIn();
  const known = await client()('POST', '/api/auth/forgot-password', { email });
  const unknown = await client()('POST', '/api/auth/forgot-password', { email: uniqueEmail() });
  assert.equal(known.status, 200);
  assert.deepEqual(known.body, unknown.body);
  // Simulate clicking the emailed link: plant a token we know.
  const token = crypto.randomBytes(32).toString('base64url');
  await query(
    `INSERT INTO password_resets (token_hash, user_id, expires_at)
     SELECT $1, id, now() + interval '10 minutes' FROM users WHERE lower(email) = $2`,
    [crypto.createHash('sha256').update(token).digest(), email]);
  const reset = await client()('POST', '/api/auth/reset-password', { token, password: 'brand new password' });
  assert.equal(reset.status, 200);
  const reuse = await client()('POST', '/api/auth/reset-password', { token, password: 'another new password' });
  assert.equal(reuse.status, 400);
  const login = await client()('POST', '/api/auth/login', { email, password: 'brand new password' });
  assert.equal(login.status, 200);
});

// ---- access control -------------------------------------------------------------

test('catalog and outlines are public; lesson content and problems need sign-in', async () => {
  const anon = client();
  assert.equal((await anon('GET', '/api/catalog')).status, 200);
  const course = await anon('GET', '/api/courses/pyspark');
  assert.equal(course.status, 200);
  assert.equal(course.body.course.modules.length, 12);
  assert.equal(course.body.course.modules[0].body, undefined);
  assert.equal((await anon('GET', '/api/courses/pyspark/modules/pyspark-joins')).status, 401);
  assert.equal((await anon('GET', '/api/problems/top-customers-by-region')).status, 401);
  const list = await anon('GET', '/api/problems?track=sql');
  assert.equal(list.status, 200);
  assert.equal(list.body.problems[0].description, undefined);

  const { c } = await signedIn();
  const mod = await c('GET', '/api/courses/pyspark/modules/pyspark-joins');
  assert.equal(mod.status, 200);
  assert.match(mod.body.body, /join/i);
});

test('problem detail never contains hidden tests or the unearned solution', async () => {
  const { c } = await signedIn();
  const r = await c('GET', '/api/problems/top-customers-by-region');
  assert.equal(r.status, 200);
  const raw = JSON.stringify(r.body);
  assert.equal(r.body.problem.examples.length, 3);
  assert.equal(r.body.problem.hiddenCount, 3);
  for (const hiddenName of ['Empty table', 'Single-customer region and a two-way tie', 'Many regions, decimals and zero revenue']) {
    assert.ok(!raw.includes(hiddenName), `hidden test leaked: ${hiddenName}`);
  }
  assert.equal(r.body.solution, null);
  assert.ok(!raw.includes('DENSE_RANK() OVER'), 'solution leaked');
});

test('learners cannot reach admin endpoints', async () => {
  const { c } = await signedIn();
  assert.equal((await c('GET', '/api/admin/overview')).status, 403);
  assert.equal((await client()('GET', '/api/admin/overview')).status, 401);
});

test('architecture handbook: served from the database, admins only', async () => {
  assert.equal((await client()('GET', '/api/docs/architecture')).status, 401);
  const { c, email } = await signedIn();
  assert.equal((await c('GET', '/api/docs/architecture')).status, 403);
  assert.deepEqual((await c('GET', '/api/docs')).body.docs, []);
  await query("UPDATE users SET role = 'admin' WHERE lower(email) = $1", [email]);
  await c('POST', '/api/auth/refresh'); // new access token carries the admin role
  const r = await c('GET', '/api/docs/architecture');
  assert.equal(r.status, 200);
  assert.match(r.body.doc.body, /Architecture & Design Handbook/);
  assert.equal((await c('GET', '/api/docs/nope')).status, 404);
});

test('module progress round-trips', async () => {
  const { c } = await signedIn();
  assert.equal((await c('PUT', '/api/progress/modules/pyspark-joins', { completed: true })).status, 200);
  assert.equal((await c('POST', '/api/progress/visits', { courseId: 'pyspark', moduleSlug: 'pyspark-joins' })).status, 200);
  const course = await c('GET', '/api/courses/pyspark');
  assert.deepEqual(course.body.progress, { completed: ['pyspark-joins'], lastVisited: 'pyspark-joins' });
  assert.equal((await c('PUT', '/api/progress/modules/no-such-module', { completed: true })).status, 404);
});

test('drafts save and come back', async () => {
  const { c } = await signedIn();
  assert.equal((await c('PUT', '/api/problems/dedupe-retried-events/draft', { code: 'def dedupe_events(e):\n    return e\n' })).status, 200);
  const r = await c('GET', '/api/problems/dedupe-retried-events');
  assert.equal(r.body.state.draft, 'def dedupe_events(e):\n    return e\n');
  assert.equal(r.body.state.status, 'todo');
});

// ---- submissions -----------------------------------------------------------------

test('submissions are idempotent and limited to 2 pending per user', async () => {
  const { c } = await signedIn();
  const token = crypto.randomUUID();
  const a = await c('POST', '/api/submissions', { problemId: 'top-customers-by-region', code: 'SELECT 1', clientToken: token });
  const b = await c('POST', '/api/submissions', { problemId: 'top-customers-by-region', code: 'SELECT 1', clientToken: token });
  assert.equal(a.status, 202);
  assert.equal(b.status, 200);
  assert.equal(a.body.submission.id, b.body.submission.id);
  await c('POST', '/api/submissions', { problemId: 'top-customers-by-region', code: 'SELECT 2', clientToken: crypto.randomUUID() });
  const third = await c('POST', '/api/submissions', { problemId: 'top-customers-by-region', code: 'SELECT 3', clientToken: crypto.randomUUID() });
  assert.equal(third.status, 429);
  // Another user can't read these submissions.
  const other = await signedIn();
  assert.equal((await other.c('GET', `/api/submissions/${a.body.submission.id}`)).status, 404);
  await query("DELETE FROM submissions WHERE status = 'queued'");
});

test('end to end: a real grader grades a submission, hides hidden-test data, unlocks the solution', { timeout: 120_000 }, async () => {
  const grader = spawn(process.execPath, [path.join('grader', 'index.js')], {
    cwd: SERVER_DIR,
    env: { ...process.env, NODE_ENV: 'test', GRADER_WARM_PYTHON: '0', GRADER_WARM_PYSPARK: '0', GRADER_WARM_SQL: '1', GRADER_POLL_MS: '300' },
    stdio: 'ignore',
  });
  try {
    const { c } = await signedIn();
    const wrong = await c('POST', '/api/submissions', {
      problemId: 'top-customers-by-region',
      code: "SELECT region, customer_id, SUM(amount) AS total_revenue, RANK() OVER (PARTITION BY region ORDER BY SUM(amount) DESC) AS revenue_rank FROM orders GROUP BY 1, 2 QUALIFY revenue_rank <= 2 ORDER BY 1, 4, 2",
      clientToken: crypto.randomUUID(),
    });
    const wrongDone = await waitFor(c, wrong.body.submission.id);
    assert.equal(wrongDone.verdict, 'Wrong Answer');
    for (const r of wrongDone.results.filter((x) => x.hidden)) {
      assert.equal(r.stdout, undefined);
      assert.equal(r.actual, undefined);
      assert.match(r.name, /^Hidden test \d$/);
    }

    const right = await c('POST', '/api/submissions', {
      problemId: 'top-customers-by-region',
      code: "SELECT region, customer_id, SUM(amount) AS total_revenue, DENSE_RANK() OVER (PARTITION BY region ORDER BY SUM(amount) DESC) AS revenue_rank FROM orders GROUP BY 1, 2 QUALIFY revenue_rank <= 2 ORDER BY 1, 4, 2",
      clientToken: crypto.randomUUID(),
    });
    const done = await waitFor(c, right.body.submission.id);
    assert.equal(done.verdict, 'Accepted');
    assert.equal(done.passed, 6);

    const detail = await c('GET', '/api/problems/top-customers-by-region');
    assert.equal(detail.body.state.status, 'solved');
    assert.ok(detail.body.solution?.solution.includes('DENSE_RANK'));

    // A SQL attempt to read files is blocked by the DuckDB lockdown.
    const sneaky = await c('POST', '/api/submissions', {
      problemId: 'top-customers-by-region', code: "SELECT * FROM read_csv('/etc/passwd')", clientToken: crypto.randomUUID(),
    });
    const blocked = await waitFor(c, sneaky.body.submission.id);
    assert.equal(blocked.verdict, 'Runtime Error');
  } finally {
    grader.kill('SIGTERM');
  }
});

async function waitFor(c, id) {
  for (let i = 0; i < 200; i++) {
    const r = await c('GET', `/api/submissions/${id}`);
    if (r.body.submission.status === 'done' || r.body.submission.status === 'failed') return r.body.submission;
    await new Promise((res) => setTimeout(res, 300));
  }
  throw new Error('submission never finished');
}

// ---- points, new tracks, profiles ---------------------------------------------------

function startGrader() {
  return spawn(process.execPath, [path.join('grader', 'index.js')], {
    cwd: SERVER_DIR,
    env: { ...process.env, NODE_ENV: 'test', GRADER_WARM_PYTHON: '0', GRADER_WARM_PYSPARK: '0', GRADER_WARM_PANDAS: '0',
      GRADER_WARM_SQL: '1', GRADER_WARM_SHELL: '1', GRADER_POLL_MS: '300' },
    stdio: 'ignore',
  });
}
const SQL_WRONG = 'SELECT 1 AS x';
const SQL_RIGHT = "SELECT region, customer_id, SUM(amount) AS total_revenue, DENSE_RANK() OVER (PARTITION BY region ORDER BY SUM(amount) DESC) AS revenue_rank FROM orders GROUP BY 1, 2 QUALIFY revenue_rank <= 2 ORDER BY 1, 4, 2";
async function submitAndWait(c, problemId, code) {
  const r = await c('POST', '/api/submissions', { problemId, code, clientToken: crypto.randomUUID() });
  assert.ok([200, 202].includes(r.status), `submit failed: ${r.status} ${JSON.stringify(r.body)}`);
  return waitFor(c, r.body.submission.id);
}

test('points: 100% / 50% / 0% by attempt, 0 after viewing the solution, awarded only once', { timeout: 180_000 }, async () => {
  const grader = startGrader();
  try {
    const P = 'top-customers-by-region'; // Medium → 20 base points
    // First try → 20
    const a = await signedIn();
    const s1 = await submitAndWait(a.c, P, SQL_RIGHT);
    assert.equal(s1.verdict, 'Accepted');
    assert.equal(s1.attemptNo, 1);
    assert.equal(s1.pointsAwarded, 20);
    // Solving again awards nothing more
    const again = await submitAndWait(a.c, P, SQL_RIGHT);
    assert.equal(again.pointsAwarded, 0);
    assert.equal((await a.c('GET', '/api/auth/me')).body.user.points, 20);

    // Second try → 10
    const b = await signedIn();
    assert.equal((await submitAndWait(b.c, P, SQL_WRONG)).verdict, 'Wrong Answer');
    const s2 = await submitAndWait(b.c, P, SQL_RIGHT);
    assert.equal(s2.attemptNo, 2);
    assert.equal(s2.pointsAwarded, 10);
    const detail = await b.c('GET', `/api/problems/${P}`);
    assert.equal(detail.body.state.points, 10);

    // Fourth try → 0
    const d = await signedIn();
    for (let i = 0; i < 3; i++) await submitAndWait(d.c, P, SQL_WRONG);
    const s4 = await submitAndWait(d.c, P, SQL_RIGHT);
    assert.equal(s4.attemptNo, 4);
    assert.equal(s4.pointsAwarded, 0);
    assert.equal((await d.c('GET', `/api/problems/${P}`)).body.state.status, 'solved');

    // Solution viewed before solving → 0
    const e = await signedIn();
    assert.equal((await e.c('POST', `/api/problems/${P}/reveal`)).status, 200);
    const sr = await submitAndWait(e.c, P, SQL_RIGHT);
    assert.equal(sr.verdict, 'Accepted');
    assert.equal(sr.pointsAwarded, 0);

    // Leaderboard and rank reflect points; ties share a rank
    const board = (await a.c('GET', '/api/leaderboard')).body.leaders;
    const me = (await a.c('GET', '/api/auth/me')).body.user;
    const mine = board.find((l) => l.username === me.username);
    assert.equal(mine.points, 20);
    const profile = await client()('GET', `/api/users/${me.username}/profile?tz=Asia/Kolkata`);
    assert.equal(profile.status, 200);
    assert.equal(profile.body.stats.points, 20);
    assert.equal(profile.body.stats.rank, mine.rank);
    assert.equal(profile.body.stats.solved.Medium, 1);
    assert.equal(profile.body.calendar.total, 2);           // two submissions today
    assert.equal(profile.body.calendar.currentStreak, 1);
    assert.equal(profile.body.pointsTimeline.at(-1).cumulative, 20);
    assert.ok(profile.body.badges.find((x) => x.id === 'first-try').earned);
    assert.ok(profile.body.skills.patterns.some((p) => p.name === 'Top-N per group'));
    assert.equal(profile.body.user.isMe, false);
    assert.deepEqual(profile.body.recentSubmissions, []);    // owner-only
    assert.ok(!JSON.stringify(profile.body).includes('@test.dev'), 'email leaked in public profile');
    const own = await a.c('GET', `/api/users/${me.username}/profile`);
    assert.equal(own.body.user.isMe, true);
    assert.equal(own.body.recentSubmissions.length, 2);
  } finally {
    grader.kill('SIGTERM');
  }
});

test('shell and pandas tracks grade end to end; shell scripts are sandboxed', { timeout: 180_000 }, async () => {
  const grader = startGrader();
  try {
    const { c } = await signedIn();
    const sh = await submitAndWait(c, 'top-error-clients',
      "grep -v '^#' access.log | awk 'NF && $5>=500 && $5<=599 {print $2}' | sort | uniq -c | sort -k1,1nr -k2,2 | awk '{print $2\",\"$1}'");
    assert.equal(sh.verdict, 'Accepted');
    assert.equal(sh.pointsAwarded, 10);
    const escape = await submitAndWait(c, 'top-error-clients', 'cat /etc/passwd; curl https://example.com; node -e 1; python3 -c 1');
    assert.notEqual(escape.verdict, 'Accepted');
    assert.ok(!JSON.stringify(escape.results).includes('root:'), 'host file leaked');

    const pd = await submitAndWait(c, 'revenue-by-country', `import pandas as pd
def solve(customers, orders):
    df = orders[orders["status"] != "cancelled"].merge(customers, on="customer_id")
    df["country"] = df["country"].fillna("Unknown")
    out = df.groupby("country", as_index=False).agg(customers=("customer_id", "nunique"), orders=("order_id", "count"), revenue=("amount", "sum"))
    out["revenue"] = out["revenue"].round(2)
    return out.sort_values(["revenue", "country"], ascending=[False, True])
`);
    assert.equal(pd.verdict, 'Accepted');
    assert.equal(pd.passed, 6);
  } finally {
    grader.kill('SIGTERM');
  }
});

test('DSA problems grade on the Python engine and lane, including ListNode drivers', { timeout: 180_000 }, async () => {
  const grader = startGrader();
  try {
    const { c } = await signedIn();
    const detail = await c('GET', '/api/problems/dsa-reverse-linked-list');
    assert.equal(detail.body.problem.track, 'dsa');
    assert.ok(detail.body.problem.starter.includes('class ListNode'), 'list prelude missing from the starter');
    const code = detail.body.problem.starter.replace('    # Write your solution here\n    pass\n', `    prev = None
    while head:
        head.next, prev, head = prev, head, head.next
    return prev
`);
    assert.notEqual(code, detail.body.problem.starter);
    const ok = await submitAndWait(c, 'dsa-reverse-linked-list', code);
    assert.equal(ok.verdict, 'Accepted');
    const wrong = await submitAndWait(c, 'dsa-pair-to-target', 'def pair_sum(nums, target):\n    return [0, 1]\n');
    assert.equal(wrong.verdict, 'Wrong Answer');
    const { rows } = await query("SELECT DISTINCT track FROM submissions WHERE problem_id LIKE 'dsa-%'");
    assert.deepEqual(rows.map((r) => r.track), ['python']);
  } finally {
    grader.kill('SIGTERM');
  }
});

test('profile settings: username rules and uniqueness; unknown profile is 404', async () => {
  const a = await signedIn();
  const b = await signedIn();
  const name = `u_${crypto.randomUUID().slice(0, 8)}`;
  assert.equal((await a.c('PATCH', '/api/auth/me', { username: name, headline: 'Data engineer' })).status, 200);
  assert.equal((await b.c('PATCH', '/api/auth/me', { username: name.toUpperCase() })).status, 409);
  assert.equal((await b.c('PATCH', '/api/auth/me', { username: 'no spaces!' })).status, 400);
  const prof = await client()('GET', `/api/users/${name}/profile`);
  assert.equal(prof.body.user.headline, 'Data engineer');
  assert.equal((await client()('GET', '/api/users/nobody_here_404/profile')).status, 404);
});

// ---- contests (docs §12) ------------------------------------------------------------

const { PROBLEMS } = await import('../content/problems/index.js');
const solutionOf = (id) => PROBLEMS.find((p) => p.id === id).solution;
async function contestSubmit(c, contestId, problemId, code) {
  const r = await c('POST', '/api/submissions', { problemId, code, contestId, clientToken: crypto.randomUUID() });
  assert.ok([200, 202].includes(r.status), `contest submit failed: ${r.status} ${JSON.stringify(r.body)}`);
  return waitFor(c, r.body.submission.id);
}
const groupSettings = { tracks: ['sql'], difficulties: ['Easy', 'Medium', 'Hard'], count: 2, minutes: 30, pool: 'unsolved' };

test('contest creation: validation, feasibility and solo contests start immediately', async () => {
  const { c } = await signedIn();
  const shellCount = PROBLEMS.filter((p) => p.track === 'shell').length;
  const tooMany = await c('POST', '/api/contests', { mode: 'solo', tracks: ['shell'], difficulties: ['Easy', 'Medium', 'Hard'], count: 8, minutes: 30, pool: 'both' });
  assert.equal(tooMany.status, 400);
  assert.match(tooMany.body.error.message, new RegExp(`Only ${shellCount} problems match`));
  assert.equal((await c('POST', '/api/contests', { ...groupSettings, mode: 'solo', topics: ['Not A Topic'] })).status, 400);
  assert.equal((await c('POST', '/api/contests', { ...groupSettings, mode: 'solo', invite: ['someone'] })).status, 400);

  const solo = await c('POST', '/api/contests', { ...groupSettings, mode: 'solo', topics: ['Gaps & Islands', 'Aggregation'], count: 2 });
  assert.equal(solo.status, 201);
  const view = await c('GET', `/api/contests/${solo.body.contest.code}`);
  assert.equal(view.body.contest.phase, 'live');
  assert.equal(view.body.problems.length, 2);
  assert.ok(view.body.problems.every((p) => p.id && p.track === 'sql'));
  // Easy → Hard order.
  const order = { Easy: 0, Medium: 1, Hard: 2 };
  assert.ok(order[view.body.problems[0].difficulty] <= order[view.body.problems[1].difficulty]);
  assert.equal(view.body.standings.length, 1);
  assert.ok(new Date(view.body.contest.endsAt) - new Date(view.body.contest.startedAt) === 30 * 60_000);
});

test('group contest end to end: invites, lobby, live standings with penalties, guards, results, profile', { timeout: 240_000 }, async () => {
  const host = await signedIn();
  const friend = await signedIn();   // invited by username, never joins
  const guest = await signedIn();    // joins with the link (the code is the invite)
  const outsider = await signedIn();

  const created = await host.c('POST', '/api/contests', { ...groupSettings, mode: 'group', title: 'Friday SQL', invite: [friend.user.username] });
  assert.equal(created.status, 201);
  const code = created.body.contest.code;

  // The invitation shows up for the friend.
  assert.equal((await friend.c('GET', '/api/contests/inbox')).body.invitations, 1);
  assert.equal((await friend.c('GET', '/api/contests')).body.invitations[0].code, code);
  // Username search finds people to invite.
  const found = await host.c('GET', `/api/users/search?q=${guest.user.username}`);
  assert.ok(found.body.users.some((u) => u.username === guest.user.username));

  // Lobby: no problems yet; guest joins via the code; only the host may invite/start.
  const lobby = await guest.c('GET', `/api/contests/${code}`);
  assert.equal(lobby.body.contest.phase, 'lobby');
  assert.equal(lobby.body.problems.length, 0);
  assert.equal((await guest.c('POST', `/api/contests/${code}/join`)).status, 200);
  assert.equal((await guest.c('POST', `/api/contests/${code}/start`)).status, 403);
  assert.equal((await host.c('POST', `/api/contests/${code}/invite`, { usernames: ['nobody_by_that_name'] })).status, 400);
  assert.equal((await host.c('POST', `/api/contests/${code}/start`)).status, 200);
  assert.equal((await outsider.c('POST', `/api/contests/${code}/join`)).status, 409); // too late

  const live = (await host.c('GET', `/api/contests/${code}`)).body;
  assert.equal(live.contest.phase, 'live');
  assert.equal(live.standings.length, 2);                       // the friend never joined
  const [p1] = live.problems;
  // Non-players see the board but not which problems are in it while it runs.
  const peek = (await friend.c('GET', `/api/contests/${code}`)).body;
  assert.equal(peek.me, null);
  assert.equal(peek.problems[0].id, undefined);

  // Live updates: the stream answers with an initial "update" event.
  const ctl = new AbortController();
  const jar = (await host.c('GET', '/api/auth/me')).jar;
  const stream = await fetch(`${base}/api/contests/${code}/events`, { headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') }, signal: ctl.signal });
  assert.equal(stream.headers.get('content-type'), 'text/event-stream; charset=utf-8');
  const reader = stream.body.getReader();
  let first = '';
  while (!first.includes('event: update')) first += new TextDecoder().decode((await reader.read()).value);
  ctl.abort();

  // During the contest: practice submit and reveal are refused, the solution is hidden.
  const practice = await host.c('POST', '/api/submissions', { problemId: p1.id, code: 'SELECT 1', clientToken: crypto.randomUUID() });
  assert.equal(practice.status, 409);
  assert.equal((await host.c('POST', `/api/problems/${p1.id}/reveal`)).status, 409);
  const detail = (await host.c('GET', `/api/problems/${p1.id}`)).body;
  assert.equal(detail.solution, null);
  assert.equal(detail.state.liveContest, code);
  // Outsiders can't submit into it.
  const intruder = await outsider.c('POST', '/api/submissions', { problemId: p1.id, code: 'SELECT 1', contestId: live.contest.id, clientToken: crypto.randomUUID() });
  assert.equal(intruder.status, 404);

  const grader = startGrader();
  try {
    // Host: wrong, then right → solved with one 5-minute penalty. Guest: right first time.
    assert.equal((await contestSubmit(host.c, live.contest.id, p1.id, 'SELECT 1 AS x')).verdict, 'Wrong Answer');
    assert.equal((await contestSubmit(host.c, live.contest.id, p1.id, solutionOf(p1.id))).verdict, 'Accepted');
    assert.equal((await contestSubmit(guest.c, live.contest.id, p1.id, solutionOf(p1.id))).verdict, 'Accepted');
  } finally {
    grader.kill('SIGTERM');
  }

  const board = (await guest.c('GET', `/api/contests/${code}`)).body.standings;
  const me = (u) => board.find((r) => r.username === u.user.username);
  assert.equal(me(guest).rank, 1);
  assert.equal(me(host).rank, 2);
  assert.equal(me(host).score, p1.points);
  assert.equal(me(host).cells[0].wrong, 1);
  assert.ok(me(host).finishMs >= 5 * 60_000);
  assert.ok(me(guest).finishMs < 5 * 60_000);
  // A contest solve also counts in practice: solved + points (2nd attempt → 50%).
  const hostProblem = (await host.c('GET', `/api/problems/${p1.id}`)).body.state;
  assert.equal(hostProblem.status, 'solved');
  assert.equal(hostProblem.points, Math.round(p1.points * 0.5));
  // Contest submissions list (per problem, mine only).
  assert.equal((await host.c('GET', `/api/contests/${code}/submissions?problem=${p1.id}`)).body.submissions.length, 2);

  // The host ends it: no more contest submissions; practice opens again.
  assert.equal((await guest.c('POST', `/api/contests/${code}/end`)).status, 403);
  assert.equal((await host.c('POST', `/api/contests/${code}/end`)).status, 200);
  const ended = (await friend.c('GET', `/api/contests/${code}`)).body;
  assert.equal(ended.contest.phase, 'ended');
  assert.ok(ended.problems[0].id, 'problems are public after the end');
  const late = await guest.c('POST', '/api/submissions', { problemId: p1.id, code: 'SELECT 1', contestId: live.contest.id, clientToken: crypto.randomUUID() });
  assert.equal(late.status, 409);
  const reopened = await host.c('POST', '/api/submissions', { problemId: live.problems[1].id, code: 'SELECT 1', clientToken: crypto.randomUUID() });
  assert.equal(reopened.status, 202);

  // Contest history on the public profile.
  const prof = (await client()('GET', `/api/users/${host.user.username}/profile`)).body.contests;
  assert.equal(prof.played, 1);
  assert.equal(prof.recent[0].rank, 2);
  assert.equal(prof.recent[0].players, 2);
  assert.equal(prof.score, p1.points);
});

// ---- problem bank (docs §8.12) ---------------------------------------------------------

test('every problem is served with complete tags, sourced company tags and no hidden-test leaks', async () => {
  const { c } = await signedIn();
  for (const track of ['sql', 'python', 'pyspark', 'pandas', 'shell']) {
    const list = await c('GET', `/api/problems?track=${track}`);
    assert.equal(list.status, 200);
    const fromContent = PROBLEMS.filter((p) => p.track === track);
    assert.equal(list.body.problems.length, fromContent.length, `${track}: every problem published`);
    for (const p of fromContent) {
      const row = list.body.problems.find((x) => x.id === p.id);
      assert.ok(row.topics.length && row.patterns.length && row.domains.length, `${p.id}: tags in the list`);
      assert.deepEqual(row.companies, p.companies);
      const { body } = await c('GET', `/api/problems/${p.id}`);
      const visible = p.tests.filter((t) => !t.hidden);
      assert.equal(body.problem.examples.length, visible.length, `${p.id}: only visible examples are sent`);
      assert.equal(body.problem.hiddenCount, p.tests.length - visible.length);
      for (const company of body.problem.companies) {
        assert.ok(body.problem.sources.some((s) => s.company === company && s.url.startsWith('https://')), `${p.id}: ${company} has a source`);
      }
      const raw = JSON.stringify(body);
      for (const t of p.tests.filter((x) => x.hidden)) assert.ok(!raw.includes(`"${t.name}"`), `${p.id}: hidden test "${t.name}" leaked`);
      assert.equal(body.solution, null, `${p.id}: unearned solution never sent`);
    }
  }
});

// ---- contest error handling (docs §12.7) -----------------------------------------------

test('contest validation: every bad input gets a specific, human message (never "Required" or a 500)', async () => {
  const { c } = await signedIn();
  const ok = { mode: 'solo', tracks: ['sql'], difficulties: ['Easy'], count: 1, minutes: 30, pool: 'both' };
  const omit = (k) => Object.fromEntries(Object.entries(ok).filter(([key]) => key !== k));
  const cases = [
    [{}, 400, /Choose Solo or With friends|Pick at least one track/],
    [omit('tracks'), 400, /Pick at least one track/],
    [{ ...ok, tracks: [] }, 400, /Pick at least one track/],
    [{ ...ok, tracks: ['cobol'] }, 400, /Tracks \(each item\) must be one of: sql, python, dsa, pyspark, pandas, shell/],
    [omit('difficulties'), 400, /Pick at least one difficulty/],
    [{ ...ok, difficulties: ['Impossible'] }, 400, /Difficulty \(each item\) must be one of: Easy, Medium, Hard/],
    [omit('count'), 400, /Choose how many questions/],
    [{ ...ok, count: 0 }, 400, /at least 1 question/],
    [{ ...ok, count: 99 }, 400, /at most 8 questions/],
    [{ ...ok, count: '3' }, 400, /Number of questions must be a number/],
    [{ ...ok, count: 2.5 }, 400, /Number of questions must be a whole number/],
    [omit('minutes'), 400, /Choose a duration/],
    [{ ...ok, minutes: 1 }, 400, /at least 5 minutes/],
    [{ ...ok, minutes: 999 }, 400, /at most 180 minutes/],
    [omit('pool'), 400, /Choose which problems to draw/],
    [{ ...ok, pool: 'x' }, 400, /Problem pool must be one of: unsolved, solved, both/],
    [{ ...ok, mode: 'team' }, 400, /Contest type must be one of: solo, group/],
    [{ ...ok, title: 'x'.repeat(200) }, 400, /Title must be at most 80 characters/],
    [{ ...ok, topics: 'Joins' }, 400, /Topics must be a list/],
    [{ ...ok, topics: ['Nope'] }, 400, /Unknown topic for the chosen tracks: Nope/],
    [{ ...ok, invite: ['someone'] }, 400, /solo contest has no invitations/],
    [{ ...ok, mode: 'group', invite: ['bad name!'] }, 400, /Usernames are 3–24 letters/],
    [{ ...ok, mode: 'group', invite: ['nobody_called_this'] }, 400, /No user with username @nobody_called_this/],
    [{ ...ok, tracks: ['pandas'], difficulties: ['Hard'], count: 8 }, 400, /Only 1 problem match/],
  ];
  for (const [body, status, message] of cases) {
    const r = await c('POST', '/api/contests', body);
    assert.equal(r.status, status, `${JSON.stringify(body)} → ${r.status} ${r.body?.error?.message}`);
    assert.match(r.body.error.message, message, JSON.stringify(body));
  }
  // Many failed attempts don't use up the creation quota.
  assert.equal((await c('POST', '/api/contests', ok)).status, 201);
  // Malformed bodies.
  const raw = await fetch(`${base}/api/contests`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-requested-with': 'datadrill', cookie: [...(await c('GET', '/api/auth/me')).jar].map(([k, v]) => `${k}=${v}`).join('; ') }, body: '{oops' });
  assert.equal(raw.status, 400);
  assert.match((await raw.json()).error.message, /Malformed JSON/);
  assert.match((await c('POST', '/api/contests', [])).body.error.message, /must be a JSON object/);
});

test('contest lifecycle misuse is refused with a clear reason', async () => {
  const host = await signedIn();
  const other = await signedIn();
  const group = { mode: 'group', tracks: ['sql'], difficulties: ['Easy', 'Medium', 'Hard'], count: 1, minutes: 30, pool: 'both' };
  const { code } = (await host.c('POST', '/api/contests', group)).body.contest;
  const expect = async (who, method, url, body, status, message) => {
    const r = await who.c(method, url, body);
    assert.equal(r.status, status, `${method} ${url} → ${r.status} ${r.body?.error?.message}`);
    if (message) assert.match(r.body.error.message, message);
  };
  await expect(host, 'GET', '/api/contests/not-a-code', undefined, 404, /Contest not found/);
  await expect(host, 'POST', '/api/contests/zzzzzzzz/join', undefined, 404, /Contest not found/);
  await expect(other, 'POST', `/api/contests/${code}/decline`, undefined, 409, /don't have a pending invitation/);
  await expect(other, 'POST', `/api/contests/${code}/leave`, undefined, 409, /haven't joined/);
  await expect(host, 'POST', `/api/contests/${code}/leave`, undefined, 400, /You are the host/);
  await expect(other, 'POST', `/api/contests/${code}/start`, undefined, 403, /Only the host/);
  await expect(other, 'POST', `/api/contests/${code}/invite`, { usernames: [host.user.username] }, 403, /Only the host/);
  await expect(host, 'POST', `/api/contests/${code}/invite`, {}, 400, /Add at least one username/);
  await expect(host, 'POST', `/api/contests/${code}/end`, undefined, 409, /not running/);
  await expect(host, 'GET', `/api/contests/${code}/submissions`, undefined, 400, /Problem is required/);
  await expect(host, 'POST', `/api/contests/${code}/start`, undefined, 200);
  await expect(host, 'POST', `/api/contests/${code}/start`, undefined, 409, /already started/);
  await expect(host, 'POST', `/api/contests/${code}/cancel`, undefined, 409, /end it instead/);
  await expect(other, 'POST', `/api/contests/${code}/join`, undefined, 409, /already started/);
  await expect(host, 'POST', `/api/contests/${code}/invite`, { usernames: [other.user.username] }, 409, /close when the contest starts/);
  await expect(host, 'POST', '/api/submissions', { problemId: 'daily-active-users', code: 'select 1', clientToken: 'nope', contestId: crypto.randomUUID() }, 400, /Request id is not a valid id/);
  await expect(host, 'POST', '/api/submissions', { problemId: 'daily-active-users', code: '', clientToken: crypto.randomUUID() }, 400, /Write some code first/);
  await expect(host, 'POST', `/api/contests/${code}/end`, undefined, 200);
  await expect(host, 'POST', `/api/contests/${code}/end`, undefined, 409, /not running/);
});

test('hints are withheld during a contest and come back after it', async () => {
  const { c } = await signedIn();
  const { code } = (await c('POST', '/api/contests', { mode: 'solo', tracks: ['shell'], difficulties: ['Easy', 'Medium', 'Hard'], count: 1, minutes: 30, pool: 'both' })).body.contest;
  const [p] = (await c('GET', `/api/contests/${code}`)).body.problems;
  const during = (await c('GET', `/api/problems/${p.id}`)).body.problem;
  assert.deepEqual(during.hints, []);
  assert.equal(during.hintsHidden, true);
  await c('POST', `/api/contests/${code}/end`);
  const after = (await c('GET', `/api/problems/${p.id}`)).body.problem;
  assert.ok(after.hints.length > 0);
  assert.equal(after.hintsHidden, undefined);
});

// ---- interview prep (docs §8.14) -------------------------------------------------------

test('interview prep: case studies with ordered parts, interview questions, case-study pages', async () => {
  const { CASE_STUDIES } = await import('../content/problems/index.js');
  const anon = client();
  const r = await anon('GET', '/api/interview');
  assert.equal(r.status, 200);
  assert.ok(r.body.roles.includes('Data Engineer'));
  assert.equal(r.body.caseStudies.length, CASE_STUDIES.length);
  for (const cs of r.body.caseStudies) {
    assert.ok(cs.parts.length >= 2);
    assert.deepEqual(cs.parts.map((p) => p.part), cs.parts.map((_, i) => i + 1), `${cs.id}: parts in order`);
    // Difficulty never goes down from one part to the next.
    const rank = { Easy: 0, Medium: 1, Hard: 2 };
    cs.parts.slice(1).forEach((p, i) => assert.ok(rank[p.difficulty] >= rank[cs.parts[i].difficulty], `${cs.id}: difficulty ladder`));
  }
  const expected = PROBLEMS.filter((p) => p.interview && !p.caseStudy).length;
  assert.equal(r.body.problems.length, expected);
  assert.ok(r.body.problems.every((p) => p.roles.length && p.status === 'todo'));

  const cs = await anon('GET', `/api/case-studies/${r.body.caseStudies[0].id}`);
  assert.equal(cs.status, 200);
  assert.ok(cs.body.caseStudy.brief.length > 100);
  assert.equal((await anon('GET', '/api/case-studies/no-such-case')).status, 404);

  // A part's detail carries its case study, interview flag and roles.
  const { c } = await signedIn();
  const part = r.body.caseStudies[0].parts[1];
  const detail = (await c('GET', `/api/problems/${part.id}`)).body.problem;
  assert.deepEqual(detail.caseStudy, { id: r.body.caseStudies[0].id, part: 2 });
  assert.equal(detail.interview, true);
  assert.ok(detail.roles.length > 0);
});
