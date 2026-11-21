// DSA pack 04 — strings: word reversal, palindromes (expand / Manacher-free),
// Roman numerals, atoi, common prefix, pattern search with KMP / Z / rolling
// hash, shortest palindrome via LPS, count-and-say, version compare, frequency
// sort, repeated-string match, and substring beauty.
import { dsa, md, code, ex, hid } from './define.js';

export default {
  problems: [
    dsa({
      id: 'dsa-reverse-word-order',
      title: 'Reverse the Order of Words',
      difficulty: 'Easy',
      topics: ['Strings', 'Two Pointers'],
      patterns: ['Tokenise and reverse'],
      summary: 'Reverse word order, collapsing repeated and edge spaces.',
      description: md('Return the words of `s` in reverse order separated by single spaces, with no leading or trailing spaces. Implement the tokenising yourself (no `split()`).'),
      hints: ['Scan for runs of non-space characters; collect them; join reversed.'],
      signature: 'reverse_words(s: str) -> str',
      solution: code`def reverse_words(s: str) -> str:
    words, i, n = [], 0, len(s)
    while i < n:
        while i < n and s[i] == " ":
            i += 1
        j = i
        while j < n and s[j] != " ":
            j += 1
        if i < j:
            words.append(s[i:j])
        i = j
    return " ".join(reversed(words))
`,
      explanation: md('A manual scanner handles any whitespace layout in O(n). (In-place variant in languages with mutable strings: reverse the whole string, then each word.)'),
      tests: [
        ex('Example', 'the sky is blue'),
        ex('Extra spaces', '  hello   world  '),
        hid('Single word', 'data'),
        hid('Only spaces', '   '),
      ],
    }),

    dsa({
      id: 'dsa-longest-palindromic-substring',
      title: 'Longest Palindromic Substring',
      difficulty: 'Medium',
      topics: ['Strings', 'Two Pointers', 'Dynamic Programming'],
      patterns: ['Expand around centres'],
      summary: 'Find the longest substring that reads the same both ways (earliest on ties).',
      description: md('Return the longest palindromic substring of `s`; if several have the maximum length, return the one that starts first.'),
      hints: ['Every palindrome has a centre: a character (odd) or a gap (even). Expand both kinds — 2n − 1 centres.'],
      signature: 'longest_palindrome(s: str) -> str',
      solution: code`def longest_palindrome(s: str) -> str:
    best = (0, 0)
    for c in range(len(s)):
        for lo, hi in ((c, c), (c, c + 1)):
            while lo >= 0 and hi < len(s) and s[lo] == s[hi]:
                lo -= 1
                hi += 1
            if hi - lo - 1 > best[1] - best[0]:
                best = (lo + 1, hi)
    return s[best[0]:best[1]]
`,
      explanation: md('Expanding from each centre is O(n²) time, O(1) space — simpler than the O(n²) DP table; Manacher’s algorithm achieves O(n).'),
      tests: [
        ex('Example', 'babad'),
        ex('Even length', 'cbbd'),
        hid('Whole string', 'racecar'),
        hid('Empty', ''),
      ],
    }),

    dsa({
      id: 'dsa-count-palindromic-substrings',
      title: 'How Many Substrings Are Palindromes?',
      difficulty: 'Medium',
      topics: ['Strings', 'Dynamic Programming'],
      patterns: ['Expand around centres'],
      summary: 'Count palindromic substrings (by position).',
      description: md('Return the number of substrings of `s` (different start or end positions count separately) that are palindromes.'),
      hints: ['Each successful expansion step from a centre is one more palindrome.'],
      signature: 'count_palindromes(s: str) -> int',
      solution: code`def count_palindromes(s: str) -> int:
    total = 0
    for c in range(len(s)):
        for lo, hi in ((c, c), (c, c + 1)):
            while lo >= 0 and hi < len(s) and s[lo] == s[hi]:
                total += 1
                lo -= 1
                hi += 1
    return total
`,
      explanation: md('Same centre expansion, counting instead of measuring. O(n²).'),
      tests: [
        ex('Example', 'abc'),
        ex('Repeats', 'aaa'),
        hid('Mixed', 'abba'),
        hid('Empty', ''),
      ],
    }),

    dsa({
      id: 'dsa-roman-both-ways',
      title: 'Roman Numerals Both Ways',
      difficulty: 'Easy',
      topics: ['Strings', 'Hashing'],
      patterns: ['Subtractive notation'],
      summary: 'Convert integers to Roman numerals and Roman numerals back to integers.',
      description: md('Return `[[to_roman(n) for n in numbers], [from_roman(r) for r in romans]]` for 1 ≤ n ≤ 3999.'),
      hints: ['to_roman: greedy over the 13 values including 900, 400, 90, 40, 9, 4. from_roman: subtract a symbol smaller than its right neighbour.'],
      signature: 'roman(numbers: list[int], romans: list[str]) -> list[list]',
      solution: code`VALUES = [(1000, "M"), (900, "CM"), (500, "D"), (400, "CD"), (100, "C"), (90, "XC"),
          (50, "L"), (40, "XL"), (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")]
SYMBOL = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}

def roman(numbers: list[int], romans: list[str]) -> list[list]:
    def to_roman(n):
        out = []
        for v, sym in VALUES:
            while n >= v:
                out.append(sym)
                n -= v
        return "".join(out)

    def from_roman(r):
        total = 0
        for i, ch in enumerate(r):
            v = SYMBOL[ch]
            total += -v if i + 1 < len(r) and SYMBOL[r[i + 1]] > v else v
        return total

    return [[to_roman(n) for n in numbers], [from_roman(r) for r in romans]]
`,
      explanation: md('Including the six subtractive pairs in the table makes the greedy encoding correct; decoding subtracts a value whenever a larger symbol follows.'),
      tests: [
        ex('Example', [3, 58, 1994], ['III', 'LVIII', 'MCMXCIV']),
        ex('Edges', [1, 3999], ['MMMCMXCIX']),
        hid('Fours and nines', [4, 9, 40, 90, 400, 900], ['XLIV', 'CDXC']),
        hid('Round numbers', [10, 100, 1000, 2024], ['MMXXIV', 'DCCC']),
      ],
    }),

    dsa({
      id: 'dsa-parse-int-strict',
      title: 'Parse an Integer Like atoi (Clamped to 32 Bits)',
      difficulty: 'Medium',
      topics: ['Strings'],
      patterns: ['State machine parsing'],
      summary: 'Skip spaces, read an optional sign and digits, stop at the first non-digit, clamp.',
      description: md('Implement C-style `atoi`: skip leading spaces, accept one optional `+`/`-`, read digits until a non-digit, and clamp to `[-2^31, 2^31 − 1]`. No digits → 0. Don’t use `int()` on the whole string.'),
      hints: ['Accumulate value = value * 10 + digit; clamp at the end (Python ints don’t overflow).'],
      signature: 'atoi_all(texts: list[str]) -> list[int]',
      solution: code`def atoi_all(texts: list[str]) -> list[int]:
    LO, HI = -2 ** 31, 2 ** 31 - 1

    def atoi(s):
        i, n = 0, len(s)
        while i < n and s[i] == " ":
            i += 1
        sign = 1
        if i < n and s[i] in "+-":
            sign = -1 if s[i] == "-" else 1
            i += 1
        value = 0
        while i < n and s[i].isdigit():
            value = value * 10 + (ord(s[i]) - 48)
            i += 1
        return max(LO, min(HI, sign * value))

    return [atoi(s) for s in texts]
`,
      explanation: md('A tiny state machine (spaces → sign → digits → stop) covers every case; clamping mirrors fixed-width integer behaviour.'),
      tests: [
        ex('Example', ['42', '   -42', '4193 with words']),
        ex('Words first', ['words and 987', '']),
        hid('Overflow', ['-91283472332', '2147483648']),
        hid('Signs', ['+1', '+-12', '  0032']),
      ],
    }),

    dsa({
      id: 'dsa-shared-prefix',
      title: 'Longest Prefix Shared by Every String',
      difficulty: 'Easy',
      topics: ['Strings'],
      patterns: ['Vertical scan / sort ends'],
      summary: 'Longest common prefix of a list of strings.',
      description: md('Return the longest string that is a prefix of every string in `words` (`""` for an empty list).'),
      hints: ['After sorting, only the first and last strings matter.'],
      signature: 'common_prefix(words: list[str]) -> str',
      solution: code`def common_prefix(words: list[str]) -> str:
    if not words:
        return ""
    a, b = min(words), max(words)
    i = 0
    while i < len(a) and i < len(b) and a[i] == b[i]:
        i += 1
    return a[:i]
`,
      explanation: md('The lexicographically smallest and largest strings differ earliest; their common prefix is everyone’s. O(n · L).'),
      tests: [
        ex('Example', ['flower', 'flow', 'flight']),
        ex('None', ['dog', 'racecar', 'car']),
        hid('Empty list', []),
        hid('Identical', ['ab', 'ab']),
      ],
    }),

    dsa({
      id: 'dsa-kmp-prefix-function',
      title: 'Find Every Occurrence with KMP',
      difficulty: 'Hard',
      topics: ['Strings'],
      patterns: ['KMP failure function'],
      summary: 'Build the longest-proper-prefix-suffix table and use it to find all matches in O(n + m).',
      description: md('Return `[lps, matches]` where `lps[i]` is the length of the longest proper prefix of `pattern[:i+1]` that is also its suffix, and `matches` are all start indices of `pattern` in `text` (overlaps allowed).'),
      hints: ['On a mismatch, fall back to lps[k − 1] instead of restarting.'],
      signature: 'kmp(text: str, pattern: str) -> list',
      solution: code`def kmp(text: str, pattern: str) -> list:
    lps, k = [0] * len(pattern), 0
    for i in range(1, len(pattern)):
        while k and pattern[i] != pattern[k]:
            k = lps[k - 1]
        if pattern[i] == pattern[k]:
            k += 1
        lps[i] = k
    matches, k = [], 0
    for i, ch in enumerate(text):
        while k and ch != pattern[k]:
            k = lps[k - 1]
        if ch == pattern[k]:
            k += 1
        if k == len(pattern):
            matches.append(i - k + 1)
            k = lps[k - 1]
    return [lps, matches]
`,
      explanation: md('The failure table records how much of the pattern is still matched after a mismatch, so the text pointer never moves backwards: O(n + m) instead of O(nm).'),
      tests: [
        ex('Example', 'ababcabcabababd', 'ababd'),
        ex('Overlapping', 'aaaaa', 'aa'),
        hid('No match', 'abcdef', 'gh'),
        hid('Self-similar pattern', 'abacabab', 'abab'),
      ],
    }),

    dsa({
      id: 'dsa-z-function',
      title: 'Pattern Search with the Z-Array',
      difficulty: 'Hard',
      topics: ['Strings'],
      patterns: ['Z-algorithm'],
      summary: 'Compute the Z-array of pattern + "$" + text and read off matches.',
      description: md('Return `[z, matches]`: `z` is the Z-array of `s = pattern + "$" + text` (`z[0] = 0`), where `z[i]` is the length of the longest substring starting at i that matches a prefix of s; `matches` are the start indices in `text` where `pattern` occurs.'),
      hints: ['Maintain the rightmost window [l, r) that matches a prefix; reuse z[i − l] inside it.'],
      signature: 'z_search(text: str, pattern: str) -> list',
      solution: code`def z_search(text: str, pattern: str) -> list:
    s = pattern + "$" + text
    n = len(s)
    z = [0] * n
    l = r = 0
    for i in range(1, n):
        if i < r:
            z[i] = min(r - i, z[i - l])
        while i + z[i] < n and s[z[i]] == s[i + z[i]]:
            z[i] += 1
        if i + z[i] > r:
            l, r = i, i + z[i]
    m = len(pattern)
    return [z, [i - m - 1 for i in range(m + 1, n) if z[i] >= m]]
`,
      explanation: md('The Z-box reuse makes the whole array O(n). A separator that occurs in neither string caps every Z value at |pattern|.'),
      tests: [
        ex('Example', 'xabcabzabc', 'abc'),
        ex('Repeated', 'aaaa', 'aa'),
        hid('No match', 'hello', 'xyz'),
        hid('Pattern equals text', 'data', 'data'),
      ],
    }),

    dsa({
      id: 'dsa-rolling-hash-search',
      title: 'Rabin–Karp: Find Matches with a Rolling Hash',
      difficulty: 'Medium',
      topics: ['Strings', 'Hashing'],
      patterns: ['Polynomial rolling hash'],
      summary: 'Slide a window hash across the text and verify candidate matches.',
      description: md('Using base `256` and modulus `1_000_000_007`, return `[pattern_hash, matches, spurious]`: the pattern’s hash, all start indices of real matches, and the number of windows whose hash matched but whose text did not (verify by comparison).'),
      hints: ['hash(next) = (hash(prev) − c_out · base^(m−1)) · base + c_in, all mod p.'],
      signature: 'rabin_karp(text: str, pattern: str) -> list',
      solution: code`def rabin_karp(text: str, pattern: str) -> list:
    B, P = 256, 1_000_000_007
    m, n = len(pattern), len(text)
    if m == 0 or m > n:
        return [0, [], 0]
    high = pow(B, m - 1, P)
    hp = hw = 0
    for i in range(m):
        hp = (hp * B + ord(pattern[i])) % P
        hw = (hw * B + ord(text[i])) % P
    matches, spurious = [], 0
    for i in range(n - m + 1):
        if hw == hp:
            if text[i:i + m] == pattern:
                matches.append(i)
            else:
                spurious += 1
        if i + m < n:
            hw = ((hw - ord(text[i]) * high) * B + ord(text[i + m])) % P
    return [hp, matches, spurious]
`,
      explanation: md('Updating the window hash in O(1) gives expected O(n + m) search; verifying on hash equality guards against collisions. Rolling hashes also power duplicate-substring and plagiarism detection.'),
      tests: [
        ex('Example', 'abracadabra', 'abra'),
        ex('No match', 'aaaa', 'b'),
        hid('Overlapping', 'aaaaaa', 'aaa'),
        hid('Pattern longer', 'ab', 'abc'),
      ],
    }),

    dsa({
      id: 'dsa-shortest-palindrome-prefix',
      title: 'Fewest Characters to Prepend for a Palindrome',
      difficulty: 'Hard',
      topics: ['Strings'],
      patterns: ['LPS of s + "#" + reverse(s)'],
      summary: 'Minimum characters to add at the front to make the string a palindrome.',
      description: md('Return `[count, result]` where `result` is the shortest palindrome obtainable by adding characters only at the **front** of `s`, and `count` is how many were added.'),
      hints: ['The longest palindromic prefix of s equals the last LPS value of s + "#" + reversed(s).'],
      signature: 'shortest_palindrome(s: str) -> list',
      solution: code`def shortest_palindrome(s: str) -> list:
    t = s + "#" + s[::-1]
    lps, k = [0] * len(t), 0
    for i in range(1, len(t)):
        while k and t[i] != t[k]:
            k = lps[k - 1]
        if t[i] == t[k]:
            k += 1
        lps[i] = k
    keep = lps[-1]
    add = s[keep:][::-1]
    return [len(add), add + s]
`,
      explanation: md('Whatever lies beyond the longest palindromic prefix must be mirrored in front. KMP’s failure function finds that prefix in O(n).'),
      tests: [
        ex('Example', 'aacecaaa'),
        ex('Another', 'abcd'),
        hid('Already palindrome', 'level'),
        hid('Empty', ''),
      ],
    }),

    dsa({
      id: 'dsa-look-and-say',
      title: 'Look-and-Say Sequence',
      difficulty: 'Easy',
      topics: ['Strings'],
      patterns: ['Run-length encoding'],
      summary: 'Each term describes the previous one as counts of runs.',
      description: md('Term 1 is `"1"`; each next term reads the previous term aloud as run counts ("1211" → one 1, one 2, two 1s → "111221"). Return the first `n` terms.'),
      hints: ['Run-length encode the previous term.'],
      signature: 'look_and_say(n: int) -> list[str]',
      solution: code`def look_and_say(n: int) -> list[str]:
    terms = []
    cur = "1"
    for _ in range(n):
        terms.append(cur)
        out, i = [], 0
        while i < len(cur):
            j = i
            while j < len(cur) and cur[j] == cur[i]:
                j += 1
            out.append(f"{j - i}{cur[i]}")
            i = j
        cur = "".join(out)
    return terms
`,
      explanation: md('Each term is a run-length encoding of the previous one; terms grow by about 30% each step (Conway’s constant).'),
      tests: [
        ex('Example', 5),
        ex('One term', 1),
        hid('Eight terms', 8),
        hid('Zero', 0),
      ],
    }),

    dsa({
      id: 'dsa-compare-versions',
      title: 'Compare Dotted Version Numbers',
      difficulty: 'Medium',
      topics: ['Strings', 'Two Pointers'],
      patterns: ['Segment-wise numeric compare'],
      summary: 'Compare versions like "1.01" and "1.001.0" segment by segment.',
      description: md('For each `[v1, v2]` return `-1`, `0` or `1`. Segments are compared as integers (leading zeros ignored); missing segments count as 0.'),
      hints: ['Pad the shorter list of integers with zeros.'],
      signature: 'compare_versions(pairs: list[list[str]]) -> list[int]',
      solution: code`from itertools import zip_longest

def compare_versions(pairs: list[list[str]]) -> list[int]:
    out = []
    for a, b in pairs:
        result = 0
        for x, y in zip_longest(a.split("."), b.split("."), fillvalue="0"):
            if int(x) != int(y):
                result = -1 if int(x) < int(y) else 1
                break
        out.append(result)
    return out
`,
      explanation: md('String comparison gets "1.10" vs "1.9" wrong; numeric, zero-padded segment comparison gets it right.'),
      tests: [
        ex('Example', [['1.01', '1.001'], ['1.0', '1.0.0'], ['0.1', '1.1']]),
        ex('Ten vs nine', [['1.10', '1.9']]),
        hid('Longer wins', [['1.0.1', '1'], ['7.5.2.4', '7.5.3']]),
        hid('Equal with zeros', [['01', '1'], ['2.0.0.0', '2']]),
      ],
    }),

    dsa({
      id: 'dsa-frequency-sort-chars',
      title: 'Sort Characters by How Often They Appear',
      difficulty: 'Medium',
      topics: ['Strings', 'Hashing', 'Sorting'],
      patterns: ['Bucket by frequency'],
      summary: 'Most frequent characters first; ties by character order.',
      description: md('Return `s` rearranged so characters appear in decreasing frequency, each character’s copies grouped together; break ties by the character’s code point ascending.'),
      hints: ['Counter + sort by (−count, char), or bucket sort by count.'],
      signature: 'frequency_sort(s: str) -> str',
      solution: code`from collections import Counter

def frequency_sort(s: str) -> str:
    counts = Counter(s)
    return "".join(ch * c for ch, c in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0])))
`,
      explanation: md('O(n + k log k) for k distinct characters; buckets indexed by count make it O(n).'),
      tests: [
        ex('Example', 'tree'),
        ex('Ties', 'cccaaa'),
        hid('Case sensitive', 'Aabb'),
        hid('Empty', ''),
      ],
    }),

    dsa({
      id: 'dsa-repeat-until-substring',
      title: 'How Many Repeats Until b Appears?',
      difficulty: 'Medium',
      topics: ['Strings'],
      patterns: ['Bound the repeat count'],
      summary: 'Minimum copies of a so that b is a substring of a repeated.',
      description: md('Return the minimum number of times `a` must be repeated so that `b` is a substring of the result, or −1.'),
      hints: ['You never need more than ceil(|b| / |a|) + 1 copies.'],
      signature: 'repeated_match(a: str, b: str) -> int',
      solution: code`def repeated_match(a: str, b: str) -> int:
    k = -(-len(b) // len(a))
    for times in (k, k + 1):
        if b in a * times:
            return times
    return -1
`,
      explanation: md('Any occurrence of b starts within the first copy of a, so k or k + 1 copies cover it if anything does.'),
      tests: [
        ex('Example', 'abcd', 'cdabcdab'),
        ex('Impossible', 'a', 'b'),
        hid('Needs one extra', 'abc', 'cabcab'),
        hid('Already inside', 'abcabc', 'bca'),
      ],
    }),

    dsa({
      id: 'dsa-substring-beauty',
      title: 'Total Beauty of All Substrings',
      difficulty: 'Medium',
      topics: ['Strings', 'Hashing'],
      patterns: ['Extend substrings with a running count'],
      summary: 'Beauty = max frequency − min frequency among present characters; sum it over all substrings.',
      description: md('The beauty of a string is (highest character frequency − lowest non-zero character frequency). Return the sum of beauties of all substrings of `s` (lowercase letters).'),
      hints: ['Fix the start, extend the end, update a 26-slot count array.'],
      signature: 'beauty_sum(s: str) -> int',
      solution: code`def beauty_sum(s: str) -> int:
    total = 0
    for i in range(len(s)):
        counts = [0] * 26
        for j in range(i, len(s)):
            counts[ord(s[j]) - 97] += 1
            present = [c for c in counts if c]
            total += max(present) - min(present)
    return total
`,
      explanation: md('O(26 · n²): every substring is visited once by extending from each start.'),
      tests: [
        ex('Example', 'aabcb'),
        ex('Another', 'aabcbaa'),
        hid('Uniform', 'aaaa'),
        hid('Empty', ''),
      ],
    }),

    dsa({
      id: 'dsa-valid-anagram-groups',
      title: 'Are These Two Strings Anagrams?',
      difficulty: 'Easy',
      topics: ['Strings', 'Hashing'],
      patterns: ['Character counts'],
      summary: 'Check pairs of strings for being rearrangements of each other.',
      description: md('For each `[a, b]` return whether `b` is a rearrangement of `a` (case-sensitive, spaces count).'),
      hints: ['Compare counts; a 26-slot array suffices for lowercase input.'],
      signature: 'anagram_pairs(pairs: list[list[str]]) -> list[bool]',
      solution: code`from collections import Counter

def anagram_pairs(pairs: list[list[str]]) -> list[bool]:
    return [len(a) == len(b) and Counter(a) == Counter(b) for a, b in pairs]
`,
      explanation: md('Counting is O(n); sorting both strings is O(n log n).'),
      tests: [
        ex('Example', [['anagram', 'nagaram'], ['rat', 'car']]),
        ex('Empty', [['', '']]),
        hid('Case and length', [['Ab', 'ab'], ['aab', 'ab']]),
        hid('Spaces count', [['a b', 'ba '], ['ab', 'a b']]),
      ],
    }),

    dsa({
      id: 'dsa-max-paren-depth',
      title: 'Deepest Nesting of Parentheses',
      difficulty: 'Easy',
      topics: ['Strings', 'Stacks & Queues'],
      patterns: ['Running depth counter'],
      summary: 'Max nesting depth of a valid parenthesised expression.',
      description: md('Return the maximum depth of nested `(` `)` in a valid expression (other characters are ignored).'),
      hints: ['+1 on "(", −1 on ")", track the maximum.'],
      signature: 'max_depth(expr: str) -> int',
      solution: code`def max_depth(expr: str) -> int:
    depth = best = 0
    for ch in expr:
        if ch == "(":
            depth += 1
            best = max(best, depth)
        elif ch == ")":
            depth -= 1
    return best
`,
      explanation: md('For a single bracket type the stack collapses to a counter. O(n), O(1).'),
      tests: [
        ex('Example', '(1+(2*3)+((8)/4))+1'),
        ex('Flat', '1+2'),
        hid('Deep', '((((x))))'),
        hid('Side by side', '()()(())'),
      ],
    }),
  ],
};
