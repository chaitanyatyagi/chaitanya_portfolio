// ---------------------------------------------------------------------------
// Content store — courses, modules, tracks and problems.
//
// Writes (seed script + admin API) go through the upsert* functions, which
// derive computed fields (lesson lists, reading time, problem version) so
// they're consistent no matter who writes.
//
// Reads go through contentCache: content is identical for every user, so it's
// loaded once per process and served from memory until it changes. Per-user
// data (progress, solved status) is NEVER cached here — it's merged in by the
// route handlers on top of the shared content.
// ---------------------------------------------------------------------------
import crypto from 'node:crypto';
import { marked } from 'marked';
import { makeSlugger } from '../../../shared/content/slug.js';
import { query, tx } from '../db.js';
import { contentCache } from '../lib/cache.js';
import { config } from '../config.js';
import { engineOf } from '../../../shared/grader/runtime.js';

const TTL = () => config.contentCacheTtlMs;
const WORDS_PER_MINUTE = 130; // technical prose with code reads slower than plain text

// ---- derivations -------------------------------------------------------------

const plain = (s) => s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();

export function deriveModule(md) {
  const slug = makeSlugger();
  const lessons = [];
  let summary = '';
  for (const token of marked.lexer(md)) {
    if (token.type === 'heading') {
      const id = slug(token.text);
      if (token.depth === 2) lessons.push({ id, title: plain(token.text) });
    } else if (!summary && token.type === 'paragraph') {
      summary = plain(token.text);
    }
  }
  if (summary.length > 180) summary = `${summary.slice(0, 177).replace(/\s+\S*$/, '')}…`;
  const minutes = Math.max(1, Math.round(md.split(/\s+/).length / WORDS_PER_MINUTE));
  return { lessons, summary, minutes };
}

// ---- writes ------------------------------------------------------------------

export async function upsertCourse(course, position, db) {
  await db.query(
    `INSERT INTO courses (id, position, title, level, tags, description, outcomes, prerequisites, practice, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
     ON CONFLICT (id) DO UPDATE SET position=$2, title=$3, level=$4, tags=$5, description=$6,
       outcomes=$7, prerequisites=$8, practice=$9, updated_at=now()`,
    [course.id, position, course.title, course.level, course.tags, course.description, course.outcomes, course.prerequisites, course.practice],
  );
}

export async function upsertModule(courseId, { slug, title, md }, position, db) {
  const { lessons, summary, minutes } = deriveModule(md);
  await db.query(
    `INSERT INTO course_modules (slug, course_id, position, title, summary, minutes, lessons, body_md, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())
     ON CONFLICT (slug) DO UPDATE SET course_id=$2, position=$3, title=$4, summary=$5, minutes=$6,
       lessons=$7, body_md=$8, updated_at=now()`,
    [slug, courseId, position, title, summary, minutes, JSON.stringify(lessons), md],
  );
}

// Case studies: the shared brief of a multi-part interview question (docs §8.14).
export async function upsertCaseStudy(cs, position, db) {
  await db.query(
    `INSERT INTO case_studies (id, track_id, position, title, summary, brief_md, roles, companies, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
     ON CONFLICT (id) DO UPDATE SET track_id=$2, position=$3, title=$4, summary=$5, brief_md=$6, roles=$7, companies=$8, updated_at=now()`,
    [cs.id, cs.track || 'sql', position, cs.title, cs.summary, cs.brief, cs.roles || [], cs.companies || []]);
}

export async function upsertTrack(track, position, details, db) {
  await db.query(
    `INSERT INTO tracks (id, position, title, short, kind, status, icon, course_id, blurb, topics, details, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
     ON CONFLICT (id) DO UPDATE SET position=$2, title=$3, short=$4, kind=$5, status=$6, icon=$7,
       course_id=$8, blurb=$9, topics=$10, details=$11, updated_at=now()`,
    [track.id, position, track.title, track.short, track.kind, track.status, track.icon, track.course, track.blurb, track.topics, details ? JSON.stringify(details) : null],
  );
}

// Base points by difficulty (full award for a first-try solve; see docs §8.13).
export const BASE_POINTS = { Easy: 10, Medium: 20, Hard: 40 };

const problemHash = (p) => crypto.createHash('sha256').update(JSON.stringify(p)).digest('hex');

