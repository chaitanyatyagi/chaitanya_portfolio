// Python pack 8 — iterators and generators: the iterator protocol, iterables
// vs. iterators, yield, yield from, send(), generator pipelines, laziness with
// infinite streams, and itertools (islice, cycle, groupby, chain, tee).
import { python, md, code, ex, hid } from './define.js';
import { dev, lds, tag } from './sources.js';

const DE = ['Data Engineer'];

export default {
  problems: [
    python({
      id: 'countdown-iterator',
      title: 'Implement the Iterator Protocol',
      difficulty: 'Easy',
      topics: ['Generators & Iterators', 'OOP'],
      patterns: ['__iter__ / __next__'],
      domains: ['Platform / Ops'],
      roles: DE,
      summary: 'Write a Countdown class that works in a for loop by implementing __iter__ and __next__.',
      description: md(
        'Implement `Countdown(start, step=1)`: iterating it yields `start, start - step, …` down to (and including) the last value that is ≥ 0, then stops. It is its own iterator: `iter(c) is c`.',
        '',
        '`run(start, step)` returns `[list(c), list(c), iter(c) is c]` — the second pass is empty because the iterator is exhausted.',
      ),
      hints: ['`__iter__` returns `self`; `__next__` returns the next value or raises `StopIteration`.'],
      entry: 'run',
      signature: 'run(start: int, step: int) -> list',
      starter: code`class Countdown:
    def __init__(self, start, step=1):
        pass

    def __iter__(self):
        pass

    def __next__(self):
        pass


# The tests call run(); don't change it.
def run(start, step):
    c = Countdown(start, step)
    return [list(c), list(c), iter(c) is c]
`,
      solution: code`class Countdown:
    def __init__(self, start, step=1):
        self.current = start
        self.step = step

    def __iter__(self):
        return self

    def __next__(self):
        if self.current < 0:
            raise StopIteration
        value = self.current
        self.current -= self.step
        return value


def run(start, step):
    c = Countdown(start, step)
    return [list(c), list(c), iter(c) is c]
`,
      explanation: md('A `for` loop calls `iter(obj)` once, then `next()` until `StopIteration`. An object whose `__iter__` returns `self` is an **iterator**: single-pass, so a second loop gets nothing. Compare with a list, which is an **iterable**: each `iter(list)` returns a fresh iterator.'),
      tests: [
        ex('Example', 3, 1),
        ex('Step of two', 5, 2),
        hid('Starts below zero', -1, 1),
        hid('Zero', 0, 3),
      ],
    }),

    python({
      id: 'reusable-iterable',
      title: 'Iterable vs Iterator: Make It Reusable',
      difficulty: 'Medium',
      topics: ['Generators & Iterators', 'OOP'],
      patterns: ['__iter__ as a generator'],
      domains: ['Data lake / Storage'],
      roles: DE,
      summary: 'A file-partition listing that can be looped over many times, unlike an exhausted iterator.',
      description: md(
        'Implement `Partitions(prefix, days)` so that every `for` loop over it yields `"<prefix>/dt=<day>"` for each day — **every time**, not just the first time. Also support `len()` and the `in` operator (for a partition path).',
        '',
        '`run(prefix, days, probe)` returns `[list(p), list(p), len(p), probe in p]`.',
      ),
      hints: ['Make `__iter__` a generator function (use `yield` inside it): each call creates a new generator, so each loop starts over.'],
      entry: 'run',
      signature: 'run(prefix: str, days: list[str], probe: str) -> list',
      starter: code`class Partitions:
    def __init__(self, prefix, days):
        pass


# The tests call run(); don't change it.
def run(prefix, days, probe):
    p = Partitions(prefix, days)
    return [list(p), list(p), len(p), probe in p]
`,
      solution: code`class Partitions:
    def __init__(self, prefix, days):
        self.prefix = prefix.rstrip("/")
        self.days = list(days)

    def __iter__(self):
        for day in self.days:
            yield f"{self.prefix}/dt={day}"

    def __len__(self):
        return len(self.days)

    def __contains__(self, path):
        return any(path == p for p in self)


def run(prefix, days, probe):
    p = Partitions(prefix, days)
    return [list(p), list(p), len(p), probe in p]
`,
      explanation: md('Separating the container (an iterable with `__iter__`) from the cursor (the generator it returns) is what makes repeat iteration work. Without `__contains__`, `in` would still work by iterating, but defining it makes the intent explicit and lets you optimise later.'),
      tests: [
        ex('Example', 's3://lake/orders/', ['2024-01-01', '2024-01-02'], 's3://lake/orders/dt=2024-01-02'),
        ex('Probe not present', 'raw', ['d1'], 'raw/dt=d2'),
        hid('Empty', 'raw', [], 'raw/dt=x'),
        hid('Prefix without a trailing slash', 'gs://b', ['x', 'y'], 'gs://b/dt=y'),
      ],
    }),

    python({
      id: 'batched-generator',
      title: 'Batch a Stream into Fixed-Size Chunks',
      difficulty: 'Easy',
      topics: ['Generators & Iterators', 'Collections & itertools'],
      patterns: ['Chunking with islice'],
      domains: ['APIs / Integration'],
      roles: DE,
      summary: 'Yield lists of up to n items from any iterable — the basis of bulk API writes.',
      description: md('Write a **generator** `batches(items, size)` that yields lists of `size` consecutive items (the last may be shorter) from any iterable, without first converting it to a list. `run(items, size)` returns `list(batches(iter(items), size))`.'),
      hints: ['`itertools.islice(it, size)` takes up to `size` items from an iterator; stop when it returns nothing.'],
      entry: 'run',
      signature: 'run(items: list, size: int) -> list[list]',
      starter: code`from itertools import islice

def batches(items, size):
    pass


# The tests call run(); don't change it.
def run(items, size):
    return list(batches(iter(items), size))
`,
      solution: code`from itertools import islice

def batches(items, size):
    it = iter(items)
    while True:
        chunk = list(islice(it, size))
        if not chunk:
            return
        yield chunk


def run(items, size):
    return list(batches(iter(items), size))
`,
      explanation: md('Working on an iterator means the input can be a file or a database cursor that never fits in memory — only one batch exists at a time. (Python 3.12 added `itertools.batched`, which yields tuples.)'),
      tests: [
        ex('Example', [1, 2, 3, 4, 5], 2),
        ex('Exact multiple', ['a', 'b', 'c', 'd'], 2),
        hid('Empty', [], 3),
        hid('Size larger than input', [1, 2], 10),
      ],
    }),

    python({
      id: 'sliding-window-generator',
      title: 'Sliding Windows over a Stream',
      difficulty: 'Medium',
      topics: ['Generators & Iterators', 'Two Pointers & Sliding Window'],
      patterns: ['deque(maxlen=k) window'],
      domains: ['IoT / Telemetry'],
      ...tag(dev('Netflix', 'streaming, deques and fixed-memory buffers'), lds('Instacart', 'instacart', '7-Day Moving Average Order Value'), lds('Shopify', 'shopify', 'Rolling Three-Order Revenue'), lds('Etsy', 'etsy', 'Rolling Three-Order Average')),
      roles: DE,
      summary: 'Yield the moving average of the last k readings in O(1) memory per step.',
      description: md('Write a generator `moving_average(readings, k)` that, once it has seen `k` readings, yields the average of the last `k` (rounded to 2 decimals) for every new reading. `run(readings, k)` collects them.'),
      hints: ['`collections.deque(maxlen=k)` drops the oldest item automatically.', 'Keep a running sum: add the new value, subtract the one that falls out.'],
      entry: 'run',
      signature: 'run(readings: list[float], k: int) -> list[float]',
      starter: code`from collections import deque

def moving_average(readings, k):
    pass


# The tests call run(); don't change it.
def run(readings, k):
    return list(moving_average(iter(readings), k))
`,
      solution: code`from collections import deque

def moving_average(readings, k):
    window = deque(maxlen=k)
    total = 0.0
    for r in readings:
        if len(window) == k:
            total -= window[0]
        window.append(r)
        total += r
        if len(window) == k:
            yield round(total / k, 2)


def run(readings, k):
    return list(moving_average(iter(readings), k))
`,
      explanation: md('The deque holds exactly the window, and the running sum avoids re-summing k values each step: O(1) per reading. Subtract the leaving value **before** appending, because `append` on a full deque discards it.'),
      tests: [
        ex('Example', [1, 2, 3, 4, 5], 3),
        ex('Window of one', [5, 7], 1),
        hid('Fewer readings than k', [1, 2], 3),
        hid('Decimals', [0.1, 0.2, 0.3, 0.4], 2),
      ],
    }),

    python({
      id: 'fibonacci-generator',
      title: 'An Infinite Fibonacci Generator',
      difficulty: 'Easy',
      topics: ['Generators & Iterators', 'Collections & itertools'],
      patterns: ['Infinite generator + islice'],
      domains: ['Math'],
      roles: DE,
      summary: 'Generate Fibonacci numbers forever and take just what you need with islice.',
      description: md('Write a generator `fib()` that yields 0, 1, 1, 2, 3, … forever. `run(skip, take)` returns the `take` values after skipping the first `skip`, using `itertools.islice`.'),
      hints: ['`a, b = b, a + b` inside `while True:`.', '`islice(gen, skip, skip + take)`.'],
      entry: 'run',
      signature: 'run(skip: int, take: int) -> list[int]',
      starter: code`from itertools import islice

def fib():
    pass


# The tests call run(); don't change it.
def run(skip, take):
    return list(islice(fib(), skip, skip + take))
`,
      solution: code`from itertools import islice

def fib():
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b


def run(skip, take):
    return list(islice(fib(), skip, skip + take))
`,
      explanation: md('A generator only computes a value when asked, so "infinite" is fine as long as the consumer stops. `islice` is the iterator version of slicing.'),
      tests: [
        ex('First ten', 0, 10),
        ex('Skip some', 10, 3),
        hid('Take none', 5, 0),
        hid('Further along', 50, 2),
      ],
    }),

    python({
      id: 'generator-pipeline',
      title: 'Chain Generators into a Log Pipeline',
      difficulty: 'Medium',
      topics: ['Generators & Iterators', 'Parsing (CSV / JSON)'],
      patterns: ['Generator pipeline'],
      domains: ['Web server logs'],
      roles: DE,
      summary: 'Read → parse → filter → aggregate access-log lines through chained lazy generators.',
      description: md(
        'Build three generators and chain them:',
        '',
        '1. `parse(lines)` yields `(method, path, status, ms)` from lines like `"GET /api/orders 200 35"`, skipping blank lines and lines that don\'t have exactly 4 fields or numeric status/ms;',
        '2. `errors(records)` yields only records with status ≥ 500;',
        '3. `slowest(records, n)` (a plain function) returns the `n` slowest as `[path, ms]`, slowest first (ties by path).',
        '',
        '`run(lines, n)` returns `slowest(errors(parse(lines)), n)`.',
      ),
      hints: ['Each stage takes an iterable and yields — none of them builds a list.', '`heapq.nlargest(n, records, key=...)` consumes the stream keeping only n items.'],
      entry: 'run',
      signature: 'run(lines: list[str], n: int) -> list[list]',
      starter: code`import heapq

def parse(lines):
    pass

def errors(records):
    pass

def slowest(records, n):
    pass


# The tests call run(); don't change it.
def run(lines, n):
    return slowest(errors(parse(iter(lines))), n)
`,
      solution: code`import heapq

def parse(lines):
    for line in lines:
        parts = line.split()
        if len(parts) != 4 or not parts[2].isdigit() or not parts[3].isdigit():
            continue
        method, path, status, ms = parts
        yield method, path, int(status), int(ms)

def errors(records):
    for rec in records:
        if rec[2] >= 500:
            yield rec

def slowest(records, n):
    top = heapq.nsmallest(n, records, key=lambda r: (-r[3], r[1]))
    return [[r[1], r[3]] for r in top]


def run(lines, n):
    return slowest(errors(parse(iter(lines))), n)
`,
      explanation: md('Chained generators process one line at a time end to end: memory use is independent of the log size, and each stage is small and testable on its own. `nsmallest` with a `(-ms, path)` key gives "slowest first, then by path" while holding only n records.'),
      tests: [
        ex('Example', ['GET /a 200 10', 'GET /b 500 90', 'POST /c 503 120', 'bad line', '', 'GET /d 502 90'], 2),
        ex('No errors', ['GET /a 200 10'], 3),
        hid('Ties by path', ['GET /z 500 50', 'GET /a 500 50', 'GET /m 500 10'], 2),
        hid('Non-numeric fields skipped', ['GET /x 5xx 10', 'GET /y 500 abc', 'GET /z 500 1'], 5),
      ],
    }),

    python({
      id: 'streaming-group-totals',
      title: 'Emit Per-Key Totals as a Sorted Stream Changes Key',
      difficulty: 'Medium',
      topics: ['Generators & Iterators', 'Streaming & State'],
      patterns: ['Control-break processing'],
      domains: ['Event pipelines'],
      roles: DE,
      summary: 'Aggregate a key-sorted stream in one pass, yielding each total as soon as its key ends.',
      description: md(
        '`events` is a stream of `[key, amount]` **sorted by key**. Write a generator `totals(events)` that yields `[key, total, count]` the moment a key\'s run ends (and once more at the end), holding only the current key\'s state.',
        '',
        'If the input turns out not to be sorted (a key reappears after its run ended), raise `ValueError("unsorted input at <key>")`. `run(events)` returns the yielded rows, or `["error", message]` if the generator raised.',
      ),
      hints: ['Remember the current key, its total and count, plus a set of finished keys to detect unsorted input.'],
      entry: 'run',
      signature: 'run(events: list[list]) -> list',
      starter: code`def totals(events):
    pass


# The tests call run(); don't change it.
def run(events):
    out = []
    try:
        for row in totals(iter(events)):
            out.append(row)
    except ValueError as e:
        return ["error", str(e)]
    return out
`,
      solution: code`def totals(events):
    finished = set()
    key = None
    total = count = 0
    for k, amount in events:
        if k != key:
            if key is not None:
                yield [key, total, count]
                finished.add(key)
            if k in finished:
                raise ValueError(f"unsorted input at {k}")
            key, total, count = k, 0, 0
        total += amount
        count += 1
    if key is not None:
        yield [key, total, count]


def run(events):
    out = []
    try:
        for row in totals(iter(events)):
            out.append(row)
    except ValueError as e:
        return ["error", str(e)]
    return out
`,
      explanation: md('This is "control-break" processing — what a streaming aggregate over a pre-sorted input (or a sort-merge in Spark) does: O(1) state per key, results emitted as early as possible. Validating the sort assumption turns a silent wrong answer into a loud failure.'),
      tests: [
        ex('Example', [['a', 5], ['a', 7], ['b', 1], ['c', 2], ['c', 3]]),
        ex('Unsorted input', [['a', 1], ['b', 1], ['a', 1]]),
        hid('Empty', []),
        hid('Single key', [['k', 1], ['k', -1]]),
      ],
    }),

    python({
      id: 'merge-sorted-streams',
      title: 'Merge K Sorted Event Streams Lazily',
      difficulty: 'Medium',
      topics: ['Generators & Iterators', 'Heaps'],
      patterns: ['K-way merge with a heap'],
      domains: ['Event pipelines'],
      ...tag(dev('Lyft', 'queue design and multi-stream merge'), dev('Exodus Point', 'heaps and k-way merge')),
      roles: DE,
      summary: 'Merge several timestamp-sorted streams into one sorted stream without loading them.',
      description: md(
        'Each stream is a list of `[ts, event]` sorted by `ts`. Write a generator `merge(streams)` that yields `[ts, stream_index, event]` in timestamp order; on equal timestamps, the lower stream index comes first. Keep at most one pending item per stream.',
      ),
      hints: ['Push the first item of each stream onto a heap as `(ts, index, event)`; pop the smallest, then push the next item from the same stream.', '`heapq.merge` exists — but write the heap version once.'],
      entry: 'run',
      signature: 'run(streams: list[list[list]]) -> list[list]',
      starter: code`import heapq

def merge(streams):
    pass


# The tests call run(); don't change it.
def run(streams):
    return list(merge([iter(s) for s in streams]))
`,
      solution: code`import heapq

def merge(streams):
    heap = []
    for i, it in enumerate(streams):
        first = next(it, None)
        if first is not None:
            heapq.heappush(heap, (first[0], i, first[1]))
    while heap:
        ts, i, event = heapq.heappop(heap)
        yield [ts, i, event]
        nxt = next(streams[i], None)
        if nxt is not None:
            heapq.heappush(heap, (nxt[0], i, nxt[1]))


def run(streams):
    return list(merge([iter(s) for s in streams]))
`,
      explanation: md('The heap holds one head per stream, so each step is O(log k) and memory is O(k) regardless of stream length. Including the stream index in the tuple makes ties deterministic and stops Python from comparing the event payloads.'),
      tests: [
        ex('Example', [[[1, 'a'], [5, 'b']], [[2, 'x'], [5, 'y']], [[3, 'm']]]),
        ex('One stream', [[[1, 'only']]]),
        hid('Empty streams', [[], [[1, 'a']], []]),
        hid('No streams', []),
      ],
    }),

    python({
      id: 'paginate-api',
      title: 'Walk a Paginated API with a Generator',
      difficulty: 'Medium',
      topics: ['Generators & Iterators', 'Streaming & State'],
      patterns: ['Cursor pagination'],
      domains: ['APIs / Integration'],
      roles: DE,
      summary: 'Hide cursor-based pagination behind a generator that yields individual records.',
      description: md(
        '`fetch(cursor)` returns `{"items": [...], "next": cursor_or_None}`. Write a generator `records(fetch, limit)` yielding individual items across pages, stopping after `limit` items (or when `next` is `None`). Don\'t fetch a page you don\'t need.',
        '',
        '`run(pages, limit)` builds a fake API from `pages` (a list of item lists) and returns `[items, pages_fetched]`.',
      ),
      hints: ['Start with `cursor = None`; loop until there is no next cursor.', 'Check the limit **before** fetching another page.'],
      entry: 'run',
      signature: 'run(pages: list[list], limit: int) -> list',
      starter: code`def records(fetch, limit):
    pass


# The tests call run(); don't change it.
def run(pages, limit):
    calls = []
    def fetch(cursor):
        i = 0 if cursor is None else cursor
        calls.append(i)
        return {"items": pages[i], "next": i + 1 if i + 1 < len(pages) else None}
    items = list(records(fetch, limit))
    return [items, len(calls)]
`,
      solution: code`def records(fetch, limit):
    produced = 0
    cursor = None
    while produced < limit:
        page = fetch(cursor)
        for item in page["items"]:
            yield item
            produced += 1
            if produced == limit:
                return
        cursor = page["next"]
        if cursor is None:
            return


def run(pages, limit):
    calls = []
    def fetch(cursor):
        i = 0 if cursor is None else cursor
        calls.append(i)
        return {"items": pages[i], "next": i + 1 if i + 1 < len(pages) else None}
    items = list(records(fetch, limit))
    return [items, len(calls)]
`,
      explanation: md('Callers just loop over records; paging, cursors and limits stay inside the generator. Because generators are lazy, the next page is only requested when the consumer actually needs more items.'),
      tests: [
        ex('Example', [['a', 'b'], ['c', 'd'], ['e']], 3),
        ex('Limit beyond the data', [['a'], ['b']], 10),
        hid('Limit zero fetches nothing', [['a']], 0),
        hid('Empty middle page', [['a'], [], ['b']], 5),
      ],
    }),

    python({
      id: 'coroutine-running-stats',
      title: 'A Coroutine You send() Values To',
      difficulty: 'Medium',
      topics: ['Generators & Iterators', 'Streaming & State'],
      patterns: ['Generator-based coroutine'],
      domains: ['IoT / Telemetry'],
      roles: DE,
      summary: 'Use generator.send() to push readings into a running-statistics coroutine.',
      description: md(
        'Write a generator `stats()` that receives readings via `send()` and, after each one, yields `[count, mean, max]` (mean rounded to 2). Sending `None` resets the statistics and yields `[0, None, None]`.',
        '',
        '`run(values)` primes the coroutine with `next()` and sends each value, collecting what it yields.',
      ),
      hints: ['`value = yield current` both yields the current stats and receives the next sent value.', 'The first `next()` runs the generator up to the first `yield`.'],
      entry: 'run',
      signature: 'run(values: list) -> list[list]',
      starter: code`def stats():
    pass


# The tests call run(); don't change it.
def run(values):
    gen = stats()
    next(gen)
    return [gen.send(v) for v in values]
`,
      solution: code`def stats():
    count, total, top = 0, 0.0, None
    current = [0, None, None]
    while True:
        value = yield current
        if value is None:
            count, total, top = 0, 0.0, None
            current = [0, None, None]
            continue
        count += 1
        total += value
        top = value if top is None else max(top, value)
        current = [count, round(total / count, 2), top]


def run(values):
    gen = stats()
    next(gen)
    return [gen.send(v) for v in values]
`,
      explanation: md('`yield` is an expression: `send(x)` resumes the generator and makes `yield` evaluate to `x`. That turns a generator into a coroutine holding state between pushes. It must be primed with `next()` first, because a just-created generator hasn\'t reached a `yield` yet.'),
      tests: [
        ex('Example', [10, 20, 60]),
        ex('Reset in the middle', [5, null, 1]),
        hid('Negative values', [-3, -1]),
        hid('Nothing sent', []),
      ],
    }),

    python({
      id: 'round-robin-assignment',
      title: 'Round-Robin Work Assignment with cycle()',
      difficulty: 'Easy',
      topics: ['Collections & itertools', 'Generators & Iterators'],
      patterns: ['itertools.cycle'],
      domains: ['Platform / Ops'],
      roles: DE,
      summary: 'Assign tasks to workers in rotation, skipping workers that are at capacity.',
      description: md('Assign each task in `tasks` to the next worker in rotation (`itertools.cycle(workers)`), skipping any worker who already has `capacity` tasks. Return `{worker: [tasks]}` for every worker (in input order); tasks that cannot be placed go under `"unassigned"` (only include that key if needed).'),
      hints: ['Before giving up on a task, try at most `len(workers)` workers.'],
      entry: 'assign',
      signature: 'assign(tasks: list[str], workers: list[str], capacity: int) -> dict[str, list[str]]',
      solution: code`from itertools import cycle

def assign(tasks: list[str], workers: list[str], capacity: int) -> dict[str, list[str]]:
    out = {w: [] for w in workers}
    rotation = cycle(workers) if workers else iter(())
    for task in tasks:
        for _ in range(len(workers)):
            w = next(rotation)
            if len(out[w]) < capacity:
                out[w].append(task)
                break
        else:
            out.setdefault("unassigned", []).append(task)
    return out
`,
      explanation: md('`cycle` repeats an iterable forever, which is exactly a rotation. The bounded inner loop guarantees termination when everyone is full; `for … else` handles "nobody took it".'),
      tests: [
        ex('Example', ['t1', 't2', 't3', 't4', 't5'], ['a', 'b'], 2),
        ex('Plenty of room', ['x', 'y'], ['w1', 'w2', 'w3'], 5),
        hid('No workers', ['t'], [], 1),
        hid('Zero capacity', ['t1'], ['a'], 0),
      ],
    }),

    python({
      id: 'yield-from-tree-paths',
      title: 'Walk a Folder Tree with yield from',
      difficulty: 'Medium',
      topics: ['Generators & Iterators', 'Recursion', 'Trees'],
      patterns: ['Recursive generator (yield from)'],
      domains: ['Data lake / Storage'],
      roles: DE,
      summary: 'Yield every file path in a nested folder dict, depth-first, with a recursive generator.',
      description: md('`tree` is a nested dict: a key mapping to a dict is a folder, a key mapping to an int is a file (its size). Write a recursive generator yielding `[path, size]` for every file, depth-first, keys visited in sorted order, paths joined with `/`. `run(tree, min_size)` returns the files with size ≥ `min_size`.'),
      hints: ['`yield from walk(child, path + name + "/")` delegates to the recursive call.'],
      entry: 'run',
      signature: 'run(tree: dict, min_size: int) -> list[list]',
      starter: code`def walk(tree, prefix=""):
    pass


# The tests call run(); don't change it.
def run(tree, min_size):
    return [f for f in walk(tree) if f[1] >= min_size]
`,
      solution: code`def walk(tree, prefix=""):
    for name in sorted(tree):
        node = tree[name]
        if isinstance(node, dict):
            yield from walk(node, prefix + name + "/")
        else:
            yield [prefix + name, node]


def run(tree, min_size):
    return [f for f in walk(tree) if f[1] >= min_size]
`,
      explanation: md('`yield from gen` re-yields everything another generator produces (and forwards `send`/exceptions), so a recursive generator reads like the recursive function it is. This is how `os.walk`-style traversals are written.'),
      tests: [
        ex('Example', { raw: { '2024': { 'a.csv': 10, 'b.csv': 300 } }, 'README.md': 2 }, 5),
        ex('Empty folder', { empty: {} }, 0),
        hid('Everything', { b: 1, a: { c: 2 } }, 0),
        hid('Nothing big enough', { a: 1 }, 100),
      ],
    }),

    python({
      id: 'groupby-sessions',
      title: 'Group Consecutive Log Lines with itertools.groupby',
      difficulty: 'Easy',
      topics: ['Collections & itertools', 'Intervals & Sessions'],
      patterns: ['groupby on consecutive keys'],
      domains: ['Web server logs'],
      roles: DE,
      summary: 'Collapse consecutive log lines from the same request ID into one record.',
      description: md('Each log line is `[request_id, message]`. Lines from one request are consecutive, but the same ID may come back later (a retry). Return `[request_id, line_count, first_message, last_message]` for each consecutive group.'),
      hints: ['`groupby(lines, key=lambda l: l[0])` groups neighbours; materialise each group with `list()` before reading it twice.'],
      entry: 'group_requests',
      signature: 'group_requests(lines: list[list[str]]) -> list[list]',
      solution: code`from itertools import groupby

def group_requests(lines: list[list[str]]) -> list[list]:
    out = []
    for rid, group in groupby(lines, key=lambda line: line[0]):
        msgs = [m for _, m in group]
        out.append([rid, len(msgs), msgs[0], msgs[-1]])
    return out
`,
      explanation: md('Each `group` is a lazy iterator that shares the underlying input, so it is only valid until you advance `groupby`; turning it into a list right away is the safe habit.'),
      tests: [
        ex('Example', [['r1', 'start'], ['r1', 'db'], ['r1', 'end'], ['r2', 'start'], ['r1', 'retry']]),
        ex('Single line', [['x', 'only']]),
        hid('Empty', []),
        hid('A returning ID starts a new group', [['a', '1'], ['b', '2'], ['a', '3'], ['a', '4']]),
      ],
    }),

    python({
      id: 'lazy-take-from-infinite',
      title: 'Prove It\'s Lazy: Take from an Infinite Stream',
      difficulty: 'Medium',
      topics: ['Generators & Iterators', 'Collections & itertools'],
      patterns: ['Lazy evaluation'],
      domains: ['Event pipelines'],
      roles: DE,
      summary: 'Find the first k matching values in an endless stream while reading as few items as possible.',
      description: md(
        'Write `first_matching(stream, k, divisor)` returning the first `k` values in the (possibly infinite) iterator `stream` whose **square** is divisible by `divisor`, as a list of squares. It must stop reading the stream as soon as it has `k`.',
        '',
        '`run(k, divisor)` feeds it an infinite counting stream that records how many items were read, and returns `[squares, items_read]`.',
      ),
      hints: ['Build a generator expression of squares, filter it, then `islice(..., k)` — nothing runs until `list()` pulls.'],
      entry: 'run',
      signature: 'run(k: int, divisor: int) -> list',
      starter: code`from itertools import count, islice

def first_matching(stream, k, divisor):
    pass


# The tests call run(); don't change it.
def run(k, divisor):
    read = {"n": 0}
    def numbers():
        for n in count(1):
            read["n"] += 1
            yield n
    squares = first_matching(numbers(), k, divisor)
    return [squares, read["n"]]
`,
      solution: code`from itertools import count, islice

def first_matching(stream, k, divisor):
    squares = (n * n for n in stream)
    matching = (s for s in squares if s % divisor == 0)
    return list(islice(matching, k))


def run(k, divisor):
    read = {"n": 0}
    def numbers():
        for n in count(1):
            read["n"] += 1
            yield n
    squares = first_matching(numbers(), k, divisor)
    return [squares, read["n"]]
`,
      explanation: md('Generator expressions (`( … )`, not `[ … ]`) are lazy, so the whole chain pulls one number at a time and stops the moment `islice` has k results. Using a list comprehension anywhere in the chain would try to consume the infinite stream and never return.'),
      tests: [
        ex('Example', 3, 4),
        ex('Every square matches', 2, 1),
        hid('Take none', 0, 7),
        hid('Sparse matches', 2, 9),
      ],
    }),
  ],
};
