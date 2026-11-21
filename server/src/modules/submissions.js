// ---------------------------------------------------------------------------
// Submissions — the API half of grading. The API never runs code; it
// validates, records the submission (which IS the queue entry) and returns
// 202 immediately. A separate grader process picks it up (grader/index.js).
//
//   POST /api/submissions                {problemId, code, clientToken, contestId?} → 202 {id}
//   GET  /api/submissions/:id            poll status / result (owner only)
//   GET  /api/problems/:id/submissions   your recent submissions
//
// Overload protection, in order:
//   1. idempotency  — a retried POST (double click, network retry) with the
//                     same clientToken returns the original submission;
//   (contest rules)   — a contestId submission must be by a player, for one of
//                       the contest's problems, before the deadline (checked
//                       under a share lock on the contest row, so it can't race
//                       the host ending the contest); a practice submission for
//                       a problem in your running contest is refused (§12.6);
//   2. fairness     — max N queued/running per user ("wait for your last one");
//   3. rate limit   — max M per user per minute, counted in Postgres so it
//                     holds across every API process;
//   4. backpressure — if the global queue is too deep, 503 + Retry-After
//                     instead of accepting work we can't finish soon.
// ---------------------------------------------------------------------------
import express from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { query, tx } from '../db.js';
import { handle, notFound, tooMany, unavailable, badRequest, conflict } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { getProblem } from '../content/store.js';
import { createCache } from '../lib/cache.js';
import { liveContestFor } from '../contests/guards.js';
import { refreshStandings } from '../contests/standings.js';
import { engineOf } from '../../../shared/grader/runtime.js';

export const submissionsRouter = express.Router();

// Queue depth is checked on every submit; caching it for 1s turns N checks per
// second into one query per second per process.
const queueCache = createCache({ maxEntries: 1 });
const queueDepth = () => queueCache.getOrLoad('depth', 1000, async () =>
  (await query("SELECT count(*) AS n FROM submissions WHERE status = 'queued'")).rows[0].n);

export const publicSubmission = (s, { withCode = false } = {}) => ({
  id: s.id,
  problemId: s.problem_id,
  contestId: s.contest_id ?? null,
  status: s.status,
  verdict: s.verdict,
  passed: s.passed,
  total: s.total,
  runtimeMs: s.runtime_ms,
  attemptNo: s.attempt_no,
  pointsAwarded: s.points_awarded,
  results: s.results,
  createdAt: s.created_at,
  finishedAt: s.finished_at,
  ...(withCode ? { code: s.code } : {}),
});

