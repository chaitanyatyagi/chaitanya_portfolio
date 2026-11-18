// ---------------------------------------------------------------------------
// /api/admin — role 'admin' only. Promote a user with `npm run make-admin`.
//
//   GET   /overview                 users, queue depth, verdicts (last 24h)
//   GET   /users?q=                 find users
//   PATCH /users/:id                {role}
//   PUT   /problems/:id             create/update a problem incl. tests
//   PUT   /courses/:id              create/update course metadata + modules
//   GET   /submissions?status=      inspect the queue (e.g. failed jobs)
//   POST  /submissions/:id/requeue  retry a failed job
//
// Content writes run in a transaction and end with NOTIFY content_changed,
// which makes every API process drop its content cache immediately.
// ---------------------------------------------------------------------------
import express from 'express';
import { z } from 'zod';
import { query, tx } from '../db.js';
import { handle, notFound, badRequest } from '../lib/errors.js';
import { requireRole } from '../middleware/auth.js';
import { upsertProblem, upsertCourse, upsertModule, notifyContentChanged } from '../content/store.js';

export const adminRouter = express.Router();
adminRouter.use(requireRole('admin'));

adminRouter.get('/overview', handle(async (_req, res) => {
  const [users, queue, verdicts] = await Promise.all([
    query("SELECT count(*) AS total, count(*) FILTER (WHERE created_at > now() - interval '24 hours') AS new_24h FROM users"),
    query('SELECT status, count(*) AS n FROM submissions GROUP BY status'),
    query(`SELECT verdict, count(*) AS n FROM submissions
           WHERE finished_at > now() - interval '24 hours' GROUP BY verdict`),
  ]);
  res.json({
    users: users.rows[0],
    queue: Object.fromEntries(queue.rows.map((r) => [r.status, r.n])),
    verdicts24h: Object.fromEntries(verdicts.rows.map((r) => [r.verdict || 'none', r.n])),
  });
}));

adminRouter.get('/users', handle(async (req, res) => {
  const q = `%${String(req.query.q || '').toLowerCase()}%`;
  const { rows } = await query(
    `SELECT id, email, name, role, created_at FROM users
     WHERE lower(email) LIKE $1 OR lower(name) LIKE $1 ORDER BY created_at DESC LIMIT 50`, [q]);
  res.json({ users: rows });
}));

adminRouter.patch('/users/:id', handle(async (req, res) => {
  const { role } = z.object({ role: z.enum(['learner', 'admin']) }).parse(req.body);
  if (req.params.id === req.user.id && role !== 'admin') throw badRequest("You can't remove your own admin role.");
  const { rows: [u] } = await query('UPDATE users SET role = $2, updated_at = now() WHERE id = $1 RETURNING id, email, role', [req.params.id, role]);
  if (!u) throw notFound('User not found.');
  // Takes effect on the user's next access-token refresh (≤ 15 minutes).
  res.json({ user: u });
}));

const tableSchema = z.array(z.object({ name: z.string(), columns: z.array(z.tuple([z.string(), z.string(), z.string().optional()])) }));
const problemSchema = z.object({
  track: z.enum(['sql', 'python', 'pyspark']),
  title: z.string().min(1),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  topics: z.array(z.string()),
  summary: z.string(),
  description: z.string(),
  hints: z.array(z.string()).default([]),
  schema: tableSchema.optional(),
  outputColumns: z.array(z.string()).optional(),
  entry: z.string().optional(),
  signature: z.string().optional(),
  starter: z.string(),
  solution: z.string(),
  explanation: z.string(),
  position: z.number().int().default(0),
  tests: z.array(z.object({
    name: z.string(),
    hidden: z.boolean().optional(),
    ordered: z.boolean().optional(),
    tables: z.record(z.array(z.array(z.any()))).optional(),
    args: z.array(z.any()).optional(),
    expected: z.any(),
  })).min(1),
});

adminRouter.put('/problems/:id', handle(async (req, res) => {
  const body = problemSchema.parse(req.body);
  const p = { id: req.params.id, ...body };
  const result = await tx(async (db) => {
    const r = await upsertProblem(p, body.position, db);
    await notifyContentChanged(db);
    return r;
  });
  // Note: verify new problems with `npm run verify:problems` before publishing.
  res.json({ ok: true, ...result });
}));

const courseSchema = z.object({
  title: z.string().min(1),
  level: z.string(),
  tags: z.array(z.string()),
  description: z.string(),
  outcomes: z.array(z.string()),
  prerequisites: z.array(z.string()),
  practice: z.array(z.string()),
  position: z.number().int().default(0),
  modules: z.array(z.object({ slug: z.string(), title: z.string(), md: z.string() })).optional(),
});

adminRouter.put('/courses/:id', handle(async (req, res) => {
  const body = courseSchema.parse(req.body);
  await tx(async (db) => {
    await upsertCourse({ id: req.params.id, ...body }, body.position, db);
    for (const [i, m] of (body.modules || []).entries()) await upsertModule(req.params.id, m, i, db);
    await notifyContentChanged(db);
  });
  res.json({ ok: true });
}));

adminRouter.get('/submissions', handle(async (req, res) => {
  const status = z.enum(['queued', 'running', 'done', 'failed']).default('failed').parse(req.query.status);
  const { rows } = await query(
    `SELECT s.id, s.problem_id, s.status, s.verdict, s.attempts, s.worker_id, s.created_at, s.finished_at, u.email
     FROM submissions s JOIN users u ON u.id = s.user_id
     WHERE s.status = $1 ORDER BY s.created_at DESC LIMIT 100`, [status]);
  res.json({ submissions: rows });
}));

adminRouter.post('/submissions/:id/requeue', handle(async (req, res) => {
  const { rowCount } = await tx(async (db) => {
    const r = await db.query(
      `UPDATE submissions SET status = 'queued', attempts = 0, verdict = NULL, locked_until = NULL, worker_id = NULL
       WHERE id = $1 AND status = 'failed'`, [req.params.id]);
    if (r.rowCount) await db.query("SELECT pg_notify('submission_queued', $1)", [req.params.id]);
    return r;
  });
  if (!rowCount) throw notFound('No failed submission with that id.');
  res.json({ ok: true });
}));
