// Python pack 1 — strings: splitting, counting, palindromes, anagrams,
// formatting and parsing. Company tags only where a public page reports the
// question type (see sources.js); every problem here is written from scratch.
import { python, md, code, ex, hid } from './define.js';
import { dev, dlp, ddp, gfg, jpm, tag } from './sources.js';

const DE = ['Data Engineer'];
const DE_DA = ['Data Engineer', 'Data Analyst'];

export default {
  problems: [
    python({
      id: 'reverse-word-order',
      title: 'Reverse the Word Order',
      difficulty: 'Easy',
      topics: ['Strings'],
      patterns: ['Split → transform → join'],
      domains: ['Search & text'],
      ...tag(gfg('Ernst & Young', 'reverse the words of a space-separated string'), dev('Bloomberg', 'reverse words in a string')),
      roles: DE,
      summary: 'Reverse the order of the words in a search query, collapsing stray whitespace.',
      description: md(
        "A search log stores each query as typed, so some have leading, trailing or repeated spaces (and the odd tab).",
        '',
        'Return the words of `query` in **reverse order**, joined by single spaces. A query with no words returns an empty string.',
        '',
        '```',
        '"  load  daily   sales "   →   "sales daily load"',
        '```',
      ),
      hints: [
        '`str.split()` with no argument splits on any run of whitespace and drops empty pieces.',
        "`' '.join(...)` puts the words back together; `reversed()` or slicing `[::-1]` flips the order.",
      ],
      entry: 'reverse_words',
      signature: 'reverse_words(query: str) -> str',
      solution: code`def reverse_words(query: str) -> str:
    return " ".join(reversed(query.split()))
`,
      explanation: md(
        '`split()` (no argument) is the key: it treats any whitespace run as one separator and never yields empty strings, so leading, trailing and doubled spaces disappear on their own.',
        '',
        "A common mistake is `split(' ')`, which keeps empty strings for every extra space and produces double spaces in the output.",
      ),
      tests: [
        ex('Example', '  load  daily   sales '),
        ex('Single word', 'orders'),
        hid('Empty query', ''),
        hid('Only whitespace', '   \t  '),
        hid('Tabs and newlines between words', 'top\tsellers\nthis week'),
      ],
    }),

    python({
      id: 'reverse-each-word',
      title: 'Reverse Each Word in Place',
      difficulty: 'Easy',
      topics: ['Strings'],
      patterns: ['Split → transform → join'],
      domains: ['Search & text'],
      ...tag(gfg('Ernst & Young', 'reverse each word individually')),
      roles: DE,
      summary: 'Reverse the letters of every word but keep the words — and the spaces between them — where they are.',
      description: md(
        'Reverse the characters of **each word** in `text` while keeping every space exactly where it was (including runs of spaces).',
        '',
        'A word is a maximal run of non-space characters.',
        '',
        '```',
        '"etl  job ok"   →   "lte  boj ko"',
        '```',
      ),
      hints: [
        "Splitting on a single space (`split(' ')`) keeps empty strings for repeated spaces — here that is exactly what you want.",
        'Reverse every piece with `[::-1]` and join with the same single space.',
      ],
      entry: 'reverse_each_word',
      signature: 'reverse_each_word(text: str) -> str',
      solution: code`def reverse_each_word(text: str) -> str:
    return " ".join(word[::-1] for word in text.split(" "))
`,
      explanation: md(
        "This is the one place where `split(' ')` beats `split()`: the empty strings it produces for doubled spaces are reversed into empty strings and joined back, so the spacing survives untouched.",
      ),
      tests: [
        ex('Example', 'etl  job ok'),
        ex('One word', 'pipeline'),
        hid('Leading and trailing spaces', '  a bc  '),
        hid('Empty string', ''),
        hid('Punctuation stays inside the word', 'hi, there!'),
      ],
    }),

    python({
      id: 'sentence-palindrome',
      title: 'Palindrome, Ignoring Punctuation',
      difficulty: 'Easy',
      topics: ['Strings'],
      patterns: ['Normalise then compare'],
      domains: ['Search & text'],
      ...tag(gfg('Amazon', 'check whether a string is a palindrome'), gfg('Infosys', 'check if a given string is a palindrome'), dlp('Spotify', 'Is Palindrome')),
      roles: DE_DA,
      summary: 'Decide whether a phrase reads the same backwards once case, spaces and punctuation are ignored.',
      description: md(
        'Return `True` if `phrase` is a palindrome when you look only at its **letters and digits**, ignoring case. Everything else (spaces, punctuation, symbols) is ignored.',
        '',
        'A phrase with no letters or digits counts as a palindrome.',
        '',
        '```',
        '"Never odd, or even."   →   True',
        '"Data at a glance"      →   False',
        '```',
      ),
      hints: [
        '`ch.isalnum()` keeps letters and digits; `ch.lower()` folds case.',
        'Compare the cleaned string with its reverse — or walk two pointers inward to avoid building a copy.',
      ],
      entry: 'is_palindrome',
      signature: 'is_palindrome(phrase: str) -> bool',
      solution: code`def is_palindrome(phrase: str) -> bool:
    cleaned = [ch.lower() for ch in phrase if ch.isalnum()]
    return cleaned == cleaned[::-1]
`,
      explanation: md(
        'Normalise first, compare second. Building the cleaned list is O(n) time and space; a two-pointer version skips non-alphanumerics from both ends and needs O(1) extra space — worth mentioning in an interview.',
      ),
      tests: [
        ex('Example', 'Never odd, or even.'),
        ex('Not a palindrome', 'Data at a glance'),
        hid('Digits count', 'A1b2B1a'),
        hid('No letters at all', '?!  ..'),
        hid('Case only differs', 'Racecar'),
        hid('Almost', 'abca'),
      ],
    }),

    python({
      id: 'shortest-palindrome-append',
      title: 'Fewest Characters to Make a Palindrome',
      difficulty: 'Medium',
      topics: ['Strings'],
      patterns: ['Longest palindromic suffix'],
      domains: ['Search & text'],
      ...tag(gfg('Paytm', 'how many characters to append to make a string a palindrome', '2 yrs')),
      roles: DE,
      summary: 'Count the characters you must add to the end of a string to turn it into a palindrome.',
      description: md(
        'You may only **append** characters to the end of `s`. Return the smallest number of characters needed to make it a palindrome.',
        '',
        '```',
        '"abcb"   →   1      ("abcb" + "a" = "abcba")',
        '"race"   →   3      ("race" + "car")',
        '```',
      ),
      hints: [
        'Whatever you append mirrors a prefix of `s`. The part you keep untouched must be a palindromic **suffix**.',
        'Find the earliest index `i` such that `s[i:]` is a palindrome; the answer is `i`.',
      ],
      entry: 'chars_to_append',
      signature: 'chars_to_append(s: str) -> int',
      solution: code`def chars_to_append(s: str) -> int:
    for i in range(len(s)):
        tail = s[i:]
        if tail == tail[::-1]:
            return i
    return 0
`,
      explanation: md(
        'If `s[i:]` is already a palindrome, appending the reverse of `s[:i]` finishes the job, so `i` characters suffice; the smallest such `i` is optimal because a shorter append would need a longer palindromic suffix.',
        '',
        'This check is O(n²). The O(n) version runs KMP\'s failure function on `reverse(s) + "#" + s` — a good follow-up to mention.',
      ),
      tests: [
        ex('Example', 'abcb'),
        ex('Needs three', 'race'),
        hid('Already a palindrome', 'level'),
        hid('Empty string', ''),
        hid('All different', 'abcd'),
        hid('Repeated letters', 'aacecaaa'),
      ],
    }),

    python({
      id: 'char-counts-in-order',
      title: 'Character Counts in First-Seen Order',
      difficulty: 'Easy',
      topics: ['Strings', 'Hash Maps & Counting'],
      patterns: ['Counting with a dict'],
      domains: ['Search & text'],
      ...tag(gfg('Tiger Analytics', 'frequency of each character'), gfg('Sigmoid', 'print each character in order of appearance followed by its count')),
      roles: DE_DA,
      summary: 'Encode a string as each distinct character followed by how often it occurs, in order of first appearance.',
      description: md(
        'Return a string listing every distinct character of `s` **in the order it first appears**, each followed by its total count in `s`.',
        '',
        '```',
        '"banana"   →   "b1a3n2"',
        '```',
      ),
      hints: [
        'Python dicts remember insertion order, so a plain dict (or `collections.Counter`) already keeps first-seen order.',
        'Build the pieces with an f-string and `"".join(...)`.',
      ],
      entry: 'char_counts',
      signature: 'char_counts(s: str) -> str',
      solution: code`from collections import Counter

def char_counts(s: str) -> str:
    counts = Counter(s)
    return "".join(f"{ch}{n}" for ch, n in counts.items())
`,
      explanation: md(
        'Since Python 3.7 a dict iterates in insertion order, and `Counter` is a dict, so `counts.items()` is already in first-seen order — no extra bookkeeping needed. One pass to count, one to format: O(n).',
      ),
      tests: [
        ex('Example', 'banana'),
        ex('All distinct', 'abc'),
        hid('Empty string', ''),
        hid('Spaces and case count separately', 'Aa a'),
        hid('Long run', 'zzzzzzzzzzzz'),
      ],
    }),

    python({
      id: 'first-unique-character',
      title: 'First Non-Repeating Character',
      difficulty: 'Easy',
      topics: ['Strings', 'Hash Maps & Counting'],
      patterns: ['Count, then scan'],
      domains: ['Search & text'],
      ...tag(dev('Microsoft', 'first unique character index')),
      roles: DE,
      summary: 'Find the index of the first character that appears exactly once.',
      description: md(
        'Return the index of the first character in `s` that occurs **exactly once**. Return `-1` if every character repeats.',
        '',
        '```',
        '"streamstats"   →   2     ("r")',
        '```',
      ),
      hints: ['Count every character first, then scan the string again and return the first index whose count is 1.'],
      entry: 'first_unique',
      signature: 'first_unique(s: str) -> int',
      solution: code`from collections import Counter

def first_unique(s: str) -> int:
    counts = Counter(s)
    for i, ch in enumerate(s):
        if counts[ch] == 1:
            return i
    return -1
`,
      explanation: md('Two passes, both O(n): a frequency table, then the first position with frequency 1. Trying to do it in one pass with "seen" sets fails because a character can turn out to repeat later.'),
      tests: [
        ex('Example', 'streamstats'),
        ex('Everything repeats', 'aabb'),
        hid('Empty string', ''),
        hid('First character', 'xyy'),
        hid('Last character', 'aabbc'),
      ],
    }),

    python({
      id: 'first-repeated-character',
      title: 'The First Character Seen Twice',
      difficulty: 'Easy',
      topics: ['Strings', 'Dicts & Sets'],
      patterns: ['Seen-set scan'],
      domains: ['Search & text'],
      ...tag(ddp('Nintendo', 'The First Encounter')),
      roles: DE,
      summary: 'Scan a string and return the first character whose second occurrence comes earliest.',
      description: md(
        'Read `s` left to right and return the **first character that you see for the second time**. Return an empty string if no character repeats.',
        '',
        '```',
        '"abcbad"   →   "b"     (b repeats at index 3, before a repeats at index 4)',
        '```',
      ),
      hints: ['Keep a set of characters seen so far; the first one already in the set is the answer.'],
      entry: 'first_repeat',
      signature: 'first_repeat(s: str) -> str',
      solution: code`def first_repeat(s: str) -> str:
    seen = set()
    for ch in s:
        if ch in seen:
            return ch
        seen.add(ch)
    return ""
`,
      explanation: md('"First repeated" means the earliest **second** occurrence, not the character whose first occurrence is earliest — `"abcbad"` returns `"b"`, not `"a"`. A set gives O(1) membership, so the scan is O(n).'),
      tests: [
        ex('Example', 'abcbad'),
        ex('No repeats', 'abc'),
        hid('Empty string', ''),
        hid('Immediate repeat', 'zz'),
        hid('Case-sensitive', 'aAbBa'),
      ],
    }),

    python({
      id: 'is-anagram',
      title: 'Are These Two Phrases Anagrams?',
      difficulty: 'Easy',
      topics: ['Strings', 'Hash Maps & Counting'],
      patterns: ['Compare frequency tables'],
      domains: ['Search & text'],
      ...tag(dlp('Workday', 'Is Anagram?')),
      roles: DE_DA,
      summary: 'Check whether two phrases use exactly the same letters, ignoring case and spaces.',
      description: md(
        'Return `True` if `a` and `b` are anagrams of each other: the same letters with the same counts, **ignoring case and spaces**. Every other character counts.',
        '',
        '```',
        '"Dormitory", "dirty room"   →   True',
        '```',
      ),
      hints: ['Normalise both (lowercase, drop spaces) and compare `Counter`s — or compare the sorted strings.'],
      entry: 'is_anagram',
      signature: 'is_anagram(a: str, b: str) -> bool',
      solution: code`from collections import Counter

def is_anagram(a: str, b: str) -> bool:
    norm = lambda s: Counter(s.lower().replace(" ", ""))
    return norm(a) == norm(b)
`,
      explanation: md('Comparing two `Counter`s is O(n); sorting both strings is O(n log n) and also fine. Normalising before counting is the step people forget.'),
      tests: [
        ex('Example', 'Dormitory', 'dirty room'),
        ex('Different counts', 'aab', 'abb'),
        hid('Both empty', '', ''),
        hid('Punctuation counts', 'a.b', 'ab'),
        hid('Spaces only differ', 'listen', 'si lent'),
      ],
    }),

    python({
      id: 'group-anagram-codes',
      title: 'Group Product Codes That Are Anagrams',
      difficulty: 'Medium',
      topics: ['Strings', 'Hash Maps & Counting', 'Sorting'],
      patterns: ['Canonical key grouping'],
      domains: ['E-commerce / Sales'],
      ...tag(gfg('Paytm', 'find anagrams from a list of strings')),
      roles: DE,
      summary: 'Group words that are anagrams of each other, with a deterministic output order.',
      description: md(
        'Group the words in `words` so that anagrams (same letters, same counts, case-sensitive) end up together.',
        '',
        'Return a list of groups. Inside a group keep the words in their original order; order the groups by the position of their **first** word in the input. Duplicated words stay duplicated.',
        '',
        '```',
        '["ate", "tea", "bat", "eat", "tab"]   →   [["ate", "tea", "eat"], ["bat", "tab"]]',
        '```',
      ),
      hints: [
        "Anagrams share the same sorted letters: `''.join(sorted(word))` is a canonical key.",
        'A dict from key → list of words keeps both orders for free (dicts are insertion-ordered).',
      ],
      entry: 'group_anagrams',
      signature: 'group_anagrams(words: list[str]) -> list[list[str]]',
      solution: code`def group_anagrams(words: list[str]) -> list[list[str]]:
    groups = {}
    for word in words:
        groups.setdefault("".join(sorted(word)), []).append(word)
    return list(groups.values())
`,
      explanation: md(
        'The canonical-key trick turns "are these related?" into "do these have the same key?", which a dict answers in O(1). Sorting each word costs O(k log k), so the total is O(n · k log k). A 26-slot count tuple as the key makes it O(n · k).',
      ),
      tests: [
        ex('Example', ['ate', 'tea', 'bat', 'eat', 'tab']),
        ex('No anagrams', ['a', 'b']),
        hid('Empty list', []),
        hid('Duplicates stay', ['ab', 'ba', 'ab']),
        hid('Case-sensitive', ['Ab', 'bA', 'ab']),
        hid('Empty strings group together', ['', 'x', '']),
      ],
    }),

    python({
      id: 'word-census',
      title: 'Word Census',
      difficulty: 'Easy',
      topics: ['Strings', 'Hash Maps & Counting'],
      patterns: ['Counting with a dict'],
      domains: ['Search & text'],
      ...tag(ddp('Notion', 'The Word Census')),
      roles: DE_DA,
      summary: 'Count how often each word appears in a document, ignoring case and surrounding punctuation.',
      description: md(
        'Return a dict mapping each distinct word of `text` (lowercased) to how many times it appears.',
        '',
        'Words are separated by whitespace; strip any of these characters from the **ends** of each word: `.,!?;:"()` — and skip words that become empty.',
        '',
        '```',
        '"The plan. The PLAN!"   →   {"the": 2, "plan": 2}',
        '```',
      ),
      hints: ['`word.strip(\'.,!?;:"()\')` removes punctuation from both ends only.', '`collections.Counter` or `dict.get(word, 0) + 1` both work.'],
      entry: 'word_census',
      signature: 'word_census(text: str) -> dict[str, int]',
      solution: code`from collections import Counter

def word_census(text: str) -> dict[str, int]:
    words = (w.strip('.,!?;:"()').lower() for w in text.split())
    return dict(Counter(w for w in words if w))
`,
      explanation: md('A generator feeds `Counter` one cleaned word at a time, so no intermediate list is built. `strip` only trims the ends, which keeps inner punctuation like `"don\'t"` or `"e-mail"` intact.'),
      tests: [
        ex('Example', 'The plan. The PLAN!'),
        ex('One word', 'hello'),
        hid('Empty text', ''),
        hid('Inner punctuation is kept', "Don't stop; don't."),
        hid('Punctuation-only tokens are skipped', 'a ... ! b ?'),
      ],
    }),

    python({
      id: 'top-k-words',
      title: 'Top K Words with Alphabetical Ties',
      difficulty: 'Medium',
      topics: ['Strings', 'Hash Maps & Counting', 'Sorting'],
      patterns: ['Count, then sort by a composite key'],
      domains: ['Search & text'],
      ...tag(ddp('LinkedIn', 'The Top Words'), dev('ByteDance', 'top-k tags with lexicographic tie-breaks')),
      roles: DE_DA,
      summary: 'Return the k most frequent words, breaking ties alphabetically.',
      description: md(
        'Split `text` on whitespace (words are case-sensitive, no cleaning) and return the `k` most frequent words as `[word, count]` pairs.',
        '',
        'Order by count **descending**, then word **ascending**. If there are fewer than `k` distinct words, return them all.',
        '',
        '```',
        '"b a c a b a", k = 2   →   [["a", 3], ["b", 2]]',
        '```',
      ),
      hints: [
        'Sort the `Counter` items with `key=lambda kv: (-kv[1], kv[0])` — negating the count gives descending counts with ascending words.',
        '`Counter.most_common(k)` breaks ties by first-seen order, not alphabetically, so it is not enough on its own.',
      ],
      entry: 'top_k_words',
      signature: 'top_k_words(text: str, k: int) -> list[list]',
      solution: code`from collections import Counter

def top_k_words(text: str, k: int) -> list[list]:
    counts = Counter(text.split())
    ranked = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    return [[w, n] for w, n in ranked[:k]]
`,
      explanation: md(
        'The composite sort key `(-count, word)` expresses both orderings in one sort. Sorting all distinct words is O(m log m); for a huge vocabulary and small `k`, `heapq.nsmallest(k, items, key=...)` is O(m log k).',
      ),
      tests: [
        ex('Example', 'b a c a b a', 2),
        ex('Ties broken alphabetically', 'x y z', 2),
        hid('k larger than vocabulary', 'one two two', 10),
        hid('Empty text', '', 3),
        hid('Case-sensitive words', 'Go go GO go', 2),
        hid('k = 0', 'a a', 0),
      ],
    }),

    python({
      id: 'collapse-repeated-pings',
      title: 'Collapse Repeated Status Pings',
      difficulty: 'Easy',
      topics: ['Lists & Tuples', 'Collections & itertools'],
      patterns: ['Run-length encoding'],
      domains: ['Payments', 'IoT / Telemetry'],
      ...tag(ddp('VISA', 'Twice on the Wire')),
      roles: DE,
      summary: 'Turn a stream of status pings into runs of [status, how many times in a row].',
      description: md(
        'A card terminal retransmits its status whenever an acknowledgement is lost, so the raw stream repeats the same status back to back.',
        '',
        'Collapse each run of **consecutive** identical statuses into `[status, run_length]`, in stream order. The same status can appear in several runs.',
        '',
        '```',
        '["OK", "OK", "BUSY", "OK"]   →   [["OK", 2], ["BUSY", 1], ["OK", 1]]',
        '```',
      ),
      hints: ['`itertools.groupby` groups **consecutive** equal items — exactly a run.', 'Without it: compare each item to the previous one and either bump the last count or start a new run.'],
      entry: 'collapse_runs',
      signature: 'collapse_runs(pings: list[str]) -> list[list]',
      solution: code`from itertools import groupby

def collapse_runs(pings: list[str]) -> list[list]:
    return [[status, sum(1 for _ in run)] for status, run in groupby(pings)]
`,
      explanation: md('`groupby` only merges neighbours, which is the point here: a status that comes back later starts a new run. (It is also why `groupby` usually needs sorted input when you want one group per key.)'),
      tests: [
        ex('Example', ['OK', 'OK', 'BUSY', 'OK']),
        ex('No repeats', ['A', 'B', 'C']),
        hid('Empty stream', []),
        hid('One long run', ['OK', 'OK', 'OK', 'OK']),
        hid('Alternating', ['A', 'A', 'B', 'B', 'A', 'A']),
      ],
    }),

    python({
      id: 'largest-odd-prefix',
      title: 'Largest Odd Number in a Digit String',
      difficulty: 'Easy',
      topics: ['Strings'],
      patterns: ['Scan from the right'],
      domains: ['Finance'],
      ...tag(dev('Intuit', 'largest odd-number substring')),
      roles: DE,
      summary: 'Find the largest odd number that is a contiguous piece of a long digit string.',
      description: md(
        '`digits` is a string of decimal digits with no leading zeros (it may be empty). Return the **largest odd number** that appears as a contiguous substring, as a string, or `""` if there is none.',
        '',
        '```',
        '"52468"   →   "5"',
        '"35427"   →   "35427"',
        '```',
      ),
      hints: [
        'A number is odd when its last digit is odd, and the longest candidate always wins because there are no leading zeros.',
        'So the answer is a prefix: cut the string just after the **last** odd digit.',
      ],
      entry: 'largest_odd',
      signature: 'largest_odd(digits: str) -> str',
      solution: code`def largest_odd(digits: str) -> str:
    for i in range(len(digits) - 1, -1, -1):
        if int(digits[i]) % 2 == 1:
            return digits[: i + 1]
    return ""
`,
      explanation: md('Any odd substring ends at an odd digit; starting it at index 0 makes it as long — and therefore as large — as possible. So scan from the right for the last odd digit: O(n), no big-integer conversion needed.'),
      tests: [
        ex('Example', '52468'),
        ex('Whole string is odd', '35427'),
        hid('No odd digits', '2468'),
        hid('Empty string', ''),
        hid('Odd digit in the middle', '10350'),
      ],
    }),

    python({
      id: 'centered-banner',
      title: 'Centered Text Banner',
      difficulty: 'Easy',
      topics: ['Strings'],
      patterns: ['Padding and alignment'],
      domains: ['Reporting'],
      ...tag(dev('Rivian', 'centered display generator')),
      roles: DE,
      summary: 'Render lines of text centred inside a box, with an exact rule for odd padding.',
      description: md(
        'Render `lines` inside a box. The inner width is the longest line plus `padding` spaces on each side. Each row is `|` + the centred line + `|`, and the box has a top and bottom border of `+`, `-` × width, `+`.',
        '',
        'When a line cannot be centred exactly, the **extra space goes on the right**. Return the rows as a list of strings.',
        '',
        '```',
        'lines = ["ETL", "done"], padding = 1',
        '+------+',
        '| ETL  |',
        '| done |',
        '+------+',
        '```',
      ),
      hints: [
        'Compute `width = max(len(line)) + 2 * padding`.',
        "Left padding is `(width - len(line)) // 2`; the rest goes right. (`str.center` puts the odd space on either side depending on the lengths, so it doesn't match this rule.)",
      ],
      entry: 'banner',
      signature: 'banner(lines: list[str], padding: int) -> list[str]',
      solution: code`def banner(lines: list[str], padding: int) -> list[str]:
    width = max((len(line) for line in lines), default=0) + 2 * padding
    border = "+" + "-" * width + "+"
    rows = [border]
    for line in lines:
        left = (width - len(line)) // 2
        rows.append("|" + " " * left + line + " " * (width - len(line) - left) + "|")
    rows.append(border)
    return rows
`,
      explanation: md('Computing the left padding with floor division makes the odd space land on the right every time. `max(..., default=0)` handles an empty list without a special case.'),
      tests: [
        ex('Example', ['ETL', 'done'], 1),
        ex('Even split', ['ab', 'abcd'], 0),
        hid('No lines', [], 2),
        hid('Empty line', ['', 'x'], 1),
        hid('Wide padding', ['data'], 3),
      ],
    }),

    python({
      id: 'validate-ipv4',
      title: 'Validate an IPv4 Address',
      difficulty: 'Medium',
      topics: ['Strings', 'Parsing (CSV / JSON)'],
      patterns: ['Split and validate each field'],
      domains: ['Networking / Security'],
      ...tag(dev('Figma', 'IPv4 address validator')),
      roles: DE,
      summary: 'Decide whether a string is a valid dotted-quad IPv4 address — leading zeros and all.',
      description: md(
        'Return `True` if `addr` is a valid IPv4 address:',
        '',
        '- exactly four parts separated by dots;',
        '- every part is 1–3 ASCII digits (no signs, spaces or other characters);',
        '- every part is between 0 and 255;',
        '- no leading zeros — `"0"` is fine, `"01"` is not.',
      ),
      hints: [
        "`addr.split('.')` must give exactly 4 pieces — `'1.2.3.'` gives an empty last piece.",
        "`str.isdigit()` accepts some non-ASCII digits (like '²'); check `ch in '0123456789'` instead.",
      ],
      entry: 'is_valid_ipv4',
      signature: 'is_valid_ipv4(addr: str) -> bool',
      solution: code`def is_valid_ipv4(addr: str) -> bool:
    parts = addr.split(".")
    if len(parts) != 4:
        return False
    for part in parts:
        if not 1 <= len(part) <= 3 or any(ch not in "0123456789" for ch in part):
            return False
        if part != "0" and part.startswith("0"):
            return False
        if int(part) > 255:
            return False
    return True
`,
      explanation: md(
        'Each rule is its own check, applied in an order where later checks can rely on earlier ones (`int(part)` is only reached for 1–3 ASCII digits).',
        '',
        'Traps: empty parts from stray dots, leading zeros, `" 1"` with a space (`int()` would accept it), and Unicode digits that `isdigit()` accepts but `int()` may not.',
      ),
      tests: [
        ex('Valid address', '192.168.0.1'),
        ex('Leading zero', '10.01.0.1'),
        hid('Out of range', '256.1.1.1'),
        hid('Too few parts', '1.2.3'),
        hid('Trailing dot', '1.2.3.4.'),
        hid('Space inside', '1.2. 3.4'),
        hid('Zeros are fine', '0.0.0.0'),
        hid('Superscript digit', '1.2.3.²'),
      ],
    }),

    python({
      id: 'roman-to-integer',
      title: 'Roman Numerals to Integers',
      difficulty: 'Easy',
      topics: ['Strings', 'Dicts & Sets'],
      patterns: ['Look-ahead scan'],
      domains: ['Publishing'],
      ...tag(dlp('Palantir', 'Roman to Integer')),
      roles: DE,
      summary: 'Convert chapter numbers written in Roman numerals into integers.',
      description: md(
        'Convert a valid Roman numeral (1–3999) to an integer. Symbols are I=1, V=5, X=10, L=50, C=100, D=500, M=1000; a smaller symbol **before** a larger one is subtracted (IV = 4, CM = 900).',
      ),
      hints: ['Walk left to right; if the current symbol is smaller than the next one, subtract it, otherwise add it.'],
      entry: 'roman_to_int',
      signature: 'roman_to_int(numeral: str) -> int',
      solution: code`VALUES = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}

def roman_to_int(numeral: str) -> int:
    total = 0
    for i, ch in enumerate(numeral):
        value = VALUES[ch]
        if i + 1 < len(numeral) and value < VALUES[numeral[i + 1]]:
            total -= value
        else:
            total += value
    return total
`,
      explanation: md('One look-ahead decides the sign of every symbol, so there is no need to list the six subtractive pairs. O(n) with a constant-size dict.'),
      tests: [
        ex('Example', 'MCMXCIV'),
        ex('Simple', 'III'),
        hid('Subtractive four', 'IV'),
        hid('Largest', 'MMMCMXCIX'),
        hid('Forty-nine', 'XLIX'),
      ],
    }),

    python({
      id: 'integer-to-roman',
      title: 'Integers to Roman Numerals',
      difficulty: 'Medium',
      topics: ['Strings', 'Math & Bits'],
      patterns: ['Greedy by descending value'],
      domains: ['Publishing'],
      ...tag(dlp('Palantir', 'Integer to Roman')),
      roles: DE,
      summary: 'Write an integer from 1 to 3999 as a Roman numeral using the subtractive forms.',
      description: md('Convert `n` (1 ≤ n ≤ 3999) to its standard Roman numeral, using the subtractive forms IV, IX, XL, XC, CD and CM.'),
      hints: ['Put the 13 values (including the six subtractive pairs) in descending order and greedily take the largest that still fits.'],
      entry: 'int_to_roman',
      signature: 'int_to_roman(n: int) -> str',
      solution: code`PAIRS = [(1000, "M"), (900, "CM"), (500, "D"), (400, "CD"), (100, "C"), (90, "XC"),
         (50, "L"), (40, "XL"), (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")]

def int_to_roman(n: int) -> str:
    out = []
    for value, symbol in PAIRS:
        count, n = divmod(n, value)
        out.append(symbol * count)
    return "".join(out)
`,
      explanation: md('Including the subtractive pairs in the table makes the greedy choice always correct. `divmod` takes as many copies of a symbol as fit in one step; at most 13 iterations, so O(1).'),
      tests: [
        ex('Example', 1994),
        ex('Small', 3),
        hid('Largest', 3999),
        hid('Fourteen', 14),
        hid('Hundreds', 400),
      ],
    }),

    python({
      id: 'base-13-conversion',
      title: 'Write a Number in Base 13',
      difficulty: 'Easy',
      topics: ['Math & Bits', 'Strings'],
      patterns: ['Repeated division'],
      domains: ['Finance'],
      ...tag(dlp('Capital One', 'Base 13 Conversion')),
      roles: DE,
      summary: 'Convert an integer — possibly negative — into a base-13 string.',
      description: md(
        'Return `n` written in base 13 using the digits `0123456789ABC`. Negative numbers get a leading `-`; zero is `"0"`.',
        '',
        '```',
        '2024  →  "BC9"      (11·169 + 12·13 + 9)',
        '```',
      ),
      hints: ['Peel off digits with `divmod(n, 13)` until n is 0, then reverse them.', 'Handle the sign once, up front, and work with `abs(n)`.'],
      entry: 'to_base13',
      signature: 'to_base13(n: int) -> str',
      solution: code`DIGITS = "0123456789ABC"

def to_base13(n: int) -> str:
    if n == 0:
        return "0"
    sign, n = ("-" if n < 0 else ""), abs(n)
    out = []
    while n:
        n, d = divmod(n, 13)
        out.append(DIGITS[d])
    return sign + "".join(reversed(out))
`,
      explanation: md('Repeated division yields the digits least-significant first, so reverse at the end. Dealing with the sign separately avoids Python\'s floor-division surprises on negatives (`-7 // 13 == -1`).'),
      tests: [
        ex('Example', 2024),
        ex('Single digit', 12),
        hid('Zero', 0),
        hid('Negative', -14),
        hid('Power of the base', 169),
      ],
    }),

    python({
      id: 'number-to-words',
      title: 'Spell Out an Amount in Words',
      difficulty: 'Medium',
      topics: ['Strings', 'Recursion'],
      patterns: ['Divide into place-value chunks'],
      domains: ['Finance'],
      ...tag(dlp('Tesla', 'Counting Letters In Numbers')),
      roles: DE,
      summary: 'Spell an integer from 0 to 999,999 in American English, as cheques do.',
      description: md(
        'Return `n` (0 ≤ n ≤ 999 999) spelled in lowercase American English: no "and", hyphens between tens and units, single spaces elsewhere.',
        '',
        '```',
        '0        →  "zero"',
        '342      →  "three hundred forty-two"',
        '120015   →  "one hundred twenty thousand fifteen"',
        '```',
      ),
      hints: [
        'Solve 0–99 with two lookup lists (ones/teens and tens), then 100–999 as "<x> hundred <rest>".',
        'Thousands are just "<0–999> thousand <0–999>", reusing the same function.',
      ],
      entry: 'spell',
      signature: 'spell(n: int) -> str',
      solution: code`ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
        "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"]
TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]

def _below_thousand(n):
    words = []
    hundreds, rest = divmod(n, 100)
    if hundreds:
        words.append(ONES[hundreds] + " hundred")
    if rest >= 20:
        tens, ones = divmod(rest, 10)
        words.append(TENS[tens] + ("-" + ONES[ones] if ones else ""))
    elif rest:
        words.append(ONES[rest])
    return " ".join(words)

def spell(n: int) -> str:
    if n == 0:
        return "zero"
    thousands, rest = divmod(n, 1000)
    parts = []
    if thousands:
        parts.append(_below_thousand(thousands) + " thousand")
    if rest:
        parts.append(_below_thousand(rest))
    return " ".join(parts)
`,
      explanation: md('Break the number into place-value chunks and spell each chunk with the same helper. "zero" only appears for 0 itself — inside a larger number an empty chunk contributes nothing, which is why the helper never emits it.'),
      tests: [
        ex('Example', 342),
        ex('Zero', 0),
        hid('Thousands with teens', 120015),
        hid('Round thousands', 7000),
        hid('Largest', 999999),
        hid('Exact tens', 90),
      ],
    }),

    python({
      id: 'mask-except-character',
      title: 'Mask Everything Except One Character',
      difficulty: 'Easy',
      topics: ['Lists & Tuples', 'Comprehensions'],
      patterns: ['Conditional expression in a comprehension'],
      domains: ['Privacy / PII'],
      ...tag(jpm('replace all characters in a list except a given character'), gfg('Virtusa', 'basics of Python lists and loops')),
      roles: DE,
      summary: 'Replace every item of a character list with a mask, except occurrences of one character.',
      description: md(
        'Return a **new** list where every element of `chars` that is not equal to `keep` is replaced by `mask`. The input list must not be modified.',
        '',
        '```',
        '["4", "-", "1", "-", "9"], keep="-", mask="*"   →   ["*", "-", "*", "-", "*"]',
        '```',
      ),
      hints: ['A conditional expression inside a list comprehension: `[x if cond else y for x in items]`.'],
      entry: 'mask_except',
      signature: 'mask_except(chars: list[str], keep: str, mask: str) -> list[str]',
      solution: code`def mask_except(chars: list[str], keep: str, mask: str) -> list[str]:
    return [ch if ch == keep else mask for ch in chars]
`,
      explanation: md('`x if cond else y` is an **expression**, so it goes before the `for`; a filtering `if` goes after the `for` and would drop items instead of replacing them.'),
      tests: [
        ex('Example', ['4', '-', '1', '-', '9'], '-', '*'),
        ex('Nothing kept', ['a', 'b'], 'z', '#'),
        hid('Empty list', [], 'a', '*'),
        hid('Everything kept', ['x', 'x'], 'x', '*'),
        hid('Case-sensitive', ['A', 'a'], 'a', '?'),
      ],
    }),

    python({
      id: 'number-the-lines',
      title: 'Number the Non-Blank Lines',
      difficulty: 'Easy',
      topics: ['Strings', 'Lists & Tuples'],
      patterns: ['enumerate with a start'],
      domains: ['Reporting'],
      roles: DE,
      summary: 'Drop blank lines and number the rest, starting from any number, with aligned numbers.',
      description: md(
        'Return the non-blank lines of `lines` (a line is blank if it is empty or only whitespace) prefixed with their number, starting at `start`.',
        '',
        'Numbers are right-aligned to the width of the **largest** number, then `": "`, then the line unchanged.',
        '',
        '```',
        'lines = ["select", "", "from t"], start = 9',
        '→ [" 9: select", "10: from t"]',
        '```',
      ),
      hints: [
        'Filter first, then `enumerate(kept, start=start)` numbers only what you keep.',
        "The widest number is the last one: `len(str(start + len(kept) - 1))`; an f-string `f'{n:>{w}}'` right-aligns.",
      ],
      entry: 'number_lines',
      signature: 'number_lines(lines: list[str], start: int) -> list[str]',
      solution: code`def number_lines(lines: list[str], start: int) -> list[str]:
    kept = [line for line in lines if line.strip()]
    width = len(str(start + len(kept) - 1)) if kept else 0
    return [f"{n:>{width}}: {line}" for n, line in enumerate(kept, start=start)]
`,
      explanation: md('`enumerate` takes a `start` argument — no manual counter needed. Filtering before enumerating keeps the numbering continuous; enumerating first would leave gaps where blank lines were.'),
      tests: [
        ex('Example', ['select', '', 'from t'], 9),
        ex('From one', ['a', 'b'], 1),
        hid('Only blanks', ['', '   ', '\t'], 1),
        hid('Whitespace inside is kept', ['  indented  '], 5),
        hid('Crossing into three digits', ['a', 'b', 'c'], 98),
      ],
    }),

    python({
      id: 'common-directory-prefix',
      title: 'Common Directory of Many Paths',
      difficulty: 'Medium',
      topics: ['Strings', 'Lists & Tuples'],
      patterns: ['Compare by segments, not characters'],
      domains: ['Data lake / Storage'],
      roles: DE,
      summary: 'Find the deepest directory shared by a list of file paths — by path segment, not by character.',
      description: md(
        'Given absolute POSIX file paths, return their deepest **common directory**. Compare whole segments: `/data/raw1/a` and `/data/raw2/b` share `/data`, not `/data/raw`.',
        '',
        'The last segment of each path is a file name and is never part of the answer. Return `"/"` when only the root is shared, and `""` for an empty list.',
        '',
        '```',
        '["/lake/raw/2024/a.csv", "/lake/raw/2025/b.csv"]   →   "/lake/raw"',
        '```',
      ),
      hints: [
        "Split each path into directory segments: `path.split('/')[1:-1]`.",
        '`zip(*segment_lists)` walks all paths in lockstep; stop at the first position where the segments differ.',
      ],
      entry: 'common_dir',
      signature: 'common_dir(paths: list[str]) -> str',
      solution: code`def common_dir(paths: list[str]) -> str:
    if not paths:
        return ""
    dirs = [p.split("/")[1:-1] for p in paths]
    common = []
    for segments in zip(*dirs):
        if len(set(segments)) != 1:
            break
        common.append(segments[0])
    return "/" + "/".join(common)
`,
      explanation: md(
        'Character-wise prefixes (`os.path.commonprefix`) give wrong directories like `/data/raw` for `raw1` and `raw2`. Splitting into segments and zipping them compares like with like; `zip` stops at the shortest path automatically.',
      ),
      tests: [
        ex('Example', ['/lake/raw/2024/a.csv', '/lake/raw/2025/b.csv']),
        ex('Similar names are different directories', ['/data/raw1/a', '/data/raw2/b']),
        hid('Only the root is shared', ['/a/x', '/b/y']),
        hid('Single path', ['/srv/logs/app.log']),
        hid('Empty list', []),
        hid('One path is shallower', ['/lake/a.csv', '/lake/raw/b.csv']),
      ],
    }),
  ],
};
