// ---------------------------------------------------------------------------
// Content sync: server/content/** → Postgres. Idempotent — run it any time.
// Courses, modules and tracks are upserted; problems only get a new version
// when their content actually changed. Ends with NOTIFY content_changed so
// running API processes drop their caches.
// ---------------------------------------------------------------------------
import fs from 'node:fs/promises';
import path from 'node:path';
import { SERVER_DIR } from '../src/config.js';
import { migrate, pool, tx } from '../src/db.js';
import { upsertCourse, upsertModule, upsertTrack, upsertProblem, upsertCaseStudy, notifyContentChanged } from '../src/content/store.js';
import { COURSES } from '../content/courses.js';
import { TRACKS } from '../content/tracks.js';
import { CHALLENGE_TRACKS } from '../content/challenges.js';
import { PROBLEMS, CASE_STUDIES } from '../content/problems/index.js';
import { syncDocs } from '../src/content/docs.js';

await migrate();
const summary = await tx(async (db) => {
  for (const [i, c] of COURSES.entries()) {
    await upsertCourse(c, i, db);
    for (const [j, [slug, title, file]] of c.modules.entries()) {
      const md = await fs.readFile(path.join(SERVER_DIR, 'content', 'courses', `${file}.md`), 'utf8');
      await upsertModule(c.id, { slug, title, md }, j, db);
    }
  }
  for (const [i, t] of TRACKS.entries()) await upsertTrack(t, i, CHALLENGE_TRACKS[t.id] || null, db);
  let changed = 0;
  for (const [i, cs] of CASE_STUDIES.entries()) await upsertCaseStudy(cs, i, db);
  for (const [i, p] of PROBLEMS.entries()) if ((await upsertProblem(p, i, db)).changed) changed += 1;
  const docs = await syncDocs(db);
  await notifyContentChanged(db);
  return { docs: docs.docs, courses: COURSES.length, modules: COURSES.reduce((n, c) => n + c.modules.length, 0), tracks: TRACKS.length, problems: PROBLEMS.length, problemsChanged: changed };
});
await pool.end();
console.log('✓ content synced', summary);
