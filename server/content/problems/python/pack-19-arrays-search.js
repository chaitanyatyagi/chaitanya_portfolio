// Python pack 19 — array interview patterns: sliding windows, prefix sums,
// Kadane, two pointers, hashing for top-k and pairs, and binary search
// (first/last position, k-th missing, interval lookup).
import { python, md, code, ex, hid } from './define.js';
import { dev, dlp, ddp, gfg, tag } from './sources.js';

const DE = ['Data Engineer'];

export default {
  problems: [
    python({
      id: 'longest-unique-session',
      title: 'Longest Stretch Without a Repeated Page',
      difficulty: 'Medium',
      topics: ['Two Pointers & Sliding Window', 'Hash Maps & Counting'],
      patterns: ['Variable sliding window'],
      domains: ['Web analytics'],
      roles: DE,
      summary: 'Find the longest contiguous run of page views with no page repeated.',
      description: md('Return the length of the longest contiguous slice of `pages` in which no page id appears twice.'),
      hints: ['Remember the last index of each page; when a repeat falls inside the window, move the left edge just past it.'],
      entry: 'longest_unique',
      signature: 'longest_unique(pages: list[str]) -> int',
      solution: code`def longest_unique(pages: list[str]) -> int:
    last, left, best = {}, 0, 0
    for right, p in enumerate(pages):
        if p in last and last[p] >= left:
            left = last[p] + 1
        last[p] = right
        best = max(best, right - left + 1)
    return best
`,
      explanation: md('The window only ever moves right, so the scan is O(n). Checking `last[p] >= left` ignores repeats that already fell out of the window.'),
      tests: [
        ex('Example', ['a', 'b', 'c', 'a', 'b', 'd', 'e']),
        ex('All the same', ['x', 'x', 'x']),
        hid('Empty', []),
        hid('Old repeat outside the window', ['a', 'b', 'b', 'a']),
      ],
    }),

    python({
      id: 'at-most-two-odd-fares',
      title: 'Longest Run with at Most Two Odd Fares',
      difficulty: 'Medium',
      topics: ['Two Pointers & Sliding Window'],
      patterns: ['Sliding window with a budget'],
      domains: ['Mobility / Ride-hailing'],
      ...tag(dev('Uber', 'longest subarray with at most two odd elements')),
      roles: DE,
      summary: 'Longest contiguous slice of fares containing at most k odd values.',
      description: md('Return the length of the longest contiguous slice of `fares` that contains at most `k` odd numbers.'),
      hints: ['Grow the window right; while it holds more than k odds, shrink from the left.'],
      entry: 'longest_with_k_odd',
      signature: 'longest_with_k_odd(fares: list[int], k: int) -> int',
      solution: code`def longest_with_k_odd(fares: list[int], k: int) -> int:
    left = odd = best = 0
    for right, f in enumerate(fares):
        odd += f % 2
        while odd > k:
            odd -= fares[left] % 2
            left += 1
        best = max(best, right - left + 1)
    return best
`,
      explanation: md('"At most k of something" windows are monotonic: shrinking never adds odds, so two pointers suffice — O(n).'),
      tests: [
        ex('Example', [2, 1, 4, 3, 6, 5, 8], 2),
        ex('k = 0', [1, 2, 4, 3], 0),
        hid('All odd', [1, 3, 5], 2),
        hid('Empty', [], 1),
      ],
    }),

    python({
      id: 'max-substring-occurrences',
      title: 'Most Frequent Short Substring',
      difficulty: 'Medium',
      topics: ['Two Pointers & Sliding Window', 'Hash Maps & Counting', 'Strings'],
      patterns: ['Fixed window + counter'],
      domains: ['Search & text'],
      ...tag(dev('Snowflake', 'hash tables and sliding window for maximum substring occurrences')),
      roles: DE,
      summary: 'Count the most frequent substring of a fixed length that uses at most a few distinct letters.',
      description: md('Among all substrings of `s` of length exactly `size` with at most `max_letters` distinct characters, return the highest number of occurrences of any one of them (overlaps count). Return 0 if there is none.'),
      hints: ['Only length `size` matters: a longer qualifying substring always contains a qualifying one of length `size` that occurs at least as often.'],
      entry: 'max_occurrences',
      signature: 'max_occurrences(s: str, max_letters: int, size: int) -> int',
      solution: code`from collections import Counter

def max_occurrences(s: str, max_letters: int, size: int) -> int:
    counts = Counter(s[i:i + size] for i in range(len(s) - size + 1))
    return max((n for sub, n in counts.items() if len(set(sub)) <= max_letters), default=0)
`,
      explanation: md('The insight is the reduction to one fixed length; after that it is a Counter over O(n) windows.'),
      tests: [
        ex('Example', 'aababcaab', 2, 3),
        ex('Overlaps count', 'aaaa', 1, 3),
        hid('Too short', 'ab', 2, 3),
        hid('Too many letters', 'abcabc', 2, 3),
      ],
    }),

    python({
      id: 'max-window-throughput',
      title: 'Peak Throughput over k Minutes',
      difficulty: 'Easy',
      topics: ['Two Pointers & Sliding Window'],
      patterns: ['Fixed window running sum'],
      domains: ['Travel'],
      ...tag(dev('Agoda', 'array patterns: sliding throughput')),
      roles: DE,
      summary: 'Find the busiest k-minute window of booking counts.',
      description: md('`per_minute` holds bookings per minute. Return `[start_index, total]` for the k-minute window with the largest total (earliest on ties), or `[]` if there are fewer than k minutes.'),
      hints: ['Add the entering minute, subtract the leaving one.'],
      entry: 'peak_window',
      signature: 'peak_window(per_minute: list[int], k: int) -> list[int]',
      solution: code`def peak_window(per_minute: list[int], k: int) -> list[int]:
    if k <= 0 or len(per_minute) < k:
        return []
    total = best = sum(per_minute[:k])
    start = 0
    for i in range(k, len(per_minute)):
        total += per_minute[i] - per_minute[i - k]
        if total > best:
            best, start = total, i - k + 1
    return [start, best]
`,
      explanation: md('Re-summing every window is O(n·k); the running sum is O(n).'),
      tests: [
        ex('Example', [3, 1, 4, 1, 5, 9, 2], 3),
        ex('Too few minutes', [1, 2], 3),
        hid('Tie keeps the earliest', [5, 0, 5, 0], 2),
        hid('Whole list', [1, 2, 3], 3),
      ],
    }),

    python({
      id: 'max-average-subarray',
      title: 'Best k-Day Average',
      difficulty: 'Easy',
      topics: ['Two Pointers & Sliding Window'],
      patterns: ['Fixed window running sum'],
      domains: ['Retail'],
      ...tag(dlp('Walmart', 'Average Subarray')),
      roles: DE,
      summary: 'Return the highest average of any k consecutive daily sales figures.',
      description: md('Return the maximum average (rounded to 4) over all contiguous windows of length `k` in `sales` (len ≥ k ≥ 1).'),
      hints: ['Maximise the window sum, divide once at the end.'],
      entry: 'best_average',
      signature: 'best_average(sales: list[float], k: int) -> float',
      solution: code`def best_average(sales: list[float], k: int) -> float:
    total = best = sum(sales[:k])
    for i in range(k, len(sales)):
        total += sales[i] - sales[i - k]
        best = max(best, total)
    return round(best / k, 4)
`,
      explanation: md('Since k is fixed, the best average is the best sum divided by k.'),
      tests: [
        ex('Example', [1, 12, -5, -6, 50, 3], 4),
        ex('Window of one', [5, -1], 1),
        hid('All negative', [-3, -1, -2], 2),
        hid('Whole list', [2, 4], 2),
      ],
    }),

    python({
      id: 'k-radius-average',
      title: 'Centered k-Radius Averages',
      difficulty: 'Medium',
      topics: ['Two Pointers & Sliding Window', 'Math & Bits'],
      patterns: ['Prefix sums'],
      domains: ['IoT / Telemetry'],
      ...tag(dlp('Databricks', 'k-Radius Average')),
      roles: DE,
      summary: 'Smooth a series with a centred window of radius k, using -1 where the window doesn\'t fit.',
      description: md('For each index i, return the integer average (floor division) of `nums[i-k .. i+k]`, or `-1` if that window runs off either end.'),
      hints: ['Prefix sums give any window sum in O(1).'],
      entry: 'radius_averages',
      signature: 'radius_averages(nums: list[int], k: int) -> list[int]',
      solution: code`def radius_averages(nums: list[int], k: int) -> list[int]:
    prefix = [0]
    for x in nums:
        prefix.append(prefix[-1] + x)
    width = 2 * k + 1
    out = []
    for i in range(len(nums)):
        lo, hi = i - k, i + k
        out.append(-1 if lo < 0 or hi >= len(nums) else (prefix[hi + 1] - prefix[lo]) // width)
    return out
`,
      explanation: md('`prefix[j]` is the sum of the first j items, so a window sum is one subtraction.'),
      tests: [
        ex('Example', [7, 4, 3, 9, 1, 8, 5, 2, 6], 3),
        ex('Radius zero', [5, 6], 0),
        hid('Window never fits', [1, 2, 3], 2),
        hid('Single element', [9], 0),
      ],
    }),

    python({
      id: 'subarray-with-target-sum',
      title: 'First Run of Payments Adding Up to a Target',
      difficulty: 'Medium',
      topics: ['Two Pointers & Sliding Window'],
      patterns: ['Two pointers on non-negative values'],
      domains: ['Payments'],
      ...tag(gfg('Goldman Sachs', 'find a subarray with a given sum')),
      roles: DE,
      summary: 'Find the earliest contiguous run of non-negative amounts that sums exactly to target.',
      description: md('`amounts` are non-negative ints. Return `[start, end]` (inclusive, 0-based) of the first contiguous run (smallest end, then smallest start) summing to `target` (> 0), or `[]`.'),
      hints: ['Expand right; while the sum exceeds target, shrink from the left.'],
      entry: 'target_run',
      signature: 'target_run(amounts: list[int], target: int) -> list[int]',
      solution: code`def target_run(amounts: list[int], target: int) -> list[int]:
    left = total = 0
    for right, a in enumerate(amounts):
        total += a
        while total > target and left < right:
            total -= amounts[left]
            left += 1
        if total == target:
            return [left, right]
    return []
`,
      explanation: md('With non-negative values the window sum is monotonic in both edges, which is what makes two pointers correct. With negatives you need prefix sums + a dict.'),
      tests: [
        ex('Example', [1, 4, 20, 3, 10, 5], 33),
        ex('Not found', [1, 2, 3], 7),
        hid('Single element', [5, 7, 9], 7),
        hid('Zeros inside', [0, 3, 0, 4], 7),
      ],
    }),

    python({
      id: 'max-subarray-kadane',
      title: 'Best Stretch of Daily P&L (Kadane)',
      difficulty: 'Medium',
      topics: ['Dynamic Programming', 'Two Pointers & Sliding Window'],
      patterns: ['Kadane\'s algorithm'],
      domains: ['Trading'],
      ...tag(dlp('Akuna Capital', 'Largest Contiguous Subarray Sum')),
      roles: DE,
      summary: 'Find the largest-sum contiguous stretch of daily profit and loss, with its bounds.',
      description: md('Return `[best_sum, start, end]` for the contiguous non-empty slice of `pnl` with the largest sum (earliest start, then shortest, on ties).'),
      hints: ['Keep the best sum ending at each day: either extend the previous run or start fresh.'],
      entry: 'best_stretch',
      signature: 'best_stretch(pnl: list[int]) -> list[int]',
      solution: code`def best_stretch(pnl: list[int]) -> list[int]:
    best = [pnl[0], 0, 0]
    cur, start = pnl[0], 0
    for i in range(1, len(pnl)):
        if cur < 0:
            cur, start = pnl[i], i
        else:
            cur += pnl[i]
        if cur > best[0]:
            best = [cur, start, i]
    return best
`,
      explanation: md('A run with a negative total can only hurt what follows, so drop it — O(n), O(1) space. All-negative input returns the single largest value.'),
      tests: [
        ex('Example', [-2, 1, -3, 4, -1, 2, 1, -5, 4]),
        ex('All negative', [-3, -1, -2]),
        hid('Single day', [7]),
        hid('Zeros do not extend the best', [3, 0, -1, 0]),
      ],
    }),

    python({
      id: 'min-amplitude',
      title: 'Smallest Spread After Removing Three Readings',
      difficulty: 'Medium',
      topics: ['Sorting', 'Math & Bits'],
      patterns: ['Sort and try the extremes'],
      domains: ['IoT / Telemetry'],
      ...tag(dlp('Google', 'Min Amplitude')),
      roles: DE,
      summary: 'Remove up to three outlier readings to minimise max − min.',
      description: md('Return the smallest possible `max - min` of `readings` after removing at most 3 values. With 4 or fewer readings the answer is 0.'),
      hints: ['After sorting, the best removal takes i values from the bottom and 3 − i from the top.'],
      entry: 'min_spread',
      signature: 'min_spread(readings: list[int]) -> int',
      solution: code`def min_spread(readings: list[int]) -> int:
    if len(readings) <= 4:
        return 0
    r = sorted(readings)
    return min(r[len(r) - 4 + i] - r[i] for i in range(4))
`,
      explanation: md('Removing a middle value never shrinks the spread, so only the four "i low, 3−i high" options matter. Sorting dominates: O(n log n); `heapq` can find the 4 smallest/largest in O(n).'),
      tests: [
        ex('Example', [1, 5, 0, 10, 14]),
        ex('Few readings', [9, 1, 5]),
        hid('Outliers on one side', [1, 2, 3, 100, 200, 300]),
        hid('Duplicates', [7, 7, 7, 7, 7, 1]),
      ],
    }),

    python({
      id: 'top-k-frequent-integers',
      title: 'Most Popular Product IDs',
      difficulty: 'Medium',
      topics: ['Hash Maps & Counting', 'Heaps'],
      patterns: ['Count then top-k'],
      domains: ['E-commerce / Sales'],
      ...tag(dlp('Google', 'Most Popular Integers')),
      roles: DE,
      summary: 'Return the k most frequent IDs, ties broken by smaller ID.',
      description: md('Return the `k` most frequent values in `ids`, ordered by count descending then value ascending.'),
      hints: ['`heapq.nsmallest(k, counts.items(), key=lambda kv: (-kv[1], kv[0]))`.'],
      entry: 'top_k',
      signature: 'top_k(ids: list[int], k: int) -> list[int]',
      solution: code`import heapq
from collections import Counter

def top_k(ids: list[int], k: int) -> list[int]:
    counts = Counter(ids)
    return [v for v, _ in heapq.nsmallest(k, counts.items(), key=lambda kv: (-kv[1], kv[0]))]
`,
      explanation: md('Counting is O(n); selecting k with a heap is O(m log k) for m distinct values. Bucket sort by frequency gives O(n).'),
      tests: [
        ex('Example', [4, 1, 1, 2, 2, 3, 2], 2),
        ex('Ties by value', [5, 3, 9], 2),
        hid('k beyond distinct values', [1, 1], 5),
        hid('Empty', [], 3),
      ],
    }),

    python({
      id: 'disputed-fare-legs',
      title: 'The Disputed Fare',
      difficulty: 'Medium',
      topics: ['Hash Maps & Counting', 'Sorting'],
      patterns: ['Complement lookup in time order'],
      domains: ['Mobility / Ride-hailing'],
      ...tag(ddp('Lyft', 'The Disputed Fare')),
      roles: DE,
      summary: 'Find the pair of ride legs that explains a disputed charge, preferring the earliest-billed second leg.',
      description: md('Each leg is `[leg_id, billed_at, amount_cents]` in any order. Find two different legs summing to `charge`. Among all valid pairs, choose the one whose **later-billed** leg was billed earliest; then the earlier leg billed earliest; then smaller ids. Return the two leg ids in billing order, or `[]`.'),
      hints: ['Sort by `(billed_at, leg_id)`, then scan with a dict of amount → first leg seen.'],
      entry: 'explain_charge',
      signature: 'explain_charge(legs: list[list], charge: int) -> list[str]',
      solution: code`def explain_charge(legs: list[list], charge: int) -> list[str]:
    seen = {}
    for leg_id, billed, amount in sorted(legs, key=lambda l: (l[1], l[0])):
        partner = seen.get(charge - amount)
        if partner is not None:
            return [partner, leg_id]
        seen.setdefault(amount, leg_id)
    return []
`,
      explanation: md('Sorting by billing time turns "earliest second leg" into "first hit in a left-to-right scan", and `setdefault` keeps the earliest partner for each amount — two-sum with a business tie-break.'),
      tests: [
        ex('Example', [['L3', 30, 700], ['L1', 10, 500], ['L2', 20, 300], ['L4', 25, 200]], 1000),
        ex('No explanation', [['a', 1, 100]], 100),
        hid('Same amount twice', [['x', 5, 250], ['y', 6, 250]], 500),
        hid('Ties on billing time use ids', [['b', 1, 10], ['a', 1, 10], ['c', 2, 5]], 20),
      ],
    }),

    python({
      id: 'nth-missing-id',
      title: 'The k-th Missing Invoice Number',
      difficulty: 'Medium',
      topics: ['Binary Search'],
      patterns: ['Binary search on a derived quantity'],
      domains: ['Finance'],
      ...tag(dev('Lyft', 'binary search for the Nth missing integer')),
      roles: DE,
      summary: 'Invoice numbers should run 1, 2, 3…; find the k-th number that is missing, in O(log n).',
      description: md('`present` is a strictly increasing list of positive invoice numbers. Return the k-th positive integer **not** in it.'),
      hints: ['Before index i, `present[i] - (i + 1)` numbers are missing. Binary search for the first index where that is ≥ k; the answer is `k + index`.'],
      entry: 'kth_missing',
      signature: 'kth_missing(present: list[int], k: int) -> int',
      solution: code`def kth_missing(present: list[int], k: int) -> int:
    lo, hi = 0, len(present)
    while lo < hi:
        mid = (lo + hi) // 2
        if present[mid] - (mid + 1) < k:
            lo = mid + 1
        else:
            hi = mid
    return k + lo
`,
      explanation: md('`present[i] - (i+1)` is non-decreasing, so binary search applies. With `lo` numbers present below the answer, the answer is `k + lo`.'),
      tests: [
        ex('Example', [2, 3, 4, 7, 11], 5),
        ex('Nothing missing before the end', [1, 2, 3, 4], 2),
        hid('Empty list', [], 3),
        hid('Missing at the start', [5, 6], 4),
      ],
    }),

    python({
      id: 'first-last-position',
      title: 'First and Last Position of a Timestamp',
      difficulty: 'Medium',
      topics: ['Binary Search'],
      patterns: ['Lower / upper bound'],
      domains: ['Event pipelines'],
      ...tag(dev('Atlassian', 'binary search for first/last position')),
      roles: DE,
      summary: 'In a sorted event log, find the index range holding a given timestamp.',
      description: md('Return `[first, last]` indexes of `target` in the sorted list `ts`, or `[-1, -1]`. O(log n).'),
      hints: ['`bisect_left` gives the first index ≥ target, `bisect_right` the first index > target.'],
      entry: 'search_range',
      signature: 'search_range(ts: list[int], target: int) -> list[int]',
      solution: code`from bisect import bisect_left, bisect_right

def search_range(ts: list[int], target: int) -> list[int]:
    lo = bisect_left(ts, target)
    if lo == len(ts) or ts[lo] != target:
        return [-1, -1]
    return [lo, bisect_right(ts, target) - 1]
`,
      explanation: md('Two binary searches — lower and upper bound — find both edges in O(log n). A linear expansion from one match degrades to O(n) for long runs.'),
      tests: [
        ex('Example', [5, 7, 7, 8, 8, 10], 8),
        ex('Missing', [5, 7, 7, 8], 6),
        hid('Empty', [], 1),
        hid('All the same', [3, 3, 3], 3),
      ],
    }),

    python({
      id: 'interval-lookup-bisect',
      title: 'Map IPs to Ranges with Binary Search',
      difficulty: 'Medium',
      topics: ['Binary Search', 'Intervals & Sessions'],
      patterns: ['bisect over range starts'],
      domains: ['Networking / Security'],
      ...tag(dev('Databricks', 'binary search on intervals and sorted data')),
      roles: DE,
      summary: 'Look up which non-overlapping range each number falls into, in O(log n) per query.',
      description: md('`ranges` are non-overlapping `[start, end, label]` (inclusive, any order). For each query return the label of the range containing it, or `null`.'),
      hints: ['Sort by start; `bisect_right(starts, q) - 1` is the only candidate range.'],
      entry: 'lookup',
      signature: 'lookup(ranges: list[list], queries: list[int]) -> list',
      solution: code`from bisect import bisect_right

def lookup(ranges: list[list], queries: list[int]) -> list:
    ranges = sorted(ranges)
    starts = [r[0] for r in ranges]
    out = []
    for q in queries:
        i = bisect_right(starts, q) - 1
        out.append(ranges[i][2] if i >= 0 and q <= ranges[i][1] else None)
    return out
`,
      explanation: md('Because ranges don\'t overlap, the last range starting at or before q is the only one that can contain it — GeoIP lookups work this way.'),
      tests: [
        ex('Example', [[100, 199, 'eu'], [0, 49, 'us'], [200, 300, 'in']], [10, 60, 150, 300, 301]),
        ex('No ranges', [], [5]),
        hid('Boundaries', [[1, 1, 'one'], [2, 5, 'many']], [1, 2, 5, 0]),
        hid('Gap between ranges', [[0, 9, 'a'], [20, 29, 'b']], [15, 20, 29, 30]),
      ],
    }),

    python({
      id: 'prefix-autocomplete',
      title: 'Autocomplete from Search History',
      difficulty: 'Medium',
      topics: ['Hash Maps & Counting', 'Strings', 'Sorting'],
      patterns: ['Prefix index'],
      domains: ['Search & text'],
      ...tag(dev('Lyft', 'hash tables for text search autocomplete'), dev('Roblox', 'prefixes, hashes and string transforms')),
      roles: DE,
      summary: 'Suggest the top 3 past queries for each prefix, most frequent first.',
      description: md('Lowercase and strip every query in `history`. For each prefix in `prefixes` (also normalised), return up to 3 past queries starting with it, by frequency descending then alphabetically.'),
      hints: ['Count queries once; build a dict prefix → list of queries (every prefix of every distinct query), then sort each list once.'],
      entry: 'suggest',
      signature: 'suggest(history: list[str], prefixes: list[str]) -> list[list[str]]',
      solution: code`from collections import Counter

def suggest(history: list[str], prefixes: list[str]) -> list[list[str]]:
    counts = Counter(q.strip().lower() for q in history if q.strip())
    index = {}
    for q in counts:
        for i in range(1, len(q) + 1):
            index.setdefault(q[:i], []).append(q)
    for p, qs in index.items():
        qs.sort(key=lambda q: (-counts[q], q))
    return [index.get(p.strip().lower(), [])[:3] for p in prefixes]
`,
      explanation: md('Precomputing a prefix index trades memory for O(1) lookups at typing speed — the hash-map version of a trie.'),
      tests: [
        ex('Example', ['spark sql', 'Spark', 'spark sql', 'sparse', 'sql', 'spark ui'], ['spa', 'sq', 'x']),
        ex('Empty history', [], ['a']),
        hid('Ties alphabetical', ['b', 'a', 'ab'], ['a']),
        hid('Prefix normalised', ['  ETL Jobs ', 'etl jobs', 'etl'], [' ETL J']),
      ],
    }),

    python({
      id: 'fizzbuzz-sum',
      title: 'FizzBuzz Sum',
      difficulty: 'Easy',
      topics: ['Math & Bits'],
      patterns: ['Inclusion–exclusion'],
      domains: ['Math'],
      ...tag(dlp('Google', 'Fizz Buzz Sum')),
      roles: DE,
      summary: 'Sum the numbers below n divisible by 3 or 5 — in O(1).',
      description: md('Return the sum of all positive integers below `n` divisible by 3 or 5, without looping (n can be up to 10⁷).'),
      hints: ['Sum of multiples of m below n: `m * k * (k + 1) // 2` with `k = (n - 1) // m`. Add 3s and 5s, subtract 15s.'],
      entry: 'fizzbuzz_sum',
      signature: 'fizzbuzz_sum(n: int) -> int',
      solution: code`def fizzbuzz_sum(n: int) -> int:
    def multiples(m):
        k = (n - 1) // m
        return m * k * (k + 1) // 2
    return multiples(3) + multiples(5) - multiples(15)
`,
      explanation: md('Inclusion–exclusion: multiples of 15 are counted twice. Closed form beats the O(n) loop.'),
      tests: [
        ex('Example', 10),
        ex('Small', 1),
        hid('Larger', 1000),
        hid('Ten million', 10000000),
      ],
    }),

    python({
      id: 'reverse-string-no-slicing',
      title: 'Reverse a String Without Slicing',
      difficulty: 'Easy',
      topics: ['Strings', 'Two Pointers & Sliding Window'],
      patterns: ['Two-pointer swap'],
      domains: ['Search & text'],
      ...tag(gfg('Bajaj Finserv', 'how to reverse a string in Python')),
      roles: DE,
      summary: 'Reverse a string with two pointers — and know the one-liners.',
      description: md('Return `s` reversed **without** `[::-1]`, `reversed()` or recursion: swap characters in a list with two pointers.'),
      hints: ['Strings are immutable — convert to a list, swap, `"".join`.'],
      entry: 'reverse',
      signature: 'reverse(s: str) -> str',
      solution: code`def reverse(s: str) -> str:
    chars = list(s)
    i, j = 0, len(chars) - 1
    while i < j:
        chars[i], chars[j] = chars[j], chars[i]
        i, j = i + 1, j - 1
    return "".join(chars)
`,
      explanation: md('`s[::-1]` is the idiomatic answer; interviewers ask for the manual version to see two pointers and immutability handled. Building with `+=` in a loop would be O(n²) in the worst case.'),
      tests: [
        ex('Example', 'pipeline'),
        ex('Palindrome', 'level'),
        hid('Empty', ''),
        hid('Unicode', 'naïve ☕'),
      ],
    }),
  ],
};
