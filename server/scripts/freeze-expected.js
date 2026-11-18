// ---------------------------------------------------------------------------
// Golden outputs for SQL packs (docs §13.2).
//   npm run problems:freeze                 freeze new/changed problems
//   npm run problems:freeze -- --show       …and print every frozen output to review
//   npm run problems:freeze -- --only a,b   just these ids
// Runs each reference solution on each test in the same DuckDB/Pyodide harness
// the grader uses and stores { hash, columns, tests: { name: rows } } in
// content/problems/sql/golden.json. A solution that errors stops the freeze.
// ---------------------------------------------------------------------------
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadPyodide } from 'pyodide';
import { REPO_DIR, SERVER_DIR } from '../src/config.js';
import { buildPayload } from '../../shared/grader/payload.js';
import { RAW_PACK_PROBLEMS } from '../content/problems/index.js';
import { goldenHash } from '../content/problems/sql/define.js';

const args = process.argv.slice(2);
const show = args.includes('--show');
const only = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',')) : null;
const file = path.join(SERVER_DIR, 'content', 'problems', 'sql', 'golden.json');
const golden = JSON.parse(readFileSync(file, 'utf8'));

const py = await loadPyodide();
await py.loadPackage(['duckdb'], { messageCallback: () => {} });
py.runPython(readFileSync(path.join(REPO_DIR, 'shared', 'grader', 'harness.py'), 'utf8'));

let frozen = 0;
let failed = 0;
for (const p of RAW_PACK_PROBLEMS) {
  if (only && !only.has(p.id)) continue;
  const hash = goldenHash(p);
  if (!only && golden[p.id]?.hash === hash) continue;
  const payload = buildPayload({ ...p, outputColumns: [] }, p.tests.map((t) => ({ ...t, expected: [] })), p.solution);
  const results = JSON.parse(py.globals.get('run')(JSON.stringify(payload)));
  const broken = results.filter((r) => r.status === 'error');
  if (broken.length) {
    failed += 1;
    console.log(`✗ ${p.id}: ${broken[0].name}: ${broken[0].message}`);
    continue;
  }
  const columns = results[0].actual.columns;
  golden[p.id] = { hash, columns, tests: Object.fromEntries(results.map((r) => [r.name, r.actual.rows])) };
  frozen += 1;
  console.log(`✓ ${p.id} (${columns.join(', ')})`);
  if (show) for (const r of results) console.log(`    ${r.hidden ? '[hidden] ' : ''}${r.name}: ${JSON.stringify(r.actual.rows)}`);
}
const sorted = Object.fromEntries(Object.keys(golden).sort().map((k) => [k, golden[k]]));
writeFileSync(file, `${JSON.stringify(sorted, null, 1)}\n`);
console.log(`${frozen} frozen, ${failed} failed`);
process.exit(failed ? 1 : 0);