submissionsRouter.post('/submissions', requireAuth, handle(async (req, res) => {
  const body = z.object({
    problemId: z.string().min(1).max(100),
    code: z.string().min(1, 'Write some code first.').max(config.submissions.maxCodeBytes, 'Code is too long.'),
    clientToken: z.string().uuid(),
    contestId: z.string().uuid().optional(),
  }).parse(req.body);
  const userId = req.user.id;

  // 1. Idempotency: same token → same submission.
  const existing = await query('SELECT * FROM submissions WHERE user_id = $1 AND client_token = $2', [userId, body.clientToken]);
  if (existing.rows[0]) return res.status(200).json({ submission: publicSubmission(existing.rows[0]) });

  const data = await getProblem(body.problemId);
  if (!data) throw notFound('Problem not found.');
  // The submission's track is its grader lane: DSA grades in the Python lane.
  const lane = engineOf(data.problem.track);
  if (!['sql', 'python', 'pyspark', 'pandas', 'shell'].includes(lane)) throw badRequest('This problem is not graded by code.');
  if (!body.contestId) {
    const live = await liveContestFor({ query }, userId, body.problemId);
    if (live) throw conflict('This problem is in a contest you are playing — submit it from the contest page so it counts.');
  }

  // 2 + 3. Fairness and rate limit, in one round trip.
  const { rows: [usage] } = await query(
    `SELECT count(*) FILTER (WHERE status IN ('queued', 'running')) AS pending,
            count(*) FILTER (WHERE created_at > now() - interval '1 minute') AS last_minute
     FROM submissions WHERE user_id = $1 AND (status IN ('queued', 'running') OR created_at > now() - interval '1 minute')`,
    [userId]);
  if (usage.pending >= config.submissions.maxPendingPerUser) {
    throw tooMany('Your previous submission is still being graded — wait for it to finish.', 3);
  }
  if (usage.last_minute >= config.submissions.perUserPerMinute) {
    throw tooMany(`You can submit ${config.submissions.perUserPerMinute} times per minute — take a breath and try again shortly.`, 20);
  }

  // 4. Backpressure.
  if ((await queueDepth()) >= config.submissions.maxQueueDepth) {
    throw unavailable('Grading is very busy right now — please submit again in a few seconds.', 10);
  }

  // Insert + notify in one transaction: the grader is woken only once the row
  // is committed and visible. ON CONFLICT covers two identical POSTs racing.
  const submission = await tx(async (db) => {
    if (body.contestId) {
      const { rows: [c] } = await db.query(
        `SELECT c.id, c.ends_at > now() AS open FROM contests c
         JOIN contest_participants cp ON cp.contest_id = c.id AND cp.user_id = $2 AND cp.state = 'joined'
         JOIN contest_problems pr ON pr.contest_id = c.id AND pr.problem_id = $3
         WHERE c.id = $1 AND c.status = 'live'
         FOR SHARE OF c`, [body.contestId, userId, body.problemId]);
      if (!c) throw notFound("That problem isn't part of a contest you are playing.");
      if (!c.open) throw conflict('Time is up — this contest has ended.');
    }
    const { rows } = await db.query(
      `INSERT INTO submissions (user_id, problem_id, problem_version, code, client_token, track, contest_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, client_token) DO NOTHING RETURNING *`,
      [userId, body.problemId, data.problem.version, body.code, body.clientToken, lane, body.contestId ?? null]);
    if (!rows[0]) return null;
    // Contest code doesn't overwrite your practice draft.
    const draft = body.contestId ? null : body.code;
    await db.query(
      `INSERT INTO user_problems (user_id, problem_id, status, draft_code, draft_updated_at)
       VALUES ($1, $2, 'attempted', $3, CASE WHEN $3::text IS NULL THEN NULL ELSE now() END)
       ON CONFLICT (user_id, problem_id) DO UPDATE SET
         status = CASE WHEN user_problems.status = 'solved' THEN 'solved' ELSE 'attempted' END,
         draft_code = coalesce($3, user_problems.draft_code),
         draft_updated_at = CASE WHEN $3::text IS NULL THEN user_problems.draft_updated_at ELSE now() END,
         updated_at = now()`,
      [userId, body.problemId, draft]);
    // The board shows "grading…" for this player right away.
    if (body.contestId) await refreshStandings(db, body.contestId);
    // Payload = track, so the grader wakes only that lane.
    await db.query("SELECT pg_notify('submission_queued', $1)", [lane]);
    return rows[0];
  });
  if (!submission) {
    const again = await query('SELECT * FROM submissions WHERE user_id = $1 AND client_token = $2', [userId, body.clientToken]);
    return res.status(200).json({ submission: publicSubmission(again.rows[0]) });
  }
  res.status(202).json({ submission: publicSubmission(submission) });
}));

submissionsRouter.get('/submissions/:id', requireAuth, handle(async (req, res) => {
  if (!z.string().uuid().safeParse(req.params.id).success) throw notFound('Submission not found.');
  const { rows: [s] } = await query('SELECT * FROM submissions WHERE id = $1', [req.params.id]);
  // Someone else's submission looks exactly like a missing one (no id probing).
  if (!s || (s.user_id !== req.user.id && req.user.role !== 'admin')) throw notFound('Submission not found.');
  let queuePosition = null;
  if (s.status === 'queued') {
    const { rows: [q] } = await query(
      "SELECT count(*) AS ahead FROM submissions WHERE status = 'queued' AND track = $2 AND created_at < $1", [s.created_at, s.track]);
    queuePosition = q.ahead + 1;
  }
  res.json({ submission: { ...publicSubmission(s), queuePosition } });
}));

submissionsRouter.get('/problems/:id/submissions', requireAuth, handle(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM submissions WHERE user_id = $1 AND problem_id = $2
     ORDER BY created_at DESC LIMIT 20`, [req.user.id, req.params.id]);
  res.json({ submissions: rows.map((s) => publicSubmission(s, { withCode: true })) });
}));
