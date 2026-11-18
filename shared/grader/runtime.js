// ---------------------------------------------------------------------------
// Runtime configuration shared by the browser runner (Run) and the server
// grader (Submit), so both execute code in the same environment.
//   Python  → Pyodide (CPython compiled to WebAssembly)
//   SQL     → DuckDB, via Pyodide's duckdb package
//   PySpark → sqlframe: the PySpark DataFrame API, executed on DuckDB
//   Pandas  → pandas (Pyodide package)
//   Shell   → just-bash, a sandboxed bash interpreter (no Pyodide involved)
// ---------------------------------------------------------------------------
export const PYODIDE_VERSION = '314.0.8';
export const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

export const TRACK_RUNTIME = {
  python: { label: 'Python 3.14', packages: [], pip: [], warmup: '' },
  pandas: { label: 'pandas 3 · Python 3.14', packages: ['pandas'], pip: [], warmup: 'import pandas' },
  shell: { label: 'Bash (sandboxed just-bash)', engine: 'just-bash', packages: [], pip: [], warmup: '' },
  sql: { label: 'DuckDB SQL', packages: ['duckdb', 'pytz'], pip: [], warmup: '' },
  pyspark: {
    label: 'PySpark API · sqlframe on DuckDB',
    packages: ['duckdb', 'pytz', 'micropip'],
    pip: ['sqlframe==4.10.0'],
    warmup: '_spark()',
  },
};
