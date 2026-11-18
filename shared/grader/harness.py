"""Grading harness for practice problems.

Runs inside Pyodide — in the browser (Run: visible examples), in the server
grader's sandboxes (Submit: every test) and in server/scripts/verify-problems.js —
so a problem is graded identically everywhere.

Entry point: run(payload_json) -> result_json
  payload = {
    "track": "sql" | "python" | "pyspark" | "pandas",
    "code": "<user code>",
    "entry": "<function name>"          # python / pyspark
    "tests": [{ "name", "hidden", "ordered", "expected", ...case input }],
  }
  case input per track:
    sql      "tables":  [{ "name", "columns": [[name, type], ...], "rows": [[...], ...] }]
    python   "args":    [arg1, arg2, ...]
    pyspark  "tables":  same shape as sql; passed to entry(spark, *dataframes)
    pandas   "tables":  same shape as sql; passed to entry(*dataframes)
  (shell problems are graded by shared/grader/shell.js, not by this file)
"""
import contextlib
import copy
import datetime as _dt
import decimal
import io
import json
import time
import traceback

MAX_ROWS_SHOWN = 50
MAX_STDOUT = 20_000
FLOAT_PLACES = 4


# --- value normalization ------------------------------------------------------

def _norm(v):
    """Make a value JSON-safe and comparable across engines."""
    if v is None or isinstance(v, (bool, str)):
        return v
    if type(v).__name__ in ("NAType", "NaTType"):  # pandas missing values
        return None
    if isinstance(v, int):
        return v
    if isinstance(v, float):
        if v != v:  # NaN
            return None
        r = round(v, FLOAT_PLACES)
        return int(r) if r.is_integer() else r
    if isinstance(v, decimal.Decimal):
        return _norm(float(v))
    if isinstance(v, _dt.datetime):
        return v.replace(tzinfo=None).isoformat(sep=" ")
    if isinstance(v, (_dt.date, _dt.time)):
        return v.isoformat()
    if isinstance(v, dict):
        return {str(k): _norm(x) for k, x in v.items()}
    if isinstance(v, (list, tuple, set)):
        items = [_norm(x) for x in v]
        return sorted(items, key=repr) if isinstance(v, set) else items
    if hasattr(v, "asDict"):  # Spark Row nested in a cell
        return _norm(v.asDict())
    if hasattr(v, "item"):  # numpy scalar
        return _norm(v.item())
    return str(v)


def _sort_key(row):
    return json.dumps(row, sort_keys=True, default=str)


# --- comparisons ---------------------------------------------------------------

def _compare_tables(actual, expected, ordered):
    """actual/expected: {"columns": [...], "rows": [[...]]}. Returns (ok, message)."""
    a_cols = [c.lower() for c in actual["columns"]]
    e_cols = [c.lower() for c in expected["columns"]]
    if a_cols != e_cols:
        return False, f"Expected columns {expected['columns']}, got {actual['columns']}."
    a_rows, e_rows = actual["rows"], expected["rows"]
    if len(a_rows) != len(e_rows):
        return False, f"Expected {len(e_rows)} row(s), got {len(a_rows)}."
    if ordered:
        if a_rows == e_rows:
            return True, ""
        if sorted(a_rows, key=_sort_key) == sorted(e_rows, key=_sort_key):
            return False, "Right rows, wrong order — check your ORDER BY / orderBy."
        return False, "Row values don't match the expected output."
    if sorted(a_rows, key=_sort_key) == sorted(e_rows, key=_sort_key):
        return True, ""
    return False, "Row values don't match the expected output."


def _compare_values(actual, expected):
    if actual == expected:
        return True, ""
    if type(actual) is not type(expected):
        return False, f"Expected a {type(expected).__name__}, got {type(actual).__name__}."
    if isinstance(expected, list):
        if len(actual) != len(expected):
            return False, f"Expected {len(expected)} item(s), got {len(actual)}."
        i = next(i for i, (a, e) in enumerate(zip(actual, expected)) if a != e)
        return False, f"First difference at index {i}."
    if isinstance(expected, dict) and actual.keys() != expected.keys():
        return False, f"Expected keys {sorted(expected)}, got {sorted(actual)}."
    return False, "Returned value doesn't match the expected output."


# --- per-track execution ------------------------------------------------------

def _cast(value, sql_type):
    if value is None:
        return None
    t = sql_type.upper()
    if t.startswith("TIMESTAMP"):
        return _dt.datetime.fromisoformat(value)
    if t == "DATE":
        return _dt.date.fromisoformat(value)
    return value


def _load_tables_duckdb(con, tables):
    for t in tables:
        cols = ", ".join(f'"{n}" {typ}' for n, typ in t["columns"])
        con.execute(f'CREATE TABLE "{t["name"]}" ({cols})')
        if t["rows"]:
            marks = ", ".join("?" for _ in t["columns"])
            rows = [[_cast(v, typ) for v, (_, typ) in zip(r, t["columns"])] for r in t["rows"]]
            con.executemany(f'INSERT INTO "{t["name"]}" VALUES ({marks})', rows)


# Every SQL test gets a brand-new in-memory database with outside access
# switched off: no reading/writing files (COPY, read_csv, ATTACH), no
# installing or loading extensions, and the settings are locked so the
# learner's SQL can't switch them back on. This is what makes it safe for the
# server to reuse one SQL sandbox across submissions.
_DUCKDB_LOCKDOWN = {
    "enable_external_access": False,
    "autoinstall_known_extensions": False,
    "autoload_known_extensions": False,
    "lock_configuration": True,
}


