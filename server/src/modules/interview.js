// ---------------------------------------------------------------------------
// /api/interview — interview prep (docs §8.14). Public lists, like the
// practice lists; solving still requires sign-in.
//
//   GET /api/interview              case studies (with their parts) + interview-tagged problems
//   GET /api/case-studies/:id       one case study: the shared brief + its parts in order
//
// Content is cached per process (cleared by NOTIFY content_changed with the
// rest of the content cache); the signed-in user's status is merged per request.
// ---------------------------------------------------------------------------
import express from 'express';
import { query } from '../db.js';
import { handle, notFound } from '../lib/errors.js';
import { contentCache } from '../lib/cache.js';
import { ROLES } from '../content/roles.js';

export const interviewRouter = express.Router();
const TTL = 60_000;

const loadInterview = () => contentCache.getOrLoad('interview', TTL, async () => {
  const [cs, probs] = await Promise.all([
    query('SELECT id, track_id, title, summary, roles, companies FROM case_studies WHERE published ORDER BY position'),
    query(`SELECT id, track_id, title, difficulty, points, roles, patterns, topics, companies, summary,
                  case_study_id, case_study_part
           FROM problems WHERE published AND (interview OR case_study_id IS NOT NULL)
           ORDER BY track_id, position`),
  ]);
  const problems = probs.rows.map((p) => ({
    id: p.id, track: p.track_id, title: p.title, difficulty: p.difficulty, points: p.points, roles: p.roles,
    patterns: p.patterns, topics: p.topics, companies: p.companies, summary: p.summary,
    caseStudy: p.case_study_id ? { id: p.case_study_id, part: p.case_study_part } : null,
  }));
  return {
    caseStudies: cs.rows.map((c) => ({
      id: c.id, track: c.track_id, title: c.title, summary: c.summary, roles: c.roles, companies: c.companies,
      parts: problems.filter((p) => p.caseStudy?.id === c.id).sort((a, b) => a.caseStudy.part - b.caseStudy.part)
        .map(({ id, title, difficulty, points, caseStudy }) => ({ id, title, difficulty, points, part: caseStudy.part })),
    })),
    problems,
  };
});

async function statusFor(userId, ids) {
  if (!userId || !ids.length) return {};
  const { rows } = await query('SELECT problem_id, status FROM user_problems WHERE user_id = $1 AND problem_id = ANY($2)', [userId, ids]);
  return Object.fromEntries(rows.map((r) => [r.problem_id, r.status]));
}

interviewRouter.get('/interview', handle(async (req, res) => {
  const data = await loadInterview();
  const status = await statusFor(req.user?.id, data.problems.map((p) => p.id));
  const st = (id) => status[id] || 'todo';
  res.json({
    roles: ROLES,
    caseStudies: data.caseStudies.map((c) => ({ ...c, parts: c.parts.map((p) => ({ ...p, status: st(p.id) })) })),
    problems: data.problems.filter((p) => !p.caseStudy).map((p) => ({ ...p, status: st(p.id) })),
  });
}));

interviewRouter.get('/case-studies/:id', handle(async (req, res) => {
  const data = await loadInterview();
  const cs = data.caseStudies.find((c) => c.id === req.params.id);
  if (!cs) throw notFound('Case study not found.');
  const brief = await contentCache.getOrLoad(`case-study:${cs.id}`, TTL, async () =>
    (await query('SELECT brief_md FROM case_studies WHERE id = $1', [cs.id])).rows[0]?.brief_md || '');
  const status = await statusFor(req.user?.id, cs.parts.map((p) => p.id));
  res.json({ caseStudy: { ...cs, brief, parts: cs.parts.map((p) => ({ ...p, status: status[p.id] || 'todo' })) } });
}));
