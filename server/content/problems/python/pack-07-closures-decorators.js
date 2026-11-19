// Python pack 7 — closures and decorators: nonlocal state, decorators with and
// without arguments, functools.wraps, stacking order, memoisation, retries,
// rate limits and class decorators. Decorator problems use a small driver,
// `run(...)`, so the tests can exercise the decorated functions.
import { python, md, code, ex, hid } from './define.js';
import { dev, jpm, tag } from './sources.js';

const DE = ['Data Engineer'];

export default {
  problems: [
    python({
      id: 'counter-closure',
      title: 'A Counter Closure with nonlocal',
      difficulty: 'Easy',
      topics: ['Closures & Decorators', 'Arguments & Scope'],
      patterns: ['Closure over mutable state'],
      domains: ['Platform / Ops'],
      roles: DE,
      summary: 'Build an ID generator as a closure that remembers its last value between calls.',
      description: md(
        'Implement `make_counter(start, step)` returning a function that, on each call, returns the next value: `start`, `start + step`, `start + 2*step`, …',
        '',
        'Two counters must not share state. The tests call `run(start, step, n, m)`: it makes two counters, calls the first `n` times and the second `m` times, and returns both lists.',
      ),
      hints: ['Store the next value in the enclosing function; the inner function needs `nonlocal` to rebind it.'],
      entry: 'run',
      signature: 'run(start: int, step: int, n: int, m: int) -> list[list[int]]',
      starter: code`def make_counter(start, step):
    pass


# The tests call run(); don't change it.
def run(start, step, n, m):
    a, b = make_counter(start, step), make_counter(start, step)
    return [[a() for _ in range(n)], [b() for _ in range(m)]]
`,
      solution: code`def make_counter(start, step):
    current = start - step

    def next_value():
        nonlocal current
        current += step
        return current

    return next_value


def run(start, step, n, m):
    a, b = make_counter(start, step), make_counter(start, step)
    return [[a() for _ in range(n)], [b() for _ in range(m)]]
`,
      explanation: md('Each call to `make_counter` creates a new scope, and the returned function keeps that scope alive — a closure. `nonlocal current` lets the inner function **rebind** the enclosing variable; without it, `current += step` would make `current` local and raise `UnboundLocalError`.'),
      tests: [
        ex('Example', 100, 10, 3, 1),
        ex('Counters are independent', 0, 1, 4, 2),
        hid('Negative step', 5, -2, 4, 0),
        hid('No calls', 1, 1, 0, 0),
      ],
    }),

    python({
      id: 'running-average-closure',
      title: 'Running Average with a Closure',
      difficulty: 'Easy',
      topics: ['Closures & Decorators', 'Streaming & State'],
      patterns: ['Closure over mutable state'],
      domains: ['IoT / Telemetry'],
      roles: DE,
      summary: 'Keep a running mean of sensor values in O(1) memory with a closure.',
      description: md(
        '`make_averager()` returns `add(value)`, which records the value and returns the mean of everything added so far (rounded to 3 decimals). Keep only a running total and count, not the values.',
        '',
        'The tests call `run(values)` and return each intermediate mean.',
      ),
      hints: ['Two `nonlocal` variables — `total` and `count` — are all you need.'],
      entry: 'run',
      signature: 'run(values: list[float]) -> list[float]',
      starter: code`def make_averager():
    pass


# The tests call run(); don't change it.
def run(values):
    add = make_averager()
    return [add(v) for v in values]
`,
      solution: code`def make_averager():
    total = 0.0
    count = 0

    def add(value):
        nonlocal total, count
        total += value
        count += 1
        return round(total / count, 3)

    return add


def run(values):
    add = make_averager()
    return [add(v) for v in values]
`,
      explanation: md('A closure is a lightweight object: data (`total`, `count`) plus one behaviour (`add`). Keeping sums instead of the history is the streaming-friendly choice — memory stays constant however many readings arrive.'),
      tests: [
        ex('Example', [10, 20, 30]),
        ex('Single value', [7]),
        hid('Decimals', [1, 2, 2]),
        hid('Empty', []),
      ],
    }),

    python({
      id: 'memoize-decorator',
      title: 'Write a Memoising Decorator',
      difficulty: 'Medium',
      topics: ['Closures & Decorators', 'Dicts & Sets'],
      patterns: ['Decorator with state', 'Memoisation'],
      domains: ['APIs / Integration'],
      roles: DE,
      summary: 'Cache results of an expensive lookup by its arguments and expose cache statistics.',
      description: md(
        'Write a decorator `memoize` that caches results by the positional arguments. The wrapper must expose `wrapper.hits` and `wrapper.misses` counters and keep the original function\'s `__name__`.',
        '',
        'The tests call `run(calls)`: `lookup(country, year)` is decorated with your `memoize` and called once per `[country, year]`; `run` returns `[results, hits, misses, name]`.',
      ),
      hints: ['Use a dict keyed by the `args` tuple.', '`functools.wraps(fn)` copies `__name__`, `__doc__` and friends onto the wrapper.', 'Function objects can carry attributes: `wrapper.hits = 0`.'],
      entry: 'run',
      signature: 'run(calls: list[list]) -> list',
      starter: code`import functools

def memoize(fn):
    pass


# The tests call run(); don't change anything below.
@memoize
def lookup(country, year):
    return f"{country}-{year}-rate"

def run(calls):
    results = [lookup(*c) for c in calls]
    return [results, lookup.hits, lookup.misses, lookup.__name__]
`,
      solution: code`import functools

def memoize(fn):
    cache = {}

    @functools.wraps(fn)
    def wrapper(*args):
        if args in cache:
            wrapper.hits += 1
            return cache[args]
        wrapper.misses += 1
        cache[args] = result = fn(*args)
        return result

    wrapper.hits = 0
    wrapper.misses = 0
    return wrapper


@memoize
def lookup(country, year):
    return f"{country}-{year}-rate"

def run(calls):
    results = [lookup(*c) for c in calls]
    return [results, lookup.hits, lookup.misses, lookup.__name__]
`,
      explanation: md('A decorator is a function that takes a function and returns a replacement. The cache lives in the decorator\'s closure, one per decorated function. Without `functools.wraps`, `lookup.__name__` would be `"wrapper"` — which breaks logging, debugging and frameworks that look functions up by name.'),
      tests: [
        ex('Example', [['IN', 2024], ['US', 2024], ['IN', 2024]]),
        ex('All misses', [['a', 1], ['b', 2]]),
        hid('Repeated calls', [['x', 1], ['x', 1], ['x', 1], ['y', 1]]),
        hid('No calls', []),
      ],
    }),

    python({
      id: 'timing-decorator',
      title: 'A Timing Decorator that Keeps the Function\'s Identity',
      difficulty: 'Medium',
      topics: ['Closures & Decorators'],
      patterns: ['Decorator factory', 'functools.wraps'],
      domains: ['Platform / Ops'],
      ...tag(dev('Cisco', 'decorators and functools.wraps for function timing')),
      roles: DE,
      summary: 'Record how long each call takes, using an injected clock, without losing __name__ or __doc__.',
      description: md(
        'Write `timed(clock, log)` — a decorator **factory**: `@timed(clock, log)` wraps a function so each call appends `[function_name, elapsed]` to the list `log`, where elapsed is `clock()` after minus `clock()` before. The wrapper must return the function\'s result and keep its `__name__` and `__doc__`.',
        '',
        'The tests use a fake clock so timings are deterministic. `run(durations)` returns `[results, log, name, doc]`.',
      ),
      hints: ['Three layers: `timed(clock, log)` returns `decorate(fn)`, which returns `wrapper(*args, **kwargs)`.', 'Use `try/finally` so the timing is logged even if the function raises.'],
      entry: 'run',
      signature: 'run(durations: list[int]) -> list',
      starter: code`import functools

def timed(clock, log):
    pass


# The tests call run(); don't change anything below.
def run(durations):
    now = {"t": 0}
    def clock():
        return now["t"]

    log = []

    @timed(clock, log)
    def load(batch, seconds):
        """Load one batch."""
        now["t"] += seconds
        return f"loaded {batch}"

    results = [load(i, d) for i, d in enumerate(durations)]
    return [results, log, load.__name__, load.__doc__]
`,
      solution: code`import functools

def timed(clock, log):
    def decorate(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            start = clock()
            try:
                return fn(*args, **kwargs)
            finally:
                log.append([fn.__name__, clock() - start])
        return wrapper
    return decorate


def run(durations):
    now = {"t": 0}
    def clock():
        return now["t"]

    log = []

    @timed(clock, log)
    def load(batch, seconds):
        """Load one batch."""
        now["t"] += seconds
        return f"loaded {batch}"

    results = [load(i, d) for i, d in enumerate(durations)]
    return [results, log, load.__name__, load.__doc__]
`,
      explanation: md('`@timed(clock, log)` first **calls** `timed(...)`, and the function it returns is the actual decorator — that is how decorators take arguments. Injecting the clock (instead of calling `time.perf_counter` directly) makes the decorator testable. `finally` guarantees a log entry even when the call raises.'),
      tests: [
        ex('Example', [3, 5]),
        ex('Zero-length call', [0]),
        hid('Many calls', [1, 2, 3, 4]),
        hid('No calls', []),
      ],
    }),

    python({
      id: 'retry-decorator',
      title: 'Retry a Flaky Call',
      difficulty: 'Medium',
      topics: ['Closures & Decorators', 'Error Handling'],
      patterns: ['Decorator factory', 'Retry with backoff'],
      domains: ['APIs / Integration'],
      roles: DE,
      summary: 'Retry a function on specific exceptions with exponential backoff (recorded, not slept).',
      description: md(
        'Write `retry(times, on, base_delay, sleeps)`: a decorator factory that calls the function up to `times` attempts in total. If an attempt raises an exception that is an instance of a class in the tuple `on`, record the backoff delay `base_delay * 2 ** (attempt - 1)` in the list `sleeps` (instead of sleeping) and try again. Any other exception — or the last failed attempt — propagates.',
        '',
        '`run(times, failures, error)` decorates a fake API that raises `error` (`"timeout"` → `TimeoutError`, `"bad"` → `ValueError`) for its first `failures` calls, then succeeds. It returns `[outcome, attempts, sleeps]`, where outcome is the result or the name of the exception that escaped.',
      ),
      hints: ['Loop `for attempt in range(1, times + 1)`; `except on:` catches any class in the tuple.', 'Re-raise on the last attempt with a bare `raise`.'],
      entry: 'run',
      signature: 'run(times: int, failures: int, error: str) -> list',
      starter: code`import functools

def retry(times, on, base_delay, sleeps):
    pass


# The tests call run(); don't change anything below.
def run(times, failures, error):
    sleeps, calls = [], {"n": 0}
    exc = {"timeout": TimeoutError, "bad": ValueError}[error]

    @retry(times, (TimeoutError, ConnectionError), 0.5, sleeps)
    def fetch():
        calls["n"] += 1
        if calls["n"] <= failures:
            raise exc("boom")
        return "ok"

    try:
        outcome = fetch()
    except Exception as e:
        outcome = type(e).__name__
    return [outcome, calls["n"], sleeps]
`,
      solution: code`import functools

def retry(times, on, base_delay, sleeps):
    def decorate(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            for attempt in range(1, times + 1):
                try:
                    return fn(*args, **kwargs)
                except on:
                    if attempt == times:
                        raise
                    sleeps.append(base_delay * 2 ** (attempt - 1))
        return wrapper
    return decorate


def run(times, failures, error):
    sleeps, calls = [], {"n": 0}
    exc = {"timeout": TimeoutError, "bad": ValueError}[error]

    @retry(times, (TimeoutError, ConnectionError), 0.5, sleeps)
    def fetch():
        calls["n"] += 1
        if calls["n"] <= failures:
            raise exc("boom")
        return "ok"

    try:
        outcome = fetch()
    except Exception as e:
        outcome = type(e).__name__
    return [outcome, calls["n"], sleeps]
`,
      explanation: md(
        'Only retry errors that can succeed on a second try (timeouts, dropped connections); a `ValueError` from bad input will fail forever, so it must surface immediately. Exponential backoff gives a struggling service room to recover. In production add jitter and a cap on the delay.',
      ),
      tests: [
        ex('Succeeds on the third attempt', 5, 2, 'timeout'),
        ex('Non-retryable error escapes at once', 5, 1, 'bad'),
        hid('Gives up after the last attempt', 3, 10, 'timeout'),
        hid('No failures', 3, 0, 'timeout'),
        hid('Single attempt', 1, 1, 'timeout'),
      ],
    }),

    python({
      id: 'smart-division-decorator',
      title: 'A "Smart Division" Decorator',
      difficulty: 'Easy',
      topics: ['Closures & Decorators'],
      patterns: ['Argument-adjusting decorator'],
      domains: ['Math'],
      roles: DE,
      summary: 'Wrap a division function so it never divides a smaller number by a larger one or by zero.',
      description: md(
        'Write a decorator `smart` for two-argument functions: if the first argument is smaller than the second, swap them; if the (new) divisor is 0, return `"undefined"` without calling the function.',
        '',
        '`run(pairs)` applies the decorated `divide(a, b)` (which returns `round(a / b, 3)`) to every pair.',
      ),
      hints: ['The wrapper decides what to pass on — it can reorder arguments or skip the call entirely.'],
      entry: 'run',
      signature: 'run(pairs: list[list]) -> list',
      starter: code`def smart(fn):
    pass


# The tests call run(); don't change anything below.
@smart
def divide(a, b):
    return round(a / b, 3)

def run(pairs):
    return [divide(a, b) for a, b in pairs]
`,
      solution: code`import functools

def smart(fn):
    @functools.wraps(fn)
    def wrapper(a, b):
        if a < b:
            a, b = b, a
        if b == 0:
            return "undefined"
        return fn(a, b)
    return wrapper


@smart
def divide(a, b):
    return round(a / b, 3)

def run(pairs):
    return [divide(a, b) for a, b in pairs]
`,
      explanation: md('A decorator can change behaviour **around** a function without touching its body: validating, transforming or short-circuiting arguments. `divide` itself stays a one-liner.'),
      tests: [
        ex('Example', [[2, 8], [9, 3]]),
        ex('Zero divisor', [[0, 5], [0, 0]]),
        hid('Negative numbers', [[-4, 2], [2, -4]]),
        hid('Equal values', [[3, 3]]),
      ],
    }),

    python({
      id: 'decorator-stacking-order',
      title: 'In Which Order Do Stacked Decorators Run?',
      difficulty: 'Medium',
      topics: ['Closures & Decorators'],
      patterns: ['Decorator stacking'],
      domains: ['Developer tools'],
      ...tag(dev('Google', 'dynamic typing and decorator stacks')),
      roles: DE,
      summary: 'Trace when stacked decorators are applied and in which order their wrappers run.',
      description: md(
        'Write `tag(name, trace)`, a decorator factory whose decorator appends `"apply <name>"` to `trace` when it **decorates**, and whose wrapper appends `"enter <name>"` before and `"exit <name>"` after calling the function.',
        '',
        '`run(names)` stacks one `tag` per name (first name on top) on a function that appends `"body"`, calls it once, and returns the trace.',
      ),
      hints: ['Decorators are applied bottom-up (closest to the function first), but the outermost wrapper runs first when called.'],
      entry: 'run',
      signature: 'run(names: list[str]) -> list[str]',
      starter: code`import functools

def tag(name, trace):
    pass


# The tests call run(); don't change anything below.
def run(names):
    trace = []
    def body():
        trace.append("body")
    fn = body
    for name in reversed(names):          # same as writing @tag(...) lines top to bottom
        fn = tag(name, trace)(fn)
    trace.append("call")
    fn()
    return trace
`,
      solution: code`import functools

def tag(name, trace):
    def decorate(fn):
        trace.append(f"apply {name}")

        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            trace.append(f"enter {name}")
            try:
                return fn(*args, **kwargs)
            finally:
                trace.append(f"exit {name}")
        return wrapper
    return decorate


def run(names):
    trace = []
    def body():
        trace.append("body")
    fn = body
    for name in reversed(names):
        fn = tag(name, trace)(fn)
    trace.append("call")
    fn()
    return trace
`,
      explanation: md(
        '```python',
        '@a',
        '@b',
        'def f(): ...',
        '```',
        '',
        'means `f = a(b(f))`: `b` is applied first, then `a`. When called, `a`\'s wrapper is outermost, so the order is enter a → enter b → body → exit b → exit a. Getting this right matters for stacks like `@retry` over `@timed` (is the retry loop timed as a whole, or each attempt?).',
      ),
      tests: [
        ex('Two decorators', ['outer', 'inner']),
        ex('One decorator', ['only']),
        hid('Three decorators', ['auth', 'cache', 'log']),
        hid('No decorators', []),
      ],
    }),

    python({
      id: 'enforce-types-decorator',
      title: 'Check Argument Types from Annotations',
      difficulty: 'Medium',
      topics: ['Closures & Decorators', 'Error Handling'],
      patterns: ['Introspection with inspect.signature'],
      domains: ['Data quality'],
      roles: DE,
      summary: 'A decorator that validates arguments against the function\'s type annotations.',
      description: md(
        'Write `enforce_types`: before calling the function, bind the call\'s arguments to its signature and, for every parameter annotated with a **class** (like `int`, `str`, `list`), check `isinstance(value, annotation)`. On the first mismatch raise `TypeError("<param> must be <type name>, got <actual type name>")`. Unannotated parameters are not checked; `bool` must not pass as `int`.',
        '',
        '`run(calls)` calls a decorated `load(table: str, rows: int, dry_run=False)` with each `[args, kwargs]` and returns the result or the error message.',
      ),
      hints: ['`inspect.signature(fn).bind(*args, **kwargs)` maps arguments to parameter names; `.apply_defaults()` fills the rest.', 'Annotations live in `fn.__annotations__`.'],
      entry: 'run',
      signature: 'run(calls: list[list]) -> list[str]',
      starter: code`import functools
import inspect

def enforce_types(fn):
    pass


# The tests call run(); don't change anything below.
@enforce_types
def load(table: str, rows: int, dry_run=False):
    return f"{'would load' if dry_run else 'loaded'} {rows} rows into {table}"

def run(calls):
    out = []
    for args, kwargs in calls:
        try:
            out.append(load(*args, **kwargs))
        except TypeError as e:
            out.append(str(e))
    return out
`,
      solution: code`import functools
import inspect

def enforce_types(fn):
    sig = inspect.signature(fn)
    hints = {k: v for k, v in fn.__annotations__.items() if k != "return" and isinstance(v, type)}

    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        bound = sig.bind(*args, **kwargs)
        bound.apply_defaults()
        for name, value in bound.arguments.items():
            expected = hints.get(name)
            if expected is None:
                continue
            ok = isinstance(value, expected) and not (expected is int and isinstance(value, bool))
            if not ok:
                raise TypeError(f"{name} must be {expected.__name__}, got {type(value).__name__}")
        return fn(*args, **kwargs)
    return wrapper


@enforce_types
def load(table: str, rows: int, dry_run=False):
    return f"{'would load' if dry_run else 'loaded'} {rows} rows into {table}"

def run(calls):
    out = []
    for args, kwargs in calls:
        try:
            out.append(load(*args, **kwargs))
        except TypeError as e:
            out.append(str(e))
    return out
`,
      explanation: md('`inspect.signature(...).bind` does the same argument matching Python itself does (positional, keyword, defaults), so the checks work however the caller passes arguments. Binding errors (a missing argument) also raise `TypeError`, exactly like a normal call.'),
      tests: [
        ex('Example', [[['orders', 10], {}], [['orders', '10'], {}]]),
        ex('Keyword arguments', [[[], { table: 'users', rows: 3, dry_run: true }]]),
        hid('bool is not an int', [[['t', true], {}]]),
        hid('Missing argument', [[['t'], {}]]),
        hid('Wrong table type', [[[5, 5], {}]]),
      ],
    }),

    python({
      id: 'rate-limit-decorator',
      title: 'Sliding-Window Rate Limiter Decorator',
      difficulty: 'Hard',
      topics: ['Closures & Decorators', 'Stacks & Queues', 'Streaming & State'],
      patterns: ['Sliding window with a deque'],
      domains: ['APIs / Integration'],
      roles: DE,
      summary: 'Allow at most N calls in any rolling window of W seconds; reject the rest.',
      description: md(
        'Write `rate_limited(max_calls, window, clock)`: the decorated function may run at most `max_calls` times in any rolling window of `window` seconds (a call at time t counts for the window `(t - window, t]`). A rejected call returns `"rate limited"` and does **not** count toward the limit.',
        '',
        '`run(max_calls, window, times)` calls a decorated `ping(i)` (returns `"ok <i>"`) at each time in `times` (non-decreasing) and returns the results.',
      ),
      hints: ['Keep the timestamps of accepted calls in a `deque`; before each call, pop timestamps `<= now - window` from the left.'],
      entry: 'run',
      signature: 'run(max_calls: int, window: float, times: list[float]) -> list[str]',
      starter: code`import functools
from collections import deque

def rate_limited(max_calls, window, clock):
    pass


# The tests call run(); don't change anything below.
def run(max_calls, window, times):
    now = {"t": 0}

    @rate_limited(max_calls, window, lambda: now["t"])
    def ping(i):
        return f"ok {i}"

    out = []
    for i, t in enumerate(times):
        now["t"] = t
        out.append(ping(i))
    return out
`,
      solution: code`import functools
from collections import deque

def rate_limited(max_calls, window, clock):
    def decorate(fn):
        accepted = deque()

        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            now = clock()
            while accepted and accepted[0] <= now - window:
                accepted.popleft()
            if len(accepted) >= max_calls:
                return "rate limited"
            accepted.append(now)
            return fn(*args, **kwargs)
        return wrapper
    return decorate


def run(max_calls, window, times):
    now = {"t": 0}

    @rate_limited(max_calls, window, lambda: now["t"])
    def ping(i):
        return f"ok {i}"

    out = []
    for i, t in enumerate(times):
        now["t"] = t
        out.append(ping(i))
    return out
`,
      explanation: md('A deque of accepted timestamps is a sliding-window log: expired entries leave from the left in amortised O(1). Not counting rejected calls is a deliberate choice — otherwise a client that keeps retrying would lock itself out forever. A token bucket is the O(1)-memory alternative.'),
      tests: [
        ex('Example', 2, 10, [0, 1, 2, 10, 11, 12]),
        ex('Limit of one', 1, 5, [0, 4.9, 5]),
        hid('Burst then quiet', 3, 1, [0, 0, 0, 0, 1, 1]),
        hid('No calls', 2, 10, []),
        hid('Rejected calls do not extend the window', 1, 3, [0, 1, 2, 3, 4]),
      ],
    }),

    python({
      id: 'register-class-decorator',
      title: 'A Class Decorator that Registers Plugins',
      difficulty: 'Medium',
      topics: ['Closures & Decorators', 'OOP'],
      patterns: ['Class decorator', 'Registry'],
      domains: ['Event pipelines'],
      roles: DE,
      summary: 'Decorate reader classes so they register themselves by format and gain a helpful repr.',
      description: md(
        'Write a decorator factory `reader(fmt)` for **classes**: it stores the class in `REGISTRY[fmt]`, sets a class attribute `format = fmt`, adds a `__repr__` returning `"<ClassName fmt>"`, and returns the class itself. Registering the same format twice raises `ValueError`.',
        '',
        '`run(fmt, text)` looks up the reader for `fmt`, creates it, and returns `[repr(reader), reader.parse(text)]`, or `["unknown format", None]`.',
      ),
      hints: ['A class decorator receives the class object; you can set attributes on it and return it.', '`cls.__name__` gives the class name inside `__repr__`.'],
      entry: 'run',
      signature: 'run(fmt: str, text: str) -> list',
      starter: code`REGISTRY = {}

def reader(fmt):
    pass


# Readers and driver used by the tests — don't change anything below.
@reader("csv")
class CsvReader:
    def parse(self, text):
        return [line.split(",") for line in text.splitlines() if line]

@reader("tsv")
class TsvReader:
    def parse(self, text):
        return [line.split("\t") for line in text.splitlines() if line]

def run(fmt, text):
    cls = REGISTRY.get(fmt)
    if cls is None:
        return ["unknown format", None]
    r = cls()
    return [repr(r), r.parse(text)]
`,
      solution: code`REGISTRY = {}

def reader(fmt):
    def decorate(cls):
        if fmt in REGISTRY:
            raise ValueError(f"format {fmt!r} already registered")
        cls.format = fmt
        cls.__repr__ = lambda self: f"<{type(self).__name__} {self.format}>"
        REGISTRY[fmt] = cls
        return cls
    return decorate


@reader("csv")
class CsvReader:
    def parse(self, text):
        return [line.split(",") for line in text.splitlines() if line]

@reader("tsv")
class TsvReader:
    def parse(self, text):
        return [line.split("\t") for line in text.splitlines() if line]

def run(fmt, text):
    cls = REGISTRY.get(fmt)
    if cls is None:
        return ["unknown format", None]
    r = cls()
    return [repr(r), r.parse(text)]
`,
      explanation: md('Class decorators run once, when the `class` statement finishes, so they are a clean way to register plugins or add boilerplate methods. Returning the same class (not a wrapper) keeps `isinstance` and inheritance working normally.'),
      tests: [
        ex('CSV', 'csv', 'a,b\n1,2\n'),
        ex('Unknown format', 'json', '{}'),
        hid('TSV', 'tsv', 'x\ty\n'),
        hid('Blank lines skipped', 'csv', '\n\nk,v\n\n'),
      ],
    }),

    python({
      id: 'repeat-decorator',
      title: 'A Decorator with Arguments: @repeat(n)',
      difficulty: 'Easy',
      topics: ['Closures & Decorators'],
      patterns: ['Decorator factory'],
      domains: ['Experimentation'],
      roles: DE,
      summary: 'Call a function n times and collect every result.',
      description: md(
        'Write `repeat(n)`: the decorated function, when called, runs `n` times with the same arguments and returns the list of results. `repeat(0)` returns `[]` without calling it.',
        '',
        '`run(n, start)` decorates a function that returns an incrementing value starting at `start`.',
      ),
      hints: ['`repeat(n)` must return the actual decorator.'],
      entry: 'run',
      signature: 'run(n: int, start: int) -> list[int]',
      starter: code`def repeat(n):
    pass


# The tests call run(); don't change anything below.
def run(n, start):
    state = {"v": start}

    @repeat(n)
    def tick(step):
        state["v"] += step
        return state["v"]

    return tick(2)
`,
      solution: code`import functools

def repeat(n):
    def decorate(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            return [fn(*args, **kwargs) for _ in range(n)]
        return wrapper
    return decorate


def run(n, start):
    state = {"v": start}

    @repeat(n)
    def tick(step):
        state["v"] += step
        return state["v"]

    return tick(2)
`,
      explanation: md('With arguments, the `@` line is evaluated first (`repeat(3)`), and its **result** decorates the function. So a decorator with arguments is three nested functions: factory → decorator → wrapper.'),
      tests: [
        ex('Example', 3, 10),
        ex('Zero repeats', 0, 1),
        hid('Once', 1, -2),
        hid('Five times', 5, 0),
      ],
    }),

    python({
      id: 'lru-cache-decorator',
      title: 'Implement an LRU Cache Decorator',
      difficulty: 'Hard',
      topics: ['Closures & Decorators', 'Dicts & Sets'],
      patterns: ['OrderedDict LRU'],
      domains: ['APIs / Integration'],
      roles: DE,
      summary: 'Bound a memoisation cache to maxsize entries, evicting the least recently used.',
      description: md(
        'Write `lru(maxsize)` — like `functools.lru_cache`, but recording what happens. The decorated function caches by positional args; when a new entry would exceed `maxsize`, evict the **least recently used** entry (a cache hit counts as a use). Record each event in `wrapper.events` as `"hit <args>"`, `"miss <args>"` or `"evict <args>"` (args shown as the tuple\'s `repr`).',
        '',
        '`run(maxsize, keys)` calls a decorated `square(k)` for every key and returns `[results, events]`.',
      ),
      hints: ['`collections.OrderedDict` has `move_to_end(key)` and `popitem(last=False)`.', 'Plain dicts also keep insertion order: delete and re-insert to "touch" a key.'],
      entry: 'run',
      signature: 'run(maxsize: int, keys: list[int]) -> list',
      starter: code`import functools
from collections import OrderedDict

def lru(maxsize):
    pass


# The tests call run(); don't change anything below.
def run(maxsize, keys):
    @lru(maxsize)
    def square(k):
        return k * k

    results = [square(k) for k in keys]
    return [results, square.events]
`,
      solution: code`import functools
from collections import OrderedDict

def lru(maxsize):
    def decorate(fn):
        cache = OrderedDict()

        @functools.wraps(fn)
        def wrapper(*args):
            if args in cache:
                cache.move_to_end(args)
                wrapper.events.append(f"hit {args!r}")
                return cache[args]
            wrapper.events.append(f"miss {args!r}")
            result = fn(*args)
            cache[args] = result
            if len(cache) > maxsize:
                old, _ = cache.popitem(last=False)
                wrapper.events.append(f"evict {old!r}")
            return result

        wrapper.events = []
        return wrapper
    return decorate


def run(maxsize, keys):
    @lru(maxsize)
    def square(k):
        return k * k

    results = [square(k) for k in keys]
    return [results, square.events]
`,
      explanation: md('An `OrderedDict` keeps keys in recency order: `move_to_end` on every hit, `popitem(last=False)` to drop the oldest — both O(1). This is the structure behind `functools.lru_cache` and the classic "design an LRU cache" interview question.'),
      tests: [
        ex('Example', 2, [1, 2, 1, 3, 2]),
        ex('Everything fits', 5, [4, 4, 4]),
        hid('Size one', 1, [1, 2, 1]),
        hid('Recency, not insertion order', 2, [1, 2, 1, 3, 1, 2]),
      ],
    }),

    python({
      id: 'log-calls-decorator',
      title: 'Log Every Call and Its Result',
      difficulty: 'Easy',
      topics: ['Closures & Decorators', 'Arguments & Scope'],
      patterns: ['Wrapper with *args/**kwargs'],
      domains: ['Platform / Ops'],
      ...tag(jpm('decorators')),
      roles: DE,
      summary: 'A decorator that records each call as "name(args) -> result", forwarding any arguments.',
      description: md(
        'Write `logged(log)`: the decorated function appends one line per call to `log`, formatted `name(a, b, k=v) -> result` where positional arguments and keyword arguments (in the order passed) are shown with `repr`. If the call raises, log `name(...) raised ErrorName` and re-raise.',
        '',
        '`run(calls)` calls a decorated `scale(x, factor=2)` with each `[args, kwargs]` and returns the log.',
      ),
      hints: ['`*args, **kwargs` in the wrapper forwards anything.', '`", ".join([repr(a) for a in args] + [f"{k}={v!r}" for k, v in kwargs.items()])`.'],
      entry: 'run',
      signature: 'run(calls: list[list]) -> list[str]',
      starter: code`import functools

def logged(log):
    pass


# The tests call run(); don't change anything below.
def run(calls):
    log = []

    @logged(log)
    def scale(x, factor=2):
        return x * factor

    for args, kwargs in calls:
        try:
            scale(*args, **kwargs)
        except Exception:
            pass
    return log
`,
      solution: code`import functools

def logged(log):
    def decorate(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            shown = ", ".join([repr(a) for a in args] + [f"{k}={v!r}" for k, v in kwargs.items()])
            try:
                result = fn(*args, **kwargs)
            except Exception as e:
                log.append(f"{fn.__name__}({shown}) raised {type(e).__name__}")
                raise
            log.append(f"{fn.__name__}({shown}) -> {result!r}")
            return result
        return wrapper
    return decorate


def run(calls):
    log = []

    @logged(log)
    def scale(x, factor=2):
        return x * factor

    for args, kwargs in calls:
        try:
            scale(*args, **kwargs)
        except Exception:
            pass
    return log
`,
      explanation: md('Accepting `*args, **kwargs` makes the decorator work for any signature. `repr` shows strings with quotes, so `scale("ab")` logs as `scale(\'ab\') -> \'abab\'` — unambiguous in a log. A bare `raise` re-raises the original exception with its traceback.'),
      tests: [
        ex('Example', [[[3], {}], [['ab'], { factor: 3 }]]),
        ex('Error is logged and re-raised', [[[null], {}]]),
        hid('Keyword only', [[[], { x: 1.5, factor: 4 }]]),
        hid('No calls', []),
      ],
    }),
  ],
};
