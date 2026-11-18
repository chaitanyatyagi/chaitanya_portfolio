// Pyodide packages each track's sandbox loads (from the local package cache —
// warmed by `npm run grader:prepare`, so sandboxes never touch the network).
// PySpark additionally installs the wheels in grader/wheels (sqlframe & deps).
export const SANDBOX_PACKAGES = {
  python: [],
  sql: ['duckdb', 'pytz'],
  pyspark: ['duckdb', 'pytz', 'micropip', 'more-itertools', 'typing-extensions', 'wcwidth'],
  pandas: ['pandas'],
  shell: [], // no Pyodide at all — just-bash (see sandbox.js)
};
