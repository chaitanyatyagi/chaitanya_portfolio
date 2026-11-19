// Python pack 5 — lambdas and higher-order functions: sorted/min/max keys,
// filter, map (one and many iterables), reduce, functools.partial,
// cmp_to_key, nested lambdas, IIFEs and functions returning functions.
import { python, md, code, ex, hid } from './define.js';
import { dev, lds, tag } from './sources.js';

const DE = ['Data Engineer'];
const DE_DA = ['Data Engineer', 'Data Analyst'];

export default {
  problems: [
    python({
      id: 'sort-with-lambda-keys',
      title: 'Sort Files by Size, Then Name',
      difficulty: 'Easy',
      topics: ['Functions & Lambdas', 'Sorting'],
      patterns: ['Composite sort key'],
      domains: ['Data lake / Storage'],
      roles: DE,
      summary: 'Use a lambda key to sort a file listing by size descending and name ascending.',
      description: md('Each file is `[name, size_bytes]`. Return the names ordered by size **descending**, then name **ascending** (case-insensitive, but return the original spelling).'),
      hints: ['`sorted(files, key=lambda f: (-f[1], f[0].lower()))`.'],
      entry: 'order_files',
      signature: 'order_files(files: list[list]) -> list[str]',
      solution: code`def order_files(files: list[list]) -> list[str]:
    return [name for name, _ in sorted(files, key=lambda f: (-f[1], f[0].lower()))]
`,
      explanation: md('A lambda is a throwaway one-expression function — perfect for a sort key. The key is computed once per element (decorate-sort-undecorate), so even an expensive key is called only n times.'),
      tests: [
        ex('Example', [['b.csv', 10], ['A.csv', 10], ['big.parquet', 900]]),
        ex('Single file', [['x', 1]]),
        hid('Case-insensitive names', [['b', 1], ['A', 1], ['a2', 1]]),
        hid('Empty', []),
      ],
    }),

    python({
      id: 'filter-valid-events',
      title: 'filter() with a Lambda',
      difficulty: 'Easy',
      topics: ['Higher-Order Functions', 'Functions & Lambdas'],
      patterns: ['Predicate filter'],
      domains: ['Event pipelines'],
      roles: DE,
      summary: 'Keep only well-formed events using filter() and a predicate lambda.',
      description: md('An event is valid when it has a non-empty string `"user"`, a `"ts"` that is an int greater than 0, and a `"type"` in `allowed`. Return the valid events (as given) using `filter`.'),
      hints: ['`filter(pred, items)` is lazy — wrap it in `list(...)`.', '`isinstance(x, bool)` is True for True/False, and bool is a subclass of int, so exclude it explicitly for `ts`.'],
      entry: 'valid_events',
      signature: 'valid_events(events: list[dict], allowed: list[str]) -> list[dict]',
      solution: code`def valid_events(events: list[dict], allowed: list[str]) -> list[dict]:
    ok = set(allowed)
    is_valid = lambda e: (
        isinstance(e.get("user"), str) and e["user"] != ""
        and isinstance(e.get("ts"), int) and not isinstance(e["ts"], bool) and e["ts"] > 0
        and e.get("type") in ok
    )
    return list(filter(is_valid, events))
`,
      explanation: md('`filter` applies a predicate and keeps the items for which it is truthy. Using `.get` keeps a missing key from raising. The bool check matters because `isinstance(True, int)` is `True`.'),
      tests: [
        ex('Example', [{ user: 'a', ts: 5, type: 'click' }, { user: '', ts: 5, type: 'click' }, { user: 'b', ts: 0, type: 'view' }], ['click', 'view']),
        ex('Missing keys', [{ user: 'a' }], ['click']),
        hid('Bool timestamp rejected', [{ user: 'a', ts: true, type: 'x' }], ['x']),
        hid('Type not allowed', [{ user: 'a', ts: 1, type: 'buy' }], ['view']),
      ],
    }),

    python({
      id: 'map-normalise-prices',
      title: 'map() over One and Several Iterables',
      difficulty: 'Easy',
      topics: ['Higher-Order Functions'],
      patterns: ['map with multiple iterables'],
      domains: ['E-commerce / Sales'],
      roles: DE_DA,
      summary: 'Compute line totals with map() over three parallel lists.',
      description: md('`qty`, `price` and `discount` are parallel lists (discount is a fraction). Return each line total `round(q * p * (1 - d), 2)` using `map` with **three** iterables. If the lists have different lengths, stop at the shortest — as `map` does.'),
      hints: ['`map(fn, a, b, c)` calls `fn(a[i], b[i], c[i])` and stops at the shortest input.'],
      entry: 'line_totals',
      signature: 'line_totals(qty: list[int], price: list[float], discount: list[float]) -> list[float]',
      solution: code`def line_totals(qty: list[int], price: list[float], discount: list[float]) -> list[float]:
    return list(map(lambda q, p, d: round(q * p * (1 - d), 2), qty, price, discount))
`,
      explanation: md('With several iterables `map` works like `zip` + call. The truncation at the shortest input is silent — in production code prefer `zip(..., strict=True)` (Python 3.10+) when lengths must match.'),
      tests: [
        ex('Example', [2, 1, 3], [10.0, 5.5, 2.0], [0.1, 0, 0.5]),
        ex('Shortest list wins', [1, 1, 1], [2.0], [0, 0]),
        hid('Empty', [], [], []),
        hid('Full discount', [4], [9.99], [1]),
      ],
    }),

    python({
      id: 'reduce-merge-dicts',
      title: 'Fold Partial Counts with reduce()',
      difficulty: 'Easy',
      topics: ['Higher-Order Functions', 'Dicts & Sets'],
      patterns: ['Fold / reduce'],
      domains: ['Event pipelines'],
      roles: DE,
      summary: 'Combine per-partition count dicts into one with functools.reduce.',
      description: md('Each Spark-style partition produced a dict of counts. Merge them into one dict (summing counts for shared keys) with `functools.reduce`, keys sorted. An empty list returns `{}`.'),
      hints: ['`reduce(fn, items, initial)` — give an initial `{}` so an empty list works.', 'Inside the reducer, return a **new** dict rather than mutating the accumulator if you want a pure function.'],
      entry: 'merge_counts',
      signature: 'merge_counts(parts: list[dict[str, int]]) -> dict[str, int]',
      solution: code`from functools import reduce

def merge_counts(parts: list[dict[str, int]]) -> dict[str, int]:
    def combine(acc, part):
        out = dict(acc)
        for k, v in part.items():
            out[k] = out.get(k, 0) + v
        return out
    merged = reduce(combine, parts, {})
    return {k: merged[k] for k in sorted(merged)}
`,
      explanation: md('`reduce` folds a list into one value by repeatedly combining an accumulator with the next element — exactly what a distributed "combine" step does. Without the initial value, `reduce` on an empty list raises `TypeError`.'),
      tests: [
        ex('Example', [{ a: 1, b: 2 }, { b: 3, c: 1 }, { a: 4 }]),
        ex('Single partition', [{ x: 1 }]),
        hid('No partitions', []),
        hid('Empty partitions', [{}, {}, { z: 2 }]),
      ],
    }),

    python({
      id: 'reduce-longest-streak',
      title: 'Longest Increasing Streak with reduce()',
      difficulty: 'Medium',
      topics: ['Higher-Order Functions', 'Streaming & State'],
      patterns: ['Fold with a tuple accumulator'],
      domains: ['Finance'],
      roles: DE_DA,
      summary: 'Carry (previous, current streak, best streak) through reduce to find the longest rising run.',
      description: md('Return the length of the longest run of **strictly increasing** consecutive prices, computed with a single `functools.reduce` call. An empty list gives 0.'),
      hints: ['Use a tuple accumulator `(prev, current, best)`.', 'Start with `(None, 0, 0)`; a price continues the streak only when `prev is not None and price > prev`.'],
      entry: 'longest_rise',
      signature: 'longest_rise(prices: list[float]) -> int',
      solution: code`from functools import reduce

def longest_rise(prices: list[float]) -> int:
    def step(acc, price):
        prev, cur, best = acc
        cur = cur + 1 if prev is not None and price > prev else 1
        return price, cur, max(best, cur)
    return reduce(step, prices, (None, 0, 0))[2]
`,
      explanation: md('Any left-to-right loop with state can be written as a fold whose accumulator holds that state. It is a good exercise; in everyday code the plain loop is usually clearer.'),
      tests: [
        ex('Example', [3, 4, 5, 2, 3, 4, 5, 6, 1]),
        ex('Flat prices break streaks', [1, 1, 1]),
        hid('Empty', []),
        hid('Strictly decreasing', [5, 4, 3]),
        hid('All rising', [1, 2, 3, 4]),
      ],
    }),

    python({
      id: 'partial-tax-calculators',
      title: 'Specialise a Function with functools.partial',
      difficulty: 'Easy',
      topics: ['Higher-Order Functions', 'Functions & Lambdas'],
      patterns: ['Partial application'],
      domains: ['Finance'],
      roles: DE,
      summary: 'Create per-region price calculators from one general function with partial().',
      description: md(
        '`gross(net, rate, rounding)` returns `round(net * (1 + rate), rounding)`. Build a dict of calculators with `functools.partial` — `"IN"` (rate 0.18, rounding 2), `"US"` (0.07, 2), `"JP"` (0.10, 0) — and return the gross price of each `[region, net]` line.',
      ),
      hints: ['`partial(gross, rate=0.18, rounding=2)` returns a callable that only needs `net`.'],
      entry: 'gross_prices',
      signature: 'gross_prices(lines: list[list]) -> list[float]',
      solution: code`from functools import partial

def gross(net, rate, rounding):
    return round(net * (1 + rate), rounding)

CALCULATORS = {
    "IN": partial(gross, rate=0.18, rounding=2),
    "US": partial(gross, rate=0.07, rounding=2),
    "JP": partial(gross, rate=0.10, rounding=0),
}

def gross_prices(lines: list[list]) -> list[float]:
    return [CALCULATORS[region](net) for region, net in lines]
`,
      explanation: md('`partial` freezes some arguments of a function and returns a new callable — a lighter-weight alternative to writing a closure or lambda for each configuration. The frozen arguments are inspectable (`calc.keywords`), which a lambda is not.'),
      tests: [
        ex('Example', [['IN', 100], ['US', 19.99], ['JP', 1234]]),
        ex('Single line', [['US', 0]]),
        hid('Many lines', [['JP', 99], ['IN', 0.5], ['IN', 10]]),
        hid('Rounding to whole yen', [['JP', 0.4], ['JP', 1.5]]),
      ],
    }),

    python({
      id: 'nested-lambda-multipliers',
      title: 'Nested Lambdas: Functions that Build Functions',
      difficulty: 'Easy',
      topics: ['Functions & Lambdas', 'Closures & Decorators'],
      patterns: ['Function factory'],
      domains: ['Reporting'],
      roles: DE,
      summary: 'Use a lambda that returns a lambda to build unit converters — and dodge the late-binding trap.',
      description: md(
        '`scale = lambda factor: lambda x: round(x * factor, 3)` builds converters. For each `[factor, value]` pair in `pairs`, build a converter with `scale` and apply it.',
        '',
        'Also return, as the second element, the result of converting `1` with converters built **in a loop** from `factors` — making sure each converter keeps its own factor.',
        '',
        'Return `[converted_pairs, loop_results]`.',
      ),
      hints: ['A lambda inside a loop that refers to the loop variable sees its **final** value. Calling a factory (`scale(f)`) captures the current value instead.'],
      entry: 'convert',
      signature: 'convert(pairs: list[list], factors: list[float]) -> list[list]',
      solution: code`scale = lambda factor: lambda x: round(x * factor, 3)

def convert(pairs: list[list], factors: list[float]) -> list[list]:
    converted = [scale(f)(v) for f, v in pairs]
    converters = [scale(f) for f in factors]
    return [converted, [c(1) for c in converters]]
`,
      explanation: md(
        '`scale(f)` returns a new lambda that closes over `factor`. The classic bug is `[lambda x: x * f for f in factors]`: every lambda looks up `f` when **called**, after the loop ended, so all of them use the last factor. Going through the factory (or `lambda x, f=f: ...`) binds the value at creation.',
      ),
      tests: [
        ex('Example', [[1.609, 10], [0.001, 2500]], [2, 3, 4]),
        ex('No pairs', [], [1]),
        hid('Negative factors', [[-1, 5]], [-2, 0.5]),
        hid('No factors', [[2, 2]], []),
      ],
    }),

    python({
      id: 'validator-factory',
      title: 'Return Functions from Functions: Rule Validators',
      difficulty: 'Medium',
      topics: ['Higher-Order Functions', 'Closures & Decorators', 'Data Wrangling'],
      patterns: ['Function factory', 'Rules as data'],
      domains: ['Data quality'],
      roles: DE,
      summary: 'Turn declarative data-quality rules into validator functions, then run them over records.',
      description: md(
        'Each rule is a dict: `{"col", "check", "arg"}` with check `"not_null"`, `"min"` (value ≥ arg), `"max"` (value ≤ arg), `"in"` (value in arg list) or `"len_max"` (len(str(value)) ≤ arg). Write `make_validator(rule)` returning a function `record -> bool`; a missing or `None` value passes every check except `not_null`.',
        '',
        'Return, for each record, the sorted list of **column names** that failed at least one rule.',
      ),
      hints: ['Return a different inner function per check type; each closes over `col` and `arg`.', 'Build all validators once, outside the record loop.'],
      entry: 'failed_columns',
      signature: 'failed_columns(rules: list[dict], records: list[dict]) -> list[list[str]]',
      solution: code`def make_validator(rule):
    col, check, arg = rule["col"], rule["check"], rule.get("arg")
    if check == "not_null":
        return lambda r: r.get(col) is not None
    tests = {
        "min": lambda v: v >= arg,
        "max": lambda v: v <= arg,
        "in": lambda v: v in arg,
        "len_max": lambda v: len(str(v)) <= arg,
    }
    test = tests[check]
    return lambda r: r.get(col) is None or test(r[col])

def failed_columns(rules: list[dict], records: list[dict]) -> list[list[str]]:
    validators = [(rule["col"], make_validator(rule)) for rule in rules]
    return [sorted({col for col, ok in validators if not ok(rec)}) for rec in records]
`,
      explanation: md('Rules stay as **data** (easy to store in config), and the factory compiles each into a function once. Every returned lambda closes over its own `col`/`arg` — each call to `make_validator` creates a new scope, so there is no late-binding problem.'),
      tests: [
        ex('Example', [{ col: 'age', check: 'min', arg: 0 }, { col: 'age', check: 'max', arg: 120 }, { col: 'email', check: 'not_null' }, { col: 'tier', check: 'in', arg: ['free', 'pro'] }], [{ age: 30, email: 'a@x', tier: 'pro' }, { age: -1, email: null, tier: 'gold' }]),
        ex('Missing values pass value checks', [{ col: 'age', check: 'min', arg: 18 }], [{}]),
        hid('len_max', [{ col: 'code', check: 'len_max', arg: 3 }], [{ code: 'ABCD' }, { code: 12 }]),
        hid('No rules', [], [{ a: 1 }]),
      ],
    }),

    python({
      id: 'largest-concatenation',
      title: 'Largest Number from Concatenated IDs (cmp_to_key)',
      difficulty: 'Medium',
      topics: ['Sorting', 'Higher-Order Functions', 'Strings'],
      patterns: ['Custom comparator'],
      domains: ['Platform / Ops'],
      ...tag(dev('Cisco', 'maximum concatenated substring (sorting and greedy)')),
      roles: DE,
      summary: 'Order numbers so that their concatenation is as large as possible — a comparator, not a key.',
      description: md(
        'Arrange the non-negative integers in `nums` so their concatenation is the largest possible number, and return it as a string. Leading zeros collapse: `[0, 0]` gives `"0"`.',
        '',
        '```',
        '[3, 30, 34, 5, 9]   →   "9534330"',
        '```',
      ),
      hints: [
        'Neither numeric nor plain string order works (`"30"` vs `"3"`). Compare two strings by which concatenation is bigger: `a + b` vs `b + a`.',
        '`functools.cmp_to_key(cmp)` turns a two-argument comparator into a sort key.',
      ],
      entry: 'largest_number',
      signature: 'largest_number(nums: list[int]) -> str',
      solution: code`from functools import cmp_to_key

def largest_number(nums: list[int]) -> str:
    strs = [str(n) for n in nums]
    strs.sort(key=cmp_to_key(lambda a, b: (b + a > a + b) - (b + a < a + b)))
    out = "".join(strs)
    return "0" if out and out[0] == "0" else out
`,
      explanation: md('Some orders are naturally pairwise ("which of these two should go first?") and can\'t be expressed as a per-item key. Python 3 sorts only take keys, so `cmp_to_key` adapts a comparator that returns negative/zero/positive. The comparison is transitive here, so the greedy sort is optimal.'),
      tests: [
        ex('Example', [3, 30, 34, 5, 9]),
        ex('Two numbers', [10, 2]),
        hid('All zeros', [0, 0]),
        hid('Single', [7]),
        hid('Equal prefixes', [121, 12]),
        hid('Empty', []),
      ],
    }),

    python({
      id: 'iife-config',
      title: 'Immediately Invoked Lambdas for One-Off Values',
      difficulty: 'Easy',
      topics: ['Functions & Lambdas'],
      patterns: ['IIFE'],
      domains: ['Platform / Ops'],
      roles: DE,
      summary: 'Compute derived settings with immediately-invoked lambdas inside a dict literal.',
      description: md(
        'Given `env` (a dict of string settings), return a config dict built in **one literal** where each value is computed by an immediately invoked lambda:',
        '',
        '- `"workers"`: `int(env["WORKERS"])` if present, else `max(1, int(env.get("CPUS", "1")) - 1)`;',
        '- `"debug"`: true when `env.get("DEBUG", "")` lowercased is one of `"1"`, `"true"`, `"yes"`;',
        '- `"buckets"`: `env.get("BUCKETS", "")` split on commas, stripped, empty items dropped.',
      ),
      hints: ['`(lambda: expression)()` defines and calls a function in place — handy when a value needs a few steps but no name.'],
      entry: 'build_config',
      signature: 'build_config(env: dict[str, str]) -> dict',
      solution: code`def build_config(env: dict[str, str]) -> dict:
    return {
        "workers": (lambda: int(env["WORKERS"]) if "WORKERS" in env else max(1, int(env.get("CPUS", "1")) - 1))(),
        "debug": (lambda: env.get("DEBUG", "").lower() in {"1", "true", "yes"})(),
        "buckets": (lambda: [b.strip() for b in env.get("BUCKETS", "").split(",") if b.strip()])(),
    }
`,
      explanation: md('An immediately invoked function expression scopes temporary work to one value. It is common in JavaScript; in Python a small named helper is often clearer, but the pattern shows that a lambda is just an expression that evaluates to a function.'),
      tests: [
        ex('Example', { CPUS: '8', DEBUG: 'True', BUCKETS: 'raw, curated,,' }),
        ex('Explicit workers', { WORKERS: '3' }),
        hid('Nothing set', {}),
        hid('Debug off', { DEBUG: 'no', CPUS: '1' }),
      ],
    }),

    python({
      id: 'filter-map-email-pipeline',
      title: 'Chain filter and map into a Cleaning Pipeline',
      difficulty: 'Easy',
      topics: ['Higher-Order Functions', 'Strings'],
      patterns: ['filter → map chain'],
      domains: ['Marketing / CRM'],
      roles: DE_DA,
      summary: 'Lowercase, strip and keep only corporate email addresses using filter and map.',
      description: md('Normalise every address (strip + lowercase) with `map`, then keep only those whose domain is in `domains` with `filter`, preserving order and removing duplicates (keep first).'),
      hints: ['`filter(pred, map(fn, items))` — both are lazy and compose.', '`dict.fromkeys(iterable)` deduplicates while keeping order.'],
      entry: 'corporate_emails',
      signature: 'corporate_emails(emails: list[str], domains: list[str]) -> list[str]',
      solution: code`def corporate_emails(emails: list[str], domains: list[str]) -> list[str]:
    allowed = {d.lower() for d in domains}
    cleaned = map(lambda e: e.strip().lower(), emails)
    corporate = filter(lambda e: e.rpartition("@")[2] in allowed, cleaned)
    return list(dict.fromkeys(corporate))
`,
      explanation: md('`map` and `filter` return lazy iterators, so the chain processes one address at a time end to end. `rpartition("@")` safely takes everything after the last `@` (and gives `""` if there is none).'),
      tests: [
        ex('Example', [' Ana@Corp.com', 'raj@gmail.com', 'ana@corp.com', 'li@corp.com'], ['corp.com']),
        ex('No matches', ['a@b.c'], ['x.com']),
        hid('No at-sign', ['corp.com'], ['corp.com']),
        hid('Several domains', ['x@a.io', 'y@b.io', 'z@c.io'], ['C.IO', 'a.io']),
      ],
    }),

    python({
      id: 'lambda-conditional-classify',
      title: 'Lambdas with if-else and Comprehensions',
      difficulty: 'Easy',
      topics: ['Functions & Lambdas', 'Comprehensions'],
      patterns: ['Conditional expression in a lambda'],
      domains: ['Payments'],
      ...tag(lds('Target', 'target', 'Classify Orders by Value Tier'), lds('Snapchat', 'snap', 'Classify Campaigns by Budget Tier')),
      roles: DE_DA,
      summary: 'Classify transactions with a lambda that uses a conditional expression, inside a comprehension.',
      description: md('Classify each amount: `"refund"` if negative, `"micro"` if under 1, `"large"` if at least `threshold`, otherwise `"regular"`. Define the classifier as a single lambda and apply it in a list comprehension.'),
      hints: ['A lambda body is one expression, so use chained conditional expressions — no `if` statements.'],
      entry: 'classify',
      signature: 'classify(amounts: list[float], threshold: float) -> list[str]',
      solution: code`def classify(amounts: list[float], threshold: float) -> list[str]:
    label = lambda a: "refund" if a < 0 else "micro" if a < 1 else "large" if a >= threshold else "regular"
    return [label(a) for a in amounts]
`,
      explanation: md('Lambdas are limited to a single expression, which is exactly why conditional expressions exist. Assigning a lambda to a name is fine for a local helper, though PEP 8 prefers `def` for anything reused widely.'),
      tests: [
        ex('Example', [-5, 0.5, 50, 1000], 500),
        ex('Boundaries', [0, 1, 500], 500),
        hid('Empty', [], 10),
        hid('Threshold below one', [0.5, -0.01, 2], 0.25),
      ],
    }),
  ],
};
