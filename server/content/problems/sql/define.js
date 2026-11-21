// ---------------------------------------------------------------------------
// Compact authoring for SQL problem packs (docs §13.2).
//
//   sql({ id, title, difficulty, topics, patterns, domains, roles, interview,
//         caseStudy: { id, part }, companies, sources, summary, description,
//         hints, explanation, solution, starter?,
//         schema: { table: 'col TYPE description, col TYPE description, …' },
//         tests: [{ name, hidden?, tables: { table: rows } }] })
//
// Expected outputs are NOT hand-typed here: `npm run problems:freeze` runs the
// reference solution once in DuckDB and stores its result per test in
// golden.json ("golden outputs"); the loader attaches them. The output columns
// come from the same file. Freezing is deliberate — re-run it after changing a
// problem's data or solution, and review the diff.
// ---------------------------------------------------------------------------
export { ROLES } from '../../../src/content/roles.js';

// "id INTEGER Primary key, name VARCHAR Employee name" → [[name, type, description], …]
export function parseColumns(spec) {
  return spec.split(/,\s*(?=[a-z_][a-z0-9_]*\s+[A-Z])/).map((part) => {
    const [name, type, ...desc] = part.trim().split(/\s+/);
    return [name, type, desc.join(' ')];
  });
}

export function sql(p) {
  const schema = Object.entries(p.schema).map(([name, spec]) => ({ name, columns: parseColumns(spec) }));
  const first = schema[0].name;
  return {
    track: 'sql',
    companies: [],
    sources: [],
    roles: ['Data Engineer', 'Data Analyst'],
    interview: false,
    ...p,
    schema,
    starter: p.starter || `-- Tables: ${schema.map((t) => t.name).join(', ')}\nSELECT *\nFROM ${first};\n`,
    tests: p.tests.map((t) => ({ ordered: true, ...t })),
    golden: true, // expected outputs come from golden.json
  };
}

// Fingerprint of everything that determines a problem's outputs. golden.json
// stores it; verify:problems fails when they differ (stale golden outputs).
import { createHash } from 'node:crypto';
// Shared by every pack track: SQL tests carry `tables`, Python tests `args`
// (undefined keys drop out of the JSON, so SQL hashes are unchanged by `args`).
export const goldenHash = (p) => createHash('sha256')
  .update(JSON.stringify({ schema: p.schema, solution: p.solution, tests: p.tests.map(({ name, tables, args }) => ({ name, tables, args })) }))
  .digest('hex').slice(0, 16);

// Multi-line markdown without template-literal escaping: md('line', 'line').
export const md = (...lines) => lines.join('\n');

// Source helpers for company attribution.
export const dl = (company, slug, what) => ({ company, label: `DataLemur — ${company} SQL interview questions: ${what}`, url: `https://datalemur.com/blog/${slug}-sql-interview-questions` });
export const dlq = (company, what) => ({ company, label: `DataLemur — ${company} "${what}"`, url: 'https://datalemur.com/questions' });
export const sp = (company, what) => ({ company, label: `SparkPlayground — ${company} "${what}"`, url: 'https://www.sparkplayground.com/pyspark-coding-interview-questions' });
