// DSA pack 02 — hashing, two pointers and sliding windows: pair/triple/quad
// sums, dedupe in place, water trapping, container area, and every window
// flavour (fixed, variable, at-most-k, exactly-k via at-most, need-map).
import { dsa, md, code, ex, hid } from './define.js';

export default {
  problems: [
    dsa({
      id: 'dsa-pair-to-target',
      title: 'Two Entries That Add Up to a Target',
      difficulty: 'Easy',
      topics: ['Hashing', 'Arrays'],
      patterns: ['Complement lookup'],
      summary: 'Return the indices of the first pair (by second index) summing to the target.',
      description: md('Return `[i, j]` (i < j) for the pair whose sum is `target`, choosing the smallest possible `j` (and for that j, the smallest i). Return `[]` if none.'),
      hints: ['Scan once, storing the first index of each value; check whether target − x was seen.'],
      signature: 'pair_sum(nums: list[int], target: int) -> list[int]',
      solution: code`def pair_sum(nums: list[int], target: int) -> list[int]:
    first = {}
    for j, x in enumerate(nums):
        if target - x in first:
            return [first[target - x], j]
        first.setdefault(x, j)
    return []
`,
      explanation: md('A hash map turns the O(n²) pair check into O(n): for each element look up the complement among earlier elements.'),
      tests: [
        ex('Example', [2, 7, 11, 15], 9),
        ex('Duplicates', [3, 3], 6),
        hid('None', [1, 2, 3], 7),
        hid('Earliest closing index', [1, 4, 2, 3, 0], 4),
      ],
    }),

    dsa({
      id: 'dsa-triplets-zero',
      title: 'All Distinct Triples Summing to Zero',
      difficulty: 'Medium',
      topics: ['Two Pointers', 'Sorting'],
      patterns: ['Sort + fix one + two pointers'],
      summary: 'List every unique triple of values that sums to 0.',
      description: md('Return all unique triples `[a, b, c]` (a ≤ b ≤ c) of values from `nums` at distinct indices with `a + b + c == 0`, sorted lexicographically.'),
      hints: ['Sort; for each i run two pointers on the rest; skip duplicate values at each pointer.'],
      signature: 'three_sum(nums: list[int]) -> list[list[int]]',
      solution: code`def three_sum(nums: list[int]) -> list[list[int]]:
    a, out = sorted(nums), []
    for i in range(len(a) - 2):
        if i and a[i] == a[i - 1]:
            continue
        lo, hi = i + 1, len(a) - 1
        while lo < hi:
            s = a[i] + a[lo] + a[hi]
            if s < 0:
                lo += 1
            elif s > 0:
                hi -= 1
            else:
                out.append([a[i], a[lo], a[hi]])
                lo += 1
                while lo < hi and a[lo] == a[lo - 1]:
                    lo += 1
                hi -= 1
    return out
`,
      explanation: md('Sorting enables a two-pointer scan per fixed element: O(n²) total. Skipping equal neighbours removes duplicate triples without a set.'),
      tests: [
        ex('Example', [-1, 0, 1, 2, -1, -4]),
        ex('All zeros', [0, 0, 0, 0]),
        hid('None', [1, 2, -2, -1]),
        hid('Several', [-2, 0, 1, 1, 2, -1, -4, 3]),
      ],
    }),

    dsa({
      id: 'dsa-quadruplets-target',
      title: 'Unique Groups of Four Hitting a Target',
      difficulty: 'Medium',
      topics: ['Two Pointers', 'Sorting'],
      patterns: ['k-sum reduction to 2-sum'],
      summary: 'Every unique quadruple of values that sums to the target.',
      description: md('Return all unique quadruples (each sorted ascending, list sorted) of values at distinct indices whose sum equals `target`.'),
      hints: ['Two nested fixed indices plus a two-pointer scan; skip duplicates at all four levels.'],
      signature: 'four_sum(nums: list[int], target: int) -> list[list[int]]',
      solution: code`def four_sum(nums: list[int], target: int) -> list[list[int]]:
    a, n, out = sorted(nums), len(nums), []
    for i in range(n - 3):
        if i and a[i] == a[i - 1]:
            continue
        for j in range(i + 1, n - 2):
            if j > i + 1 and a[j] == a[j - 1]:
                continue
            lo, hi = j + 1, n - 1
            while lo < hi:
                s = a[i] + a[j] + a[lo] + a[hi]
                if s < target:
                    lo += 1
                elif s > target:
                    hi -= 1
                else:
                    out.append([a[i], a[j], a[lo], a[hi]])
                    lo += 1
                    while lo < hi and a[lo] == a[lo - 1]:
                        lo += 1
                    hi -= 1
    return out
`,
      explanation: md('Generalises 3-sum: fix k−2 indices and finish with two pointers, O(n^(k−1)).'),
      tests: [
        ex('Example', [1, 0, -1, 0, -2, 2], 0),
        ex('Repeated value', [2, 2, 2, 2, 2], 8),
        hid('None', [1, 2, 3, 4], 100),
        hid('Negatives', [-3, -2, -1, 0, 0, 1, 2, 3], 0),
      ],
    }),

    dsa({
      id: 'dsa-dedupe-sorted-in-place',
      title: 'Squash Duplicates in a Sorted List',
      difficulty: 'Easy',
      topics: ['Two Pointers', 'Arrays'],
      patterns: ['Read/write pointers'],
      summary: 'Keep at most `k` copies of each value in a sorted list, in place.',
      description: md('Given a sorted list, keep at most `k` occurrences of each value (in place, order preserved). Return `[new_length, nums[:new_length]]`.'),
      hints: ['Write x if fewer than k values have been written or nums[w − k] != x.'],
      signature: 'dedupe(nums: list[int], k: int) -> list',
      solution: code`def dedupe(nums: list[int], k: int) -> list:
    w = 0
    for x in nums:
        if w < k or nums[w - k] != x:
            nums[w] = x
            w += 1
    return [w, nums[:w]]
`,
      explanation: md('Because the list is sorted, comparing with the element k positions behind the write pointer decides whether another copy is allowed. O(n), O(1).'),
      tests: [
        ex('Keep one', [0, 0, 1, 1, 1, 2, 2, 3, 3, 4], 1),
        ex('Keep two', [1, 1, 1, 2, 2, 3], 2),
        hid('Empty', [], 1),
        hid('All same', [7, 7, 7, 7], 3),
      ],
    }),

    dsa({
      id: 'dsa-trapped-rainwater',
      title: 'How Much Rain Is Trapped Between the Bars?',
      difficulty: 'Hard',
      topics: ['Two Pointers', 'Arrays'],
      patterns: ['Two pointers with running maxima'],
      summary: 'Units of water held above an elevation profile.',
      description: md('Bar heights are given left to right, each bar 1 unit wide. Return the total units of rain water trapped after it rains.'),
      hints: ['Water above i = min(max_left, max_right) − h[i]. Move the pointer on the side with the smaller max.'],
      signature: 'trap(heights: list[int]) -> int',
      solution: code`def trap(heights: list[int]) -> int:
    lo, hi = 0, len(heights) - 1
    left_max = right_max = water = 0
    while lo < hi:
        if heights[lo] < heights[hi]:
            left_max = max(left_max, heights[lo])
            water += left_max - heights[lo]
            lo += 1
        else:
            right_max = max(right_max, heights[hi])
            water += right_max - heights[hi]
            hi -= 1
    return water
`,
      explanation: md('The lower side’s running maximum bounds its water level, because the other side is known to be at least as tall. O(n), O(1) — versus O(n) extra for prefix/suffix max arrays.'),
      tests: [
        ex('Example', [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]),
        ex('Valley', [4, 2, 0, 3, 2, 5]),
        hid('Flat', [3, 3, 3]),
        hid('Empty', []),
      ],
    }),

    dsa({
      id: 'dsa-widest-container',
      title: 'Two Walls That Hold the Most Water',
      difficulty: 'Medium',
      topics: ['Two Pointers'],
      patterns: ['Shrink from the shorter side'],
      summary: 'Max area between two vertical lines.',
      description: md('Pick two lines `i < j`; the area is `(j − i) * min(h[i], h[j])`. Return the maximum area.'),
      hints: ['Start at both ends; moving the taller line can never help.'],
      signature: 'max_area(heights: list[int]) -> int',
      solution: code`def max_area(heights: list[int]) -> int:
    lo, hi, best = 0, len(heights) - 1, 0
    while lo < hi:
        best = max(best, (hi - lo) * min(heights[lo], heights[hi]))
        if heights[lo] < heights[hi]:
            lo += 1
        else:
            hi -= 1
    return best
`,
      explanation: md('Width only decreases as pointers move, so the only hope for more area is a taller short side. O(n).'),
      tests: [
        ex('Example', [1, 8, 6, 2, 5, 4, 8, 3, 7]),
        ex('Two lines', [1, 1]),
        hid('Increasing', [1, 2, 3, 4, 5]),
        hid('Single', [5]),
      ],
    }),

    dsa({
      id: 'dsa-ones-with-k-flips',
      title: 'Longest Run of Ones If You May Flip k Zeros',
      difficulty: 'Medium',
      topics: ['Sliding Window'],
      patterns: ['Variable window with a budget'],
      summary: 'Maximum window containing at most k zeros.',
      description: md('`bits` contains 0s and 1s. Return the length of the longest contiguous block of 1s obtainable by flipping at most `k` zeros.'),
      hints: ['Expand right; when zeros exceed k, advance left past a zero.'],
      signature: 'longest_ones(bits: list[int], k: int) -> int',
      solution: code`def longest_ones(bits: list[int], k: int) -> int:
    left = zeros = best = 0
    for right, b in enumerate(bits):
        zeros += b == 0
        while zeros > k:
            zeros -= bits[left] == 0
            left += 1
        best = max(best, right - left + 1)
    return best
`,
      explanation: md('Classic budgeted window: each index enters and leaves once, O(n).'),
      tests: [
        ex('Example', [1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0], 2),
        ex('No flips', [1, 0, 1, 1, 0, 1, 1, 1], 0),
        hid('Flip all', [0, 0, 0], 5),
        hid('Empty', [], 1),
      ],
    }),

    dsa({
      id: 'dsa-longest-distinct-substring',
      title: 'Longest Substring With No Repeated Character',
      difficulty: 'Medium',
      topics: ['Sliding Window', 'Strings', 'Hashing'],
      patterns: ['Last-seen index jump'],
      summary: 'Length of the longest window with all-distinct characters, and the window itself.',
      description: md('Return `[length, substring]` for the longest substring of `s` with no repeated characters (earliest one on ties).'),
      hints: ['Remember the last index of each character; when it is inside the window, jump left past it.'],
      signature: 'longest_unique(s: str) -> list',
      solution: code`def longest_unique(s: str) -> list:
    last, left, best, start = {}, 0, 0, 0
    for i, ch in enumerate(s):
        if last.get(ch, -1) >= left:
            left = last[ch] + 1
        last[ch] = i
        if i - left + 1 > best:
            best, start = i - left + 1, left
    return [best, s[start:start + best]]
`,
      explanation: md('Jumping `left` directly (instead of stepping) keeps the scan strictly O(n).'),
      tests: [
        ex('Example', 'abcabcbb'),
        ex('Same char', 'bbbbb'),
        hid('Middle', 'pwwkew'),
        hid('Empty', ''),
      ],
    }),

    dsa({
      id: 'dsa-repeat-replacement',
      title: 'Longest Same-Letter Block After k Replacements',
      difficulty: 'Medium',
      topics: ['Sliding Window', 'Strings'],
      patterns: ['Window − max frequency ≤ k'],
      summary: 'Replace up to k characters to make the longest uniform substring.',
      description: md('Return the length of the longest substring that can be made of a single repeated letter by changing at most `k` characters.'),
      hints: ['A window is valid while (length − count of its most frequent letter) ≤ k. The max count never needs to decrease.'],
      signature: 'character_replacement(s: str, k: int) -> int',
      solution: code`from collections import Counter

def character_replacement(s: str, k: int) -> int:
    counts, left, top, best = Counter(), 0, 0, 0
    for right, ch in enumerate(s):
        counts[ch] += 1
        top = max(top, counts[ch])
        while right - left + 1 - top > k:
            counts[s[left]] -= 1
            left += 1
        best = max(best, right - left + 1)
    return best
`,
      explanation: md('A stale (too-high) `top` only keeps the window from shrinking, which never produces an answer larger than a real valid window. O(n).'),
      tests: [
        ex('Example', 'ABAB', 2),
        ex('One change', 'AABABBA', 1),
        hid('No changes', 'ABCD', 0),
        hid('Empty', '', 2),
      ],
    }),

    dsa({
      id: 'dsa-min-covering-window',
      title: 'Shortest Window Containing Every Required Character',
      difficulty: 'Hard',
      topics: ['Sliding Window', 'Strings', 'Hashing'],
      patterns: ['Need-map with a missing counter'],
      summary: 'Smallest substring of s containing all characters of t (with multiplicity).',
      description: md('Return the shortest substring of `s` that contains every character of `t` including duplicates; earliest on ties; `""` if impossible.'),
      hints: ['Track how many required characters are still missing; once zero, shrink from the left while it stays zero.'],
      signature: 'min_window(s: str, t: str) -> str',
      solution: code`from collections import Counter

def min_window(s: str, t: str) -> str:
    need, missing = Counter(t), len(t)
    left, best = 0, (float("inf"), 0, 0)
    for right, ch in enumerate(s):
        if need[ch] > 0:
            missing -= 1
        need[ch] -= 1
        while missing == 0:
            if right - left + 1 < best[0]:
                best = (right - left + 1, left, right + 1)
            need[s[left]] += 1
            if need[s[left]] > 0:
                missing += 1
            left += 1
    return s[best[1]:best[2]] if best[0] != float("inf") else ""
`,
      explanation: md('`need` goes negative for surplus characters, so a character only counts as missing again when its count rises above zero. Each pointer moves n times: O(|s| + |t|).'),
      tests: [
        ex('Example', 'ADOBECODEBANC', 'ABC'),
        ex('Impossible', 'a', 'aa'),
        hid('Whole string', 'ab', 'ba'),
        hid('Duplicates required', 'aaflslflsldkalskaaa', 'aaa'),
      ],
    }),

    dsa({
      id: 'dsa-anagram-windows',
      title: 'Where Do Anagrams of a Pattern Start?',
      difficulty: 'Medium',
      topics: ['Sliding Window', 'Hashing', 'Strings'],
      patterns: ['Fixed window frequency match'],
      summary: 'All start indices of windows in s that are permutations of p.',
      description: md('Return every index `i` such that `s[i : i + len(p)]` is an anagram of `p`.'),
      hints: ['Slide a window of length |p| keeping a count array; compare counts (or track a matched counter).'],
      signature: 'find_anagrams(s: str, p: str) -> list[int]',
      solution: code`from collections import Counter

def find_anagrams(s: str, p: str) -> list[int]:
    k, target, window, out = len(p), Counter(p), Counter(), []
    for i, ch in enumerate(s):
        window[ch] += 1
        if i >= k:
            window[s[i - k]] -= 1
            if window[s[i - k]] == 0:
                del window[s[i - k]]
        if window == target:
            out.append(i - k + 1)
    return out
`,
      explanation: md('Fixed-size window; comparing two counters over a bounded alphabet is O(1), so the scan is O(n).'),
      tests: [
        ex('Example', 'cbaebabacd', 'abc'),
        ex('Overlapping', 'abab', 'ab'),
        hid('Pattern longer', 'a', 'ab'),
        hid('None', 'xyz', 'ab'),
      ],
    }),

    dsa({
      id: 'dsa-two-basket-fruits',
      title: 'Longest Stretch with at Most Two Kinds',
      difficulty: 'Medium',
      topics: ['Sliding Window', 'Hashing'],
      patterns: ['At most k distinct'],
      summary: 'Longest contiguous run containing at most k distinct values.',
      description: md('Return the length of the longest contiguous block of `items` containing at most `k` distinct values.'),
      hints: ['Keep a counter for the window; when it has more than k keys, shrink from the left.'],
      signature: 'longest_k_distinct(items: list[int], k: int) -> int',
      solution: code`from collections import Counter

def longest_k_distinct(items: list[int], k: int) -> int:
    counts, left, best = Counter(), 0, 0
    for right, x in enumerate(items):
        counts[x] += 1
        while len(counts) > k:
            counts[items[left]] -= 1
            if counts[items[left]] == 0:
                del counts[items[left]]
            left += 1
        best = max(best, right - left + 1)
    return best
`,
      explanation: md('The "fruit into baskets" problem is the k = 2 case of at-most-k-distinct windows. O(n).'),
      tests: [
        ex('Two kinds', [1, 2, 1, 2, 3], 2),
        ex('Three kinds', [0, 1, 2, 2, 3, 3, 4], 3),
        hid('Zero', [1, 2], 0),
        hid('All same', [5, 5, 5], 1),
      ],
    }),

    dsa({
      id: 'dsa-exactly-k-distinct',
      title: 'Count Blocks with Exactly k Distinct Values',
      difficulty: 'Hard',
      topics: ['Sliding Window', 'Hashing'],
      patterns: ['exactly(k) = atMost(k) − atMost(k−1)'],
      summary: 'Number of contiguous subarrays containing exactly k different values.',
      description: md('Return how many contiguous subarrays of `nums` contain exactly `k` distinct integers.'),
      hints: ['Counting "at most k" is easy with a window (add right − left + 1 per step). Subtract.'],
      signature: 'count_exactly_k(nums: list[int], k: int) -> int',
      solution: code`from collections import Counter

def count_exactly_k(nums: list[int], k: int) -> int:
    def at_most(k):
        if k < 0:
            return 0
        counts, left, total = Counter(), 0, 0
        for right, x in enumerate(nums):
            counts[x] += 1
            while len(counts) > k:
                counts[nums[left]] -= 1
                if counts[nums[left]] == 0:
                    del counts[nums[left]]
                left += 1
            total += right - left + 1
        return total
    return at_most(k) - at_most(k - 1)
`,
      explanation: md('"Exactly" windows aren’t monotone, but "at most" windows are; the difference trick applies to many counting problems (binary subarrays with sum S, nice subarrays…). O(n).'),
      tests: [
        ex('Example', [1, 2, 1, 2, 3], 2),
        ex('Another', [1, 2, 1, 3, 4], 3),
        hid('k = 1', [1, 1, 1], 1),
        hid('Too many', [1, 2], 3),
      ],
    }),

    dsa({
      id: 'dsa-binary-sum-goal',
      title: 'Count 0/1 Blocks with a Given Number of Ones',
      difficulty: 'Medium',
      topics: ['Sliding Window', 'Prefix Sums'],
      patterns: ['exactly(k) = atMost(k) − atMost(k−1)'],
      summary: 'How many contiguous subarrays of a binary list sum to `goal`.',
      description: md('Return the number of contiguous subarrays of the binary list `bits` whose sum equals `goal`.'),
      hints: ['at_most(goal) − at_most(goal − 1), or a prefix-sum counter.'],
      signature: 'count_binary_sum(bits: list[int], goal: int) -> int',
      solution: code`def count_binary_sum(bits: list[int], goal: int) -> int:
    def at_most(g):
        if g < 0:
            return 0
        left = total = run = 0
        for right, b in enumerate(bits):
            run += b
            while run > g:
                run -= bits[left]
                left += 1
            total += right - left + 1
        return total
    return at_most(goal) - at_most(goal - 1)
`,
      explanation: md('Same difference trick as k-distinct, with the window sum as the budget. O(n), O(1).'),
      tests: [
        ex('Example', [1, 0, 1, 0, 1], 2),
        ex('Zeros', [0, 0, 0, 0, 0], 0),
        hid('Goal too high', [1, 1], 3),
        hid('Zeros between ones', [1, 1, 0, 1, 1], 3),
      ],
    }),

    dsa({
      id: 'dsa-best-end-cards',
      title: 'Take k Cards from Either End for the Most Points',
      difficulty: 'Medium',
      topics: ['Sliding Window', 'Prefix Sums'],
      patterns: ['Complement window'],
      summary: 'Max total by taking exactly k cards from the two ends.',
      description: md('Each step you take one card from the left end or the right end. Return the maximum total of exactly `k` taken cards.'),
      hints: ['Taking k from the ends = leaving a contiguous block of n − k in the middle. Minimise that block.'],
      signature: 'max_card_score(cards: list[int], k: int) -> int',
      solution: code`def max_card_score(cards: list[int], k: int) -> int:
    n = len(cards)
    keep = n - k
    total = sum(cards)
    if keep == 0:
        return total
    window = sum(cards[:keep])
    least = window
    for i in range(keep, n):
        window += cards[i] - cards[i - keep]
        least = min(least, window)
    return total - least
`,
      explanation: md('Reframing as "smallest middle window" turns 2^k choices into a single O(n) fixed-window scan.'),
      tests: [
        ex('Example', [1, 2, 3, 4, 5, 6, 1], 3),
        ex('Take all', [9, 7, 7, 9, 7, 7, 9], 7),
        hid('Both ends', [100, 40, 17, 9, 73, 75], 3),
        hid('One card', [2, 2, 2], 1),
      ],
    }),

    dsa({
      id: 'dsa-shortest-sum-at-least',
      title: 'Shortest Block Reaching a Minimum Total',
      difficulty: 'Medium',
      topics: ['Sliding Window'],
      patterns: ['Shrink while valid'],
      summary: 'Length of the shortest contiguous block (positive values) with sum ≥ target.',
      description: md('All values are positive. Return the minimal length of a contiguous block whose sum is at least `target`, or 0.'),
      hints: ['Expand right; while the window meets the target, record the length and shrink from the left.'],
      signature: 'min_len_sum(target: int, nums: list[int]) -> int',
      solution: code`def min_len_sum(target: int, nums: list[int]) -> int:
    left, run, best = 0, 0, float("inf")
    for right, x in enumerate(nums):
        run += x
        while run >= target:
            best = min(best, right - left + 1)
            run -= nums[left]
            left += 1
    return 0 if best == float("inf") else best
`,
      explanation: md('Positivity makes the window sum monotone in both directions, so two pointers suffice. O(n).'),
      tests: [
        ex('Example', 7, [2, 3, 1, 2, 4, 3]),
        ex('Single element', 4, [1, 4, 4]),
        hid('Impossible', 11, [1, 1, 1, 1]),
        hid('Whole array', 6, [1, 2, 3]),
      ],
    }),

    dsa({
      id: 'dsa-isomorphic-mapping',
      title: 'Can One Word Be Re-Lettered into the Other?',
      difficulty: 'Easy',
      topics: ['Hashing', 'Strings'],
      patterns: ['Bijection with two maps'],
      summary: 'Check whether a consistent one-to-one character mapping turns s into t.',
      description: md('For each `[s, t]` pair, return whether `s` can be transformed into `t` by replacing characters consistently, where no two characters map to the same character.'),
      hints: ['Keep maps in both directions, or compare the "first occurrence index" signature of both strings.'],
      signature: 'isomorphic(pairs: list[list[str]]) -> list[bool]',
      solution: code`def isomorphic(pairs: list[list[str]]) -> list[bool]:
    def sig(w):
        first = {}
        return [first.setdefault(c, len(first)) for c in w]
    return [len(s) == len(t) and sig(s) == sig(t) for s, t in pairs]
`,
      explanation: md('Two strings are isomorphic exactly when their "pattern" (first-seen order of each character) matches — a canonical form that avoids two-way map bookkeeping.'),
      tests: [
        ex('Example', [['egg', 'add'], ['foo', 'bar'], ['paper', 'title']]),
        ex('Two to one', [['ab', 'aa']]),
        hid('Lengths differ', [['abc', 'ab'], ['', '']]),
        hid('Longer words', [['badc', 'baba'], ['abcdefghij', 'jihgfedcba'], ['aab', 'xxy']]),
      ],
    }),
  ],
};
