// Python pack 2 — lists, tuples, dicts and sets: hash-map lookups, counting,
// set algebra, merging and multi-key sorting (the "dicts as GROUP BY" tier
// most Python data screens turn on).
import { python, md, code, ex, hid } from './define.js';
import { dev, dlp, ddp, gfg, lds, tag } from './sources.js';

const DE = ['Data Engineer'];
const DE_DA = ['Data Engineer', 'Data Analyst'];

export default {
  problems: [
    python({
      id: 'two-sum-indices',
      title: 'Two Transactions That Hit the Target',
      difficulty: 'Easy',
      topics: ['Hash Maps & Counting', 'Lists & Tuples'],
      patterns: ['Complement lookup in a dict'],
      domains: ['Payments'],
      ...tag(dlp('Amazon', 'Two Sum'), dev('Microsoft', 'two sum (return indices)'), dev('Oracle', 'two-sum')),
      roles: DE,
      summary: 'Find the first pair of transactions whose amounts add up to a target, in one pass.',
      description: md(
        'Return the indices `[i, j]` (`i < j`) of two amounts in `amounts` that add up to `target`. If several pairs work, return the one whose **second index `j` is smallest** (and, for that `j`, the smallest `i`). Return `[]` if there is no pair.',
        '',
        '```',
        'amounts = [40, 15, 25, 60], target = 40   →   [1, 2]',
        '```',
      ),
      hints: [
        'Walk left to right, remembering the first index of each value you have seen.',
        'At index j, the partner you need is `target - amounts[j]` — a dict lookup, not a second loop.',
      ],
      entry: 'two_sum',
      signature: 'two_sum(amounts: list[int], target: int) -> list[int]',
      solution: code`def two_sum(amounts: list[int], target: int) -> list[int]:
    first_index = {}
    for j, amount in enumerate(amounts):
        i = first_index.get(target - amount)
        if i is not None:
            return [i, j]
        first_index.setdefault(amount, j)
    return []
`,
      explanation: md(
        'One pass, O(n): each value looks up its complement among the values **before** it, so the first hit is the pair with the smallest `j`. `setdefault` keeps the earliest index of duplicated values, which gives the smallest `i`.',
        '',
        'Checking before inserting matters: otherwise `[20]` with target 40 would pair an element with itself.',
      ),
      tests: [
        ex('Example', [40, 15, 25, 60], 40),
        ex('No pair', [1, 2, 3], 100),
        hid('Same value twice', [20, 5, 20], 40),
        hid('Element cannot pair with itself', [20], 40),
        hid('Negative amounts', [-10, 30, 50, 5], 40),
        hid('Earliest second index wins', [1, 9, 5, 5, 9], 10),
      ],
    }),

    python({
      id: 'count-target-pairs',
      title: 'Count Distinct Pairs with a Given Sum',
      difficulty: 'Medium',
      topics: ['Hash Maps & Counting', 'Dicts & Sets'],
      patterns: ['Complement lookup in a dict'],
      domains: ['E-commerce / Sales'],
      ...tag(dlp('Amazon', 'Two Sum (Part 2)')),
      roles: DE,
      summary: 'Count the distinct value pairs that sum to a target, without double counting duplicates.',
      description: md(
        'Count the **distinct value pairs** `(a, b)` with `a <= b` such that `a + b == target`, using two different positions of `prices`. `(5, 5)` only counts if 5 appears at least twice.',
        '',
        '```',
        'prices = [1, 5, 7, 5, 3, 9, 1], target = 10   →   3     (1+9, 3+7, 5+5)',
        '```',
      ),
      hints: [
        'Count every value with `Counter`, then look at each distinct value `a` once.',
        'Only count pairs with `a < target - a`, plus the special case `a == target - a` when the value occurs twice.',
      ],
      entry: 'count_pairs',
      signature: 'count_pairs(prices: list[int], target: int) -> int',
      solution: code`from collections import Counter

def count_pairs(prices: list[int], target: int) -> int:
    counts = Counter(prices)
    pairs = 0
    for a in counts:
        b = target - a
        if a < b and b in counts:
            pairs += 1
        elif a == b and counts[a] >= 2:
            pairs += 1
    return pairs
`,
      explanation: md('Working on distinct values (the `Counter` keys) is what makes pairs distinct; requiring `a < b` counts each unordered pair once. The `a == b` case needs two copies. O(n).'),
      tests: [
        ex('Example', [1, 5, 7, 5, 3, 9, 1], 10),
        ex('Nothing pairs', [1, 2], 10),
        hid('Single five cannot pair with itself', [5, 1], 10),
        hid('Many duplicates count once', [2, 2, 2, 2, 8, 8], 10),
        hid('Negatives', [-3, 13, 0, 10, 4, 6], 10),
        hid('Empty list', [], 0),
      ],
    }),

    python({
      id: 'pairs-divisible-by-k',
      title: 'Pairs Whose Sum Is a Multiple of K',
      difficulty: 'Medium',
      topics: ['Hash Maps & Counting', 'Math & Bits'],
      patterns: ['Bucket by remainder'],
      domains: ['Mobility / Ride-hailing'],
      ...tag(dev('Uber', 'pairs summing to a multiple of K')),
      roles: DE,
      summary: 'Count index pairs whose fares add up to a multiple of k, in linear time.',
      description: md(
        'Count the index pairs `i < j` such that `(fares[i] + fares[j]) % k == 0`. `k` is at least 1; fares are non-negative integers.',
        '',
        '```',
        'fares = [3, 7, 5, 9, 1], k = 4   →   6      (3 and 7 each pair with 5, 9 and 1)',
        '```',
        '',
        'Brute force is O(n²); aim for O(n).',
      ),
      hints: [
        'Two numbers sum to a multiple of k exactly when their remainders add up to 0 or k.',
        'Walk left to right with a count of remainders seen so far; each new fare pairs with every earlier fare whose remainder is `(k - r) % k`.',
      ],
      entry: 'count_divisible_pairs',
      signature: 'count_divisible_pairs(fares: list[int], k: int) -> int',
      solution: code`def count_divisible_pairs(fares: list[int], k: int) -> int:
    seen = [0] * k
    pairs = 0
    for fare in fares:
        r = fare % k
        pairs += seen[(k - r) % k]
        seen[r] += 1
    return pairs
`,
      explanation: md('Only remainders matter. Counting how many earlier fares have the complementary remainder turns the pair search into a lookup; `(k - r) % k` maps remainder 0 to itself. O(n) time, O(k) space.'),
      tests: [
        ex('Example', [3, 7, 5, 9, 1], 4),
        ex('k = 1 pairs everything', [1, 2, 3], 1),
        hid('No pairs', [1, 1], 5),
        hid('Zeros', [0, 0, 0], 3),
        hid('Remainder halves', [2, 4, 6, 8], 4),
        hid('Single fare', [10], 5),
      ],
    }),

    python({
      id: 'contains-duplicate',
      title: 'Did Any Event ID Repeat?',
      difficulty: 'Easy',
      topics: ['Dicts & Sets'],
      patterns: ['Seen-set scan'],
      domains: ['Event pipelines'],
      ...tag(dlp('Apple', 'Contains Duplicate')),
      roles: DE,
      summary: 'Detect whether a batch of event IDs contains any duplicate.',
      description: md('Return `True` if any event ID appears more than once in `ids`, else `False`.'),
      hints: ['`len(set(ids)) != len(ids)` is one line — but a loop that stops at the first repeat is faster on big batches with an early duplicate.'],
      entry: 'has_duplicate',
      signature: 'has_duplicate(ids: list[str]) -> bool',
      solution: code`def has_duplicate(ids: list[str]) -> bool:
    seen = set()
    for event_id in ids:
        if event_id in seen:
            return True
        seen.add(event_id)
    return False
`,
      explanation: md('Both versions are O(n); the early-exit loop can stop after a few items, while `set(ids)` always reads the whole batch.'),
      tests: [
        ex('Example', ['e1', 'e2', 'e1']),
        ex('All unique', ['a', 'b', 'c']),
        hid('Empty batch', []),
        hid('Case matters', ['ID', 'id']),
        hid('Repeat at the end', ['x', 'y', 'z', 'x']),
      ],
    }),

    python({
      id: 'first-duplicate-order',
      title: 'Where the First Duplicate Order Appears',
      difficulty: 'Easy',
      topics: ['Dicts & Sets', 'Lists & Tuples'],
      patterns: ['Seen-set scan'],
      domains: ['E-commerce / Sales'],
      ...tag(dev('Amazon', 'first duplicate ID'), dev('Airbnb', 'first duplicate in order ids')),
      roles: DE,
      summary: 'Return both positions of the order ID whose second occurrence comes first.',
      description: md(
        'An ingestion job sometimes writes the same order twice. Find the duplicate whose **second occurrence comes earliest** and return `[first_index, second_index]`. Return `[]` if there are no duplicates.',
        '',
        '```',
        '[7, 3, 9, 3, 7]   →   [1, 3]',
        '```',
      ),
      hints: ['A dict from order ID → first index lets you answer at the moment a repeat shows up.'],
      entry: 'first_duplicate',
      signature: 'first_duplicate(order_ids: list[int]) -> list[int]',
      solution: code`def first_duplicate(order_ids: list[int]) -> list[int]:
    first_seen = {}
    for i, order_id in enumerate(order_ids):
        if order_id in first_seen:
            return [first_seen[order_id], i]
        first_seen[order_id] = i
    return []
`,
      explanation: md('The scan stops at the first index whose ID was seen before — the earliest second occurrence. Storing the first index (not just membership) is what lets you report both positions.'),
      tests: [
        ex('Example', [7, 3, 9, 3, 7]),
        ex('No duplicates', [1, 2, 3]),
        hid('Empty', []),
        hid('Adjacent duplicate', [5, 5, 1, 1]),
        hid('Triple occurrence', [4, 8, 4, 4]),
      ],
    }),

    python({
      id: 'merge-sku-quantities',
      title: 'Merge Quantities by SKU',
      difficulty: 'Easy',
      topics: ['Dicts & Sets', 'Sorting'],
      patterns: ['Dict as GROUP BY'],
      domains: ['E-commerce / Sales'],
      ...tag(dev('Amazon', 'merge SKU quantities'), dev('Airbnb', 'merge quantities by key'), gfg('Accenture', 'basics of lists and dictionaries')),
      roles: DE_DA,
      summary: 'Combine two warehouse feeds into one quantity per SKU.',
      description: md(
        'Two warehouses report stock as lists of `[sku, quantity]` pairs; a SKU may appear several times in one feed. Return the combined total per SKU as `[sku, total]` pairs **sorted by SKU**. Drop SKUs whose total is 0.',
        '',
        '```',
        'a = [["X1", 3], ["A2", 1]], b = [["X1", 2], ["A2", -1]]   →   [["X1", 5]]',
        '```',
      ),
      hints: ['`collections.defaultdict(int)` (or `Counter`) accumulates without key checks; walk both feeds into the same dict.'],
      entry: 'merge_quantities',
      signature: 'merge_quantities(a: list[list], b: list[list]) -> list[list]',
      solution: code`from collections import defaultdict

def merge_quantities(a: list[list], b: list[list]) -> list[list]:
    totals = defaultdict(int)
    for sku, qty in a + b:
        totals[sku] += qty
    return [[sku, n] for sku, n in sorted(totals.items()) if n != 0]
`,
      explanation: md('This is SQL\'s `GROUP BY sku` in Python: one dict, one pass. Note `Counter.update` would also work, but `Counter`\'s `+` operator silently drops zero **and negative** totals, which is easy to trip over.'),
      tests: [
        ex('Example', [['X1', 3], ['A2', 1]], [['X1', 2], ['A2', -1]]),
        ex('Disjoint feeds', [['B', 1]], [['A', 2]]),
        hid('Both empty', [], []),
        hid('Repeats inside one feed', [['K', 1], ['K', 1], ['K', 1]], []),
        hid('Negative totals are kept', [['R', 1]], [['R', -3]]),
      ],
    }),

    python({
      id: 'ordered-intersection',
      title: 'Common Customers, in Order',
      difficulty: 'Easy',
      topics: ['Hash Maps & Counting', 'Lists & Tuples'],
      patterns: ['Multiset intersection'],
      domains: ['Marketing / CRM'],
      ...tag(dlp('Amazon', 'Intersection of Two Lists'), dev('Lyft', 'array intersection without set')),
      roles: DE,
      summary: 'Intersect two lists keeping duplicates as many times as both contain them, in the first list\'s order.',
      description: md(
        'Return the values that appear in both `a` and `b`. A value appearing `x` times in `a` and `y` times in `b` appears `min(x, y)` times in the result, in the order those occurrences appear in `a`.',
        '',
        '```',
        'a = [4, 9, 5, 9, 4], b = [9, 4, 9, 8, 4]   →   [4, 9, 9, 4]',
        '```',
      ),
      hints: ['Count `b` with a `Counter`; walk `a` and take a value whenever its remaining count is positive, decrementing as you go.'],
      entry: 'intersect',
      signature: 'intersect(a: list[int], b: list[int]) -> list[int]',
      solution: code`from collections import Counter

def intersect(a: list[int], b: list[int]) -> list[int]:
    remaining = Counter(b)
    out = []
    for x in a:
        if remaining[x] > 0:
            out.append(x)
            remaining[x] -= 1
    return out
`,
      explanation: md('A plain `set(a) & set(b)` loses both duplicates and order. Counting one side and "spending" counts while walking the other keeps both, in O(len(a) + len(b)). If both lists were sorted, two pointers would do it with O(1) extra space.'),
      tests: [
        ex('Example', [4, 9, 5, 9, 4], [9, 4, 9, 8, 4]),
        ex('Nothing in common', [1, 2], [3]),
        hid('Duplicates limited by the shorter side', [1, 1, 1], [1, 1]),
        hid('Empty side', [], [1, 2]),
        hid('Order follows the first list', [3, 2, 1], [1, 2, 3]),
      ],
    }),

    python({
      id: 'id-reconciliation',
      title: 'Reconcile Two ID Exports',
      difficulty: 'Easy',
      topics: ['Dicts & Sets'],
      patterns: ['Set algebra diff'],
      domains: ['Data quality'],
      ...tag(lds('Wayfair', 'wayfair', 'Products Without Orders'), lds('Pinterest', 'pinterest', 'Creative Assets Not Used in Ads'), dev('Techpath', 'hash tables for set operations: intersection and difference')),
      roles: DE,
      summary: 'Compare source and target ID lists: what is missing, what is extra, how much matches.',
      description: md(
        'After a load, compare the IDs in the `source` system with those in the `target` warehouse (either list may contain duplicates). Return a dict:',
        '',
        '- `"missing"`: IDs in source but not in target, sorted;',
        '- `"extra"`: IDs in target but not in source, sorted;',
        '- `"matched"`: how many **distinct** IDs are in both.',
      ),
      hints: ['Convert to sets once; `-` gives difference, `&` gives intersection.'],
      entry: 'reconcile',
      signature: 'reconcile(source: list[str], target: list[str]) -> dict',
      solution: code`def reconcile(source: list[str], target: list[str]) -> dict:
    s, t = set(source), set(target)
    return {"missing": sorted(s - t), "extra": sorted(t - s), "matched": len(s & t)}
`,
      explanation: md('Set algebra is the idiomatic way to diff two ID lists: each operation is O(n) on average. Sorting the differences makes the report deterministic (sets have no order).'),
      tests: [
        ex('Example', ['a', 'b', 'c'], ['b', 'c', 'd']),
        ex('Perfect match', ['x', 'y'], ['y', 'x']),
        hid('Duplicates do not inflate matched', ['a', 'a', 'b'], ['a', 'a']),
        hid('Empty target', ['q', 'p'], []),
        hid('Both empty', [], []),
      ],
    }),

    python({
      id: 'invert-mapping',
      title: 'Invert a Team → Owner Mapping',
      difficulty: 'Easy',
      topics: ['Dicts & Sets', 'Comprehensions'],
      patterns: ['Group keys by value'],
      domains: ['Platform / Ops'],
      ...tag(dev('Cisco', 'dictionary key-value inversion')),
      roles: DE,
      summary: 'Invert a dict whose values repeat, grouping the original keys under each value.',
      description: md(
        '`owners` maps each pipeline to the team that owns it. Return the inverse: each team → the **sorted list** of its pipelines. Teams appear in order of first appearance in `owners`.',
        '',
        '```',
        '{"ingest": "core", "dq": "qa", "load": "core"}   →   {"core": ["ingest", "load"], "qa": ["dq"]}',
        '```',
      ),
      hints: ['A naive `{v: k for k, v in d.items()}` keeps only the last key per value. Use `setdefault(v, []).append(k)` instead, then sort each list.'],
      entry: 'invert',
      signature: 'invert(owners: dict[str, str]) -> dict[str, list[str]]',
      solution: code`def invert(owners: dict[str, str]) -> dict[str, list[str]]:
    teams = {}
    for pipeline, team in owners.items():
        teams.setdefault(team, []).append(pipeline)
    return {team: sorted(pipes) for team, pipes in teams.items()}
`,
      explanation: md('The one-line dict comprehension inversion is only correct when values are unique; with repeated values it silently drops data. Grouping into lists keeps everything.'),
      tests: [
        ex('Example', { ingest: 'core', dq: 'qa', load: 'core' }),
        ex('Unique values', { a: '1', b: '2' }),
        hid('Empty', {}),
        hid('Everything to one team', { z: 't', y: 't', x: 't' }),
      ],
    }),

    python({
      id: 'filter-jobs-by-status',
      title: 'Keep Only Jobs in Given States',
      difficulty: 'Easy',
      topics: ['Dicts & Sets', 'Comprehensions'],
      patterns: ['Dict comprehension filter'],
      domains: ['Platform / Ops'],
      ...tag(dev('Cisco', 'dictionary status filter')),
      roles: DE,
      summary: 'Filter a job → status dict down to the states you care about, case-insensitively.',
      description: md(
        'Return a dict with only the entries of `jobs` whose status is one of `wanted`. Compare statuses **case-insensitively**, keep the original spelling in the output, and keep the original order.',
        '',
        '```',
        '{"a": "FAILED", "b": "ok", "c": "Retry"}, wanted = ["failed", "retry"]   →   {"a": "FAILED", "c": "Retry"}',
        '```',
      ),
      hints: ['Lowercase `wanted` into a set once; a dict comprehension with an `if` does the rest.'],
      entry: 'filter_status',
      signature: 'filter_status(jobs: dict[str, str], wanted: list[str]) -> dict[str, str]',
      solution: code`def filter_status(jobs: dict[str, str], wanted: list[str]) -> dict[str, str]:
    keep = {w.lower() for w in wanted}
    return {job: status for job, status in jobs.items() if status.lower() in keep}
`,
      explanation: md('Building the lowercase set once makes each membership test O(1); lowercasing `wanted` inside the comprehension would redo that work for every job.'),
      tests: [
        ex('Example', { a: 'FAILED', b: 'ok', c: 'Retry' }, ['failed', 'retry']),
        ex('Nothing wanted', { a: 'ok' }, []),
        hid('Everything matches', { x: 'OK', y: 'ok' }, ['Ok']),
        hid('Empty jobs', {}, ['failed']),
      ],
    }),

    python({
      id: 'missing-number',
      title: 'The Missing Batch Number',
      difficulty: 'Easy',
      topics: ['Math & Bits', 'Lists & Tuples'],
      patterns: ['Arithmetic series / XOR'],
      domains: ['Event pipelines'],
      ...tag(dev('Meta', 'missing number — sum formula and XOR', 'Facebook'), gfg('Flipkart', 'array question similar to "missing number"', 'DE 1')),
      roles: DE,
      summary: 'Batches numbered 0..n arrived with exactly one missing — find it without sorting.',
      description: md(
        '`batches` contains every integer from `0` to `n` exactly once except one, in any order (`n = len(batches)`). Return the missing number in O(n) time and O(1) extra space.',
        '',
        '```',
        '[3, 0, 1]   →   2',
        '```',
      ),
      hints: ['The sum 0 + 1 + … + n is n(n+1)/2; subtract what you have.', 'XOR works too and can never overflow in languages with fixed-size ints.'],
      entry: 'missing_batch',
      signature: 'missing_batch(batches: list[int]) -> int',
      solution: code`def missing_batch(batches: list[int]) -> int:
    n = len(batches)
    return n * (n + 1) // 2 - sum(batches)
`,
      explanation: md('The expected total minus the actual total is the missing value. The XOR version (`x ^= i ^ v` over all positions) gives the same answer and is the follow-up interviewers like.'),
      tests: [
        ex('Example', [3, 0, 1]),
        ex('Missing zero', [1]),
        hid('Missing the last', [0, 1, 2]),
        hid('Empty — only 0 could be missing', []),
        hid('Longer', [9, 6, 4, 2, 3, 5, 7, 0, 1]),
      ],
    }),

    python({
      id: 'longest-consecutive-days',
      title: 'Longest Run of Consecutive Day Numbers',
      difficulty: 'Medium',
      topics: ['Dicts & Sets'],
      patterns: ['Start-of-run detection with a set'],
      domains: ['Product analytics'],
      roles: DE_DA,
      summary: 'Find the longest streak of consecutive integers in an unsorted list, in linear time.',
      description: md(
        '`days` holds the day numbers (integers) on which a user was active, unsorted and possibly repeated. Return the length of the longest streak of consecutive days. Aim for O(n) — no sorting.',
        '',
        '```',
        '[100, 4, 200, 1, 3, 2, 2]   →   4     (1, 2, 3, 4)',
        '```',
      ),
      hints: [
        'Put everything in a set. A day `d` starts a streak only if `d - 1` is not in the set.',
        'From each start, count upward while `d + 1` is in the set — every day is visited at most twice overall.',
      ],
      entry: 'longest_streak',
      signature: 'longest_streak(days: list[int]) -> int',
      solution: code`def longest_streak(days: list[int]) -> int:
    present = set(days)
    best = 0
    for d in present:
        if d - 1 not in present:
            length = 1
            while d + length in present:
                length += 1
            best = max(best, length)
    return best
`,
      explanation: md('Only counting from streak starts keeps the inner `while` from re-walking the same streak, so the total work is O(n). Sorting would be O(n log n) and is the answer interviewers expect you to improve on.'),
      tests: [
        ex('Example', [100, 4, 200, 1, 3, 2, 2]),
        ex('No streaks', [10, 30, 20]),
        hid('Empty', []),
        hid('Negative days', [-2, -1, 0, 5]),
        hid('All duplicates', [7, 7, 7]),
      ],
    }),

    python({
      id: 'max-product-of-three',
      title: 'Largest Product of Three Returns',
      difficulty: 'Medium',
      topics: ['Sorting', 'Math & Bits'],
      patterns: ['Track extremes'],
      domains: ['Finance'],
      ...tag(dlp('D.E. Shaw', 'Max Product of Three Numbers')),
      roles: ['Data Engineer', 'Data Scientist'],
      summary: 'Pick three numbers with the largest product — negatives included.',
      description: md(
        'Return the largest product of any three numbers in `nums` (length ≥ 3). Numbers can be negative.',
        '',
        '```',
        '[-10, -10, 1, 3, 2]   →   300',
        '```',
      ),
      hints: ['The answer is either the three largest numbers, or the two most negative times the largest.', '`heapq.nlargest(3, …)` and `heapq.nsmallest(2, …)` find them in O(n).'],
      entry: 'max_product3',
      signature: 'max_product3(nums: list[int]) -> int',
      solution: code`import heapq

def max_product3(nums: list[int]) -> int:
    a, b, c = heapq.nlargest(3, nums)
    x, y = heapq.nsmallest(2, nums)
    return max(a * b * c, x * y * a)
`,
      explanation: md('Two negatives make a positive, so the two smallest numbers can beat the 2nd and 3rd largest. Checking both candidates covers every case. Sorting works too (O(n log n)); `nlargest`/`nsmallest` with tiny k is O(n).'),
      tests: [
        ex('Example', [-10, -10, 1, 3, 2]),
        ex('All positive', [1, 2, 3, 4]),
        hid('All negative', [-5, -4, -3, -2]),
        hid('Exactly three', [-1, 0, 1]),
        hid('Zeros help', [-5, -4, 0, 0]),
      ],
    }),

    python({
      id: 'count-valid-card-sets',
      title: 'Count Valid Card Triples',
      difficulty: 'Medium',
      topics: ['Dicts & Sets', 'Lists & Tuples'],
      patterns: ['All-same-or-all-different check'],
      domains: ['Gaming'],
      ...tag(dev('Snowflake', 'SET card game validation')),
      roles: DE,
      summary: 'Count the triples of cards where every attribute is all-equal or all-different.',
      description: md(
        'Each card is a string of 4 characters, one per attribute (say colour, shape, count, fill). Three cards form a **valid set** when, for every attribute position, the three characters are either all the same or all different.',
        '',
        'Return how many unordered triples of distinct positions in `cards` form a valid set.',
        '',
        '```',
        '["RO1S", "GO2S", "PO3S", "RO1E"]   →   1',
        '```',
      ),
      hints: ['For one attribute, `len({a, b, c})` is 1 (all same) or 3 (all different) for a valid set — never 2.', '`itertools.combinations(cards, 3)` enumerates the triples.'],
      entry: 'count_sets',
      signature: 'count_sets(cards: list[str]) -> int',
      solution: code`from itertools import combinations

def count_sets(cards: list[str]) -> int:
    return sum(
        all(len({a[i], b[i], c[i]}) != 2 for i in range(4))
        for a, b, c in combinations(cards, 3)
    )
`,
      explanation: md('The "never exactly two" rule turns each attribute check into a set-size test. Summing booleans counts the `True`s. O(n³) is fine for a hand of cards; the O(n²) follow-up computes the third card for each pair and looks it up in a set.'),
      tests: [
        ex('Example', ['RO1S', 'GO2S', 'PO3S', 'RO1E']),
        ex('Too few cards', ['RO1S', 'GO2S']),
        hid('Identical cards form a set', ['AAAA', 'AAAA', 'AAAA']),
        hid('Two the same, one different is invalid', ['AAAA', 'AAAA', 'BAAA']),
        hid('Several sets', ['ABCD', 'BCDA', 'CDAB', 'AAAA', 'BBBB', 'CCCC']),
      ],
    }),

    python({
      id: 'stock-purchase-totals',
      title: 'Shares Bought per Ticker',
      difficulty: 'Easy',
      topics: ['Dicts & Sets', 'Data Wrangling'],
      patterns: ['Dict as GROUP BY'],
      domains: ['Trading'],
      ...tag(dev('Robinhood', 'stock-purchase aggregation')),
      roles: DE_DA,
      summary: 'Aggregate buy orders into total shares and notional value per ticker.',
      description: md(
        'Each trade is `[user, ticker, side, shares, price]` with `side` either `"buy"` or `"sell"`. Considering **buys only**, return a dict `ticker → [total_shares, notional]` where notional is the sum of `shares * price`, rounded to 2 decimals. Tickers are case-insensitive and reported in upper case; order the dict by ticker.',
      ),
      hints: ['Normalise the ticker with `.upper()` before using it as a key.', 'Accumulate both numbers in one `[0, 0.0]` list per ticker.'],
      entry: 'buy_totals',
      signature: 'buy_totals(trades: list[list]) -> dict[str, list]',
      solution: code`def buy_totals(trades: list[list]) -> dict[str, list]:
    totals = {}
    for _user, ticker, side, shares, price in trades:
        if side != "buy":
            continue
        t = totals.setdefault(ticker.upper(), [0, 0.0])
        t[0] += shares
        t[1] += shares * price
    return {k: [v[0], round(v[1], 2)] for k, v in sorted(totals.items())}
`,
      explanation: md('Tuple-unpacking each row into named variables makes the loop readable and fails loudly if a row has the wrong shape. Round once at the end — rounding every partial sum accumulates error.'),
      tests: [
        ex('Example', [['u1', 'aapl', 'buy', 10, 190.5], ['u2', 'AAPL', 'buy', 5, 191.0], ['u1', 'tsla', 'sell', 3, 250.0]]),
        ex('Only sells', [['u', 'X', 'sell', 1, 1.0]]),
        hid('Empty', []),
        hid('Several tickers sorted', [['a', 'msft', 'buy', 1, 400.123], ['b', 'goog', 'buy', 2, 150.0], ['c', 'MSFT', 'buy', 1, 399.877]]),
      ],
    }),

    python({
      id: 'country-rollup',
      title: 'Country Counts from Messy Input',
      difficulty: 'Easy',
      topics: ['Hash Maps & Counting', 'Sorting', 'Strings'],
      patterns: ['Normalise, count, rank'],
      domains: ['Finance'],
      ...tag(dev('Intuit', 'country-count rollups'), lds('Shopify', 'shopify', 'Clean Customer Names'), lds('Reddit', 'reddit', 'Standardize Moderation Report Reasons')),
      roles: DE_DA,
      summary: 'Count customers per country after cleaning case and whitespace, ranked by count.',
      description: md(
        'Country names in `countries` were typed by hand: random case, stray spaces, and some blanks. Normalise each name (strip, collapse inner whitespace to one space, title-case), skip blanks, and return `[country, count]` sorted by count **descending**, then name **ascending**.',
        '',
        '```',
        '["india ", "INDIA", "united  states", " ", "United States", "Brazil"]',
        '→ [["India", 2], ["United States", 2], ["Brazil", 1]]',
        '```',
      ),
      hints: ["`' '.join(name.split())` strips and collapses whitespace in one go; `.title()` fixes the case."],
      entry: 'country_counts',
      signature: 'country_counts(countries: list[str]) -> list[list]',
      solution: code`from collections import Counter

def country_counts(countries: list[str]) -> list[list]:
    clean = (" ".join(c.split()).title() for c in countries)
    counts = Counter(c for c in clean if c)
    return [[c, n] for c, n in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))]
`,
      explanation: md('Normalise **before** counting, otherwise `"india "` and `"INDIA"` are different keys. The `(-count, name)` key gives the two-direction ordering in one sort.'),
      tests: [
        ex('Example', ['india ', 'INDIA', 'united  states', ' ', 'United States', 'Brazil']),
        ex('One country', ['chile']),
        hid('All blank', ['', '  ', '\t']),
        hid('Ties sorted by name', ['b', 'a', 'c']),
      ],
    }),

    python({
      id: 'multi-key-hotel-sort',
      title: 'Sort Hotels by Several Keys',
      difficulty: 'Medium',
      topics: ['Sorting', 'Functions & Lambdas'],
      patterns: ['Composite sort key', 'Stable multi-pass sort'],
      domains: ['Travel'],
      ...tag(dev('Agoda', 'multi-key ordering')),
      roles: DE,
      summary: 'Order search results by city, then rating (high first), then price, then name.',
      description: md(
        'Each hotel is a dict with `name`, `city`, `rating` (float) and `price` (int). Return the hotel **names** ordered by:',
        '',
        '1. `city` ascending (case-insensitive),',
        '2. `rating` descending,',
        '3. `price` ascending,',
        '4. `name` ascending.',
      ),
      hints: ['Numbers can be negated to flip direction inside one tuple key: `(city.lower(), -rating, price, name)`.', 'For a descending **string** key you would instead sort several times, least-significant key first — Python\'s sort is stable.'],
      entry: 'rank_hotels',
      signature: 'rank_hotels(hotels: list[dict]) -> list[str]',
      solution: code`def rank_hotels(hotels: list[dict]) -> list[str]:
    ranked = sorted(hotels, key=lambda h: (h["city"].lower(), -h["rating"], h["price"], h["name"]))
    return [h["name"] for h in ranked]
`,
      explanation: md('A tuple key compares element by element, so one sort applies all four rules in priority order. Negation flips a numeric key; for strings that cannot be negated, use stable multi-pass sorting (`sort(key=name)`, then `sort(key=city, reverse=True)`, …).'),
      tests: [
        ex('Example', [
          { name: 'Sea View', city: 'Goa', rating: 4.5, price: 90 },
          { name: 'Palm', city: 'goa', rating: 4.8, price: 120 },
          { name: 'Central', city: 'Bangkok', rating: 4.1, price: 60 },
        ]),
        ex('Price breaks rating ties', [
          { name: 'B', city: 'X', rating: 4.0, price: 80 },
          { name: 'A', city: 'X', rating: 4.0, price: 70 },
        ]),
        hid('Name breaks the last tie', [
          { name: 'Zeta', city: 'Y', rating: 3.0, price: 50 },
          { name: 'Alpha', city: 'Y', rating: 3.0, price: 50 },
        ]),
        hid('Empty', []),
      ],
    }),

    python({
      id: 'merge-two-sorted-lists',
      title: 'Merge Two Sorted Exports',
      difficulty: 'Easy',
      topics: ['Lists & Tuples', 'Two Pointers & Sliding Window'],
      patterns: ['Two-pointer merge'],
      domains: ['Event pipelines'],
      ...tag(ddp('Goldman Sachs', 'The List Merger')),
      roles: DE,
      summary: 'Merge two ascending lists into one ascending list in linear time, without sort().',
      description: md(
        'Both `a` and `b` are sorted ascending. Return one ascending list with every element of both (duplicates kept) **without** calling `sorted`/`sort` — walk the lists with two pointers.',
      ),
      hints: ['Compare the heads, take the smaller, advance that pointer. When one list runs out, append the rest of the other.'],
      entry: 'merge_sorted',
      signature: 'merge_sorted(a: list[int], b: list[int]) -> list[int]',
      solution: code`def merge_sorted(a: list[int], b: list[int]) -> list[int]:
    i = j = 0
    out = []
    while i < len(a) and j < len(b):
        if a[i] <= b[j]:
            out.append(a[i]); i += 1
        else:
            out.append(b[j]); j += 1
    out.extend(a[i:])
    out.extend(b[j:])
    return out
`,
      explanation: md('This is the merge step of merge sort: O(len(a) + len(b)). Using `<=` takes from `a` first on ties, which keeps the merge stable. `heapq.merge` does the same lazily for any number of sorted inputs.'),
      tests: [
        ex('Example', [1, 4, 9], [2, 4, 10, 11]),
        ex('One empty', [], [3, 5]),
        hid('Both empty', [], []),
        hid('All of a first', [1, 2], [3, 4]),
        hid('Duplicates across lists', [1, 1], [1]),
      ],
    }),

    python({
      id: 'kth-first-seen-id',
      title: 'The K-th New Visitor',
      difficulty: 'Medium',
      topics: ['Dicts & Sets', 'Streaming & State'],
      patterns: ['First-seen order with a set'],
      domains: ['Web analytics'],
      ...tag(dev('ByteDance', 'k-th first-seen id in a stream')),
      roles: DE,
      summary: 'Scan a visit stream and return the k-th distinct visitor, stopping as soon as you know.',
      description: md(
        'Return the visitor ID that was the **k-th distinct visitor** to appear in `visits` (k starts at 1). Return `""` if fewer than k distinct visitors appear. Stop reading as soon as you have the answer.',
        '',
        '```',
        '["u3", "u1", "u3", "u7", "u1", "u9"], k = 3   →   "u7"',
        '```',
      ),
      hints: ['Keep a set of seen IDs and a counter of distinct ones; return the moment the counter reaches k.'],
      entry: 'kth_new_visitor',
      signature: 'kth_new_visitor(visits: list[str], k: int) -> str',
      solution: code`def kth_new_visitor(visits: list[str], k: int) -> str:
    seen = set()
    for v in visits:
        if v not in seen:
            seen.add(v)
            if len(seen) == k:
                return v
    return ""
`,
      explanation: md('One pass with early exit — exactly how you would treat an unbounded stream. `list(dict.fromkeys(visits))[k-1]` is a one-liner but reads the whole input first.'),
      tests: [
        ex('Example', ['u3', 'u1', 'u3', 'u7', 'u1', 'u9'], 3),
        ex('First visitor', ['a', 'a', 'b'], 1),
        hid('Not enough distinct visitors', ['a', 'a'], 2),
        hid('Empty stream', [], 1),
      ],
    }),

    python({
      id: 'dedupe-keep-first-spelling',
      title: 'Deduplicate Tags, Keeping the First Spelling',
      difficulty: 'Easy',
      topics: ['Dicts & Sets', 'Strings'],
      patterns: ['Dedup by normalised key'],
      domains: ['Content / Media'],
      roles: DE,
      summary: 'Remove case-insensitive duplicate tags while keeping order and the first-seen spelling.',
      description: md(
        'Remove duplicates from `tags`, treating tags as equal when they match **ignoring case and surrounding spaces**. Keep the first occurrence\'s spelling (stripped) and the original order.',
        '',
        '```',
        '["SQL", " sql", "Python", "python ", "Spark"]   →   ["SQL", "Python", "Spark"]',
        '```',
      ),
      hints: ['Track normalised keys in a set; output the stripped original when its key is new.'],
      entry: 'dedupe_tags',
      signature: 'dedupe_tags(tags: list[str]) -> list[str]',
      solution: code`def dedupe_tags(tags: list[str]) -> list[str]:
    seen = set()
    out = []
    for tag in tags:
        key = tag.strip().lower()
        if key not in seen:
            seen.add(key)
            out.append(tag.strip())
    return out
`,
      explanation: md('`list(set(tags))` loses order and doesn\'t understand case; `dict.fromkeys` keeps order but compares exact strings. Separating the comparison key from the stored value handles both.'),
      tests: [
        ex('Example', ['SQL', ' sql', 'Python', 'python ', 'Spark']),
        ex('No duplicates', ['a', 'b']),
        hid('Empty', []),
        hid('Casefold keeps first spelling', ['dbt', 'DBT', 'Dbt']),
      ],
    }),

    python({
      id: 'top-earner-per-department',
      title: 'Top Earner per Department from Tuples',
      difficulty: 'Easy',
      topics: ['Lists & Tuples', 'Dicts & Sets'],
      patterns: ['Top-1 per group'],
      domains: ['HR / People'],
      ...tag(dev('Techpath', 'tuples and indexing for structured records')),
      roles: DE_DA,
      summary: 'From (name, department, salary) tuples, find the best-paid person in each department.',
      description: md(
        'Each record in `staff` is a tuple-like list `(name, department, salary)`. Return a dict `department → name` of the highest-paid employee in each department; on a salary tie pick the alphabetically first name. Order the dict by department.',
      ),
      hints: ['Unpack each record into three names; keep the current best `(salary, name)` per department.', 'A string can\'t be negated inside a sort key, so spell the tie-break out: higher salary, or same salary and smaller name.'],
      entry: 'top_earners',
      signature: 'top_earners(staff: list[list]) -> dict[str, str]',
      solution: code`def top_earners(staff: list[list]) -> dict[str, str]:
    best = {}
    for name, dept, salary in staff:
        cur = best.get(dept)
        if cur is None or salary > cur[0] or (salary == cur[0] and name < cur[1]):
            best[dept] = (salary, name)
    return {dept: best[dept][1] for dept in sorted(best)}
`,
      explanation: md('Tuples are a natural record type: fixed shape, unpackable, immutable. Tracking one best record per group is O(n) — no need to sort everything.'),
      tests: [
        ex('Example', [['Ana', 'Data', 120], ['Raj', 'Data', 140], ['Li', 'Ops', 90]]),
        ex('Tie goes to the first name alphabetically', [['Zoe', 'BI', 100], ['Amy', 'BI', 100]]),
        hid('Empty', []),
        hid('Many departments', [['a', 'z', 1], ['b', 'y', 2], ['c', 'x', 3], ['d', 'x', 4]]),
      ],
    }),

    python({
      id: 'catering-sales-report',
      title: 'Catering Sales Report',
      difficulty: 'Easy',
      topics: ['Dicts & Sets', 'Sorting', 'Data Wrangling'],
      patterns: ['Dict as GROUP BY', 'Composite sort key'],
      domains: ['Food delivery'],
      ...tag(dev('PayPal', 'catering sales report')),
      roles: DE_DA,
      summary: 'Roll up order lines into quantity and revenue per menu item, best sellers first.',
      description: md(
        'Each order line is `[item, quantity, unit_price]`. Return `[item, total_quantity, revenue]` per item, where revenue is rounded to 2 decimals, sorted by revenue **descending** then item **ascending**.',
      ),
      hints: ['Accumulate quantity and revenue per item in one dict pass, round once at the end, then sort with a `(-revenue, item)` key.'],
      entry: 'sales_report',
      signature: 'sales_report(lines: list[list]) -> list[list]',
      solution: code`def sales_report(lines: list[list]) -> list[list]:
    totals = {}
    for item, qty, price in lines:
        t = totals.setdefault(item, [0, 0.0])
        t[0] += qty
        t[1] += qty * price
    rows = [[item, q, round(rev, 2)] for item, (q, rev) in totals.items()]
    return sorted(rows, key=lambda r: (-r[2], r[0]))
`,
      explanation: md('One pass to aggregate, one sort to rank — the same shape as `GROUP BY item ORDER BY revenue DESC, item`.'),
      tests: [
        ex('Example', [['samosa', 10, 1.5], ['thali', 2, 12.0], ['samosa', 6, 1.5], ['lassi', 4, 2.25]]),
        ex('Single line', [['tea', 1, 0.99]]),
        hid('Empty', []),
        hid('Revenue ties sorted by item', [['b', 1, 5.0], ['a', 5, 1.0]]),
      ],
    }),
  ],
};
