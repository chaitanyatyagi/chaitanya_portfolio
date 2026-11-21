// ---------------------------------------------------------------------------
// Compact authoring for PySpark problem packs (docs §13.2).
//
//   pyspark({ id, title, difficulty, topics, patterns, domains, roles, interview,
//             companies, sources, summary, description, hints, explanation,
//             schema: { table: 'col TYPE description, …' },   // same spec as sql()
//             solution, starter?, ordered?,
//             tests: [{ name, hidden?, tables: { table: rows } }] })
//
// The learner writes `solve(spark, <one DataFrame per table, in schema order>)`
// returning a DataFrame. Expected rows and output columns are frozen from the
// reference solution into pyspark/golden.json (`npm run problems:freeze`).
// Column types are limited to what the harness can build (harness.py
// _SPARK_TYPES): INTEGER, BIGINT, DOUBLE, VARCHAR, BOOLEAN, DATE, TIMESTAMP —
// arrays / structs / maps are built inside the solution (split, from_json, …).
//
// Row order: by default tests compare rows as a set (ordered: false), because
// Spark output order isn't guaranteed. Problems whose spec includes an order
// set `ordered: true` and the solution must orderBy.
// ---------------------------------------------------------------------------
import { parseColumns } from '../sql/define.js';

export { md } from '../sql/define.js';
export const code = String.raw;

const HEADER = 'from pyspark.sql import DataFrame, SparkSession\nfrom pyspark.sql import functions as F\nfrom pyspark.sql.window import Window\n';

export function pyspark(p) {
  const schema = Object.entries(p.schema).map(([name, spec]) => ({ name, columns: parseColumns(spec) }));
  const params = schema.map((t) => `${t.name}: DataFrame`).join(', ');
  const companies = p.companies || [];
  return {
    track: 'pyspark',
    companies,
    sources: [],
    roles: ['Data Engineer'],
    interview: companies.length > 0,
    entry: 'solve',
    ...p,
    schema,
    signature: `solve(spark: SparkSession, ${params}) -> DataFrame`,
    starter: p.starter || `${HEADER}\n\ndef solve(spark: SparkSession, ${params}) -> DataFrame:\n    return ${schema[0].name}\n`,
    solution: p.solution.includes('import functions as F') ? p.solution : `${HEADER}\n${p.solution}`,
    tests: p.tests.map((t) => ({ ordered: Boolean(p.ordered), ...t })),
    golden: true,
  };
}
