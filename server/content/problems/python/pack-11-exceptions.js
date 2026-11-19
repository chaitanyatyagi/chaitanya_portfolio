// Python pack 11 — exception handling: try / except / else / finally, the
// exception hierarchy, raise, user-defined exceptions, chaining (raise … from),
// printing exception information (traceback), EAFP vs LBYL, assertions, and
// fault-tolerant loading with error budgets.
import { python, md, code, ex, hid } from './define.js';
import { dev, tag } from './sources.js';

const DE = ['Data Engineer'];

export default {
  problems: [
    python({
      id: 'safe-divide-report',
      title: 'Divide Safely and Report Every Failure',
      difficulty: 'Easy',
      topics: ['Error Handling'],
      patterns: ['Catch specific exceptions'],
      domains: ['Finance'],
      roles: DE,
      summary: 'Compute ratios for messy pairs, catching each kind of failure separately.',
      description: md(
        'For each `[numerator, denominator]` pair (values may be numbers, numeric strings, junk strings or `None`), compute `round(float(n) / float(d), 3)`. Instead of crashing, record a label: `"divide by zero"` (ZeroDivisionError), `"not a number"` (ValueError), `"missing"` (TypeError). Return the list of results/labels.',
      ),
      hints: ['One `try` with several `except` clauses — most specific first. `float(None)` raises `TypeError`; `float("x")` raises `ValueError`.'],
      entry: 'ratios',
      signature: 'ratios(pairs: list[list]) -> list',
      solution: code`def ratios(pairs: list[list]) -> list:
    out = []
    for n, d in pairs:
        try:
            out.append(round(float(n) / float(d), 3))
        except ZeroDivisionError:
            out.append("divide by zero")
        except ValueError:
            out.append("not a number")
        except TypeError:
            out.append("missing")
    return out
`,
      explanation: md('Catch exactly the errors you expect and can handle, each with its own response. A bare `except:` would also swallow bugs (and even `KeyboardInterrupt`), turning crashes into silently wrong data.'),
      tests: [
        ex('Example', [[10, 4], [1, 0], ['3', '2'], ['x', 1], [null, 2]]),
        ex('All good', [[1, 3]]),
        hid('Zero numerator is fine', [[0, 5]]),
        hid('Float zero', [['1.5', '0.0']]),
        hid('Empty', []),
      ],
    }),

    python({
      id: 'try-except-else-finally-trace',
      title: 'Trace try / except / else / finally',
      difficulty: 'Medium',
      topics: ['Error Handling'],
      patterns: ['Control flow of exception handling'],
      domains: ['Developer tools'],
      roles: DE,
      summary: 'Record which blocks run — and what is returned — for each way a try statement can end.',
      description: md(
        'Implement `attempt(action, trace)` with a `try` / `except ValueError` / `else` / `finally` statement that appends `"try"`, `"except"`, `"else"` and `"finally"` to `trace` as each block runs. In the `try` block:',
        '',
        '- `"ok"` → do nothing special;',
        '- `"value"` → `raise ValueError`;',
        '- `"key"` → `raise KeyError` (not caught here);',
        '- `"return"` → `return "from try"` (the finally block still runs).',
        '',
        'The `except` block returns `"handled"`, the `else` block returns `"no error"`. `run(actions)` returns `[result_or_escaped_error_name, trace]` per action.',
      ),
      hints: ['`else` runs only if the `try` block finished without an exception (and without returning).', '`finally` always runs — even on `return` or an uncaught exception.'],
      entry: 'run',
      signature: 'run(actions: list[str]) -> list',
      starter: code`def attempt(action, trace):
    pass


# The tests call run(); don't change it.
def run(actions):
    out = []
    for a in actions:
        trace = []
        try:
            result = attempt(a, trace)
        except Exception as e:
            result = type(e).__name__
        out.append([result, trace])
    return out
`,
      solution: code`def attempt(action, trace):
    try:
        trace.append("try")
        if action == "value":
            raise ValueError("bad value")
        if action == "key":
            raise KeyError("missing")
        if action == "return":
            return "from try"
    except ValueError:
        trace.append("except")
        return "handled"
    else:
        trace.append("else")
        return "no error"
    finally:
        trace.append("finally")


def run(actions):
    out = []
    for a in actions:
        trace = []
        try:
            result = attempt(a, trace)
        except Exception as e:
            result = type(e).__name__
        out.append([result, trace])
    return out
`,
      explanation: md(
        '- no error → try, else, finally;',
        '- handled error → try, except, finally;',
        '- unhandled error → try, finally, then the exception propagates;',
        '- `return` inside try → try, finally (else is skipped).',
        '',
        'Putting the "success" code in `else` (rather than at the end of `try`) keeps the `try` block small, so the `except` can\'t accidentally catch errors from it.',
      ),
      tests: [
        ex('All four paths', ['ok', 'value', 'key', 'return']),
        ex('Only success', ['ok']),
        hid('Uncaught error', ['key']),
        hid('Early return', ['return', 'value']),
      ],
    }),

    python({
      id: 'custom-exception-hierarchy',
      title: 'A Hierarchy of Validation Errors',
      difficulty: 'Medium',
      topics: ['Error Handling', 'Inheritance & MRO'],
      patterns: ['User-defined exception classes'],
      domains: ['Data quality'],
      roles: DE,
      summary: 'Define ValidationError subclasses carrying context, and catch them at the right level.',
      description: md(
        'Define `ValidationError(Exception)` with attributes `field` and `row`, and subclasses `MissingField`, `BadType` and `OutOfRange`. `validate(row_no, record)` checks, in this order: `"id"` present (else `MissingField`), `"amount"` present (else `MissingField`), `amount` is int/float but not bool (else `BadType`), `0 <= amount <= 10_000` (else `OutOfRange`).',
        '',
        '`run(records)` validates each record and returns `[valid_ids, errors]` where each error is `[class name, field, row]`, plus a final count of how many were caught by `except ValidationError` (all of them).',
      ),
      hints: ['Store context in `__init__` and call `super().__init__(message)`.', 'Catching the base class catches every subclass.'],
      entry: 'run',
      signature: 'run(records: list[dict]) -> list',
      starter: code`class ValidationError(Exception):
    pass

class MissingField(ValidationError):
    pass

class BadType(ValidationError):
    pass

class OutOfRange(ValidationError):
    pass

def validate(row_no, record):
    pass


# The tests call run(); don't change it.
def run(records):
    valid, errors, caught = [], [], 0
    for i, rec in enumerate(records, start=1):
        try:
            validate(i, rec)
            valid.append(rec["id"])
        except ValidationError as e:
            caught += 1
            errors.append([type(e).__name__, e.field, e.row])
    return [valid, errors, caught]
`,
      solution: code`class ValidationError(Exception):
    def __init__(self, field, row, message):
        super().__init__(f"row {row}: {field}: {message}")
        self.field = field
        self.row = row

class MissingField(ValidationError):
    pass

class BadType(ValidationError):
    pass

class OutOfRange(ValidationError):
    pass

def validate(row_no, record):
    for field in ("id", "amount"):
        if field not in record:
            raise MissingField(field, row_no, "is required")
    amount = record["amount"]
    if isinstance(amount, bool) or not isinstance(amount, (int, float)):
        raise BadType("amount", row_no, f"expected a number, got {type(amount).__name__}")
    if not 0 <= amount <= 10_000:
        raise OutOfRange("amount", row_no, f"{amount} not in [0, 10000]")


def run(records):
    valid, errors, caught = [], [], 0
    for i, rec in enumerate(records, start=1):
        try:
            validate(i, rec)
            valid.append(rec["id"])
        except ValidationError as e:
            caught += 1
            errors.append([type(e).__name__, e.field, e.row])
    return [valid, errors, caught]
`,
      explanation: md('A small hierarchy lets callers choose their granularity: `except OutOfRange` for one case, `except ValidationError` for all of them. Carrying `field` and `row` on the exception keeps the error report structured instead of parsing message strings.'),
      tests: [
        ex('Example', [{ id: 1, amount: 50 }, { amount: 5 }, { id: 3, amount: '5' }, { id: 4, amount: 20000 }]),
        ex('All valid', [{ id: 'a', amount: 0 }, { id: 'b', amount: 10000 }]),
        hid('Bool amount', [{ id: 1, amount: true }]),
        hid('Missing amount', [{ id: 9 }]),
        hid('Empty', []),
      ],
    }),

    python({
      id: 'exception-chaining',
      title: 'Chain Exceptions with raise … from',
      difficulty: 'Medium',
      topics: ['Error Handling'],
      patterns: ['Exception chaining'],
      domains: ['APIs / Integration'],
      roles: DE,
      summary: 'Wrap low-level errors in a domain error while keeping the original cause.',
      description: md(
        'Define `LoadError(Exception)`. `load(raw)` parses `raw` as JSON and returns `doc["rows"]` as a list of ints. Wrap failures with `raise LoadError(...) from err` so the original exception becomes `__cause__`:',
        '',
        '- invalid JSON → `LoadError("bad json")` from the `json.JSONDecodeError`;',
        '- missing `"rows"` → `LoadError("no rows")` from the `KeyError`;',
        '- a row that isn\'t an integer → `LoadError("bad row")` from the `ValueError`/`TypeError`.',
        '',
        '`run(inputs)` returns the rows, or the chain `[message, cause class name, ...]` walking `__cause__` until `None`.',
      ),
      hints: ['`int(x)` raises `ValueError` for `"x"` and `TypeError` for `None`; catch both.', '`raise New(...) from old` sets `New.__cause__ = old`.'],
      entry: 'run',
      signature: 'run(inputs: list[str]) -> list',
      starter: code`import json

class LoadError(Exception):
    pass

def load(raw):
    pass


# The tests call run(); don't change it.
def run(inputs):
    out = []
    for raw in inputs:
        try:
            out.append(load(raw))
        except LoadError as e:
            chain, err = [str(e)], e.__cause__
            while err is not None:
                chain.append(type(err).__name__)
                err = err.__cause__
            out.append(chain)
    return out
`,
      solution: code`import json

class LoadError(Exception):
    pass

def load(raw):
    try:
        doc = json.loads(raw)
    except json.JSONDecodeError as err:
        raise LoadError("bad json") from err
    try:
        rows = doc["rows"]
    except KeyError as err:
        raise LoadError("no rows") from err
    try:
        return [int(r) for r in rows]
    except (ValueError, TypeError) as err:
        raise LoadError("bad row") from err


def run(inputs):
    out = []
    for raw in inputs:
        try:
            out.append(load(raw))
        except LoadError as e:
            chain, err = [str(e)], e.__cause__
            while err is not None:
                chain.append(type(err).__name__)
                err = err.__cause__
            out.append(chain)
    return out
`,
      explanation: md('Callers of `load` shouldn\'t need to know about JSON or KeyError — they get one domain exception. `from err` keeps the root cause attached, so tracebacks show "The above exception was the direct cause of …". Use `from None` to deliberately hide it.'),
      tests: [
        ex('Example', ['{"rows": [1, "2", 3]}', '{oops', '{"count": 2}', '{"rows": [1, "x"]}']),
        ex('Empty rows', ['{"rows": []}']),
        hid('Null row', ['{"rows": [null]}']),
        hid('Floats truncate', ['{"rows": [1.9, -2.5]}']),
      ],
    }),

    python({
      id: 'exception-hierarchy-paths',
      title: 'Where Does This Exception Sit in the Hierarchy?',
      difficulty: 'Medium',
      topics: ['Error Handling', 'Inheritance & MRO'],
      patterns: ['Introspecting built-in classes'],
      domains: ['Developer tools'],
      roles: DE,
      summary: 'Walk built-in exception classes up to BaseException and check what except-clauses catch them.',
      description: md(
        'For each built-in exception name, return `[path, caught_by_except_Exception, caught_by_except_LookupError, caught_by_except_ArithmeticError]` where `path` is its class chain from itself up to `BaseException` (follow `__mro__`, skip `object`). Unknown names return `"unknown"`.',
      ),
      hints: ['`import builtins; getattr(builtins, name, None)` finds the class; check `issubclass(cls, BaseException)`.', '`issubclass(KeyError, LookupError)` is what decides whether `except LookupError` catches it.'],
      entry: 'classify',
      signature: 'classify(names: list[str]) -> list',
      solution: code`import builtins

def classify(names: list[str]) -> list:
    out = []
    for name in names:
        cls = getattr(builtins, name, None)
        if not (isinstance(cls, type) and issubclass(cls, BaseException)):
            out.append("unknown")
            continue
        path = [c.__name__ for c in cls.__mro__ if c is not object]
        out.append([path, issubclass(cls, Exception), issubclass(cls, LookupError), issubclass(cls, ArithmeticError)])
    return out
`,
      explanation: md('`except X` catches X **and its subclasses**, so knowing the hierarchy tells you what a clause catches: `except LookupError` covers `KeyError` and `IndexError`; `except Exception` does not catch `KeyboardInterrupt` or `SystemExit` (they derive from `BaseException` directly) — which is exactly why `except Exception` is preferred over a bare `except`.'),
      tests: [
        ex('Example', ['KeyError', 'ZeroDivisionError', 'KeyboardInterrupt']),
        ex('Unknown name', ['NotAnError', 'len']),
        hid('Deep hierarchies', ['FileNotFoundError', 'UnicodeDecodeError']),
        hid('Base classes', ['Exception', 'BaseException']),
      ],
    }),

    python({
      id: 'fault-tolerant-pipe-file',
      title: 'Load a Pipe-Delimited File without Crashing',
      difficulty: 'Medium',
      topics: ['Error Handling', 'Parsing (CSV / JSON)'],
      patterns: ['Quarantine bad rows'],
      domains: ['Event pipelines'],
      ...tag(dev('Microsoft', 'parsed pipe file with an integer second field; counting valid rows')),
      roles: DE,
      summary: 'Parse name|count|price lines, keep the good rows and tally why the others failed.',
      description: md(
        'Each line of `text` should be `name|count|price` (count an int, price a float). Skip blank lines. Return `[rows, problems]`: `rows` holds `[name, count, price]` for valid lines; `problems` maps a reason to how many lines failed for it (only reasons that occurred, sorted by reason):',
        '',
        '- `"fields"` — not exactly 3 fields; `"count"` — count isn\'t an integer; `"price"` — price isn\'t a number; `"negative"` — count or price below zero; `"name"` — empty name after stripping.',
        '',
        'Check in that order and report only the first problem per line.',
      ),
      hints: ['Raise a small `BadLine(reason)` exception from the parser and catch it in the loop — the loop stays tidy.'],
      entry: 'load',
      signature: 'load(text: str) -> list',
      solution: code`class BadLine(Exception):
    def __init__(self, reason):
        super().__init__(reason)
        self.reason = reason

def parse(line):
    parts = line.split("|")
    if len(parts) != 3:
        raise BadLine("fields")
    name, count, price = (p.strip() for p in parts)
    try:
        count = int(count)
    except ValueError:
        raise BadLine("count") from None
    try:
        price = float(price)
    except ValueError:
        raise BadLine("price") from None
    if count < 0 or price < 0:
        raise BadLine("negative")
    if not name:
        raise BadLine("name")
    return [name, count, price]

def load(text: str) -> list:
    rows, problems = [], {}
    for line in text.splitlines():
        if not line.strip():
            continue
        try:
            rows.append(parse(line))
        except BadLine as e:
            problems[e.reason] = problems.get(e.reason, 0) + 1
    return [rows, dict(sorted(problems.items()))]
`,
      explanation: md('A pipeline should never die because of one bad row — but it must not hide bad rows either. Counting failures by reason gives an actionable data-quality report. `from None` suppresses the noisy inner `ValueError` context, since the reason already says what went wrong.'),
      tests: [
        ex('Example', 'tea|3|2.5\ncake|x|4\n\nbun|2\njam|-1|3\n |1|1\nmilk|1|abc'),
        ex('All good', 'a|1|1.0\nb|0|0'),
        hid('Empty', ''),
        hid('Extra fields', 'a|1|1|1\nb|1|1'),
        hid('Spaces around fields', '  x | 7 | 0.5 '),
      ],
    }),

    python({
      id: 'raise-validation-errors',
      title: 'Raise the Right Error for Bad Input',
      difficulty: 'Easy',
      topics: ['Error Handling'],
      patterns: ['raise with a message'],
      domains: ['HR / People'],
      roles: DE,
      summary: 'Validate a birth year by raising TypeError or ValueError with clear messages.',
      description: md(
        'Write `age_in(year_of_birth, current_year)` that returns the age, but **raises**:',
        '',
        '- `TypeError("year must be an int")` if `year_of_birth` isn\'t an int (bools count as not an int);',
        '- `ValueError("year in the future")` if it is after `current_year`;',
        '- `ValueError("implausible age")` if the age would be over 130.',
        '',
        '`run(years, current)` returns ages or `"<ErrorName>: <message>"`.',
      ),
      hints: ['`TypeError` is for the wrong kind of value, `ValueError` for the right kind with a bad value.'],
      entry: 'run',
      signature: 'run(years: list, current: int) -> list',
      starter: code`def age_in(year_of_birth, current_year):
    pass


# The tests call run(); don't change it.
def run(years, current):
    out = []
    for y in years:
        try:
            out.append(age_in(y, current))
        except (TypeError, ValueError) as e:
            out.append(f"{type(e).__name__}: {e}")
    return out
`,
      solution: code`def age_in(year_of_birth, current_year):
    if isinstance(year_of_birth, bool) or not isinstance(year_of_birth, int):
        raise TypeError("year must be an int")
    if year_of_birth > current_year:
        raise ValueError("year in the future")
    age = current_year - year_of_birth
    if age > 130:
        raise ValueError("implausible age")
    return age


def run(years, current):
    out = []
    for y in years:
        try:
            out.append(age_in(y, current))
        except (TypeError, ValueError) as e:
            out.append(f"{type(e).__name__}: {e}")
    return out
`,
      explanation: md('Raising early with a precise exception type and message ("fail fast") is far easier to debug than returning `None` or `-1` and letting a bad value flow downstream. Callers catch exactly the cases they can handle.'),
      tests: [
        ex('Example', [1990, '1990', 2030, 1800], 2025),
        ex('Same year', [2025], 2025),
        hid('Bool rejected', [true], 2025),
        hid('Boundary of plausibility', [1895, 1894], 2025),
      ],
    }),

    python({
      id: 'format-exception-info',
      title: 'Print Exception Information Like a Pro',
      difficulty: 'Medium',
      topics: ['Error Handling', 'Logging'],
      patterns: ['traceback.extract_tb'],
      domains: ['Developer tools'],
      roles: DE,
      summary: 'Run a snippet, catch what it raises, and report type, message, function and line number.',
      description: md(
        'Write `run_snippet(source)` that executes `source` (compiled with filename `"job.py"`) and returns `"ok"` if it raised nothing. Otherwise return `[ExceptionType, message, function_name, line_number]` for the **innermost frame inside `job.py`** — the line that actually raised.',
        '',
        'This is what an `excepthook` or error reporter does with `sys.exc_info()`.',
      ),
      hints: ['`exec(compile(source, "job.py", "exec"), {})`.', '`traceback.extract_tb(e.__traceback__)` gives frames with `.filename`, `.name`, `.lineno`; keep the last one from `job.py`.'],
      entry: 'run_snippet',
      signature: 'run_snippet(source: str) -> list',
      solution: code`import traceback

def run_snippet(source: str):
    try:
        exec(compile(source, "job.py", "exec"), {})
    except Exception as e:
        frames = [f for f in traceback.extract_tb(e.__traceback__) if f.filename == "job.py"]
        last = frames[-1]
        return [type(e).__name__, str(e), last.name, last.lineno]
    return "ok"
`,
      explanation: md('Every exception carries its traceback (`e.__traceback__`). `traceback.extract_tb` turns it into structured frames, so an error reporter can show the file, function and line without parsing text. Module-level code shows up as the function `"<module>"`.'),
      tests: [
        ex('Error inside a function', 'def load(rows):\n    total = 0\n    for r in rows:\n        total += r["qty"]\n    return total\n\nload([{"qty": 1}, {}])\n'),
        ex('No error', 'x = 1 + 1\n'),
        hid('Module-level error', 'a = 1\nb = a / 0\n'),
        hid('Nested calls', 'def inner():\n    raise ValueError("bad config")\n\ndef outer():\n    inner()\n\nouter()\n'),
      ],
    }),

    python({
      id: 'eafp-nested-lookup',
      title: 'EAFP: Ask Forgiveness for Nested Lookups',
      difficulty: 'Easy',
      topics: ['Error Handling', 'Parsing (CSV / JSON)'],
      patterns: ['EAFP (try first)'],
      domains: ['APIs / Integration'],
      ...tag(dev('Oracle', 'dicts for JSON extraction')),
      roles: DE,
      summary: 'Pull values out of nested API responses with try/except instead of a chain of checks.',
      description: md(
        'Write `get_path(doc, path, default)` where `path` is a list of keys and list indexes, e.g. `["data", "items", 0, "price"]`. Return the value, or `default` if any step is missing — a missing key, an index out of range, or indexing into something that isn\'t a container.',
        '',
        'Use one `try` block around the whole walk ("Easier to Ask Forgiveness than Permission"). `run(doc, paths, default)` returns each lookup.',
      ),
      hints: ['Missing key → `KeyError`; bad index → `IndexError`; indexing an int or using a string key on a list → `TypeError`.'],
      entry: 'run',
      signature: 'run(doc, paths: list[list], default) -> list',
      starter: code`def get_path(doc, path, default):
    pass


# The tests call run(); don't change it.
def run(doc, paths, default):
    return [get_path(doc, p, default) for p in paths]
`,
      solution: code`def get_path(doc, path, default):
    try:
        node = doc
        for step in path:
            node = node[step]
        return node
    except (KeyError, IndexError, TypeError):
        return default


def run(doc, paths, default):
    return [get_path(doc, p, default) for p in paths]
`,
      explanation: md('LBYL ("look before you leap") would need `isinstance` and `in`/`len` checks at every level. EAFP tries the natural code and handles the few failure types — shorter, and faster on the common path where the data is well-formed.'),
      tests: [
        ex('Example', { data: { items: [{ price: 9.5 }] } }, [['data', 'items', 0, 'price'], ['data', 'items', 3, 'price'], ['data', 'count']], null),
        ex('Wrong container type', { a: [1, 2] }, [['a', 'x'], ['a', 0, 'b']], 'n/a'),
        hid('Empty path returns the document', { k: 1 }, [[]], 0),
        hid('Falsy values are real values', { z: 0, f: false }, [['z'], ['f']], 'missing'),
      ],
    }),

    python({
      id: 'assertion-checks',
      title: 'Data Checks with assert',
      difficulty: 'Easy',
      topics: ['Error Handling', 'Data Wrangling'],
      patterns: ['Assertions as checks'],
      domains: ['Data quality'],
      roles: DE,
      summary: 'Run a set of named assert-based checks over a batch and collect the failures.',
      description: md(
        'Each check is a function that uses `assert condition, "message"`. Write `run_checks(rows)` running these on a batch of order rows and returning the sorted failure messages:',
        '',
        '- the batch is non-empty — `"empty batch"`;',
        '- every `id` is unique — `"duplicate ids"`;',
        '- every `total` equals `qty * price` (within 0.01) — `"total mismatch"`;',
        '- no `status` outside `{"new", "paid", "shipped"}` — `"bad status"`.',
        '',
        'One failing check must not stop the others.',
      ),
      hints: ['Wrap each check call in `try / except AssertionError as e` and collect `str(e)`.', 'Note: `python -O` strips asserts, so production validation should raise real exceptions — this is for tests and notebooks.'],
      entry: 'run_checks',
      signature: 'run_checks(rows: list[dict]) -> list[str]',
      solution: code`def check_not_empty(rows):
    assert rows, "empty batch"

def check_unique_ids(rows):
    ids = [r["id"] for r in rows]
    assert len(ids) == len(set(ids)), "duplicate ids"

def check_totals(rows):
    assert all(abs(r["qty"] * r["price"] - r["total"]) <= 0.01 for r in rows), "total mismatch"

def check_status(rows):
    assert all(r["status"] in {"new", "paid", "shipped"} for r in rows), "bad status"

CHECKS = [check_not_empty, check_unique_ids, check_totals, check_status]

def run_checks(rows: list[dict]) -> list[str]:
    failures = []
    for check in CHECKS:
        try:
            check(rows)
        except AssertionError as e:
            failures.append(str(e))
    return sorted(failures)
`,
      explanation: md('`assert` raises `AssertionError(message)` when the condition is false. Running each check in its own `try` gives a complete report rather than stopping at the first problem. Remember that assertions can be disabled with `-O`, so never use them for checks that must always run in production.'),
      tests: [
        ex('Example', [{ id: 1, qty: 2, price: 5, total: 10, status: 'new' }, { id: 1, qty: 1, price: 3, total: 4, status: 'lost' }]),
        ex('Clean batch', [{ id: 1, qty: 1, price: 1.25, total: 1.25, status: 'paid' }]),
        hid('Empty batch', []),
        hid('Rounding tolerance', [{ id: 'a', qty: 3, price: 0.1, total: 0.3, status: 'shipped' }]),
      ],
    }),

    python({
      id: 'insufficient-funds-exception',
      title: 'A User-Defined Exception with Context',
      difficulty: 'Easy',
      topics: ['Error Handling', 'OOP'],
      patterns: ['User-defined exception'],
      domains: ['Payments'],
      roles: DE,
      summary: 'Raise an InsufficientFunds error that knows the balance and the shortfall.',
      description: md(
        'Define `InsufficientFunds(Exception)` holding `balance` and `requested`, with a `shortfall` property and `__str__` → `"need <shortfall> more (balance <balance>)"`. `pay(balance, amount)` returns the new balance or raises it.',
        '',
        '`run(balance, payments)` applies payments in order; a failed payment is skipped and reported. Return `[final_balance, messages]`.',
      ),
      hints: ['Exceptions are classes: you can add attributes, properties and `__str__` like any other class.'],
      entry: 'run',
      signature: 'run(balance: float, payments: list[float]) -> list',
      starter: code`class InsufficientFunds(Exception):
    pass

def pay(balance, amount):
    pass


# The tests call run(); don't change it.
def run(balance, payments):
    messages = []
    for amount in payments:
        try:
            balance = pay(balance, amount)
        except InsufficientFunds as e:
            messages.append(str(e))
    return [balance, messages]
`,
      solution: code`class InsufficientFunds(Exception):
    def __init__(self, balance, requested):
        super().__init__(balance, requested)
        self.balance = balance
        self.requested = requested

    @property
    def shortfall(self):
        return round(self.requested - self.balance, 2)

    def __str__(self):
        return f"need {self.shortfall} more (balance {self.balance})"

def pay(balance, amount):
    if amount > balance:
        raise InsufficientFunds(balance, amount)
    return round(balance - amount, 2)


def run(balance, payments):
    messages = []
    for amount in payments:
        try:
            balance = pay(balance, amount)
        except InsufficientFunds as e:
            messages.append(str(e))
    return [balance, messages]
`,
      explanation: md('A domain exception with data is much more useful to callers than `ValueError("not enough")`: they can show the shortfall, retry with a smaller amount, or route to a top-up flow — without parsing the message.'),
      tests: [
        ex('Example', 100, [30, 80, 50]),
        ex('Exact balance', 10, [10, 0.01]),
        hid('No payments', 5, []),
        hid('Decimals', 1.5, [0.75, 1]),
      ],
    }),

    python({
      id: 'error-budget-abort',
      title: 'Abort a Load When the Error Budget Is Spent',
      difficulty: 'Medium',
      topics: ['Error Handling', 'Streaming & State'],
      patterns: ['Error budget', 'Custom exception to abort'],
      domains: ['Event pipelines'],
      roles: DE,
      summary: 'Skip bad records but stop the whole job once failures exceed a percentage.',
      description: md(
        'Process records (each must have an int `"qty"` > 0). Bad records are skipped, but once more than `max_error_pct` percent of the records **seen so far** are bad — checked after each record, and only after at least `min_records` have been seen — raise `PipelineAborted(processed, failed)`.',
        '',
        'Return `["ok", total_qty, failed]` or `["aborted", processed, failed]` from the exception\'s attributes.',
      ),
      hints: ['Keep counters for seen and failed records; compute `failed / seen * 100` after each record.'],
      entry: 'run',
      signature: 'run(records: list[dict], max_error_pct: float, min_records: int) -> list',
      starter: code`class PipelineAborted(Exception):
    pass

def process(records, max_error_pct, min_records):
    pass


# The tests call run(); don't change it.
def run(records, max_error_pct, min_records):
    try:
        total, failed = process(records, max_error_pct, min_records)
        return ["ok", total, failed]
    except PipelineAborted as e:
        return ["aborted", e.processed, e.failed]
`,
      solution: code`class PipelineAborted(Exception):
    def __init__(self, processed, failed):
        super().__init__(f"aborted after {processed} records ({failed} failed)")
        self.processed = processed
        self.failed = failed

def process(records, max_error_pct, min_records):
    total = seen = failed = 0
    for rec in records:
        seen += 1
        qty = rec.get("qty")
        if isinstance(qty, int) and not isinstance(qty, bool) and qty > 0:
            total += qty
        else:
            failed += 1
        if seen >= min_records and failed / seen * 100 > max_error_pct:
            raise PipelineAborted(seen, failed)
    return total, failed


def run(records, max_error_pct, min_records):
    try:
        total, failed = process(records, max_error_pct, min_records)
        return ["ok", total, failed]
    except PipelineAborted as e:
        return ["aborted", e.processed, e.failed]
`,
      explanation: md('A few bad rows are normal; a flood of them usually means an upstream change (new schema, wrong file). An error budget tolerates the first and stops on the second, and the minimum sample size avoids aborting because the very first record happened to be bad.'),
      tests: [
        ex('Within budget', [{ qty: 1 }, { qty: 2 }, { qty: 0 }, { qty: 4 }, { qty: 5 }], 40, 2),
        ex('Aborts', [{ qty: 1 }, { qty: 'x' }, {}, { qty: 1 }], 30, 3),
        hid('Minimum sample protects early failures', [{}, { qty: 1 }, { qty: 1 }, { qty: 1 }], 40, 3),
        hid('Empty', [], 10, 1),
      ],
    }),
  ],
};
