// ---------------------------------------------------------------------------
// Golden outputs for problem packs (docs §13.2).
//   npm run problems:freeze                 freeze new/changed problems
//   npm run problems:freeze -- --show       …and print every frozen output to review
//   npm run problems:freeze -- --only a,b   just these ids
// Runs each reference solution on each test in the same Pyodide harness the
// grader uses and stores the result in content/problems/<track>/golden.json:
//   sql     { hash, columns, tests: { name: rows } }
//   python  { hash, tests: { name: value } }      (value as the grader normalises it)
// A solution that errors stops that problem's freeze.
// ---------------------------------------------------------------------------
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadPyodide } from 'pyodide';
import { REPO_DIR } from '../src/config.js';
import { buildPayload } from '../../shared/grader/payload.js';
import { RAW_PACK_PROBLEMS, PACK_TRACKS, goldenPath } from '../content/problems/index.js';
import { goldenHash } from '../content/problems/sql/define.js';

const args = process.argv.slice(2);
const show = args.includes('--show');
const only = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',')) : null;
const golden = Object.fromEntries(PACK_TRACKS.map((t) => [t, JSON.parse(readFileSync(goldenPath(t), 'utf8'))]));

const todo = RAW_PACK_PROBLEMS.filter((p) => (only ? only.has(p.id) : golden[p.track][p.id]?.hash !== goldenHash(p)));
const py = await loadPyodide();
if (todo.some((p) => p.track === 'sql')) await py.loadPackage(['duckdb'], { messageCallback: () => {} });
py.runPython(readFileSync(path.join(REPO_DIR, 'shared', 'grader', 'harness.py'), 'utf8'));

let frozen = 0;
let failed = 0;
for (const p of todo) {
  const tests = p.tests.map((t) => ({ ...t, expected: p.track === 'sql' ? [] : null }));
  const payload = buildPayload(p.track === 'sql' ? { ...p, outputColumns: [] } : p, tests, p.solution);
  const results = JSON.parse(py.globals.get('run')(JSON.stringify(payload)));
  const broken = results.filter((r) => r.status === 'error');
  if (broken.length) {
    failed += 1;
    console.log(`✗ ${p.id}: ${broken[0].name}: ${broken[0].message}`);
    if (broken[0].traceback) console.log(broken[0].traceback.replace(/^/gm, '    '));
    continue;
  }
  const value = (r) => (p.track === 'sql' ? r.actual.rows : r.actual);
  // JSON numbers beyond 2^53 lose precision in JS (and in the stored expected
  // value), so a test whose output contains one can never be graded reliably.
  const hasUnsafe = (v) => (typeof v === 'number' ? Number.isInteger(v) && !Number.isSafeInteger(v)
    : Array.isArray(v) ? v.some(hasUnsafe) : v && typeof v === 'object' ? Object.values(v).some(hasUnsafe) : false);
  const big = results.find((r) => hasUnsafe(value(r)));
  if (big) {
    failed += 1;
    console.log(`✗ ${p.id}: ${big.name}: output has an integer beyond 2^53 — JSON can't store it exactly; use a smaller input`);
    continue;
  }
  golden[p.track][p.id] = {
    hash: goldenHash(p),
    ...(p.track === 'sql' ? { columns: results[0].actual.columns } : {}),
    tests: Object.fromEntries(results.map((r) => [r.name, value(r)])),
  };
  frozen += 1;
  console.log(`✓ [${p.track}] ${p.id}${p.track === 'sql' ? ` (${results[0].actual.columns.join(', ')})` : ''}`);
  if (show) for (const r of results) console.log(`    ${r.hidden ? '[hidden] ' : ''}${r.name}: ${JSON.stringify(value(r))}`);
}
for (const track of PACK_TRACKS) {
  // Drop outputs of problems that were renamed or removed.
  const live = new Set(RAW_PACK_PROBLEMS.filter((p) => p.track === track).map((p) => p.id));
  for (const id of Object.keys(golden[track])) if (!live.has(id)) delete golden[track][id];
  const sorted = Object.fromEntries(Object.keys(golden[track]).sort().map((k) => [k, golden[track][k]]));
  writeFileSync(goldenPath(track), `${JSON.stringify(sorted, null, 1)}\n`);
}
console.log(`${frozen} frozen, ${failed} failed`);
process.exit(failed ? 1 : 0);
