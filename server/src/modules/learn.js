// ---------------------------------------------------------------------------
// Learning API.
//   Public (browsing):  GET /api/catalog, /api/courses, /api/courses/:id,
//                       /api/modules/:slug/locate
//   Signed in (access): GET /api/courses/:id/modules/:slug   (lesson content)
//                       GET /api/progress, PUT /api/progress/modules/:slug,
//                       POST /api/progress/visits
//
// The catalog and course outlines are public so visitors can see what they'd
// get; the lesson bodies — the actual course — require an account.
// ---------------------------------------------------------------------------
import express from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { handle, notFound } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { getCatalog, getCourse, getModuleBody } from '../content/store.js';

export const learnRouter = express.Router();

learnRouter.get('/catalog', handle(async (_req, res) => {
  res.json(await getCatalog());
}));

learnRouter.get('/courses', handle(async (_req, res) => {
  res.json({ courses: (await getCatalog()).courses });
}));

// Outline + (when signed in) the learner's progress in this course.
learnRouter.get('/courses/:id', handle(async (req, res) => {
  const course = await getCourse(req.params.id);
  if (!course) throw notFound('Course not found.');
  let progress = null;
  if (req.user) {
    const [done, visit] = await Promise.all([
      query(`SELECT mp.module_slug FROM module_progress mp
             JOIN course_modules m ON m.slug = mp.module_slug
             WHERE mp.user_id = $1 AND m.course_id = $2`, [req.user.id, course.id]),
      query('SELECT module_slug FROM course_visits WHERE user_id = $1 AND course_id = $2', [req.user.id, course.id]),
    ]);
    progress = { completed: done.rows.map((r) => r.module_slug), lastVisited: visit.rows[0]?.module_slug || null };
  }
  res.json({ course, progress });
}));

learnRouter.get('/courses/:id/modules/:slug', requireAuth, handle(async (req, res) => {
  const [course, module] = await Promise.all([getCourse(req.params.id), getModuleBody(req.params.slug)]);
  if (!course || !module || module.courseId !== course.id) throw notFound('Module not found.');
  res.json({ slug: module.slug, body: module.body });
}));

// Resolves an old /guide/:slug link to its course.
learnRouter.get('/modules/:slug/locate', handle(async (req, res) => {
  const { rows: [m] } = await query('SELECT course_id FROM course_modules WHERE slug = $1', [req.params.slug]);
  if (!m) throw notFound('Module not found.');
  res.json({ courseId: m.course_id, slug: req.params.slug });
}));

// --- progress ---------------------------------------------------------------

learnRouter.get('/progress', requireAuth, handle(async (req, res) => {
  const [done, visits] = await Promise.all([
    query(`SELECT mp.module_slug, m.course_id FROM module_progress mp
           JOIN course_modules m ON m.slug = mp.module_slug WHERE mp.user_id = $1`, [req.user.id]),
    query('SELECT course_id, module_slug FROM course_visits WHERE user_id = $1', [req.user.id]),
  ]);
  const byCourse = {};
  for (const r of done.rows) (byCourse[r.course_id] ||= []).push(r.module_slug);
  res.json({
    completed: byCourse,
    lastVisited: Object.fromEntries(visits.rows.map((v) => [v.course_id, v.module_slug])),
  });
}));

learnRouter.put('/progress/modules/:slug', requireAuth, handle(async (req, res) => {
  const { completed } = z.object({ completed: z.boolean() }).parse(req.body);
  if (completed) {
    const r = await query(
      `INSERT INTO module_progress (user_id, module_slug)
       SELECT $1, slug FROM course_modules WHERE slug = $2
       ON CONFLICT DO NOTHING`, [req.user.id, req.params.slug]);
    if (r.rowCount === 0) {
      const exists = await query('SELECT 1 FROM course_modules WHERE slug = $1', [req.params.slug]);
      if (!exists.rowCount) throw notFound('Module not found.');
    }
  } else {
    await query('DELETE FROM module_progress WHERE user_id = $1 AND module_slug = $2', [req.user.id, req.params.slug]);
  }
  res.json({ ok: true, completed });
}));

learnRouter.post('/progress/visits', requireAuth, handle(async (req, res) => {
  const body = z.object({ courseId: z.string().max(100), moduleSlug: z.string().max(200) }).parse(req.body);
  const r = await query(
    `INSERT INTO course_visits (user_id, course_id, module_slug)
     SELECT $1, course_id, slug FROM course_modules WHERE slug = $3 AND course_id = $2
     ON CONFLICT (user_id, course_id) DO UPDATE SET module_slug = EXCLUDED.module_slug, visited_at = now()`,
    [req.user.id, body.courseId, body.moduleSlug]);
  if (r.rowCount === 0) throw notFound('Module not found.');
  res.json({ ok: true });
}));
