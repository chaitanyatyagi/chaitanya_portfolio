// Python pack 16 — multithreading concepts: race conditions, Lock, RLock,
// Semaphore / BoundedSemaphore, producer–consumer queues, thread lifecycle,
// Barrier, Timer, daemon threads, deadlock detection, and when threads help
// (I/O-bound) vs. don't (CPU-bound under the GIL).
//
// The sandbox runs Python in WebAssembly, where new OS threads can't start, so
// these problems model thread behaviour deterministically: you write the
// scheduling / synchronisation logic and the tests replay exact interleavings.
// Lock objects themselves (threading.Lock, queue.Queue) work normally.
import { python, md, code, ex, hid } from './define.js';
import { dev, tag } from './sources.js';

const DE = ['Data Engineer'];

export default {
  problems: [
    python({
      id: 'race-condition-lost-updates',
      title: 'Replay a Race Condition: Lost Updates',
      difficulty: 'Medium',
      topics: ['Concurrency'],
      patterns: ['Interleaving simulation'],
      domains: ['Platform / Ops'],
      roles: DE,
      summary: 'Simulate two threads doing read-modify-write on a shared counter and count the lost updates.',
      description: md(
        'Each thread increments a shared counter `increments` times; every increment is three steps — **read** the counter into a local, **add** 1 to the local, **write** it back. `schedule` is the order in which threads get to run their next step (thread ids `0` and `1`; ids of finished threads are skipped).',
        '',
        'With `locked=True`, a thread that has done its **read** holds a lock until its **write**: a step scheduled for the other thread while the lock is held is skipped (it waits). Unused schedule slots are ignored; afterwards the remaining steps run to completion — a thread holding the lock finishes first, then thread 0, then thread 1.',
        '',
        'Return `[final_counter, lost_updates]` where lost = `2 * increments - final_counter`.',
      ),
      hints: ['Keep, per thread, its step index (0 = read, 1 = add, 2 = write), its local value and how many increments it has finished.'],
      entry: 'simulate',
      signature: 'simulate(increments: int, schedule: list[int], locked: bool) -> list[int]',
      solution: code`def simulate(increments: int, schedule: list[int], locked: bool) -> list[int]:
    counter = 0
    step = [0, 0]
    local = [0, 0]
    done = [0, 0]
    holder = None

    def run_step(t):
        nonlocal counter, holder
        if done[t] == increments:
            return
        if locked and holder is not None and holder != t:
            return
        if step[t] == 0:
            local[t] = counter
            holder = t if locked else holder
        elif step[t] == 1:
            local[t] += 1
        else:
            counter = local[t]
            done[t] += 1
            if locked:
                holder = None
        step[t] = (step[t] + 1) % 3

    for t in schedule:
        run_step(t)
    # Drain: whoever holds the lock finishes its increment first, then thread 0, then 1.
    while done[0] < increments or done[1] < increments:
        if holder is not None:
            run_step(holder)
        else:
            run_step(0 if done[0] < increments else 1)
    return [counter, 2 * increments - counter]
`,
      explanation: md('`counter += 1` is not atomic: it is a read, an add and a write. If both threads read the same value before either writes, one increment is overwritten — a **lost update**. Holding a lock across the whole read-modify-write makes it one critical section, so no interleaving can lose work. (CPython\'s GIL does not prevent this: it can switch threads between those bytecodes.)'),
      tests: [
        ex('Interleaved without a lock', 1, [0, 1, 0, 1, 0, 1], false),
        ex('Same schedule with a lock', 1, [0, 1, 0, 1, 0, 1], true),
        hid('Serial schedule loses nothing', 2, [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1], false),
        hid('Many lost updates', 3, [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1], false),
        hid('Lock with a hostile schedule', 3, [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1], true),
      ],
    }),

    python({
      id: 'lock-protected-counter',
      title: 'A Thread-Safe Counter with threading.Lock',
      difficulty: 'Easy',
      topics: ['Concurrency', 'OOP'],
      patterns: ['with lock: critical section'],
      domains: ['Platform / Ops'],
      roles: DE,
      summary: 'Guard a counter with a Lock used as a context manager — and make sure errors release it.',
      description: md(
        'Implement `SafeCounter` with a `threading.Lock`: `add(n)` (n must be a positive int, else raise `ValueError`), `value()`, and `snapshot_and_reset()` (returns the value and resets to 0 **atomically**). Every method must hold the lock while touching state, using `with self._lock:` so it is released even when an exception is raised.',
        '',
        '`run(ops)` applies `["add", n]`, `["value"]`, `["reset"]` and returns the results (`"ValueError"` for rejected adds) plus, at the end, whether the lock is free (`not lock.locked()`).',
      ),
      hints: ['Validate **inside** the `with` block or before it — either way `with` guarantees the release.'],
      entry: 'run',
      signature: 'run(ops: list[list]) -> list',
      starter: code`import threading

class SafeCounter:
    def __init__(self):
        self._lock = threading.Lock()
        self._value = 0


# The tests call run(); don't change it.
def run(ops):
    c = SafeCounter()
    out = []
    for op in ops:
        try:
            if op[0] == "add":
                c.add(op[1])
            elif op[0] == "value":
                out.append(c.value())
            else:
                out.append(c.snapshot_and_reset())
        except ValueError:
            out.append("ValueError")
    out.append(not c._lock.locked())
    return out
`,
      solution: code`import threading

class SafeCounter:
    def __init__(self):
        self._lock = threading.Lock()
        self._value = 0

    def add(self, n):
        with self._lock:
            if not isinstance(n, int) or isinstance(n, bool) or n <= 0:
                raise ValueError("n must be a positive int")
            self._value += n

    def value(self):
        with self._lock:
            return self._value

    def snapshot_and_reset(self):
        with self._lock:
            v, self._value = self._value, 0
            return v


def run(ops):
    c = SafeCounter()
    out = []
    for op in ops:
        try:
            if op[0] == "add":
                c.add(op[1])
            elif op[0] == "value":
                out.append(c.value())
            else:
                out.append(c.snapshot_and_reset())
        except ValueError:
            out.append("ValueError")
    out.append(not c._lock.locked())
    return out
`,
      explanation: md('`with lock:` is `acquire()` + `try/finally: release()`. Manual `acquire()` without `finally` leaks the lock on the first exception and every other thread blocks forever. "Read then reset" must be a single critical section, otherwise an `add` could slip in between and be lost.'),
      tests: [
        ex('Example', [['add', 5], ['add', 3], ['value'], ['reset'], ['value']]),
        ex('Invalid adds release the lock', [['add', -1], ['add', 'x'], ['add', 2], ['value']]),
        hid('Reset empty', [['reset']]),
        hid('Bool is not an int here', [['add', true], ['value']]),
      ],
    }),

    python({
      id: 'reentrant-lock-semantics',
      title: 'Implement RLock Semantics',
      difficulty: 'Medium',
      topics: ['Concurrency', 'OOP'],
      patterns: ['Owner + recursion count'],
      domains: ['Platform / Ops'],
      roles: DE,
      summary: 'Model a re-entrant lock: the owner may acquire again, others block, release must match.',
      description: md(
        'Implement `ReentrantLock` modelling `threading.RLock` for named threads:',
        '',
        '- `acquire(t)` → `"acquired"` if free or already owned by `t` (incrementing the count), else `"blocked"`;',
        '- `release(t)` → `"released"` (count down; free at 0) — or `"error"` if `t` isn\'t the owner;',
        '- set `plain=True` in the constructor to model a plain `Lock`: a second `acquire` by the **owner** returns `"deadlock"` instead of succeeding.',
        '',
        '`run(plain, ops)` applies `[op, thread]` pairs and returns the results plus the final `[owner, count]`.',
      ),
      hints: ['State: `owner` (or None) and `count`.'],
      entry: 'run',
      signature: 'run(plain: bool, ops: list[list[str]]) -> list',
      starter: code`class ReentrantLock:
    def __init__(self, plain=False):
        pass


# The tests call run(); don't change it.
def run(plain, ops):
    lock = ReentrantLock(plain)
    out = [getattr(lock, op)(t) for op, t in ops]
    return out + [[lock.owner, lock.count]]
`,
      solution: code`class ReentrantLock:
    def __init__(self, plain=False):
        self.plain = plain
        self.owner = None
        self.count = 0

    def acquire(self, t):
        if self.owner is None:
            self.owner, self.count = t, 1
            return "acquired"
        if self.owner == t:
            if self.plain:
                return "deadlock"
            self.count += 1
            return "acquired"
        return "blocked"

    def release(self, t):
        if self.owner != t:
            return "error"
        self.count -= 1
        if self.count == 0:
            self.owner = None
        return "released"


def run(plain, ops):
    lock = ReentrantLock(plain)
    out = [getattr(lock, op)(t) for op, t in ops]
    return out + [[lock.owner, lock.count]]
`,
      explanation: md('An `RLock` remembers **who** holds it and **how many times**, so a method holding it can call another method that acquires it again (e.g. `transfer()` calling `withdraw()`). A plain `Lock` has no owner: the same thread acquiring twice waits for itself forever. Releasing a lock you don\'t own is an error (`RuntimeError` in CPython).'),
      tests: [
        ex('Re-entry', false, [['acquire', 'A'], ['acquire', 'A'], ['acquire', 'B'], ['release', 'A'], ['release', 'A'], ['acquire', 'B']]),
        ex('Plain lock self-deadlock', true, [['acquire', 'A'], ['acquire', 'A']]),
        hid('Release by non-owner', false, [['acquire', 'A'], ['release', 'B']]),
        hid('Release when free', false, [['release', 'A']]),
      ],
    }),

    python({
      id: 'semaphore-job-slots',
      title: 'Schedule Jobs Through a Bounded Semaphore',
      difficulty: 'Medium',
      topics: ['Concurrency', 'Heaps'],
      patterns: ['Slot scheduling with a heap'],
      domains: ['Platform / Ops'],
      roles: DE,
      summary: 'With k connection slots, compute when each job starts and finishes, FIFO.',
      description: md(
        'A `BoundedSemaphore(k)` limits how many jobs use the database at once. Jobs `[name, arrival, duration]` arrive in the given order (non-decreasing arrival). A job starts as soon as a slot is free (FIFO among waiting jobs) and releases it at `start + duration`. A slot freed at time t can be taken by a job arriving at t.',
        '',
        'Return `[[name, start, finish] ...]` in input order, plus the maximum number of jobs **waiting** at any moment.',
      ),
      hints: ['Keep a min-heap of slot-free times (k entries). Each job starts at `max(arrival, heappop())`.'],
      entry: 'schedule_slots',
      signature: 'schedule_slots(jobs: list[list], k: int) -> list',
      solution: code`import heapq

def schedule_slots(jobs: list[list], k: int) -> list:
    free_at = [0] * k
    heapq.heapify(free_at)
    out = []
    for name, arrival, duration in jobs:
        start = max(arrival, heapq.heappop(free_at))
        heapq.heappush(free_at, start + duration)
        out.append([name, start, start + duration])
    max_wait = 0
    for _, arrival, _ in jobs:
        waiting = sum(1 for _, a, _ in jobs if a <= arrival) - sum(1 for _, s, _ in out if s <= arrival)
        max_wait = max(max_wait, waiting)
    return out + [max_wait]
`,
      explanation: md('A semaphore is a counter of available slots: `acquire` decrements (waiting at 0), `release` increments. A **Bounded**Semaphore additionally raises if released more times than acquired — catching bugs. Because jobs are served FIFO, popping the earliest free slot is exactly the semaphore\'s behaviour.'),
      tests: [
        ex('Example', [['a', 0, 5], ['b', 0, 3], ['c', 1, 2], ['d', 2, 1]], 2),
        ex('Enough slots', [['x', 0, 4], ['y', 1, 4]], 5),
        hid('Single slot queue', [['p', 0, 2], ['q', 0, 2], ['r', 0, 2]], 1),
        hid('Freed exactly on arrival', [['a', 0, 3], ['b', 3, 1]], 1),
      ],
    }),

    python({
      id: 'bounded-producer-consumer',
      title: 'Bounded Producer–Consumer Buffer',
      difficulty: 'Medium',
      topics: ['Concurrency', 'Stacks & Queues'],
      patterns: ['Bounded queue with back-pressure policy'],
      domains: ['Event pipelines'],
      ...tag(dev('Stripe', 'deques for bounded producer-consumer queues')),
      roles: DE,
      summary: 'Implement a fixed-capacity event buffer with "reject" or "drop oldest" back-pressure.',
      description: md(
        'Implement `Buffer(capacity, policy)` where policy is `"reject"` (a put into a full buffer fails) or `"drop_oldest"` (the oldest item is evicted to make room). `put(x)` returns `True` if `x` was stored; `get()` returns the oldest item or `None` if empty. Track `dropped` (evicted + rejected).',
        '',
        '`run(capacity, policy, ops)` applies `["put", x]` / `["get"]` and returns `[gets, dropped, remaining items]`.',
      ),
      hints: ['`collections.deque(maxlen=capacity)` drops from the left automatically — but you still need to count it.'],
      entry: 'run',
      signature: 'run(capacity: int, policy: str, ops: list[list]) -> list',
      starter: code`from collections import deque

class Buffer:
    def __init__(self, capacity, policy):
        pass


# The tests call run(); don't change it.
def run(capacity, policy, ops):
    b = Buffer(capacity, policy)
    gets = []
    for op in ops:
        if op[0] == "put":
            b.put(op[1])
        else:
            gets.append(b.get())
    return [gets, b.dropped, list(b.items)]
`,
      solution: code`from collections import deque

class Buffer:
    def __init__(self, capacity, policy):
        self.capacity = capacity
        self.policy = policy
        self.items = deque()
        self.dropped = 0

    def put(self, x):
        if len(self.items) >= self.capacity:
            self.dropped += 1
            if self.policy == "reject":
                return False
            self.items.popleft()
        self.items.append(x)
        return True

    def get(self):
        return self.items.popleft() if self.items else None


def run(capacity, policy, ops):
    b = Buffer(capacity, policy)
    gets = []
    for op in ops:
        if op[0] == "put":
            b.put(op[1])
        else:
            gets.append(b.get())
    return [gets, b.dropped, list(b.items)]
`,
      explanation: md('When producers outrun consumers, a bounded buffer forces a decision: block the producer (`queue.Queue(maxsize)` does that), reject new data, or shed old data. Telemetry pipelines often drop oldest (freshness matters); payment pipelines must never drop, so they block or reject and retry.'),
      tests: [
        ex('Reject when full', 2, 'reject', [['put', 1], ['put', 2], ['put', 3], ['get'], ['put', 4]]),
        ex('Drop oldest', 2, 'drop_oldest', [['put', 1], ['put', 2], ['put', 3], ['get'], ['get'], ['get']]),
        hid('Get from empty', 1, 'reject', [['get']]),
        hid('Capacity one', 1, 'drop_oldest', [['put', 'a'], ['put', 'b'], ['put', 'c']]),
      ],
    }),

    python({
      id: 'thread-lifecycle',
      title: 'Validate a Thread\'s Lifecycle',
      difficulty: 'Easy',
      topics: ['Concurrency'],
      patterns: ['State machine'],
      domains: ['Platform / Ops'],
      roles: DE,
      summary: 'Check event sequences against the new → runnable → running → … → terminated state machine.',
      description: md(
        'Allowed transitions: `new → runnable` (start), `runnable → running` (scheduled), `running → runnable` (preempted), `running → waiting` (sleep / wait / lock), `waiting → runnable` (woken), `running → terminated` (finished). Every thread begins in `new`.',
        '',
        'For each thread\'s list of target states, return the final state, or `"invalid <from>-><to>"` at the first illegal transition. Starting a thread twice is the classic illegal one.',
      ),
      hints: ['A dict from state to the set of allowed next states.'],
      entry: 'lifecycle',
      signature: 'lifecycle(threads: dict[str, list[str]]) -> dict[str, str]',
      solution: code`ALLOWED = {
    "new": {"runnable"},
    "runnable": {"running"},
    "running": {"runnable", "waiting", "terminated"},
    "waiting": {"runnable"},
    "terminated": set(),
}

def lifecycle(threads: dict[str, list[str]]) -> dict[str, str]:
    out = {}
    for name, states in threads.items():
        state = "new"
        for nxt in states:
            if nxt not in ALLOWED[state]:
                state = f"invalid {state}->{nxt}"
                break
            state = nxt
        out[name] = state
    return out
`,
      explanation: md('`Thread.start()` moves a thread from new to runnable exactly once — calling it again raises `RuntimeError`. A terminated thread can\'t be restarted; you create a new `Thread`. Modelling the lifecycle as a transition table makes these rules explicit.'),
      tests: [
        ex('Example', { worker: ['runnable', 'running', 'waiting', 'runnable', 'running', 'terminated'], bad: ['runnable', 'running', 'terminated', 'runnable'] }),
        ex('Never started', { idle: [] }),
        hid('Skipped runnable', { t: ['running'] }),
        hid('Preempted several times', { t: ['runnable', 'running', 'runnable', 'running', 'runnable'] }),
      ],
    }),

    python({
      id: 'barrier-phases',
      title: 'Barrier: Release Parties in Groups',
      difficulty: 'Medium',
      topics: ['Concurrency'],
      patterns: ['Barrier generations'],
      domains: ['Machine learning'],
      roles: DE,
      summary: 'Simulate threading.Barrier(n): every n arrivals trip the barrier and release that group.',
      description: md(
        'Workers call `wait()` on a `Barrier(parties)` as listed in `arrivals` (worker names, in time order). Each time `parties` workers are waiting, the barrier trips: those workers are released together and the barrier resets for the next generation. `"abort"` in the list breaks the barrier: everyone currently waiting gets `BrokenBarrierError`, and later arrivals fail immediately.',
        '',
        'Return `[released groups (lists in arrival order), broken (names that got the error), still waiting]`.',
      ),
      hints: ['Keep the current generation\'s waiting list and a `broken` flag.'],
      entry: 'barrier',
      signature: 'barrier(parties: int, arrivals: list[str]) -> list',
      solution: code`def barrier(parties: int, arrivals: list[str]) -> list:
    released, broken, waiting = [], [], []
    is_broken = False
    for who in arrivals:
        if who == "abort":
            is_broken = True
            broken.extend(waiting)
            waiting = []
            continue
        if is_broken:
            broken.append(who)
            continue
        waiting.append(who)
        if len(waiting) == parties:
            released.append(waiting)
            waiting = []
    return [released, broken, waiting]
`,
      explanation: md('A barrier synchronises phases: nobody proceeds until all parties arrive (e.g. every training worker finishes an epoch). It is reusable — after tripping it starts a new generation — and `abort()` breaks it so waiting threads don\'t hang forever when one worker dies.'),
      tests: [
        ex('Example', 3, ['w1', 'w2', 'w3', 'w4', 'w5']),
        ex('Abort breaks waiting workers', 2, ['a', 'abort', 'b']),
        hid('Several generations', 2, ['a', 'b', 'c', 'd', 'e', 'f']),
        hid('One party trips immediately', 1, ['x', 'y']),
      ],
    }),

    python({
      id: 'timer-firing-order',
      title: 'When Do the Timers Fire?',
      difficulty: 'Medium',
      topics: ['Concurrency', 'Heaps'],
      patterns: ['Event queue with cancellation'],
      domains: ['Platform / Ops'],
      roles: DE,
      summary: 'Order threading.Timer callbacks by fire time, honouring cancellations made before firing.',
      description: md(
        'Ops are `["start", name, at, delay]` (a `Timer(delay, ...)` started at time `at`) or `["cancel", name, at]`. A timer fires at `at + delay` unless cancelled **strictly before** that moment. Return `[[name, fire_time]]` in firing order (ties by start order). Cancelling an already-fired or unknown timer does nothing.',
      ),
      hints: ['Compute fire times, then drop timers whose cancel time is earlier than their fire time; sort the rest.'],
      entry: 'fired',
      signature: 'fired(ops: list[list]) -> list[list]',
      solution: code`def fired(ops: list[list]) -> list[list]:
    timers = {}
    order = []
    cancelled_at = {}
    for op in ops:
        if op[0] == "start":
            _, name, at, delay = op
            timers[name] = at + delay
            order.append(name)
        else:
            _, name, at = op
            if name in timers and name not in cancelled_at:
                cancelled_at[name] = at
    live = [n for n in order if not (n in cancelled_at and cancelled_at[n] < timers[n])]
    live.sort(key=lambda n: (timers[n], order.index(n)))
    return [[n, timers[n]] for n in live]
`,
      explanation: md('`threading.Timer` is a thread that sleeps, then calls a function — unless `cancel()` is called first. Cancelling after it has fired has no effect. Retry/backoff schedulers and debouncers are built on exactly this "deadline, unless cancelled" model.'),
      tests: [
        ex('Example', [['start', 'flush', 0, 5], ['start', 'ping', 1, 1], ['cancel', 'flush', 4], ['start', 'retry', 2, 3]]),
        ex('Cancel after firing does nothing', [['start', 'a', 0, 1], ['cancel', 'a', 5]]),
        hid('Cancel at the exact fire time is too late', [['start', 'a', 0, 2], ['cancel', 'a', 2]]),
        hid('Ties by start order', [['start', 'b', 0, 2], ['start', 'a', 1, 1]]),
      ],
    }),

    python({
      id: 'daemon-threads-exit',
      title: 'Daemon Threads and Program Exit',
      difficulty: 'Easy',
      topics: ['Concurrency'],
      patterns: ['Exit rules for daemon threads'],
      domains: ['Platform / Ops'],
      roles: DE,
      summary: 'Work out when the interpreter exits and which daemon threads are killed mid-work.',
      description: md(
        'The main thread finishes at `main_end`. Each thread is `[name, start, duration, daemon]`. Python exits when the main thread **and all non-daemon threads** have finished; daemon threads still running at that moment are killed.',
        '',
        'Return `[exit_time, finished (names, sorted), killed (names, sorted)]`. A daemon finishing exactly at the exit time counts as finished.',
      ),
      hints: ['exit = max(main_end, finish times of non-daemon threads).'],
      entry: 'exit_plan',
      signature: 'exit_plan(main_end: float, threads: list[list]) -> list',
      solution: code`def exit_plan(main_end: float, threads: list[list]) -> list:
    exit_time = max([main_end] + [s + d for _, s, d, daemon in threads if not daemon])
    finished, killed = [], []
    for name, s, d, daemon in threads:
        (finished if s + d <= exit_time else killed).append(name)
    return [exit_time, sorted(finished), sorted(killed)]
`,
      explanation: md('Daemon threads are "background helpers" (heartbeats, cache refreshers): the program doesn\'t wait for them, and they are stopped abruptly — no `finally`, no flushing. Anything that must complete (writing a file, committing a batch) belongs in a non-daemon thread you `join()`.'),
      tests: [
        ex('Example', 5, [['writer', 0, 8, false], ['heartbeat', 0, 100, true], ['cache', 1, 3, true]]),
        ex('Only daemons', 2, [['d', 0, 10, true]]),
        hid('Daemon finishing exactly at exit', 4, [['d', 1, 3, true]]),
        hid('No threads', 1, []),
      ],
    }),

    python({
      id: 'deadlock-detection',
      title: 'Detect a Deadlock in a Wait-For Graph',
      difficulty: 'Hard',
      topics: ['Concurrency', 'Graphs (BFS / DFS)'],
      patterns: ['Cycle detection'],
      domains: ['Database Access'],
      roles: DE,
      summary: 'From which thread holds which lock and which lock each thread wants, find the deadlocked threads.',
      description: md(
        '`holds` maps lock → the thread holding it; `waits` maps thread → the lock it is blocked on. Thread A **waits for** thread B when A wants a lock B holds. Return the sorted list of threads that are part of a **cycle** in this wait-for graph (they can never proceed). Threads merely waiting on a deadlocked thread are not in the cycle. Return `[]` if there is no deadlock.',
      ),
      hints: ['Each thread waits for at most one other thread, so follow the chain from each thread with a visited set — a repeat means a cycle.'],
      entry: 'deadlocked',
      signature: 'deadlocked(holds: dict[str, str], waits: dict[str, str]) -> list[str]',
      solution: code`def deadlocked(holds: dict[str, str], waits: dict[str, str]) -> list[str]:
    waits_for = {t: holds[lock] for t, lock in waits.items() if lock in holds and holds[lock] != t}
    in_cycle = set()
    for start in waits_for:
        path, seen = [], {}
        t = start
        while t in waits_for and t not in seen:
            seen[t] = len(path)
            path.append(t)
            t = waits_for[t]
        if t in seen:
            in_cycle.update(path[seen[t]:])
    return sorted(in_cycle)
`,
      explanation: md('The classic deadlock is two threads taking two locks in opposite orders. Databases detect it exactly like this — build the wait-for graph, find a cycle, abort one victim. The prevention rule in application code: always acquire locks in one global order (or use timeouts).'),
      tests: [
        ex('Two-thread deadlock', { L1: 'A', L2: 'B' }, { A: 'L2', B: 'L1' }),
        ex('Just waiting, no cycle', { L1: 'A' }, { B: 'L1' }),
        hid('Three-way cycle plus a bystander', { L1: 'A', L2: 'B', L3: 'C' }, { A: 'L2', B: 'L3', C: 'L1', D: 'L1' }),
        hid('Waiting on a free lock', {}, { A: 'L9' }),
      ],
    }),

    python({
      id: 'threads-vs-gil',
      title: 'Will Threads Speed This Up?',
      difficulty: 'Medium',
      topics: ['Concurrency'],
      patterns: ['Cost model: I/O vs CPU bound'],
      domains: ['Platform / Ops'],
      roles: DE,
      summary: 'Estimate wall-clock time for tasks run serially, with threads (GIL) and with processes.',
      description: md(
        'Each task is `[kind, seconds]` with kind `"io"` (waiting on network/disk) or `"cpu"` (pure Python computation). Model:',
        '',
        '- **serial**: the sum of all durations;',
        '- **threads** (unlimited threads, one GIL): CPU work can\'t overlap, I/O waits can → `max(total cpu, longest io task)`;',
        '- **processes** with `workers` processes: tasks are assigned greedily, longest first, to the least-loaded worker → the busiest worker\'s total.',
        '',
        'Return `[serial, threads, processes, best]` where best is the name of the fastest model (ties → `"threads"` before `"processes"` before `"serial"`).',
      ),
      hints: ['For processes, sort durations descending and keep a min-heap of worker loads.'],
      entry: 'estimate',
      signature: 'estimate(tasks: list[list], workers: int) -> list',
      solution: code`import heapq

def estimate(tasks: list[list], workers: int) -> list:
    serial = sum(s for _, s in tasks)
    cpu = sum(s for k, s in tasks if k == "cpu")
    longest_io = max([s for k, s in tasks if k == "io"], default=0)
    threads = max(cpu, longest_io)
    loads = [0] * workers
    for s in sorted((s for _, s in tasks), reverse=True):
        heapq.heappush(loads, heapq.heappop(loads) + s)
    processes = max(loads)
    times = {"threads": threads, "processes": processes, "serial": serial}
    best = min(["threads", "processes", "serial"], key=lambda k: times[k])
    return [serial, threads, processes, best]
`,
      explanation: md('CPython\'s GIL lets only one thread execute Python bytecode at a time, but it is released while waiting on I/O. So threads are great for many API calls or downloads, and useless for pure-Python number crunching — that needs `multiprocessing` / `ProcessPoolExecutor` (or a library that releases the GIL, like NumPy). Free-threaded builds (PEP 703) are changing this.'),
      tests: [
        ex('I/O bound', [['io', 2], ['io', 3], ['io', 1]], 2),
        ex('CPU bound', [['cpu', 4], ['cpu', 4]], 2),
        hid('Mixed', [['cpu', 3], ['io', 5], ['cpu', 1], ['io', 2]], 2),
        hid('Single worker', [['cpu', 1], ['cpu', 2]], 1),
      ],
    }),
  ],
};
