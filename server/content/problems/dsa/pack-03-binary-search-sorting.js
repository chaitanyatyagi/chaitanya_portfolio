// DSA pack 03 — binary search on indices and on answers (rotated arrays,
// peaks, single element, k-th of two arrays, median of two arrays, nth root,
// capacity / pages / cows / bananas / bouquets / divisor), plus the sorting
// algorithms themselves (merge sort, quicksort partition, quickselect, counting).
import { dsa, md, code, ex, hid } from './define.js';

export default {
  problems: [
    dsa({
      id: 'dsa-floor-ceil-sorted',
      title: 'Floor, Ceiling and Insert Position',
      difficulty: 'Easy',
      topics: ['Binary Search'],
      patterns: ['Lower / upper bound'],
      summary: 'For each query in a sorted list: the floor, the ceiling, and where it would be inserted.',
      description: md('For each query `x` return `[floor, ceil, insert_at]`: the largest value ≤ x, the smallest value ≥ x (use `None` when absent) and the index where x would be inserted to keep order (before equal values). Implement the searches yourself.'),
      hints: ['lower_bound: first index with a[i] ≥ x. Floor is a[upper_bound − 1].'],
      signature: 'bounds(a: list[int], queries: list[int]) -> list[list]',
      solution: code`def bounds(a: list[int], queries: list[int]) -> list[list]:
    def first_at_least(x, strict=False):
        lo, hi = 0, len(a)
        while lo < hi:
            mid = (lo + hi) // 2
            if a[mid] < x or (strict and a[mid] == x):
                lo = mid + 1
            else:
                hi = mid
        return lo
    out = []
    for x in queries:
        lb = first_at_least(x)
        ub = first_at_least(x, strict=True)
        out.append([a[ub - 1] if ub else None, a[lb] if lb < len(a) else None, lb])
    return out
`,
      explanation: md('Every sorted-array search reduces to "first index where a predicate turns true" with the half-open `[lo, hi)` template — no off-by-one special cases.'),
      tests: [
        ex('Example', [1, 2, 8, 10, 10, 12, 19], [5, 10, 0, 20]),
        ex('Single', [4], [4]),
        hid('Empty list', [], [3]),
        hid('Duplicates', [2, 2, 2], [2, 1, 3]),
      ],
    }),

    dsa({
      id: 'dsa-rotated-search',
      title: 'Find a Value in a Rotated Sorted List',
      difficulty: 'Medium',
      topics: ['Binary Search'],
      patterns: ['Identify the sorted half'],
      summary: 'A sorted list of distinct values was rotated — find each query’s index in O(log n).',
      description: md('`nums` is an ascending list of distinct integers rotated at an unknown pivot. Return the index of each query or `-1`.'),
      hints: ['At least one half around mid is sorted; check whether the target lies in it.'],
      signature: 'search_rotated(nums: list[int], queries: list[int]) -> list[int]',
      solution: code`def search_rotated(nums: list[int], queries: list[int]) -> list[int]:
    def find(t):
        lo, hi = 0, len(nums) - 1
        while lo <= hi:
            mid = (lo + hi) // 2
            if nums[mid] == t:
                return mid
            if nums[lo] <= nums[mid]:
                if nums[lo] <= t < nums[mid]:
                    hi = mid - 1
                else:
                    lo = mid + 1
            else:
                if nums[mid] < t <= nums[hi]:
                    lo = mid + 1
                else:
                    hi = mid - 1
        return -1
    return [find(t) for t in queries]
`,
      explanation: md('Comparing the ends with mid reveals which half is in order; the target is either in that half (range check) or in the other. O(log n).'),
      tests: [
        ex('Example', [4, 5, 6, 7, 0, 1, 2], [0, 3, 4]),
        ex('Not rotated', [1, 3, 5], [5]),
        hid('Two elements', [3, 1], [1, 3, 2]),
        hid('Empty', [], [1]),
      ],
    }),

    dsa({
      id: 'dsa-rotated-search-dupes',
      title: 'Rotated Sorted List with Repeats: Is It There?',
      difficulty: 'Medium',
      topics: ['Binary Search'],
      patterns: ['Shrink ends when ambiguous'],
      summary: 'Same as the rotated search, but values may repeat.',
      description: md('`nums` is a non-decreasing list (duplicates allowed) rotated at an unknown pivot. Return for each query whether it is present.'),
      hints: ['When nums[lo] == nums[mid] == nums[hi] you can’t tell which half is sorted: shrink both ends by one.'],
      signature: 'contains_rotated(nums: list[int], queries: list[int]) -> list[bool]',
      solution: code`def contains_rotated(nums: list[int], queries: list[int]) -> list[bool]:
    def find(t):
        lo, hi = 0, len(nums) - 1
        while lo <= hi:
            mid = (lo + hi) // 2
            if nums[mid] == t:
                return True
            if nums[lo] == nums[mid] == nums[hi]:
                lo += 1
                hi -= 1
            elif nums[lo] <= nums[mid]:
                if nums[lo] <= t < nums[mid]:
                    hi = mid - 1
                else:
                    lo = mid + 1
            else:
                if nums[mid] < t <= nums[hi]:
                    lo = mid + 1
                else:
                    hi = mid - 1
        return False
    return [find(t) for t in queries]
`,
      explanation: md('Duplicates break the "which half is sorted" test only when all three probes are equal; shrinking the ends handles it, with a worst case of O(n).'),
      tests: [
        ex('Example', [2, 5, 6, 0, 0, 1, 2], [0, 3]),
        ex('Ambiguous ends', [1, 0, 1, 1, 1], [0, 2]),
        hid('All equal', [1, 1, 1], [1, 2]),
        hid('Pivot in the middle', [4, 5, 5, 6, 1, 2, 2, 3], [1, 3, 6, 7]),
      ],
    }),

    dsa({
      id: 'dsa-rotation-minimum',
      title: 'Smallest Value and Rotation Count',
      difficulty: 'Medium',
      topics: ['Binary Search'],
      patterns: ['Compare mid with the right end'],
      summary: 'In a rotated sorted list of distinct values, find the minimum and how many times it was rotated.',
      description: md('Return `[minimum, rotations]` where rotations is the index of the minimum.'),
      hints: ['If nums[mid] > nums[hi] the minimum is right of mid; otherwise it is at mid or to its left.'],
      signature: 'rotation_min(nums: list[int]) -> list[int]',
      solution: code`def rotation_min(nums: list[int]) -> list[int]:
    lo, hi = 0, len(nums) - 1
    while lo < hi:
        mid = (lo + hi) // 2
        if nums[mid] > nums[hi]:
            lo = mid + 1
        else:
            hi = mid
    return [nums[lo], lo]
`,
      explanation: md('The right end is always in the "lower" segment, so comparing against it tells which side contains the drop. O(log n).'),
      tests: [
        ex('Example', [3, 4, 5, 1, 2]),
        ex('Not rotated', [11, 13, 15, 17]),
        hid('Single', [7]),
        hid('Rotated by n − 1', [2, 3, 4, 5, 1]),
      ],
    }),

    dsa({
      id: 'dsa-lonely-element',
      title: 'The Only Value Without a Twin (Sorted)',
      difficulty: 'Medium',
      topics: ['Binary Search'],
      patterns: ['Pair parity'],
      summary: 'Every value appears twice except one, in a sorted list — find it in O(log n).',
      description: md('In a sorted list where every value appears exactly twice except one, return the single value.'),
      hints: ['Before the single element, pairs start at even indices; after it, at odd indices.'],
      signature: 'single_in_sorted(nums: list[int]) -> int',
      solution: code`def single_in_sorted(nums: list[int]) -> int:
    lo, hi = 0, len(nums) - 1
    while lo < hi:
        mid = (lo + hi) // 2
        if mid % 2:
            mid -= 1
        if nums[mid] == nums[mid + 1]:
            lo = mid + 2
        else:
            hi = mid
    return nums[lo]
`,
      explanation: md('Snapping mid to an even index and checking its partner tells which side of the single element we are on. O(log n). (Unsorted version: XOR everything.)'),
      tests: [
        ex('Example', [1, 1, 2, 3, 3, 4, 4, 8, 8]),
        ex('At the end', [3, 3, 7, 7, 10]),
        hid('At the start', [0, 1, 1]),
        hid('Single', [5]),
      ],
    }),

    dsa({
      id: 'dsa-find-a-peak',
      title: 'Find a Local Peak',
      difficulty: 'Medium',
      topics: ['Binary Search'],
      patterns: ['Climb toward the higher neighbour'],
      summary: 'Return the index of a peak (greater than its neighbours) in O(log n).',
      description: md('Adjacent values differ; positions outside the list count as −∞. Return the index of the peak found by moving toward the larger neighbour with binary search (this returns a deterministic peak).'),
      hints: ['If nums[mid] < nums[mid+1], a peak exists to the right.'],
      signature: 'peak_index(nums: list[int]) -> int',
      solution: code`def peak_index(nums: list[int]) -> int:
    lo, hi = 0, len(nums) - 1
    while lo < hi:
        mid = (lo + hi) // 2
        if nums[mid] < nums[mid + 1]:
            lo = mid + 1
        else:
            hi = mid
    return lo
`,
      explanation: md('Moving uphill always reaches a peak because the boundary is −∞; halving the range each time gives O(log n).'),
      tests: [
        ex('Example', [1, 2, 3, 1]),
        ex('Several peaks', [1, 2, 1, 3, 5, 6, 4]),
        hid('Decreasing', [5, 4, 3]),
        hid('Single', [9]),
      ],
    }),

    dsa({
      id: 'dsa-integer-nth-root',
      title: 'Integer n-th Root by Binary Search',
      difficulty: 'Easy',
      topics: ['Binary Search', 'Math & Number Theory'],
      patterns: ['Binary search on the answer'],
      summary: 'Largest r with r^n ≤ m, and whether it is exact.',
      description: md('For each `[n, m]` return `[r, exact]` where `r` is the largest integer with `r ** n <= m`, and `exact` tells whether `r ** n == m`.'),
      hints: ['Search r in [0, m]; compare r**n with m (Python ints are exact).'],
      signature: 'nth_roots(cases: list[list[int]]) -> list[list]',
      solution: code`def nth_roots(cases: list[list[int]]) -> list[list]:
    out = []
    for n, m in cases:
        lo, hi = 0, max(1, m)
        while lo < hi:
            mid = (lo + hi + 1) // 2
            if mid ** n <= m:
                lo = mid
            else:
                hi = mid - 1
        out.append([lo, lo ** n == m])
    return out
`,
      explanation: md('A monotone predicate (r^n ≤ m) over integers is the canonical "binary search on answer". Using the upper-mid avoids an infinite loop when searching for the last true.'),
      tests: [
        ex('Example', [[2, 16], [3, 27], [3, 30]]),
        ex('Zero and one', [[5, 0], [4, 1]]),
        hid('Large', [[2, 1000000], [4, 69], [6, 4096]]),
        hid('Just below a power', [[2, 99], [3, 63], [1, 42]]),
      ],
    }),

    dsa({
      id: 'dsa-eating-speed',
      title: 'Slowest Eating Speed to Finish in Time',
      difficulty: 'Medium',
      topics: ['Binary Search'],
      patterns: ['Binary search on the answer'],
      summary: 'Minimum per-hour rate to clear every pile within h hours.',
      description: md('Each hour you work on one pile and remove up to `k` items from it. Return the smallest integer `k` that finishes all `piles` within `h` hours.'),
      hints: ['Hours at speed k = Σ ceil(p / k); monotone in k.'],
      signature: 'min_speed(piles: list[int], h: int) -> int',
      solution: code`def min_speed(piles: list[int], h: int) -> int:
    lo, hi = 1, max(piles)
    while lo < hi:
        k = (lo + hi) // 2
        if sum((p + k - 1) // k for p in piles) <= h:
            hi = k
        else:
            lo = k + 1
    return lo
`,
      explanation: md('Feasibility is monotone in speed, so search the smallest feasible k between 1 and max(piles). O(n log max).'),
      tests: [
        ex('Example', [3, 6, 7, 11], 8),
        ex('Tight', [30, 11, 23, 4, 20], 5),
        hid('Loose', [30, 11, 23, 4, 20], 6),
        hid('One pile', [1000000], 3),
      ],
    }),

    dsa({
      id: 'dsa-bouquet-days',
      title: 'Earliest Day to Make m Bouquets',
      difficulty: 'Medium',
      topics: ['Binary Search'],
      patterns: ['Binary search on the answer'],
      summary: 'Flowers bloom on given days; a bouquet needs k adjacent bloomed flowers.',
      description: md('`bloom[i]` is the day flower i blooms. A bouquet uses `k` **adjacent** bloomed flowers. Return the minimum day on which `m` bouquets can be made, or −1.'),
      hints: ['For a candidate day, count runs of bloomed flowers greedily.'],
      signature: 'min_days(bloom: list[int], m: int, k: int) -> int',
      solution: code`def min_days(bloom: list[int], m: int, k: int) -> int:
    if m * k > len(bloom):
        return -1

    def bouquets(day):
        made = run = 0
        for b in bloom:
            run = run + 1 if b <= day else 0
            if run == k:
                made += 1
                run = 0
        return made

    lo, hi = min(bloom), max(bloom)
    while lo < hi:
        mid = (lo + hi) // 2
        if bouquets(mid) >= m:
            hi = mid
        else:
            lo = mid + 1
    return lo
`,
      explanation: md('More days never reduce the bouquet count, so the earliest feasible day is a binary search over the day range.'),
      tests: [
        ex('Example', [1, 10, 3, 10, 2], 3, 1),
        ex('Impossible', [1, 10, 3, 10, 2], 3, 2),
        hid('Adjacency matters', [7, 7, 7, 7, 12, 7, 7], 2, 3),
        hid('Single bouquet', [5], 1, 1),
      ],
    }),

    dsa({
      id: 'dsa-smallest-divisor',
      title: 'Smallest Divisor Keeping the Rounded Sum Small',
      difficulty: 'Medium',
      topics: ['Binary Search'],
      patterns: ['Binary search on the answer'],
      summary: 'Minimum d with Σ ceil(x / d) ≤ threshold.',
      description: md('Return the smallest positive integer `d` such that the sum of `ceil(x / d)` over all values is at most `threshold`.'),
      hints: ['The rounded sum decreases as d grows.'],
      signature: 'smallest_divisor(nums: list[int], threshold: int) -> int',
      solution: code`def smallest_divisor(nums: list[int], threshold: int) -> int:
    lo, hi = 1, max(nums)
    while lo < hi:
        d = (lo + hi) // 2
        if sum((x + d - 1) // d for x in nums) <= threshold:
            hi = d
        else:
            lo = d + 1
    return lo
`,
      explanation: md('Same template as eating speed: a monotone cost function and a bounded answer range.'),
      tests: [
        ex('Example', [1, 2, 5, 9], 6),
        ex('Another', [44, 22, 33, 11, 1], 5),
        hid('Generous threshold', [2, 3, 5], 100),
        hid('Tight threshold', [19], 5),
      ],
    }),

    dsa({
      id: 'dsa-ship-capacity',
      title: 'Smallest Truck Capacity to Deliver in d Days',
      difficulty: 'Medium',
      topics: ['Binary Search', 'Greedy'],
      patterns: ['Binary search on the answer + greedy check'],
      summary: 'Packages ship in order; find the minimum daily capacity to finish within d days.',
      description: md('Packages must be shipped in the given order; each day the truck carries a prefix of the remaining packages up to its capacity. Return the least capacity that ships everything within `days` days.'),
      hints: ['Search between max(weights) and sum(weights); simulate greedily.'],
      signature: 'ship_within(weights: list[int], days: int) -> int',
      solution: code`def ship_within(weights: list[int], days: int) -> int:
    def needed(cap):
        d, load = 1, 0
        for w in weights:
            if load + w > cap:
                d += 1
                load = 0
            load += w
        return d

    lo, hi = max(weights), sum(weights)
    while lo < hi:
        mid = (lo + hi) // 2
        if needed(mid) <= days:
            hi = mid
        else:
            lo = mid + 1
    return lo
`,
      explanation: md('"Minimise the maximum load of contiguous groups" — the same shape as book allocation and split-array-largest-sum. O(n log Σ).'),
      tests: [
        ex('Example', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5),
        ex('Three days', [3, 2, 2, 4, 1, 4], 3),
        hid('One day', [1, 2, 3], 1),
        hid('One per day', [5, 1, 1], 3),
      ],
    }),

    dsa({
      id: 'dsa-allocate-chapters',
      title: 'Split Chapters Among Readers Fairly',
      difficulty: 'Hard',
      topics: ['Binary Search', 'Greedy'],
      patterns: ['Minimise the maximum contiguous group'],
      summary: 'Give each of k readers a contiguous run of chapters (≥ 1 each) minimising the largest load.',
      description: md('`pages[i]` is chapter i’s length. Assign contiguous runs to exactly `k` readers, each receiving at least one chapter, minimising the maximum pages any reader gets. Return that minimum, or −1 if k > number of chapters.'),
      hints: ['Feasible(limit): greedily count readers needed; it must be ≤ k.'],
      signature: 'allocate(pages: list[int], k: int) -> int',
      solution: code`def allocate(pages: list[int], k: int) -> int:
    if k > len(pages):
        return -1

    def readers(limit):
        count, load = 1, 0
        for p in pages:
            if load + p > limit:
                count += 1
                load = 0
            load += p
        return count

    lo, hi = max(pages), sum(pages)
    while lo < hi:
        mid = (lo + hi) // 2
        if readers(mid) <= k:
            hi = mid
        else:
            lo = mid + 1
    return lo
`,
      explanation: md('If a limit works with fewer than k readers, splitting further keeps it valid (k ≤ n), so "≤ k" is the right feasibility test. Also known as painter’s partition / split array largest sum.'),
      tests: [
        ex('Example', [12, 34, 67, 90], 2),
        ex('Five readers', [25, 46, 28, 49, 24], 4),
        hid('Too many readers', [10, 20], 3),
        hid('One reader', [5, 5, 5], 1),
      ],
    }),

    dsa({
      id: 'dsa-spread-out-stalls',
      title: 'Place k Sensors as Far Apart as Possible',
      difficulty: 'Hard',
      topics: ['Binary Search', 'Greedy'],
      patterns: ['Maximise the minimum gap'],
      summary: 'Choose k positions maximising the smallest distance between any two.',
      description: md('Given candidate positions (unsorted, distinct), place `k` sensors at k of them so that the minimum distance between any two sensors is as large as possible. Return that distance.'),
      hints: ['Sort. Feasible(gap): greedily place at the first position, then each next position ≥ last + gap.'],
      signature: 'max_min_gap(positions: list[int], k: int) -> int',
      solution: code`def max_min_gap(positions: list[int], k: int) -> int:
    pos = sorted(positions)

    def fits(gap):
        count, last = 1, pos[0]
        for p in pos[1:]:
            if p - last >= gap:
                count += 1
                last = p
        return count >= k

    lo, hi = 0, pos[-1] - pos[0]
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if fits(mid):
            lo = mid
        else:
            hi = mid - 1
    return lo
`,
      explanation: md('"Aggressive cows": the predicate "a gap of g is achievable" is monotone decreasing, so search the largest true value with the upper-mid template. O(n log range).'),
      tests: [
        ex('Example', [1, 2, 8, 4, 9], 3),
        ex('Four sensors', [0, 3, 4, 7, 10, 9], 4),
        hid('All positions', [1, 2, 3], 3),
        hid('Two far apart', [1, 1000], 2),
      ],
    }),

    dsa({
      id: 'dsa-kth-of-two-sorted',
      title: 'The k-th Smallest Across Two Sorted Lists',
      difficulty: 'Hard',
      topics: ['Binary Search'],
      patterns: ['Partition binary search'],
      summary: 'Find the k-th element (1-based) of the merged order without merging.',
      description: md('Given sorted `a` and `b`, return the k-th smallest value of their union (counting duplicates), in O(log(min(|a|, |b|))).'),
      hints: ['Binary search how many elements (i) to take from a; take k − i from b; check the cross conditions.'],
      signature: 'kth_of_two(a: list[int], b: list[int], k: int) -> int',
      solution: code`def kth_of_two(a: list[int], b: list[int], k: int) -> int:
    if len(a) > len(b):
        a, b = b, a
    lo, hi = max(0, k - len(b)), min(k, len(a))
    INF = float("inf")
    while lo <= hi:
        i = (lo + hi) // 2
        j = k - i
        a_left = a[i - 1] if i else -INF
        a_right = a[i] if i < len(a) else INF
        b_left = b[j - 1] if j else -INF
        b_right = b[j] if j < len(b) else INF
        if a_left <= b_right and b_left <= a_right:
            return max(a_left, b_left)
        if a_left > b_right:
            hi = i - 1
        else:
            lo = i + 1
    return -1
`,
      explanation: md('A valid split has every left element ≤ every right element; the k-th element is the larger of the two left maxima. Searching the smaller array keeps it logarithmic.'),
      tests: [
        ex('Example', [2, 3, 6, 7, 9], [1, 4, 8, 10], 5),
        ex('First element', [100], [1, 2], 1),
        hid('Last element', [1, 3], [2, 4], 4),
        hid('One empty', [], [5, 6, 7], 2),
      ],
    }),

    dsa({
      id: 'dsa-median-two-sorted',
      title: 'Median of Two Sorted Lists in Log Time',
      difficulty: 'Hard',
      topics: ['Binary Search'],
      patterns: ['Partition binary search'],
      summary: 'Median of the union of two sorted lists without merging.',
      description: md('Return the median of all values in `a` and `b` combined (average of the middle two for an even count), in O(log(min(m, n))).'),
      hints: ['Partition so that the left halves hold (m + n + 1) // 2 elements in total and every left ≤ every right.'],
      signature: 'median_two(a: list[int], b: list[int]) -> float',
      solution: code`def median_two(a: list[int], b: list[int]) -> float:
    if len(a) > len(b):
        a, b = b, a
    m, n = len(a), len(b)
    half = (m + n + 1) // 2
    lo, hi = 0, m
    INF = float("inf")
    while lo <= hi:
        i = (lo + hi) // 2
        j = half - i
        al = a[i - 1] if i else -INF
        ar = a[i] if i < m else INF
        bl = b[j - 1] if j else -INF
        br = b[j] if j < n else INF
        if al <= br and bl <= ar:
            if (m + n) % 2:
                return float(max(al, bl))
            return (max(al, bl) + min(ar, br)) / 2
        if al > br:
            hi = i - 1
        else:
            lo = i + 1
    return 0.0
`,
      explanation: md('The median sits at the boundary of a balanced partition; binary searching the cut in the smaller array finds it in O(log min(m, n)).'),
      tests: [
        ex('Odd total', [1, 3], [2]),
        ex('Even total', [1, 2], [3, 4]),
        hid('One empty', [], [2, 3]),
        hid('Interleaved', [1, 4, 7, 10], [2, 3, 8, 9, 11]),
      ],
    }),

    dsa({
      id: 'dsa-row-most-ones',
      title: 'Which Row Has the Most Ones?',
      difficulty: 'Easy',
      topics: ['Binary Search', 'Matrices'],
      patterns: ['Lower bound per row'],
      summary: 'Each row is sorted (0s then 1s) — find the first row with the most 1s.',
      description: md('Every row of the binary grid is sorted (all 0s before 1s). Return `[row, ones]` for the row with the most 1s (lowest index on ties), or `[-1, 0]` if there are none.'),
      hints: ['Ones in a row = width − index of the first 1 (binary search).'],
      signature: 'row_most_ones(grid: list[list[int]]) -> list[int]',
      solution: code`from bisect import bisect_left

def row_most_ones(grid: list[list[int]]) -> list[int]:
    best, row = 0, -1
    for i, r in enumerate(grid):
        ones = len(r) - bisect_left(r, 1)
        if ones > best:
            best, row = ones, i
    return [row, best]
`,
      explanation: md('O(m log n) with binary search; the staircase walk from the top-right gives O(m + n).'),
      tests: [
        ex('Example', [[0, 1, 1, 1], [0, 0, 1, 1], [1, 1, 1, 1], [0, 0, 0, 0]]),
        ex('No ones', [[0, 0], [0, 0]]),
        hid('Tie', [[0, 1], [0, 1]]),
        hid('Last row wins', [[0, 0, 0], [0, 0, 1], [0, 1, 1]]),
      ],
    }),

    dsa({
      id: 'dsa-matrix-median',
      title: 'Median of a Row-Sorted Grid',
      difficulty: 'Hard',
      topics: ['Binary Search', 'Matrices'],
      patterns: ['Binary search on value with counting'],
      summary: 'Each row is sorted; the total count is odd. Find the overall median without flattening.',
      description: md('Every row of the grid is sorted and `rows × cols` is odd. Return the median of all values.'),
      hints: ['For a candidate value v, count elements ≤ v with bisect in each row; find the smallest v with count > total // 2.'],
      signature: 'grid_median(grid: list[list[int]]) -> int',
      solution: code`from bisect import bisect_right

def grid_median(grid: list[list[int]]) -> int:
    lo = min(r[0] for r in grid)
    hi = max(r[-1] for r in grid)
    need = len(grid) * len(grid[0]) // 2
    while lo < hi:
        mid = (lo + hi) // 2
        if sum(bisect_right(r, mid) for r in grid) <= need:
            lo = mid + 1
        else:
            hi = mid
    return lo
`,
      explanation: md('Binary search over the value range; each probe counts in O(rows · log cols). Total O(rows · log cols · log range) with O(1) extra memory.'),
      tests: [
        ex('Example', [[1, 3, 5], [2, 6, 9], [3, 6, 9]]),
        ex('Single row', [[1, 2, 3, 4, 5]]),
        hid('Duplicates', [[1, 1, 1], [1, 1, 2], [2, 2, 2]]),
        hid('Tall grid', [[1], [9], [5], [3], [7]]),
      ],
    }),

    dsa({
      id: 'dsa-merge-sort-impl',
      title: 'Implement Merge Sort (Stable)',
      difficulty: 'Medium',
      topics: ['Sorting', 'Recursion & Backtracking'],
      patterns: ['Divide and conquer'],
      summary: 'Sort records by key with your own stable merge sort and report the number of merge steps.',
      description: md('Sort `[key, label]` records by key ascending — equal keys keep their input order — using merge sort you write yourself (no `sorted`/`sort`). Return `[sorted_records, merges]` where `merges` counts merge calls on two non-empty halves.'),
      hints: ['Take from the left half on ties (≤) to stay stable.'],
      signature: 'merge_sort(records: list[list]) -> list',
      solution: code`def merge_sort(records: list[list]) -> list:
    merges = 0

    def sort(a):
        nonlocal merges
        if len(a) <= 1:
            return a
        mid = len(a) // 2
        left, right = sort(a[:mid]), sort(a[mid:])
        merges += 1
        out, i, j = [], 0, 0
        while i < len(left) and j < len(right):
            if left[i][0] <= right[j][0]:
                out.append(left[i])
                i += 1
            else:
                out.append(right[j])
                j += 1
        return out + left[i:] + right[j:]

    return [sort(records), merges]
`,
      explanation: md('Merge sort is O(n log n) in every case and stable when ties favour the left half — which is why it (via Timsort) is Python’s built-in sort strategy. It uses O(n) extra memory.'),
      tests: [
        ex('Example', [[3, 'c'], [1, 'a'], [3, 'b'], [2, 'x']]),
        ex('Single', [[5, 'only']]),
        hid('Reverse with ties', [[2, 'a'], [2, 'b'], [1, 'c'], [1, 'd']]),
        hid('Empty', []),
      ],
    }),

    dsa({
      id: 'dsa-quickselect-kth',
      title: 'k-th Largest with Quickselect (Lomuto Partition)',
      difficulty: 'Medium',
      topics: ['Sorting', 'Arrays'],
      patterns: ['Partition around a pivot'],
      summary: 'Find the k-th largest value in average O(n) using a deterministic last-element pivot.',
      description: md('Implement Lomuto partitioning (pivot = last element of the range) and use it to find the k-th largest value. Return `[value, partitions]` where `partitions` counts partition calls.'),
      hints: ['The k-th largest is index n − k in ascending order; recurse only into the side containing it.'],
      signature: 'kth_largest(nums: list[int], k: int) -> list[int]',
      solution: code`def kth_largest(nums: list[int], k: int) -> list[int]:
    a = list(nums)
    target = len(a) - k
    lo, hi, calls = 0, len(a) - 1, 0
    while True:
        calls += 1
        pivot, store = a[hi], lo
        for i in range(lo, hi):
            if a[i] < pivot:
                a[i], a[store] = a[store], a[i]
                store += 1
        a[store], a[hi] = a[hi], a[store]
        if store == target:
            return [a[store], calls]
        if store < target:
            lo = store + 1
        else:
            hi = store - 1
`,
      explanation: md('Partition places the pivot at its final sorted position; only one side needs further work, giving O(n) average (O(n²) worst case — randomise the pivot in production, or use a heap for O(n log k)).'),
      tests: [
        ex('Example', [3, 2, 1, 5, 6, 4], 2),
        ex('With duplicates', [3, 2, 3, 1, 2, 4, 5, 5, 6], 4),
        hid('Largest', [7, 1, 9], 1),
        hid('Smallest', [7, 1, 9], 3),
      ],
    }),

    dsa({
      id: 'dsa-counting-sort-grades',
      title: 'Counting Sort for Small Integer Keys',
      difficulty: 'Easy',
      topics: ['Sorting', 'Hashing'],
      patterns: ['Counting sort'],
      summary: 'Sort scores in the range 0..100 in linear time and report the histogram.',
      description: md('Sort integer scores between `0` and `max_score` with counting sort (no comparison sort). Return `[sorted_scores, nonzero_histogram]` where the histogram is `[[score, count], …]` ascending.'),
      hints: ['One count array of size max_score + 1.'],
      signature: 'counting_sort(scores: list[int], max_score: int) -> list',
      solution: code`def counting_sort(scores: list[int], max_score: int) -> list:
    counts = [0] * (max_score + 1)
    for s in scores:
        counts[s] += 1
    out = []
    for value, c in enumerate(counts):
        out.extend([value] * c)
    return [out, [[v, c] for v, c in enumerate(counts) if c]]
`,
      explanation: md('When keys come from a small range k, counting sort is O(n + k) — beating the O(n log n) comparison lower bound. Radix sort applies it digit by digit for larger keys.'),
      tests: [
        ex('Example', [88, 70, 88, 100, 0, 70], 100),
        ex('Empty', [], 10),
        hid('All same', [5, 5, 5], 5),
        hid('Extremes', [10, 0, 10, 0, 5], 10),
      ],
    }),
  ],
};
