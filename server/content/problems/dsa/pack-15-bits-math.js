// DSA pack 15 — bit manipulation & number theory: XOR singles (one, two,
// thrice), bit counting 0..n, power-of-two / bit tricks, division without
// "/", subsets by bitmask, XOR of 1..n and of a range, bit flips between
// numbers, Gray code, reversing bits, total Hamming distance; GCD / LCM,
// sieve, smallest-prime-factor factorisation, divisors, nCr mod p.
import { dsa, md, code, ex, hid } from './define.js';

const BIT = ['Bit Manipulation'];
const MATH = ['Math & Number Theory'];

export default {
  problems: [
    dsa({
      id: 'dsa-xor-singles',
      title: 'The Unpaired Values (XOR Tricks)',
      difficulty: 'Medium',
      topics: BIT,
      patterns: ['XOR cancels pairs; lowest set bit splits groups'],
      summary: 'One value appears once among pairs; two values appear once among pairs.',
      description: md('Return `[single, pair_of_singles]`: in `a` every value appears twice except one; in `b` every value appears twice except two (return those two ascending). O(n), O(1) extra.'),
      hints: ['xor of all of b = x ^ y; its lowest set bit separates x from y.'],
      signature: 'xor_singles(a: list[int], b: list[int]) -> list',
      solution: code`def xor_singles(a: list[int], b: list[int]) -> list:
    single = 0
    for v in a:
        single ^= v
    both = 0
    for v in b:
        both ^= v
    low = both & -both
    x = 0
    for v in b:
        if v & low:
            x ^= v
    return [single, sorted([x, both ^ x])]
`,
      explanation: md('x ^ x = 0 and XOR is associative, so pairs vanish. For two singles, any bit where they differ partitions the list into two one-single problems.'),
      tests: [
        ex('Example', [4, 1, 2, 1, 2], [1, 2, 1, 3, 2, 5]),
        ex('Negatives', [-1], [-1, 0]),
        hid('Larger', [7, 3, 5, 4, 5, 3, 4], [4, 1, 4, 1, 9, 6]),
        hid('Zero single', [0, 8, 8], [2, 3]),
      ],
    }),

    dsa({
      id: 'dsa-single-among-triples',
      title: 'The One Value Not Repeated Three Times',
      difficulty: 'Medium',
      topics: BIT,
      patterns: ['Count bits modulo 3'],
      summary: 'Every value appears three times except one — find it in O(1) space.',
      description: md('Return the value that appears exactly once; every other value appears exactly three times. Values may be negative (32-bit).'),
      hints: ['For each of 32 bits, sum it across all numbers mod 3; or use the ones/twos state machine.'],
      signature: 'single_of_three(nums: list[int]) -> int',
      solution: code`def single_of_three(nums: list[int]) -> int:
    ones = twos = 0
    for x in nums:
        ones = (ones ^ x) & ~twos
        twos = (twos ^ x) & ~ones
    return ones
`,
      explanation: md('`ones` and `twos` hold the bits seen 1 and 2 times (mod 3); a third occurrence clears both. O(n), O(1). Python’s unbounded ints handle negatives naturally here.'),
      tests: [
        ex('Example', [2, 2, 3, 2]),
        ex('Another', [0, 1, 0, 1, 0, 1, 99]),
        hid('Negative', [-2, -2, 1, 1, 4, 1, 4, 4, -4, -2]),
        hid('Single', [7]),
      ],
    }),

    dsa({
      id: 'dsa-bit-counts-range',
      title: 'Set Bits for Every Number from 0 to n',
      difficulty: 'Easy',
      topics: [...BIT, 'Dynamic Programming'],
      patterns: ['bits[i] = bits[i >> 1] + (i & 1)'],
      summary: 'Popcount of 0..n in O(n), plus the total.',
      description: md('Return `[counts, total]` where `counts[i]` is the number of 1 bits in i for 0 ≤ i ≤ n.'),
      hints: ['Dropping the last bit gives a smaller number you’ve already counted.'],
      signature: 'count_bits(n: int) -> list',
      solution: code`def count_bits(n: int) -> list:
    bits = [0] * (n + 1)
    for i in range(1, n + 1):
        bits[i] = bits[i >> 1] + (i & 1)
    return [bits, sum(bits)]
`,
      explanation: md('A one-line DP; alternatively bits[i] = bits[i & (i − 1)] + 1 (Kernighan’s trick). O(n).'),
      tests: [
        ex('Example', 5),
        ex('Zero', 0),
        hid('Sixteen', 16),
        hid('Seven', 7),
      ],
    }),

    dsa({
      id: 'dsa-bit-tricks',
      title: 'Everyday Bit Tricks',
      difficulty: 'Easy',
      topics: BIT,
      patterns: ['x & (x − 1), x & −x, shifts'],
      summary: 'Power of two, lowest set bit, i-th bit checks, set/clear/toggle, odd/even.',
      description: md('For each `[x, i]` (x ≥ 0) return `[is_power_of_two, lowest_set_bit, bit_i_is_set, x_with_bit_i_set, x_with_bit_i_cleared, x_with_bit_i_toggled, is_odd]` using bit operations only.'),
      hints: ['Power of two: x > 0 and x & (x − 1) == 0. Lowest set bit: x & −x.'],
      signature: 'bit_tricks(cases: list[list[int]]) -> list[list]',
      solution: code`def bit_tricks(cases: list[list[int]]) -> list[list]:
    out = []
    for x, i in cases:
        out.append([
            x > 0 and x & (x - 1) == 0,
            x & -x,
            (x >> i) & 1 == 1,
            x | (1 << i),
            x & ~(1 << i),
            x ^ (1 << i),
            x & 1 == 1,
        ])
    return out
`,
      explanation: md('`x & (x − 1)` clears the lowest set bit; `x & −x` isolates it (two’s complement). These are building blocks for Fenwick trees and subset enumeration.'),
      tests: [
        ex('Example', [[16, 2], [13, 1]]),
        ex('Zero', [[0, 0]]),
        hid('One', [[1, 0], [6, 3]]),
        hid('Large', [[1024, 10], [1023, 9]]),
      ],
    }),

    dsa({
      id: 'dsa-divide-by-shifting',
      title: 'Integer Division Without * / or %',
      difficulty: 'Medium',
      topics: [...BIT, ...MATH],
      patterns: ['Subtract shifted divisors'],
      summary: 'Truncating division using shifts and subtraction, clamped to 32 bits.',
      description: md('For each `[dividend, divisor]` (divisor ≠ 0) return the quotient truncated toward zero, clamped to `[-2^31, 2^31 − 1]`, without using `*`, `/`, `//` or `%`.'),
      hints: ['Find the largest divisor << k not exceeding the remainder; subtract it and add 1 << k to the quotient.'],
      signature: 'divide(cases: list[list[int]]) -> list[int]',
      solution: code`def divide(cases: list[list[int]]) -> list[int]:
    LO, HI = -(1 << 31), (1 << 31) - 1
    out = []
    for a, b in cases:
        negative = (a < 0) != (b < 0)
        a, b = abs(a), abs(b)
        q = 0
        for k in range(31, -1, -1):
            if (b << k) <= a:
                a -= b << k
                q += 1 << k
        q = -q if negative else q
        out.append(max(LO, min(HI, q)))
    return out
`,
      explanation: md('Binary long division: each bit of the quotient is decided by one comparison. O(32) per division.'),
      tests: [
        ex('Example', [[10, 3], [7, -3]]),
        ex('Overflow', [[-2147483648, -1]]),
        hid('Exact', [[100, 10], [-9, 3]]),
        hid('Smaller dividend', [[1, 2], [0, 5]]),
      ],
    }),

    dsa({
      id: 'dsa-subsets-bitmask',
      title: 'All Subsets by Counting in Binary',
      difficulty: 'Easy',
      topics: [...BIT, 'Recursion & Backtracking'],
      patterns: ['Mask 0..2^n − 1'],
      summary: 'Enumerate subsets with bitmasks, ordered by mask.',
      description: md('Return every subset of `items` in order of mask 0, 1, …, 2^n − 1 where bit i set means items[i] is included (items in index order within a subset).'),
      hints: ['for mask in range(1 << n): [items[i] for i in range(n) if mask >> i & 1].'],
      signature: 'subsets_by_mask(items: list[str]) -> list[list[str]]',
      solution: code`def subsets_by_mask(items: list[str]) -> list[list[str]]:
    n = len(items)
    return [[items[i] for i in range(n) if mask >> i & 1] for mask in range(1 << n)]
`,
      explanation: md('Masks map one-to-one to subsets — the basis of bitmask DP (e.g. travelling salesman over ≤ 20 cities).'),
      tests: [
        ex('Example', ['a', 'b', 'c']),
        ex('Empty', []),
        hid('One', ['x']),
        hid('Four', ['p', 'q', 'r', 's']),
      ],
    }),

    dsa({
      id: 'dsa-xor-range',
      title: 'XOR of 1..n and of a Range in O(1)',
      difficulty: 'Medium',
      topics: BIT,
      patterns: ['Period-4 pattern of prefix XOR'],
      summary: 'XOR of all integers from L to R without looping.',
      description: md('For each `[L, R]` (0 ≤ L ≤ R) return the XOR of every integer from L to R inclusive.'),
      hints: ['f(n) = XOR of 0..n follows n % 4 → [n, 1, n + 1, 0]. Answer = f(R) ^ f(L − 1).'],
      signature: 'xor_ranges(ranges: list[list[int]]) -> list[int]',
      solution: code`def xor_ranges(ranges: list[list[int]]) -> list[int]:
    def f(n):
        if n < 0:
            return 0
        return [n, 1, n + 1, 0][n % 4]
    return [f(r) ^ f(l - 1) for l, r in ranges]
`,
      explanation: md('Prefix XOR plus a closed form for f(n) gives O(1) per query — the XOR analogue of prefix sums.'),
      tests: [
        ex('Example', [[3, 5], [1, 4]]),
        ex('Single', [[7, 7], [0, 0]]),
        hid('Large', [[1, 1000000], [123, 456789]]),
        hid('From zero', [[0, 3], [0, 10]]),
      ],
    }),

    dsa({
      id: 'dsa-flips-and-hamming',
      title: 'Bit Flips Between Numbers and Total Hamming Distance',
      difficulty: 'Medium',
      topics: BIT,
      patterns: ['popcount(a ^ b); per-bit ones × zeros'],
      summary: 'Flips to turn a into b, and the sum of Hamming distances over all pairs.',
      description: md('Return `[flips, total]`: the number of bit flips to convert `a` into `b`, and the sum of Hamming distances over all pairs of `nums` (values < 2^31).'),
      hints: ['For each bit, the pairs that differ = ones × (n − ones).'],
      signature: 'hamming(a: int, b: int, nums: list[int]) -> list[int]',
      solution: code`def hamming(a: int, b: int, nums: list[int]) -> list[int]:
    flips = bin(a ^ b).count("1")
    n, total = len(nums), 0
    for bit in range(31):
        ones = sum((x >> bit) & 1 for x in nums)
        total += ones * (n - ones)
    return [flips, total]
`,
      explanation: md('Counting per bit turns the O(n²) pairwise sum into O(31 · n).'),
      tests: [
        ex('Example', 10, 7, [4, 14, 2]),
        ex('Same number', 5, 5, [4, 14, 4]),
        hid('Empty list', 0, 15, []),
        hid('Larger', 1, 1024, [1, 2, 3, 4, 5, 6, 7, 8]),
      ],
    }),

    dsa({
      id: 'dsa-gray-code',
      title: 'Gray Code: Neighbours Differ by One Bit',
      difficulty: 'Medium',
      topics: BIT,
      patterns: ['i ^ (i >> 1)'],
      summary: 'The standard n-bit reflected Gray code sequence.',
      description: md('Return the 2^n-element reflected Gray code starting at 0, where consecutive values (and the last and first) differ in exactly one bit.'),
      hints: ['g(i) = i ^ (i >> 1).'],
      signature: 'gray_code(n: int) -> list[int]',
      solution: code`def gray_code(n: int) -> list[int]:
    return [i ^ (i >> 1) for i in range(1 << n)]
`,
      explanation: md('Reflecting the (n − 1)-bit sequence and prefixing a 1 yields the closed form i ^ (i >> 1). Used in rotary encoders and error minimisation.'),
      tests: [
        ex('Example', 2),
        ex('Zero bits', 0),
        hid('Three bits', 3),
        hid('Four bits', 4),
      ],
    }),

    dsa({
      id: 'dsa-reverse-bits',
      title: 'Reverse the Bits of a 32-bit Integer',
      difficulty: 'Easy',
      topics: BIT,
      patterns: ['Shift out, shift in'],
      summary: 'Mirror the 32-bit representation of unsigned integers.',
      description: md('For each unsigned 32-bit integer return the value obtained by reversing its 32 bits.'),
      hints: ['32 times: result = (result << 1) | (x & 1); x >>= 1.'],
      signature: 'reverse_bits(values: list[int]) -> list[int]',
      solution: code`def reverse_bits(values: list[int]) -> list[int]:
    out = []
    for x in values:
        r = 0
        for _ in range(32):
            r = (r << 1) | (x & 1)
            x >>= 1
        out.append(r)
    return out
`,
      explanation: md('O(32) per value; lookup tables of reversed bytes or divide-and-conquer masks make it faster for bulk work.'),
      tests: [
        ex('Example', [43261596]),
        ex('Ones', [4294967293]),
        hid('Zero and one', [0, 1]),
        hid('Top bit', [2147483648]),
      ],
    }),

    dsa({
      id: 'dsa-gcd-lcm-euclid',
      title: 'GCD and LCM with Euclid’s Algorithm',
      difficulty: 'Easy',
      topics: MATH,
      patterns: ['gcd(a, b) = gcd(b, a mod b)'],
      summary: 'GCD, LCM and the Bézout coefficients for each pair.',
      description: md('For each `[a, b]` (positive), return `[gcd, lcm, x, y]` where `a·x + b·y = gcd` from the extended Euclidean algorithm (recursive form: from gcd(b, a % b) = b·x1 + (a % b)·y1, take x = y1, y = x1 − (a // b)·y1).'),
      hints: ['lcm = a // gcd · b (divide first to keep numbers small).'],
      signature: 'gcd_lcm(pairs: list[list[int]]) -> list[list[int]]',
      solution: code`def gcd_lcm(pairs: list[list[int]]) -> list[list[int]]:
    def ext(a, b):
        if b == 0:
            return a, 1, 0
        g, x1, y1 = ext(b, a % b)
        return g, y1, x1 - (a // b) * y1
    out = []
    for a, b in pairs:
        g, x, y = ext(a, b)
        out.append([g, a // g * b, x, y])
    return out
`,
      explanation: md('Euclid runs in O(log min(a, b)); the extended version gives modular inverses when gcd = 1.'),
      tests: [
        ex('Example', [[12, 18], [7, 5]]),
        ex('Equal', [[9, 9]]),
        hid('Coprime larger', [[99991, 65537]]),
        hid('One divides', [[4, 20], [35, 7]]),
      ],
    }),

    dsa({
      id: 'dsa-sieve-and-spf',
      title: 'Primes up to n and Fast Factorisation',
      difficulty: 'Medium',
      topics: MATH,
      patterns: ['Sieve of Eratosthenes / smallest prime factor'],
      summary: 'All primes ≤ n, and prime factorisations of queries via an SPF table.',
      description: md('Return `[primes_up_to_n, factorisations]` where each query `q ≤ n` is factorised into its prime factors in ascending order with multiplicity (`[]` for 1).'),
      hints: ['Sieve the smallest prime factor once; then divide q by spf[q] repeatedly.'],
      signature: 'sieve(n: int, queries: list[int]) -> list',
      solution: code`def sieve(n: int, queries: list[int]) -> list:
    spf = list(range(n + 1))
    i = 2
    while i * i <= n:
        if spf[i] == i:
            for j in range(i * i, n + 1, i):
                if spf[j] == j:
                    spf[j] = i
        i += 1
    primes = [p for p in range(2, n + 1) if spf[p] == p]
    out = []
    for q in queries:
        f = []
        while q > 1:
            f.append(spf[q])
            q //= spf[q]
        out.append(f)
    return [primes, out]
`,
      explanation: md('The sieve is O(n log log n); with the SPF table every factorisation is O(log q).'),
      tests: [
        ex('Example', 30, [12, 29, 1]),
        ex('Tiny', 2, [2]),
        hid('Prime powers', 100, [64, 81, 97, 100]),
        hid('Below two', 1, []),
      ],
    }),

    dsa({
      id: 'dsa-divisors-list',
      title: 'All Divisors in O(√n)',
      difficulty: 'Easy',
      topics: MATH,
      patterns: ['Pair divisors around √n'],
      summary: 'Sorted divisors, their count and sum, for each number.',
      description: md('For each n ≥ 1 return `[divisors_sorted, count, sum]`.'),
      hints: ['If d divides n, so does n // d; stop at √n.'],
      signature: 'divisors(nums: list[int]) -> list[list]',
      solution: code`from math import isqrt

def divisors(nums: list[int]) -> list[list]:
    out = []
    for n in nums:
        small, large = [], []
        for d in range(1, isqrt(n) + 1):
            if n % d == 0:
                small.append(d)
                if d != n // d:
                    large.append(n // d)
        ds = small + large[::-1]
        out.append([ds, len(ds), sum(ds)])
    return out
`,
      explanation: md('Divisors come in pairs (d, n/d) with d ≤ √n, so O(√n) per number; perfect squares contribute √n once.'),
      tests: [
        ex('Example', [36, 7]),
        ex('One', [1]),
        hid('Perfect number', [28]),
        hid('Larger', [1000]),
      ],
    }),

    dsa({
      id: 'dsa-ncr-mod-prime',
      title: 'Binomial Coefficients Modulo a Prime',
      difficulty: 'Medium',
      topics: MATH,
      patterns: ['Factorials + Fermat inverses'],
      summary: 'C(n, r) mod 1e9+7 for many queries.',
      description: md('For each `[n, r]` (0 ≤ n ≤ 10^5) return `C(n, r) mod 1_000_000_007` (0 if r > n). Precompute factorials and inverse factorials.'),
      hints: ['inv_fact[n] = pow(fact[n], p − 2, p); then go downward: inv_fact[i − 1] = inv_fact[i] · i.'],
      signature: 'ncr(queries: list[list[int]]) -> list[int]',
      solution: code`def ncr(queries: list[list[int]]) -> list[int]:
    MOD = 1_000_000_007
    top = max((n for n, _ in queries), default=0)
    fact = [1] * (top + 1)
    for i in range(1, top + 1):
        fact[i] = fact[i - 1] * i % MOD
    inv = [1] * (top + 1)
    inv[top] = pow(fact[top], MOD - 2, MOD)
    for i in range(top, 0, -1):
        inv[i - 1] = inv[i] * i % MOD
    return [0 if r < 0 or r > n else fact[n] * inv[r] % MOD * inv[n - r] % MOD for n, r in queries]
`,
      explanation: md('Fermat’s little theorem gives modular inverses for a prime modulus; precomputation makes each query O(1).'),
      tests: [
        ex('Example', [[5, 2], [10, 3]]),
        ex('Edges', [[4, 0], [4, 4], [3, 5]]),
        hid('Large', [[100000, 50000], [1000, 500]]),
        hid('Zero', [[0, 0]]),
      ],
    }),
  ],
};
