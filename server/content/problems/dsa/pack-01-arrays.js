// DSA pack 01 — arrays & matrices: in-place rewrites, Kadane, Dutch flag,
// next permutation, majority votes, merge without extra space, cycle-detection
// duplicates, inversion counting, matrix zeroing / rotation / search.
import { dsa, md, code, ex, hid } from './define.js';

export default {
  problems: [
    dsa({
      id: 'dsa-zero-out-rows-cols',
      title: 'Blank Out Rows and Columns Around Zeros',
      difficulty: 'Medium',
      topics: ['Matrices', 'Arrays'],
      patterns: ['Use first row/column as markers'],
      summary: 'Wherever a cell is 0, set its whole row and column to 0 — with O(1) extra space.',
      description: md('Given an `m × n` grid of integers, every cell that is `0` should zero its entire row and column. Return the resulting grid. Aim for constant extra space by recording markers inside the grid itself.'),
      hints: ['Remember separately whether the first row and first column contained a zero, then use them as flag storage for the rest.'],
      signature: 'zero_matrix(grid: list[list[int]]) -> list[list[int]]',
      solution: code`def zero_matrix(grid: list[list[int]]) -> list[list[int]]:
    if not grid:
        return grid
    m, n = len(grid), len(grid[0])
    first_row = any(grid[0][j] == 0 for j in range(n))
    first_col = any(grid[i][0] == 0 for i in range(m))
    for i in range(1, m):
        for j in range(1, n):
            if grid[i][j] == 0:
                grid[i][0] = grid[0][j] = 0
    for i in range(1, m):
        for j in range(1, n):
            if grid[i][0] == 0 or grid[0][j] == 0:
                grid[i][j] = 0
    if first_row:
        for j in range(n):
            grid[0][j] = 0
    if first_col:
        for i in range(m):
            grid[i][0] = 0
    return grid
`,
      explanation: md('A naive copy costs O(mn) memory. The first row and column double as "this column / row must be zeroed" flags; two booleans remember whether they themselves need zeroing. Time O(mn), space O(1).'),
      tests: [
        ex('Example', [[1, 1, 1], [1, 0, 1], [1, 1, 1]]),
        ex('Zero in a corner', [[0, 1, 2, 0], [3, 4, 5, 2], [1, 3, 1, 5]]),
        hid('No zeros', [[1, 2], [3, 4]]),
        hid('Single column', [[1], [0], [3]]),
      ],
    }),

    dsa({
      id: 'dsa-pascal-triangle',
      title: 'Build the First n Rows of Pascal’s Triangle',
      difficulty: 'Easy',
      topics: ['Arrays', 'Math & Number Theory'],
      patterns: ['Row from previous row'],
      summary: 'Each row starts and ends with 1; inner values are the sum of the two above.',
      description: md('Return the first `n` rows of Pascal’s triangle as a list of lists. Also return, as a second element, the single value at row `r`, column `c` (both 0-based) computed **without** building the triangle.'),
      hints: ['Row k+1 = [1] + pairwise sums of row k + [1].', 'C(r, c) can be built incrementally: value = value * (r - i) // (i + 1).'],
      signature: 'pascal(n: int, r: int, c: int) -> list',
      solution: code`def pascal(n: int, r: int, c: int) -> list:
    rows = []
    for k in range(n):
        if k == 0:
            rows.append([1])
        else:
            prev = rows[-1]
            rows.append([1] + [prev[i] + prev[i + 1] for i in range(len(prev) - 1)] + [1])
    value = 1
    for i in range(c):
        value = value * (r - i) // (i + 1)
    return [rows, value]
`,
      explanation: md('Building row by row is O(n²). A single entry is the binomial coefficient C(r, c), computed in O(c) with exact integer arithmetic.'),
      tests: [
        ex('Example', 5, 4, 2),
        ex('One row', 1, 0, 0),
        hid('Deeper entry', 6, 10, 3),
        hid('Zero rows', 0, 5, 5),
      ],
    }),

    dsa({
      id: 'dsa-next-arrangement',
      title: 'The Next Arrangement in Dictionary Order',
      difficulty: 'Medium',
      topics: ['Arrays'],
      patterns: ['Next permutation (pivot, swap, reverse suffix)'],
      summary: 'Rearrange digits into the next lexicographically larger order, wrapping to the smallest.',
      description: md('Given a list of integers, return the next permutation in lexicographic order. If the list is already the largest arrangement, return the smallest (sorted ascending). Do it in place with O(1) extra memory.'),
      hints: ['Scan from the right for the first i with a[i] < a[i+1]; swap a[i] with the rightmost element larger than it; reverse the suffix after i.'],
      signature: 'next_permutation(nums: list[int]) -> list[int]',
      solution: code`def next_permutation(nums: list[int]) -> list[int]:
    i = len(nums) - 2
    while i >= 0 and nums[i] >= nums[i + 1]:
        i -= 1
    if i >= 0:
        j = len(nums) - 1
        while nums[j] <= nums[i]:
            j -= 1
        nums[i], nums[j] = nums[j], nums[i]
    nums[i + 1:] = reversed(nums[i + 1:])
    return nums
`,
      explanation: md('The suffix after the pivot is non-increasing (it is already the largest it can be). Bumping the pivot by the smallest larger value and reversing the suffix to ascending gives the very next arrangement. O(n).'),
      tests: [
        ex('Example', [1, 2, 3]),
        ex('Wraps around', [3, 2, 1]),
        hid('Duplicates', [1, 1, 5]),
        hid('Middle pivot', [1, 3, 5, 4, 2]),
      ],
    }),

    dsa({
      id: 'dsa-best-contiguous-sum',
      title: 'Largest Sum of a Contiguous Block (with Its Bounds)',
      difficulty: 'Medium',
      topics: ['Arrays', 'Dynamic Programming'],
      patterns: ['Kadane’s algorithm'],
      summary: 'Return the maximum subarray sum and the start/end indices of the earliest best block.',
      description: md('Return `[best_sum, start, end]` for the non-empty contiguous block with the largest sum. If several blocks tie, return the one that starts earliest, then the shortest.'),
      hints: ['Keep a running sum; when it drops below zero, restart at the next index. Only replace the best on a strictly larger sum.'],
      signature: 'max_block(nums: list[int]) -> list[int]',
      solution: code`def max_block(nums: list[int]) -> list[int]:
    best, best_s, best_e = nums[0], 0, 0
    run, start = 0, 0
    for i, x in enumerate(nums):
        if run <= 0:
            run, start = x, i
        else:
            run += x
        if run > best:
            best, best_s, best_e = run, start, i
    return [best, best_s, best_e]
`,
      explanation: md('A prefix with a non-positive sum can never help a later block, so drop it. Restarting when `run <= 0` (not `< 0`) prefers the shorter block on ties. O(n), O(1) space.'),
      tests: [
        ex('Example', [-2, 1, -3, 4, -1, 2, 1, -5, 4]),
        ex('All negative', [-3, -1, -2]),
        hid('Whole array', [2, 3, 4]),
        hid('Tie keeps earliest', [3, -3, 3]),
      ],
    }),

    dsa({
      id: 'dsa-three-colour-sort',
      title: 'Sort Three Kinds of Tickets in One Pass',
      difficulty: 'Medium',
      topics: ['Arrays', 'Two Pointers', 'Sorting'],
      patterns: ['Dutch national flag'],
      summary: 'An array holds only 0, 1 and 2 — sort it in a single pass without counting.',
      description: md('Sort a list containing only `0`, `1` and `2` in place using one pass and constant space, and return it.'),
      hints: ['Three pointers: low (next 0 slot), mid (scanner), high (next 2 slot). Don’t advance mid after swapping with high.'],
      signature: 'sort_colors(nums: list[int]) -> list[int]',
      solution: code`def sort_colors(nums: list[int]) -> list[int]:
    lo, mid, hi = 0, 0, len(nums) - 1
    while mid <= hi:
        if nums[mid] == 0:
            nums[lo], nums[mid] = nums[mid], nums[lo]
            lo += 1
            mid += 1
        elif nums[mid] == 1:
            mid += 1
        else:
            nums[mid], nums[hi] = nums[hi], nums[mid]
            hi -= 1
    return nums
`,
      explanation: md('Invariant: `[0, lo)` are 0s, `[lo, mid)` 1s, `(hi, end]` 2s. A value swapped in from `hi` is unexamined, so `mid` stays. O(n), O(1).'),
      tests: [
        ex('Example', [2, 0, 2, 1, 1, 0]),
        ex('Already sorted', [0, 1, 2]),
        hid('All twos', [2, 2, 2]),
        hid('Empty', []),
      ],
    }),

    dsa({
      id: 'dsa-merge-sorted-in-place',
      title: 'Merge Two Sorted Lists Without a Third',
      difficulty: 'Medium',
      topics: ['Arrays', 'Two Pointers', 'Sorting'],
      patterns: ['Gap method / swap-and-resort'],
      summary: 'Rearrange two sorted arrays so the first holds the smallest values, both still sorted, using O(1) extra space.',
      description: md('Given sorted `a` and `b`, rearrange elements so that `a` holds the `len(a)` smallest values and `b` the rest, both in ascending order, without allocating a merged array. Return `[a, b]`.'),
      hints: ['Compare the largest of a with the smallest of b from the boundary outward, swapping while a[i] > b[j]; then sort each part (or use the gap/shell method).'],
      signature: 'merge_no_extra(a: list[int], b: list[int]) -> list[list[int]]',
      solution: code`def merge_no_extra(a: list[int], b: list[int]) -> list[list[int]]:
    n, m = len(a), len(b)
    total = n + m
    gap = (total + 1) // 2 if total > 1 else 0

    def get(k):
        return a[k] if k < n else b[k - n]

    def put(k, v):
        if k < n:
            a[k] = v
        else:
            b[k - n] = v

    while gap > 0:
        for i in range(total - gap):
            j = i + gap
            if get(i) > get(j):
                x, y = get(i), get(j)
                put(i, y)
                put(j, x)
        gap = 0 if gap == 1 else (gap + 1) // 2
    return [a, b]
`,
      explanation: md('The gap (shell-sort) method treats both arrays as one virtual array and compares elements `gap` apart, halving the gap each round. O((n+m) log(n+m)) time, O(1) space.'),
      tests: [
        ex('Example', [1, 4, 8, 10], [2, 3, 9]),
        ex('Already separated', [1, 2], [3, 4]),
        hid('Fully interleaved', [5, 6, 7], [1, 2, 3]),
        hid('One empty', [], [1, 2]),
      ],
    }),

    dsa({
      id: 'dsa-repeated-id-cycle',
      title: 'Find the Repeated Id Without Modifying the List',
      difficulty: 'Medium',
      topics: ['Arrays', 'Two Pointers'],
      patterns: ['Floyd cycle detection on index links'],
      summary: 'n + 1 values in 1..n, exactly one value repeats (possibly many times) — find it in O(1) space.',
      description: md('A list of `n + 1` integers contains only values from `1` to `n`; one value appears more than once. Return it without changing the list and using constant extra memory.'),
      hints: ['Treat value v as a pointer to index v. A duplicate means two indices point to the same node: a cycle whose entry is the answer.'],
      signature: 'find_duplicate(nums: list[int]) -> int',
      solution: code`def find_duplicate(nums: list[int]) -> int:
    slow = fast = nums[0]
    while True:
        slow = nums[slow]
        fast = nums[nums[fast]]
        if slow == fast:
            break
    slow = nums[0]
    while slow != fast:
        slow = nums[slow]
        fast = nums[fast]
    return slow
`,
      explanation: md('The index→value mapping forms a linked structure with a cycle; Floyd’s tortoise and hare finds the meeting point, then a second walk from the start meets at the cycle entrance — the duplicate. O(n), O(1).'),
      tests: [
        ex('Example', [1, 3, 4, 2, 2]),
        ex('Repeated many times', [3, 3, 3, 3]),
        hid('Duplicate at the start', [2, 2, 1]),
        hid('Larger', [5, 1, 4, 2, 3, 6, 4]),
      ],
    }),

    dsa({
      id: 'dsa-missing-and-repeated',
      title: 'One Number Twice, One Number Missing',
      difficulty: 'Medium',
      topics: ['Arrays', 'Math & Number Theory', 'Bit Manipulation'],
      patterns: ['Sum and sum-of-squares equations'],
      summary: 'Values should be exactly 1..n; one appears twice and one is absent. Find both.',
      description: md('Return `[repeated, missing]` for a list that should contain each of `1..n` once but has one value duplicated in place of another.'),
      hints: ['Let S = sum − expected sum = r − m and Q = sum of squares − expected = r² − m² = (r − m)(r + m).'],
      signature: 'repeat_and_missing(nums: list[int]) -> list[int]',
      solution: code`def repeat_and_missing(nums: list[int]) -> list[int]:
    n = len(nums)
    diff = sum(nums) - n * (n + 1) // 2
    sq = sum(x * x for x in nums) - n * (n + 1) * (2 * n + 1) // 6
    total = sq // diff
    r = (diff + total) // 2
    return [r, r - diff]
`,
      explanation: md('Two equations, two unknowns: `r − m` from plain sums and `r + m = (r² − m²)/(r − m)` from squares. Python integers don’t overflow; in fixed-width languages use XOR partitioning instead. O(n), O(1).'),
      tests: [
        ex('Example', [3, 1, 2, 5, 3]),
        ex('Smallest case', [2, 2]),
        hid('Missing the last value', [1, 2, 3, 3]),
        hid('Missing the first value', [2, 3, 4, 4]),
      ],
    }),

    dsa({
      id: 'dsa-count-inversions',
      title: 'How Far from Sorted? Count Inversions',
      difficulty: 'Hard',
      topics: ['Arrays', 'Sorting'],
      patterns: ['Merge sort with counting'],
      summary: 'Count pairs i < j with a[i] > a[j] in O(n log n).',
      description: md('Return the number of pairs `(i, j)` with `i < j` and `nums[i] > nums[j]`.'),
      hints: ['During the merge step, when an element of the right half is placed before the remaining left elements, all of those remaining elements form inversions with it.'],
      signature: 'count_inversions(nums: list[int]) -> int',
      solution: code`def count_inversions(nums: list[int]) -> int:
    def sort(a):
        if len(a) <= 1:
            return a, 0
        mid = len(a) // 2
        left, x = sort(a[:mid])
        right, y = sort(a[mid:])
        merged, i, j, inv = [], 0, 0, x + y
        while i < len(left) and j < len(right):
            if left[i] <= right[j]:
                merged.append(left[i])
                i += 1
            else:
                merged.append(right[j])
                inv += len(left) - i
                j += 1
        merged += left[i:] + right[j:]
        return merged, inv
    return sort(list(nums))[1]
`,
      explanation: md('Brute force is O(n²). Merge sort counts cross-half inversions in linear time per level: each time the right element wins, every unconsumed left element is larger. O(n log n).'),
      tests: [
        ex('Example', [2, 4, 1, 3, 5]),
        ex('Sorted', [1, 2, 3]),
        hid('Reversed', [5, 4, 3, 2, 1]),
        hid('Duplicates are not inversions', [2, 2, 1, 1]),
      ],
    }),

    dsa({
      id: 'dsa-important-reverse-pairs',
      title: 'Pairs Where the Left Is More Than Double the Right',
      difficulty: 'Hard',
      topics: ['Arrays', 'Sorting'],
      patterns: ['Merge sort with counting'],
      summary: 'Count pairs i < j with nums[i] > 2 * nums[j].',
      description: md('Return the number of index pairs `i < j` such that `nums[i] > 2 * nums[j]`.'),
      hints: ['Count with a separate two-pointer sweep over the two sorted halves before merging them.'],
      signature: 'reverse_pairs(nums: list[int]) -> int',
      solution: code`def reverse_pairs(nums: list[int]) -> int:
    def sort(a):
        if len(a) <= 1:
            return a, 0
        mid = len(a) // 2
        left, x = sort(a[:mid])
        right, y = sort(a[mid:])
        count, j = x + y, 0
        for v in left:
            while j < len(right) and v > 2 * right[j]:
                j += 1
            count += j
        return sorted(left + right), count
    return sort(list(nums))[1]
`,
      explanation: md('Unlike plain inversions the counting condition differs from the merge order, so count first with a monotone pointer (both halves sorted), then merge. O(n log n).'),
      tests: [
        ex('Example', [1, 3, 2, 3, 1]),
        ex('Another', [2, 4, 3, 5, 1]),
        hid('Negatives', [-5, -5]),
        hid('None', [1, 2, 3, 4]),
      ],
    }),

    dsa({
      id: 'dsa-sorted-grid-search',
      title: 'Search a Grid Sorted Row by Row',
      difficulty: 'Medium',
      topics: ['Matrices', 'Binary Search'],
      patterns: ['Treat a matrix as a flat sorted array'],
      summary: 'Rows are sorted and each row starts after the previous ends — find a target in O(log mn).',
      description: md('Each row of the grid is sorted ascending and the first value of each row is greater than the last value of the previous row. For each query return its `[row, col]` or `[-1, -1]`.'),
      hints: ['Binary search over indices 0..m·n−1, mapping k → (k // n, k % n).'],
      signature: 'search_grid(grid: list[list[int]], queries: list[int]) -> list[list[int]]',
      solution: code`def search_grid(grid: list[list[int]], queries: list[int]) -> list[list[int]]:
    m = len(grid)
    n = len(grid[0]) if m else 0
    out = []
    for q in queries:
        lo, hi, hit = 0, m * n - 1, [-1, -1]
        while lo <= hi:
            mid = (lo + hi) // 2
            v = grid[mid // n][mid % n]
            if v == q:
                hit = [mid // n, mid % n]
                break
            if v < q:
                lo = mid + 1
            else:
                hi = mid - 1
        out.append(hit)
    return out
`,
      explanation: md('Because the rows chain together, the grid is one sorted sequence read row-major; one binary search costs O(log(mn)).'),
      tests: [
        ex('Example', [[1, 3, 5, 7], [10, 11, 16, 20], [23, 30, 34, 60]], [3, 13, 60]),
        ex('Single cell', [[5]], [5, 1]),
        hid('First and last', [[1, 2], [3, 4]], [1, 4, 0]),
        hid('Single row', [[2, 4, 6, 8]], [6, 7, 2]),
      ],
    }),

    dsa({
      id: 'dsa-staircase-grid-search',
      title: 'Search a Grid Sorted Along Rows and Columns',
      difficulty: 'Medium',
      topics: ['Matrices', 'Two Pointers'],
      patterns: ['Staircase search from a corner'],
      summary: 'Rows and columns are each sorted (but rows don’t chain) — find targets in O(m + n).',
      description: md('Every row is sorted left→right and every column top→bottom. For each query return `true` if it is present.'),
      hints: ['Start at the top-right: too big → move left, too small → move down.'],
      signature: 'contains(grid: list[list[int]], queries: list[int]) -> list[bool]',
      solution: code`def contains(grid: list[list[int]], queries: list[int]) -> list[bool]:
    out = []
    for q in queries:
        r, c, found = 0, (len(grid[0]) - 1 if grid else -1), False
        while r < len(grid) and c >= 0:
            v = grid[r][c]
            if v == q:
                found = True
                break
            if v > q:
                c -= 1
            else:
                r += 1
        out.append(found)
    return out
`,
      explanation: md('From the top-right corner every comparison eliminates a whole row or column, so at most m + n steps.'),
      tests: [
        ex('Example', [[1, 4, 7, 11], [2, 5, 8, 12], [3, 6, 9, 16], [10, 13, 14, 17]], [5, 20, 10]),
        ex('Single row', [[1, 3, 5]], [3, 4]),
        hid('Corners', [[1, 2], [3, 4]], [1, 4, 2, 3, 0]),
        hid('Tall column', [[1], [3], [5], [7]], [7, 4]),
      ],
    }),

    dsa({
      id: 'dsa-majority-half',
      title: 'The Value That Holds a Majority',
      difficulty: 'Easy',
      topics: ['Arrays', 'Hashing'],
      patterns: ['Boyer–Moore voting'],
      summary: 'Find the element appearing more than n/2 times in O(1) space, or -1 if none.',
      description: md('Return the element that appears **more than** `len(nums) // 2` times, or `-1` if no such element exists.'),
      hints: ['Voting: a candidate gains on equal, loses on different, and is replaced at zero. Verify with a second pass.'],
      signature: 'majority(nums: list[int]) -> int',
      solution: code`def majority(nums: list[int]) -> int:
    cand, votes = None, 0
    for x in nums:
        if votes == 0:
            cand = x
        votes += 1 if x == cand else -1
    return cand if nums.count(cand) > len(nums) // 2 else -1
`,
      explanation: md('Pairing off different values never eliminates a true majority, so it survives as the candidate. The verification pass handles inputs with no majority. O(n), O(1).'),
      tests: [
        ex('Example', [2, 2, 1, 1, 1, 2, 2]),
        ex('No majority', [1, 2, 3]),
        hid('Single', [9]),
        hid('Exactly half is not enough', [1, 1, 2, 2]),
      ],
    }),

    dsa({
      id: 'dsa-majority-third',
      title: 'Every Value Appearing More Than n/3 Times',
      difficulty: 'Medium',
      topics: ['Arrays', 'Hashing'],
      patterns: ['Extended Boyer–Moore (two candidates)'],
      summary: 'At most two values can exceed n/3 — find them with two candidates.',
      description: md('Return, sorted ascending, every value that appears more than `len(nums) // 3` times. Use O(1) extra space.'),
      hints: ['Keep two candidates and two counters; a value that matches neither decrements both.'],
      signature: 'majority_third(nums: list[int]) -> list[int]',
      solution: code`def majority_third(nums: list[int]) -> list[int]:
    c1 = c2 = None
    v1 = v2 = 0
    for x in nums:
        if x == c1:
            v1 += 1
        elif x == c2:
            v2 += 1
        elif v1 == 0:
            c1, v1 = x, 1
        elif v2 == 0:
            c2, v2 = x, 1
        else:
            v1 -= 1
            v2 -= 1
    limit = len(nums) // 3
    return sorted({c for c in (c1, c2) if c is not None and nums.count(c) > limit})
`,
      explanation: md('Removing triples of distinct values can’t remove a value with more than a third of the votes, so true answers survive among the two candidates; a verification pass filters false ones.'),
      tests: [
        ex('Example', [3, 2, 3]),
        ex('Two winners', [1, 1, 1, 3, 3, 2, 2, 2]),
        hid('None', [1, 2, 3, 4]),
        hid('Empty', []),
      ],
    }),

    dsa({
      id: 'dsa-grid-path-count',
      title: 'Count Routes Across a Grid (Right/Down Only)',
      difficulty: 'Medium',
      topics: ['Math & Number Theory', 'Dynamic Programming'],
      patterns: ['Combinatorics: C(m+n−2, m−1)'],
      summary: 'Number of monotone paths from the top-left to bottom-right of an m × n grid.',
      description: md('A robot moves only right or down on an `m × n` grid from the top-left to the bottom-right cell. Return the number of distinct routes for each `[m, n]`.'),
      hints: ['Any route is a sequence of (m−1) downs and (n−1) rights: choose positions of the downs.'],
      signature: 'unique_paths(sizes: list[list[int]]) -> list[int]',
      solution: code`from math import comb

def unique_paths(sizes: list[list[int]]) -> list[int]:
    return [comb(m + n - 2, m - 1) for m, n in sizes]
`,
      explanation: md('DP over the grid is O(mn); the closed form C(m+n−2, m−1) is O(min(m, n)).'),
      tests: [
        ex('Example', [[3, 7], [3, 2]]),
        ex('Single cell', [[1, 1]]),
        hid('Square', [[10, 10], [1, 9]]),
        hid('Long thin grids', [[1, 50], [2, 30], [17, 13]]),
      ],
    }),

    dsa({
      id: 'dsa-fast-power',
      title: 'Raise to a Power in O(log n) Multiplications',
      difficulty: 'Medium',
      topics: ['Math & Number Theory', 'Recursion & Backtracking'],
      patterns: ['Binary exponentiation'],
      summary: 'Compute x^n (n may be negative) with repeated squaring; also x^n mod m.',
      description: md('Return `[round(x ** n, 6), (a ** b) % m]` computed with fast exponentiation — `n` may be negative; `b ≥ 0`. Don’t call `pow` or `**` for the main loop.'),
      hints: ['Square the base and halve the exponent; multiply into the result when the low bit is set.'],
      signature: 'power(x: float, n: int, a: int, b: int, m: int) -> list',
      solution: code`def power(x: float, n: int, a: int, b: int, m: int) -> list:
    def fast(base, e, mod=None):
        result = 1
        while e:
            if e & 1:
                result = result * base if mod is None else result * base % mod
            base = base * base if mod is None else base * base % mod
            e >>= 1
        return result
    v = fast(x, abs(n))
    if n < 0:
        v = 1 / v
    return [round(v, 6), fast(a % m, b, m) % m]
`,
      explanation: md('Binary exponentiation uses the bits of the exponent: O(log n) multiplications. The modular form keeps numbers small and underpins hashing and cryptography.'),
      tests: [
        ex('Example', 2.0, 10, 3, 200, 13),
        ex('Negative exponent', 2.0, -2, 2, 0, 7),
        hid('Fractional base', 1.5, 3, 7, 13, 1000),
        hid('Zero exponent', 9.5, 0, 5, 1, 2),
      ],
    }),

    dsa({
      id: 'dsa-longest-consecutive-run',
      title: 'Longest Run of Consecutive Ids',
      difficulty: 'Medium',
      topics: ['Hashing', 'Arrays'],
      patterns: ['Start runs only at sequence heads'],
      summary: 'Length of the longest set of consecutive integers present, in O(n).',
      description: md('Given unsorted integers (duplicates allowed), return the length of the longest sequence `k, k+1, …, k+L−1` whose values all appear.'),
      hints: ['Put everything in a set; only start counting from x when x − 1 is absent.'],
      signature: 'longest_consecutive(nums: list[int]) -> int',
      solution: code`def longest_consecutive(nums: list[int]) -> int:
    present = set(nums)
    best = 0
    for x in present:
        if x - 1 not in present:
            y = x
            while y + 1 in present:
                y += 1
            best = max(best, y - x + 1)
    return best
`,
      explanation: md('Each run is walked once from its head, so the total work is O(n) despite the inner loop; sorting would be O(n log n).'),
      tests: [
        ex('Example', [100, 4, 200, 1, 3, 2]),
        ex('Duplicates', [0, 3, 7, 2, 5, 8, 4, 6, 0, 1]),
        hid('Empty', []),
        hid('Negatives', [-1, -2, 5, -3, 6]),
      ],
    }),

    dsa({
      id: 'dsa-zero-sum-span',
      title: 'Longest Stretch That Sums to Zero',
      difficulty: 'Medium',
      topics: ['Prefix Sums', 'Hashing'],
      patterns: ['First occurrence of each prefix sum'],
      summary: 'Length of the longest contiguous block with total 0.',
      description: md('Return the length of the longest contiguous subarray whose sum is exactly `0` (0 if none).'),
      hints: ['Two equal prefix sums bracket a zero-sum block; store the first index each prefix sum appears.'],
      signature: 'longest_zero_sum(nums: list[int]) -> int',
      solution: code`def longest_zero_sum(nums: list[int]) -> int:
    first, total, best = {0: -1}, 0, 0
    for i, x in enumerate(nums):
        total += x
        if total in first:
            best = max(best, i - first[total])
        else:
            first[total] = i
    return best
`,
      explanation: md('prefix[j] − prefix[i] = 0 ⇔ prefix sums equal. Keeping the earliest index maximises length. O(n).'),
      tests: [
        ex('Example', [15, -2, 2, -8, 1, 7, 10, 23]),
        ex('None', [1, 2, 3]),
        hid('Whole array', [1, -1, 2, -2]),
        hid('Zeros', [0, 0, 0]),
      ],
    }),

    dsa({
      id: 'dsa-xor-target-subarrays',
      title: 'Count Blocks Whose XOR Equals k',
      difficulty: 'Medium',
      topics: ['Prefix Sums', 'Hashing', 'Bit Manipulation'],
      patterns: ['Prefix XOR + frequency map'],
      summary: 'Number of contiguous subarrays whose XOR is exactly k.',
      description: md('Return how many contiguous subarrays have bitwise XOR equal to `k`.'),
      hints: ['xor(i..j) = px[j] ^ px[i−1]; count earlier prefixes equal to px[j] ^ k.'],
      signature: 'count_xor_k(nums: list[int], k: int) -> int',
      solution: code`from collections import Counter

def count_xor_k(nums: list[int], k: int) -> int:
    seen, px, count = Counter({0: 1}), 0, 0
    for x in nums:
        px ^= x
        count += seen[px ^ k]
        seen[px] += 1
    return count
`,
      explanation: md('XOR is its own inverse, so the "subarray sum equals k" prefix trick carries over directly. O(n).'),
      tests: [
        ex('Example', [4, 2, 2, 6, 4], 6),
        ex('Another', [5, 6, 7, 8, 9], 5),
        hid('Zero target', [1, 1, 1, 1], 0),
        hid('Empty', [], 3),
      ],
    }),

    dsa({
      id: 'dsa-subarray-sum-count',
      title: 'Count Blocks Adding Up to k',
      difficulty: 'Medium',
      topics: ['Prefix Sums', 'Hashing'],
      patterns: ['Prefix sum + frequency map'],
      summary: 'Number of contiguous subarrays (values may be negative) whose sum is k.',
      description: md('Return how many contiguous subarrays sum to exactly `k`. Values may be negative, so a sliding window does not work.'),
      hints: ['Count earlier prefix sums equal to current − k.'],
      signature: 'count_sum_k(nums: list[int], k: int) -> int',
      solution: code`from collections import Counter

def count_sum_k(nums: list[int], k: int) -> int:
    seen, total, count = Counter({0: 1}), 0, 0
    for x in nums:
        total += x
        count += seen[total - k]
        seen[total] += 1
    return count
`,
      explanation: md('With negatives a window can’t be shrunk greedily; the prefix-sum map counts every valid start in O(1) per element.'),
      tests: [
        ex('Example', [1, 1, 1], 2),
        ex('Negatives', [3, 4, 7, 2, -3, 1, 4, 2], 7),
        hid('Zero target', [0, 0], 0),
        hid('None', [1, 2], 10),
      ],
    }),

    dsa({
      id: 'dsa-leaders-from-right',
      title: 'Values Bigger Than Everything to Their Right',
      difficulty: 'Easy',
      topics: ['Arrays'],
      patterns: ['Suffix maximum scan'],
      summary: 'Return every element strictly greater than all elements after it, in original order.',
      description: md('An element is a *leader* if it is strictly greater than every element to its right (the last element always is). Return the leaders in left-to-right order.'),
      hints: ['Scan from the right keeping the maximum seen so far.'],
      signature: 'leaders(nums: list[int]) -> list[int]',
      solution: code`def leaders(nums: list[int]) -> list[int]:
    out, best = [], float("-inf")
    for x in reversed(nums):
        if x > best:
            out.append(x)
            best = x
    return out[::-1]
`,
      explanation: md('One right-to-left pass with a running maximum: O(n).'),
      tests: [
        ex('Example', [16, 17, 4, 3, 5, 2]),
        ex('Increasing', [1, 2, 3]),
        hid('Ties are not leaders', [5, 5, 1]),
        hid('Empty', []),
      ],
    }),

    dsa({
      id: 'dsa-rotate-by-k',
      title: 'Rotate a List Right by k in Place',
      difficulty: 'Easy',
      topics: ['Arrays', 'Two Pointers'],
      patterns: ['Triple reversal'],
      summary: 'Shift elements k places to the right (wrapping) using O(1) extra space.',
      description: md('Rotate `nums` to the right by `k` steps in place (k may exceed the length) and return it.'),
      hints: ['Reverse everything, then reverse the first k and the remaining n − k.'],
      signature: 'rotate_right(nums: list[int], k: int) -> list[int]',
      solution: code`def rotate_right(nums: list[int], k: int) -> list[int]:
    n = len(nums)
    if n == 0:
        return nums
    k %= n

    def rev(i, j):
        while i < j:
            nums[i], nums[j] = nums[j], nums[i]
            i += 1
            j -= 1

    rev(0, n - 1)
    rev(0, k - 1)
    rev(k, n - 1)
    return nums
`,
      explanation: md('Three in-place reversals produce the rotation in O(n) time and O(1) space; `k %= n` handles large k.'),
      tests: [
        ex('Example', [1, 2, 3, 4, 5, 6, 7], 3),
        ex('k larger than n', [1, 2], 5),
        hid('Zero', [4, 5, 6], 0),
        hid('Empty', [], 3),
      ],
    }),

    dsa({
      id: 'dsa-move-zeros-end',
      title: 'Push All Zeros to the End, Keeping Order',
      difficulty: 'Easy',
      topics: ['Arrays', 'Two Pointers'],
      patterns: ['Write pointer'],
      summary: 'Stable in-place compaction of non-zero values.',
      description: md('Move every `0` to the end of the list while keeping the relative order of the non-zero values. Modify in place and return the list.'),
      hints: ['A write index for the next non-zero slot; fill the tail with zeros afterwards (or swap).'],
      signature: 'move_zeros(nums: list[int]) -> list[int]',
      solution: code`def move_zeros(nums: list[int]) -> list[int]:
    w = 0
    for i, x in enumerate(nums):
        if x != 0:
            nums[w], nums[i] = nums[i], nums[w]
            w += 1
    return nums
`,
      explanation: md('Swapping each non-zero into the write slot keeps order and leaves zeros behind. O(n), O(1).'),
      tests: [
        ex('Example', [0, 1, 0, 3, 12]),
        ex('No zeros', [1, 2]),
        hid('All zeros', [0, 0, 0]),
        hid('Zeros at the end already', [5, 0, 0]),
      ],
    }),

    dsa({
      id: 'dsa-product-except-self',
      title: 'Product of Everything Except Me',
      difficulty: 'Medium',
      topics: ['Arrays', 'Prefix Sums'],
      patterns: ['Prefix and suffix products'],
      summary: 'For each index, the product of all other elements — without division.',
      description: md('Return a list where position `i` holds the product of all elements except `nums[i]`, without using division, in O(n).'),
      hints: ['Left products in one pass, multiply by a running right product in a second pass.'],
      signature: 'product_except_self(nums: list[int]) -> list[int]',
      solution: code`def product_except_self(nums: list[int]) -> list[int]:
    out = [1] * len(nums)
    left = 1
    for i, x in enumerate(nums):
        out[i] = left
        left *= x
    right = 1
    for i in range(len(nums) - 1, -1, -1):
        out[i] *= right
        right *= nums[i]
    return out
`,
      explanation: md('Prefix × suffix product avoids division (and therefore zero-division edge cases). O(n) time, O(1) extra besides the output.'),
      tests: [
        ex('Example', [1, 2, 3, 4]),
        ex('Contains zero', [-1, 1, 0, -3, 3]),
        hid('Two zeros', [0, 4, 0]),
        hid('Two elements', [5, 7]),
      ],
    }),
  ],
};
