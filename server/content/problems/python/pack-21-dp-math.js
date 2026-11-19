// Python pack 21 — dynamic programming, math, bits and matrices: coin change,
// stock profit, edit distance, LIS, CIDR / bit manipulation, digit math,
// LCM, sparse matrices, spiral and rotation, and the statistics interviews
// ask for in plain Python (Pearson, precision/recall, percentiles).
import { python, md, code, ex, hid } from './define.js';
import { dev, dlp, ddp, lds, tag } from './sources.js';

const DE = ['Data Engineer'];
const DE_DS = ['Data Engineer', 'Data Scientist'];

export default {
  problems: [
    python({
      id: 'coin-change-min',
      title: 'Fewest Coins for Change',
      difficulty: 'Medium',
      topics: ['Dynamic Programming'],
      patterns: ['Unbounded knapsack (min)'],
      domains: ['Payments'],
      ...tag(dlp('Amazon', 'Coin Change')),
      roles: DE,
      summary: 'Minimum number of coins summing to an amount, or -1 if impossible.',
      description: md('Return the fewest coins (unlimited supply of each denomination) that sum to `amount`, or `-1`. `amount` 0 needs 0 coins.'),
      hints: ['`best[a] = 1 + min(best[a - c])` over coins c ≤ a; build up from 0. Greedy fails for e.g. coins [1, 3, 4] and amount 6.'],
      entry: 'min_coins',
      signature: 'min_coins(coins: list[int], amount: int) -> int',
      solution: code`def min_coins(coins: list[int], amount: int) -> int:
    INF = amount + 1
    best = [0] + [INF] * amount
    for a in range(1, amount + 1):
        for c in coins:
            if c <= a and best[a - c] + 1 < best[a]:
                best[a] = best[a - c] + 1
    return best[amount] if best[amount] <= amount else -1
`,
      explanation: md('Each amount\'s answer depends on smaller amounts — classic bottom-up DP, O(amount × coins).'),
      tests: [
        ex('Example', [1, 2, 5], 11),
        ex('Impossible', [2], 3),
        hid('Greedy would fail', [1, 3, 4], 6),
        hid('Zero amount', [7], 0),
      ],
    }),

    python({
      id: 'stock-profit-one-trade',
      title: 'Best Single Buy and Sell',
      difficulty: 'Easy',
      topics: ['Dynamic Programming', 'Two Pointers & Sliding Window'],
      patterns: ['Running minimum'],
      domains: ['Trading'],
      ...tag(dlp('Google', 'Max Profit Trading Stocks')),
      roles: DE,
      summary: 'Maximum profit from one buy followed by one sell.',
      description: md('Return the maximum profit from buying once and selling later; 0 if no profit is possible.'),
      hints: ['Track the lowest price so far.'],
      entry: 'max_profit',
      signature: 'max_profit(prices: list[int]) -> int',
      solution: code`def max_profit(prices: list[int]) -> int:
    low, best = float("inf"), 0
    for p in prices:
        low = min(low, p)
        best = max(best, p - low)
    return best
`,
      explanation: md('The best sale today uses the cheapest earlier day — one pass, O(1) memory.'),
      tests: [
        ex('Example', [7, 1, 5, 3, 6, 4]),
        ex('Falling', [7, 6, 4]),
        hid('Empty', []),
        hid('Single day', [5]),
      ],
    }),

    python({
      id: 'stock-profit-unlimited',
      title: 'Unlimited Non-Overlapping Trades',
      difficulty: 'Easy',
      topics: ['Dynamic Programming'],
      patterns: ['Greedy sum of rises'],
      domains: ['Trading'],
      ...tag(dev('Uber', 'dynamic programming and greedy: unlimited transactions with no overlap')),
      roles: DE,
      summary: 'Maximum profit with any number of trades, holding at most one share at a time.',
      description: md('You may buy and sell many times but hold at most one share. Return the maximum profit.'),
      hints: ['Every upward day-to-day move can be captured.'],
      entry: 'max_profit_many',
      signature: 'max_profit_many(prices: list[int]) -> int',
      solution: code`def max_profit_many(prices: list[int]) -> int:
    return sum(max(0, b - a) for a, b in zip(prices, prices[1:]))
`,
      explanation: md('Any profitable trade decomposes into consecutive daily rises, so summing positive differences is optimal (the DP with hold/cash states gives the same).'),
      tests: [
        ex('Example', [7, 1, 5, 3, 6, 4]),
        ex('Steady rise', [1, 2, 3, 4, 5]),
        hid('Falling', [5, 4, 3]),
        hid('Flat', [2, 2, 2]),
      ],
    }),

    python({
      id: 'edit-distance',
      title: 'Edit Distance Between Two Names',
      difficulty: 'Hard',
      topics: ['Dynamic Programming', 'Strings'],
      patterns: ['2-D DP table'],
      domains: ['Data quality'],
      roles: DE_DS,
      summary: 'Levenshtein distance for fuzzy-matching customer names.',
      description: md('Return the minimum number of single-character insertions, deletions and substitutions turning `a` into `b`.'),
      hints: ['`D[i][j]` = distance between `a[:i]` and `b[:j]`; keep only two rows for O(min) memory.'],
      entry: 'edit_distance',
      signature: 'edit_distance(a: str, b: str) -> int',
      solution: code`def edit_distance(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]
`,
      explanation: md('Each cell takes the cheapest of delete, insert or substitute-or-match. O(n·m) time, O(m) space with rolling rows. Used for deduplicating names and addresses.'),
      tests: [
        ex('Example', 'kitten', 'sitting'),
        ex('Same', 'ana', 'ana'),
        hid('Empty side', '', 'abc'),
        hid('Transposition costs two', 'ab', 'ba'),
      ],
    }),

    python({
      id: 'longest-increasing-subsequence',
      title: 'Longest Run of Rising Scores (Not Contiguous)',
      difficulty: 'Medium',
      topics: ['Dynamic Programming', 'Binary Search'],
      patterns: ['Patience sorting'],
      domains: ['Gaming'],
      roles: DE,
      summary: 'Length of the longest strictly increasing subsequence in O(n log n).',
      description: md('Return the length of the longest strictly increasing subsequence (not necessarily contiguous) of `scores`.'),
      hints: ['Keep `tails[k]` = smallest tail of an increasing subsequence of length k+1; `bisect_left` places each score.'],
      entry: 'lis_length',
      signature: 'lis_length(scores: list[int]) -> int',
      solution: code`from bisect import bisect_left

def lis_length(scores: list[int]) -> int:
    tails = []
    for s in scores:
        i = bisect_left(tails, s)
        if i == len(tails):
            tails.append(s)
        else:
            tails[i] = s
    return len(tails)
`,
      explanation: md('The O(n²) DP compares every pair; the tails array is always sorted, so binary search gives O(n log n). `bisect_left` keeps it strictly increasing.'),
      tests: [
        ex('Example', [10, 9, 2, 5, 3, 7, 101, 18]),
        ex('All equal', [7, 7, 7]),
        hid('Empty', []),
        hid('Decreasing then rising', [5, 4, 3, 1, 2, 3, 4]),
      ],
    }),

    python({
      id: 'cidr-contains',
      title: 'Which Firewall Rule Matches an IP? (CIDR)',
      difficulty: 'Medium',
      topics: ['Math & Bits', 'Strings'],
      patterns: ['Bit masks'],
      domains: ['Networking / Security'],
      ...tag(dev('Databricks', 'bit manipulation and CIDR / firewall design')),
      roles: DE,
      summary: 'Match IPv4 addresses against CIDR blocks with bit operations, preferring the most specific.',
      description: md('`rules` are `[cidr, action]` like `["10.0.0.0/8", "allow"]`. For each IP return the action of the **longest-prefix** matching rule, or `"deny"` if none matches. Don\'t use the `ipaddress` module.'),
      hints: ['Convert an IP to a 32-bit int; a /p mask is `((1 << 32) - 1) ^ ((1 << (32 - p)) - 1)`.'],
      entry: 'firewall',
      signature: 'firewall(rules: list[list[str]], ips: list[str]) -> list[str]',
      solution: code`def _ip(s):
    a, b, c, d = (int(x) for x in s.split("."))
    return (a << 24) | (b << 16) | (c << 8) | d

def firewall(rules: list[list[str]], ips: list[str]) -> list[str]:
    parsed = []
    for cidr, action in rules:
        base, prefix = cidr.split("/")
        p = int(prefix)
        mask = ((1 << 32) - 1) ^ ((1 << (32 - p)) - 1)
        parsed.append((p, _ip(base) & mask, mask, action))
    parsed.sort(key=lambda r: -r[0])
    out = []
    for ip in ips:
        n = _ip(ip)
        out.append(next((a for p, net, mask, a in parsed if n & mask == net), "deny"))
    return out
`,
      explanation: md('An address is in a block when its masked bits equal the block\'s network bits. Checking rules from longest prefix down implements "most specific wins". /0 has mask 0 and matches everything.'),
      tests: [
        ex('Example', [['10.0.0.0/8', 'allow'], ['10.1.0.0/16', 'deny'], ['0.0.0.0/0', 'log']], ['10.2.3.4', '10.1.9.9', '8.8.8.8']),
        ex('No rules', [], ['1.2.3.4']),
        hid('Host route', [['192.168.1.7/32', 'allow']], ['192.168.1.7', '192.168.1.8']),
        hid('Base with host bits set', [['172.16.5.9/12', 'allow']], ['172.31.255.255', '172.32.0.0']),
      ],
    }),

    python({
      id: 'count-set-bits',
      title: 'Feature Flags as Bit Masks',
      difficulty: 'Easy',
      topics: ['Math & Bits'],
      patterns: ['Bitwise operations'],
      domains: ['Experimentation'],
      roles: DE,
      summary: 'Store user flags in an int: set, clear, test and count bits.',
      description: md('Start from `mask = 0` and apply ops: `["set", bit]`, `["clear", bit]`, `["toggle", bit]`, `["test", bit]` (records True/False). Return the recorded tests, the final mask and the number of set bits.'),
      hints: ['`mask | (1 << b)`, `mask & ~(1 << b)`, `mask ^ (1 << b)`, `mask >> b & 1`; `bin(mask).count("1")` or `int.bit_count()`.'],
      entry: 'flags',
      signature: 'flags(ops: list[list]) -> list',
      solution: code`def flags(ops: list[list]) -> list:
    mask, tests = 0, []
    for op, bit in ops:
        if op == "set":
            mask |= 1 << bit
        elif op == "clear":
            mask &= ~(1 << bit)
        elif op == "toggle":
            mask ^= 1 << bit
        else:
            tests.append(bool(mask >> bit & 1))
    return [tests, mask, bin(mask).count("1")]
`,
      explanation: md('One integer can hold dozens of booleans compactly; bitwise ops update them in O(1). Python ints are unbounded, so there is no overflow.'),
      tests: [
        ex('Example', [['set', 0], ['set', 3], ['test', 3], ['clear', 0], ['toggle', 5], ['test', 0]]),
        ex('Nothing set', [['test', 2]]),
        hid('Toggle twice', [['toggle', 1], ['toggle', 1], ['test', 1]]),
        hid('High bit', [['set', 40], ['test', 40]]),
      ],
    }),

    python({
      id: 'digit-math-primitives',
      title: 'Digit Math Without Strings',
      difficulty: 'Easy',
      topics: ['Math & Bits'],
      patterns: ['divmod by 10'],
      domains: ['Retail'],
      ...tag(dev('Walmart', 'Python math and digit-by-digit primitives')),
      roles: DE,
      summary: 'Reverse a number, sum its digits and check if it is a palindrome — using only arithmetic.',
      description: md('For each non-negative integer, return `[reversed_number, digit_sum, is_palindrome]` without converting it to a string.'),
      hints: ['`n, d = divmod(n, 10)` peels the last digit.'],
      entry: 'digit_facts',
      signature: 'digit_facts(nums: list[int]) -> list[list]',
      solution: code`def digit_facts(nums: list[int]) -> list[list]:
    out = []
    for n in nums:
        rev, total, m = 0, 0, n
        while m:
            m, d = divmod(m, 10)
            rev = rev * 10 + d
            total += d
        out.append([rev, total, rev == n])
    return out
`,
      explanation: md('`divmod(n, 10)` splits off the last digit; building `rev = rev * 10 + d` reverses. Trailing zeros vanish on reversal (1200 → 21), which is why 1200 isn\'t a palindrome.'),
      tests: [
        ex('Example', [12321, 1200, 7]),
        ex('Zero', [0]),
        hid('Large', [9876543210]),
        hid('Single digits and palindromes', [5, 1001, 10]),
      ],
    }),

    python({
      id: 'smallest-multiple-lcm',
      title: 'Smallest Number Divisible by 1..n',
      difficulty: 'Easy',
      topics: ['Math & Bits'],
      patterns: ['LCM via GCD'],
      domains: ['Scheduling'],
      ...tag(dlp('Google', 'Smallest Multiple')),
      roles: DE,
      summary: 'When do jobs with periods 1..n all run together again? The LCM.',
      description: md('Return the least common multiple of 1, 2, …, n (1 ≤ n ≤ 40).'),
      hints: ['`lcm(a, b) = a // gcd(a, b) * b`; fold over the range.'],
      entry: 'smallest_multiple',
      signature: 'smallest_multiple(n: int) -> int',
      solution: code`from math import gcd

def smallest_multiple(n: int) -> int:
    result = 1
    for k in range(2, n + 1):
        result = result // gcd(result, k) * k
    return result
`,
      explanation: md('Folding LCM pairwise is fast and exact (Python ints don\'t overflow). `math.lcm(*range(1, n+1))` does it in one call on 3.9+.'),
      tests: [
        ex('Example', 10),
        ex('One', 1),
        hid('Twenty', 20),
        hid('Thirty', 30),
      ],
    }),

    python({
      id: 'sparse-matrix-vector',
      title: 'Sparse Matrix × Vector with Dicts',
      difficulty: 'Medium',
      topics: ['Matrices', 'Hash Maps & Counting'],
      patterns: ['Sparse representation'],
      domains: ['Machine learning'],
      ...tag(dev('Databricks', 'sparse matrix-vector multiplication with hash tables')),
      roles: DE_DS,
      summary: 'Multiply a matrix stored as {(row, col): value} entries by a dense vector.',
      description: md('The matrix is a list of `[row, col, value]` non-zero entries with `n_rows` rows; `vector` is dense. Return the product (length `n_rows`), touching only non-zero entries.'),
      hints: ['`out[row] += value * vector[col]` for each entry.'],
      entry: 'spmv',
      signature: 'spmv(entries: list[list], n_rows: int, vector: list[float]) -> list[float]',
      solution: code`def spmv(entries: list[list], n_rows: int, vector: list[float]) -> list[float]:
    out = [0] * n_rows
    for r, c, v in entries:
        out[r] += v * vector[c]
    return out
`,
      explanation: md('Storing only non-zeros makes work O(nnz) instead of O(rows × cols) — how recommendation and NLP matrices with millions of columns stay tractable.'),
      tests: [
        ex('Example', [[0, 0, 2], [0, 3, 1], [2, 1, -1]], 3, [1, 2, 3, 4]),
        ex('Empty matrix', [], 2, [1]),
        hid('Repeated row', [[1, 0, 1], [1, 1, 1], [1, 2, 1]], 2, [5, 5, 5]),
        hid('Negative values', [[0, 0, -1.5], [1, 1, 2]], 2, [2, -3]),
      ],
    }),

    python({
      id: 'spiral-order',
      title: 'Read a Matrix in Spiral Order',
      difficulty: 'Medium',
      topics: ['Matrices'],
      patterns: ['Shrinking boundaries'],
      domains: ['Logistics'],
      ...tag(dlp('Walmart', 'Spiral Matrix')),
      roles: DE,
      summary: 'Walk a warehouse grid clockwise from the outside in.',
      description: md('Return the elements of the rectangular matrix in clockwise spiral order starting at the top-left.'),
      hints: ['Keep top/bottom/left/right bounds and shrink one after each side; guard single rows/columns.'],
      entry: 'spiral',
      signature: 'spiral(matrix: list[list]) -> list',
      solution: code`def spiral(matrix: list[list]) -> list:
    out = []
    if not matrix:
        return out
    top, bottom, left, right = 0, len(matrix) - 1, 0, len(matrix[0]) - 1
    while top <= bottom and left <= right:
        out += [matrix[top][c] for c in range(left, right + 1)]
        out += [matrix[r][right] for r in range(top + 1, bottom + 1)]
        if top < bottom:
            out += [matrix[bottom][c] for c in range(right - 1, left - 1, -1)]
        if left < right:
            out += [matrix[r][left] for r in range(bottom - 1, top, -1)]
        top, bottom, left, right = top + 1, bottom - 1, left + 1, right - 1
    return out
`,
      explanation: md('The guards stop the bottom row / left column from being read twice when the remaining band is one row or one column thick.'),
      tests: [
        ex('Example', [[1, 2, 3], [4, 5, 6], [7, 8, 9]]),
        ex('Wide', [[1, 2, 3, 4], [5, 6, 7, 8]]),
        hid('Single column', [[1], [2], [3]]),
        hid('Empty', []),
      ],
    }),

    python({
      id: 'rotate-matrix',
      title: 'Rotate an Image 90° Clockwise',
      difficulty: 'Medium',
      topics: ['Matrices', 'Comprehensions'],
      patterns: ['Transpose + reverse'],
      domains: ['Media'],
      ...tag(dlp('Salesforce', 'Matrix Rotation'), dlp('Adobe', 'Clock-wise Matrix Rotation')),
      roles: DE,
      summary: 'Rotate a square matrix clockwise k quarter-turns.',
      description: md('Rotate the square matrix clockwise by `k` quarter turns (k may be any non-negative integer) and return it.'),
      hints: ['One clockwise turn = reverse the rows, then transpose: `[list(r) for r in zip(*m[::-1])]`. Only `k % 4` turns matter.'],
      entry: 'rotate',
      signature: 'rotate(matrix: list[list], k: int) -> list[list]',
      solution: code`def rotate(matrix: list[list], k: int) -> list[list]:
    m = [list(r) for r in matrix]
    for _ in range(k % 4):
        m = [list(r) for r in zip(*m[::-1])]
    return m
`,
      explanation: md('`zip(*reversed_rows)` reads columns bottom-to-top, which is exactly a clockwise turn. The in-place version swaps four cells at a time layer by layer.'),
      tests: [
        ex('Example', [[1, 2], [3, 4]], 1),
        ex('Full turn', [[1, 2], [3, 4]], 4),
        hid('Three by three twice', [[1, 2, 3], [4, 5, 6], [7, 8, 9]], 2),
        hid('Many turns', [[1, 2], [3, 4]], 7),
      ],
    }),

    python({
      id: 'pearson-correlation',
      title: 'Pearson Correlation by Hand',
      difficulty: 'Medium',
      topics: ['Math & Bits', 'Data Wrangling'],
      patterns: ['Covariance / standard deviations'],
      domains: ['Finance'],
      ...tag(dlp('AQR', 'Pearson Correlation Coefficient'), lds('Etsy', 'etsy', 'Price vs Quantity Correlation')),
      roles: DE_DS,
      summary: 'Compute Pearson\'s r between two series without NumPy.',
      description: md('Return Pearson\'s correlation of `x` and `y` (same length ≥ 2) rounded to 4, or `None` if either series is constant.'),
      hints: ['r = Σ(dx·dy) / √(Σdx² · Σdy²) with dx = x − mean(x).'],
      entry: 'pearson',
      signature: 'pearson(x: list[float], y: list[float])',
      solution: code`from math import sqrt

def pearson(x: list[float], y: list[float]):
    mx, my = sum(x) / len(x), sum(y) / len(y)
    dx = [a - mx for a in x]
    dy = [b - my for b in y]
    denom = sqrt(sum(a * a for a in dx) * sum(b * b for b in dy))
    if denom == 0:
        return None
    return round(sum(a * b for a, b in zip(dx, dy)) / denom, 4)
`,
      explanation: md('Centering first is numerically safer than the one-pass Σxy − n·x̄ȳ formula. Constant series have zero variance — correlation is undefined, not 0.'),
      tests: [
        ex('Example', [1, 2, 3, 4, 5], [2, 4, 5, 4, 5]),
        ex('Perfect negative', [1, 2, 3], [6, 4, 2]),
        hid('Constant series', [1, 1, 1], [1, 2, 3]),
        hid('Two points', [0, 1], [5, 9]),
      ],
    }),

    python({
      id: 'precision-recall',
      title: 'Precision and Recall from Raw Labels',
      difficulty: 'Easy',
      topics: ['Math & Bits', 'Data Wrangling'],
      patterns: ['Confusion matrix'],
      domains: ['Machine learning'],
      ...tag(ddp('Palantir', 'Precision and Recall')),
      roles: DE_DS,
      summary: 'Recompute precision, recall and F1 of a fraud classifier from 0/1 labels.',
      description: md('Given equal-length 0/1 lists `actual` and `predicted`, return `[precision, recall, f1]` rounded to 4; a metric whose denominator is 0 is `None` (and F1 is `None` if either is).'),
      hints: ['Count TP, FP, FN in one zip loop.'],
      entry: 'metrics',
      signature: 'metrics(actual: list[int], predicted: list[int]) -> list',
      solution: code`def metrics(actual: list[int], predicted: list[int]) -> list:
    tp = sum(1 for a, p in zip(actual, predicted) if a and p)
    fp = sum(1 for a, p in zip(actual, predicted) if not a and p)
    fn = sum(1 for a, p in zip(actual, predicted) if a and not p)
    precision = tp / (tp + fp) if tp + fp else None
    recall = tp / (tp + fn) if tp + fn else None
    if precision is None or recall is None or precision + recall == 0:
        f1 = None
    else:
        f1 = 2 * precision * recall / (precision + recall)
    r = lambda v: None if v is None else round(v, 4)
    return [r(precision), r(recall), r(f1)]
`,
      explanation: md('Precision = of what we flagged, how much was fraud; recall = of the fraud, how much we flagged. Handling empty denominators explicitly avoids a ZeroDivisionError or a misleading 0.'),
      tests: [
        ex('Example', [1, 0, 1, 1, 0, 0], [1, 1, 0, 1, 0, 0]),
        ex('Nothing predicted', [1, 0], [0, 0]),
        hid('Perfect', [1, 0, 1], [1, 0, 1]),
        hid('No positives at all', [0, 0], [0, 0]),
      ],
    }),

    python({
      id: 'quantile-calculator',
      title: 'Percentile of a Batch of Samples',
      difficulty: 'Easy',
      topics: ['Math & Bits', 'Sorting'],
      patterns: ['Linear interpolation'],
      domains: ['Platform / Ops'],
      ...tag(ddp('Netflix', 'Quantile Calculator')),
      roles: DE_DS,
      summary: 'Compute p50/p95/p99 latency with linear interpolation between ranks.',
      description: md('For each percentile p (0–100), return the value at that percentile of `samples` using linear interpolation: rank = p/100 × (n − 1) on the sorted samples (same as NumPy\'s default). Round to 4; empty samples give `None`.'),
      hints: ['lo = floor(rank), frac = rank − lo, value = s[lo] + frac × (s[lo+1] − s[lo]).'],
      entry: 'percentiles',
      signature: 'percentiles(samples: list[float], ps: list[float]) -> list',
      solution: code`import math

def percentiles(samples: list[float], ps: list[float]) -> list:
    if not samples:
        return [None for _ in ps]
    s = sorted(samples)
    out = []
    for p in ps:
        rank = p / 100 * (len(s) - 1)
        lo = math.floor(rank)
        hi = min(lo + 1, len(s) - 1)
        out.append(round(s[lo] + (rank - lo) * (s[hi] - s[lo]), 4))
    return out
`,
      explanation: md('Percentile definitions differ (nearest-rank vs interpolated); stating the method is half the answer. Interpolation gives smooth values for small batches.'),
      tests: [
        ex('Example', [15, 20, 35, 40, 50], [0, 50, 95, 100]),
        ex('Single sample', [7], [99]),
        hid('Empty', [], [50]),
        hid('Unsorted input', [3, 1, 2, 4], [25, 75]),
      ],
    }),
  ],
};
