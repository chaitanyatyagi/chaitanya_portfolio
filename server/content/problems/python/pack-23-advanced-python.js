// Python pack 23 — advanced language features: context managers
// (contextlib.contextmanager, ExitStack, suppress), dataclasses, NamedTuple,
// collections (ChainMap, Counter arithmetic, nested defaultdict), itertools in
// depth, functools.cached_property, descriptors, __init_subclass__ registries,
// __slots__, structural pattern matching, runtime type checks, __getattr__
// proxies, Enum flags and Decimal rounding.
import { python, md, code, ex, hid } from './define.js';

const DE = ['Data Engineer'];

export default {
  problems: [
    python({
      id: 'contextmanager-timer',
      title: 'Write a Context Manager with contextlib',
      difficulty: 'Medium',
      topics: ['Error Handling', 'Generators & Iterators'],
      patterns: ['@contextmanager with try/finally'],
      domains: ['Platform / Ops'],
      roles: DE,
      summary: 'A generator-based context manager that records step timings and failures, even when the block raises.',
      description: md(
        'Write `step(name, log, clock)` with `@contextlib.contextmanager`: on entry append `"start <name>"`; on a clean exit append `"done <name> <elapsed>"`; if the block raises, append `"fail <name> <ErrorName>"` and re-raise. Elapsed = `clock()` at exit − `clock()` at entry.',
        '',
        '`run(steps)` executes steps (`[name, duration, error_or_null]`) inside `with step(...)` blocks with a fake clock and returns the log.',
      ),
      hints: ['Code before `yield` is `__enter__`, after it is `__exit__`. Wrap the `yield` in `try/except/else` to see the block\'s exception.'],
      entry: 'run',
      signature: 'run(steps: list[list]) -> list[str]',
      starter: code`import contextlib

def step(name, log, clock):
    pass


# The tests call run(); don't change it.
def run(steps):
    now = {"t": 0}
    log = []
    for name, duration, error in steps:
        try:
            with step(name, log, lambda: now["t"]):
                now["t"] += duration
                if error:
                    raise {"value": ValueError, "key": KeyError}[error]("boom")
        except (ValueError, KeyError):
            pass
    return log
`,
      solution: code`import contextlib

@contextlib.contextmanager
def step(name, log, clock):
    start = clock()
    log.append(f"start {name}")
    try:
        yield
    except Exception as e:
        log.append(f"fail {name} {type(e).__name__}")
        raise
    else:
        log.append(f"done {name} {clock() - start}")


def run(steps):
    now = {"t": 0}
    log = []
    for name, duration, error in steps:
        try:
            with step(name, log, lambda: now["t"]):
                now["t"] += duration
                if error:
                    raise {"value": ValueError, "key": KeyError}[error]("boom")
        except (ValueError, KeyError):
            pass
    return log
`,
      explanation: md('`@contextmanager` turns a generator into a context manager: the exception raised in the `with` block is thrown into the generator at the `yield`. Re-raising keeps the caller informed; swallowing it there would silently hide failures.'),
      tests: [
        ex('Example', [['extract', 3, null], ['load', 2, 'value']]),
        ex('Single step', [['only', 0, null]]),
        hid('Different errors', [['a', 1, 'key'], ['b', 1, null], ['c', 5, 'value']]),
        hid('No steps', []),
      ],
    }),

    python({
      id: 'exitstack-resources',
      title: 'Manage a Dynamic Number of Resources with ExitStack',
      difficulty: 'Medium',
      topics: ['Error Handling', 'OOP'],
      patterns: ['contextlib.ExitStack'],
      domains: ['Database Access'],
      roles: DE,
      summary: 'Open N connections, roll back cleanly if opening one fails, and close them in reverse order.',
      description: md(
        '`Conn(name, log, fail)` is a context manager that logs `"open <name>"` / `"close <name>"` and raises `ConnectionError` on enter when `fail` is true. Write `with_all(names, failing, log)` that opens one connection per name using `contextlib.ExitStack`, logs `"work"` if all opened, and returns `"ok"` — or `"failed at <name>"` if one couldn\'t open. Every connection that did open must be closed, most recent first.',
      ),
      hints: ['`stack.enter_context(cm)` enters and registers the exit; leaving the `with ExitStack()` block unwinds everything in reverse.'],
      entry: 'run',
      signature: 'run(names: list[str], failing: list[str]) -> list',
      starter: code`import contextlib

class Conn:
    def __init__(self, name, log, fail):
        self.name, self.log, self.fail = name, log, fail

    def __enter__(self):
        if self.fail:
            raise ConnectionError(self.name)
        self.log.append(f"open {self.name}")
        return self

    def __exit__(self, *exc):
        self.log.append(f"close {self.name}")
        return False

def with_all(names, failing, log):
    pass


# The tests call run(); don't change it.
def run(names, failing):
    log = []
    result = with_all(names, failing, log)
    return [result, log]
`,
      solution: code`import contextlib

class Conn:
    def __init__(self, name, log, fail):
        self.name, self.log, self.fail = name, log, fail

    def __enter__(self):
        if self.fail:
            raise ConnectionError(self.name)
        self.log.append(f"open {self.name}")
        return self

    def __exit__(self, *exc):
        self.log.append(f"close {self.name}")
        return False

def with_all(names, failing, log):
    try:
        with contextlib.ExitStack() as stack:
            for n in names:
                stack.enter_context(Conn(n, log, n in failing))
            log.append("work")
            return "ok"
    except ConnectionError as e:
        return f"failed at {e.args[0]}"


def run(names, failing):
    log = []
    result = with_all(names, failing, log)
    return [result, log]
`,
      explanation: md('Nested `with` statements need the number of resources at write time; `ExitStack` handles any number, and guarantees LIFO cleanup of exactly the resources that were successfully entered — even when entering a later one fails.'),
      tests: [
        ex('Example', ['db', 'cache', 'queue'], []),
        ex('Third fails', ['db', 'cache', 'queue'], ['queue']),
        hid('First fails', ['a', 'b'], ['a']),
        hid('No resources', [], []),
      ],
    }),

    python({
      id: 'dataclass-records',
      title: 'Validated Records with dataclasses',
      difficulty: 'Easy',
      topics: ['OOP', 'Data Wrangling'],
      patterns: ['@dataclass + __post_init__'],
      domains: ['E-commerce / Sales'],
      roles: DE,
      summary: 'Model order lines as frozen, orderable dataclasses with validation and a default factory.',
      description: md(
        'Define `@dataclass(frozen=True, order=True) class Line` with fields `sku: str`, `qty: int`, `price: float` and `tags: tuple = ()` (default). `__post_init__` raises `ValueError` if `qty <= 0` or `price < 0`. Add a `total` property (`qty * price`, rounded to 2).',
        '',
        '`run(rows)` builds lines (invalid rows become `"invalid"`), returns the valid ones sorted (dataclass ordering = field order) as `[sku, qty, price, total]`, and whether assigning to a field raises `FrozenInstanceError`.',
      ),
      hints: ['`order=True` generates `<` etc. comparing fields in definition order; `frozen=True` makes instances immutable (and hashable).'],
      entry: 'run',
      signature: 'run(rows: list[list]) -> list',
      starter: code`from dataclasses import dataclass, FrozenInstanceError

class Line:
    pass


# The tests call run(); don't change it.
def run(rows):
    lines, out = [], []
    for row in rows:
        try:
            lines.append(Line(*row))
        except ValueError:
            out.append("invalid")
    for l in sorted(lines):
        out.append([l.sku, l.qty, l.price, l.total])
    frozen = False
    if lines:
        try:
            lines[0].qty = 99
        except FrozenInstanceError:
            frozen = True
    return out + [frozen]
`,
      solution: code`from dataclasses import dataclass, FrozenInstanceError

@dataclass(frozen=True, order=True)
class Line:
    sku: str
    qty: int
    price: float
    tags: tuple = ()

    def __post_init__(self):
        if self.qty <= 0 or self.price < 0:
            raise ValueError("bad line")

    @property
    def total(self):
        return round(self.qty * self.price, 2)


def run(rows):
    lines, out = [], []
    for row in rows:
        try:
            lines.append(Line(*row))
        except ValueError:
            out.append("invalid")
    for l in sorted(lines):
        out.append([l.sku, l.qty, l.price, l.total])
    frozen = False
    if lines:
        try:
            lines[0].qty = 99
        except FrozenInstanceError:
            frozen = True
    return out + [frozen]
`,
      explanation: md('`@dataclass` generates `__init__`, `__repr__`, `__eq__` (and ordering/hash on request) from annotations. `__post_init__` is the hook for validation. Mutable defaults need `field(default_factory=list)` — a tuple default is safe because it is immutable.'),
      tests: [
        ex('Example', [['B', 2, 1.5], ['A', 1, 9.99], ['C', 0, 1.0]]),
        ex('All invalid', [['X', -1, 1.0]]),
        hid('Ordering by later fields', [['A', 2, 1.0], ['A', 1, 5.0], ['A', 1, 2.0]]),
        hid('Negative price', [['Z', 1, -0.01], ['Y', 3, 0.0]]),
      ],
    }),

    python({
      id: 'namedtuple-records',
      title: 'Lightweight Records with NamedTuple',
      difficulty: 'Easy',
      topics: ['Lists & Tuples', 'Collections & itertools'],
      patterns: ['typing.NamedTuple'],
      domains: ['Web server logs'],
      roles: DE,
      summary: 'Parse log rows into NamedTuples and use field names, _replace and _asdict.',
      description: md('Define `class Hit(NamedTuple)` with `ip: str`, `path: str`, `status: int`, `ms: int = 0`. Parse each `"ip path status [ms]"` line, then return: the hits with status ≥ 500 converted with `_asdict()`, and the first hit with its path replaced by `"/redacted"` via `_replace` (as a plain list).'),
      hints: ['NamedTuples are tuples (unpackable, immutable) with names; `_replace` returns a modified copy.'],
      entry: 'analyse',
      signature: 'analyse(lines: list[str]) -> list',
      solution: code`from typing import NamedTuple

class Hit(NamedTuple):
    ip: str
    path: str
    status: int
    ms: int = 0

def analyse(lines: list[str]) -> list:
    hits = []
    for line in lines:
        parts = line.split()
        hits.append(Hit(parts[0], parts[1], int(parts[2]), int(parts[3]) if len(parts) > 3 else 0))
    errors = [h._asdict() for h in hits if h.status >= 500]
    first = list(hits[0]._replace(path="/redacted")) if hits else None
    return [errors, first]
`,
      explanation: md('NamedTuples give tuple performance and immutability with readable attribute access — ideal for parsed records. Defaults apply to trailing fields; `_asdict` converts to a dict for JSON output.'),
      tests: [
        ex('Example', ['1.1.1.1 /a 200 12', '2.2.2.2 /b 503', '3.3.3.3 /c 500 99']),
        ex('No errors', ['9.9.9.9 / 204 1']),
        hid('Empty', []),
        hid('All errors', ['5.5.5.5 /x 500 1', '6.6.6.6 /y 404']),
      ],
    }),

    python({
      id: 'chainmap-config',
      title: 'Layered Configuration with ChainMap',
      difficulty: 'Easy',
      topics: ['Dicts & Sets', 'Collections & itertools'],
      patterns: ['collections.ChainMap'],
      domains: ['Platform / Ops'],
      roles: DE,
      summary: 'Resolve settings from CLI flags, environment and defaults — first layer wins.',
      description: md('Build `ChainMap(cli, env, defaults)` and return `[resolved values for each key in keys (or None), which layer each came from ("cli"/"env"/"defaults"/None), sorted list of all keys]`. Then set `config["debug"] = True` and report which layer received the write.'),
      hints: ['Lookups search the maps in order; writes always go to the **first** map.'],
      entry: 'resolve',
      signature: 'resolve(cli: dict, env: dict, defaults: dict, keys: list[str]) -> list',
      solution: code`from collections import ChainMap

def resolve(cli: dict, env: dict, defaults: dict, keys: list[str]) -> list:
    layers = [("cli", cli), ("env", env), ("defaults", defaults)]
    config = ChainMap(cli, env, defaults)
    values = [config.get(k) for k in keys]
    origin = [next((name for name, m in layers if k in m), None) for k in keys]
    config["debug"] = True
    written = next(name for name, m in layers if "debug" in m and m["debug"] is True)
    return [values, origin, sorted(config), written]
`,
      explanation: md('`ChainMap` views several dicts as one without copying — perfect for precedence rules. Writes go to the first mapping only, so lower layers (defaults) stay untouched.'),
      tests: [
        ex('Example', { workers: 8 }, { workers: 4, region: 'eu' }, { workers: 1, region: 'us', debug: false }, ['workers', 'region', 'debug', 'missing']),
        ex('Only defaults', {}, {}, { a: 1 }, ['a']),
        hid('Env overrides defaults', {}, { a: 2 }, { a: 1, b: 3 }, ['a', 'b']),
        hid('Cli wins over everything', { a: 9 }, { a: 2 }, { a: 1 }, ['a', 'zzz']),
      ],
    }),

    python({
      id: 'counter-arithmetic',
      title: 'Inventory Math with Counter Arithmetic',
      difficulty: 'Easy',
      topics: ['Hash Maps & Counting', 'Collections & itertools'],
      patterns: ['Counter +, -, &, |'],
      domains: ['Retail'],
      roles: DE,
      summary: 'Combine stock and orders with Counter operators and find shortages.',
      description: md('`stock` and `orders` map sku → units. Return `[remaining (stock − orders, positives only), shortage (orders − stock, positives only), fully_satisfiable (orders ≤ stock for every sku), top_2_stock (most_common(2) of stock)]` — dicts sorted by key.'),
      hints: ['`Counter - Counter` keeps only positive results; `&` is min, `|` is max.'],
      entry: 'inventory',
      signature: 'inventory(stock: dict[str, int], orders: dict[str, int]) -> list',
      solution: code`from collections import Counter

def inventory(stock: dict[str, int], orders: dict[str, int]) -> list:
    s, o = Counter(stock), Counter(orders)
    remaining = s - o
    shortage = o - s
    sat = not shortage
    srt = lambda c: dict(sorted(c.items()))
    return [srt(remaining), srt(shortage), sat, [list(p) for p in s.most_common(2)]]
`,
      explanation: md('Counter subtraction drops zero and negative counts, which is exactly "what\'s left" and "what\'s missing". `most_common` breaks ties by insertion order.'),
      tests: [
        ex('Example', { A: 5, B: 2, C: 10 }, { A: 3, B: 4 }),
        ex('Everything available', { X: 1 }, { X: 1 }),
        hid('Unknown sku ordered', { A: 1 }, { Z: 2 }),
        hid('Nothing ordered', { A: 3, B: 1 }, {}),
      ],
    }),

    python({
      id: 'nested-defaultdict-tree',
      title: 'Auto-Vivifying Trees with defaultdict',
      difficulty: 'Easy',
      topics: ['Dicts & Sets', 'Recursion'],
      patterns: ['Recursive defaultdict'],
      domains: ['Data lake / Storage'],
      roles: DE,
      summary: 'Build a nested folder → size tree from flat paths without checking for missing keys.',
      description: md('Given `[path, size]` pairs like `["raw/2024/a.csv", 10]`, build a nested dict where folders map to dicts and files to sizes, using `tree = lambda: defaultdict(tree)`. Return it converted to plain dicts (keys sorted at every level).'),
      hints: ['Walk the folder parts with `node = node[part]`; the last part is the file.'],
      entry: 'build_tree',
      signature: 'build_tree(files: list[list]) -> dict',
      solution: code`from collections import defaultdict

def build_tree(files: list[list]) -> dict:
    tree = lambda: defaultdict(tree)
    root = tree()
    for path, size in files:
        *folders, name = path.split("/")
        node = root
        for f in folders:
            node = node[f]
        node[name] = size

    def plain(n):
        return {k: plain(v) if isinstance(v, dict) else v for k, v in sorted(n.items())}
    return plain(root)
`,
      explanation: md('A self-referencing `defaultdict` creates intermediate levels on first access ("autovivification"). Convert back to plain dicts before returning — otherwise a later typo read silently creates a key.'),
      tests: [
        ex('Example', [['raw/2024/a.csv', 10], ['raw/2024/b.csv', 5], ['raw/2023/c.csv', 1], ['README', 2]]),
        ex('Single file', [['x', 1]]),
        hid('Deep path', [['a/b/c/d/e.txt', 7]]),
        hid('Sibling folders', [['a/x.txt', 1], ['b/y.txt', 2], ['a/z.txt', 3]]),
      ],
    }),

    python({
      id: 'itertools-toolbox',
      title: 'The itertools Toolbox',
      difficulty: 'Medium',
      topics: ['Collections & itertools', 'Generators & Iterators'],
      patterns: ['accumulate / pairwise / zip_longest / chain / compress / starmap'],
      domains: ['Event pipelines'],
      roles: DE,
      summary: 'Answer six small questions, each with one itertools function.',
      description: md(
        'Given `values` (ints), `flags` (bools, same length), and `groups` (lists), return a dict:',
        '',
        '- `running`: running totals (`accumulate`);',
        '- `deltas`: differences between neighbours (`pairwise`);',
        '- `flat`: all items of `groups` in one list (`chain.from_iterable`);',
        '- `kept`: values where the flag is true (`compress`);',
        '- `zipped`: `values` paired with `groups` items, padding the shorter with `null` (`zip_longest`);',
        '- `products`: `a*b` for consecutive pairs (`starmap` over `pairwise`).',
      ),
      hints: ['All of these return iterators — wrap them in `list(...)`.'],
      entry: 'toolbox',
      signature: 'toolbox(values: list[int], flags: list[bool], groups: list[list]) -> dict',
      solution: code`from itertools import accumulate, chain, compress, pairwise, starmap, zip_longest
from operator import mul

def toolbox(values: list[int], flags: list[bool], groups: list[list]) -> dict:
    return {
        "running": list(accumulate(values)),
        "deltas": [b - a for a, b in pairwise(values)],
        "flat": list(chain.from_iterable(groups)),
        "kept": list(compress(values, flags)),
        "zipped": [list(p) for p in zip_longest(values, groups)],
        "products": list(starmap(mul, pairwise(values))),
    }
`,
      explanation: md('itertools functions are lazy building blocks implemented in C: they replace hand-written loops with intent-revealing names and constant memory. `pairwise` (3.10+) is the idiomatic way to look at neighbours.'),
      tests: [
        ex('Example', [1, 3, 6, 10], [true, false, true, true], [['a'], ['b', 'c']]),
        ex('Single value', [5], [false], []),
        hid('Negative numbers', [-2, 2, -2], [true, true, false], [[1], [2], [3], [4]]),
        hid('All selected', [4, 4, 4], [true, true, true], [[7, 8]]),
      ],
    }),

    python({
      id: 'combinatorics-itertools',
      title: 'Test Matrices with product, permutations and combinations',
      difficulty: 'Medium',
      topics: ['Collections & itertools', 'Recursion'],
      patterns: ['Combinatoric iterators'],
      domains: ['Experimentation'],
      roles: DE,
      summary: 'Generate a test matrix and count arrangements with itertools combinatorics.',
      description: md('Return `[matrix, pair_count, orderings, multiset_combos]`: `matrix` = every combination of one value from each list in `dims` (as lists, in `product` order); `pair_count` = number of 2-element combinations of `items`; `orderings` = all permutations of `items` of length 2 joined as strings like `"a>b"`; `multiset_combos` = combinations with replacement of `items` of size 2 joined like `"a+a"`.'),
      hints: ['`product(*dims)`, `combinations`, `permutations(items, 2)`, `combinations_with_replacement`.'],
      entry: 'matrices',
      signature: 'matrices(dims: list[list], items: list[str]) -> list',
      solution: code`from itertools import combinations, combinations_with_replacement, permutations, product

def matrices(dims: list[list], items: list[str]) -> list:
    return [
        [list(p) for p in product(*dims)],
        sum(1 for _ in combinations(items, 2)),
        [">".join(p) for p in permutations(items, 2)],
        ["+".join(c) for c in combinations_with_replacement(items, 2)],
    ]
`,
      explanation: md('`product` is nested loops, `permutations` cares about order, `combinations` doesn\'t, and `combinations_with_replacement` allows repeats. Knowing which one matches the question avoids accidental double counting.'),
      tests: [
        ex('Example', [['chrome', 'safari'], ['en', 'fr']], ['a', 'b', 'c']),
        ex('Single dimension', [[1, 2, 3]], ['x']),
        hid('Empty items', [['only']], []),
        hid('Three dimensions', [['a', 'b'], [1], ['x', 'y']], ['p', 'q', 'r', 's']),
      ],
    }),

    python({
      id: 'cached-property-report',
      title: 'Compute Once with functools.cached_property',
      difficulty: 'Easy',
      topics: ['OOP', 'Closures & Decorators'],
      patterns: ['cached_property'],
      domains: ['Reporting'],
      roles: DE,
      summary: 'An expensive report statistic computed on first access only, invalidated on demand.',
      description: md('`Report(values)` has `stats` as a `functools.cached_property` returning `[min, max, mean rounded to 2]` and counting computations in `self.computations`. `refresh(values)` replaces the data and invalidates the cache (`del self.stats` if cached). `run(ops)` applies `["stats"]` / `["refresh", values]` and returns the stats results plus the computation count.'),
      hints: ['A cached_property stores its value in the instance `__dict__`; deleting that entry forces recomputation.'],
      entry: 'run',
      signature: 'run(values: list[float], ops: list[list]) -> list',
      starter: code`from functools import cached_property

class Report:
    def __init__(self, values):
        self.values = values
        self.computations = 0


# The tests call run(); don't change it.
def run(values, ops):
    r = Report(values)
    out = []
    for op in ops:
        if op[0] == "stats":
            out.append(r.stats)
        else:
            r.refresh(op[1])
    return out + [r.computations]
`,
      solution: code`from functools import cached_property

class Report:
    def __init__(self, values):
        self.values = values
        self.computations = 0

    @cached_property
    def stats(self):
        self.computations += 1
        v = self.values
        return [min(v), max(v), round(sum(v) / len(v), 2)]

    def refresh(self, values):
        self.values = values
        self.__dict__.pop("stats", None)


def run(values, ops):
    r = Report(values)
    out = []
    for op in ops:
        if op[0] == "stats":
            out.append(r.stats)
        else:
            r.refresh(op[1])
    return out + [r.computations]
`,
      explanation: md('`cached_property` runs the method once and stores the result as an instance attribute, so later reads are plain attribute lookups. Unlike `@property` + `lru_cache`, the cache dies with the object; invalidation is just removing the attribute.'),
      tests: [
        ex('Example', [3, 1, 2], [['stats'], ['stats'], ['refresh', [10, 20]], ['stats']]),
        ex('Never read', [1], []),
        hid('Refresh before first read', [1, 2], [['refresh', [5]], ['stats'], ['stats']]),
        hid('Two refreshes', [4], [['stats'], ['refresh', [1, 1]], ['refresh', [9]], ['stats']]),
      ],
    }),

    python({
      id: 'typed-descriptors',
      title: 'Validated Fields with Descriptors',
      difficulty: 'Hard',
      topics: ['OOP', 'Magic Methods'],
      patterns: ['Descriptor protocol (__set_name__, __get__, __set__)'],
      domains: ['Data quality'],
      roles: DE,
      summary: 'Write a reusable Typed descriptor that validates type and range on every assignment.',
      description: md(
        'Implement `Typed(kind, min_value=None)`: a descriptor storing the value in the instance under a private name, raising `TypeError("<field> must be <kind>")` for the wrong type (bools are not ints) and `ValueError("<field> must be >= <min>")` below the minimum. Use `__set_name__` to learn the field name.',
        '',
        '`class Order` uses `qty = Typed(int, 1)`, `price = Typed(float, 0.0)`, `sku = Typed(str)`. `run(ops)` creates orders / assigns fields and returns the outcome of each op.',
      ),
      hints: ['`__set_name__(self, owner, name)` is called when the class is created; store `self.private = "_" + name`.', 'Return the descriptor itself from `__get__` when accessed on the class (`instance is None`).'],
      entry: 'run',
      signature: 'run(ops: list[list]) -> list',
      starter: code`class Typed:
    def __init__(self, kind, min_value=None):
        self.kind, self.min_value = kind, min_value


# Model and driver used by the tests — don't change anything below.
class Order:
    qty = Typed(int, 1)
    price = Typed(float, 0.0)
    sku = Typed(str)

    def __init__(self, sku, qty, price):
        self.sku, self.qty, self.price = sku, qty, price

def run(ops):
    out, order = [], None
    for op in ops:
        try:
            if op[0] == "new":
                order = Order(*op[1:])
                out.append([order.sku, order.qty, order.price])
            else:
                setattr(order, op[1], op[2])
                out.append(getattr(order, op[1]))
        except (TypeError, ValueError) as e:
            out.append(f"{type(e).__name__}: {e}")
    return out
`,
      solution: code`class Typed:
    def __init__(self, kind, min_value=None):
        self.kind, self.min_value = kind, min_value

    def __set_name__(self, owner, name):
        self.name = name
        self.private = "_" + name

    def __get__(self, instance, owner=None):
        if instance is None:
            return self
        return getattr(instance, self.private)

    def __set__(self, instance, value):
        if isinstance(value, bool) or not isinstance(value, self.kind):
            raise TypeError(f"{self.name} must be {self.kind.__name__}")
        if self.min_value is not None and value < self.min_value:
            raise ValueError(f"{self.name} must be >= {self.min_value}")
        setattr(instance, self.private, value)


class Order:
    qty = Typed(int, 1)
    price = Typed(float, 0.0)
    sku = Typed(str)

    def __init__(self, sku, qty, price):
        self.sku, self.qty, self.price = sku, qty, price

def run(ops):
    out, order = [], None
    for op in ops:
        try:
            if op[0] == "new":
                order = Order(*op[1:])
                out.append([order.sku, order.qty, order.price])
            else:
                setattr(order, op[1], op[2])
                out.append(getattr(order, op[1]))
        except (TypeError, ValueError) as e:
            out.append(f"{type(e).__name__}: {e}")
    return out
`,
      explanation: md('A data descriptor (with `__set__`) on the class intercepts every attribute assignment on instances — the mechanism behind `property`, ORMs and pydantic-style fields. One `Typed` class replaces a property per field.'),
      tests: [
        ex('Example', [['new', 'A1', 2, 9.5], ['set', 'qty', 0], ['set', 'price', 3], ['set', 'qty', 5]]),
        ex('Invalid constructor', [['new', 'B', true, 1.5]]),
        hid('Negative price', [['new', 'C', 1, 1.25], ['set', 'price', -0.5], ['set', 'sku', 7]]),
        hid('String quantity rejected', [['new', 'D', 3, 2.5], ['set', 'qty', '4'], ['set', 'sku', 'D2']]),
      ],
    }),

    python({
      id: 'init-subclass-registry',
      title: 'Auto-Register Subclasses with __init_subclass__',
      difficulty: 'Medium',
      topics: ['Inheritance & MRO', 'OOP'],
      patterns: ['__init_subclass__ registry'],
      domains: ['Event pipelines'],
      roles: DE,
      summary: 'Every Transform subclass registers itself under a name given as a class keyword.',
      description: md('Write `class Transform` so that `class Upper(Transform, name="upper")` registers `Upper` in `Transform.registry["upper"]`; a subclass without `name` is abstract and not registered; a duplicate name raises `ValueError`. Each transform implements `apply(text)`. `run(pipeline, text)` applies the named transforms in order, returning the result or `"unknown: <name>"`.'),
      hints: ['`def __init_subclass__(cls, name=None, **kw): super().__init_subclass__(**kw); ...` runs when each subclass is defined.'],
      entry: 'run',
      signature: 'run(pipeline: list[str], text: str) -> str',
      starter: code`class Transform:
    registry = {}


# Transforms and driver used by the tests — don't change anything below.
class Upper(Transform, name="upper"):
    def apply(self, text):
        return text.upper()

class Strip(Transform, name="strip"):
    def apply(self, text):
        return text.strip()

class Base64ish(Transform):          # abstract helper, not registered
    pass

class Reverse(Base64ish, name="reverse"):
    def apply(self, text):
        return text[::-1]

def run(pipeline, text):
    for name in pipeline:
        cls = Transform.registry.get(name)
        if cls is None:
            return f"unknown: {name}"
        text = cls().apply(text)
    return text
`,
      solution: code`class Transform:
    registry = {}

    def __init_subclass__(cls, name=None, **kwargs):
        super().__init_subclass__(**kwargs)
        if name is None:
            return
        if name in Transform.registry:
            raise ValueError(f"duplicate transform {name}")
        Transform.registry[name] = cls


class Upper(Transform, name="upper"):
    def apply(self, text):
        return text.upper()

class Strip(Transform, name="strip"):
    def apply(self, text):
        return text.strip()

class Base64ish(Transform):
    pass

class Reverse(Base64ish, name="reverse"):
    def apply(self, text):
        return text[::-1]

def run(pipeline, text):
    for name in pipeline:
        cls = Transform.registry.get(name)
        if cls is None:
            return f"unknown: {name}"
        text = cls().apply(text)
    return text
`,
      explanation: md('`__init_subclass__` is a lightweight alternative to metaclasses for "do something whenever a subclass is defined". Class keyword arguments (`name="upper"`) are passed straight to it.'),
      tests: [
        ex('Example', ['strip', 'upper'], '  hello '),
        ex('Unknown transform', ['upper', 'base64'], 'x'),
        hid('Inherited registration', ['reverse', 'upper'], 'abc'),
        hid('Empty pipeline', [], ' keep '),
      ],
    }),

    python({
      id: 'slots-records',
      title: '__slots__: Fixed Attributes, Less Memory',
      difficulty: 'Easy',
      topics: ['OOP', 'Copying & Mutability'],
      patterns: ['__slots__'],
      domains: ['IoT / Telemetry'],
      roles: DE,
      summary: 'Define a slotted reading class and show which attribute assignments are rejected.',
      description: md('Define `class Reading` with `__slots__ = ("sensor", "value")` and an `__init__`. For each `[attribute, value]` in `assignments`, try `setattr` on one reading and report `"ok"` or `"AttributeError"`. Also return whether the instance has a `__dict__`.'),
      hints: ['With `__slots__`, instances have no per-instance `__dict__`, so unknown attributes can\'t be created.'],
      entry: 'run',
      signature: 'run(assignments: list[list]) -> list',
      starter: code`class Reading:
    def __init__(self, sensor, value):
        self.sensor, self.value = sensor, value


# The tests call run(); don't change it.
def run(assignments):
    r = Reading("t1", 20.5)
    out = []
    for attr, value in assignments:
        try:
            setattr(r, attr, value)
            out.append("ok")
        except AttributeError:
            out.append("AttributeError")
    return out + [hasattr(r, "__dict__")]
`,
      solution: code`class Reading:
    __slots__ = ("sensor", "value")

    def __init__(self, sensor, value):
        self.sensor, self.value = sensor, value


def run(assignments):
    r = Reading("t1", 20.5)
    out = []
    for attr, value in assignments:
        try:
            setattr(r, attr, value)
            out.append("ok")
        except AttributeError:
            out.append("AttributeError")
    return out + [hasattr(r, "__dict__")]
`,
      explanation: md('`__slots__` replaces the per-instance dict with fixed storage: less memory per object (significant for millions of small records) and typos like `r.vaule = 1` fail loudly. Trade-off: no dynamic attributes.'),
      tests: [
        ex('Example', [['value', 21.0], ['unit', 'C']]),
        ex('Only known attributes', [['sensor', 't2']]),
        hid('Typo is rejected', [['vaule', 1]]),
        hid('Several valid attributes', [['sensor', 's1'], ['value', 3.5], ['unit', 'F']]),
      ],
    }),

    python({
      id: 'match-statement-commands',
      title: 'Route Events with Structural Pattern Matching',
      difficulty: 'Medium',
      topics: ['Functions & Lambdas', 'Parsing (CSV / JSON)'],
      patterns: ['match / case with mapping and class patterns'],
      domains: ['Event pipelines'],
      roles: DE,
      summary: 'Use match/case to destructure JSON-like events of different shapes.',
      description: md(
        'Classify each event dict with a `match` statement:',
        '',
        '- `{"type": "click", "x": x, "y": y}` → `"click at x,y"`;',
        '- `{"type": "purchase", "items": [first, *rest]}` → `"purchase of <1 + len(rest)> starting with <first>"`;',
        '- `{"type": "purchase", "items": []}` → `"empty purchase"`;',
        '- `{"type": "error", "code": int(code)}` where code ≥ 500 → `"server error <code>"`, other ints → `"client error <code>"`;',
        '- anything else → `"unknown"`.',
      ),
      hints: ['Mapping patterns match a subset of keys; sequence patterns support `[first, *rest]`; `case {...} if guard:` adds conditions.'],
      entry: 'route',
      signature: 'route(events: list[dict]) -> list[str]',
      solution: code`def route(events: list[dict]) -> list[str]:
    out = []
    for e in events:
        match e:
            case {"type": "click", "x": x, "y": y}:
                out.append(f"click at {x},{y}")
            case {"type": "purchase", "items": []}:
                out.append("empty purchase")
            case {"type": "purchase", "items": [first, *rest]}:
                out.append(f"purchase of {1 + len(rest)} starting with {first}")
            case {"type": "error", "code": int(code)} if code >= 500:
                out.append(f"server error {code}")
            case {"type": "error", "code": int(code)}:
                out.append(f"client error {code}")
            case _:
                out.append("unknown")
    return out
`,
      explanation: md('`match` (3.10+) combines shape checks and destructuring: a mapping pattern checks keys and binds values, `int(code)` checks the type, and guards add conditions. Order matters — the empty-list case must come before `[first, *rest]`.'),
      tests: [
        ex('Example', [{ type: 'click', x: 3, y: 4 }, { type: 'purchase', items: ['tea', 'cake'] }, { type: 'error', code: 503 }]),
        ex('Unknown shapes', [{ type: 'click', x: 1 }, { kind: 'other' }]),
        hid('Empty purchase and client error', [{ type: 'purchase', items: [] }, { type: 'error', code: 404 }]),
        hid('Error code not an int', [{ type: 'error', code: '500' }]),
      ],
    }),

    python({
      id: 'runtime-type-check',
      title: 'Validate Records Against TypedDict Hints',
      difficulty: 'Medium',
      topics: ['Error Handling', 'Data Wrangling'],
      patterns: ['typing.get_type_hints at runtime'],
      domains: ['Data quality'],
      roles: DE,
      summary: 'Use a TypedDict as a schema: check required keys and simple types at runtime.',
      description: md('`class Event(TypedDict)` declares `user_id: int`, `event: str`, `value: float`. For each record return `"ok"` or the first problem: `"missing <key>"` (checked in declaration order), `"extra <key>"` (first unexpected key, sorted), or `"<key> should be <type>"` (ints are accepted for float; bools are never numbers).'),
      hints: ['`typing.get_type_hints(Event)` returns the annotations dict in declaration order.'],
      entry: 'validate',
      signature: 'validate(records: list[dict]) -> list[str]',
      solution: code`from typing import TypedDict, get_type_hints

class Event(TypedDict):
    user_id: int
    event: str
    value: float

def _ok(value, t):
    if isinstance(value, bool):
        return t is bool
    if t is float:
        return isinstance(value, (int, float))
    return isinstance(value, t)

def validate(records: list[dict]) -> list[str]:
    hints = get_type_hints(Event)
    out = []
    for r in records:
        missing = [k for k in hints if k not in r]
        extra = sorted(k for k in r if k not in hints)
        if missing:
            out.append(f"missing {missing[0]}")
        elif extra:
            out.append(f"extra {extra[0]}")
        else:
            bad = next((k for k, t in hints.items() if not _ok(r[k], t)), None)
            out.append("ok" if bad is None else f"{bad} should be {hints[bad].__name__}")
    return out
`,
      explanation: md('Type hints are not enforced at runtime, but they are introspectable: `get_type_hints` turns a TypedDict into a schema you can validate against — the same idea libraries like pydantic build on.'),
      tests: [
        ex('Example', [{ user_id: 1, event: 'click', value: 2 }, { user_id: 1, event: 'x' }, { user_id: '1', event: 'x', value: 1.5 }]),
        ex('Extra key', [{ user_id: 1, event: 'x', value: 1.0, debug: true }]),
        hid('Bool is not a number', [{ user_id: true, event: 'x', value: 1.0 }]),
        hid('No records', []),
      ],
    }),

    python({
      id: 'getattr-lazy-proxy',
      title: 'A Lazy-Loading Proxy with __getattr__',
      difficulty: 'Medium',
      topics: ['Magic Methods', 'OOP'],
      patterns: ['__getattr__ delegation'],
      domains: ['APIs / Integration'],
      roles: DE,
      summary: 'Delay creating an expensive client until an attribute is first used, then delegate to it.',
      description: md('Write `LazyClient(factory, log)`: it must not call `factory()` until an attribute that is **not** defined on the proxy is accessed; then it creates the real object once (logging `"created"`), and delegates all such attribute access to it. `run(names)` reads attributes of a proxy around a fake client and returns `[values, log]`.'),
      hints: ['`__getattr__` is only called when normal lookup fails, so attributes set in `__init__` don\'t trigger it.'],
      entry: 'run',
      signature: 'run(names: list[str]) -> list',
      starter: code`class LazyClient:
    def __init__(self, factory, log):
        self._factory, self._log, self._real = factory, log, None


# Fake client and driver used by the tests — don't change anything below.
class FakeClient:
    region = "eu-west-1"
    def ping(self):
        return "pong"

def run(names):
    log = []
    proxy = LazyClient(FakeClient, log)
    values = []
    for n in names:
        attr = getattr(proxy, n)
        values.append(attr() if callable(attr) else attr)
    return [values, log]
`,
      solution: code`class LazyClient:
    def __init__(self, factory, log):
        self._factory, self._log, self._real = factory, log, None

    def __getattr__(self, name):
        if self._real is None:
            self._real = self._factory()
            self._log.append("created")
        return getattr(self._real, name)


class FakeClient:
    region = "eu-west-1"
    def ping(self):
        return "pong"

def run(names):
    log = []
    proxy = LazyClient(FakeClient, log)
    values = []
    for n in names:
        attr = getattr(proxy, n)
        values.append(attr() if callable(attr) else attr)
    return [values, log]
`,
      explanation: md('`__getattr__` (not `__getattribute__`) is a fallback for missing attributes, which makes transparent proxies and lazy initialisation easy without intercepting the proxy\'s own fields. Lazy clients keep imports and connections off the startup path.'),
      tests: [
        ex('Example', ['region', 'ping', 'region']),
        ex('Never used', []),
        hid('Method first', ['ping']),
        hid('Attribute repeated', ['region', 'region', 'region']),
      ],
    }),

    python({
      id: 'enum-flag-permissions',
      title: 'Permission Sets with enum.Flag',
      difficulty: 'Easy',
      topics: ['OOP', 'Math & Bits'],
      patterns: ['Flag combination with | and &'],
      domains: ['Security'],
      roles: DE,
      summary: 'Combine and test permissions as flags instead of lists of strings.',
      description: md('Define `class Perm(Flag)` with `READ`, `WRITE`, `DELETE` (auto values) and `ADMIN = READ | WRITE | DELETE`. For each user\'s list of permission names, return `[combined value as int, can_write, is_admin, sorted names of the individual flags held]`.'),
      hints: ['`functools.reduce(operator.or_, (Perm[n] for n in names), Perm(0))`; test with `Perm.WRITE in perms`.'],
      entry: 'permissions',
      signature: 'permissions(users: list[list[str]]) -> list[list]',
      solution: code`import operator
from enum import Flag, auto
from functools import reduce

class Perm(Flag):
    READ = auto()
    WRITE = auto()
    DELETE = auto()
    ADMIN = READ | WRITE | DELETE

def permissions(users: list[list[str]]) -> list[list]:
    out = []
    for names in users:
        p = reduce(operator.or_, (Perm[n] for n in names), Perm(0))
        held = sorted(m.name for m in (Perm.READ, Perm.WRITE, Perm.DELETE) if m in p)
        out.append([p.value, Perm.WRITE in p, (p & Perm.ADMIN) == Perm.ADMIN, held])
    return out
`,
      explanation: md('`Flag` members combine with bitwise operators and support `in` for membership — a type-safe replacement for permission strings or magic integers.'),
      tests: [
        ex('Example', [['READ'], ['READ', 'WRITE'], ['ADMIN']]),
        ex('No permissions', [[]]),
        hid('Duplicates collapse', [['DELETE', 'DELETE', 'READ']]),
        hid('Write and delete', [['WRITE', 'DELETE'], ['READ', 'WRITE', 'DELETE']]),
      ],
    }),

    python({
      id: 'decimal-money-rounding',
      title: 'Money Rounding with Decimal',
      difficulty: 'Easy',
      topics: ['Math & Bits', 'Serialization'],
      patterns: ['Decimal quantize with rounding modes'],
      domains: ['Finance'],
      roles: DE,
      summary: 'Round amounts with half-up and banker\'s rounding — and see why floats get it wrong.',
      description: md('For each amount string, return `[float round to 2, Decimal ROUND_HALF_UP to 2, Decimal ROUND_HALF_EVEN to 2]` — the Decimal results as strings.'),
      hints: ['`Decimal(s).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)`; build Decimals from **strings**, not floats.'],
      entry: 'round_all',
      signature: 'round_all(amounts: list[str]) -> list[list]',
      solution: code`from decimal import Decimal, ROUND_HALF_EVEN, ROUND_HALF_UP

def round_all(amounts: list[str]) -> list[list]:
    cent = Decimal("0.01")
    return [[round(float(a), 2),
             str(Decimal(a).quantize(cent, rounding=ROUND_HALF_UP)),
             str(Decimal(a).quantize(cent, rounding=ROUND_HALF_EVEN))] for a in amounts]
`,
      explanation: md('`2.675` is stored as 2.67499999… in binary, so `round(2.675, 2)` gives 2.67. `Decimal("2.675")` is exact; half-up gives 2.68 (what invoices expect) while half-even (banker\'s rounding, Python\'s default) gives 2.68 or 2.67 depending on the neighbouring digit.'),
      tests: [
        ex('Example', ['2.675', '1.005', '0.125']),
        ex('No rounding needed', ['3.10']),
        hid('Half-even differences', ['0.135', '0.145', '-1.555']),
        hid('Large and tiny amounts', ['123456.785', '0.005', '-0.004']),
      ],
    }),
  ],
};
