// Python pack 24 — async and coordination concepts plus standard-library
// depth: a generator-based event loop (how asyncio schedules coroutines),
// gather vs as_completed ordering, threading.Event / Condition semantics,
// queue.Queue task accounting, executor map ordering, generator close/throw,
// exception groups (except*), and stdlib modules interviews expect: str
// translate, configparser, argparse, statistics, random, pathlib, struct,
// hashlib, zlib/base64, bisect, heapq schedulers, weakref and uuid.
// asyncio's own loop can't run in this WebAssembly sandbox, so the async
// problems model the scheduler with generators — exactly how coroutines work.
import { python, md, code, ex, hid } from './define.js';

const DE = ['Data Engineer'];

export default {
  problems: [
    python({
      id: 'generator-event-loop',
      title: 'Build a Tiny Event Loop from Generators',
      difficulty: 'Hard',
      topics: ['Concurrency', 'Generators & Iterators'],
      patterns: ['Cooperative scheduling with a heap of wake-up times'],
      domains: ['Platform / Ops'],
      roles: DE,
      summary: 'Schedule generator "coroutines" that yield sleep durations — the core idea behind asyncio.',
      description: md(
        'Each task is a generator that `yield`s a number of seconds to sleep and finally `return`s a result. Write `run_loop(tasks)`: start every task at time 0 in the given order, always resume the task with the earliest wake-up time (ties by start order), and return `[[name, result, finish_time] in finish order]`.',
        '',
        '`run(specs)` builds tasks from `[name, sleeps]`, where each task sleeps for each duration in turn and returns `"<name> done"`.',
      ),
      hints: ['A heap of `(wake_time, seq, name, generator)`; `next(gen)` gives the next sleep; `StopIteration.value` is the return value.'],
      entry: 'run',
      signature: 'run(specs: list[list]) -> list[list]',
      starter: code`import heapq

def run_loop(tasks):
    pass


# The tests call run(); don't change it.
def make_task(name, sleeps):
    for s in sleeps:
        yield s
    return f"{name} done"

def run(specs):
    return run_loop([(name, make_task(name, sleeps)) for name, sleeps in specs])
`,
      solution: code`import heapq

def run_loop(tasks):
    heap = [(0, i, name, gen) for i, (name, gen) in enumerate(tasks)]
    heapq.heapify(heap)
    finished = []
    while heap:
        now, seq, name, gen = heapq.heappop(heap)
        try:
            delay = next(gen)
        except StopIteration as stop:
            finished.append([name, stop.value, now])
            continue
        heapq.heappush(heap, (now + delay, seq, name, gen))
    return finished


def make_task(name, sleeps):
    for s in sleeps:
        yield s
    return f"{name} done"

def run(specs):
    return run_loop([(name, make_task(name, sleeps)) for name, sleeps in specs])
`,
      explanation: md('A coroutine is a suspendable function; an event loop resumes whichever one is ready. `await asyncio.sleep(n)` is a coroutine telling the loop "wake me in n seconds" — exactly the yielded delay here. Nothing runs in parallel, yet total time is the longest chain, not the sum.'),
      tests: [
        ex('Example', [['fetch', [2, 1]], ['parse', [1]], ['log', []]]),
        ex('Ties keep start order', [['a', [1]], ['b', [1]]]),
        hid('Many steps', [['slow', [5]], ['busy', [1, 1, 1, 1]]]),
        hid('No tasks', []),
      ],
    }),

    python({
      id: 'gather-vs-as-completed',
      title: 'gather vs as_completed: Which Order Do Results Come In?',
      difficulty: 'Medium',
      topics: ['Concurrency'],
      patterns: ['Result order vs completion order'],
      domains: ['APIs / Integration'],
      roles: DE,
      summary: 'Model concurrent API calls and report gather order, completion order and total time.',
      description: md('Each call is `[name, seconds]`, all started at once with at most `limit` running concurrently (a semaphore; queued calls start in order as slots free). Return `[gather_order, completion_order, total_seconds]` where gather returns results in **input** order and as_completed yields them in **finish** order (ties by input order).'),
      hints: ['Simulate slots with a min-heap of free times, as in a semaphore; completion order = sort by finish time.'],
      entry: 'simulate_calls',
      signature: 'simulate_calls(calls: list[list], limit: int) -> list',
      solution: code`import heapq

def simulate_calls(calls: list[list], limit: int) -> list:
    slots = [0] * max(limit, 1)
    finish = []
    for i, (name, secs) in enumerate(calls):
        start = heapq.heappop(slots)
        end = start + secs
        heapq.heappush(slots, end)
        finish.append((end, i, name))
    completion = [name for _, _, name in sorted(finish)]
    total = max((e for e, _, _ in finish), default=0)
    return [[name for name, _ in calls], completion, total]
`,
      explanation: md('`asyncio.gather` preserves the order of its arguments regardless of finish time; `as_completed` streams results as they arrive. Limiting concurrency (a semaphore) trades total latency for load on the downstream API.'),
      tests: [
        ex('Example', [['a', 3], ['b', 1], ['c', 2]], 3),
        ex('Limit of one is sequential', [['a', 3], ['b', 1]], 1),
        hid('Limit two', [['a', 2], ['b', 2], ['c', 1], ['d', 1]], 2),
        hid('No calls', [], 4),
      ],
    }),

    python({
      id: 'threading-event-coordination',
      title: 'Coordinate Workers with threading.Event',
      difficulty: 'Easy',
      topics: ['Concurrency'],
      patterns: ['Event set / clear / wait'],
      domains: ['Platform / Ops'],
      roles: DE,
      summary: 'Simulate workers waiting on a "config loaded" event and resuming when it is set.',
      description: md('Ops: `["wait", worker]` (the worker blocks if the event is not set, otherwise proceeds immediately), `["set"]` (releases **all** blocked workers, in the order they started waiting), `["clear"]`. Return the order in which workers proceeded, and the workers still blocked at the end.'),
      hints: ['Keep a flag and a list of waiting workers.'],
      entry: 'events',
      signature: 'events(ops: list[list[str]]) -> list[list[str]]',
      solution: code`def events(ops: list[list[str]]) -> list[list[str]]:
    is_set, waiting, proceeded = False, [], []
    for op in ops:
        if op[0] == "wait":
            if is_set:
                proceeded.append(op[1])
            else:
                waiting.append(op[1])
        elif op[0] == "set":
            is_set = True
            proceeded.extend(waiting)
            waiting = []
        else:
            is_set = False
    return [proceeded, waiting]
`,
      explanation: md('`Event` is a one-to-many signal: `set()` wakes every waiter and lets future `wait()`s pass until `clear()`. Use it for "start when ready" gates; use a `Queue` when each item must go to exactly one worker.'),
      tests: [
        ex('Example', [['wait', 'w1'], ['wait', 'w2'], ['set'], ['wait', 'w3'], ['clear'], ['wait', 'w4']]),
        ex('Never set', [['wait', 'a']]),
        hid('Set before anyone waits', [['set'], ['wait', 'x'], ['wait', 'y']]),
        hid('Clear blocks later waiters', [['set'], ['wait', 'a'], ['clear'], ['wait', 'b'], ['wait', 'c'], ['set']]),
      ],
    }),

    python({
      id: 'queue-task-done',
      title: 'queue.Queue: put, get, task_done and join',
      difficulty: 'Medium',
      topics: ['Concurrency', 'Stacks & Queues'],
      patterns: ['Unfinished-task accounting'],
      domains: ['Event pipelines'],
      roles: DE,
      summary: 'Drive a real queue.Queue and track when join() would unblock.',
      description: md('Using a real `queue.Queue(maxsize)`, apply ops: `["put", x]` (use `put_nowait`; record `"Full"` if full), `["get"]` (`get_nowait`; record the item or `"Empty"`), `["done"]` (`task_done`; record `"ValueError"` if called too many times). After each op record whether `join()` would return immediately (`q.unfinished_tasks == 0`). Return the list of `[result, join_ready]`.'),
      hints: ['`queue.Full`, `queue.Empty` are the exceptions; `unfinished_tasks` counts puts minus task_done calls.'],
      entry: 'drive',
      signature: 'drive(maxsize: int, ops: list[list]) -> list[list]',
      solution: code`import queue

def drive(maxsize: int, ops: list[list]) -> list[list]:
    q = queue.Queue(maxsize)
    out = []
    for op in ops:
        try:
            if op[0] == "put":
                q.put_nowait(op[1])
                result = "ok"
            elif op[0] == "get":
                result = q.get_nowait()
            else:
                q.task_done()
                result = "ok"
        except queue.Full:
            result = "Full"
        except queue.Empty:
            result = "Empty"
        except ValueError:
            result = "ValueError"
        out.append([result, q.unfinished_tasks == 0])
    return out
`,
      explanation: md('`join()` waits for **processing**, not for the queue to be empty: every `put` increments a counter that only `task_done()` decrements. Forgetting `task_done` in a worker makes the producer\'s `join()` hang forever.'),
      tests: [
        ex('Example', 2, [['put', 'a'], ['put', 'b'], ['put', 'c'], ['get'], ['done'], ['get'], ['done']]),
        ex('Get from empty', 0, [['get']]),
        hid('Too many task_done calls', 0, [['put', 1], ['done'], ['done']]),
        hid('Got but not done', 0, [['put', 'x'], ['get']]),
      ],
    }),

    python({
      id: 'condition-producer-consumer',
      title: 'Producer–Consumer with a Condition Variable',
      difficulty: 'Hard',
      topics: ['Concurrency', 'Stacks & Queues'],
      patterns: ['wait / notify semantics'],
      domains: ['Event pipelines'],
      roles: DE,
      summary: 'Simulate consumers that wait on a Condition and are woken by notify / notify_all.',
      description: md(
        'Ops on a shared buffer guarded by a `Condition`: `["put", item]` appends and calls `notify()` (wakes the **longest-waiting** consumer, which immediately takes the first item); `["get", consumer]` takes the first item, or starts waiting if the buffer is empty; `["broadcast"]` calls `notify_all()` — waiting consumers wake in order and take items while there are any, the rest go back to waiting.',
        '',
        'Return `[deliveries as "consumer:item", items left in the buffer, consumers still waiting]`.',
      ),
      hints: ['A woken consumer re-checks the condition ("while buffer is empty: wait") — model that by re-queueing it if no item is left.'],
      entry: 'simulate',
      signature: 'simulate(ops: list[list[str]]) -> list',
      solution: code`from collections import deque

def simulate(ops: list[list[str]]) -> list:
    buffer, waiting, delivered = deque(), deque(), []
    for op in ops:
        if op[0] == "put":
            buffer.append(op[1])
            if waiting:
                delivered.append(f"{waiting.popleft()}:{buffer.popleft()}")
        elif op[0] == "get":
            if buffer:
                delivered.append(f"{op[1]}:{buffer.popleft()}")
            else:
                waiting.append(op[1])
        else:
            still = deque()
            while waiting:
                c = waiting.popleft()
                if buffer:
                    delivered.append(f"{c}:{buffer.popleft()}")
                else:
                    still.append(c)
            waiting = still
    return [delivered, list(buffer), list(waiting)]
`,
      explanation: md('A `Condition` couples a lock with a waiting room: consumers `wait()` (releasing the lock) until a producer `notify()`s. Waking doesn\'t guarantee the condition still holds, which is why real code always waits in a `while` loop — modelled here by re-queueing consumers that find nothing.'),
      tests: [
        ex('Example', [['get', 'c1'], ['get', 'c2'], ['put', 'x'], ['put', 'y'], ['put', 'z']]),
        ex('Broadcast with one item', [['get', 'a'], ['get', 'b'], ['broadcast']]),
        hid('Broadcast after items queue up', [['put', 'p'], ['get', 'a'], ['get', 'b'], ['get', 'c'], ['put', 'q'], ['broadcast']]),
        hid('Nobody waiting', [['put', '1'], ['put', '2'], ['get', 'k']]),
      ],
    }),

    python({
      id: 'executor-map-order',
      title: 'ThreadPoolExecutor.map Returns Results in Input Order',
      difficulty: 'Medium',
      topics: ['Concurrency'],
      patterns: ['Worker pool scheduling'],
      domains: ['APIs / Integration'],
      roles: DE,
      summary: 'Simulate a pool of workers processing jobs and compare map order with completion order.',
      description: md('`n` workers take jobs from a queue in input order (a free worker takes the next job immediately; ties: lowest worker id). Each job has a duration. Return `[map_result_order, completion_order, worker_of_each_job, makespan]`.'),
      hints: ['A heap of `(free_at, worker_id)`.'],
      entry: 'pool_map',
      signature: 'pool_map(jobs: list[list], n: int) -> list',
      solution: code`import heapq

def pool_map(jobs: list[list], n: int) -> list:
    workers = [(0, w) for w in range(n)]
    heapq.heapify(workers)
    finish, assigned = [], []
    for i, (name, secs) in enumerate(jobs):
        free_at, w = heapq.heappop(workers)
        end = free_at + secs
        heapq.heappush(workers, (end, w))
        finish.append((end, i, name))
        assigned.append(w)
    completion = [name for _, _, name in sorted(finish)]
    return [[name for name, _ in jobs], completion, assigned, max((e for e, _, _ in finish), default=0)]
`,
      explanation: md('`executor.map` yields results in submission order, so a slow first job delays even fast later results; `as_completed(futures)` yields as they finish. Choose based on whether downstream code needs order or latency.'),
      tests: [
        ex('Example', [['a', 4], ['b', 1], ['c', 1], ['d', 2]], 2),
        ex('One worker', [['x', 1], ['y', 2]], 1),
        hid('More workers than jobs', [['p', 3], ['q', 1]], 5),
        hid('Long first job', [['big', 10], ['s1', 1], ['s2', 1], ['s3', 1]], 2),
      ],
    }),

    python({
      id: 'generator-close-throw',
      title: 'Generator Cleanup with close() and throw()',
      difficulty: 'Medium',
      topics: ['Generators & Iterators', 'Error Handling'],
      patterns: ['GeneratorExit and finally'],
      domains: ['Database Access'],
      roles: DE,
      summary: 'A generator holding a "cursor" must release it however iteration ends.',
      description: md(
        'Write `rows(n, log)`: logs `"open"`, yields `0 … n-1`, and logs `"closed"` in a `finally` block. If an exception is thrown in with `throw(ValueError)`, log `"bad row"` and stop (return).',
        '',
        '`run(action, n)` consumes the generator: `"all"` (exhaust it), `"early"` (take 2 items, then `close()`), `"throw"` (take 1, then `throw(ValueError)`). Return `[items, log]`.',
      ),
      hints: ['`close()` raises `GeneratorExit` at the paused `yield` — `finally` runs; `throw(e)` raises `e` there.'],
      entry: 'run',
      signature: 'run(action: str, n: int) -> list',
      starter: code`def rows(n, log):
    pass


# The tests call run(); don't change it.
def run(action, n):
    log, items = [], []
    g = rows(n, log)
    if action == "all":
        items = list(g)
    elif action == "early":
        items = [next(g), next(g)]
        g.close()
    else:
        items = [next(g)]
        try:
            g.throw(ValueError("corrupt"))
        except StopIteration:
            pass
    return [items, log]
`,
      solution: code`def rows(n, log):
    log.append("open")
    try:
        for i in range(n):
            try:
                yield i
            except ValueError:
                log.append("bad row")
                return
    finally:
        log.append("closed")


def run(action, n):
    log, items = [], []
    g = rows(n, log)
    if action == "all":
        items = list(g)
    elif action == "early":
        items = [next(g), next(g)]
        g.close()
    else:
        items = [next(g)]
        try:
            g.throw(ValueError("corrupt"))
        except StopIteration:
            pass
    return [items, log]
`,
      explanation: md('Generators that hold resources must clean up in `finally`, because consumers may stop early (`break`, `close()`) or inject errors (`throw`). CPython also calls `close()` when an unfinished generator is garbage-collected.'),
      tests: [
        ex('Exhaust', 'all', 3),
        ex('Stop early', 'early', 5),
        hid('Throw', 'throw', 5),
        hid('Empty generator', 'all', 0),
      ],
    }),

    python({
      id: 'exception-groups',
      title: 'Handle Several Failures at Once with except*',
      difficulty: 'Medium',
      topics: ['Error Handling', 'Concurrency'],
      patterns: ['ExceptionGroup / except*'],
      domains: ['Event pipelines'],
      roles: DE,
      summary: 'Run independent checks, collect every failure into an ExceptionGroup, and handle each kind separately.',
      description: md('Run every check in `checks` (`"ok"`, `"value"`, `"key"`, `"type"` raise nothing / ValueError / KeyError / TypeError). If any failed, raise `ExceptionGroup("checks failed", errors)`. Catch it with `except* ValueError` (count them), `except* KeyError` (count them) — a TypeError is not handled there and propagates out as a group. Return `[value_errors, key_errors, unhandled_type_names or []]`.'),
      hints: ['Each `except*` clause receives the sub-group of matching exceptions; unmatched ones are re-raised in a new group.'],
      entry: 'run_checks',
      signature: 'run_checks(checks: list[str]) -> list',
      solution: code`ERRORS = {"value": ValueError, "key": KeyError, "type": TypeError}

def _run(checks, counts):
    errors = [ERRORS[c](c) for c in checks if c in ERRORS]
    try:
        if errors:
            raise ExceptionGroup("checks failed", errors)
    except* ValueError as g:
        counts["value"] += len(g.exceptions)
    except* KeyError as g:
        counts["key"] += len(g.exceptions)

def run_checks(checks: list[str]) -> list:
    counts = {"value": 0, "key": 0}
    unhandled = []
    try:
        _run(checks, counts)
    except ExceptionGroup as g:
        unhandled = [type(e).__name__ for e in g.exceptions]
    return [counts["value"], counts["key"], unhandled]
`,
      explanation: md('When several independent operations fail (concurrent tasks, batch validations), raising only the first hides the rest. `ExceptionGroup` (3.11+) carries all of them, and each `except*` clause handles its share — the model behind `asyncio.TaskGroup`.'),
      tests: [
        ex('Example', ['ok', 'value', 'key', 'value']),
        ex('Unhandled type error', ['type', 'value']),
        hid('Nothing fails', ['ok', 'ok']),
        hid('Only key errors', ['key', 'key', 'key']),
      ],
    }),

    python({
      id: 'str-translate-cleaning',
      title: 'Fast Character Cleaning with str.translate',
      difficulty: 'Easy',
      topics: ['Strings'],
      patterns: ['maketrans table'],
      domains: ['Data quality'],
      roles: DE,
      summary: 'Normalise phone-like strings: map lookalike characters and delete punctuation in one pass.',
      description: md('Build one translation table that maps `O→0`, `o→0`, `l→1`, `I→1` and deletes the characters ` -().+`. Apply it to each value and return the results.'),
      hints: ['`str.maketrans("OolI", "0011", " -().+")` — the third argument lists characters to delete.'],
      entry: 'clean',
      signature: 'clean(values: list[str]) -> list[str]',
      solution: code`TABLE = str.maketrans("OolI", "0011", " -().+")

def clean(values: list[str]) -> list[str]:
    return [v.translate(TABLE) for v in values]
`,
      explanation: md('`translate` does every replacement and deletion in a single C-level pass — much faster and clearer than chained `replace` calls for character-level cleanup.'),
      tests: [
        ex('Example', ['+1 (555) 0O1-l2I3', 'no change 9']),
        ex('Empty', ['']),
        hid('Only punctuation', ['()-+ ']),
        hid('Lookalikes only', ['OolI', 'Hello World']),
      ],
    }),

    python({
      id: 'format-text-table',
      title: 'Render an Aligned Text Report',
      difficulty: 'Easy',
      topics: ['Strings'],
      patterns: ['f-string format spec'],
      domains: ['Reporting'],
      roles: DE,
      summary: 'Format rows into a fixed-width table with left-aligned names and right-aligned numbers.',
      description: md('Return lines for a table of `[name, count, amount]`: column 1 left-aligned to the longest name (minimum width 4, header `name`), column 2 right-aligned width 5 (header `count`), column 3 right-aligned width 10 with 2 decimals and thousands separators (header `amount`). Columns are separated by two spaces; a line of `-` matching the full width follows the header.'),
      hints: ['`f"{name:<{w}}  {count:>5}  {amount:>10,.2f}"`.'],
      entry: 'render',
      signature: 'render(rows: list[list]) -> list[str]',
      solution: code`def render(rows: list[list]) -> list[str]:
    w = max([4] + [len(r[0]) for r in rows])
    header = f"{'name':<{w}}  {'count':>5}  {'amount':>10}"
    lines = [header, "-" * len(header)]
    lines += [f"{name:<{w}}  {count:>5}  {amount:>10,.2f}" for name, count, amount in rows]
    return lines
`,
      explanation: md('The format mini-language handles alignment (`<`, `>`), width (even computed: `{w}`), thousands separators (`,`) and precision (`.2f`) — no manual padding needed.'),
      tests: [
        ex('Example', [['orders', 12, 1234.5], ['refunds', 3, 99.999]]),
        ex('Short names', [['a', 1, 1]]),
        hid('No rows', []),
        hid('Long name and big amount', [['very_long_metric_name', 12345, 9876543.219]]),
      ],
    }),

    python({
      id: 'configparser-ini',
      title: 'Read an INI Config with configparser',
      difficulty: 'Easy',
      topics: ['Parsing (CSV / JSON)', 'Modules & Packages'],
      patterns: ['configparser with defaults and typed getters'],
      domains: ['Platform / Ops'],
      roles: DE,
      summary: 'Parse an INI file, inherit DEFAULT values and read typed settings per section.',
      description: md('Parse `text` with `configparser`. For each section (sorted) return `[section, host, port (int), ssl (bool), retries (int, falling back to 3)]`. `DEFAULT` values apply to every section.'),
      hints: ['`cp.getint(section, "port")`, `cp.getboolean(...)` understands yes/no/true/false/1/0; `fallback=` supplies defaults.'],
      entry: 'read_config',
      signature: 'read_config(text: str) -> list[list]',
      solution: code`import configparser

def read_config(text: str) -> list[list]:
    cp = configparser.ConfigParser()
    cp.read_string(text)
    return [[s, cp.get(s, "host"), cp.getint(s, "port"), cp.getboolean(s, "ssl"), cp.getint(s, "retries", fallback=3)]
            for s in sorted(cp.sections())]
`,
      explanation: md('`configparser` handles sections, comments, `DEFAULT` inheritance and typed access; values are strings until you use the typed getters. Never `eval` config values.'),
      tests: [
        ex('Example', '[DEFAULT]\nssl = yes\nport = 5432\n\n[warehouse]\nhost = wh.internal\n\n[replica]\nhost = rep.internal\nport = 6432\nssl = no\nretries = 5\n'),
        ex('Single section', '[db]\nhost = x\nport = 1\nssl = true\n'),
        hid('Comments and spacing', '# main\n[a]\nhost=h\nport = 10\nssl = 0\n'),
        hid('Defaults everywhere', '[DEFAULT]\nhost = shared\nport = 80\nssl = off\nretries = 1\n\n[b]\n\n[a]\nretries = 9\n'),
      ],
    }),

    python({
      id: 'argparse-cli',
      title: 'Parse Job Arguments with argparse',
      difficulty: 'Medium',
      topics: ['Arguments & Scope', 'Modules & Packages'],
      patterns: ['argparse with types, choices and flags'],
      domains: ['Platform / Ops'],
      roles: DE,
      summary: 'Define a CLI for a backfill job and parse several command lines, including invalid ones.',
      description: md(
        'Build a parser for `backfill TABLE --start DATE --days N [--dry-run] [--mode {append,overwrite}]` (`--days` int default 1, `--mode` default `append`). For each argument list return `{table, start, days, dry_run, mode}` or `"error"` if argparse rejects it.',
      ),
      hints: ['argparse calls `sys.exit` on errors — catch `SystemExit`. Use `exit_on_error=False` or catch it; silence the usage message by redirecting stderr.'],
      entry: 'parse_all',
      signature: 'parse_all(argvs: list[list[str]]) -> list',
      solution: code`import argparse
import contextlib
import io

def _parser():
    p = argparse.ArgumentParser(prog="backfill")
    p.add_argument("table")
    p.add_argument("--start", required=True)
    p.add_argument("--days", type=int, default=1)
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--mode", choices=["append", "overwrite"], default="append")
    return p

def parse_all(argvs: list[list[str]]) -> list:
    out = []
    for argv in argvs:
        try:
            with contextlib.redirect_stderr(io.StringIO()):
                out.append(vars(_parser().parse_args(argv)))
        except SystemExit:
            out.append("error")
    return out
`,
      explanation: md('argparse gives typed values, defaults, choices validation and `--help` for free. Dashes in option names become underscores in the result (`dry_run`). Wrapping the job entry point this way keeps scripts self-documenting.'),
      tests: [
        ex('Example', [['orders', '--start', '2024-01-01', '--days', '7', '--dry-run'], ['users', '--start', '2024-02-01']]),
        ex('Invalid choice', [['t', '--start', 'x', '--mode', 'merge']]),
        hid('Missing required option', [['t']]),
        hid('Bad int', [['t', '--start', 'x', '--days', 'seven']]),
      ],
    }),

    python({
      id: 'statistics-module',
      title: 'Descriptive Stats with the statistics Module',
      difficulty: 'Easy',
      topics: ['Math & Bits', 'Data Wrangling'],
      patterns: ['statistics.mean / median / mode / stdev / quantiles'],
      domains: ['Reporting'],
      roles: ['Data Engineer', 'Data Analyst'],
      summary: 'Summarise a sample: mean, median, mode, sample stdev and quartiles.',
      description: md('Return `{mean, median, mode, stdev, quartiles}` for `values` (≥ 2 values), floats rounded to 3; quartiles from `statistics.quantiles(values, n=4)` (default exclusive method). For several modes, `statistics.mode` returns the first encountered.'),
      hints: ['`statistics.stdev` is the **sample** standard deviation (n − 1); `pstdev` is the population one.'],
      entry: 'describe',
      signature: 'describe(values: list[float]) -> dict',
      solution: code`import statistics as st

def describe(values: list[float]) -> dict:
    r = lambda x: round(x, 3)
    return {
        "mean": r(st.mean(values)),
        "median": r(st.median(values)),
        "mode": st.mode(values),
        "stdev": r(st.stdev(values)),
        "quartiles": [r(q) for q in st.quantiles(values, n=4)],
    }
`,
      explanation: md('The stdlib `statistics` module covers quick summaries without NumPy. Know which variant you use: sample vs population stdev, and the quantile method (exclusive vs inclusive) — they give different numbers on small samples.'),
      tests: [
        ex('Example', [2, 4, 4, 4, 5, 5, 7, 9]),
        ex('Two values', [1, 3]),
        hid('Multiple modes', [3, 1, 1, 3, 2]),
        hid('Floats', [1.5, 2.5, 2.5, 10.0]),
      ],
    }),

    python({
      id: 'seeded-sampling',
      title: 'Reproducible Sampling with random.Random(seed)',
      difficulty: 'Easy',
      topics: ['Math & Bits', 'Data Wrangling'],
      patterns: ['Seeded RNG instance'],
      domains: ['Experimentation'],
      roles: ['Data Engineer', 'Data Scientist'],
      summary: 'Draw the same sample and A/B split every run by seeding a private RNG.',
      description: md('With `rng = random.Random(seed)`, return `[sample of k ids (rng.sample), shuffled copy of ids (rng.shuffle on a copy), assignment of each id to "A"/"B" (rng.random() < 0.5 → "A")]`, in that order of RNG calls.'),
      hints: ['A private `Random` instance keeps your sampling independent of other code using the global `random` state.'],
      entry: 'sample',
      signature: 'sample(ids: list[int], k: int, seed: int) -> list',
      solution: code`import random

def sample(ids: list[int], k: int, seed: int) -> list:
    rng = random.Random(seed)
    picked = rng.sample(ids, k)
    shuffled = list(ids)
    rng.shuffle(shuffled)
    groups = {str(i): ("A" if rng.random() < 0.5 else "B") for i in ids}
    return [picked, shuffled, groups]
`,
      explanation: md('Seeding makes "random" experiments reproducible — essential for re-running a backfill or auditing an A/B assignment. Using a dedicated `Random` object avoids hidden coupling through the module-level generator. (For assignment that must be stable across code changes, hash the user id instead.)'),
      tests: [
        ex('Example', [1, 2, 3, 4, 5], 2, 42),
        ex('Different seed', [1, 2, 3, 4, 5], 2, 7),
        hid('Sample everything', [10, 20, 30], 3, 0),
        hid('Sample none', [7, 8, 9, 10], 0, 123),
      ],
    }),

    python({
      id: 'pathlib-partitions',
      title: 'Work with Paths Using pathlib',
      difficulty: 'Easy',
      topics: ['Strings', 'Modules & Packages'],
      patterns: ['PurePosixPath operations'],
      domains: ['Data lake / Storage'],
      roles: DE,
      summary: 'Parse lake paths: partition values, file stem/suffix, and a rewritten output path.',
      description: md('For each path like `/lake/raw/orders/dt=2024-01-05/part-0001.snappy.parquet`, return `[table (the folder before the partition), partition dict {key: value} for every key=value folder, stem (name without all suffixes), suffixes (list), output path with "raw" replaced by "curated" and suffix ".parquet"]`.'),
      hints: ['`PurePosixPath(p).parts`, `.name`, `.suffixes`; build the output with `PurePosixPath(*parts)` and `.with_name(...)`.'],
      entry: 'describe_paths',
      signature: 'describe_paths(paths: list[str]) -> list[list]',
      solution: code`from pathlib import PurePosixPath

def describe_paths(paths: list[str]) -> list[list]:
    out = []
    for p in paths:
        path = PurePosixPath(p)
        folders = path.parts[:-1]
        partitions = dict(f.split("=", 1) for f in folders if "=" in f)
        plain = [f for f in folders if "=" not in f and f != "/"]
        table = plain[-1] if plain else None
        stem = path.name.split(".")[0]
        new_parts = ["curated" if f == "raw" else f for f in path.parts]
        new = PurePosixPath(*new_parts).with_name(stem + ".parquet")
        out.append([table, partitions, stem, path.suffixes, str(new)])
    return out
`,
      explanation: md('`pathlib` treats paths as objects (`parts`, `suffixes`, `with_name`) instead of string slicing, which avoids off-by-one errors with separators. `PurePosixPath` does pure manipulation — no filesystem access, the same on every OS.'),
      tests: [
        ex('Example', ['/lake/raw/orders/dt=2024-01-05/part-0001.snappy.parquet']),
        ex('Two partition levels', ['/lake/raw/events/year=2024/month=02/f.json']),
        hid('No partitions', ['/data/raw/users/users.csv']),
        hid('Several paths', ['/lake/raw/a/dt=1/x.gz', '/lake/raw/b/region=eu/dt=2/y.csv.gz']),
      ],
    }),

    python({
      id: 'struct-binary-records',
      title: 'Parse Fixed-Width Binary Records with struct',
      difficulty: 'Medium',
      topics: ['Serialization', 'Parsing (CSV / JSON)'],
      patterns: ['struct.iter_unpack'],
      domains: ['IoT / Telemetry'],
      roles: DE,
      summary: 'Decode little-endian sensor records (uint32 id, int16 temp ×100, uint8 flags) from hex.',
      description: md('`hex_data` is hex text of consecutive 7-byte records `<IhB` (little-endian: uint32 device id, int16 temperature in hundredths, uint8 flags). Return `[[device_id, temp_c, low_battery (flag bit 0), alarm (flag bit 1)], …]`. A trailing incomplete record is ignored.'),
      hints: ['`bytes.fromhex(...)`, `struct.calcsize("<IhB")`, `struct.iter_unpack` over a slice that is a multiple of the record size.'],
      entry: 'decode',
      signature: 'decode(hex_data: str) -> list[list]',
      solution: code`import struct

FMT = "<IhB"

def decode(hex_data: str) -> list[list]:
    raw = bytes.fromhex(hex_data)
    size = struct.calcsize(FMT)
    usable = raw[: len(raw) - len(raw) % size]
    return [[dev, temp / 100, bool(flags & 1), bool(flags & 2)] for dev, temp, flags in struct.iter_unpack(FMT, usable)]
`,
      explanation: md('`struct` maps C-style binary layouts to Python values; the format string pins endianness (`<`) and sizes, so parsing is exact and fast. Bit masks extract packed boolean flags.'),
      tests: [
        ex('Example', '01000000ec09010200000038ff02'),
        ex('Trailing garbage', '0300000064000003ff'),
        hid('Empty', ''),
        hid('Negative and both flags', 'ffffff7f9cff03'),
      ],
    }),

    python({
      id: 'hash-partitioning',
      title: 'Stable Hash Partitioning with hashlib',
      difficulty: 'Medium',
      topics: ['Hash Maps & Counting', 'Math & Bits'],
      patterns: ['Deterministic hashing (not hash())'],
      domains: ['Data lake / Storage'],
      roles: DE,
      summary: 'Assign keys to N partitions the same way on every machine and run.',
      description: md('Partition = `int(md5(key.encode()).hexdigest(), 16) % n`. Return `[partition per key, counts per partition (list of length n)]`. (Python\'s built-in `hash()` of strings is randomised per process, so it must not be used for this.)'),
      hints: ['`hashlib.md5(key.encode("utf-8")).hexdigest()`.'],
      entry: 'partition',
      signature: 'partition(keys: list[str], n: int) -> list',
      solution: code`import hashlib

def partition(keys: list[str], n: int) -> list:
    parts = [int(hashlib.md5(k.encode("utf-8")).hexdigest(), 16) % n for k in keys]
    counts = [0] * n
    for p in parts:
        counts[p] += 1
    return [parts, counts]
`,
      explanation: md('Partitioning must be deterministic across processes and runs, or the same key lands in different files. `hash(str)` is salted per process (PYTHONHASHSEED); a cryptographic digest is stable everywhere. md5 is fine for distribution, not for security.'),
      tests: [
        ex('Example', ['user-1', 'user-2', 'user-3', 'user-4'], 3),
        ex('Single partition', ['a', 'b'], 1),
        hid('Repeated keys land together', ['k', 'k', 'z'], 4),
        hid('Many keys', ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], 2),
      ],
    }),

    python({
      id: 'compress-base64',
      title: 'Compress and Encode a Payload',
      difficulty: 'Easy',
      topics: ['Serialization'],
      patterns: ['zlib + base64 round trip'],
      domains: ['APIs / Integration'],
      roles: DE,
      summary: 'Compress JSON with zlib, base64-encode it for transport, and verify the round trip.',
      description: md('For each text, return `[original_bytes, compressed_bytes, base64_length, round_trip_ok]` where compression is `zlib.compress(text.encode(), 9)` and base64 is standard `b64encode` of the compressed bytes.'),
      hints: ['Base64 grows data by 4/3 (rounded up to a multiple of 4).'],
      entry: 'pack',
      signature: 'pack(texts: list[str]) -> list[list]',
      solution: code`import base64
import zlib

def pack(texts: list[str]) -> list[list]:
    out = []
    for t in texts:
        raw = t.encode("utf-8")
        comp = zlib.compress(raw, 9)
        b64 = base64.b64encode(comp)
        back = zlib.decompress(base64.b64decode(b64)).decode("utf-8")
        out.append([len(raw), len(comp), len(b64), back == t])
    return out
`,
      explanation: md('Repetitive data (JSON keys, logs) compresses very well; tiny or random payloads can get **bigger** because of headers. Base64 makes bytes safe for text channels at a 33% size cost.'),
      tests: [
        ex('Example', ['{"event": "click", "event2": "click", "event3": "click"}', 'hi']),
        ex('Empty string', ['']),
        hid('Highly repetitive', ['a'.repeat(1000)]),
        hid('Unicode text', ['héllo wörld ✓ héllo wörld ✓']),
      ],
    }),

    python({
      id: 'bisect-leaderboard',
      title: 'A Sorted Leaderboard with bisect',
      difficulty: 'Easy',
      topics: ['Binary Search', 'Sorting'],
      patterns: ['insort + bisect for rank'],
      domains: ['Gaming'],
      roles: DE,
      summary: 'Keep scores sorted on insert and answer "how many players are below this score" in O(log n).',
      description: md('Process ops `["add", score]` (insert with `bisect.insort`) and `["rank", score]` (record how many stored scores are **strictly below** it, via `bisect_left`). Return the recorded ranks and the final sorted list.'),
      hints: ['`bisect_left(a, x)` = number of elements < x in a sorted list.'],
      entry: 'leaderboard',
      signature: 'leaderboard(ops: list[list]) -> list',
      solution: code`import bisect

def leaderboard(ops: list[list]) -> list:
    scores, ranks = [], []
    for op, value in ops:
        if op == "add":
            bisect.insort(scores, value)
        else:
            ranks.append(bisect.bisect_left(scores, value))
    return [ranks, scores]
`,
      explanation: md('`bisect` finds positions in sorted lists in O(log n); `insort` keeps the list sorted (the insert itself is O(n) due to shifting — fine for thousands, use a balanced tree or `sortedcontainers` for millions).'),
      tests: [
        ex('Example', [['add', 50], ['add', 20], ['add', 80], ['rank', 50], ['rank', 100], ['rank', 0]]),
        ex('Ties', [['add', 5], ['add', 5], ['rank', 5], ['rank', 6]]),
        hid('Empty board', [['rank', 1]]),
        hid('Interleaved', [['add', 3], ['rank', 4], ['add', 1], ['add', 9], ['rank', 4], ['rank', 10]]),
      ],
    }),

    python({
      id: 'priority-scheduler-heap',
      title: 'A Priority Task Queue with Updates (heapq)',
      difficulty: 'Medium',
      topics: ['Heaps', 'Stacks & Queues'],
      patterns: ['Lazy deletion in a heap'],
      domains: ['Platform / Ops'],
      roles: DE,
      summary: 'Support add, change-priority, cancel and pop-lowest on a heap with lazy invalidation.',
      description: md('Ops: `["add", task, priority]` (re-adding an existing task changes its priority), `["cancel", task]`, `["pop"]` (record the task with the lowest priority, ties by insertion order, or `"empty"`). Return the popped tasks.'),
      hints: ['Keep `entry_finder[task] = [priority, seq, task]`; to update or cancel, mark the old entry removed (e.g. set its task to None) and push a new one; skip removed entries when popping.'],
      entry: 'schedule',
      signature: 'schedule(ops: list[list]) -> list[str]',
      solution: code`import heapq
import itertools

def schedule(ops: list[list]) -> list[str]:
    heap, finder, seq, out = [], {}, itertools.count(), []
    REMOVED = None

    def remove(task):
        entry = finder.pop(task, None)
        if entry is not None:
            entry[2] = REMOVED

    for op in ops:
        if op[0] == "add":
            remove(op[1])
            entry = [op[2], next(seq), op[1]]
            finder[op[1]] = entry
            heapq.heappush(heap, entry)
        elif op[0] == "cancel":
            remove(op[1])
        else:
            while heap and heap[0][2] is REMOVED:
                heapq.heappop(heap)
            if heap:
                _, _, task = heapq.heappop(heap)
                del finder[task]
                out.append(task)
            else:
                out.append("empty")
    return out
`,
      explanation: md('`heapq` can\'t update an item in place, so mark the old entry invalid and push a new one; invalid entries are discarded when they reach the top. The sequence number breaks ties stably and keeps Python from comparing task payloads.'),
      tests: [
        ex('Example', [['add', 'etl', 2], ['add', 'report', 1], ['add', 'etl', 0], ['pop'], ['pop'], ['pop']]),
        ex('Cancel', [['add', 'a', 1], ['add', 'b', 2], ['cancel', 'a'], ['pop']]),
        hid('Ties keep insertion order', [['add', 'x', 1], ['add', 'y', 1], ['pop'], ['pop']]),
        hid('Cancel unknown', [['cancel', 'z'], ['pop']]),
      ],
    }),

    python({
      id: 'weakref-cache',
      title: 'A Cache That Doesn\'t Keep Objects Alive (weakref)',
      difficulty: 'Medium',
      topics: ['Copying & Mutability', 'Dicts & Sets'],
      patterns: ['WeakValueDictionary'],
      domains: ['Platform / Ops'],
      roles: DE,
      summary: 'Cache objects by key only while something else still references them.',
      description: md('`Dataset(name)` objects are cached in a `weakref.WeakValueDictionary`. `run(ops)` applies `["load", name]` (return `"hit"` if cached, else create, cache, keep a strong reference in `held` and return `"miss"`), `["release", name]` (drop the strong reference — CPython frees it immediately) and `["cached"]` (record sorted cached keys).'),
      hints: ['Entries disappear from a `WeakValueDictionary` as soon as the last strong reference to the value goes away.'],
      entry: 'run',
      signature: 'run(ops: list[list]) -> list',
      starter: code`import weakref

class Dataset:
    def __init__(self, name):
        self.name = name

def load(cache, held, name):
    pass


# The tests call run(); don't change it.
def run(ops):
    cache, held, out = weakref.WeakValueDictionary(), {}, []
    for op in ops:
        if op[0] == "load":
            out.append(load(cache, held, op[1]))
        elif op[0] == "release":
            held.pop(op[1], None)
        else:
            out.append(sorted(cache.keys()))
    return out
`,
      solution: code`import weakref

class Dataset:
    def __init__(self, name):
        self.name = name

def load(cache, held, name):
    obj = cache.get(name)
    if obj is not None:
        held[name] = obj
        return "hit"
    obj = Dataset(name)
    cache[name] = obj
    held[name] = obj
    return "miss"


def run(ops):
    cache, held, out = weakref.WeakValueDictionary(), {}, []
    for op in ops:
        if op[0] == "load":
            out.append(load(cache, held, op[1]))
        elif op[0] == "release":
            held.pop(op[1], None)
        else:
            out.append(sorted(cache.keys()))
    return out
`,
      explanation: md('A weak reference doesn\'t count toward an object\'s reference count, so a weak cache never prevents garbage collection — it shares objects that are already in use without leaking memory. With CPython\'s reference counting the entry vanishes the moment the last strong reference is dropped.'),
      tests: [
        ex('Example', [['load', 'sales'], ['load', 'sales'], ['cached'], ['release', 'sales'], ['cached'], ['load', 'sales']]),
        ex('Several datasets', [['load', 'a'], ['load', 'b'], ['release', 'a'], ['cached']]),
        hid('Release unknown', [['release', 'x'], ['cached']]),
        hid('Reload after release keeps others', [['load', 'a'], ['load', 'b'], ['release', 'b'], ['load', 'b'], ['load', 'a'], ['cached']]),
      ],
    }),

    python({
      id: 'uuid5-stable-ids',
      title: 'Deterministic Ids with uuid5',
      difficulty: 'Easy',
      topics: ['Serialization', 'Strings'],
      patterns: ['Name-based UUIDs'],
      domains: ['Data warehousing'],
      roles: DE,
      summary: 'Generate the same surrogate id for the same natural key on every run.',
      description: md('For each natural key, return `str(uuid.uuid5(NAMESPACE, key.strip().lower()))` where `NAMESPACE = uuid.uuid5(uuid.NAMESPACE_DNS, "datadrill.example")`. Also return how many distinct ids were produced.'),
      hints: ['uuid5 is a SHA-1 hash of (namespace, name) — same input, same id.'],
      entry: 'stable_ids',
      signature: 'stable_ids(keys: list[str]) -> list',
      solution: code`import uuid

NAMESPACE = uuid.uuid5(uuid.NAMESPACE_DNS, "datadrill.example")

def stable_ids(keys: list[str]) -> list:
    ids = [str(uuid.uuid5(NAMESPACE, k.strip().lower())) for k in keys]
    return [ids, len(set(ids))]
`,
      explanation: md('`uuid4` is random — rerunning a load would mint new ids for the same entities. `uuid5` derives the id from a namespace and the key, so it is idempotent and needs no lookup table. Normalise the key first so "ACME " and "acme" match.'),
      tests: [
        ex('Example', ['acme', 'ACME ', 'globex']),
        ex('Single key', ['x']),
        hid('Empty list', []),
        hid('Normalisation', ['  Mixed Case ', 'mixed case', 'other']),
      ],
    }),
  ],
};