// Upserts a problem and replaces its tests. The version only increments when
// the content actually changed, so submissions can record exactly which
// version of the tests graded them.
export async function upsertProblem(p, position, db) {
  const hash = problemHash(p);
  const { rows } = await db.query('SELECT content_hash FROM problems WHERE id = $1', [p.id]);
  if (rows[0]?.content_hash === hash) return { changed: false };
  await db.query(
    `INSERT INTO problems (id, track_id, position, title, difficulty, topics, summary, description_md, hints,
       schema, output_columns, entry, signature, starter, solution, explanation_md, content_hash,
       patterns, domains, companies, points, sources, interview, roles, case_study_id, case_study_part, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26, now())
     ON CONFLICT (id) DO UPDATE SET track_id=$2, position=$3, title=$4, difficulty=$5, topics=$6, summary=$7,
       description_md=$8, hints=$9, schema=$10, output_columns=$11, entry=$12, signature=$13, starter=$14,
       solution=$15, explanation_md=$16, content_hash=$17, patterns=$18, domains=$19, companies=$20, points=$21, sources=$22, interview=$23, roles=$24, case_study_id=$25, case_study_part=$26,
       version = problems.version + 1, updated_at=now()`,
    [p.id, p.track, position, p.title, p.difficulty, p.topics, p.summary, p.description, p.hints,
      p.schema ? JSON.stringify(p.schema) : null, p.outputColumns || null, p.entry || null, p.signature || null,
      p.starter, p.solution, p.explanation, hash,
      p.patterns || [], p.domains || [], p.companies || [], p.points ?? BASE_POINTS[p.difficulty], JSON.stringify(p.sources || []),
      Boolean(p.interview), p.roles || [], p.caseStudy?.id ?? null, p.caseStudy?.part ?? null],
  );
  await db.query('DELETE FROM problem_tests WHERE problem_id = $1', [p.id]);
  for (const [i, t] of p.tests.entries()) {
    const engine = engineOf(p.track);
    const input = engine === 'python' ? { args: t.args }
      : engine === 'shell' ? { files: t.files || {}, ...(t.stdin != null ? { stdin: t.stdin } : {}) }
        : { tables: t.tables };
    await db.query(
      `INSERT INTO problem_tests (problem_id, position, name, hidden, ordered, input, expected)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [p.id, i, t.name, Boolean(t.hidden), Boolean(t.ordered), JSON.stringify(input), JSON.stringify(t.expected)],
    );
  }
  return { changed: true };
}

// Tells every API process (and the grader) that content changed. Delivered
// after COMMIT, so listeners never reload half-written data.
export const notifyContentChanged = (db) => db.query("SELECT pg_notify('content_changed', '')");

// ---- reads (cached) ----------------------------------------------------------

const courseSummary = (c) => ({
  id: c.id, title: c.title, level: c.level, tags: c.tags, description: c.description,
  modules: Number(c.module_count), lessons: Number(c.lesson_count), minutes: Number(c.minutes),
});

export function getCatalog() {
  return contentCache.getOrLoad('catalog', TTL(), async () => {
    const [courses, tracks, problemCounts] = await Promise.all([
      query(`SELECT c.*, count(m.slug) AS module_count,
               coalesce(sum(jsonb_array_length(m.lessons)), 0) AS lesson_count,
               coalesce(sum(m.minutes), 0) AS minutes
             FROM courses c LEFT JOIN course_modules m ON m.course_id = c.id
             WHERE c.published GROUP BY c.id ORDER BY c.position`),
      query('SELECT * FROM tracks ORDER BY position'),
      query(`SELECT track_id, difficulty, count(*) AS n FROM problems WHERE published
             GROUP BY track_id, difficulty`),
    ]);
    const counts = {};
    for (const r of problemCounts.rows) (counts[r.track_id] ||= { total: 0 })[r.difficulty] = r.n;
    for (const c of Object.values(counts)) c.total = (c.Easy || 0) + (c.Medium || 0) + (c.Hard || 0);
    const courseList = courses.rows.map(courseSummary);
    return {
      courses: courseList,
      tracks: tracks.rows.map((t) => ({
        id: t.id, title: t.title, short: t.short, kind: t.kind, status: t.status, icon: t.icon,
        course: t.course_id, blurb: t.blurb, topics: t.topics, details: t.details,
        problems: counts[t.id] || { total: 0 },
      })),
      stats: {
        courses: courseList.length,
        modules: courseList.reduce((n, c) => n + c.modules, 0),
        lessons: courseList.reduce((n, c) => n + c.lessons, 0),
        minutes: courseList.reduce((n, c) => n + c.minutes, 0),
        tracks: tracks.rows.length,
        problems: Object.values(counts).reduce((n, c) => n + c.total, 0),
      },
    };
  });
}

// Course outline: metadata + modules WITHOUT bodies (public).
export function getCourse(id) {
  return contentCache.getOrLoad(`course:${id}`, TTL(), async () => {
    const { rows: [c] } = await query('SELECT * FROM courses WHERE id = $1 AND published', [id]);
    if (!c) return null;
    const { rows: modules } = await query(
      'SELECT slug, position, title, summary, minutes, lessons FROM course_modules WHERE course_id = $1 ORDER BY position', [id]);
    return {
      id: c.id, title: c.title, level: c.level, tags: c.tags, description: c.description,
      outcomes: c.outcomes, prerequisites: c.prerequisites, practice: c.practice,
      modules: modules.map((m, i) => ({ slug: m.slug, index: i, title: m.title, summary: m.summary, minutes: m.minutes, lessons: m.lessons })),
      lessons: modules.reduce((n, m) => n + m.lessons.length, 0),
      minutes: modules.reduce((n, m) => n + m.minutes, 0),
    };
  });
}

// Module body (signed-in users only — enforced by the route).
export function getModuleBody(slug) {
  return contentCache.getOrLoad(`module:${slug}`, TTL(), async () => {
    const { rows: [m] } = await query('SELECT slug, course_id, body_md FROM course_modules WHERE slug = $1', [slug]);
    return m ? { slug: m.slug, courseId: m.course_id, body: m.body_md } : null;
  });
}

export function getTrack(id) {
  return getCatalog().then((c) => c.tracks.find((t) => t.id === id) || null);
}

// Problem list for a track: public metadata only.
export function getProblemList(trackId) {
  return contentCache.getOrLoad(`problems:${trackId}`, TTL(), async () => {
    const { rows } = await query(
      `SELECT id, title, difficulty, topics, patterns, domains, companies, points, summary, interview, roles,
              case_study_id, case_study_part FROM problems
       WHERE track_id = $1 AND published ORDER BY position`, [trackId]);
    return rows.map(({ case_study_id: id, case_study_part: part, ...r }) => ({ ...r, caseStudy: id ? { id, part } : null }));
  });
}

// Full problem for the workspace. Includes ONLY visible tests — the query
// itself filters hidden ones, so they can't leak through a serializer bug.
// solution / explanation are returned separately and only when allowed.
export function getProblem(id) {
  return contentCache.getOrLoad(`problem:${id}`, TTL(), async () => {
    const { rows: [p] } = await query('SELECT * FROM problems WHERE id = $1 AND published', [id]);
    if (!p) return null;
    const { rows: tests } = await query(
      'SELECT name, ordered, input, expected FROM problem_tests WHERE problem_id = $1 AND NOT hidden ORDER BY position', [id]);
    const { rows: [{ hidden }] } = await query(
      'SELECT count(*) AS hidden FROM problem_tests WHERE problem_id = $1 AND hidden', [id]);
    const siblings = await getProblemList(p.track_id);
    const pos = siblings.findIndex((s) => s.id === id);
    return {
      problem: {
        id: p.id, track: p.track_id, title: p.title, difficulty: p.difficulty, topics: p.topics, summary: p.summary,
        description: p.description_md, hints: p.hints, schema: p.schema, outputColumns: p.output_columns,
        patterns: p.patterns, domains: p.domains, companies: p.companies, points: p.points, sources: p.sources,
        interview: p.interview, roles: p.roles, caseStudy: p.case_study_id ? { id: p.case_study_id, part: p.case_study_part } : null,
        entry: p.entry, signature: p.signature, starter: p.starter, version: p.version,
        examples: tests.map((t) => ({ name: t.name, ordered: t.ordered, ...t.input, expected: t.expected })),
        hiddenCount: hidden,
        prev: siblings[pos - 1]?.id || null,
        next: siblings[pos + 1]?.id || null,
        position: pos + 1,
        total: siblings.length,
      },
      solution: { solution: p.solution, explanation: p.explanation_md },
    };
  });
}

export function clearContentCache() {
  contentCache.clear();
}

export { tx };

// Acceptance statistics per problem (LeetCode-style "Acceptance" column):
// accepted / graded submissions, plus how many people solved it. Shared by
// every user, so cached briefly (60 s) — it doesn't need to be live to the second.
// Acceptance stats: a read of the small problem_stats table, which the grader
// keeps current in each verdict transaction (docs §9.5).
export function getProblemStats() {
  return contentCache.getOrLoad('problem-stats', 15_000, async () => {
    const { rows } = await query('SELECT problem_id, submissions, accepted, solvers FROM problem_stats');
    return Object.fromEntries(rows.map((r) => {
      const submissions = Number(r.submissions);
      const accepted = Number(r.accepted);
      return [r.problem_id, {
        submissions, accepted, solvers: Number(r.solvers),
        acceptance: submissions ? Math.round((accepted / submissions) * 1000) / 10 : null,
      }];
    }));
  });
}
