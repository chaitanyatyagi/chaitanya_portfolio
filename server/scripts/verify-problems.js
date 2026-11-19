// ---------------------------------------------------------------------------
// Quality gate for problem content. For every problem in server/content:
//   * the reference solution must pass EVERY test (visible and hidden);
//   * the starter code must NOT pass every test (else the tests are too weak);
//   * the audit passes: required fields, tags from the taxonomy, every company
//     tag backed by a public source, ≥1 visible + ≥2 hidden tests, table rows
//     that match the schema / output columns, python entry + signature.
// Uses the same harness, packages and wheels as the grader's sandboxes.
//   npm run verify:problems                      (run before `npm run seed` / publishing)
//   npm run verify:problems -- --track python    solutions/starters of one track only
// ---------------------------------------------------------------------------
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { loadPyodide } from 'pyodide';
import { config, REPO_DIR } from '../src/config.js';
import { SANDBOX_PACKAGES } from '../grader/packages.js';
import { buildPayload } from '../../shared/grader/payload.js';
import { runShell } from '../../shared/grader/shell.js';
import { Bash } from 'just-bash';
import { PROBLEMS, RAW_PACK_PROBLEMS, CASE_STUDIES, PACK_TRACKS, goldenPath } from '../content/problems/index.js';
import { ROLES, goldenHash } from '../content/problems/sql/define.js';

const py = await loadPyodide();
await py.loadPackage([...new Set(Object.values(SANDBOX_PACKAGES).flat())], { messageCallback: () => {} });
py.FS.mkdirTree('/wheels');
const wheels = readdirSync(config.grader.wheelsDir).filter((f) => f.endsWith('.whl'));
if (!wheels.length) throw new Error('No wheels in grader/wheels — run `npm run grader:prepare` first.');
for (const f of wheels) py.FS.writeFile(`/wheels/${f}`, readFileSync(path.join(config.grader.wheelsDir, f)));
await py.runPythonAsync(`import micropip\nawait micropip.install(${JSON.stringify(wheels.map((f) => `emfs:/wheels/${f}`))}, deps=False)`);
py.runPython(readFileSync(path.join(REPO_DIR, 'shared', 'grader', 'harness.py'), 'utf8'));
const run = (problem, code) => {
  const payload = buildPayload(problem, problem.tests, code);
  return problem.track === 'shell' ? runShell(payload, Bash) : JSON.parse(py.globals.get('run')(JSON.stringify(payload)));
};

let failures = 0;
const { TRACKS } = await import('../content/tracks.js');
const TABLE_TRACKS = new Set(['sql', 'pyspark', 'pandas']);

