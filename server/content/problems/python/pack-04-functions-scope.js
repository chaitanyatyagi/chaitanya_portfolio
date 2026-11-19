// Python pack 4 — functions in depth: positional / keyword / default /
// variable-length arguments, mutable defaults, return values, functions as
// objects, nested functions, scope (LEGB, global, nonlocal), globals() and
// `if __name__ == "__main__"`.
//
// Where the behaviour being taught only shows up through how a function is
// *called* (keyword arguments, repeated calls, defaults), the starter includes a
// small driver — `run(...)` — that the tests call. Learners edit the function
// above it, not the driver.
import { python, md, code, ex, hid } from './define.js';
import { dev, lds, tag } from './sources.js';

const DE = ['Data Engineer'];

export default {
  problems: [
    python({
      id: 'build-request-url',
      title: 'Build a URL from *args and **kwargs',
      difficulty: 'Easy',
      topics: ['Arguments & Scope', 'Strings'],
      patterns: ['Variable-length arguments'],
      domains: ['APIs / Integration'],
      roles: DE,
      summary: 'Write a function that takes any number of path segments and query parameters.',
      description: md(
        'Implement `build_url(base, *segments, **params)`:',
        '',
        '- join `base` and every segment with exactly one `/` between them (strip slashes at the joins);',
        '- add the query parameters sorted by name as `?k=v&k2=v2`, **skipping parameters whose value is `None`**;',
        '- no `?` when there are no parameters left.',
        '',
        '```python',
        'build_url("https://api.x.io/", "v1", "/orders", limit=50, cursor=None)',
        '# "https://api.x.io/v1/orders?limit=50"',
        '```',
        '',
        'The tests call `run(base, segments, params)`, which unpacks into your function.',
      ),
      hints: [
        '`*segments` arrives as a tuple and `**params` as a dict.',
        "`'/'.join(part.strip('/') for part in ...)`; for the base, only strip the right-hand slash.",
      ],
      entry: 'run',
      signature: 'run(base: str, segments: list[str], params: dict) -> str',
      starter: code`def build_url(base, *segments, **params):
    pass


# The tests call run(); it unpacks each case into build_url. Don't change it.
def run(base, segments, params):
    return build_url(base, *segments, **params)
`,
      solution: code`def build_url(base, *segments, **params):
    url = "/".join([base.rstrip("/")] + [s.strip("/") for s in segments])
    query = "&".join(f"{k}={v}" for k, v in sorted(params.items()) if v is not None)
    return f"{url}?{query}" if query else url


def run(base, segments, params):
    return build_url(base, *segments, **params)
`,
      explanation: md(
        '`*segments` collects extra positional arguments into a tuple and `**params` collects extra keyword arguments into a dict, so callers can pass any number of each. The driver shows the mirror image: `*` and `**` at the **call** site unpack a list and a dict back into arguments.',
      ),
      tests: [
        ex('Example', 'https://api.x.io/', ['v1', '/orders'], { limit: 50, cursor: null }),
        ex('No segments, no params', 'https://h.io', [], {}),
        hid('Params sorted by name', 'https://h.io', ['a'], { z: 1, b: 'x', m: true }),
        hid('Only None params', 'https://h.io/', ['x/'], { a: null }),
      ],
    }),

    python({
      id: 'mutable-default-argument',
      title: 'Fix the Mutable Default Argument',
      difficulty: 'Easy',
      topics: ['Arguments & Scope', 'Copying & Mutability'],
      patterns: ['None as a default sentinel'],
      domains: ['Event pipelines'],
      roles: DE,
      summary: 'A helper leaks tags between calls because of a shared default list — fix it.',
      description: md(
        'This helper is supposed to return a **new** list of tags for every call that doesn\'t pass one:',
        '',
        '```python',
        'def add_tag(tag, tags=[]):',
        '    tags.append(tag)',
        '    return tags',
        '```',
        '',
        'But `add_tag("a")` then `add_tag("b")` returns `["a", "b"]` the second time. Fix `add_tag` so that each call without `tags` starts from an empty list, while a call **with** `tags` still appends to that list.',
        '',
        'The tests call `run(calls)`: each call is `[tag]` or `[tag, existing_list]`, and `run` returns what every call returned.',
      ),
      hints: [
        'Default values are evaluated **once**, when `def` runs — every call shares that one list.',
        'Use `tags=None` and create the list inside the function.',
      ],
      entry: 'run',
      signature: 'run(calls: list[list]) -> list[list[str]]',
      starter: code`def add_tag(tag, tags=[]):
    tags.append(tag)
    return tags


# The tests call run(); don't change it.
def run(calls):
    return [list(add_tag(*call)) for call in calls]
`,
      solution: code`def add_tag(tag, tags=None):
    if tags is None:
        tags = []
    tags.append(tag)
    return tags


def run(calls):
    return [list(add_tag(*call)) for call in calls]
`,
      explanation: md(
        'The default `[]` is created once, at function definition time, and stored on the function (`add_tag.__defaults__`). Mutating it mutates the default for every future call. The idiom is a `None` sentinel and a fresh object inside the body.',
        '',
        '`if tags is None` (not `if not tags`) matters: an explicitly passed empty list must still be appended to.',
      ),
      tests: [
        ex('Two independent calls', [['a'], ['b']]),
        ex('Passing a list appends to it', [['x', ['w']]]),
        hid('Empty list passed explicitly', [['a', []], ['b']]),
        hid('Many calls', [['1'], ['2'], ['3', ['0']], ['4']]),
      ],
    }),

    python({
      id: 'varargs-summary',
      title: 'Summarise Any Number of Values',
      difficulty: 'Easy',
      topics: ['Arguments & Scope', 'Functions & Lambdas'],
      patterns: ['Variable-length arguments'],
      domains: ['Reporting'],
      ...tag(lds('FedEx', 'fedex', 'Shipping Cost Descriptive Statistics by Service Level')),
      roles: DE,
      summary: 'A *args function returning count, min, max and mean — and what to do with zero arguments.',
      description: md(
        'Implement `summarize(*values, digits=2)` returning `{"count", "min", "max", "mean"}` with the mean rounded to `digits`. With **no** values, return `{"count": 0, "min": None, "max": None, "mean": None}`.',
        '',
        'The tests call `run(values, digits)`.',
      ),
      hints: ['`values` is a tuple; `len`, `min`, `max`, `sum` all accept it. Guard the empty case before calling `min`.', '`digits` comes after `*values`, so it can only be passed by keyword.'],
      entry: 'run',
      signature: 'run(values: list[float], digits: int) -> dict',
      starter: code`def summarize(*values, digits=2):
    pass


# The tests call run(); don't change it.
def run(values, digits):
    return summarize(*values, digits=digits)
`,
      solution: code`def summarize(*values, digits=2):
    if not values:
        return {"count": 0, "min": None, "max": None, "mean": None}
    return {
        "count": len(values),
        "min": min(values),
        "max": max(values),
        "mean": round(sum(values) / len(values), digits),
    }


def run(values, digits):
    return summarize(*values, digits=digits)
`,
      explanation: md('Any parameter after `*args` is **keyword-only** — `summarize(1, 2, 3)` can never accidentally bind `3` to `digits`. That is the main reason to put options after `*args`.'),
      tests: [
        ex('Example', [3, 1, 4, 1, 5], 2),
        ex('No values', [], 2),
        hid('Rounding digits', [1, 2, 2], 3),
        hid('Single value', [7.5], 0),
      ],
    }),

    python({
      id: 'keyword-only-dsn',
      title: 'Keyword-Only Options for a Connection String',
      difficulty: 'Easy',
      topics: ['Arguments & Scope'],
      patterns: ['Keyword-only arguments', 'Defaults'],
      domains: ['Database Access'],
      roles: DE,
      summary: 'Design a connect() helper whose options can only be passed by name.',
      description: md(
        'Implement `dsn(host, database, *, port=5432, user="etl", ssl=True, **extra)` returning a connection string:',
        '',
        '```',
        'postgres://<user>@<host>:<port>/<database>?sslmode=<require|disable>[&k=v ...]',
        '```',
        '',
        '`extra` options are appended after `sslmode`, sorted by name. The tests call `run(host, database, options)`, which passes `options` as keyword arguments.',
      ),
      hints: ['A bare `*` in the parameter list makes everything after it keyword-only.', '`sslmode` is `require` when `ssl` is true, else `disable`.'],
      entry: 'run',
      signature: 'run(host: str, database: str, options: dict) -> str',
      starter: code`def dsn(host, database, *, port=5432, user="etl", ssl=True, **extra):
    pass


# The tests call run(); don't change it.
def run(host, database, options):
    return dsn(host, database, **options)
`,
      solution: code`def dsn(host, database, *, port=5432, user="etl", ssl=True, **extra):
    query = [f"sslmode={'require' if ssl else 'disable'}"]
    query += [f"{k}={v}" for k, v in sorted(extra.items())]
    return f"postgres://{user}@{host}:{port}/{database}?{'&'.join(query)}"


def run(host, database, options):
    return dsn(host, database, **options)
`,
      explanation: md('Keyword-only parameters protect call sites from positional mistakes like `dsn("db", "prod", 5433, "admin")` silently meaning something else. `**extra` still accepts unknown options, which keeps the helper forward-compatible.'),
      tests: [
        ex('Defaults', 'db.local', 'sales', {}),
        ex('Overrides', 'db.local', 'sales', { port: 6432, user: 'admin', ssl: false }),
        hid('Extra options sorted', 'h', 'd', { connect_timeout: 5, application_name: 'etl' }),
        hid('ssl off with extras', 'h', 'd', { ssl: false, target_session_attrs: 'read-write' }),
      ],
    }),

    python({
      id: 'min-max-mean-tuple',
      title: 'Return Several Values at Once',
      difficulty: 'Easy',
      topics: ['Functions & Lambdas', 'Lists & Tuples'],
      patterns: ['Tuple return + unpacking'],
      domains: ['Reporting'],
      roles: DE,
      summary: 'Return the cheapest item, the most expensive item and the average price as one tuple.',
      description: md(
        '`prices` maps item → price (non-empty). Return a tuple `(cheapest_item, priciest_item, average_price)`; ties go to the alphabetically first item, and the average is rounded to 2 decimals. (The grader compares tuples as lists.)',
      ),
      hints: ['`min(prices, key=lambda k: (prices[k], k))` breaks ties by name.', 'A function "returns several values" by returning one tuple; callers unpack it.'],
      entry: 'price_extremes',
      signature: 'price_extremes(prices: dict[str, float]) -> tuple',
      solution: code`def price_extremes(prices: dict[str, float]) -> tuple:
    cheapest = min(prices, key=lambda k: (prices[k], k))
    priciest = min(prices, key=lambda k: (-prices[k], k))
    return cheapest, priciest, round(sum(prices.values()) / len(prices), 2)
`,
      explanation: md('`return a, b, c` builds a tuple; `lo, hi, avg = price_extremes(p)` unpacks it. For the maximum with an alphabetical tie-break, sorting by `(-price, name)` (or `min` with that key) avoids the awkwardness of reversing a string.'),
      tests: [
        ex('Example', { tea: 2.5, cake: 4.0, bun: 1.25 }),
        ex('Ties broken by name', { b: 1, a: 1, c: 3, d: 3 }),
        hid('Single item', { only: 9.99 }),
        hid('Average rounds to two places', { a: 1, b: 2, c: 2 }),
      ],
    }),

    python({
      id: 'dispatch-table',
      title: 'Functions Are Objects: a Dispatch Table',
      difficulty: 'Easy',
      topics: ['Functions & Lambdas', 'Dicts & Sets'],
      patterns: ['Dispatch table'],
      domains: ['Data quality'],
      roles: DE,
      summary: 'Replace an if/elif chain of transformations with a dict of functions.',
      description: md(
        'Apply a list of named cleaning steps to `value` in order and return the result. Steps: `"strip"`, `"lower"`, `"upper"`, `"title"`, `"collapse"` (single spaces between words), `"digits"` (keep only digits). If a step name is unknown, stop and return the string `"unknown step: <name>"`.',
      ),
      hints: ['Store the functions themselves in a dict: `{"strip": str.strip, ...}` — no parentheses, so nothing is called yet.', 'Unbound methods like `str.lower` take the string as their first argument.'],
      entry: 'clean',
      signature: 'clean(value: str, steps: list[str]) -> str',
      solution: code`STEPS = {
    "strip": str.strip,
    "lower": str.lower,
    "upper": str.upper,
    "title": str.title,
    "collapse": lambda s: " ".join(s.split()),
    "digits": lambda s: "".join(ch for ch in s if ch.isdigit()),
}

def clean(value: str, steps: list[str]) -> str:
    for name in steps:
        fn = STEPS.get(name)
        if fn is None:
            return f"unknown step: {name}"
        value = fn(value)
    return value
`,
      explanation: md('Functions are first-class objects: they can be stored in dicts, passed around and called later. A dispatch table turns a growing `if/elif` chain into data, and adding a step is one new entry.'),
      tests: [
        ex('Example', '  Hello   WORLD ', ['strip', 'collapse', 'lower']),
        ex('Digits only', 'tel: +91 98-76', ['digits']),
        hid('Unknown step', 'x', ['strip', 'reverse']),
        hid('No steps', ' raw ', []),
      ],
    }),

    python({
      id: 'nested-helper-function',
      title: 'Normalise Phone Numbers with a Nested Helper',
      difficulty: 'Easy',
      topics: ['Functions & Lambdas', 'Arguments & Scope', 'Strings'],
      patterns: ['Inner helper function'],
      domains: ['Marketing / CRM'],
      roles: DE,
      summary: 'Use an inner function that reads the outer function\'s country code.',
      description: md(
        'Normalise each raw phone number to E.164-like form `+<country><number>`:',
        '',
        '- keep only digits;',
        '- if what remains starts with `00`, drop the `00` (it already has a country code);',
        '- else if it starts with `0`, drop that one `0` and prefix `country_code`;',
        '- else if it has exactly 10 digits, prefix `country_code`;',
        '- otherwise it already includes a country code.',
        '',
        'Numbers with fewer than 8 digits are invalid — return `None` for them.',
      ),
      hints: ['Define `def fix(raw):` inside `normalise` so it can read `country_code` without passing it around.'],
      entry: 'normalise',
      signature: 'normalise(numbers: list[str], country_code: str) -> list',
      solution: code`def normalise(numbers: list[str], country_code: str) -> list:
    def fix(raw):
        digits = "".join(ch for ch in raw if ch.isdigit())
        if len(digits) < 8:
            return None
        if digits.startswith("00"):
            return "+" + digits[2:]
        if digits.startswith("0"):
            return "+" + country_code + digits[1:]
        if len(digits) == 10:
            return "+" + country_code + digits
        return "+" + digits

    return [fix(n) for n in numbers]
`,
      explanation: md('A nested function can **read** names from the enclosing function (here `country_code`) — that is the "E" in LEGB. It also keeps a helper that is only meaningful here out of the module namespace.'),
      tests: [
        ex('Example', ['098765 43210', '+44 20 7946 0958', '9876543210'], '91'),
        ex('International prefix', ['0044 20 7946 0958'], '91'),
        hid('Too short', ['12345'], '1'),
        hid('Empty list', [], '1'),
      ],
    }),

    python({
      id: 'global-run-counter',
      title: 'Count Runs with a Global (and Fix UnboundLocalError)',
      difficulty: 'Easy',
      topics: ['Arguments & Scope'],
      patterns: ['global statement'],
      domains: ['Platform / Ops'],
      roles: DE,
      summary: 'A module-level counter raises UnboundLocalError when incremented — fix it with the right declaration.',
      description: md(
        '`record_run()` should bump the module-level `RUNS` counter and return the new value, but as written it raises `UnboundLocalError`. Fix it.',
        '',
        'The tests call `run(n)`, which resets `RUNS` to 0 and calls `record_run()` `n` times, returning the list of returned values.',
      ),
      hints: ['Assigning to a name anywhere in a function makes it **local** for the whole function — even the read in `RUNS + 1`.', 'Declare `global RUNS` at the top of `record_run`.'],
      entry: 'run',
      signature: 'run(n: int) -> list[int]',
      starter: code`RUNS = 0

def record_run():
    RUNS = RUNS + 1
    return RUNS


# The tests call run(); don't change it.
def run(n):
    global RUNS
    RUNS = 0
    return [record_run() for _ in range(n)]
`,
      solution: code`RUNS = 0

def record_run():
    global RUNS
    RUNS = RUNS + 1
    return RUNS


def run(n):
    global RUNS
    RUNS = 0
    return [record_run() for _ in range(n)]
`,
      explanation: md('Python decides at compile time that `RUNS` is local to `record_run` because it is assigned there, so the read on the right-hand side happens before any local value exists. `global RUNS` tells the compiler the name lives in the module namespace. (In real code, prefer passing state explicitly or using a small class.)'),
      tests: [
        ex('Three runs', 3),
        ex('One run', 1),
        hid('Counter resets between cases', 2),
        hid('Zero runs', 0),
      ],
    }),

    python({
      id: 'legb-resolver',
      title: 'Resolve Names with the LEGB Rule',
      difficulty: 'Medium',
      topics: ['Arguments & Scope', 'Dicts & Sets'],
      patterns: ['Chained scope lookup'],
      domains: ['Developer tools'],
      roles: DE,
      summary: 'Simulate how Python looks up a name: Local, Enclosing, Global, Built-in.',
      description: md(
        'Model Python\'s name lookup. `scopes` is a dict with:',
        '',
        '- `"local"`: a dict of local names,',
        '- `"enclosing"`: a list of dicts for the enclosing functions, **innermost first**,',
        '- `"global"`: the module namespace,',
        '- `"builtins"`: the built-in namespace.',
        '',
        'For each name in `names`, return `[scope_where_found, value]`, where the scope is `"local"`, `"enclosing:<i>"` (index into the list), `"global"` or `"builtins"`. If it isn\'t found anywhere, return `["NameError", null]`.',
      ),
      hints: ['Check the scopes in exactly the order L → E (innermost to outermost) → G → B and stop at the first hit.', 'A name bound to `None` is still found — test with `in`, not truthiness.'],
      entry: 'resolve',
      signature: 'resolve(names: list[str], scopes: dict) -> list[list]',
      solution: code`def resolve(names: list[str], scopes: dict) -> list[list]:
    chain = [("local", scopes["local"])]
    chain += [(f"enclosing:{i}", s) for i, s in enumerate(scopes["enclosing"])]
    chain += [("global", scopes["global"]), ("builtins", scopes["builtins"])]
    out = []
    for name in names:
        for label, ns in chain:
            if name in ns:
                out.append([label, ns[name]])
                break
        else:
            out.append(["NameError", None])
    return out
`,
      explanation: md(
        'This is what the interpreter does for a plain name read inside a nested function. Inner scopes **shadow** outer ones, so the first hit wins. The `for … else` runs the `else` only when the inner loop never `break`s — a natural fit for "not found anywhere".',
      ),
      tests: [
        ex('Example', ['x', 'y', 'len', 'missing'], { local: { x: 1 }, enclosing: [{ y: 2 }, { y: 3 }], global: { x: 10, z: 5 }, builtins: { len: 'builtin' } }),
        ex('Global shadows builtins', ['print'], { local: {}, enclosing: [], global: { print: 'mine' }, builtins: { print: 'builtin' } }),
        hid('Outer enclosing scope', ['w'], { local: {}, enclosing: [{}, { w: 'outer' }], global: {}, builtins: {} }),
        hid('None is a value', ['n'], { local: { n: null }, enclosing: [], global: { n: 1 }, builtins: {} }),
      ],
    }),

    python({
      id: 'globals-registry-lookup',
      title: 'Look Up a Transform by Name with globals()',
      difficulty: 'Easy',
      topics: ['Arguments & Scope', 'Functions & Lambdas'],
      patterns: ['Naming convention + globals()'],
      domains: ['Event pipelines'],
      roles: DE,
      summary: 'Find module-level functions named transform_<x> at run time and apply them.',
      description: md(
        'The module defines `transform_cents`, `transform_upper` and `transform_trim`. Write `apply(name, value)` that finds the function called `"transform_" + name` in the **module\'s global namespace** and returns its result, or the string `"no transform <name>"` if there is no such callable.',
        '',
        'The tests call `run(steps)` with a list of `[name, value]` pairs.',
      ),
      hints: ['`globals()` returns the module namespace as a dict; `.get(...)` it and check `callable(...)`.'],
      entry: 'run',
      signature: 'run(steps: list[list]) -> list',
      starter: code`def transform_cents(v):
    return round(float(v) * 100)

def transform_upper(v):
    return str(v).upper()

def transform_trim(v):
    return str(v).strip()

def apply(name, value):
    pass


# The tests call run(); don't change it.
def run(steps):
    return [apply(name, value) for name, value in steps]
`,
      solution: code`def transform_cents(v):
    return round(float(v) * 100)

def transform_upper(v):
    return str(v).upper()

def transform_trim(v):
    return str(v).strip()

def apply(name, value):
    fn = globals().get("transform_" + name)
    if not callable(fn):
        return f"no transform {name}"
    return fn(value)


def run(steps):
    return [apply(name, value) for name, value in steps]
`,
      explanation: md('`globals()` is the live dict of the current module, so functions defined at module level are just entries in it. It is handy for plugin-style lookups; an explicit dict registry (see "Functions Are Objects") is usually clearer and safer, because `globals()` also exposes everything else in the module.'),
      tests: [
        ex('Example', [['cents', '12.34'], ['upper', 'eu'], ['trim', '  x ']]),
        ex('Unknown transform', [['reverse', 'abc']]),
        hid('Non-callable global is not a transform', [['RUNS', 1]]),
        hid('Empty', []),
      ],
    }),

    python({
      id: 'main-guard-simulator',
      title: 'What Runs on Import vs. as a Script?',
      difficulty: 'Medium',
      topics: ['Modules & Packages', 'Arguments & Scope'],
      patterns: ['__name__ == "__main__" guard'],
      domains: ['Developer tools'],
      roles: DE,
      summary: 'Execute a module\'s source with a chosen __name__ and capture what it prints.',
      description: md(
        'Write `run_module(source, as_script)` that executes the Python code in `source` in a **fresh namespace** whose `__name__` is `"__main__"` when `as_script` is true and `"etl_job"` otherwise, and returns the list of lines it printed.',
        '',
        'This shows exactly what an `if __name__ == "__main__":` block protects.',
      ),
      hints: ['`exec(source, {"__name__": ...})` runs code in a namespace you control.', 'Capture prints with `contextlib.redirect_stdout(io.StringIO())`, then `.splitlines()`.'],
      entry: 'run_module',
      signature: 'run_module(source: str, as_script: bool) -> list[str]',
      solution: code`import contextlib
import io

def run_module(source: str, as_script: bool) -> list[str]:
    namespace = {"__name__": "__main__" if as_script else "etl_job"}
    buffer = io.StringIO()
    with contextlib.redirect_stdout(buffer):
        exec(source, namespace)
    return buffer.getvalue().splitlines()
`,
      explanation: md(
        'Every module gets a `__name__`: the module\'s import name normally, and `"__main__"` for the file Python was started with. Top-level code runs in both cases; only the guarded block is skipped on import — which is why reusable modules put their CLI entry point under the guard.',
      ),
      tests: [
        ex('Imported', 'print("loading", __name__)\nif __name__ == "__main__":\n    print("running job")\n', false),
        ex('Run as a script', 'print("loading", __name__)\nif __name__ == "__main__":\n    print("running job")\n', true),
        hid('Functions defined but not called', 'def main():\n    print("main")\nif __name__ == "__main__":\n    main()\n', false),
        hid('Script calls main', 'def main():\n    print("main")\nif __name__ == "__main__":\n    main()\n', true),
      ],
    }),

    python({
      id: 'compose-pipeline',
      title: 'Compose Pipeline Steps into One Function',
      difficulty: 'Medium',
      topics: ['Higher-Order Functions', 'Closures & Decorators'],
      patterns: ['Function composition'],
      domains: ['Event pipelines'],
      ...tag(dev('Salesforce', 'closures and higher-order functions for pipelines (function composition)')),
      roles: DE,
      summary: 'Build a pipeline() that chains transformations left to right and returns a reusable function.',
      description: md(
        'Implement `pipeline(*steps)` that returns **a function** applying every step left to right: `pipeline(f, g, h)(x) == h(g(f(x)))`. With no steps it returns the identity function.',
        '',
        'The tests call `run(step_names, records)`: it builds a pipeline from a fixed set of steps (`strip_keys`, `drop_nulls`, `add_total`) and applies it to every record.',
      ),
      hints: ['Return an inner function that loops over `steps`; it closes over the tuple.', '`functools.reduce(lambda acc, f: f(acc), steps, x)` is the one-line body.'],
      entry: 'run',
      signature: 'run(step_names: list[str], records: list[dict]) -> list[dict]',
      starter: code`def pipeline(*steps):
    pass


# Steps the tests use, and the driver. Don't change these.
def strip_keys(r):
    return {k.strip(): v for k, v in r.items()}

def drop_nulls(r):
    return {k: v for k, v in r.items() if v is not None}

def add_total(r):
    return {**r, "total": r.get("qty", 0) * r.get("price", 0)}

def run(step_names, records):
    fn = pipeline(*[globals()[n] for n in step_names])
    return [fn(r) for r in records]
`,
      solution: code`from functools import reduce

def pipeline(*steps):
    def run_all(x):
        return reduce(lambda acc, step: step(acc), steps, x)
    return run_all


def strip_keys(r):
    return {k.strip(): v for k, v in r.items()}

def drop_nulls(r):
    return {k: v for k, v in r.items() if v is not None}

def add_total(r):
    return {**r, "total": r.get("qty", 0) * r.get("price", 0)}

def run(step_names, records):
    fn = pipeline(*[globals()[n] for n in step_names])
    return [fn(r) for r in records]
`,
      explanation: md('`pipeline` is a higher-order function: it takes functions and returns a new one. The returned closure remembers `steps`, so the composed pipeline can be built once and reused for every record. With no steps, `reduce` just returns `x` — the identity.'),
      tests: [
        ex('Example', ['strip_keys', 'drop_nulls', 'add_total'], [{ ' qty': 2, 'price ': 3.5, note: null }]),
        ex('No steps is identity', [], [{ a: 1 }]),
        hid('Order matters', ['add_total', 'strip_keys'], [{ ' qty': 2, price: 1 }]),
        hid('Many records', ['drop_nulls'], [{ a: null }, { b: 1 }]),
      ],
    }),
  ],
};
