// ---------------------------------------------------------------------------
// Builds the payload for harness.py's run(). Shared by the browser (Run →
// visible examples) and the server grader (Submit → every test), so both sides
// grade with identical inputs.
//
// `problem` needs: track, entry, schema (sql/pyspark), outputColumns.
// `tests`: [{ name, hidden, ordered, tables?: { table: rows[][] }, args?: [], files?: {path: text}, expected }]
// ---------------------------------------------------------------------------

// Test case → the harness's input shape (tables carry their column types).
function caseInput(problem, test) {
  if (problem.track === 'python') return { args: test.args };
  if (problem.track === 'shell') return { files: test.files || {}, ...(test.stdin != null ? { stdin: test.stdin } : {}) };
  return {
    tables: problem.schema.map((t) => ({
      name: t.name,
      columns: t.columns.map(([name, type]) => [name, type]),
      rows: test.tables[t.name] || [],
    })),
  };
}

function caseExpected(problem, test) {
  if (problem.track === 'python' || problem.track === 'shell') return test.expected;
  return { columns: problem.outputColumns, rows: test.expected };
}

export function buildPayload(problem, tests, code) {
  return {
    track: problem.track,
    entry: problem.entry,
    code,
    tests: tests.map((t) => ({
      name: t.name,
      hidden: Boolean(t.hidden),
      ordered: Boolean(t.ordered),
      ...caseInput(problem, t),
      expected: caseExpected(problem, t),
    })),
  };
}

// Overall verdict for a set of per-test results.
export function verdictOf(results, mode) {
  if (results.some((r) => r.status === 'error')) return 'Runtime Error';
  if (results.some((r) => r.status === 'failed')) return 'Wrong Answer';
  return mode === 'submit' ? 'Accepted' : 'Examples Passed';
}
