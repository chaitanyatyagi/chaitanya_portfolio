// Python pack 6 — recursion: base cases, direct and mutual recursion,
// memoisation, recursion over nested data (JSON, trees), backtracking, and the
// classic interview recursions (factorial, primes, Fibonacci, Pascal, Collatz).
import { python, md, code, ex, hid } from './define.js';
import { dlp, ddp, gfg, tag } from './sources.js';

const DE = ['Data Engineer'];
const DE_DS = ['Data Engineer', 'Data Scientist'];

export default {
  problems: [
    python({
      id: 'recursive-factorial',
      title: 'Factorial, Recursively',
      difficulty: 'Easy',
      topics: ['Recursion', 'Math & Bits'],
      patterns: ['Base case + smaller subproblem'],
      domains: ['Math'],
      ...tag(gfg('LTIMindtree', 'write a program to find the factorial of a number'), dlp('Microsoft', 'Factorial Formula')),
      roles: DE,
      summary: 'Compute n! with a recursive function and handle bad input explicitly.',
      description: md('Return `n!` computed **recursively**. For a negative `n`, return `-1` (factorial is undefined).'),
      hints: ['Base case: `0! = 1`. Recursive case: `n! = n * (n-1)!`.'],
      entry: 'factorial',
      signature: 'factorial(n: int) -> int',
      solution: code`def factorial(n: int) -> int:
    if n < 0:
        return -1
    if n <= 1:
        return 1
    return n * factorial(n - 1)
`,
      explanation: md('Every recursive function needs a base case that stops the recursion and a step that moves toward it. Python has no tail-call optimisation and a default recursion limit around 1000, so for very large `n` an iterative loop (or `math.factorial`) is the production answer.'),
      tests: [
        ex('Example', 5),
        ex('Zero', 0),
        hid('Negative', -3),
        hid('Larger', 17),
        hid('One', 1),
      ],
    }),

    python({
      id: 'recursive-prime-check',
      title: 'Is It Prime? (Recursive Trial Division)',
      difficulty: 'Easy',
      topics: ['Recursion', 'Math & Bits'],
      patterns: ['Recursion with an accumulator argument'],
      domains: ['Math'],
      ...tag(gfg('LTIMindtree', 'check whether a number is prime and optimise it')),
      roles: DE,
      summary: 'Test primality recursively, only trying divisors up to the square root.',
      description: md('Return `True` if `n` is prime. Write the divisor search as a recursive helper `check(n, d)` that tries `d, d + 2, …` and stops once `d * d > n`.'),
      hints: ['Handle `n < 2`, `2`, and even numbers first; then recurse over odd divisors from 3.'],
      entry: 'is_prime',
      signature: 'is_prime(n: int) -> bool',
      solution: code`def is_prime(n: int) -> bool:
    if n < 2:
        return False
    if n % 2 == 0:
        return n == 2

    def check(d):
        if d * d > n:
            return True
        if n % d == 0:
            return False
        return check(d + 2)

    return check(3)
`,
      explanation: md('Any factor larger than √n pairs with one smaller than √n, so stopping at `d * d > n` is enough. Skipping even divisors halves the work. Recursion depth is about √n / 2 — fine for these inputs, but a loop is safer for huge `n`.'),
      tests: [
        ex('Example', 29),
        ex('Composite', 21),
        hid('Two', 2),
        hid('One is not prime', 1),
        hid('Square of a prime', 49),
        hid('Larger prime', 7919),
      ],
    }),

    python({
      id: 'memoised-fibonacci',
      title: 'Fibonacci with Memoisation',
      difficulty: 'Easy',
      topics: ['Recursion', 'Closures & Decorators', 'Dynamic Programming'],
      patterns: ['Memoisation'],
      domains: ['Math'],
      roles: DE,
      summary: 'Make the naive recursive Fibonacci fast with a cache, and count the calls it saves.',
      description: md('Return `[fib(n), calls]`: the n-th Fibonacci number (`fib(0) = 0`, `fib(1) = 1`) computed recursively **with memoisation**, and how many times the recursive function body actually ran.'),
      hints: ['`functools.lru_cache(maxsize=None)` (or `@functools.cache`) memoises a function.', 'Count calls with a list or `nonlocal` counter incremented inside the cached function — cache hits never reach the body.'],
      entry: 'fib_with_calls',
      signature: 'fib_with_calls(n: int) -> list[int]',
      solution: code`from functools import lru_cache

def fib_with_calls(n: int) -> list[int]:
    calls = 0

    @lru_cache(maxsize=None)
    def fib(k):
        nonlocal calls
        calls += 1
        return k if k < 2 else fib(k - 1) + fib(k - 2)

    return [fib(n), calls]
`,
      explanation: md('Without a cache, `fib(n)` makes about φⁿ calls; with one, each `k` from 0 to n is computed once, so the body runs `n + 1` times. Defining the cached function inside the outer one gives every call a fresh cache and counter.'),
      tests: [
        ex('Example', 10),
        ex('Zero', 0),
        hid('One', 1),
        hid('Large n stays fast', 70),
      ],
    }),

    python({
      id: 'mutual-recursion-even-odd',
      title: 'Mutual Recursion: is_even and is_odd',
      difficulty: 'Easy',
      topics: ['Recursion'],
      patterns: ['Mutual (indirect) recursion'],
      domains: ['Math'],
      roles: DE,
      summary: 'Two functions that call each other — indirect recursion in its simplest form.',
      description: md('Without using `%`, `//` or bit operations, define `is_even(n)` and `is_odd(n)` for non-negative `n` so that each calls the other (`is_even(0)` is True, `is_odd(0)` is False). Return `[is_even(n), is_odd(n)]` for every `n` in `nums`.'),
      hints: ['`is_even(n) = is_odd(n - 1)` and `is_odd(n) = is_even(n - 1)`, with base cases at 0.'],
      entry: 'parities',
      signature: 'parities(nums: list[int]) -> list[list[bool]]',
      solution: code`def is_even(n):
    return True if n == 0 else is_odd(n - 1)

def is_odd(n):
    return False if n == 0 else is_even(n - 1)

def parities(nums: list[int]) -> list[list[bool]]:
    return [[is_even(n), is_odd(n)] for n in nums]
`,
      explanation: md('In **direct** recursion a function calls itself; in **indirect** (mutual) recursion functions call each other in a cycle. It works because Python resolves `is_odd` when `is_even` runs, not when it is defined.'),
      tests: [
        ex('Example', [0, 1, 4, 7]),
        ex('Single', [10]),
        hid('Empty', []),
        hid('Larger numbers', [99, 100]),
      ],
    }),

    python({
      id: 'flatten-nested-feed',
      title: 'Flatten an Arbitrarily Nested Feed',
      difficulty: 'Easy',
      topics: ['Recursion', 'Lists & Tuples'],
      patterns: ['Recursion over nested structures'],
      domains: ['Content / Media'],
      ...tag(ddp('Meta', 'Single File')),
      roles: DE,
      summary: 'Flatten lists nested to any depth into one list, keeping order.',
      description: md('`feed` is a list whose items are either plain values or lists (nested to any depth). Return every plain value in one flat list, left to right. Strings are plain values — don\'t split them into characters.'),
      hints: ['If an item is a list, recurse into it and extend; otherwise append it.'],
      entry: 'flatten',
      signature: 'flatten(feed: list) -> list',
      solution: code`def flatten(feed: list) -> list:
    out = []
    for item in feed:
        if isinstance(item, list):
            out.extend(flatten(item))
        else:
            out.append(item)
    return out
`,
      explanation: md('The recursion mirrors the data: a list contains values or more lists. Checking `isinstance(item, list)` (rather than "is it iterable?") is what keeps strings intact — a string is iterable, and its characters are strings too, which would recurse forever with a naive check.'),
      tests: [
        ex('Example', [1, [2, [3, [4]], 5], 'six']),
        ex('Already flat', ['a', 'b']),
        hid('Empty lists vanish', [[], [[]], 1]),
        hid('Deep nesting', [[[[[[7]]]]]]),
        hid('Empty', []),
      ],
    }),

    python({
      id: 'json-max-depth',
      title: 'How Deep Is This JSON?',
      difficulty: 'Easy',
      topics: ['Recursion', 'Parsing (CSV / JSON)'],
      patterns: ['Recursion over nested structures'],
      domains: ['APIs / Integration'],
      roles: DE,
      summary: 'Compute the nesting depth of a JSON document to decide how to flatten it.',
      description: md('Return the depth of `doc`: a scalar (number, string, bool, null) has depth 0; a dict or list has depth 1 + the maximum depth of its values (an empty dict or list has depth 1).'),
      hints: ['`max((depth(v) for v in values), default=0)` handles empty containers.'],
      entry: 'depth',
      signature: 'depth(doc) -> int',
      solution: code`def depth(doc) -> int:
    if isinstance(doc, dict):
        return 1 + max((depth(v) for v in doc.values()), default=0)
    if isinstance(doc, list):
        return 1 + max((depth(v) for v in doc), default=0)
    return 0
`,
      explanation: md('Two recursive cases (dict values, list items) and one base case (everything else). This is the shape of almost every JSON-walking function: schema inference, flattening, redaction.'),
      tests: [
        ex('Example', { order: { lines: [{ sku: 'A' }] }, id: 1 }),
        ex('Scalar', 42),
        hid('Empty containers', { a: {}, b: [] }),
        hid('List of lists', [[[]]]),
      ],
    }),

    python({
      id: 'sum-nested-amounts',
      title: 'Sum Every "amount" in a Nested Document',
      difficulty: 'Easy',
      topics: ['Recursion', 'Dicts & Sets'],
      patterns: ['Recursion over nested structures'],
      domains: ['Payments'],
      roles: DE,
      summary: 'Walk a nested invoice and add up every numeric value stored under a given key.',
      description: md('Return the sum of every value stored under the key `key` anywhere in `doc` (dicts and lists nested to any depth), counting only ints and floats (not bools). Round to 2 decimals.'),
      hints: ['When you meet a dict, check its `key` and also recurse into **all** its values — the key may appear at several levels.'],
      entry: 'sum_key',
      signature: 'sum_key(doc, key: str) -> float',
      solution: code`def sum_key(doc, key: str) -> float:
    def walk(node):
        total = 0
        if isinstance(node, dict):
            for k, v in node.items():
                if k == key and isinstance(v, (int, float)) and not isinstance(v, bool):
                    total += v
                total += walk(v)
        elif isinstance(node, list):
            for v in node:
                total += walk(v)
        return total
    return round(walk(doc), 2)
`,
      explanation: md('Recursing into every value — even the matching one — handles keys at multiple levels. The bool exclusion again: `True` is an `int`.'),
      tests: [
        ex('Example', { amount: 10, items: [{ amount: 2.5 }, { sub: { amount: 1.25 } }] }, 'amount'),
        ex('Key absent', { a: 1 }, 'amount'),
        hid('Booleans and strings skipped', { amount: true, x: [{ amount: '5' }, { amount: 5 }] }, 'amount'),
        hid('Top-level list', [{ fee: 1 }, { fee: 2 }], 'fee'),
      ],
    }),

    python({
      id: 'all-subsets',
      title: 'Every Combination of Feature Flags',
      difficulty: 'Medium',
      topics: ['Recursion'],
      patterns: ['Backtracking / include-exclude'],
      domains: ['Experimentation'],
      roles: DE_DS,
      summary: 'Generate the power set of a list of flags, in a defined order.',
      description: md('Return every subset of `flags` (all distinct). Each subset keeps the input order; list the subsets ordered by size, then lexicographically by their positions in the input. The empty subset comes first.'),
      hints: ['Recursively: the subsets of `flags[1:]`, plus each of those with `flags[0]` added in front.', 'Then sort with `key=lambda s: (len(s), [flags.index(x) for x in s])`.'],
      entry: 'subsets',
      signature: 'subsets(flags: list[str]) -> list[list[str]]',
      solution: code`def subsets(flags: list[str]) -> list[list[str]]:
    def build(i):
        if i == len(flags):
            return [[]]
        rest = build(i + 1)
        return rest + [[flags[i]] + s for s in rest]
    pos = {f: i for i, f in enumerate(flags)}
    return sorted(build(0), key=lambda s: (len(s), [pos[x] for x in s]))
`,
      explanation: md('Each element is either in or out, so there are 2ⁿ subsets — recursion splits on that choice. `itertools.combinations(flags, k)` for k = 0..n produces the same list in the same order without recursion.'),
      tests: [
        ex('Example', ['a', 'b', 'c']),
        ex('Empty', []),
        hid('One flag', ['x']),
        hid('Order follows input', ['z', 'a']),
      ],
    }),

    python({
      id: 'string-permutations',
      title: 'Distinct Permutations of a Code',
      difficulty: 'Medium',
      topics: ['Recursion', 'Strings'],
      patterns: ['Backtracking with a used-count'],
      domains: ['Security'],
      roles: DE,
      summary: 'List the distinct rearrangements of a string that may contain repeated characters.',
      description: md('Return every **distinct** permutation of `code`, sorted. `"aab"` has 3, not 6.'),
      hints: ['Recurse over the distinct remaining characters (a `Counter`), so duplicates never branch twice.'],
      entry: 'permutations',
      signature: 'permutations(code: str) -> list[str]',
      solution: code`from collections import Counter

def permutations(code: str) -> list[str]:
    counts = Counter(code)
    out = []

    def build(prefix):
        if len(prefix) == len(code):
            out.append(prefix)
            return
        for ch in sorted(counts):
            if counts[ch]:
                counts[ch] -= 1
                build(prefix + ch)
                counts[ch] += 1

    build("")
    return out
`,
      explanation: md('Branching on distinct characters (with remaining counts) avoids generating duplicates and then deduplicating with a set. Iterating characters in sorted order produces the output already sorted. Note the empty string has exactly one permutation: `""`.'),
      tests: [
        ex('Example', 'aab'),
        ex('All distinct', 'abc'),
        hid('Empty', ''),
        hid('All the same', 'zzz'),
      ],
    }),

    python({
      id: 'collatz-steps',
      title: 'Collatz Steps',
      difficulty: 'Easy',
      topics: ['Recursion', 'Math & Bits'],
      patterns: ['Recursion with memoisation'],
      domains: ['Math'],
      ...tag(dlp('Bloomberg', 'Collatz Sequence Steps')),
      roles: DE,
      summary: 'Count Collatz steps to reach 1 for many numbers, reusing work with a cache.',
      description: md('For `n >= 1`: if n is even the next value is n/2, otherwise 3n+1. Return the number of steps to reach 1 for each number in `nums` (`steps(1) = 0`). Share one cache across all numbers.'),
      hints: ['`steps(n) = 1 + steps(next(n))`, memoised — many sequences merge.'],
      entry: 'collatz_steps',
      signature: 'collatz_steps(nums: list[int]) -> list[int]',
      solution: code`from functools import lru_cache

@lru_cache(maxsize=None)
def steps(n):
    if n == 1:
        return 0
    return 1 + steps(n // 2 if n % 2 == 0 else 3 * n + 1)

def collatz_steps(nums: list[int]) -> list[int]:
    return [steps(n) for n in nums]
`,
      explanation: md('Collatz sequences merge quickly, so caching `steps` at module level means later numbers reuse earlier work. The recursion depth equals the step count (a few hundred at most for these inputs).'),
      tests: [
        ex('Example', [6, 7, 1]),
        ex('Power of two', [16]),
        hid('Famous long one', [27]),
        hid('Empty', []),
      ],
    }),

    python({
      id: 'pascals-triangle-row',
      title: 'A Row of Pascal\'s Triangle',
      difficulty: 'Easy',
      topics: ['Recursion', 'Lists & Tuples'],
      patterns: ['Build from the previous row'],
      domains: ['Math'],
      ...tag(dlp('Uber', 'Pascals Triangle')),
      roles: DE_DS,
      summary: 'Return the first n rows of Pascal\'s triangle, each built from the one above.',
      description: md('Return the first `n` rows of Pascal\'s triangle (`n = 0` gives `[]`). Row 0 is `[1]`; every inner number is the sum of the two numbers above it.'),
      hints: ['Recursively build rows `0..n-2`, then compute the last row from the previous one with `zip(prev, prev[1:])`.'],
      entry: 'pascal',
      signature: 'pascal(n: int) -> list[list[int]]',
      solution: code`def pascal(n: int) -> list[list[int]]:
    if n == 0:
        return []
    if n == 1:
        return [[1]]
    rows = pascal(n - 1)
    prev = rows[-1]
    rows.append([1] + [a + b for a, b in zip(prev, prev[1:])] + [1])
    return rows
`,
      explanation: md('Each row depends only on the previous one, a natural recursion (or loop). `zip(prev, prev[1:])` pairs neighbours without index arithmetic.'),
      tests: [
        ex('Example', 5),
        ex('Zero rows', 0),
        hid('One row', 1),
        hid('Ten rows', 10),
      ],
    }),

    python({
      id: 'triangular-sum',
      title: 'Reduce a Row to One Digit',
      difficulty: 'Medium',
      topics: ['Recursion', 'Lists & Tuples'],
      patterns: ['Shrink the problem by one each step'],
      domains: ['Math'],
      ...tag(dlp('TikTok', 'Triangular Sum')),
      roles: DE,
      summary: 'Repeatedly replace a list of digits with the pairwise sums mod 10 until one remains.',
      description: md('Given a non-empty list of digits, replace it with `[(a[i] + a[i+1]) % 10 for each neighbour pair]` until one digit remains, and return it.'),
      hints: ['Base case: one element. Otherwise recurse on the list of neighbour sums.'],
      entry: 'triangular_sum',
      signature: 'triangular_sum(digits: list[int]) -> int',
      solution: code`def triangular_sum(digits: list[int]) -> int:
    if len(digits) == 1:
        return digits[0]
    return triangular_sum([(a + b) % 10 for a, b in zip(digits, digits[1:])])
`,
      explanation: md('Each step shortens the list by one, so the recursion depth is the list length and total work is O(n²). The closed form uses binomial coefficients mod 10 (the answer is Σ C(n-1, i)·dᵢ mod 10).'),
      tests: [
        ex('Example', [1, 2, 3, 4, 5]),
        ex('Single digit', [7]),
        hid('Two digits', [9, 9]),
        hid('Longer', [5, 0, 5, 0, 5, 0, 5]),
      ],
    }),

    python({
      id: 'trailing-zeros-factorial',
      title: 'Trailing Zeros of n!',
      difficulty: 'Medium',
      topics: ['Math & Bits', 'Recursion'],
      patterns: ['Count factors, don\'t compute'],
      domains: ['Math'],
      ...tag(dlp('Microsoft', 'Factorial Trailing Zeroes')),
      roles: DE,
      summary: 'Count the zeros at the end of n! without computing n!.',
      description: md('Return how many trailing zeros `n!` has, for `0 <= n <= 10**9`. Computing the factorial is far too slow.'),
      hints: ['Each trailing zero is a factor 10 = 2 × 5, and there are always more 2s than 5s.', 'Count multiples of 5, 25, 125, …: `zeros(n) = n // 5 + zeros(n // 5)`.'],
      entry: 'trailing_zeros',
      signature: 'trailing_zeros(n: int) -> int',
      solution: code`def trailing_zeros(n: int) -> int:
    return 0 if n < 5 else n // 5 + trailing_zeros(n // 5)
`,
      explanation: md('`n // 5` counts numbers contributing at least one 5, `n // 25` those contributing a second one, and so on; the recursion `n // 5 + zeros(n // 5)` sums exactly that series in O(log n).'),
      tests: [
        ex('Example', 25),
        ex('Small', 4),
        hid('Zero', 0),
        hid('Huge', 1000000000),
        hid('Hundred', 100),
      ],
    }),

    python({
      id: 'tower-of-hanoi-moves',
      title: 'Plan a Tower of Hanoi Migration',
      difficulty: 'Medium',
      topics: ['Recursion'],
      patterns: ['Divide and conquer'],
      domains: ['Data lake / Storage'],
      roles: DE,
      summary: 'List the moves to migrate a stack of disks between three servers under Hanoi rules.',
      description: md('Return the list of moves `[from, to]` that move `n` disks from peg `"A"` to peg `"C"` using `"B"`, never putting a larger disk on a smaller one. Use the standard minimal recursive solution (2ⁿ − 1 moves).'),
      hints: ['Move n−1 disks out of the way (A→B), move the biggest (A→C), move the n−1 back on top (B→C).'],
      entry: 'hanoi',
      signature: 'hanoi(n: int) -> list[list[str]]',
      solution: code`def hanoi(n: int) -> list[list[str]]:
    moves = []
    def move(k, src, dst, via):
        if k == 0:
            return
        move(k - 1, src, via, dst)
        moves.append([src, dst])
        move(k - 1, via, dst, src)
    move(n, "A", "C", "B")
    return moves
`,
      explanation: md('The recursion is the proof: to move k disks you must at some point move the largest, and that requires the other k−1 to be on the spare peg. That gives T(k) = 2T(k−1) + 1 = 2ᵏ − 1 moves.'),
      tests: [
        ex('Two disks', 2),
        ex('Zero disks', 0),
        hid('Three disks', 3),
        hid('Move count for five', 5),
      ],
    }),

    python({
      id: 'top-manager-resolution',
      title: 'Where the Buck Stops',
      difficulty: 'Hard',
      topics: ['Recursion', 'Graphs (BFS / DFS)', 'Dicts & Sets'],
      patterns: ['Path compression', 'Cycle detection'],
      domains: ['HR / People'],
      ...tag(ddp('Airbnb', 'Where the Buck Stops')),
      roles: DE,
      summary: 'Find each employee\'s top-level manager from reporting lines, detecting cycles.',
      description: md(
        '`lines` is a list of `[manager, employee]` pairs from a directory export. Each employee has at most one manager. For every person who appears (as manager or employee), find their **top-level manager**: follow the chain upward until someone has no manager. A person with no manager is their own top.',
        '',
        'Exports can be corrupt: if following the chain revisits someone, everyone whose chain enters that loop gets `"CYCLE"`. Return a dict sorted by name.',
      ),
      hints: [
        'Build `boss = {employee: manager}`. Resolve each person recursively, memoising results.',
        'Track the people "on the current path"; meeting one of them again means a cycle.',
      ],
      entry: 'top_managers',
      signature: 'top_managers(lines: list[list[str]]) -> dict[str, str]',
      solution: code`def top_managers(lines: list[list[str]]) -> dict[str, str]:
    boss = {emp: mgr for mgr, emp in lines}
    people = {p for pair in lines for p in pair}
    top = {}

    def resolve(p, path):
        if p in top:
            return top[p]
        if p in path:
            return "CYCLE"
        if p not in boss:
            top[p] = p
            return p
        path.add(p)
        top[p] = resolve(boss[p], path)
        path.discard(p)
        return top[p]

    for p in people:
        resolve(p, set())
    return {p: top[p] for p in sorted(people)}
`,
      explanation: md(
        'Memoising (`top`) means each person is resolved once, so the whole directory costs O(n) — a form of path compression. The `path` set is the recursion stack: revisiting a node on it means the chain loops, and that result propagates to everyone feeding into the loop.',
        '',
        'For directories deeper than Python\'s recursion limit, convert to an explicit loop.',
      ),
      tests: [
        ex('Example', [['ceo', 'vp'], ['vp', 'mgr'], ['mgr', 'ic'], ['cto', 'dev']]),
        ex('Single pair', [['a', 'b']]),
        hid('Cycle', [['a', 'b'], ['b', 'c'], ['c', 'a'], ['c', 'd']]),
        hid('Empty', []),
        hid('Self-manager is a cycle', [['x', 'x'], ['x', 'y']]),
      ],
    }),
  ],
};
