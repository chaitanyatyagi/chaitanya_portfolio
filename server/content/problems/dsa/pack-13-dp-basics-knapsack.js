// DSA pack 13 — dynamic programming I: 1-D (stairs, frog jumps, house robber
// line & circle, training schedule), grids (obstacle paths, min path sum,
// triangle, falling path, two-walker cherry pickup), subsets & knapsack
// (subset sum, equal partition, min difference, count subsets, target
// difference, 0/1 knapsack, coin ways, unbounded knapsack, rod cutting),
// word break and egg drop.
import { dsa, md, code, ex, hid } from './define.js';

const DP = ['Dynamic Programming'];

export default {
  problems: [
    dsa({
      id: 'dsa-stair-ways',
      title: 'Ways to Climb Stairs Taking 1 or 2 Steps',
      difficulty: 'Easy',
      topics: DP,
      patterns: ['Fibonacci recurrence'],
      summary: 'Count distinct step sequences for each staircase height.',
      description: md('For each `n`, return the number of ways to climb `n` stairs taking 1 or 2 steps at a time.'),
      hints: ['ways(n) = ways(n − 1) + ways(n − 2); keep two variables.'],
      signature: 'stair_ways(heights: list[int]) -> list[int]',
      solution: code`def stair_ways(heights: list[int]) -> list[int]:
    out = []
    for n in heights:
        a, b = 1, 1
        for _ in range(n):
            a, b = b, a + b
        out.append(a)
    return out
`,
      explanation: md('The last move is either 1 or 2 steps, so the counts add. O(n) time, O(1) space — the template for all "rolling" 1-D DPs.'),
      tests: [
        ex('Example', [2, 3, 5]),
        ex('Zero stairs', [0, 1]),
        hid('Larger', [10, 30]),
        hid('Empty', []),
      ],
    }),

    dsa({
      id: 'dsa-frog-k-jumps',
      title: 'Cheapest Frog Route with Jumps up to k',
      difficulty: 'Medium',
      topics: DP,
      patterns: ['dp[i] = min over last jump'],
      summary: 'Minimum total |height difference| to reach the last stone.',
      description: md('A frog starts on stone 0 and may jump forward 1..k stones; the cost of a jump is the absolute height difference. Return the minimum cost to reach the last stone.'),
      hints: ['dp[i] = min(dp[i − j] + |h[i] − h[i − j]|) for j in 1..k.'],
      signature: 'frog_cost(heights: list[int], k: int) -> int',
      solution: code`def frog_cost(heights: list[int], k: int) -> int:
    n = len(heights)
    dp = [0] + [float("inf")] * (n - 1)
    for i in range(1, n):
        for j in range(1, min(k, i) + 1):
            dp[i] = min(dp[i], dp[i - j] + abs(heights[i] - heights[i - j]))
    return dp[-1]
`,
      explanation: md('Each stone’s best cost depends only on the previous k stones: O(n · k).'),
      tests: [
        ex('k = 2', [10, 20, 30, 10], 2),
        ex('k = 3', [10, 30, 40, 50, 20], 3),
        hid('Single stone', [5], 4),
        hid('k = 1', [1, 5, 2], 1),
      ],
    }),

    dsa({
      id: 'dsa-house-robber-line-and-ring',
      title: 'Rob Non-Adjacent Houses (Street and Circle)',
      difficulty: 'Medium',
      topics: DP,
      patterns: ['Take / skip with two variables'],
      summary: 'Max loot without robbing neighbours — for a street, and for houses in a circle.',
      description: md('Return `[best_on_a_street, best_in_a_circle]`. In the circle, the first and last houses are neighbours.'),
      hints: ['Circle = max(street without the first house, street without the last house).'],
      signature: 'rob(money: list[int]) -> list[int]',
      solution: code`def rob(money: list[int]) -> list[int]:
    def line(a):
        take = skip = 0
        for x in a:
            take, skip = skip + x, max(skip, take)
        return max(take, skip)
    if len(money) == 1:
        return [money[0], money[0]]
    return [line(money), max(line(money[1:]), line(money[:-1]))]
`,
      explanation: md('dp[i] = max(dp[i − 1], dp[i − 2] + a[i]); the circular constraint is removed by solving two linear sub-problems.'),
      tests: [
        ex('Example', [2, 7, 9, 3, 1]),
        ex('Circle matters', [2, 3, 2]),
        hid('Single', [5]),
        hid('Empty', []),
      ],
    }),

    dsa({
      id: 'dsa-training-schedule',
      title: 'Best Training Plan Without Repeating an Activity',
      difficulty: 'Medium',
      topics: DP,
      patterns: ['DP with "last choice" state'],
      summary: 'Pick one of three activities per day, never the same on consecutive days.',
      description: md('`points[d][a]` is the merit for doing activity `a` (0..2) on day `d`. You can’t do the same activity two days in a row. Return the maximum total.'),
      hints: ['dp[a] = best total ending today with activity a.'],
      signature: 'max_training(points: list[list[int]]) -> int',
      solution: code`def max_training(points: list[list[int]]) -> int:
    dp = [0, 0, 0]
    for day in points:
        dp = [day[a] + max(dp[b] for b in range(3) if b != a) for a in range(3)]
    return max(dp)
`,
      explanation: md('The constraint only links consecutive days, so the state is just yesterday’s activity: O(days · 9).'),
      tests: [
        ex('Example', [[10, 40, 70], [20, 50, 80], [30, 60, 90]]),
        ex('Single day', [[1, 2, 5]]),
        hid('Alternating best', [[18, 11, 19], [4, 13, 7], [1, 8, 13]]),
        hid('No days', []),
      ],
    }),

    dsa({
      id: 'dsa-grid-paths-obstacles',
      title: 'Routes Through a Grid with Blocked Cells',
      difficulty: 'Medium',
      topics: [...DP, 'Matrices'],
      patterns: ['Grid DP with a rolling row'],
      summary: 'Count right/down paths avoiding obstacles (1 = blocked).',
      description: md('Return the number of paths from the top-left to bottom-right moving only right or down, avoiding cells marked 1.'),
      hints: ['row[j] += row[j − 1], zeroing blocked cells.'],
      signature: 'paths_with_obstacles(grid: list[list[int]]) -> int',
      solution: code`def paths_with_obstacles(grid: list[list[int]]) -> int:
    cols = len(grid[0])
    row = [0] * cols
    row[0] = 1
    for r in grid:
        for j in range(cols):
            if r[j]:
                row[j] = 0
            elif j:
                row[j] += row[j - 1]
    return row[-1]
`,
      explanation: md('One row of state suffices because each cell depends only on the cell above (same slot) and to the left. O(R · C), O(C).'),
      tests: [
        ex('Example', [[0, 0, 0], [0, 1, 0], [0, 0, 0]]),
        ex('Blocked start', [[1, 0], [0, 0]]),
        hid('No obstacles', [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]),
        hid('Wall', [[0, 1], [1, 0]]),
      ],
    }),

    dsa({
      id: 'dsa-min-path-sum',
      title: 'Cheapest Right/Down Path Through a Grid',
      difficulty: 'Medium',
      topics: [...DP, 'Matrices'],
      patterns: ['Grid DP'],
      summary: 'Minimum sum path from top-left to bottom-right.',
      description: md('Return the minimum sum of a path moving only right or down.'),
      hints: ['dp[j] = grid[i][j] + min(dp[j] (from above), dp[j − 1] (from left)).'],
      signature: 'min_path_sum(grid: list[list[int]]) -> int',
      solution: code`def min_path_sum(grid: list[list[int]]) -> int:
    INF = float("inf")
    dp = [INF] * len(grid[0])
    dp[0] = 0
    for row in grid:
        for j, v in enumerate(row):
            dp[j] = v + min(dp[j], dp[j - 1] if j else INF)
    return dp[-1]
`,
      explanation: md('Same rolling-row structure as counting paths, with min instead of sum.'),
      tests: [
        ex('Example', [[1, 3, 1], [1, 5, 1], [4, 2, 1]]),
        ex('Two rows', [[1, 2, 3], [4, 5, 6]]),
        hid('Single cell', [[7]]),
        hid('Column', [[1], [2], [3]]),
      ],
    }),

    dsa({
      id: 'dsa-triangle-min-path',
      title: 'Cheapest Path Down a Number Triangle',
      difficulty: 'Medium',
      topics: DP,
      patterns: ['Bottom-up DP'],
      summary: 'From the top, move to an adjacent number on the row below; minimise the sum.',
      description: md('Return the minimum path sum from the top to the bottom of the triangle, moving from index i to i or i + 1 on the next row.'),
      hints: ['Start from the bottom row and fold upwards.'],
      signature: 'triangle_min(tri: list[list[int]]) -> int',
      solution: code`def triangle_min(tri: list[list[int]]) -> int:
    dp = list(tri[-1])
    for row in reversed(tri[:-1]):
        dp = [v + min(dp[i], dp[i + 1]) for i, v in enumerate(row)]
    return dp[0]
`,
      explanation: md('Bottom-up avoids the variable row widths and ends with the answer at the apex. O(n²) time, O(n) space.'),
      tests: [
        ex('Example', [[2], [3, 4], [6, 5, 7], [4, 1, 8, 3]]),
        ex('Single', [[-10]]),
        hid('Negatives', [[-1], [2, 3], [1, -1, -3]]),
        hid('Two rows', [[1], [2, 3]]),
      ],
    }),

    dsa({
      id: 'dsa-falling-path',
      title: 'Best Falling Path Through a Matrix',
      difficulty: 'Medium',
      topics: [...DP, 'Matrices'],
      patterns: ['Row DP with three parents'],
      summary: 'Maximum sum moving down to the cell below, below-left or below-right.',
      description: md('Start at any cell of the first row and move to row + 1 at column c − 1, c or c + 1. Return the **maximum** path sum ending anywhere on the last row.'),
      hints: ['dp[c] = a[r][c] + max(prev[c − 1], prev[c], prev[c + 1]).'],
      signature: 'max_falling(mat: list[list[int]]) -> int',
      solution: code`def max_falling(mat: list[list[int]]) -> int:
    prev = list(mat[0])
    n = len(prev)
    for row in mat[1:]:
        prev = [row[c] + max(prev[max(c - 1, 0):c + 2]) for c in range(n)]
    return max(prev)
`,
      explanation: md('A variable start/end is handled by initialising with the first row and taking the max at the end. O(R · C).'),
      tests: [
        ex('Example', [[1, 2, 10, 4], [100, 3, 2, 1], [1, 1, 20, 2], [1, 2, 2, 1]]),
        ex('Negatives', [[-1, -2], [-3, -4]]),
        hid('Single row', [[5, 9, 1]]),
        hid('Column', [[1], [2]]),
      ],
    }),

    dsa({
      id: 'dsa-two-walkers-grid',
      title: 'Two Collectors Moving Down a Grid',
      difficulty: 'Hard',
      topics: [...DP, 'Matrices'],
      patterns: ['3-D DP on (row, col1, col2)'],
      summary: 'Two robots start at the top corners and move down one row per step collecting chocolates.',
      description: md('Robot A starts at `(0, 0)`, robot B at `(0, C − 1)`. Each step both move to the next row, to column −1, 0 or +1 of their current column. A cell’s value is collected once even if both stand on it. Return the maximum total.'),
      hints: ['State (c1, c2) per row; 9 transitions.'],
      signature: 'two_collectors(grid: list[list[int]]) -> int',
      solution: code`def two_collectors(grid: list[list[int]]) -> int:
    R, C = len(grid), len(grid[0])
    NEG = float("-inf")
    dp = [[NEG] * C for _ in range(C)]
    dp[0][C - 1] = grid[0][0] + (grid[0][C - 1] if C > 1 else 0)
    for r in range(1, R):
        nxt = [[NEG] * C for _ in range(C)]
        for a in range(C):
            for b in range(C):
                if dp[a][b] == NEG:
                    continue
                for da in (-1, 0, 1):
                    for db in (-1, 0, 1):
                        x, y = a + da, b + db
                        if 0 <= x < C and 0 <= y < C:
                            gain = grid[r][x] + (grid[r][y] if x != y else 0)
                            nxt[x][y] = max(nxt[x][y], dp[a][b] + gain)
        dp = nxt
    return max(max(row) for row in dp)
`,
      explanation: md('Moving both walkers in lockstep makes "same cell" detection trivial. O(R · C² · 9).'),
      tests: [
        ex('Example', [[3, 1, 1], [2, 5, 1], [1, 5, 5], [2, 1, 1]]),
        ex('Another', [[1, 0, 0, 0, 0, 0, 1], [2, 0, 0, 0, 0, 3, 0], [2, 0, 9, 0, 0, 0, 0], [0, 3, 0, 5, 4, 0, 0], [1, 0, 2, 3, 0, 0, 6]]),
        hid('Single column', [[4], [5]]),
        hid('Two columns', [[1, 1], [1, 1]]),
      ],
    }),

    dsa({
      id: 'dsa-subset-sum-exists',
      title: 'Does Any Subset Reach the Target?',
      difficulty: 'Medium',
      topics: DP,
      patterns: ['Boolean knapsack (reverse loop)'],
      summary: 'Subset sum decision, and whether the list splits into two equal halves.',
      description: md('Return `[subset_with_sum_k_exists, can_partition_equally]` for non-negative integers.'),
      hints: ['reachable[s] |= reachable[s − x], iterating s downward so each item is used once. Equal partition = subset sum of total / 2.'],
      signature: 'subset_sum(nums: list[int], k: int) -> list[bool]',
      solution: code`def subset_sum(nums: list[int], k: int) -> list[bool]:
    def reach(target):
        if target < 0:
            return False
        ok = [True] + [False] * target
        for x in nums:
            for s in range(target, x - 1, -1):
                ok[s] = ok[s] or ok[s - x]
        return ok[target]
    total = sum(nums)
    return [reach(k), total % 2 == 0 and reach(total // 2)]
`,
      explanation: md('Pseudo-polynomial O(n · k). Iterating sums downward is what makes it 0/1 rather than unbounded. A Python int used as a bitset (`bits |= bits << x`) is a fast alternative.'),
      tests: [
        ex('Example', [3, 34, 4, 12, 5, 2], 9),
        ex('Partition', [1, 5, 11, 5], 30),
        hid('Odd total', [1, 2, 4], 3),
        hid('Zero target', [7], 0),
      ],
    }),

    dsa({
      id: 'dsa-min-subset-difference',
      title: 'Split into Two Groups with the Smallest Difference',
      difficulty: 'Hard',
      topics: DP,
      patterns: ['Reachable sums up to total / 2'],
      summary: 'Minimum |sum(A) − sum(B)| over all partitions.',
      description: md('Return the minimum absolute difference between the sums of two groups that partition `nums` (non-negative).'),
      hints: ['Find the largest reachable subset sum s ≤ total / 2; answer = total − 2s.'],
      signature: 'min_difference(nums: list[int]) -> int',
      solution: code`def min_difference(nums: list[int]) -> int:
    total = sum(nums)
    half = total // 2
    ok = [True] + [False] * half
    for x in nums:
        for s in range(half, x - 1, -1):
            ok[s] = ok[s] or ok[s - x]
    best = max(s for s in range(half + 1) if ok[s])
    return total - 2 * best
`,
      explanation: md('One side’s sum determines the other; the closer to half, the smaller the gap.'),
      tests: [
        ex('Example', [1, 6, 11, 5]),
        ex('Even split', [3, 1, 4, 2, 2]),
        hid('Single', [7]),
        hid('Two', [10, 3]),
      ],
    }),

    dsa({
      id: 'dsa-count-subsets-sum',
      title: 'Count Subsets with a Given Sum (Zeros Allowed)',
      difficulty: 'Medium',
      topics: DP,
      patterns: ['Counting knapsack'],
      summary: 'Number of subsets (by index) summing to k, modulo 1e9+7.',
      description: md('Return how many subsets of `nums` (different index sets count separately; values ≥ 0, zeros allowed) sum to `k`, modulo `1_000_000_007`. Also return how many ways to split `nums` into two groups whose sums differ by exactly `d` (sum(A) − sum(B) = d).'),
      hints: ['ways[s] += ways[s − x] (downward). Zeros double counts naturally. Difference d ⇒ sum(A) = (total + d) / 2.'],
      signature: 'count_subsets(nums: list[int], k: int, d: int) -> list[int]',
      solution: code`def count_subsets(nums: list[int], k: int, d: int) -> list[int]:
    MOD = 1_000_000_007

    def count(target):
        if target < 0:
            return 0
        ways = [1] + [0] * target
        for x in nums:
            for s in range(target, x - 1, -1):
                ways[s] = (ways[s] + ways[s - x]) % MOD
        return ways[target]

    total = sum(nums)
    split = count((total + d) // 2) if (total + d) % 2 == 0 and total >= d else 0
    return [count(k), split]
`,
      explanation: md('"Partitions with a given difference" and "target sum with ± signs" both reduce to counting subsets with sum (total + d) / 2.'),
      tests: [
        ex('Example', [1, 2, 2, 3], 3, 1),
        ex('Zeros', [0, 0, 1], 1, 1),
        hid('None', [5, 6], 3, 2),
        hid('Plus-minus signs', [1, 1, 1, 1, 1], 2, 3),
      ],
    }),

    dsa({
      id: 'dsa-knapsack-01',
      title: '0/1 Knapsack (and Which Items to Take)',
      difficulty: 'Medium',
      topics: DP,
      patterns: ['2-D table with reconstruction'],
      summary: 'Maximum value within capacity, plus the chosen item indices.',
      description: md('Items have `weights[i]` and `values[i]`; each can be taken once. Return `[best_value, chosen_indices]` where indices come from reconstructing the table backwards (prefer not taking an item on ties), ascending.'),
      hints: ['dp[i][c] = max(dp[i − 1][c], dp[i − 1][c − w] + v). Walk back from dp[n][W].'],
      signature: 'knapsack(weights: list[int], values: list[int], W: int) -> list',
      solution: code`def knapsack(weights: list[int], values: list[int], W: int) -> list:
    n = len(weights)
    dp = [[0] * (W + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        w, v = weights[i - 1], values[i - 1]
        for c in range(W + 1):
            dp[i][c] = dp[i - 1][c]
            if w <= c and dp[i - 1][c - w] + v > dp[i][c]:
                dp[i][c] = dp[i - 1][c - w] + v
    chosen, c = [], W
    for i in range(n, 0, -1):
        if dp[i][c] != dp[i - 1][c]:
            chosen.append(i - 1)
            c -= weights[i - 1]
    return [dp[n][W], sorted(chosen)]
`,
      explanation: md('O(n · W). A 1-D array (iterating capacity downward) gives the value in O(W) memory, but reconstruction needs the full table or a decision bitmap.'),
      tests: [
        ex('Example', [1, 3, 4, 5], [1, 4, 5, 7], 7),
        ex('Nothing fits', [5, 6], [10, 20], 4),
        hid('Take all', [1, 2], [3, 4], 10),
        hid('Classic', [10, 20, 30], [60, 100, 120], 50),
      ],
    }),

    dsa({
      id: 'dsa-coin-ways',
      title: 'How Many Ways to Make Change?',
      difficulty: 'Medium',
      topics: DP,
      patterns: ['Unbounded counting (coins outer loop)'],
      summary: 'Number of combinations (order doesn’t matter) of coins summing to the amount.',
      description: md('Return the number of combinations of coins (unlimited supply) that make `amount`. Also return the number of **ordered** sequences, to contrast the two loops.'),
      hints: ['Combinations: loop coins outside, amounts inside (ascending). Sequences: loop amounts outside.'],
      signature: 'coin_ways(coins: list[int], amount: int) -> list[int]',
      solution: code`def coin_ways(coins: list[int], amount: int) -> list[int]:
    combos = [1] + [0] * amount
    for c in coins:
        for s in range(c, amount + 1):
            combos[s] += combos[s - c]
    seqs = [1] + [0] * amount
    for s in range(1, amount + 1):
        seqs[s] = sum(seqs[s - c] for c in coins if c <= s)
    return [combos[amount], seqs[amount]]
`,
      explanation: md('Loop order decides whether {1, 2} and {2, 1} count once or twice — the most common bug in counting DPs.'),
      tests: [
        ex('Example', [1, 2, 5], 5),
        ex('Impossible', [2], 3),
        hid('Zero amount', [7], 0),
        hid('Larger', [2, 5, 3, 6], 10),
      ],
    }),

    dsa({
      id: 'dsa-unbounded-knapsack',
      title: 'Unbounded Knapsack and Rod Cutting',
      difficulty: 'Medium',
      topics: DP,
      patterns: ['Unbounded knapsack (ascending capacity)'],
      summary: 'Unlimited copies of each item; also cut a rod for maximum price.',
      description: md('Return `[best_knapsack_value, best_rod_price]`: the max value with capacity `W` taking items any number of times, and the max revenue from cutting a rod of length `len(prices)` where `prices[i]` is the price of a piece of length i + 1.'),
      hints: ['Iterate capacity upward so an item can be reused. Rod cutting is unbounded knapsack with weights 1..n.'],
      signature: 'unbounded(weights: list[int], values: list[int], W: int, prices: list[int]) -> list[int]',
      solution: code`def unbounded(weights: list[int], values: list[int], W: int, prices: list[int]) -> list[int]:
    dp = [0] * (W + 1)
    for c in range(1, W + 1):
        for w, v in zip(weights, values):
            if w <= c:
                dp[c] = max(dp[c], dp[c - w] + v)
    n = len(prices)
    rod = [0] * (n + 1)
    for L in range(1, n + 1):
        rod[L] = max(prices[k - 1] + rod[L - k] for k in range(1, L + 1))
    return [dp[W], rod[n]]
`,
      explanation: md('Same recurrence as 0/1 knapsack but reading the current row, which allows reuse. O(n · W).'),
      tests: [
        ex('Example', [2, 4, 6], [5, 11, 13], 10, [2, 5, 7, 8, 10]),
        ex('Nothing fits', [5], [10], 3, [1]),
        hid('Classic rod', [1], [1], 0, [1, 5, 8, 9, 10, 17, 17, 20]),
        hid('Greedy fails', [3, 4], [5, 7], 7, [3, 5, 8, 9]),
      ],
    }),

    dsa({
      id: 'dsa-word-break',
      title: 'Can the Text Be Split into Dictionary Words?',
      difficulty: 'Medium',
      topics: [...DP, 'Strings', 'Hashing'],
      patterns: ['Prefix DP'],
      summary: 'Decide segmentability and list every segmentation.',
      description: md('Return `[possible, sentences]`: whether `s` can be split into words from `words` (reusable), and all segmentations as space-joined strings, sorted.'),
      hints: ['ok[i] = any(ok[j] and s[j:i] in dict). For sentences, memoise suffix → list of sentences.'],
      signature: 'word_break(s: str, words: list[str]) -> list',
      solution: code`from functools import lru_cache

def word_break(s: str, words: list[str]) -> list:
    vocab = set(words)
    ok = [True] + [False] * len(s)
    for i in range(1, len(s) + 1):
        ok[i] = any(ok[j] and s[j:i] in vocab for j in range(i))

    @lru_cache(maxsize=None)
    def sentences(i):
        if i == len(s):
            return [""]
        out = []
        for j in range(i + 1, len(s) + 1):
            if s[i:j] in vocab:
                for rest in sentences(j):
                    out.append(s[i:j] + (" " + rest if rest else ""))
        return out

    return [ok[len(s)], sorted(sentences(0)) if ok[len(s)] else []]
`,
      explanation: md('The decision is O(n²) substring checks; listing sentences can be exponential, so memoising by suffix avoids recomputation.'),
      tests: [
        ex('Example', 'catsanddog', ['cat', 'cats', 'and', 'sand', 'dog']),
        ex('Impossible', 'catsandog', ['cats', 'dog', 'sand', 'and', 'cat']),
        hid('Reuse', 'applepenapple', ['apple', 'pen']),
        hid('Empty string', '', ['a']),
      ],
    }),

    dsa({
      id: 'dsa-egg-drop',
      title: 'Fewest Drops to Find the Critical Floor',
      difficulty: 'Hard',
      topics: DP,
      patterns: ['Invert the DP: floors coverable with m moves'],
      summary: 'With e eggs and n floors, the worst-case minimum number of drops.',
      description: md('For each `[eggs, floors]` return the minimum number of drops that guarantees finding the highest safe floor.'),
      hints: ['f(m, e) = f(m − 1, e − 1) + f(m − 1, e) + 1 floors can be covered with m moves; find the smallest m with f ≥ n.'],
      signature: 'egg_drop(cases: list[list[int]]) -> list[int]',
      solution: code`def egg_drop(cases: list[list[int]]) -> list[int]:
    out = []
    for eggs, floors in cases:
        cover = [0] * (eggs + 1)
        moves = 0
        while cover[eggs] < floors:
            moves += 1
            for e in range(eggs, 0, -1):
                cover[e] = cover[e - 1] + cover[e] + 1
        out.append(moves)
    return out
`,
      explanation: md('The direct DP over (eggs, floors) is O(e · n²) (or O(e · n log n) with binary search). Asking "how many floors can m drops handle" gives O(e · answer).'),
      tests: [
        ex('Example', [[1, 2], [2, 6], [3, 14]]),
        ex('Hundred floors', [[2, 100]]),
        hid('Zero floors', [[3, 0]]),
        hid('Many eggs', [[10, 1000], [1, 10]]),
      ],
    }),
  ],
};