// Static audit: everything a problem needs, and tags that are honest.
function audit(problem, track) {
  const errs = [];
  const need = (cond, msg) => { if (!cond) errs.push(msg); };
  for (const f of ['id', 'title', 'summary', 'description', 'starter', 'solution', 'explanation']) need(typeof problem[f] === 'string' && problem[f].trim(), `missing ${f}`);
  need(['Easy', 'Medium', 'Hard'].includes(problem.difficulty), 'difficulty must be Easy/Medium/Hard');
  need(problem.topics?.length, 'needs at least one topic');
  const badTopics = (problem.topics || []).filter((t) => !track.topics.includes(t));
  need(!badTopics.length, `topics not in the ${track.id} taxonomy: ${badTopics.join(', ')}`);
  need(problem.patterns?.length, 'needs at least one pattern');
  need(problem.domains?.length, 'needs at least one domain');
  need(problem.hints?.length, 'needs at least one hint');
  need(Array.isArray(problem.companies) && Array.isArray(problem.sources), 'companies and sources must be arrays');
  // Every company tag must be backed by a public source naming that company.
  for (const c of problem.companies || []) {
    need((problem.sources || []).some((s) => s.company === c && /^https:\/\//.test(s.url || '')), `company "${c}" has no source with an https url`);
  }
  for (const s of problem.sources || []) need(/^https:\/\//.test(s.url || '') && s.label, 'every source needs a label and an https url');

  const tests = problem.tests || [];
  const visible = tests.filter((t) => !t.hidden);
  need(visible.length >= 1, 'needs at least one visible example');
  need(tests.length - visible.length >= 2, 'needs at least two hidden tests');
  need(new Set(tests.map((t) => t.name)).size === tests.length, 'test names must be unique');
  for (const t of tests) need('expected' in t, `test "${t.name}" has no expected output`);

  if (TABLE_TRACKS.has(problem.track)) {
    need(problem.schema?.length && problem.outputColumns?.length, 'table tracks need schema and outputColumns');
    for (const t of tests) {
      for (const table of problem.schema || []) {
        const rows = t.tables?.[table.name];
        need(Array.isArray(rows), `test "${t.name}" is missing table ${table.name}`);
        need((rows || []).every((r) => r.length === table.columns.length), `test "${t.name}": a ${table.name} row has the wrong number of columns`);
      }
      need(Array.isArray(t.expected) && t.expected.every((r) => r.length === problem.outputColumns.length), `test "${t.name}": expected rows must have ${problem.outputColumns?.length} columns`);
    }
  }
  if (problem.track === 'python') {
    need(problem.entry && problem.signature?.startsWith(`${problem.entry}(`), 'python needs entry + matching signature');
    for (const t of tests) need(Array.isArray(t.args), `test "${t.name}" needs args`);
    // A function that returns nothing must not pass: some test has to expect a value.
    need(tests.some((t) => t.expected != null), 'every test expects None — add a case that returns a value');
  }
  if (problem.track === 'pyspark' || problem.track === 'pandas') need(problem.entry && problem.signature, 'needs entry + signature');
  if (problem.track === 'shell') for (const t of tests) need(t.files && typeof t.expected === 'string', `test "${t.name}" needs files and a text expected`);
  for (const r of problem.roles || []) need(ROLES.includes(r), `unknown role "${r}" (allowed: ${ROLES.join(', ')})`);
  if (problem.caseStudy) need(CASE_STUDIES.some((c) => c.id === problem.caseStudy.id), `unknown case study ${problem.caseStudy.id}`);
  if (problem.interview) need(problem.roles?.length, 'interview problems need roles');
  // At least one test must expect a non-empty result, or a query returning
  // nothing could pass everything.
  if (TABLE_TRACKS.has(problem.track)) need(tests.some((t) => Array.isArray(t.expected) && t.expected.length), 'every test expects an empty result — add data that produces rows');
  return errs;
}

// Registry: every problem file must be registered in content/problems/index.js
// (an unregistered file would silently never be published), and vice versa.
const problemDir = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'content', 'problems');
const files = readdirSync(problemDir).filter((f) => f.endsWith('.js') && f !== 'index.js');
const registered = new Set(PROBLEMS.map((p) => p.id));
const singleFile = PROBLEMS.filter((p) => !p.golden);
for (const f of files) {
  const { default: p } = await import(path.join(problemDir, f));
  if (!p?.id || !registered.has(p.id)) { failures += 1; console.log(`✗ ${f} is not registered in content/problems/index.js`); }
}
if (files.length !== singleFile.length) { failures += 1; console.log(`✗ ${files.length} problem files but ${singleFile.length} registered`); }

// Packs: golden outputs present and current; case studies consistent.
const goldenFiles = Object.fromEntries(PACK_TRACKS.map((t) => [t, JSON.parse(readFileSync(goldenPath(t), 'utf8'))]));
for (const p of RAW_PACK_PROBLEMS) {
  if (goldenFiles[p.track]?.[p.id]?.hash !== goldenHash(p)) { failures += 1; console.log(`✗ ${p.id}: golden outputs missing or stale — run npm run problems:freeze and review the diff`); }
}
for (const cs of CASE_STUDIES) {
  const parts = PROBLEMS.filter((p) => p.caseStudy?.id === cs.id).map((p) => p.caseStudy.part).sort((a, b) => a - b);
  if (parts.length < 2 || parts.some((n, i) => n !== i + 1)) { failures += 1; console.log(`✗ case study ${cs.id}: parts must be 1..n with at least 2 (got ${parts.join(',') || 'none'})`); }
  if (!cs.title || !cs.brief || !cs.summary) { failures += 1; console.log(`✗ case study ${cs.id}: needs title, summary and brief`); }
}

const onlyTrack = process.argv.includes('--track') ? process.argv[process.argv.indexOf('--track') + 1] : null;
const ids = new Set();
const summary = {};
for (const problem of PROBLEMS) {
  if (onlyTrack && problem.track !== onlyTrack) { ids.add(problem.id); continue; }
  const track = TRACKS.find((t) => t.id === problem.track);
  const errs = track ? audit(problem, track) : ['unknown track'];
  if (ids.has(problem.id)) errs.push('duplicate id');
  ids.add(problem.id);
  if (errs.length) {
    failures += errs.length;
    console.log(`✗ [${problem.track}] ${problem.id} — audit failed:`);
    for (const e of errs) console.log(`    ✗ ${e}`);
    continue;
  }
  const results = await run(problem, problem.solution);
  const bad = results.filter((r) => r.status !== 'passed');
  const hidden = problem.tests.filter((t) => t.hidden).length;
  console.log(`${bad.length ? '✗' : '✓'} [${problem.track}] ${problem.id} — ${results.length - bad.length}/${results.length} passed (${results.length - hidden} visible, ${hidden} hidden) · ${problem.difficulty} · ${problem.companies.join(', ') || 'no company tag'}`);
  for (const r of bad) {
    failures += 1;
    console.log(`    ✗ ${r.name}: ${r.message}`);
    if (r.actual) console.log('      actual:', JSON.stringify(r.actual));
    if (r.traceback) console.log(r.traceback.replace(/^/gm, '      '));
  }
  if ((await run(problem, problem.starter)).every((r) => r.status === 'passed')) {
    failures += 1;
    console.log('    ✗ starter code passes every test — add a stricter case');
  }
  const t = (summary[problem.track] ||= { problems: 0, Easy: 0, Medium: 0, Hard: 0, tests: 0, companyTagged: 0 });
  t.problems += 1; t[problem.difficulty] += 1; t.tests += problem.tests.length; t.companyTagged += problem.companies.length ? 1 : 0;
}
console.log('');
console.table(summary);
console.log(failures ? `✗ ${failures} problem(s) found` : `✓ all ${PROBLEMS.length} problems pass the audit, their reference solutions pass every test, and no starter passes`);
process.exit(failures ? 1 : 0);
