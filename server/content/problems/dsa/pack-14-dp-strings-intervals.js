// DSA pack 14 — dynamic programming II: strings (LCS with reconstruction,
// longest common substring, palindromic subsequence & min insertions, shortest
// common supersequence, distinct subsequences, wildcard and regex matching),
// stocks (k transactions, cooldown, fee), LIS family (patience sorting,
// divisible subset, string chains, bitonic, count of LIS), and interval /
// partition DP (matrix chain, cutting a stick, bursting balloons, boolean
// parenthesisation, palindrome cuts, partition for max sum, square counts).
import { dsa, md, code, ex, hid } from './define.js';

const DP = ['Dynamic Programming'];
const DPS = ['Dynamic Programming', 'Strings'];

export default {
  problems: [
    dsa({
      id: 'dsa-lcs-reconstruct',
      title: 'Longest Common Subsequence — Length and One Answer',
      difficulty: 'Medium',
      topics: DPS,
      patterns: ['2-D DP with backtracking'],
      summary: 'Length of the LCS and the subsequence recovered from the table.',
      description: md('Return `[length, lcs]`. To reconstruct, walk back from the bottom-right: on equal characters take it and move diagonally; otherwise move up if `dp[i−1][j] >= dp[i][j−1]`, else left.'),
      hints: ['dp[i][j] = dp[i−1][j−1] + 1 if a[i−1] == b[j−1] else max(dp[i−1][j], dp[i][j−1]).'],
      signature: 'lcs(a: str, b: str) -> list',
      solution: code`def lcs(a: str, b: str) -> list:
    n, m = len(a), len(b)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            dp[i][j] = dp[i - 1][j - 1] + 1 if a[i - 1] == b[j - 1] else max(dp[i - 1][j], dp[i][j - 1])
    out, i, j = [], n, m
    while i and j:
        if a[i - 1] == b[j - 1]:
            out.append(a[i - 1])
            i -= 1
            j -= 1
        elif dp[i - 1][j] >= dp[i][j - 1]:
            i -= 1
        else:
            j -= 1
    return [dp[n][m], "".join(reversed(out))]
`,
      explanation: md('O(nm) time and space; the length alone needs only two rows. The fixed tie-break makes the reconstructed string deterministic.'),
      tests: [
        ex('Example', 'abcde', 'ace'),
        ex('None', 'abc', 'def'),
        hid('Ties', 'abcbdab', 'bdcaba'),
        hid('Empty', '', 'x'),
      ],
    }),

    dsa({
      id: 'dsa-longest-common-substring',
      title: 'Longest Common Contiguous Substring',
      difficulty: 'Medium',
      topics: DPS,
      patterns: ['Reset-on-mismatch DP'],
      summary: 'Longest substring appearing in both strings (earliest in a on ties).',
      description: md('Return `[length, substring]` for the longest string that is a contiguous substring of both `a` and `b`; on ties return the one ending earliest in `a`.'),
      hints: ['dp[i][j] = dp[i−1][j−1] + 1 when characters match, else 0.'],
      signature: 'common_substring(a: str, b: str) -> list',
      solution: code`def common_substring(a: str, b: str) -> list:
    best, end = 0, 0
    prev = [0] * (len(b) + 1)
    for i in range(1, len(a) + 1):
        cur = [0] * (len(b) + 1)
        for j in range(1, len(b) + 1):
            if a[i - 1] == b[j - 1]:
                cur[j] = prev[j - 1] + 1
                if cur[j] > best:
                    best, end = cur[j], i
        prev = cur
    return [best, a[end - best:end]]
`,
      explanation: md('Unlike subsequences, a mismatch breaks the run, so the cell resets to 0. O(nm) time, O(m) space.'),
      tests: [
        ex('Example', 'abcdxyz', 'xyzabcd'),
        ex('None', 'abc', 'xyz'),
        hid('Repeated', 'aaaa', 'aa'),
        hid('Middle', 'zxabcdezy', 'yzabcdezx'),
      ],
    }),

    dsa({
      id: 'dsa-palindromic-subsequence',
      title: 'Longest Palindromic Subsequence and Fewest Insertions',
      difficulty: 'Medium',
      topics: DPS,
      patterns: ['LCS with the reverse'],
      summary: 'Length of the longest palindromic subsequence and min insertions to make a palindrome.',
      description: md('Return `[lps_length, min_insertions]` where min insertions is the fewest characters to insert anywhere to make `s` a palindrome.'),
      hints: ['LPS(s) = LCS(s, reverse(s)); insertions = len(s) − LPS.'],
      signature: 'palindrome_dp(s: str) -> list[int]',
      solution: code`def palindrome_dp(s: str) -> list[int]:
    t = s[::-1]
    prev = [0] * (len(t) + 1)
    for i in range(1, len(s) + 1):
        cur = [0] * (len(t) + 1)
        for j in range(1, len(t) + 1):
            cur[j] = prev[j - 1] + 1 if s[i - 1] == t[j - 1] else max(prev[j], cur[j - 1])
        prev = cur
    lps = prev[-1]
    return [lps, len(s) - lps]
`,
      explanation: md('Characters outside the longest palindromic subsequence each need a mirror inserted. Min deletions to make a palindrome is the same number.'),
      tests: [
        ex('Example', 'bbbab'),
        ex('Another', 'mbadm'),
        hid('Already palindrome', 'racecar'),
        hid('Distinct letters', 'abcd'),
      ],
    }),

    dsa({
      id: 'dsa-shortest-supersequence',
      title: 'Shortest String Containing Both as Subsequences',
      difficulty: 'Hard',
      topics: DPS,
      patterns: ['Merge along the LCS'],
      summary: 'Build the shortest common supersequence.',
      description: md('Return the shortest string that has both `a` and `b` as subsequences. Build it by walking the LCS table back from the end: on equal characters emit once; otherwise emit from `a` when `dp[i−1][j] >= dp[i][j−1]`, else from `b`; then emit leftovers.'),
      hints: ['Length = |a| + |b| − LCS.'],
      signature: 'shortest_supersequence(a: str, b: str) -> str',
      solution: code`def shortest_supersequence(a: str, b: str) -> str:
    n, m = len(a), len(b)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            dp[i][j] = dp[i - 1][j - 1] + 1 if a[i - 1] == b[j - 1] else max(dp[i - 1][j], dp[i][j - 1])
    out, i, j = [], n, m
    while i and j:
        if a[i - 1] == b[j - 1]:
            out.append(a[i - 1])
            i -= 1
            j -= 1
        elif dp[i - 1][j] >= dp[i][j - 1]:
            out.append(a[i - 1])
            i -= 1
        else:
            out.append(b[j - 1])
            j -= 1
    out.extend(reversed(a[:i]))
    out.extend(reversed(b[:j]))
    return "".join(reversed(out))
`,
      explanation: md('Shared LCS characters are written once; everything else is interleaved in order. O(nm).'),
      tests: [
        ex('Example', 'abac', 'cab'),
        ex('Disjoint', 'abc', 'xyz'),
        hid('One contains the other', 'brute', 'rue'),
        hid('Empty', '', 'abc'),
      ],
    }),

    dsa({
      id: 'dsa-distinct-subsequences',
      title: 'How Many Times Does t Appear as a Subsequence of s?',
      difficulty: 'Hard',
      topics: DPS,
      patterns: ['Counting DP (reverse inner loop)'],
      summary: 'Count distinct index sets of s that spell t.',
      description: md('Return the number of distinct ways to delete characters from `s` to obtain `t`, modulo `1_000_000_007`.'),
      hints: ['ways[j] += ways[j − 1] when s[i] == t[j − 1], looping j downward.'],
      signature: 'num_distinct(s: str, t: str) -> int',
      solution: code`def num_distinct(s: str, t: str) -> int:
    MOD = 1_000_000_007
    ways = [1] + [0] * len(t)
    for ch in s:
        for j in range(len(t), 0, -1):
            if t[j - 1] == ch:
                ways[j] = (ways[j] + ways[j - 1]) % MOD
    return ways[-1]
`,
      explanation: md('Each character of s either extends a partial match of t or is skipped. O(|s| · |t|) time, O(|t|) space.'),
      tests: [
        ex('Example', 'rabbbit', 'rabbit'),
        ex('Another', 'babgbag', 'bag'),
        hid('Empty target', 'abc', ''),
        hid('Too long', 'ab', 'abc'),
      ],
    }),

    dsa({
      id: 'dsa-wildcard-match',
      title: 'Match a Pattern with ? and *',
      difficulty: 'Hard',
      topics: DPS,
      patterns: ['2-D matching DP'],
      summary: '? matches one character, * matches any sequence (including empty).',
      description: md('For each `[text, pattern]` return whether the pattern matches the entire text.'),
      hints: ['dp[i][j]: text[:i] vs pattern[:j]. "*" → dp[i][j−1] (empty) or dp[i−1][j] (consume one).'],
      signature: 'wildcard(cases: list[list[str]]) -> list[bool]',
      solution: code`def wildcard(cases: list[list[str]]) -> list[bool]:
    out = []
    for s, p in cases:
        n, m = len(s), len(p)
        dp = [[False] * (m + 1) for _ in range(n + 1)]
        dp[0][0] = True
        for j in range(1, m + 1):
            dp[0][j] = dp[0][j - 1] and p[j - 1] == "*"
        for i in range(1, n + 1):
            for j in range(1, m + 1):
                if p[j - 1] == "*":
                    dp[i][j] = dp[i][j - 1] or dp[i - 1][j]
                elif p[j - 1] == "?" or p[j - 1] == s[i - 1]:
                    dp[i][j] = dp[i - 1][j - 1]
        out.append(dp[n][m])
    return out
`,
      explanation: md('O(nm). A greedy two-pointer with backtracking to the last "*" also works in O(nm) worst case but O(n + m) typically.'),
      tests: [
        ex('Example', [['aa', 'a'], ['aa', '*'], ['cb', '?a'], ['adceb', '*a*b']]),
        ex('Empty text', [['', '***'], ['', '?']]),
        hid('Tricky', [['acdcb', 'a*c?b'], ['abcabczzzde', '*abc???de*']]),
        hid('Exact', [['data', 'data'], ['data', 'dat']]),
      ],
    }),

    dsa({
      id: 'dsa-regex-match',
      title: 'Match a Pattern with . and *',
      difficulty: 'Hard',
      topics: DPS,
      patterns: ['2-D matching DP'],
      summary: '"." matches any character; "x*" matches zero or more of x.',
      description: md('For each `[text, pattern]` return whether the regex-like pattern (only `.` and `*`, where `*` applies to the preceding element) matches the whole text.'),
      hints: ['On "*" at p[j−1]: zero copies → dp[i][j−2]; one more copy → dp[i−1][j] if p[j−2] matches s[i−1].'],
      signature: 'regex(cases: list[list[str]]) -> list[bool]',
      solution: code`def regex(cases: list[list[str]]) -> list[bool]:
    out = []
    for s, p in cases:
        n, m = len(s), len(p)
        dp = [[False] * (m + 1) for _ in range(n + 1)]
        dp[0][0] = True
        for j in range(2, m + 1):
            dp[0][j] = p[j - 1] == "*" and dp[0][j - 2]
        for i in range(1, n + 1):
            for j in range(1, m + 1):
                if p[j - 1] == "*":
                    dp[i][j] = dp[i][j - 2] or (p[j - 2] in (s[i - 1], ".") and dp[i - 1][j])
                else:
                    dp[i][j] = p[j - 1] in (s[i - 1], ".") and dp[i - 1][j - 1]
        out.append(dp[n][m])
    return out
`,
      explanation: md('The star binds to the previous token, so transitions look two pattern characters back. O(nm).'),
      tests: [
        ex('Example', [['aa', 'a'], ['aa', 'a*'], ['ab', '.*']]),
        ex('Zero copies', [['aab', 'c*a*b']]),
        hid('No match', [['mississippi', 'mis*is*p*.'], ['ab', '.*c']]),
        hid('Empty', [['', 'a*b*'], ['', '.']]),
      ],
    }),

    dsa({
      id: 'dsa-stock-k-trades',
      title: 'Best Profit with at Most k Trades',
      difficulty: 'Hard',
      topics: DP,
      patterns: ['Buy/sell states per transaction'],
      summary: 'Maximum profit using at most k buy-sell pairs (no overlap).',
      description: md('For each k in `ks`, return the maximum profit with at most k transactions (buy before sell; hold at most one share).'),
      hints: ['buy[t] = max(buy[t], sell[t−1] − p); sell[t] = max(sell[t], buy[t] + p).'],
      signature: 'max_profit_k(prices: list[int], ks: list[int]) -> list[int]',
      solution: code`def max_profit_k(prices: list[int], ks: list[int]) -> list[int]:
    out = []
    for k in ks:
        if k == 0 or not prices:
            out.append(0)
            continue
        buy = [float("-inf")] * (k + 1)
        sell = [0] * (k + 1)
        for p in prices:
            for t in range(1, k + 1):
                buy[t] = max(buy[t], sell[t - 1] - p)
                sell[t] = max(sell[t], buy[t] + p)
        out.append(sell[k])
    return out
`,
      explanation: md('k = 1 and k = ∞ are the familiar special cases; the state machine generalises them in O(n · k). When k ≥ n/2, it equals unlimited trading.'),
      tests: [
        ex('Example', [3, 3, 5, 0, 0, 3, 1, 4], [1, 2]),
        ex('Two trades', [3, 2, 6, 5, 0, 3], [2]),
        hid('Falling prices', [7, 6, 4, 3, 1], [1, 3]),
        hid('Many trades', [1, 2, 4, 2, 5, 7, 2, 4, 9, 0], [0, 1, 2, 4]),
      ],
    }),

    dsa({
      id: 'dsa-stock-cooldown-fee',
      title: 'Unlimited Trading with a Cooldown, or with a Fee',
      difficulty: 'Medium',
      topics: DP,
      patterns: ['Hold / sold / rest state machine'],
      summary: 'Max profit with a one-day cooldown after selling, and with a per-trade fee.',
      description: md('Return `[profit_with_cooldown, profit_with_fee]`: unlimited transactions where (1) after a sale you can’t buy the next day, and (2) each completed sale costs `fee`.'),
      hints: ['Cooldown: hold, sold, rest = max(hold, rest − p), hold + p, max(rest, sold). Fee: subtract it when selling.'],
      signature: 'stock_variants(prices: list[int], fee: int) -> list[int]',
      solution: code`def stock_variants(prices: list[int], fee: int) -> list[int]:
    hold, sold, rest = float("-inf"), 0, 0
    for p in prices:
        hold, sold, rest = max(hold, rest - p), hold + p, max(rest, sold)
    cooldown = max(sold, rest)
    cash, held = 0, float("-inf")
    for p in prices:
        cash, held = max(cash, held + p - fee), max(held, cash - p)
    return [cooldown, cash]
`,
      explanation: md('Each variant is a tiny finite-state machine updated per day: O(n), O(1).'),
      tests: [
        ex('Example', [1, 2, 3, 0, 2], 2),
        ex('Fee example', [1, 3, 2, 8, 4, 9], 2),
        hid('Single day', [5], 1),
        hid('Fee eats profit', [1, 2, 1, 2], 5),
      ],
    }),

    dsa({
      id: 'dsa-lis-patience',
      title: 'Longest Increasing Subsequence in O(n log n), with One Answer',
      difficulty: 'Medium',
      topics: [...DP, 'Binary Search'],
      patterns: ['Patience sorting + parent links'],
      summary: 'Length and an actual strictly increasing subsequence.',
      description: md('Return `[length, sequence]` using the tails-array method; reconstruct via parent links from the element that ends the longest tail (the last one placed at the final length).'),
      hints: ['tails[k] = index of the smallest possible tail of an increasing subsequence of length k + 1.'],
      signature: 'lis(nums: list[int]) -> list',
      solution: code`from bisect import bisect_left

def lis(nums: list[int]) -> list:
    tails, tail_idx, parent = [], [], [-1] * len(nums)
    for i, x in enumerate(nums):
        k = bisect_left(tails, x)
        if k == len(tails):
            tails.append(x)
            tail_idx.append(i)
        else:
            tails[k] = x
            tail_idx[k] = i
        parent[i] = tail_idx[k - 1] if k else -1
    seq, i = [], tail_idx[-1] if tail_idx else -1
    while i != -1:
        seq.append(nums[i])
        i = parent[i]
    return [len(tails), seq[::-1]]
`,
      explanation: md('The tails array stays sorted, so each element’s position is a binary search: O(n log n). Parent pointers recover an actual sequence.'),
      tests: [
        ex('Example', [10, 9, 2, 5, 3, 7, 101, 18]),
        ex('Duplicates', [7, 7, 7]),
        hid('Increasing', [1, 2, 3, 4]),
        hid('Empty', []),
      ],
    }),

    dsa({
      id: 'dsa-divisible-subset',
      title: 'Largest Set Where Every Pair Divides',
      difficulty: 'Medium',
      topics: DP,
      patterns: ['Sort + LIS-style DP'],
      summary: 'Largest subset in which for every pair one divides the other.',
      description: md('Return the largest subset (sorted ascending) of distinct positive integers where every pair (a, b) has a % b == 0 or b % a == 0. On ties, prefer the subset found first by the DP (smallest ending element, earliest predecessor).'),
      hints: ['Sort; dp[i] = 1 + max dp[j] for j < i with a[i] % a[j] == 0; keep parents.'],
      signature: 'divisible_subset(nums: list[int]) -> list[int]',
      solution: code`def divisible_subset(nums: list[int]) -> list[int]:
    a = sorted(nums)
    n = len(a)
    if not n:
        return []
    dp, parent = [1] * n, [-1] * n
    for i in range(n):
        for j in range(i):
            if a[i] % a[j] == 0 and dp[j] + 1 > dp[i]:
                dp[i], parent[i] = dp[j] + 1, j
    i = max(range(n), key=lambda k: (dp[k], -k))
    out = []
    while i != -1:
        out.append(a[i])
        i = parent[i]
    return out[::-1]
`,
      explanation: md('After sorting, divisibility is transitive along a chain, so it suffices that each new element is divisible by the chain’s last element. O(n²).'),
      tests: [
        ex('Example', [1, 2, 3]),
        ex('Chain', [1, 2, 4, 8]),
        hid('Mixed', [3, 4, 16, 8]),
        hid('Empty', []),
      ],
    }),

    dsa({
      id: 'dsa-word-chain',
      title: 'Longest Chain of Words Growing by One Letter',
      difficulty: 'Medium',
      topics: [...DP, 'Hashing', 'Strings'],
      patterns: ['DP over words sorted by length'],
      summary: 'Each next word inserts exactly one letter into the previous one.',
      description: md('Return the length of the longest chain `w1, w2, …` where each word is formed by inserting one letter anywhere in the previous word.'),
      hints: ['Process words by length; best[w] = 1 + max best[w without one letter].'],
      signature: 'longest_chain(words: list[str]) -> int',
      solution: code`def longest_chain(words: list[str]) -> int:
    best = {}
    for w in sorted(set(words), key=len):
        best[w] = 1 + max((best.get(w[:i] + w[i + 1:], 0) for i in range(len(w))), default=0)
    return max(best.values(), default=0)
`,
      explanation: md('Generating predecessors (delete one letter) is O(L) per word versus comparing all pairs. O(n · L²).'),
      tests: [
        ex('Example', ['a', 'b', 'ba', 'bca', 'bda', 'bdca']),
        ex('Another', ['xbc', 'pcxbcf', 'xb', 'cxbc', 'pcxbc']),
        hid('No chain', ['abcd', 'dbqca']),
        hid('Empty', []),
      ],
    }),

    dsa({
      id: 'dsa-longest-bitonic',
      title: 'Longest Rise-Then-Fall Subsequence',
      difficulty: 'Medium',
      topics: DP,
      patterns: ['LIS from both ends'],
      summary: 'Longest subsequence that strictly increases then strictly decreases.',
      description: md('Return the length of the longest bitonic subsequence (purely increasing or purely decreasing also count).'),
      hints: ['inc[i] = LIS ending at i; dec[i] = LDS starting at i; answer = max(inc + dec − 1).'],
      signature: 'longest_bitonic(nums: list[int]) -> int',
      solution: code`def longest_bitonic(nums: list[int]) -> int:
    n = len(nums)
    inc, dec = [1] * n, [1] * n
    for i in range(n):
        for j in range(i):
            if nums[j] < nums[i]:
                inc[i] = max(inc[i], inc[j] + 1)
    for i in range(n - 1, -1, -1):
        for j in range(i + 1, n):
            if nums[j] < nums[i]:
                dec[i] = max(dec[i], dec[j] + 1)
    return max((inc[i] + dec[i] - 1 for i in range(n)), default=0)
`,
      explanation: md('Every bitonic sequence has a peak; combining the best rise into it and fall out of it covers all of them. O(n²).'),
      tests: [
        ex('Example', [1, 11, 2, 10, 4, 5, 2, 1]),
        ex('Increasing', [1, 2, 3]),
        hid('Plateau', [5, 5, 5]),
        hid('Empty', []),
      ],
    }),

    dsa({
      id: 'dsa-count-lis',
      title: 'How Many Longest Increasing Subsequences?',
      difficulty: 'Medium',
      topics: DP,
      patterns: ['Length + count DP'],
      summary: 'Count the strictly increasing subsequences of maximum length.',
      description: md('Return the number of longest strictly increasing subsequences (by index set).'),
      hints: ['For each i keep (length, count); a longer predecessor resets the count, an equal one adds to it.'],
      signature: 'count_lis(nums: list[int]) -> int',
      solution: code`def count_lis(nums: list[int]) -> int:
    n = len(nums)
    length, count = [1] * n, [1] * n
    for i in range(n):
        for j in range(i):
            if nums[j] < nums[i]:
                if length[j] + 1 > length[i]:
                    length[i], count[i] = length[j] + 1, count[j]
                elif length[j] + 1 == length[i]:
                    count[i] += count[j]
    best = max(length, default=0)
    return sum(c for l, c in zip(length, count) if l == best)
`,
      explanation: md('Augmenting the LIS DP with counts answers "how many" in the same O(n²).'),
      tests: [
        ex('Example', [1, 3, 5, 4, 7]),
        ex('All equal', [2, 2, 2, 2, 2]),
        hid('Branching', [1, 2, 4, 3, 5, 4, 7, 2]),
        hid('Empty', []),
      ],
    }),

    dsa({
      id: 'dsa-matrix-chain',
      title: 'Cheapest Order to Multiply a Chain of Matrices',
      difficulty: 'Hard',
      topics: DP,
      patterns: ['Interval DP (split point)'],
      summary: 'Minimum scalar multiplications and the parenthesisation.',
      description: md('Matrix i has dimensions `dims[i] × dims[i + 1]`. Return `[min_cost, parenthesisation]` using names A, B, C, … (e.g. `"((AB)C)"`), choosing the smallest split index on ties.'),
      hints: ['cost[i][j] = min over k of cost[i][k] + cost[k+1][j] + dims[i]·dims[k+1]·dims[j+1].'],
      signature: 'matrix_chain(dims: list[int]) -> list',
      solution: code`def matrix_chain(dims: list[int]) -> list:
    n = len(dims) - 1
    cost = [[0] * n for _ in range(n)]
    split = [[0] * n for _ in range(n)]
    for length in range(2, n + 1):
        for i in range(n - length + 1):
            j = i + length - 1
            cost[i][j] = float("inf")
            for k in range(i, j):
                c = cost[i][k] + cost[k + 1][j] + dims[i] * dims[k + 1] * dims[j + 1]
                if c < cost[i][j]:
                    cost[i][j], split[i][j] = c, k
    def show(i, j):
        if i == j:
            return chr(65 + i)
        k = split[i][j]
        return "(" + show(i, k) + show(k + 1, j) + ")"
    return [cost[0][n - 1], show(0, n - 1)]
`,
      explanation: md('The canonical interval DP: solve every contiguous range by trying the last split. O(n³).'),
      tests: [
        ex('Example', [40, 20, 30, 10, 30]),
        ex('Two matrices', [10, 20, 30]),
        hid('Four', [10, 20, 30, 40, 30]),
        hid('Single', [5, 6]),
      ],
    }),

    dsa({
      id: 'dsa-cut-stick',
      title: 'Cheapest Way to Cut a Stick',
      difficulty: 'Hard',
      topics: DP,
      patterns: ['Interval DP over cut positions'],
      summary: 'Each cut costs the current piece length; choose the order.',
      description: md('A stick of length `n` must be cut at all positions in `cuts`; a cut costs the length of the piece being cut. Return the minimum total cost.'),
      hints: ['Add 0 and n, sort; cost[i][j] = (c[j] − c[i]) + min over k in (i, j) of cost[i][k] + cost[k][j].'],
      signature: 'min_cut_cost(n: int, cuts: list[int]) -> int',
      solution: code`def min_cut_cost(n: int, cuts: list[int]) -> int:
    c = [0] + sorted(cuts) + [n]
    m = len(c)
    dp = [[0] * m for _ in range(m)]
    for gap in range(2, m):
        for i in range(m - gap):
            j = i + gap
            dp[i][j] = c[j] - c[i] + min(dp[i][k] + dp[k][j] for k in range(i + 1, j))
    return dp[0][m - 1]
`,
      explanation: md('Think of the first cut inside each segment; the two halves are independent subproblems. O(k³) for k cuts.'),
      tests: [
        ex('Example', 7, [1, 3, 4, 5]),
        ex('Another', 9, [5, 6, 1, 4, 2]),
        hid('Single cut', 10, [3]),
        hid('No cuts', 5, []),
      ],
    }),

    dsa({
      id: 'dsa-burst-balloons',
      title: 'Burst Balloons for the Most Coins',
      difficulty: 'Hard',
      topics: DP,
      patterns: ['Interval DP choosing the last balloon'],
      summary: 'Bursting i earns left · i · right; maximise the total.',
      description: md('Bursting balloon i earns `nums[left] * nums[i] * nums[right]` where left/right are its current neighbours (missing neighbours count as 1). Return the maximum coins.'),
      hints: ['Pad with 1s; dp[l][r] = max over k (the last balloon in (l, r)) of a[l]·a[k]·a[r] + dp[l][k] + dp[k][r].'],
      signature: 'max_coins(nums: list[int]) -> int',
      solution: code`def max_coins(nums: list[int]) -> int:
    a = [1] + nums + [1]
    n = len(a)
    dp = [[0] * n for _ in range(n)]
    for gap in range(2, n):
        for l in range(n - gap):
            r = l + gap
            dp[l][r] = max(a[l] * a[k] * a[r] + dp[l][k] + dp[k][r] for k in range(l + 1, r))
    return dp[0][n - 1]
`,
      explanation: md('Choosing the **last** balloon to burst in a range fixes its neighbours (the range ends), making the halves independent. O(n³).'),
      tests: [
        ex('Example', [3, 1, 5, 8]),
        ex('Two', [1, 5]),
        hid('Single', [7]),
        hid('Empty', []),
      ],
    }),

    dsa({
      id: 'dsa-boolean-parenthesisation',
      title: 'Ways to Parenthesise a Boolean Expression to True',
      difficulty: 'Hard',
      topics: DPS,
      patterns: ['Interval DP with (true, false) counts'],
      summary: 'Count parenthesisations of T/F with & | ^ that evaluate to True.',
      description: md('The expression alternates symbols `T`/`F` and operators `&`, `|`, `^`. Return the number of ways to fully parenthesise it so it evaluates to True, modulo `1_000_000_007`.'),
      hints: ['For each range keep (ways_true, ways_false); combine at every operator by its truth table.'],
      signature: 'count_true(expr: str) -> int',
      solution: code`from functools import lru_cache

def count_true(expr: str) -> int:
    MOD = 1_000_000_007

    @lru_cache(maxsize=None)
    def go(i, j):
        if i == j:
            return (1, 0) if expr[i] == "T" else (0, 1)
        t = f = 0
        for k in range(i + 1, j, 2):
            lt, lf = go(i, k - 1)
            rt, rf = go(k + 1, j)
            op = expr[k]
            if op == "&":
                t += lt * rt
                f += lt * rf + lf * rt + lf * rf
            elif op == "|":
                t += lt * rt + lt * rf + lf * rt
                f += lf * rf
            else:
                t += lt * rf + lf * rt
                f += lt * rt + lf * rf
        return t % MOD, f % MOD

    return go(0, len(expr) - 1)[0]
`,
      explanation: md('Counting both outcomes per range lets each operator combine sub-results by its truth table. O(n³).'),
      tests: [
        ex('Example', 'T|T&F^T'),
        ex('Another', 'T^F|F'),
        hid('Single', 'F'),
        hid('All and', 'T&T&T'),
      ],
    }),

    dsa({
      id: 'dsa-palindrome-min-cuts',
      title: 'Fewest Cuts So Every Piece Is a Palindrome',
      difficulty: 'Hard',
      topics: DPS,
      patterns: ['Front partition DP + palindrome table'],
      summary: 'Minimum cuts to partition a string into palindromes.',
      description: md('Return the minimum number of cuts needed to split `s` into palindromic pieces.'),
      hints: ['cuts[i] = min(cuts[j − 1] + 1) over palindromic s[j..i]; expand around centres to fill it in O(n²).'],
      signature: 'min_cuts(s: str) -> int',
      solution: code`def min_cuts(s: str) -> int:
    n = len(s)
    if n == 0:
        return 0
    cuts = list(range(-1, n))
    for c in range(n):
        for lo, hi in ((c, c), (c, c + 1)):
            while lo >= 0 and hi < n and s[lo] == s[hi]:
                cuts[hi + 1] = min(cuts[hi + 1], cuts[lo] + 1)
                lo -= 1
                hi += 1
    return cuts[n]
`,
      explanation: md('Expanding palindromes from each centre updates the cut count for every palindrome ending position: O(n²) time, O(n) space.'),
      tests: [
        ex('Example', 'aab'),
        ex('Already palindrome', 'racecar'),
        hid('Distinct', 'abcd'),
        hid('Long', 'ababbbabbababa'),
      ],
    }),

    dsa({
      id: 'dsa-partition-max-sum',
      title: 'Split into Blocks of ≤ k and Max Each Block',
      difficulty: 'Medium',
      topics: DP,
      patterns: ['Front partition DP'],
      summary: 'Each block’s values become its maximum; maximise the total.',
      description: md('Partition `nums` into contiguous blocks of length at most `k`; every element becomes its block’s maximum. Return the largest possible sum.'),
      hints: ['dp[i] = max over block length L ≤ k of dp[i − L] + L · max(last L elements).'],
      signature: 'max_partition_sum(nums: list[int], k: int) -> int',
      solution: code`def max_partition_sum(nums: list[int], k: int) -> int:
    n = len(nums)
    dp = [0] * (n + 1)
    for i in range(1, n + 1):
        best = 0
        for L in range(1, min(k, i) + 1):
            best = max(best, nums[i - L])
            dp[i] = max(dp[i], dp[i - L] + best * L)
    return dp[n]
`,
      explanation: md('"Front partition" DP: decide the last block’s length, keep a running max. O(n · k).'),
      tests: [
        ex('Example', [1, 15, 7, 9, 2, 5, 10], 3),
        ex('Another', [1, 4, 1, 5, 7, 3, 6, 1, 9, 9, 3], 4),
        hid('k = 1', [3, 1, 2], 1),
        hid('Single', [5], 3),
      ],
    }),

    dsa({
      id: 'dsa-count-squares',
      title: 'Count Squares of 1s, and the Largest One',
      difficulty: 'Medium',
      topics: [...DP, 'Matrices'],
      patterns: ['dp = 1 + min(top, left, diagonal)'],
      summary: 'Number of all-ones square submatrices and the largest square’s area.',
      description: md('Return `[square_count, largest_area]` for a 0/1 matrix.'),
      hints: ['dp[i][j] = side of the largest square ending at (i, j); it also counts squares ending there.'],
      signature: 'squares(mat: list[list[int]]) -> list[int]',
      solution: code`def squares(mat: list[list[int]]) -> list[int]:
    R, C = len(mat), len(mat[0])
    dp = [[0] * C for _ in range(R)]
    total = best = 0
    for i in range(R):
        for j in range(C):
            if mat[i][j]:
                dp[i][j] = 1 if i == 0 or j == 0 else 1 + min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
                total += dp[i][j]
                best = max(best, dp[i][j])
    return [total, best * best]
`,
      explanation: md('A square of side s ending at a cell contains squares of every side 1..s ending there, so summing the DP counts all squares. O(R · C).'),
      tests: [
        ex('Example', [[0, 1, 1, 1], [1, 1, 1, 1], [0, 1, 1, 1]]),
        ex('Small', [[1, 0, 1], [1, 1, 0], [1, 1, 0]]),
        hid('All zeros', [[0, 0], [0, 0]]),
        hid('All ones', [[1, 1, 1], [1, 1, 1], [1, 1, 1]]),
      ],
    }),
  ],
};
