// DSA pack 06 — recursion & backtracking: subset sums, subsets with
// duplicates, combination sums (reuse / once each / k numbers), permutations,
// k-th permutation, palindrome partitioning, N-Queens, Sudoku, graph
// colouring, maze paths, phone keypad, balanced parentheses, word search,
// and expression operators.
import { dsa, md, code, ex, hid } from './define.js';

const BT = ['Recursion & Backtracking'];

export default {
  problems: [
    dsa({
      id: 'dsa-all-subset-sums',
      title: 'Every Subset Sum, Sorted',
      difficulty: 'Easy',
      topics: BT,
      patterns: ['Include / exclude recursion'],
      summary: 'Sums of all 2^n subsets (including the empty one), ascending.',
      description: md('Return the sums of all `2^n` subsets of `nums` (as a multiset), sorted ascending.'),
      hints: ['At each index choose to take or skip it; record the running sum at the end.'],
      signature: 'subset_sums(nums: list[int]) -> list[int]',
      solution: code`def subset_sums(nums: list[int]) -> list[int]:
    out = []

    def go(i, total):
        if i == len(nums):
            out.append(total)
            return
        go(i + 1, total + nums[i])
        go(i + 1, total)

    go(0, 0)
    return sorted(out)
`,
      explanation: md('The recursion tree has 2^n leaves, one per subset: O(2^n) time — the baseline for meet-in-the-middle and DP over subsets.'),
      tests: [
        ex('Example', [2, 3]),
        ex('Three values', [5, 2, 1]),
        hid('Empty', []),
        hid('Duplicates', [1, 1, 2]),
      ],
    }),

    dsa({
      id: 'dsa-unique-subsets',
      title: 'All Distinct Subsets When Values Repeat',
      difficulty: 'Medium',
      topics: BT,
      patterns: ['Skip duplicates at the same depth'],
      summary: 'Every unique subset of a multiset, in a canonical order.',
      description: md('Return all distinct subsets of `nums` (which may contain duplicates). Each subset is sorted ascending; return the list sorted lexicographically.'),
      hints: ['Sort first; in the loop, skip nums[j] when j > start and nums[j] == nums[j − 1].'],
      signature: 'unique_subsets(nums: list[int]) -> list[list[int]]',
      solution: code`def unique_subsets(nums: list[int]) -> list[list[int]]:
    a, out = sorted(nums), []

    def go(start, path):
        out.append(path[:])
        for j in range(start, len(a)):
            if j > start and a[j] == a[j - 1]:
                continue
            path.append(a[j])
            go(j + 1, path)
            path.pop()

    go(0, [])
    return sorted(out)
`,
      explanation: md('Choosing "which element comes next" instead of include/exclude lets a single skip rule remove duplicate branches without a set.'),
      tests: [
        ex('Example', [1, 2, 2]),
        ex('Single', [0]),
        hid('All equal', [3, 3, 3]),
        hid('Unsorted input', [4, 1, 4]),
      ],
    }),

    dsa({
      id: 'dsa-combination-sum-reuse',
      title: 'Coin Combinations That Hit a Target (Reuse Allowed)',
      difficulty: 'Medium',
      topics: BT,
      patterns: ['Backtracking with reuse'],
      summary: 'All unique combinations of candidates (each usable many times) summing to the target.',
      description: md('`candidates` are distinct positive integers. Return all unique combinations (each sorted ascending, the list sorted) whose sum is `target`; a candidate may be used any number of times.'),
      hints: ['Recurse with the same index after taking a candidate; stop when the remainder goes negative.'],
      signature: 'combination_sum(candidates: list[int], target: int) -> list[list[int]]',
      solution: code`def combination_sum(candidates: list[int], target: int) -> list[list[int]]:
    c, out = sorted(candidates), []

    def go(i, remain, path):
        if remain == 0:
            out.append(path[:])
            return
        for j in range(i, len(c)):
            if c[j] > remain:
                break
            path.append(c[j])
            go(j, remain - c[j], path)
            path.pop()

    go(0, target, [])
    return out
`,
      explanation: md('Starting each level at the current index prevents permutations of the same multiset; sorting allows an early break.'),
      tests: [
        ex('Example', [2, 3, 6, 7], 7),
        ex('Several', [2, 3, 5], 8),
        hid('Impossible', [2], 1),
        hid('Zero target', [1, 2], 0),
      ],
    }),

    dsa({
      id: 'dsa-combination-sum-once',
      title: 'Combinations Using Each Item at Most Once',
      difficulty: 'Medium',
      topics: BT,
      patterns: ['Skip duplicates at the same depth'],
      summary: 'Unique combinations summing to the target where every element is used once.',
      description: md('`candidates` may contain duplicates. Return unique combinations (sorted, list sorted) that sum to `target`, using each element at most once.'),
      hints: ['Sort, recurse with j + 1, and skip equal values at the same depth.'],
      signature: 'combination_sum_once(candidates: list[int], target: int) -> list[list[int]]',
      solution: code`def combination_sum_once(candidates: list[int], target: int) -> list[list[int]]:
    c, out = sorted(candidates), []

    def go(i, remain, path):
        if remain == 0:
            out.append(path[:])
            return
        for j in range(i, len(c)):
            if j > i and c[j] == c[j - 1]:
                continue
            if c[j] > remain:
                break
            path.append(c[j])
            go(j + 1, remain - c[j], path)
            path.pop()

    go(0, target, [])
    return out
`,
      explanation: md('Same skeleton as unique subsets with a sum constraint and pruning.'),
      tests: [
        ex('Example', [10, 1, 2, 7, 6, 1, 5], 8),
        ex('Another', [2, 5, 2, 1, 2], 5),
        hid('None', [3, 4], 2),
        hid('All ones', [1, 1, 1, 1], 2),
      ],
    }),

    dsa({
      id: 'dsa-k-digits-sum',
      title: 'Pick k Different Digits Adding Up to n',
      difficulty: 'Medium',
      topics: BT,
      patterns: ['Bounded backtracking'],
      summary: 'All sets of k distinct digits 1–9 that sum to n.',
      description: md('Return all combinations of exactly `k` distinct numbers from 1 to 9 whose sum is `n`, each ascending, in lexicographic order.'),
      hints: ['Recurse over the next digit to try, pruning when the sum is exceeded.'],
      signature: 'k_digit_sum(k: int, n: int) -> list[list[int]]',
      solution: code`def k_digit_sum(k: int, n: int) -> list[list[int]]:
    out = []

    def go(start, remain, path):
        if len(path) == k:
            if remain == 0:
                out.append(path[:])
            return
        for d in range(start, 10):
            if d > remain:
                break
            path.append(d)
            go(d + 1, remain - d, path)
            path.pop()

    go(1, n, [])
    return out
`,
      explanation: md('The search space is tiny (C(9, k)), but pruning by remaining sum keeps it smaller still.'),
      tests: [
        ex('Example', 3, 7),
        ex('Several', 3, 9),
        hid('Impossible', 4, 1),
        hid('All nine digits', 9, 45),
      ],
    }),

    dsa({
      id: 'dsa-all-orderings',
      title: 'All Orderings of Distinct Items',
      difficulty: 'Medium',
      topics: BT,
      patterns: ['Swap-based permutation'],
      summary: 'Generate every permutation, in lexicographic order of positions.',
      description: md('Return all permutations of the distinct integers in `nums`, sorted lexicographically. Generate them yourself (no `itertools`).'),
      hints: ['Build with a "used" array, or swap each candidate into position i and recurse.'],
      signature: 'permutations(nums: list[int]) -> list[list[int]]',
      solution: code`def permutations(nums: list[int]) -> list[list[int]]:
    a, out = sorted(nums), []
    used = [False] * len(a)

    def go(path):
        if len(path) == len(a):
            out.append(path[:])
            return
        for i, x in enumerate(a):
            if not used[i]:
                used[i] = True
                path.append(x)
                go(path)
                path.pop()
                used[i] = False

    go([])
    return out
`,
      explanation: md('n! leaves, each of length n: O(n · n!). Iterating candidates in sorted order yields lexicographic output directly.'),
      tests: [
        ex('Example', [1, 2, 3]),
        ex('Two', [0, 1]),
        hid('Single', [1]),
        hid('Unsorted', [3, 1, 2]),
      ],
    }),

    dsa({
      id: 'dsa-kth-permutation',
      title: 'Jump Straight to the k-th Permutation',
      difficulty: 'Hard',
      topics: BT,
      patterns: ['Factorial number system'],
      summary: 'The k-th (1-based) permutation of 1..n without generating the others.',
      description: md('Return the k-th permutation (1-based, lexicographic) of the digits `1..n` as a string.'),
      hints: ['There are (n−1)! permutations per leading digit: index = (k−1) // (n−1)!.'],
      signature: 'kth_permutation(n: int, k: int) -> str',
      solution: code`from math import factorial

def kth_permutation(n: int, k: int) -> str:
    digits = [str(d) for d in range(1, n + 1)]
    k -= 1
    out = []
    for i in range(n, 0, -1):
        block = factorial(i - 1)
        idx, k = divmod(k, block)
        out.append(digits.pop(idx))
    return "".join(out)
`,
      explanation: md('Writing k − 1 in the factorial base picks each next digit directly: O(n²) with list pops instead of O(n!).'),
      tests: [
        ex('Example', 3, 3),
        ex('Another', 4, 9),
        hid('First', 3, 1),
        hid('Last', 4, 24),
      ],
    }),

    dsa({
      id: 'dsa-palindrome-partitions',
      title: 'Cut a String into Palindromes Every Possible Way',
      difficulty: 'Medium',
      topics: BT,
      patterns: ['Backtracking over cut points'],
      summary: 'All ways to split a string so that every piece is a palindrome.',
      description: md('Return all partitions of `s` into palindromic pieces, in the order produced by trying shorter first pieces first.'),
      hints: ['At index i try every end j where s[i:j] is a palindrome, recurse from j.'],
      signature: 'palindrome_partitions(s: str) -> list[list[str]]',
      solution: code`def palindrome_partitions(s: str) -> list[list[str]]:
    out = []

    def go(i, path):
        if i == len(s):
            out.append(path[:])
            return
        for j in range(i + 1, len(s) + 1):
            piece = s[i:j]
            if piece == piece[::-1]:
                path.append(piece)
                go(j, path)
                path.pop()

    go(0, [])
    return out
`,
      explanation: md('Exponential output in the worst case ("aaaa…"); precomputing an is-palindrome table avoids re-checking substrings.'),
      tests: [
        ex('Example', 'aab'),
        ex('Single', 'a'),
        hid('All same', 'aaa'),
        hid('Mixed', 'abba'),
      ],
    }),

    dsa({
      id: 'dsa-n-queens',
      title: 'Place n Queens So None Attack Each Other',
      difficulty: 'Hard',
      topics: BT,
      patterns: ['Row-by-row placement with column/diagonal sets'],
      summary: 'Count N-Queens solutions and return the first board.',
      description: md('Return `[count, first_board]` where `count` is the number of ways to place `n` queens on an n×n board with no two attacking, and `first_board` is the first solution found row by row trying columns left to right (as strings of "Q" and ".") or `[]`.'),
      hints: ['Track used columns, r − c diagonals and r + c anti-diagonals in sets.'],
      signature: 'n_queens(n: int) -> list',
      solution: code`def n_queens(n: int) -> list:
    cols, diag, anti = set(), set(), set()
    placement, count, first = [], 0, []

    def go(r):
        nonlocal count, first
        if r == n:
            count += 1
            if not first:
                first = ["".join("Q" if c == q else "." for c in range(n)) for q in placement]
            return
        for c in range(n):
            if c in cols or r - c in diag or r + c in anti:
                continue
            cols.add(c); diag.add(r - c); anti.add(r + c)
            placement.append(c)
            go(r + 1)
            placement.pop()
            cols.discard(c); diag.discard(r - c); anti.discard(r + c)

    go(0)
    return [count, first]
`,
      explanation: md('One queen per row; O(1) conflict checks via three sets. The count grows fast (92 for n = 8); bitmask versions are faster still.'),
      tests: [
        ex('Four', 4),
        ex('One', 1),
        hid('No solution', 3),
        hid('Six', 6),
      ],
    }),

    dsa({
      id: 'dsa-sudoku-solver',
      title: 'Solve a Sudoku',
      difficulty: 'Hard',
      topics: BT,
      patterns: ['Constraint backtracking'],
      summary: 'Fill a 9×9 grid ("." = empty) so every row, column and box has 1–9.',
      description: md('Given 9 strings of 9 characters (digits or `.`), return the solved grid in the same format. Puzzles have exactly one solution.'),
      hints: ['Keep sets of used digits per row, column and box; always fill the empty cell with the fewest options first for speed.'],
      signature: 'solve_sudoku(rows: list[str]) -> list[str]',
      solution: code`def solve_sudoku(rows: list[str]) -> list[str]:
    g = [list(r) for r in rows]
    R = [set() for _ in range(9)]
    C = [set() for _ in range(9)]
    B = [set() for _ in range(9)]
    empty = []
    for i in range(9):
        for j in range(9):
            v = g[i][j]
            if v == ".":
                empty.append((i, j))
            else:
                R[i].add(v); C[j].add(v); B[i // 3 * 3 + j // 3].add(v)

    def go():
        if not empty:
            return True
        best = min(range(len(empty)), key=lambda k: 9 - len(R[empty[k][0]] | C[empty[k][1]] | B[empty[k][0] // 3 * 3 + empty[k][1] // 3]))
        i, j = empty.pop(best)
        b = i // 3 * 3 + j // 3
        for v in "123456789":
            if v not in R[i] and v not in C[j] and v not in B[b]:
                g[i][j] = v
                R[i].add(v); C[j].add(v); B[b].add(v)
                if go():
                    return True
                R[i].discard(v); C[j].discard(v); B[b].discard(v)
        g[i][j] = "."
        empty.insert(best, (i, j))
        return False

    go()
    return ["".join(r) for r in g]
`,
      explanation: md('Backtracking with the "most constrained cell first" heuristic solves typical puzzles in milliseconds; constraint sets make each check O(1).'),
      tests: [
        ex('Example', ['53..7....', '6..195...', '.98....6.', '8...6...3', '4..8.3..1', '7...2...6', '.6....28.', '...419..5', '....8..79']),
        hid('Harder', ['..9748...', '7........', '.2.1.9...', '..7...24.', '.64.1.59.', '.98...3..', '...8.3.2.', '........6', '...2759..']),
        hid('Nearly solved', ['534678912', '672195348', '198342567', '859761423', '426853791', '713924856', '961537284', '287419635', '34528617.']),
      ],
    }),

    dsa({
      id: 'dsa-graph-colouring',
      title: 'Can the Map Be Coloured with m Colours?',
      difficulty: 'Medium',
      topics: BT,
      patterns: ['Assign-and-check backtracking'],
      summary: 'Decide whether a graph is m-colourable and return a colouring.',
      description: md('Nodes `0..n−1` with undirected `edges`. Return the lexicographically smallest assignment of colours `1..m` (node 0 first) so adjacent nodes differ, or `[]` if impossible.'),
      hints: ['Colour nodes in order; try colours ascending; backtrack on conflict.'],
      signature: 'colour_graph(n: int, edges: list[list[int]], m: int) -> list[int]',
      solution: code`def colour_graph(n: int, edges: list[list[int]], m: int) -> list[int]:
    adj = [[] for _ in range(n)]
    for a, b in edges:
        adj[a].append(b)
        adj[b].append(a)
    colour = [0] * n

    def go(v):
        if v == n:
            return True
        for c in range(1, m + 1):
            if all(colour[u] != c for u in adj[v]):
                colour[v] = c
                if go(v + 1):
                    return True
        colour[v] = 0
        return False

    return colour if go(0) else []
`,
      explanation: md('Graph colouring is NP-complete in general; backtracking explores at most m^n assignments but prunes conflicts immediately.'),
      tests: [
        ex('Triangle with 3', 4, [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2]], 3),
        ex('Triangle with 2', 3, [[0, 1], [1, 2], [0, 2]], 2),
        hid('No edges', 3, [], 1),
        hid('Bipartite square', 4, [[0, 1], [1, 2], [2, 3], [3, 0]], 2),
      ],
    }),

    dsa({
      id: 'dsa-maze-paths',
      title: 'Every Path Out of a Maze',
      difficulty: 'Medium',
      topics: BT,
      patterns: ['Grid DFS with visited marks'],
      summary: 'All routes from the top-left to bottom-right through open cells (D/L/R/U).',
      description: md('`grid` uses 1 for open and 0 for blocked. Return every path from `(0, 0)` to `(n−1, n−1)` that visits no cell twice, as strings of moves `D`, `L`, `R`, `U`, sorted lexicographically.'),
      hints: ['DFS in the order D, L, R, U marks visited cells and unmarks on return.'],
      signature: 'maze_paths(grid: list[list[int]]) -> list[str]',
      solution: code`def maze_paths(grid: list[list[int]]) -> list[str]:
    n = len(grid)
    if not n or grid[0][0] == 0 or grid[n - 1][n - 1] == 0:
        return []
    moves = [("D", 1, 0), ("L", 0, -1), ("R", 0, 1), ("U", -1, 0)]
    seen = [[False] * n for _ in range(n)]
    out = []

    def go(r, c, path):
        if r == n - 1 and c == n - 1:
            out.append("".join(path))
            return
        seen[r][c] = True
        for m, dr, dc in moves:
            nr, nc = r + dr, c + dc
            if 0 <= nr < n and 0 <= nc < n and grid[nr][nc] and not seen[nr][nc]:
                path.append(m)
                go(nr, nc, path)
                path.pop()
        seen[r][c] = False

    go(0, 0, [])
    return sorted(out)
`,
      explanation: md('Exploring in alphabetical move order already yields sorted output; un-marking on return lets other paths reuse a cell.'),
      tests: [
        ex('Example', [[1, 0, 0, 0], [1, 1, 0, 1], [1, 1, 0, 0], [0, 1, 1, 1]]),
        ex('Blocked start', [[0, 1], [1, 1]]),
        hid('Open 2×2', [[1, 1], [1, 1]]),
        hid('Single cell', [[1]]),
      ],
    }),

    dsa({
      id: 'dsa-keypad-words',
      title: 'Letter Combinations from a Phone Keypad',
      difficulty: 'Medium',
      topics: BT,
      patterns: ['Cartesian product by recursion'],
      summary: 'All strings a digit sequence could spell on a classic keypad.',
      description: md('Using 2=abc, 3=def, 4=ghi, 5=jkl, 6=mno, 7=pqrs, 8=tuv, 9=wxyz, return every string the digits could represent, in lexicographic order (empty input → `[]`).'),
      hints: ['Recurse digit by digit, appending each letter.'],
      signature: 'keypad(digits: str) -> list[str]',
      solution: code`KEYS = {"2": "abc", "3": "def", "4": "ghi", "5": "jkl", "6": "mno", "7": "pqrs", "8": "tuv", "9": "wxyz"}

def keypad(digits: str) -> list[str]:
    if not digits:
        return []
    out = []

    def go(i, path):
        if i == len(digits):
            out.append(path)
            return
        for ch in KEYS[digits[i]]:
            go(i + 1, path + ch)

    go(0, "")
    return out
`,
      explanation: md('Up to 4^n results; recursion builds them depth-first in keypad order, which is already lexicographic.'),
      tests: [
        ex('Example', '23'),
        ex('Single', '7'),
        hid('Empty', ''),
        hid('Three digits', '294'),
      ],
    }),

    dsa({
      id: 'dsa-balanced-parens-gen',
      title: 'Generate Every Balanced Bracket String',
      difficulty: 'Medium',
      topics: BT,
      patterns: ['Open/close counters'],
      summary: 'All well-formed strings with n pairs of parentheses.',
      description: md('Return every balanced string of `n` pairs of `()`, in lexicographic order ("(" < ")").'),
      hints: ['Add "(" while opens < n; add ")" while closes < opens.'],
      signature: 'gen_parens(n: int) -> list[str]',
      solution: code`def gen_parens(n: int) -> list[str]:
    out = []

    def go(s, opened, closed):
        if len(s) == 2 * n:
            out.append(s)
            return
        if opened < n:
            go(s + "(", opened + 1, closed)
        if closed < opened:
            go(s + ")", opened, closed + 1)

    go("", 0, 0)
    return out
`,
      explanation: md('The two counters encode the only constraint; the count of results is the n-th Catalan number.'),
      tests: [
        ex('Example', 3),
        ex('One pair', 1),
        hid('Four pairs', 4),
        hid('Zero', 0),
      ],
    }),

    dsa({
      id: 'dsa-word-in-grid',
      title: 'Is the Word Hidden in the Letter Grid?',
      difficulty: 'Medium',
      topics: BT,
      patterns: ['Grid DFS with in-place marking'],
      summary: 'Find words formed by adjacent (non-diagonal) cells without reusing a cell.',
      description: md('For each word return whether it can be traced in `board` through horizontally/vertically adjacent cells, using each cell at most once per word.'),
      hints: ['Start DFS at every matching cell; temporarily overwrite visited cells with "#".'],
      signature: 'words_in_grid(board: list[str], words: list[str]) -> list[bool]',
      solution: code`def words_in_grid(board: list[str], words: list[str]) -> list[bool]:
    g = [list(r) for r in board]
    R, C = len(g), len(g[0]) if g else 0

    def dfs(r, c, word, i):
        if i == len(word):
            return True
        if not (0 <= r < R and 0 <= c < C) or g[r][c] != word[i]:
            return False
        saved, g[r][c] = g[r][c], "#"
        found = any(dfs(r + dr, c + dc, word, i + 1) for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        g[r][c] = saved
        return found

    return [any(dfs(r, c, w, 0) for r in range(R) for c in range(C)) for w in words]
`,
      explanation: md('O(R · C · 4^L) worst case; in-place marking avoids a separate visited set. For many words, a trie over the word list (word search II) shares prefixes.'),
      tests: [
        ex('Example', ['ABCE', 'SFCS', 'ADEE'], ['ABCCED', 'SEE', 'ABCB']),
        ex('Single cell', ['A'], ['A', 'AA']),
        hid('Snake', ['AB', 'DC'], ['ABCD', 'ACBD']),
        hid('Reuse not allowed', ['AA'], ['AAA', 'AA']),
      ],
    }),

    dsa({
      id: 'dsa-insert-operators',
      title: 'Insert + − × Between Digits to Hit a Target',
      difficulty: 'Hard',
      topics: BT,
      patterns: ['Backtracking with last-operand tracking'],
      summary: 'All expressions formed from a digit string that evaluate to the target.',
      description: md('Insert `+`, `-` or `*` between the digits of `num` (or nothing, to join digits) so the expression evaluates to `target`. Numbers may not have leading zeros. Return all such expressions sorted.'),
      hints: ['Track the running value and the last multiplicative term so "*" can undo it: value − last + last * cur.'],
      signature: 'add_operators(num: str, target: int) -> list[str]',
      solution: code`def add_operators(num: str, target: int) -> list[str]:
    out = []

    def go(i, expr, value, last):
        if i == len(num):
            if value == target:
                out.append(expr)
            return
        for j in range(i + 1, len(num) + 1):
            part = num[i:j]
            if len(part) > 1 and part[0] == "0":
                break
            cur = int(part)
            if i == 0:
                go(j, part, cur, cur)
            else:
                go(j, expr + "+" + part, value + cur, cur)
                go(j, expr + "-" + part, value - cur, -cur)
                go(j, expr + "*" + part, value - last + last * cur, last * cur)

    go(0, "", 0, 0)
    return sorted(out)
`,
      explanation: md('Precedence is handled without parsing by remembering the last term; multiplication replaces it. O(4^n) expressions in the worst case.'),
      tests: [
        ex('Example', '123', 6),
        ex('Another', '232', 8),
        hid('Leading zeros', '105', 5),
        hid('None', '3456237490', 9191),
      ],
    }),
  ],
};
