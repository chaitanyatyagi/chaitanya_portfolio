// ---------------------------------------------------------------------------
// Practice API.
//   Public:     GET /api/tracks, /api/tracks/:id, /api/problems?track=
//               (list metadata; per-user status merged in when signed in)
//   Signed in:  GET  /api/problems/:id            statement, visible examples,
//                                                 starter, your draft & status
//               PUT  /api/problems/:id/draft      save code (debounced client-side)
//               POST /api/problems/:id/reveal     unlock the reference solution
//               GET  /api/practice/summary        solved counts + resume target
//
// Hidden tests never appear in any response from this router.
// ---------------------------------------------------------------------------
import express from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { query } from '../db.js';
import { handle, notFound, badRequest, conflict } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { liveContestFor } from '../contests/guards.js';
import { getCatalog, getTrack, getProblemList, getProblem, getProblemStats } from '../content/store.js';

export const practiceRouter = express.Router();

practiceRouter.get('/tracks', handle(async (_req, res) => {
  res.json({ tracks: (await getCatalog()).tracks });
}));

practiceRouter.get('/tracks/:id', handle(async (req, res) => {
  const track = await getTrack(req.params.id);
  if (!track) throw notFound('Track not found.');
  res.json({ track });
}));

practiceRouter.get('/problems', handle(async (req, res) => {
  const track = String(req.query.track || '');
  if (!track) throw badRequest('track is required.');
  const problems = await getProblemList(track);
  let status = {};
  if (req.user && problems.length) {
    const { rows } = await query(
      'SELECT problem_id, status FROM user_problems WHERE user_id = $1 AND problem_id = ANY($2)',
      [req.user.id, problems.map((p) => p.id)]);
    status = Object.fromEntries(rows.map((r) => [r.problem_id, r.status]));
  }
  const stats = await getProblemStats();
  res.json({ problems: problems.map((p) => ({ ...p, status: status[p.id] || 'todo', stats: stats[p.id] || null })) });
}));

practiceRouter.get('/problems/:id', requireAuth, handle(async (req, res) => {
  const data = await getProblem(req.params.id);
  if (!data) throw notFound('Problem not found.');
  const [{ rows: [state] }, { rows: [tries] }, stats] = await Promise.all([
    query(
      'SELECT status, draft_code, solved_at, revealed_at, submissions_count, points FROM user_problems WHERE user_id = $1 AND problem_id = $2',
      [req.user.id, req.params.id]),
    // Attempts so far — tells the learner what the next Accepted would be worth.
    query(
      `SELECT count(*) AS n FROM submissions WHERE user_id = $1 AND problem_id = $2
       AND status <> 'failed' AND coalesce(verdict, '') <> 'Internal Error'`, [req.user.id, req.params.id]),
    getProblemStats(),
  ]);
  // During a contest that includes this problem, its solution stays hidden
  // (even one you unlocked earlier) and Submit belongs to the contest (§12.6).
  const contestCode = await liveContestFor({ query }, req.user.id, req.params.id);
  const unlocked = !contestCode && Boolean(state?.solved_at || state?.revealed_at);
  res.json({
    // In a running contest: no hints either (they're part of the challenge).
    problem: { ...data.problem, stats: stats[req.params.id] || null, ...(contestCode ? { hints: [], hintsHidden: true } : {}) },
    state: {
      status: state?.status || 'todo',
      draft: state?.draft_code ?? null,
      submissions: state?.submissions_count || 0,
      attempts: tries.n,
      points: state?.points || 0,
      revealed: Boolean(state?.revealed_at),
      solutionUnlocked: unlocked,
      liveContest: contestCode,
    },
    solution: unlocked ? data.solution : null,
  });
}));

practiceRouter.put('/problems/:id/draft', requireAuth, handle(async (req, res) => {
  const { code } = z.object({ code: z.string().max(config.submissions.maxCodeBytes, 'Code is too long.') }).parse(req.body);
  const r = await query(
    `INSERT INTO user_problems (user_id, problem_id, draft_code, draft_updated_at)
     SELECT $1, id, $3, now() FROM problems WHERE id = $2
     ON CONFLICT (user_id, problem_id) DO UPDATE SET draft_code = $3, draft_updated_at = now(), updated_at = now()`,
    [req.user.id, req.params.id, code]);
  if (!r.rowCount) throw notFound('Problem not found.');
  res.json({ ok: true });
}));

practiceRouter.post('/problems/:id/reveal', requireAuth, handle(async (req, res) => {
  const data = await getProblem(req.params.id);
  if (!data) throw notFound('Problem not found.');
  if (await liveContestFor({ query }, req.user.id, req.params.id)) {
    throw conflict('This problem is in a contest you are playing — solutions open when the contest ends.');
  }
  await query(
    `INSERT INTO user_problems (user_id, problem_id, revealed_at) VALUES ($1, $2, now())
     ON CONFLICT (user_id, problem_id) DO UPDATE SET revealed_at = coalesce(user_problems.revealed_at, now()), updated_at = now()`,
    [req.user.id, req.params.id]);
  res.json({ solution: data.solution });
}));

practiceRouter.get('/practice/summary', requireAuth, handle(async (req, res) => {
  const [counts, resume] = await Promise.all([
    query(`SELECT p.difficulty, p.track_id, up.status, count(*) AS n FROM user_problems up
           JOIN problems p ON p.id = up.problem_id
           WHERE up.user_id = $1 AND up.status <> 'todo' GROUP BY p.difficulty, p.track_id, up.status`, [req.user.id]),
    query(`SELECT p.id, p.track_id AS track, p.title, p.difficulty FROM user_problems up
           JOIN problems p ON p.id = up.problem_id
           WHERE up.user_id = $1 AND up.status = 'attempted'
           ORDER BY up.updated_at DESC LIMIT 1`, [req.user.id]),
  ]);
  const solved = { Easy: 0, Medium: 0, Hard: 0 };
  const byTrack = {};
  let attempted = 0;
  for (const r of counts.rows) {
    if (r.status === 'solved') {
      solved[r.difficulty] += r.n;
      byTrack[r.track_id] = (byTrack[r.track_id] || 0) + r.n;
    } else attempted += r.n;
  }
  res.json({ solved, solvedTotal: solved.Easy + solved.Medium + solved.Hard, solvedByTrack: byTrack, attempted, resume: resume.rows[0] || null });
}));
