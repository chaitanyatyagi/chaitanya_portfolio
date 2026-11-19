// Python pack 20 — stacks, queues, heaps, graphs and trees: bracket matching,
// monotonic stacks, collision simulation, heaps for top-k / k-th / running
// median, interval scheduling, BFS on grids and routes, union-find,
// topological sort, LCS-based diffs, and tree checks.
import { python, md, code, ex, hid } from './define.js';
import { dev, dlp, ddp, gfg, tag } from './sources.js';

const DE = ['Data Engineer'];

export default {
  problems: [
    python({
      id: 'balanced-brackets',
      title: 'Are the Brackets Balanced?',
      difficulty: 'Easy',
      topics: ['Stacks & Queues', 'Strings'],
      patterns: ['Stack matching'],
      domains: ['Developer tools'],
      ...tag(dev('Atlassian', 'stacks for balanced parentheses'), dev('Oracle', 'stacks for valid brackets')),
      roles: DE,
      summary: 'Check that (), [] and {} are properly nested in a template, ignoring other characters.',
      description: md('Return `True` if every bracket in `text` (`()[]{}`) is closed by the matching kind in the right order. Other characters are ignored.'),
      hints: ['Push openers; on a closer, the top of the stack must be its partner.'],
      entry: 'balanced',
      signature: 'balanced(text: str) -> bool',
      solution: code`def balanced(text: str) -> bool:
    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []
    for ch in text:
        if ch in "([{":
            stack.append(ch)
        elif ch in pairs:
            if not stack or stack.pop() != pairs[ch]:
                return False
    return not stack
`,
      explanation: md('The most recent unmatched opener must close first — last in, first out, i.e. a stack. Don\'t forget leftover openers at the end.'),
      tests: [
        ex('Example', 'SELECT f(x[0]) FROM {t}'),
        ex('Crossed', '([)]'),
        hid('Unclosed', '(('),
        hid('Closer first', ')('),
        hid('No brackets', 'plain'),
      ],
    }),

    python({
      id: 'signed-collisions',
      title: 'Colliding Vehicles on a Line',
      difficulty: 'Medium',
      topics: ['Stacks & Queues'],
      patterns: ['Stack simulation'],
      domains: ['Mobility / Ride-hailing'],
      ...tag(dev('Uber', 'stack simulations: signed collisions on a line')),
      roles: DE,
      summary: 'Positive values move right, negative left; when they meet the smaller is destroyed.',
      description: md('Each value\'s sign is its direction (+ right, − left) and its absolute value its size. When a right-mover meets a left-mover, the smaller disappears; equal sizes both disappear. Return the survivors in order.'),
      hints: ['Keep a stack of survivors; a left-mover fights right-movers on top of the stack until it dies or the top isn\'t a right-mover.'],
      entry: 'survivors',
      signature: 'survivors(units: list[int]) -> list[int]',
      solution: code`def survivors(units: list[int]) -> list[int]:
    stack = []
    for u in units:
        alive = True
        while alive and u < 0 and stack and stack[-1] > 0:
            if stack[-1] < -u:
                stack.pop()
            elif stack[-1] == -u:
                stack.pop()
                alive = False
            else:
                alive = False
        if alive:
            stack.append(u)
    return stack
`,
      explanation: md('Only a right-mover followed by a left-mover can collide, so the stack holds everything that can still be hit. Each unit is pushed and popped at most once: O(n).'),
      tests: [
        ex('Example', [5, 10, -5]),
        ex('Equal sizes', [8, -8]),
        hid('Left-mover wins all', [1, 2, 3, -10]),
        hid('Moving apart', [-2, -1, 1, 2]),
      ],
    }),

    python({
      id: 'stock-span',
      title: 'Price Span with a Monotonic Stack',
      difficulty: 'Medium',
      topics: ['Stacks & Queues'],
      patterns: ['Monotonic stack'],
      domains: ['Trading'],
      ...tag(dev('Netflix', 'monotonic stacks for span and range queries')),
      roles: DE,
      summary: 'For each day, count how many consecutive days up to today had price ≤ today\'s.',
      description: md('Return the span for each price: the number of consecutive days ending today (inclusive) whose price is ≤ today\'s price.'),
      hints: ['Keep a stack of indices with strictly decreasing prices; pop everything ≤ today.'],
      entry: 'spans',
      signature: 'spans(prices: list[float]) -> list[int]',
      solution: code`def spans(prices: list[float]) -> list[int]:
    stack, out = [], []
    for i, p in enumerate(prices):
        while stack and prices[stack[-1]] <= p:
            stack.pop()
        out.append(i - stack[-1] if stack else i + 1)
        stack.append(i)
    return out
`,
      explanation: md('Popped days can never be the "previous greater" of a later day, so each index is pushed and popped once — O(n) instead of O(n²).'),
      tests: [
        ex('Example', [100, 80, 60, 70, 60, 75, 85]),
        ex('Rising', [1, 2, 3]),
        hid('Equal prices', [5, 5, 5]),
        hid('Empty', []),
      ],
    }),

    python({
      id: 'next-greater-element',
      title: 'Next Higher Reading',
      difficulty: 'Medium',
      topics: ['Stacks & Queues'],
      patterns: ['Monotonic stack'],
      domains: ['IoT / Telemetry'],
      ...tag(gfg('Flipkart', 'next greatest element')),
      roles: DE,
      summary: 'For each reading, find the next later reading that is strictly higher.',
      description: md('Return, for each position, the next strictly greater value to its right, or `-1`.'),
      hints: ['Scan left to right with a stack of indices still waiting for their answer.'],
      entry: 'next_greater',
      signature: 'next_greater(values: list[int]) -> list[int]',
      solution: code`def next_greater(values: list[int]) -> list[int]:
    out = [-1] * len(values)
    waiting = []
    for i, v in enumerate(values):
        while waiting and values[waiting[-1]] < v:
            out[waiting.pop()] = v
        waiting.append(i)
    return out
`,
      explanation: md('Indices on the stack have decreasing values; a new larger value answers all smaller ones at once. O(n).'),
      tests: [
        ex('Example', [4, 5, 2, 25]),
        ex('Decreasing', [13, 7, 6, 12]),
        hid('Duplicates', [2, 2, 3]),
        hid('Empty', []),
      ],
    }),

    python({
      id: 'order-queue-simulation',
      title: 'Kitchen Order Queue',
      difficulty: 'Easy',
      topics: ['Stacks & Queues'],
      patterns: ['deque as FIFO queue'],
      domains: ['Food delivery'],
      ...tag(dev('Techpath', 'lists and queue simulation')),
      roles: DE,
      summary: 'Simulate a FIFO order queue with priority orders jumping to the front.',
      description: md('Ops: `["add", id]` joins the back, `["rush", id]` joins the **front**, `["serve"]` serves the front (records the id, or `"idle"` if empty), `["cancel", id]` removes a waiting order if present. Return the served list followed by the ids still waiting.'),
      hints: ['`collections.deque` gives O(1) `append`, `appendleft` and `popleft`; `list.pop(0)` is O(n).'],
      entry: 'kitchen',
      signature: 'kitchen(ops: list[list]) -> list',
      solution: code`from collections import deque

def kitchen(ops: list[list]) -> list:
    q, served = deque(), []
    for op in ops:
        if op[0] == "add":
            q.append(op[1])
        elif op[0] == "rush":
            q.appendleft(op[1])
        elif op[0] == "serve":
            served.append(q.popleft() if q else "idle")
        elif op[0] == "cancel" and op[1] in q:
            q.remove(op[1])
    return [served, list(q)]
`,
      explanation: md('A deque is the right queue for both ends. Cancellation is O(n); a real system would mark orders cancelled and skip them when served.'),
      tests: [
        ex('Example', [['add', 1], ['add', 2], ['rush', 9], ['serve'], ['cancel', 2], ['serve'], ['serve']]),
        ex('Empty kitchen', [['serve']]),
        hid('Cancel unknown', [['add', 1], ['cancel', 5]]),
        hid('Rush into an empty queue', [['rush', 7], ['add', 8], ['serve']]),
      ],
    }),

    python({
      id: 'streaming-top-k',
      title: 'Streaming Top-K with Deterministic Ties',
      difficulty: 'Medium',
      topics: ['Heaps', 'Streaming & State'],
      patterns: ['Bounded min-heap'],
      domains: ['Trading'],
      ...tag(dev('Exodus Point', 'streaming top-K with deterministic ties')),
      roles: DE,
      summary: 'Keep the k largest trades from a stream in O(k) memory, with a stable tie-break.',
      description: md('Trades arrive as `[trade_id, notional]`. Return the k largest by notional; ties go to the trade that **arrived first**. Output sorted by notional descending, then arrival. Keep only k items in memory.'),
      hints: ['A min-heap of `(notional, -arrival_index, id)`: the root is the weakest kept trade; replace it only when a new one is strictly better.'],
      entry: 'top_trades',
      signature: 'top_trades(trades: list[list], k: int) -> list[str]',
      solution: code`import heapq

def top_trades(trades: list[list], k: int) -> list[str]:
    heap = []
    for i, (tid, notional) in enumerate(trades):
        item = (notional, -i, tid)
        if len(heap) < k:
            heapq.heappush(heap, item)
        elif k and item > heap[0]:
            heapq.heapreplace(heap, item)
    return [tid for _, _, tid in sorted(heap, reverse=True)]
`,
      explanation: md('Encoding the tie-break in the tuple (`-arrival`, so earlier arrivals compare larger) makes ordering total and deterministic — vital when two runs of a job must agree. O(n log k).'),
      tests: [
        ex('Example', [['a', 50], ['b', 90], ['c', 50], ['d', 70]], 3),
        ex('Ties keep the earlier trade', [['x', 10], ['y', 10]], 1),
        hid('k = 0', [['a', 1]], 0),
        hid('k larger than stream', [['a', 1], ['b', 2]], 5),
      ],
    }),

    python({
      id: 'kth-largest-heap',
      title: 'The N-th Highest Value with a Heap',
      difficulty: 'Easy',
      topics: ['Heaps'],
      patterns: ['Size-k min-heap'],
      domains: ['E-commerce / Sales'],
      ...tag(gfg('Flipkart', 'Nth highest element from an array using a heap')),
      roles: DE,
      summary: 'Find the n-th largest order value (duplicates count) without sorting everything.',
      description: md('Return the n-th largest value in `values` (duplicates count separately), or `None` if there are fewer than n values.'),
      hints: ['Keep a min-heap of the n largest seen; its root is the answer.'],
      entry: 'nth_largest',
      signature: 'nth_largest(values: list[int], n: int)',
      solution: code`import heapq

def nth_largest(values: list[int], n: int):
    if n < 1 or len(values) < n:
        return None
    heap = values[:n]
    heapq.heapify(heap)
    for v in values[n:]:
        if v > heap[0]:
            heapq.heapreplace(heap, v)
    return heap[0]
`,
      explanation: md('O(m log n) time and O(n) memory — good when n is small and the data is a stream. Quickselect averages O(m).'),
      tests: [
        ex('Example', [3, 2, 1, 5, 6, 4], 2),
        ex('Duplicates count', [3, 3, 3, 1], 3),
        hid('Too few values', [1], 2),
        hid('First largest', [7, 9, 2], 1),
      ],
    }),

    python({
      id: 'running-median',
      title: 'Running Median of a Latency Stream',
      difficulty: 'Hard',
      topics: ['Heaps', 'Streaming & State'],
      patterns: ['Two heaps'],
      domains: ['Platform / Ops'],
      ...tag(gfg('Goldman Sachs', 'median of a stream of running integers')),
      roles: DE,
      summary: 'Report the median after every new latency sample in O(log n) per sample.',
      description: md('After each value in `stream`, record the median so far (mean of the two middle values when the count is even), as a number.'),
      hints: ['A max-heap (negated) for the lower half and a min-heap for the upper half, balanced so the lower half has the extra element.'],
      entry: 'running_median',
      signature: 'running_median(stream: list[int]) -> list[float]',
      solution: code`import heapq

def running_median(stream: list[int]) -> list[float]:
    low, high, out = [], [], []
    for x in stream:
        heapq.heappush(low, -x)
        heapq.heappush(high, -heapq.heappop(low))
        if len(high) > len(low):
            heapq.heappush(low, -heapq.heappop(high))
        out.append(-low[0] if len(low) > len(high) else (-low[0] + high[0]) / 2)
    return out
`,
      explanation: md('Pushing through `low` into `high` keeps every low element ≤ every high element; rebalancing keeps sizes within one. The median is then at the heap tops. O(log n) per value versus re-sorting.'),
      tests: [
        ex('Example', [5, 15, 1, 3]),
        ex('Single value', [7]),
        hid('Sorted input', [1, 2, 3, 4, 5]),
        hid('Duplicates and negatives', [-1, -1, 4, 4]),
      ],
    }),

    python({
      id: 'minimum-platforms',
      title: 'Minimum Platforms (Max Concurrent Intervals)',
      difficulty: 'Medium',
      topics: ['Intervals & Sessions', 'Sorting'],
      patterns: ['Sweep line'],
      domains: ['Logistics'],
      ...tag(gfg('Goldman Sachs', 'minimum number of platforms required for a railway station')),
      roles: DE,
      summary: 'Find how many platforms a station needs so no train waits.',
      description: md('Trains are `[arrival, departure]` (minutes, departure ≥ arrival). A platform freed at time t **cannot** be reused by a train arriving at t. Return the minimum number of platforms.'),
      hints: ['Sort arrivals and departures separately; walk them with two pointers, counting trains present.'],
      entry: 'platforms',
      signature: 'platforms(trains: list[list[int]]) -> int',
      solution: code`def platforms(trains: list[list[int]]) -> int:
    arr = sorted(a for a, _ in trains)
    dep = sorted(d for _, d in trains)
    i = j = cur = best = 0
    while i < len(arr):
        if arr[i] <= dep[j]:
            cur += 1
            i += 1
            best = max(best, cur)
        else:
            cur -= 1
            j += 1
    return best
`,
      explanation: md('The answer is the peak number of overlapping intervals. Using `<=` processes an arrival before a departure at the same time, which encodes the "can\'t reuse at t" rule.'),
      tests: [
        ex('Example', [[900, 910], [940, 1200], [950, 1120], [1100, 1130], [1500, 1900], [1800, 2000]]),
        ex('Touching intervals still conflict', [[10, 20], [20, 30]]),
        hid('No trains', []),
        hid('Nested', [[0, 100], [10, 20], [30, 40]]),
      ],
    }),

    python({
      id: 'meeting-room-assignment',
      title: 'No Vacancy: Assign Meetings to Rooms',
      difficulty: 'Medium',
      topics: ['Heaps', 'Intervals & Sessions'],
      patterns: ['Earliest-free resource heap'],
      domains: ['Scheduling'],
      ...tag(ddp('Uber', 'No Vacancy')),
      roles: DE,
      summary: 'Assign each meeting to the lowest-numbered free room, delaying it if none is free.',
      description: md('There are `n` rooms (0..n−1). Meetings `[start, end]` are processed by start time. Each goes to the lowest-numbered free room at its start; if none is free it waits for the room that frees earliest (lowest number on ties) and keeps its duration. Return the room that held the most meetings (lowest number on ties).'),
      hints: ['Two heaps: free room numbers, and `(free_at, room)` for busy rooms.'],
      entry: 'busiest_room',
      signature: 'busiest_room(n: int, meetings: list[list[int]]) -> int',
      solution: code`import heapq

def busiest_room(n: int, meetings: list[list[int]]) -> int:
    free = list(range(n))
    busy = []
    count = [0] * n
    for start, end in sorted(meetings):
        while busy and busy[0][0] <= start:
            heapq.heappush(free, heapq.heappop(busy)[1])
        if free:
            room = heapq.heappop(free)
            heapq.heappush(busy, (end, room))
        else:
            free_at, room = heapq.heappop(busy)
            heapq.heappush(busy, (free_at + end - start, room))
        count[room] += 1
    return max(range(n), key=lambda r: (count[r], -r))
`,
      explanation: md('Rooms that freed before a meeting starts move back to the free heap, so the "lowest number" rule is a heap pop. Delayed meetings keep their length. O(m log n).'),
      tests: [
        ex('Example', 2, [[0, 10], [1, 5], [2, 7], [3, 4]]),
        ex('Three rooms', 3, [[1, 20], [2, 10], [3, 5], [4, 9], [6, 8]]),
        hid('Single room', 1, [[0, 1], [0, 1]]),
        hid('No meetings', 2, []),
      ],
    }),

    python({
      id: 'grid-shortest-path',
      title: 'Shortest Path Through a Warehouse Grid',
      difficulty: 'Medium',
      topics: ['Graphs (BFS / DFS)', 'Matrices'],
      patterns: ['BFS on a grid'],
      domains: ['Logistics'],
      ...tag(dev('Walmart', 'BFS on a grid for shortest paths'), dev('Uber', 'shortest path in a grid')),
      roles: DE,
      summary: 'Count the fewest moves from top-left to bottom-right, avoiding shelves.',
      description: md('`grid` rows are strings of `.` (open) and `#` (shelf). Moving up/down/left/right, return the fewest moves from the top-left to the bottom-right cell, or `-1`.'),
      hints: ['BFS from the start; the first time you reach the goal is the shortest distance.'],
      entry: 'shortest_path',
      signature: 'shortest_path(grid: list[str]) -> int',
      solution: code`from collections import deque

def shortest_path(grid: list[str]) -> int:
    rows, cols = len(grid), len(grid[0])
    if grid[0][0] == "#" or grid[-1][-1] == "#":
        return -1
    dist = {(0, 0): 0}
    q = deque([(0, 0)])
    while q:
        r, c = q.popleft()
        if (r, c) == (rows - 1, cols - 1):
            return dist[(r, c)]
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] == "." and (nr, nc) not in dist:
                dist[(nr, nc)] = dist[(r, c)] + 1
                q.append((nr, nc))
    return -1
`,
      explanation: md('BFS explores in rings of equal distance, so on an unweighted grid the first arrival is optimal. Marking cells when **enqueued** (not when dequeued) avoids duplicate work.'),
      tests: [
        ex('Example', ['..#', '#..', '...']),
        ex('Blocked', ['.#', '#.']),
        hid('Single cell', ['.']),
        hid('Start blocked', ['#.', '..']),
      ],
    }),

    python({
      id: 'min-route-transfers',
      title: 'Minimum Hops Through Routes',
      difficulty: 'Medium',
      topics: ['Graphs (BFS / DFS)', 'Dicts & Sets'],
      patterns: ['BFS over routes'],
      domains: ['Mobility / Ride-hailing'],
      ...tag(dev('Uber', 'minimum hops through routes')),
      roles: DE,
      summary: 'Fewest shuttle routes needed to get from one stop to another.',
      description: md('Each route is a list of stops it serves (you can ride between any two stops on a route). Return the minimum number of routes to board to get from `source` to `target` (0 if equal), or `-1`.'),
      hints: ['BFS where each level boards a new route; index stop → routes, and never revisit a route.'],
      entry: 'min_routes',
      signature: 'min_routes(routes: list[list[int]], source: int, target: int) -> int',
      solution: code`from collections import deque

def min_routes(routes: list[list[int]], source: int, target: int) -> int:
    if source == target:
        return 0
    by_stop = {}
    for i, r in enumerate(routes):
        for s in r:
            by_stop.setdefault(s, []).append(i)
    used, seen = set(), {source}
    q = deque([(source, 0)])
    while q:
        stop, n = q.popleft()
        for ri in by_stop.get(stop, []):
            if ri in used:
                continue
            used.add(ri)
            for s in routes[ri]:
                if s == target:
                    return n + 1
                if s not in seen:
                    seen.add(s)
                    q.append((s, n + 1))
    return -1
`,
      explanation: md('The graph\'s "edges" are routes, not stop-to-stop hops; expanding a whole route at once and never reusing it keeps BFS linear in the input size.'),
      tests: [
        ex('Example', [[1, 2, 7], [3, 6, 7]], 1, 6),
        ex('Unreachable', [[1, 2], [3, 4]], 1, 4),
        hid('Same stop', [[1]], 1, 1),
        hid('Single route', [[5, 9, 2]], 5, 2),
      ],
    }),

    python({
      id: 'union-find-components',
      title: 'Group Accounts That Share Devices',
      difficulty: 'Medium',
      topics: ['Graphs (BFS / DFS)', 'Hash Maps & Counting'],
      patterns: ['Union-find'],
      domains: ['Networking / Security'],
      ...tag(dev('Databricks', 'hash tables for counting and graph state')),
      roles: DE,
      summary: 'Link accounts seen on the same device and report the connected groups.',
      description: md('Each login is `[account, device]`. Accounts that used a common device (directly or through a chain) belong to one group. Return the groups as sorted lists of accounts, ordered by size descending then first account.'),
      hints: ['Union every account with the first account seen on each device; then collect by root.'],
      entry: 'account_groups',
      signature: 'account_groups(logins: list[list[str]]) -> list[list[str]]',
      solution: code`def account_groups(logins: list[list[str]]) -> list[list[str]]:
    parent = {}

    def find(x):
        parent.setdefault(x, x)
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    first_on_device = {}
    for account, device in logins:
        find(account)
        if device in first_on_device:
            parent[find(account)] = find(first_on_device[device])
        else:
            first_on_device[device] = account
    groups = {}
    for a in parent:
        groups.setdefault(find(a), []).append(a)
    return sorted((sorted(g) for g in groups.values()), key=lambda g: (-len(g), g[0]))
`,
      explanation: md('Union-find answers "are these connected?" in near-constant time with path compression — the core of identity resolution and fraud-ring detection.'),
      tests: [
        ex('Example', [['a', 'd1'], ['b', 'd1'], ['c', 'd2'], ['b', 'd3'], ['e', 'd3'], ['f', 'd9']]),
        ex('All separate', [['x', '1'], ['y', '2']]),
        hid('Empty', []),
        hid('Chain through devices', [['a', '1'], ['b', '1'], ['b', '2'], ['c', '2'], ['c', '3'], ['d', '3']]),
      ],
    }),

    python({
      id: 'dag-task-order',
      title: 'Order Pipeline Tasks (Topological Sort)',
      difficulty: 'Medium',
      topics: ['Graphs (BFS / DFS)'],
      patterns: ['Kahn\'s algorithm'],
      domains: ['Orchestration'],
      roles: DE,
      summary: 'Produce a run order for DAG tasks, alphabetical among ready tasks, or detect a cycle.',
      description: md('`deps` maps task → list of upstream tasks it depends on (every task appears as a key). Return a valid run order, always choosing the alphabetically smallest ready task, or `["CYCLE", ...sorted tasks that can never run]`.'),
      hints: ['Count in-degrees; a min-heap of ready tasks gives the alphabetical rule.'],
      entry: 'run_order',
      signature: 'run_order(deps: dict[str, list[str]]) -> list[str]',
      solution: code`import heapq

def run_order(deps: dict[str, list[str]]) -> list[str]:
    indegree = {t: len(set(up)) for t, up in deps.items()}
    children = {t: [] for t in deps}
    for t, ups in deps.items():
        for u in set(ups):
            children[u].append(t)
    ready = [t for t, d in indegree.items() if d == 0]
    heapq.heapify(ready)
    order = []
    while ready:
        t = heapq.heappop(ready)
        order.append(t)
        for c in children[t]:
            indegree[c] -= 1
            if indegree[c] == 0:
                heapq.heappush(ready, c)
    if len(order) < len(deps):
        return ["CYCLE"] + sorted(t for t in deps if t not in order)
    return order
`,
      explanation: md('This is what Airflow, dbt and Make do: run whatever has all upstreams done. Tasks left with non-zero in-degree are on (or behind) a cycle.'),
      tests: [
        ex('Example', { extract: [], clean: ['extract'], dim: ['extract'], fact: ['clean', 'dim'], report: ['fact'] }),
        ex('Cycle', { a: ['b'], b: ['a'], c: [] }),
        hid('Independent tasks alphabetical', { z: [], m: [], a: [] }),
        hid('Downstream of a cycle', { a: ['b'], b: ['a'], c: ['a'] }),
      ],
    }),

    python({
      id: 'mirror-symmetric-tree',
      title: 'Is the Tree a Mirror of Itself?',
      difficulty: 'Easy',
      topics: ['Trees', 'Recursion'],
      patterns: ['Paired recursion'],
      domains: ['Developer tools'],
      ...tag(dev('Uber', 'trees: mirror symmetry (values)')),
      roles: DE,
      summary: 'Check symmetry of a binary tree given in level order with nulls.',
      description: md('The tree is given in level order (`null` for missing children, like LeetCode\'s format: children listed only for present nodes). Return whether it is symmetric around its centre.'),
      hints: ['Build nodes from the list with a queue, then compare `left.left` with `right.right` and `left.right` with `right.left` recursively.'],
      entry: 'is_symmetric',
      signature: 'is_symmetric(level_order: list) -> bool',
      solution: code`from collections import deque

def _build(vals):
    if not vals or vals[0] is None:
        return None
    root = [vals[0], None, None]
    q, i = deque([root]), 1
    while q and i < len(vals):
        node = q.popleft()
        for side in (1, 2):
            if i < len(vals) and vals[i] is not None:
                node[side] = [vals[i], None, None]
                q.append(node[side])
            i += 1
    return root

def is_symmetric(level_order: list) -> bool:
    def mirror(a, b):
        if a is None or b is None:
            return a is b
        return a[0] == b[0] and mirror(a[1], b[2]) and mirror(a[2], b[1])
    root = _build(level_order)
    return root is None or mirror(root[1], root[2])
`,
      explanation: md('Symmetry compares two subtrees in mirrored order at once. Building the tree from a level-order list is a skill on its own — a queue of nodes waiting for children.'),
      tests: [
        ex('Example', [1, 2, 2, 3, 4, 4, 3]),
        ex('Asymmetric', [1, 2, 2, null, 3, null, 3]),
        hid('Empty tree', []),
        hid('Single node', [9]),
      ],
    }),

    python({
      id: 'lowest-common-manager',
      title: 'Lowest Common Manager',
      difficulty: 'Medium',
      topics: ['Trees', 'Dicts & Sets'],
      patterns: ['Ancestor set'],
      domains: ['HR / People'],
      ...tag(gfg('Flipkart', 'lowest common ancestor in a binary tree')),
      roles: DE,
      summary: 'Find the closest shared manager of two employees from a parent map.',
      description: md('`manager` maps employee → manager (the CEO has no entry). For each pair `[a, b]`, return their lowest common manager — the deepest person who is (or manages, directly or indirectly) both. A person counts as their own ancestor.'),
      hints: ['Collect all ancestors of `a` (including `a`) in a set, then walk up from `b` until you hit one.'],
      entry: 'common_managers',
      signature: 'common_managers(manager: dict[str, str], pairs: list[list[str]]) -> list[str]',
      solution: code`def common_managers(manager: dict[str, str], pairs: list[list[str]]) -> list[str]:
    out = []
    for a, b in pairs:
        ancestors = set()
        while a is not None:
            ancestors.add(a)
            a = manager.get(a)
        while b not in ancestors:
            b = manager[b]
        out.append(b)
    return out
`,
      explanation: md('With parent pointers, LCA is "first ancestor of b that is also an ancestor of a" — O(depth). Binary lifting answers many queries in O(log n) each.'),
      tests: [
        ex('Example', { vp: 'ceo', cto: 'ceo', m1: 'vp', m2: 'vp', e1: 'm1', e2: 'm2', e3: 'cto' }, [['e1', 'e2'], ['e1', 'e3'], ['m1', 'e1']]),
        ex('Same person', { a: 'b' }, [['a', 'a']]),
        hid('CEO with anyone', { x: 'ceo' }, [['ceo', 'x']]),
        hid('Deep chain', { b: 'a', c: 'b', d: 'c', e: 'b' }, [['d', 'e'], ['e', 'd']]),
      ],
    }),

    python({
      id: 'line-diff-lcs',
      title: 'Write the Logic of git diff',
      difficulty: 'Hard',
      topics: ['Dynamic Programming', 'Strings'],
      patterns: ['Longest common subsequence'],
      domains: ['Developer tools'],
      ...tag(gfg('Goldman Sachs', 'write the logic for the "git diff" command')),
      roles: DE,
      summary: 'Produce a minimal line diff (" ", "-", "+") between two file versions using LCS.',
      description: md('Return a diff of `old` → `new` (lists of lines) as strings `"  line"` (unchanged), `"- line"` (removed) and `"+ line"` (added), keeping as many lines unchanged as possible (an LCS). When there\'s a choice, output removals before additions.'),
      hints: ['Fill an LCS table from the end: `L[i][j]` = LCS length of `old[i:]`, `new[j:]`.', 'Walk forward: equal lines → keep; else remove if `L[i+1][j] >= L[i][j+1]`, otherwise add.'],
      entry: 'diff',
      signature: 'diff(old: list[str], new: list[str]) -> list[str]',
      solution: code`def diff(old: list[str], new: list[str]) -> list[str]:
    n, m = len(old), len(new)
    L = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n - 1, -1, -1):
        for j in range(m - 1, -1, -1):
            L[i][j] = L[i + 1][j + 1] + 1 if old[i] == new[j] else max(L[i + 1][j], L[i][j + 1])
    out, i, j = [], 0, 0
    while i < n and j < m:
        if old[i] == new[j]:
            out.append("  " + old[i]); i += 1; j += 1
        elif L[i + 1][j] >= L[i][j + 1]:
            out.append("- " + old[i]); i += 1
        else:
            out.append("+ " + new[j]); j += 1
    out += ["- " + x for x in old[i:]] + ["+ " + x for x in new[j:]]
    return out
`,
      explanation: md('A minimal diff keeps a longest common subsequence of lines; everything else is a deletion or insertion. O(n·m) time and space — real `git diff` uses Myers\' O((n+m)·d) algorithm, but the LCS formulation is the interview answer.'),
      tests: [
        ex('Example', ['a', 'b', 'c', 'd'], ['a', 'c', 'd', 'e']),
        ex('Identical', ['x'], ['x']),
        hid('Everything changed', ['p', 'q'], ['r']),
        hid('Empty old file', [], ['n1', 'n2']),
      ],
    }),

    python({
      id: 'word-search-grid',
      title: 'Find a Code in a Letter Grid',
      difficulty: 'Hard',
      topics: ['Graphs (BFS / DFS)', 'Recursion', 'Matrices'],
      patterns: ['Backtracking DFS'],
      domains: ['Gaming'],
      ...tag(dlp('Apple', 'Word Search')),
      roles: DE,
      summary: 'Decide whether each word can be traced through adjacent cells without reusing a cell.',
      description: md('`grid` is a list of equal-length strings. For each word, return whether it can be spelled by moving up/down/left/right between cells, using each cell at most once per word.'),
      hints: ['DFS from every cell matching the first letter; mark the cell as used while exploring, unmark when backtracking.'],
      entry: 'find_words',
      signature: 'find_words(grid: list[str], words: list[str]) -> list[bool]',
      solution: code`def find_words(grid: list[str], words: list[str]) -> list[bool]:
    rows, cols = len(grid), len(grid[0]) if grid else 0

    def found(word):
        used = set()

        def dfs(r, c, k):
            if k == len(word):
                return True
            if not (0 <= r < rows and 0 <= c < cols) or (r, c) in used or grid[r][c] != word[k]:
                return False
            used.add((r, c))
            ok = any(dfs(r + dr, c + dc, k + 1) for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            used.discard((r, c))
            return ok

        return any(dfs(r, c, 0) for r in range(rows) for c in range(cols))

    return [found(w) for w in words]
`,
      explanation: md('Backtracking explores a path, and undoes its marks on the way back so other paths can use those cells. Worst case is exponential in word length, which is why the multi-word version builds a trie.'),
      tests: [
        ex('Example', ['ABCE', 'SFCS', 'ADEE'], ['ABCCED', 'SEE', 'ABCB']),
        ex('Single cell', ['A'], ['A', 'AA']),
        hid('Snake path', ['AB', 'DC'], ['ABCD', 'ACBD']),
        hid('Cell reuse is not allowed', ['AB'], ['ABA', 'BA']),
      ],
    }),
  ],
};