def _run_sql(code, case):
    import duckdb

    con = duckdb.connect(config=_DUCKDB_LOCKDOWN)
    try:
        _load_tables_duckdb(con, case.get("tables", []))
        cur = con.execute(code)
        if cur.description is None:
            raise ValueError("Your query didn't return a result set — end with a SELECT statement.")
        columns = [d[0] for d in cur.description]
        rows = [[_norm(v) for v in r] for r in cur.fetchall()]
        return {"columns": columns, "rows": rows}
    finally:
        con.close()


def _exec_user_code(code, entry):
    ns = {"__name__": "__solution__"}
    exec(compile(code, "solution.py", "exec"), ns)
    fn = ns.get(entry)
    if not callable(fn):
        raise NameError(f"Define a function named `{entry}` — it's what the tests call.")
    return fn


def _run_python(code, entry, case):
    fn = _exec_user_code(code, entry)
    return _norm(fn(*copy.deepcopy(case.get("args", []))))


_SPARK = None

_SPARK_TYPES = {
    "INT": "IntegerType", "INTEGER": "IntegerType", "BIGINT": "LongType",
    "DOUBLE": "DoubleType", "FLOAT": "DoubleType", "VARCHAR": "StringType",
    "STRING": "StringType", "BOOLEAN": "BooleanType", "DATE": "DateType",
    "TIMESTAMP": "TimestampType",
}


def _spark():
    global _SPARK
    if _SPARK is None:
        from sqlframe import activate
        activate(engine="duckdb")
        from pyspark.sql import SparkSession
        _SPARK = SparkSession.builder.getOrCreate()
    return _SPARK


def _spark_df(spark, table):
    from pyspark.sql import types as T

    schema = T.StructType([
        T.StructField(n, getattr(T, _SPARK_TYPES[typ.upper()])(), True) for n, typ in table["columns"]
    ])
    rows = [tuple(_cast(v, typ) for v, (_, typ) in zip(r, table["columns"])) for r in table["rows"]]
    return spark.createDataFrame(rows, schema=schema)


def _run_pyspark(code, entry, case):
    spark = _spark()
    fn = _exec_user_code(code, entry)
    dfs = [_spark_df(spark, t) for t in case.get("tables", [])]
    out = fn(spark, *dfs)
    if not hasattr(out, "collect") or not hasattr(out, "columns"):
        raise TypeError(f"`{entry}` must return a DataFrame, got {type(out).__name__}.")
    columns = list(out.columns)
    rows = [[_norm(v) for v in tuple(r)] for r in out.collect()]
    return {"columns": columns, "rows": rows}


# pandas: SQL-ish column types → pandas dtypes that keep NULLs as missing values.
_PANDAS_TYPES = {
    "INT": "Int64", "INTEGER": "Int64", "BIGINT": "Int64", "DOUBLE": "float64", "FLOAT": "float64",
    "VARCHAR": "string", "STRING": "string", "BOOLEAN": "boolean",
}


def _pandas_df(table):
    import pandas as pd

    names = [n for n, _ in table["columns"]]
    df = pd.DataFrame(table["rows"], columns=names, dtype=object)
    for n, typ in table["columns"]:
        t = typ.upper()
        if t.startswith("TIMESTAMP") or t == "DATE":
            df[n] = pd.to_datetime(df[n])
        elif t in _PANDAS_TYPES:
            df[n] = df[n].astype(_PANDAS_TYPES[t])
    return df


def _run_pandas(code, entry, case):
    fn = _exec_user_code(code, entry)
    dfs = [_pandas_df(t) for t in case.get("tables", [])]
    out = fn(*dfs)
    if not (hasattr(out, "columns") and hasattr(out, "itertuples")):
        raise TypeError(f"`{entry}` must return a pandas DataFrame, got {type(out).__name__}.")
    columns = [str(c) for c in out.columns]
    rows = [[_norm(v) for v in r] for r in out.itertuples(index=False, name=None)]
    return {"columns": columns, "rows": rows}


# --- entry point --------------------------------------------------------------

def _clip_table(t):
    if not isinstance(t, dict) or "rows" not in t:
        return t
    return {"columns": t["columns"], "rows": t["rows"][:MAX_ROWS_SHOWN], "total": len(t["rows"])}


def _user_traceback():
    """Traceback limited to frames from the learner's code."""
    tb = traceback.format_exc()
    lines = tb.splitlines()
    for i, line in enumerate(lines):
        if '"solution.py"' in line:
            return "Traceback (most recent call last):\n" + "\n".join(lines[i:])
    return lines[-1] if lines else tb


def run(payload_json):
    payload = json.loads(payload_json)
    track, code, entry = payload["track"], payload["code"], payload.get("entry")
    results = []
    for case in payload["tests"]:
        out = io.StringIO()
        start = time.perf_counter()
        res = {"name": case["name"], "hidden": bool(case.get("hidden"))}
        try:
            with contextlib.redirect_stdout(out):
                if track == "sql":
                    actual = _run_sql(code, case)
                elif track == "python":
                    actual = _run_python(code, entry, case)
                elif track == "pyspark":
                    actual = _run_pyspark(code, entry, case)
                elif track == "pandas":
                    actual = _run_pandas(code, entry, case)
                else:
                    raise ValueError(f"Unknown track {track!r}")
            if track == "python":
                ok, msg = _compare_values(actual, case["expected"])
            else:
                ok, msg = _compare_tables(actual, case["expected"], case.get("ordered", False))
                actual = _clip_table(actual)
            res.update(status="passed" if ok else "failed", message=msg, actual=actual)
        except Exception as e:  # noqa: BLE001 — learner code can raise anything
            res.update(status="error", message=f"{type(e).__name__}: {e}", traceback=_user_traceback())
        res["ms"] = round((time.perf_counter() - start) * 1000, 1)
        res["stdout"] = out.getvalue()[:MAX_STDOUT]
        results.append(res)
    return json.dumps(results, default=str)
