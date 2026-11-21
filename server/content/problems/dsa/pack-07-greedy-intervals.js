// DSA pack 07 — greedy & intervals: activity selection, minimum platforms,
// deadline scheduling, fractional knapsack, coin greedy, jump game I/II,
// gas station, candy, assign cookies, lemonade change, merge / insert
// intervals, erase overlaps, arrows, valid wildcard parentheses.
import { dsa, md, code, ex, hid } from './define.js';

export default {
  problems: [
    dsa({
      id: 'dsa-max-meetings-one-room',
      title: 'Fit the Most Meetings in One Room',
      difficulty: 'Easy',
      topics: ['Greedy', 'Intervals', 'Sorting'],
      patterns: ['Earliest finish first'],
      summary: 'Select the maximum number of non-overlapping meetings (activity selection).',
      description: md('Meeting i runs from `start[i]` to `end[i]`; a meeting may begin only strictly after the previous one ends. Return the 1-based indices of a maximum set chosen by earliest end time (ties: lower index), in the order they are held.'),
      hints: ['Sort by (end, index); take a meeting if it starts after the last chosen end.'],
      signature: 'max_meetings(start: list[int], end: list[int]) -> list[int]',
      solution: code`def max_meetings(start: list[int], end: list[int]) -> list[int]:
    order = sorted(range(len(start)), key=lambda i: (end[i], i))
    chosen, last = [], float("-inf")
    for i in order:
        if start[i] > last:
            chosen.append(i + 1)
            last = end[i]
    return chosen
`,
      explanation: md('The meeting that ends earliest leaves the most room for the rest — an exchange argument proves the greedy choice is always safe. O(n log n).'),
      tests: [
        ex('Example', [1, 3, 0, 5, 8, 5], [2, 4, 6, 7, 9, 9]),
        ex('All overlap', [1, 1, 1], [5, 5, 5]),
        hid('Touching ends conflict', [1, 2, 3], [2, 3, 4]),
        hid('Empty', [], []),
      ],
    }),

    dsa({
      id: 'dsa-min-stations',
      title: 'Fewest Platforms for a Train Timetable',
      difficulty: 'Medium',
      topics: ['Greedy', 'Intervals', 'Sorting'],
      patterns: ['Sweep sorted arrivals and departures'],
      summary: 'Minimum platforms so no train waits (a departure at time t frees the platform after arrivals at t).',
      description: md('Given arrival and departure times (HHMM integers), return the minimum number of platforms needed. A train arriving at the same minute another departs still needs its own platform.'),
      hints: ['Sort both lists; advance arrivals when arr[i] <= dep[j], else free a platform.'],
      signature: 'min_platforms(arr: list[int], dep: list[int]) -> int',
      solution: code`def min_platforms(arr: list[int], dep: list[int]) -> int:
    a, d = sorted(arr), sorted(dep)
    i = j = cur = best = 0
    while i < len(a):
        if a[i] <= d[j]:
            cur += 1
            best = max(best, cur)
            i += 1
        else:
            cur -= 1
            j += 1
    return best
`,
      explanation: md('Only the order of events matters, not which train is which; merging the two sorted lists counts concurrent trains. O(n log n).'),
      tests: [
        ex('Example', [900, 940, 950, 1100, 1500, 1800], [910, 1200, 1120, 1130, 1900, 2000]),
        ex('Same minute', [900, 1000], [1000, 1100]),
        hid('Single', [1200], [1230]),
        hid('All at once', [1000, 1000, 1000], [1100, 1100, 1100]),
      ],
    }),

    dsa({
      id: 'dsa-deadline-jobs',
      title: 'Schedule Jobs Before Their Deadlines for Max Profit',
      difficulty: 'Medium',
      topics: ['Greedy', 'Sorting'],
      patterns: ['Highest profit into latest free slot'],
      summary: 'Unit-time jobs with deadlines and profits — maximise profit.',
      description: md('Each job `[id, deadline, profit]` takes one time unit and must finish by its deadline. Return `[jobs_done, total_profit]`.'),
      hints: ['Sort by profit descending; put each job in the latest free slot ≤ its deadline (a DSU makes finding it fast).'],
      signature: 'job_sequencing(jobs: list[list[int]]) -> list[int]',
      solution: code`def job_sequencing(jobs: list[list[int]]) -> list[int]:
    if not jobs:
        return [0, 0]
    max_d = max(d for _, d, _ in jobs)
    parent = list(range(max_d + 1))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    done = profit = 0
    for _, d, p in sorted(jobs, key=lambda j: -j[2]):
        slot = find(d)
        if slot > 0:
            parent[slot] = slot - 1
            done += 1
            profit += p
    return [done, profit]
`,
      explanation: md('Taking the most profitable jobs first and placing them as late as possible keeps early slots open. The DSU "next free slot" trick makes it O(n log n) overall.'),
      tests: [
        ex('Example', [[1, 4, 20], [2, 1, 10], [3, 1, 40], [4, 1, 30]]),
        ex('Another', [[1, 2, 100], [2, 1, 19], [3, 2, 27], [4, 1, 25], [5, 1, 15]]),
        hid('All fit', [[1, 3, 5], [2, 3, 5], [3, 3, 5]]),
        hid('Empty', []),
      ],
    }),

    dsa({
      id: 'dsa-fractional-knapsack',
      title: 'Fill a Bag When Items Can Be Split',
      difficulty: 'Medium',
      topics: ['Greedy', 'Sorting'],
      patterns: ['Best value density first'],
      summary: 'Maximise value with capacity W when fractions of items are allowed.',
      description: md('Items are `[value, weight]`. You may take any fraction of an item. Return the maximum total value for capacity `W`, rounded to 2 decimals.'),
      hints: ['Sort by value/weight descending, take whole items while they fit, then a fraction of the next.'],
      signature: 'fractional_knapsack(items: list[list[int]], W: int) -> float',
      solution: code`def fractional_knapsack(items: list[list[int]], W: int) -> float:
    total = 0.0
    for v, w in sorted(items, key=lambda it: it[0] / it[1], reverse=True):
        if W <= 0:
            break
        take = min(w, W)
        total += v * take / w
        W -= take
    return round(total, 2)
`,
      explanation: md('With divisible items the greedy by density is optimal; for 0/1 items it is not (that needs DP).'),
      tests: [
        ex('Example', [[60, 10], [100, 20], [120, 30]], 50),
        ex('Everything fits', [[10, 1], [20, 2]], 10),
        hid('Zero capacity', [[5, 5]], 0),
        hid('Partial first item', [[100, 50]], 20),
      ],
    }),

    dsa({
      id: 'dsa-greedy-change',
      title: 'Fewest Notes for an Amount (Canonical Currency)',
      difficulty: 'Easy',
      topics: ['Greedy'],
      patterns: ['Largest denomination first'],
      summary: 'Break an amount into the fewest notes and coins of a canonical system.',
      description: md('Using denominations `1, 2, 5, 10, 20, 50, 100, 200, 500, 2000`, return the list of notes (largest first) for each amount.'),
      hints: ['For canonical systems greedy is optimal; for arbitrary ones (e.g. 1, 3, 4) it is not — use DP.'],
      signature: 'make_change(amounts: list[int]) -> list[list[int]]',
      solution: code`DENOMS = [2000, 500, 200, 100, 50, 20, 10, 5, 2, 1]

def make_change(amounts: list[int]) -> list[list[int]]:
    out = []
    for a in amounts:
        notes = []
        for d in DENOMS:
            k, a = divmod(a, d)
            notes += [d] * k
        out.append(notes)
    return out
`,
      explanation: md('Greedy works because each denomination is "large enough" relative to smaller ones. Knowing when it fails (coin change with 1, 3, 4 for 6) is the real interview point.'),
      tests: [
        ex('Example', [49, 2121]),
        ex('Zero', [0]),
        hid('Round', [500, 7]),
        hid('Large', [5888]),
      ],
    }),

    dsa({
      id: 'dsa-reach-the-end',
      title: 'Can You Reach the Last Square? And in How Few Jumps?',
      difficulty: 'Medium',
      topics: ['Greedy', 'Arrays'],
      patterns: ['Farthest reach / BFS levels'],
      summary: 'Jump game I and II together.',
      description: md('`jumps[i]` is the maximum jump length from index i. Return `[reachable, min_jumps]` where `min_jumps` is the fewest jumps to reach the last index (−1 if unreachable).'),
      hints: ['Track the farthest index reachable; for the count, treat indices reachable in k jumps as a BFS level.'],
      signature: 'jump_game(jumps: list[int]) -> list',
      solution: code`def jump_game(jumps: list[int]) -> list:
    n = len(jumps)
    count, cur_end, far = 0, 0, 0
    for i in range(n - 1):
        if i > far:
            return [False, -1]
        far = max(far, i + jumps[i])
        if i == cur_end:
            count += 1
            cur_end = far
    if far < n - 1 and n > 1:
        return [False, -1]
    return [True, count]
`,
      explanation: md('Each "level" (the window reachable with k jumps) ends at cur_end; crossing it costs one jump. O(n), O(1).'),
      tests: [
        ex('Example', [2, 3, 1, 1, 4]),
        ex('Stuck', [3, 2, 1, 0, 4]),
        hid('Single', [0]),
        hid('Long first jump', [5, 1, 1, 1, 1, 1]),
      ],
    }),

    dsa({
      id: 'dsa-fuel-loop',
      title: 'Where to Start a Circular Fuel Route',
      difficulty: 'Medium',
      topics: ['Greedy', 'Arrays'],
      patterns: ['Reset start when the tank goes negative'],
      summary: 'Find the unique station from which a full loop is possible.',
      description: md('Station i gives `gas[i]` fuel; driving to station i + 1 costs `cost[i]`. Return the starting index that lets you complete the circuit once, or −1.'),
      hints: ['If total gas < total cost, impossible. Otherwise, when the running tank drops below 0 at i, no start ≤ i works — start at i + 1.'],
      signature: 'gas_station(gas: list[int], cost: list[int]) -> int',
      solution: code`def gas_station(gas: list[int], cost: list[int]) -> int:
    if sum(gas) < sum(cost):
        return -1
    tank, start = 0, 0
    for i in range(len(gas)):
        tank += gas[i] - cost[i]
        if tank < 0:
            tank, start = 0, i + 1
    return start
`,
      explanation: md('Any start inside a failing stretch would arrive at the failure point with even less fuel, so skipping the whole stretch is safe. O(n).'),
      tests: [
        ex('Example', [1, 2, 3, 4, 5], [3, 4, 5, 1, 2]),
        ex('Impossible', [2, 3, 4], [3, 4, 3]),
        hid('Start at zero', [5, 1], [1, 2]),
        hid('Single', [3], [3]),
      ],
    }),

    dsa({
      id: 'dsa-candy-ratings',
      title: 'Hand Out the Fewest Candies by Rating',
      difficulty: 'Hard',
      topics: ['Greedy', 'Arrays'],
      patterns: ['Two passes (left and right constraints)'],
      summary: 'Each child gets ≥ 1, and more than any neighbour with a lower rating.',
      description: md('Return the minimum total candies so that every child gets at least one and each child with a higher rating than an adjacent child gets more candies than that neighbour.'),
      hints: ['Left-to-right for the left neighbour constraint, right-to-left for the right one, take the max.'],
      signature: 'candy(ratings: list[int]) -> int',
      solution: code`def candy(ratings: list[int]) -> int:
    n = len(ratings)
    c = [1] * n
    for i in range(1, n):
        if ratings[i] > ratings[i - 1]:
            c[i] = c[i - 1] + 1
    for i in range(n - 2, -1, -1):
        if ratings[i] > ratings[i + 1]:
            c[i] = max(c[i], c[i + 1] + 1)
    return sum(c)
`,
      explanation: md('Each pass satisfies one side’s constraints; taking the max satisfies both minimally. O(n).'),
      tests: [
        ex('Example', [1, 0, 2]),
        ex('Plateau', [1, 2, 2]),
        hid('Decreasing', [5, 4, 3, 2, 1]),
        hid('Mountain', [1, 3, 4, 5, 2]),
      ],
    }),

    dsa({
      id: 'dsa-feed-children',
      title: 'Satisfy the Most Children with Cookies',
      difficulty: 'Easy',
      topics: ['Greedy', 'Sorting', 'Two Pointers'],
      patterns: ['Smallest sufficient match'],
      summary: 'Each child needs a cookie at least as big as their greed factor.',
      description: md('Return how many children can be satisfied, giving each at most one cookie of size ≥ their greed.'),
      hints: ['Sort both; give the smallest cookie that satisfies the least greedy child.'],
      signature: 'content_children(greed: list[int], sizes: list[int]) -> int',
      solution: code`def content_children(greed: list[int], sizes: list[int]) -> int:
    g, s = sorted(greed), sorted(sizes)
    i = 0
    for size in s:
        if i < len(g) and size >= g[i]:
            i += 1
    return i
`,
      explanation: md('Matching small cookies to small greed never wastes a big cookie. O(n log n).'),
      tests: [
        ex('Example', [1, 2, 3], [1, 1]),
        ex('Everyone', [1, 2], [1, 2, 3]),
        hid('No cookies', [1], []),
        hid('Big greed', [10, 9], [1, 2, 8]),
      ],
    }),

    dsa({
      id: 'dsa-exact-change-stand',
      title: 'Can the Lemonade Stand Always Give Change?',
      difficulty: 'Easy',
      topics: ['Greedy'],
      patterns: ['Prefer larger notes for change'],
      summary: 'Lemonade costs 5; customers pay with 5, 10 or 20 in order.',
      description: md('Starting with no money, each customer buys one lemonade for 5 and pays with the given bill. For each queue return whether everyone gets correct change.'),
      hints: ['For a 20, give 10 + 5 when possible (save 5s), else 5 + 5 + 5.'],
      signature: 'lemonade(queues: list[list[int]]) -> list[bool]',
      solution: code`def lemonade(queues: list[list[int]]) -> list[bool]:
    out = []
    for bills in queues:
        fives = tens = 0
        ok = True
        for b in bills:
            if b == 5:
                fives += 1
            elif b == 10:
                if not fives:
                    ok = False
                    break
                fives, tens = fives - 1, tens + 1
            else:
                if tens and fives:
                    tens, fives = tens - 1, fives - 1
                elif fives >= 3:
                    fives -= 3
                else:
                    ok = False
                    break
        out.append(ok)
    return out
`,
      explanation: md('5s are the most versatile change, so spend a 10 first whenever possible.'),
      tests: [
        ex('Example', [[5, 5, 5, 10, 20], [5, 5, 10, 10, 20]]),
        ex('First pays ten', [[10]]),
        hid('Three fives for a twenty', [[5, 5, 5, 20], [5, 20]]),
        hid('Empty queue', [[]]),
      ],
    }),

    dsa({
      id: 'dsa-merge-overlaps',
      title: 'Merge Overlapping Booking Windows',
      difficulty: 'Medium',
      topics: ['Intervals', 'Sorting'],
      patterns: ['Sort by start, extend the last'],
      summary: 'Collapse overlapping (or touching) intervals.',
      description: md('Merge all overlapping intervals (touching ends like `[1, 4]` and `[4, 5]` merge) and return them sorted by start.'),
      hints: ['Sort by start; if the next starts ≤ last end, extend; else append.'],
      signature: 'merge_intervals(intervals: list[list[int]]) -> list[list[int]]',
      solution: code`def merge_intervals(intervals: list[list[int]]) -> list[list[int]]:
    out = []
    for s, e in sorted(intervals):
        if out and s <= out[-1][1]:
            out[-1][1] = max(out[-1][1], e)
        else:
            out.append([s, e])
    return out
`,
      explanation: md('After sorting, any overlap involves the most recent merged interval. O(n log n).'),
      tests: [
        ex('Example', [[1, 3], [2, 6], [8, 10], [15, 18]]),
        ex('Touching', [[1, 4], [4, 5]]),
        hid('Contained', [[1, 10], [2, 3], [4, 5]]),
        hid('Unsorted', [[5, 6], [1, 2], [2, 3]]),
      ],
    }),

    dsa({
      id: 'dsa-insert-interval',
      title: 'Insert a Window into a Sorted Schedule',
      difficulty: 'Medium',
      topics: ['Intervals'],
      patterns: ['Before / overlap / after'],
      summary: 'Insert one interval into sorted, non-overlapping intervals and merge as needed.',
      description: md('`intervals` are sorted and disjoint. Insert `new` and return the merged result.'),
      hints: ['Copy those ending before new starts; merge all that overlap; copy the rest.'],
      signature: 'insert_interval(intervals: list[list[int]], new: list[int]) -> list[list[int]]',
      solution: code`def insert_interval(intervals: list[list[int]], new: list[int]) -> list[list[int]]:
    out, i, n = [], 0, len(intervals)
    s, e = new
    while i < n and intervals[i][1] < s:
        out.append(intervals[i])
        i += 1
    while i < n and intervals[i][0] <= e:
        s, e = min(s, intervals[i][0]), max(e, intervals[i][1])
        i += 1
    out.append([s, e])
    out.extend(intervals[i:])
    return out
`,
      explanation: md('Three linear phases; no sort needed because the input is already ordered. O(n).'),
      tests: [
        ex('Example', [[1, 3], [6, 9]], [2, 5]),
        ex('Spans several', [[1, 2], [3, 5], [6, 7], [8, 10], [12, 16]], [4, 8]),
        hid('Into empty', [], [5, 7]),
        hid('At the end', [[1, 5]], [6, 8]),
      ],
    }),

    dsa({
      id: 'dsa-drop-fewest-overlaps',
      title: 'Remove the Fewest Intervals to Stop Overlaps',
      difficulty: 'Medium',
      topics: ['Intervals', 'Greedy'],
      patterns: ['Earliest finish first'],
      summary: 'Minimum removals so the rest are non-overlapping (touching is fine).',
      description: md('Return the minimum number of intervals to remove so that no two remaining intervals overlap; intervals that only touch (`[1, 2]`, `[2, 3]`) do not overlap.'),
      hints: ['Keep the maximum non-overlapping set by earliest end; removals = n − kept.'],
      signature: 'erase_overlaps(intervals: list[list[int]]) -> int',
      solution: code`def erase_overlaps(intervals: list[list[int]]) -> int:
    kept, last = 0, float("-inf")
    for s, e in sorted(intervals, key=lambda iv: iv[1]):
        if s >= last:
            kept += 1
            last = e
    return len(intervals) - kept
`,
      explanation: md('This is activity selection in disguise: maximising the kept set minimises removals.'),
      tests: [
        ex('Example', [[1, 2], [2, 3], [3, 4], [1, 3]]),
        ex('Identical', [[1, 2], [1, 2], [1, 2]]),
        hid('None needed', [[1, 2], [2, 3]]),
        hid('Nested', [[1, 100], [11, 22], [1, 11], [2, 12]]),
      ],
    }),

    dsa({
      id: 'dsa-min-arrows',
      title: 'Fewest Arrows to Pop Every Balloon',
      difficulty: 'Medium',
      topics: ['Intervals', 'Greedy'],
      patterns: ['Shoot at the earliest end'],
      summary: 'Balloons span [x1, x2]; an arrow at x pops all balloons covering x.',
      description: md('Return the minimum number of vertical arrows needed to burst all balloons (an arrow at x bursts every balloon with x1 ≤ x ≤ x2).'),
      hints: ['Sort by end; shoot at the end of the first unburst balloon.'],
      signature: 'min_arrows(points: list[list[int]]) -> int',
      solution: code`def min_arrows(points: list[list[int]]) -> int:
    arrows, last = 0, float("-inf")
    for s, e in sorted(points, key=lambda p: p[1]):
        if s > last:
            arrows += 1
            last = e
    return arrows
`,
      explanation: md('Interval stabbing: the earliest end is the best place to shoot because it covers every balloon that starts before it. O(n log n).'),
      tests: [
        ex('Example', [[10, 16], [2, 8], [1, 6], [7, 12]]),
        ex('Disjoint', [[1, 2], [3, 4], [5, 6], [7, 8]]),
        hid('Touching', [[1, 2], [2, 3], [3, 4], [4, 5]]),
        hid('Empty', []),
      ],
    }),

    dsa({
      id: 'dsa-wildcard-parens',
      title: 'Balanced Brackets When * Can Be Anything',
      difficulty: 'Medium',
      topics: ['Greedy', 'Strings'],
      patterns: ['Track a range of open counts'],
      summary: '"*" may be "(", ")" or empty — can the string be balanced?',
      description: md('For each string of `(`, `)` and `*` return whether some choice for every `*` makes it a balanced bracket string.'),
      hints: ['Keep the minimum and maximum possible number of open brackets; fail if max < 0; clamp min at 0; succeed if min == 0 at the end.'],
      signature: 'check_valid(strings: list[str]) -> list[bool]',
      solution: code`def check_valid(strings: list[str]) -> list[bool]:
    out = []
    for s in strings:
        lo = hi = 0
        ok = True
        for ch in s:
            if ch == "(":
                lo, hi = lo + 1, hi + 1
            elif ch == ")":
                lo, hi = lo - 1, hi - 1
            else:
                lo, hi = lo - 1, hi + 1
            if hi < 0:
                ok = False
                break
            lo = max(lo, 0)
        out.append(ok and lo == 0)
    return out
`,
      explanation: md('Instead of branching 3^k ways, track the interval of feasible open counts. O(n), O(1).'),
      tests: [
        ex('Example', ['()', '(*)', '(*))']),
        ex('Unbalanced', ['((*', ')*(']),
        hid('Stars only', ['', '***']),
        hid('Long', ['(((((*)))**', '((*)(*))((*']),
      ],
    }),

    dsa({
      id: 'dsa-shortest-job-first',
      title: 'Average Wait Under Shortest-Job-First',
      difficulty: 'Easy',
      topics: ['Greedy', 'Sorting'],
      patterns: ['Process short jobs first'],
      summary: 'All jobs arrive at time 0; run shortest first and report the average waiting time.',
      description: md('Return the average waiting time (floor division) when jobs with the given burst times all arrive at 0 and run one at a time, shortest first.'),
      hints: ['Waiting time of a job = sum of bursts before it.'],
      signature: 'sjf_average_wait(bursts: list[int]) -> int',
      solution: code`def sjf_average_wait(bursts: list[int]) -> int:
    if not bursts:
        return 0
    wait = elapsed = 0
    for b in sorted(bursts):
        wait += elapsed
        elapsed += b
    return wait // len(bursts)
`,
      explanation: md('Running short jobs first minimises total waiting time (an exchange argument), which is why SJF is optimal for average wait.'),
      tests: [
        ex('Example', [4, 3, 7, 1, 2]),
        ex('Single', [5]),
        hid('Equal', [2, 2, 2]),
        hid('Empty', []),
      ],
    }),
  ],
};
