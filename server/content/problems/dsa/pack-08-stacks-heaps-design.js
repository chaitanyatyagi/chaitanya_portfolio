// DSA pack 08 — stacks, queues, monotonic stacks/deques, heaps and design:
// queue-from-stacks, stack-from-queue, min stack, bracket matching, RPN and
// infix→postfix, decode string, next greater (circular) / smaller, daily
// waits, histogram & maximal rectangle, subarray-minimum sums, remove k digits,
// celebrity, sliding-window maximum, LRU and LFU caches, merge k lists,
// k closest points, task cooldowns, max-sum pairs, reorganise string.
import { dsa, md, code, ex, hid } from './define.js';

const OPS_RUN = (cls) => code`def run(ops):
    obj, out = None, []
    for op in ops:
        name, args = op[0], op[1:]
        if name == "new":
            obj = ${cls}(*args)
            out.append(None)
        else:
            out.append(getattr(obj, name)(*args))
    return out`;

export default {
  problems: [
    dsa({
      id: 'dsa-queue-from-two-stacks',
      title: 'Build a Queue Out of Two Stacks',
      difficulty: 'Easy',
      topics: ['Stacks & Queues', 'Design'],
      patterns: ['Lazy transfer (amortised O(1))'],
      summary: 'FIFO push / pop / peek / empty using only list append and pop().',
      description: md('Implement `StackQueue` with `push(x)`, `pop()`, `peek()` and `empty()` using two Python lists used strictly as stacks (`append` / `pop()` / `[-1]`). The tests run a sequence of operations and collect the return values.'),
      hints: ['Push onto `inbox`; when `outbox` is empty, move everything from inbox to outbox. Pop/peek from outbox.'],
      starter: code`class StackQueue:
    def __init__(self):
        pass

    def push(self, x):
        pass

    def pop(self):
        pass

    def peek(self):
        pass

    def empty(self):
        pass
`,
      signature: 'StackQueue',
      runSignature: 'run(ops: list[list]) -> list',
      solution: code`class StackQueue:
    def __init__(self):
        self.inbox, self.outbox = [], []

    def push(self, x):
        self.inbox.append(x)

    def _shift(self):
        if not self.outbox:
            while self.inbox:
                self.outbox.append(self.inbox.pop())

    def pop(self):
        self._shift()
        return self.outbox.pop()

    def peek(self):
        self._shift()
        return self.outbox[-1]

    def empty(self):
        return not self.inbox and not self.outbox
`,
      driver: OPS_RUN('StackQueue'),
      explanation: md('Each element is moved from inbox to outbox at most once, so a sequence of n operations costs O(n): amortised O(1) per operation.'),
      tests: [
        ex('Example', [['new'], ['push', 1], ['push', 2], ['peek'], ['pop'], ['empty']]),
        ex('Interleaved', [['new'], ['push', 1], ['pop'], ['push', 2], ['push', 3], ['pop'], ['empty']]),
        hid('Drain', [['new'], ['push', 5], ['push', 6], ['pop'], ['pop'], ['empty']]),
        hid('Refill after transfer', [['new'], ['push', 1], ['push', 2], ['pop'], ['push', 3], ['pop'], ['pop']]),
      ],
    }),

    dsa({
      id: 'dsa-stack-from-queue',
      title: 'Build a Stack Out of One Queue',
      difficulty: 'Easy',
      topics: ['Stacks & Queues', 'Design'],
      patterns: ['Rotate after push'],
      summary: 'LIFO push / pop / top / empty using a single deque used as a FIFO queue.',
      description: md('Implement `QueueStack` using one `collections.deque`, but only with `append` (enqueue), `popleft` (dequeue), `[0]` and `len`.'),
      hints: ['After appending x, rotate the previous len − 1 elements behind it so x is at the front.'],
      starter: code`from collections import deque

class QueueStack:
    def __init__(self):
        pass

    def push(self, x):
        pass

    def pop(self):
        pass

    def top(self):
        pass

    def empty(self):
        pass
`,
      signature: 'QueueStack',
      runSignature: 'run(ops: list[list]) -> list',
      solution: code`from collections import deque

class QueueStack:
    def __init__(self):
        self.q = deque()

    def push(self, x):
        self.q.append(x)
        for _ in range(len(self.q) - 1):
            self.q.append(self.q.popleft())

    def pop(self):
        return self.q.popleft()

    def top(self):
        return self.q[0]

    def empty(self):
        return len(self.q) == 0
`,
      driver: OPS_RUN('QueueStack'),
      explanation: md('Push is O(n) so pop and top can be O(1); the opposite trade-off (cheap push, expensive pop) also works.'),
      tests: [
        ex('Example', [['new'], ['push', 1], ['push', 2], ['top'], ['pop'], ['empty']]),
        ex('Three', [['new'], ['push', 1], ['push', 2], ['push', 3], ['pop'], ['pop'], ['top']]),
        hid('Empty check', [['new'], ['empty'], ['push', 9], ['empty']]),
        hid('Alternating', [['new'], ['push', 1], ['pop'], ['push', 2], ['top']]),
      ],
    }),

    dsa({
      id: 'dsa-min-stack',
      title: 'A Stack That Knows Its Minimum',
      difficulty: 'Medium',
      topics: ['Stacks & Queues', 'Design'],
      patterns: ['Pair each value with the running min'],
      summary: 'push, pop, top and get_min, all O(1).',
      description: md('Implement `MinStack` with `push(x)`, `pop()` (returns nothing), `top()` and `get_min()`, each in O(1).'),
      hints: ['Store (value, min_so_far) pairs.'],
      starter: code`class MinStack:
    def __init__(self):
        pass

    def push(self, x):
        pass

    def pop(self):
        pass

    def top(self):
        pass

    def get_min(self):
        pass
`,
      signature: 'MinStack',
      runSignature: 'run(ops: list[list]) -> list',
      solution: code`class MinStack:
    def __init__(self):
        self.items = []

    def push(self, x):
        low = min(x, self.items[-1][1]) if self.items else x
        self.items.append((x, low))

    def pop(self):
        self.items.pop()

    def top(self):
        return self.items[-1][0]

    def get_min(self):
        return self.items[-1][1]
`,
      driver: OPS_RUN('MinStack'),
      explanation: md('The minimum of a stack only changes at the top, so caching it per element makes every operation O(1). A space-saving variant encodes 2x − min for new minima.'),
      tests: [
        ex('Example', [['new'], ['push', -2], ['push', 0], ['push', -3], ['get_min'], ['pop'], ['top'], ['get_min']]),
        ex('Duplicates of the min', [['new'], ['push', 1], ['push', 1], ['pop'], ['get_min']]),
        hid('Increasing', [['new'], ['push', 1], ['push', 2], ['push', 3], ['get_min'], ['pop'], ['get_min']]),
        hid('Single', [['new'], ['push', 7], ['top'], ['get_min']]),
      ],
    }),

    dsa({
      id: 'dsa-bracket-matching',
      title: 'Do All Three Bracket Types Match?',
      difficulty: 'Easy',
      topics: ['Stacks & Queues', 'Strings'],
      patterns: ['Stack of expected closers'],
      summary: 'Validate strings with (), [] and {} — and report the first bad index.',
      description: md('For each string return the index of the first character that breaks bracket matching (a closer with no matching opener, or the string length if openers remain unclosed), or −1 if it is balanced. Only `()[]{}` appear.'),
      hints: ['Push openers; on a closer, the top must be its pair.'],
      signature: 'first_bad_bracket(strings: list[str]) -> list[int]',
      solution: code`PAIR = {")": "(", "]": "[", "}": "{"}

def first_bad_bracket(strings: list[str]) -> list[int]:
    out = []
    for s in strings:
        stack, bad = [], -1
        for i, ch in enumerate(s):
            if ch in PAIR:
                if not stack or stack[-1] != PAIR[ch]:
                    bad = i
                    break
                stack.pop()
            else:
                stack.append(ch)
        if bad == -1 and stack:
            bad = len(s)
        out.append(bad)
    return out
`,
      explanation: md('The most recent unmatched opener must close first — exactly LIFO. O(n).'),
      tests: [
        ex('Example', ['()[]{}', '(]', '([)]', '{[]}']),
        ex('Unclosed', ['((']),
        hid('Closer first', [')(', '']),
        hid('Deep', ['{[()()]}', '{[(])}']),
      ],
    }),

    dsa({
      id: 'dsa-eval-rpn',
      title: 'Evaluate a Postfix Expression',
      difficulty: 'Medium',
      topics: ['Stacks & Queues'],
      patterns: ['Operand stack'],
      summary: 'Evaluate reverse Polish notation with + − * / (division truncates toward zero).',
      description: md('Evaluate a list of RPN tokens. Integer division truncates toward zero (so `-7 / 2 = -3`).'),
      hints: ['Pop the right operand first. Truncate with int(a / b).'],
      signature: 'eval_rpn(tokens: list[str]) -> int',
      solution: code`def eval_rpn(tokens: list[str]) -> int:
    st = []
    for t in tokens:
        if t in {"+", "-", "*", "/"}:
            b, a = st.pop(), st.pop()
            if t == "+":
                st.append(a + b)
            elif t == "-":
                st.append(a - b)
            elif t == "*":
                st.append(a * b)
            else:
                st.append(int(a / b))
        else:
            st.append(int(t))
    return st[0]
`,
      explanation: md('Postfix needs no precedence rules or parentheses: each operator applies to the two most recent values. Note Python’s `//` floors, which differs for negatives.'),
      tests: [
        ex('Example', ['2', '1', '+', '3', '*']),
        ex('Division', ['4', '13', '5', '/', '+']),
        hid('Negative truncation', ['-7', '2', '/']),
        hid('Long', ['10', '6', '9', '3', '+', '-11', '*', '/', '*', '17', '+', '5', '+']),
      ],
    }),

    dsa({
      id: 'dsa-infix-to-postfix',
      title: 'Convert Infix to Postfix (Shunting Yard)',
      difficulty: 'Medium',
      topics: ['Stacks & Queues', 'Strings'],
      patterns: ['Operator stack with precedence'],
      summary: 'Turn "a+b*(c^d-e)" into postfix, honouring precedence and right-associative ^.',
      description: md('Operands are single letters or digits; operators are `+ - * / ^` and parentheses. `^` binds tightest and is right-associative; others are left-associative. Return the postfix string.'),
      hints: ['Pop operators of higher precedence (or equal, for left-associative ones) before pushing a new one.'],
      signature: 'to_postfix(expr: str) -> str',
      solution: code`PREC = {"+": 1, "-": 1, "*": 2, "/": 2, "^": 3}

def to_postfix(expr: str) -> str:
    out, ops = [], []
    for ch in expr:
        if ch.isalnum():
            out.append(ch)
        elif ch == "(":
            ops.append(ch)
        elif ch == ")":
            while ops[-1] != "(":
                out.append(ops.pop())
            ops.pop()
        else:
            while ops and ops[-1] != "(" and (PREC[ops[-1]] > PREC[ch] or (PREC[ops[-1]] == PREC[ch] and ch != "^")):
                out.append(ops.pop())
            ops.append(ch)
    while ops:
        out.append(ops.pop())
    return "".join(out)
`,
      explanation: md('Dijkstra’s shunting-yard algorithm: operands stream straight to the output; operators wait on a stack until something of lower precedence arrives. O(n).'),
      tests: [
        ex('Example', 'a+b*(c^d-e)^(f+g*h)-i'),
        ex('Left associative', 'a-b-c'),
        hid('Right associative power', 'a^b^c'),
        hid('Parentheses', '(a+b)*c'),
      ],
    }),

    dsa({
      id: 'dsa-decode-repeats',
      title: 'Expand k[...] Encodings',
      difficulty: 'Medium',
      topics: ['Stacks & Queues', 'Strings'],
      patterns: ['Stack of (prefix, count)'],
      summary: 'Decode "3[a2[c]]" into "accaccacc".',
      description: md('Decode strings where `k[sub]` means `sub` repeated `k` times (k may have several digits; nesting allowed).'),
      hints: ['On "[", push (current string, k) and reset; on "]", pop and set current = prefix + current * k.'],
      signature: 'decode(s: str) -> str',
      solution: code`def decode(s: str) -> str:
    stack, cur, k = [], "", 0
    for ch in s:
        if ch.isdigit():
            k = k * 10 + int(ch)
        elif ch == "[":
            stack.append((cur, k))
            cur, k = "", 0
        elif ch == "]":
            prefix, times = stack.pop()
            cur = prefix + cur * times
        else:
            cur += ch
    return cur
`,
      explanation: md('Each bracket level saves the text before it and its multiplier; closing a level splices the expansion back. Output-linear time.'),
      tests: [
        ex('Example', '3[a]2[bc]'),
        ex('Nested', '3[a2[c]]'),
        hid('Multi-digit', '10[x]'),
        hid('Plain text around', 'ab2[cd]ef'),
      ],
    }),

    dsa({
      id: 'dsa-next-greater-circular',
      title: 'Next Greater Value in a Circular List',
      difficulty: 'Medium',
      topics: ['Monotonic Stack'],
      patterns: ['Two passes over indices'],
      summary: 'For each element, the next greater element wrapping around (−1 if none).',
      description: md('The list is circular. For each element return the first greater value found by walking forward (wrapping), or −1.'),
      hints: ['Iterate i from 2n − 1 down to 0 using i % n, keeping a decreasing stack.'],
      signature: 'next_greater_circular(nums: list[int]) -> list[int]',
      solution: code`def next_greater_circular(nums: list[int]) -> list[int]:
    n = len(nums)
    out, st = [-1] * n, []
    for i in range(2 * n - 1, -1, -1):
        x = nums[i % n]
        while st and st[-1] <= x:
            st.pop()
        if i < n and st:
            out[i] = st[-1]
        st.append(x)
    return out
`,
      explanation: md('Doubling the scan simulates the wrap; the monotonic stack keeps candidates in decreasing order so each is pushed and popped O(1) times. O(n).'),
      tests: [
        ex('Example', [1, 2, 1]),
        ex('Another', [1, 2, 3, 4, 3]),
        hid('All equal', [5, 5, 5]),
        hid('Empty', []),
      ],
    }),

    dsa({
      id: 'dsa-previous-smaller',
      title: 'Nearest Smaller Value to the Left',
      difficulty: 'Easy',
      topics: ['Monotonic Stack'],
      patterns: ['Increasing stack'],
      summary: 'For each element, the closest strictly smaller value before it (−1 if none).',
      description: md('Return, for each index, the value of the nearest element to its left that is strictly smaller, or −1.'),
      hints: ['Pop while the top is ≥ the current value.'],
      signature: 'previous_smaller(nums: list[int]) -> list[int]',
      solution: code`def previous_smaller(nums: list[int]) -> list[int]:
    out, st = [], []
    for x in nums:
        while st and st[-1] >= x:
            st.pop()
        out.append(st[-1] if st else -1)
        st.append(x)
    return out
`,
      explanation: md('A value that is ≥ a later value can never be anyone’s answer afterwards, so it is discarded. O(n).'),
      tests: [
        ex('Example', [4, 5, 2, 10, 8]),
        ex('Decreasing', [3, 2, 1]),
        hid('Duplicates', [2, 2, 3]),
        hid('Empty', []),
      ],
    }),

    dsa({
      id: 'dsa-days-until-warmer',
      title: 'Days Until a Warmer Day',
      difficulty: 'Medium',
      topics: ['Monotonic Stack'],
      patterns: ['Stack of pending indices'],
      summary: 'For each day, how many days until a strictly higher temperature (0 if never).',
      description: md('Return, for each day, the number of days to wait for a warmer temperature, or 0.'),
      hints: ['Keep indices whose answer is pending; a warmer day resolves all cooler ones on top.'],
      signature: 'daily_waits(temps: list[int]) -> list[int]',
      solution: code`def daily_waits(temps: list[int]) -> list[int]:
    out, st = [0] * len(temps), []
    for i, t in enumerate(temps):
        while st and temps[st[-1]] < t:
            j = st.pop()
            out[j] = i - j
        st.append(i)
    return out
`,
      explanation: md('Pending indices form a non-increasing stack of temperatures; each index is resolved exactly once. O(n).'),
      tests: [
        ex('Example', [73, 74, 75, 71, 69, 72, 76, 73]),
        ex('Increasing', [30, 40, 50, 60]),
        hid('Never warmer', [60, 50, 40]),
        hid('Plateau', [50, 50, 51]),
      ],
    }),

    dsa({
      id: 'dsa-histogram-rectangle',
      title: 'Largest Rectangle Under a Histogram',
      difficulty: 'Hard',
      topics: ['Monotonic Stack'],
      patterns: ['Pop gives the bar’s maximal width'],
      summary: 'Max area of a rectangle formed by contiguous bars.',
      description: md('Bars have width 1 and the given heights. Return the area of the largest axis-aligned rectangle inside the histogram.'),
      hints: ['When a bar is popped by a shorter bar, its rectangle spans from the new stack top + 1 to the current index − 1.'],
      signature: 'largest_rectangle(heights: list[int]) -> int',
      solution: code`def largest_rectangle(heights: list[int]) -> int:
    st, best = [], 0
    for i, h in enumerate(heights + [0]):
        while st and heights[st[-1]] >= h:
            height = heights[st.pop()]
            left = st[-1] + 1 if st else 0
            best = max(best, height * (i - left))
        st.append(i)
    return best
`,
      explanation: md('Each bar’s best rectangle is bounded by the nearest shorter bars on both sides; an increasing stack discovers both in one pass. The sentinel 0 flushes the stack. O(n).'),
      tests: [
        ex('Example', [2, 1, 5, 6, 2, 3]),
        ex('Two bars', [2, 4]),
        hid('Equal bars', [3, 3, 3, 3]),
        hid('Empty', []),
      ],
    }),

    dsa({
      id: 'dsa-maximal-rectangle',
      title: 'Largest All-Ones Rectangle in a Grid',
      difficulty: 'Hard',
      topics: ['Monotonic Stack', 'Matrices', 'Dynamic Programming'],
      patterns: ['Histogram per row'],
      summary: 'Area of the largest rectangle containing only 1s.',
      description: md('`grid` is a list of strings of `0`/`1`. Return the area of the largest rectangle of 1s.'),
      hints: ['Row by row, heights[j] = consecutive 1s ending at this row; run the histogram algorithm on each row.'],
      signature: 'maximal_rectangle(grid: list[str]) -> int',
      solution: code`def maximal_rectangle(grid: list[str]) -> int:
    if not grid:
        return 0
    heights = [0] * len(grid[0])
    best = 0
    for row in grid:
        for j, ch in enumerate(row):
            heights[j] = heights[j] + 1 if ch == "1" else 0
        st = []
        for i, h in enumerate(heights + [0]):
            while st and heights[st[-1]] >= h:
                height = heights[st.pop()]
                left = st[-1] + 1 if st else 0
                best = max(best, height * (i - left))
            st.append(i)
    return best
`,
      explanation: md('Reducing a 2-D problem to m histogram problems gives O(m · n).'),
      tests: [
        ex('Example', ['10100', '10111', '11111', '10010']),
        ex('Single zero', ['0']),
        hid('All ones', ['111', '111']),
        hid('Column', ['1', '1', '0', '1']),
      ],
    }),

    dsa({
      id: 'dsa-sum-of-window-minimums',
      title: 'Sum of the Minimum of Every Subarray',
      difficulty: 'Hard',
      topics: ['Monotonic Stack'],
      patterns: ['Contribution counting'],
      summary: 'Σ min(sub) over all contiguous subarrays, modulo 1e9+7.',
      description: md('Return the sum of `min(b)` over every contiguous subarray `b` of `nums`, modulo `1_000_000_007`.'),
      hints: ['nums[i] is the minimum of left[i] × right[i] subarrays, where left/right are distances to the previous smaller (strict) and next smaller-or-equal elements.'],
      signature: 'sum_subarray_mins(nums: list[int]) -> int',
      solution: code`def sum_subarray_mins(nums: list[int]) -> int:
    n = len(nums)
    left, right = [0] * n, [0] * n
    st = []
    for i in range(n):
        while st and nums[st[-1]] > nums[i]:
            st.pop()
        left[i] = i - (st[-1] if st else -1)
        st.append(i)
    st = []
    for i in range(n - 1, -1, -1):
        while st and nums[st[-1]] >= nums[i]:
            st.pop()
        right[i] = (st[-1] if st else n) - i
        st.append(i)
    return sum(nums[i] * left[i] * right[i] for i in range(n)) % 1_000_000_007
`,
      explanation: md('Counting how many subarrays each element is the minimum of turns O(n²) enumeration into O(n). Asymmetric strictness avoids double counting equal values.'),
      tests: [
        ex('Example', [3, 1, 2, 4]),
        ex('Another', [11, 81, 94, 43, 3]),
        hid('Equal values', [2, 2, 2]),
        hid('Single', [5]),
      ],
    }),

    dsa({
      id: 'dsa-remove-k-digits',
      title: 'Smallest Number After Deleting k Digits',
      difficulty: 'Medium',
      topics: ['Monotonic Stack', 'Greedy'],
      patterns: ['Increasing digit stack'],
      summary: 'Delete k digits to minimise the remaining number.',
      description: md('Return the smallest possible number (as a string without leading zeros, "0" if empty) after removing exactly `k` digits from `num`.'),
      hints: ['While the previous digit is larger than the current one and deletions remain, delete it.'],
      signature: 'remove_k_digits(num: str, k: int) -> str',
      solution: code`def remove_k_digits(num: str, k: int) -> str:
    st = []
    for d in num:
        while k and st and st[-1] > d:
            st.pop()
            k -= 1
        st.append(d)
    if k:
        st = st[:-k]
    return "".join(st).lstrip("0") or "0"
`,
      explanation: md('A larger digit before a smaller one is always worth deleting (it lowers a more significant position). Leftover deletions trim the tail. O(n).'),
      tests: [
        ex('Example', '1432219', 3),
        ex('Leading zeros', '10200', 1),
        hid('Delete all', '10', 2),
        hid('Increasing', '12345', 2),
      ],
    }),

    dsa({
      id: 'dsa-find-celebrity',
      title: 'Find the Celebrity at the Party',
      difficulty: 'Medium',
      topics: ['Stacks & Queues', 'Two Pointers'],
      patterns: ['Elimination by pairwise comparison'],
      summary: 'Everyone knows the celebrity, who knows nobody — find them in O(n) questions.',
      description: md('`knows[a][b] == 1` means a knows b. A celebrity is known by everyone else and knows no one. Return their index or −1.'),
      hints: ['Compare candidates pairwise: if a knows b, a isn’t the celebrity; otherwise b isn’t. Verify the survivor.'],
      signature: 'celebrity(knows: list[list[int]]) -> int',
      solution: code`def celebrity(knows: list[list[int]]) -> int:
    n = len(knows)
    cand = 0
    for i in range(1, n):
        if knows[cand][i]:
            cand = i
    for i in range(n):
        if i != cand and (knows[cand][i] or not knows[i][cand]):
            return -1
    return cand if n else -1
`,
      explanation: md('Each "knows" question rules out one person, so n − 1 questions leave one candidate; 2(n − 1) more verify it. O(n).'),
      tests: [
        ex('Example', [[0, 1, 0], [0, 0, 0], [0, 1, 0]]),
        ex('No celebrity', [[0, 1], [1, 0]]),
        hid('Single person', [[0]]),
        hid('Last is celebrity', [[0, 0, 1], [1, 0, 1], [0, 0, 0]]),
      ],
    }),

    dsa({
      id: 'dsa-window-max-deque',
      title: 'Maximum of Every Window of Size k',
      difficulty: 'Hard',
      topics: ['Sliding Window', 'Monotonic Stack', 'Stacks & Queues'],
      patterns: ['Monotonic deque'],
      summary: 'Sliding-window maximum in O(n).',
      description: md('Return the maximum of each contiguous window of size `k`.'),
      hints: ['Keep indices in a deque with decreasing values; drop the front when it leaves the window.'],
      signature: 'window_max(nums: list[int], k: int) -> list[int]',
      solution: code`from collections import deque

def window_max(nums: list[int], k: int) -> list[int]:
    dq, out = deque(), []
    for i, x in enumerate(nums):
        while dq and nums[dq[-1]] <= x:
            dq.pop()
        dq.append(i)
        if dq[0] <= i - k:
            dq.popleft()
        if i >= k - 1:
            out.append(nums[dq[0]])
    return out
`,
      explanation: md('Smaller elements behind a larger newer one can never be a future maximum, so they are dropped; the front is always the window max. O(n) versus O(n log k) for a heap.'),
      tests: [
        ex('Example', [1, 3, -1, -3, 5, 3, 6, 7], 3),
        ex('k = 1', [4, 2], 1),
        hid('Decreasing', [9, 8, 7, 6], 2),
        hid('Whole array', [1, 5, 2], 3),
      ],
    }),

    dsa({
      id: 'dsa-lru-cache',
      title: 'Least-Recently-Used Cache',
      difficulty: 'Medium',
      topics: ['Design', 'Hashing', 'Linked Lists'],
      patterns: ['Hash map + doubly linked list'],
      summary: 'get / put in O(1), evicting the least recently used key at capacity.',
      description: md('Implement `LRUCache(capacity)` with `get(key)` (value or −1, marks as recently used) and `put(key, value)` (insert/update, marks as used; evicts the LRU key when over capacity). Build the linked list yourself — don’t use `OrderedDict`.'),
      hints: ['Sentinel head/tail nodes; move a node to the front on access; evict tail.prev.'],
      starter: code`class LRUCache:
    def __init__(self, capacity):
        pass

    def get(self, key):
        pass

    def put(self, key, value):
        pass
`,
      signature: 'LRUCache',
      runSignature: 'run(ops: list[list]) -> list',
      solution: code`class _Node:
    __slots__ = ("key", "val", "prev", "next")

    def __init__(self, key=0, val=0):
        self.key, self.val = key, val
        self.prev = self.next = None


class LRUCache:
    def __init__(self, capacity):
        self.cap = capacity
        self.map = {}
        self.head, self.tail = _Node(), _Node()
        self.head.next, self.tail.prev = self.tail, self.head

    def _unlink(self, node):
        node.prev.next, node.next.prev = node.next, node.prev

    def _front(self, node):
        node.prev, node.next = self.head, self.head.next
        self.head.next.prev = node
        self.head.next = node

    def get(self, key):
        node = self.map.get(key)
        if node is None:
            return -1
        self._unlink(node)
        self._front(node)
        return node.val

    def put(self, key, value):
        node = self.map.get(key)
        if node:
            node.val = value
            self._unlink(node)
        else:
            if len(self.map) == self.cap:
                lru = self.tail.prev
                self._unlink(lru)
                del self.map[lru.key]
            node = _Node(key, value)
            self.map[key] = node
        self._front(node)
`,
      driver: OPS_RUN('LRUCache'),
      explanation: md('The map finds a node in O(1); the doubly linked list reorders and evicts in O(1). Sentinels remove every null check.'),
      tests: [
        ex('Example', [['new', 2], ['put', 1, 1], ['put', 2, 2], ['get', 1], ['put', 3, 3], ['get', 2], ['put', 4, 4], ['get', 1], ['get', 3], ['get', 4]]),
        ex('Update refreshes', [['new', 2], ['put', 1, 1], ['put', 2, 2], ['put', 1, 10], ['put', 3, 3], ['get', 1], ['get', 2]]),
        hid('Capacity one', [['new', 1], ['put', 1, 1], ['put', 2, 2], ['get', 1], ['get', 2]]),
        hid('Get refreshes', [['new', 2], ['put', 1, 1], ['put', 2, 2], ['get', 1], ['put', 3, 3], ['get', 1], ['get', 2]]),
      ],
    }),

    dsa({
      id: 'dsa-lfu-cache',
      title: 'Least-Frequently-Used Cache',
      difficulty: 'Hard',
      topics: ['Design', 'Hashing'],
      patterns: ['Frequency buckets + min-frequency pointer'],
      summary: 'Evict the least frequently used key; ties go to the least recently used.',
      description: md('Implement `LFUCache(capacity)` with `get(key)` and `put(key, value)` in O(1) average. Every get or put of a key increments its use count. On overflow evict the key with the lowest count; among ties, the least recently used.'),
      hints: ['key → (value, freq); freq → OrderedDict of keys (recency order); track the current minimum frequency.'],
      starter: code`class LFUCache:
    def __init__(self, capacity):
        pass

    def get(self, key):
        pass

    def put(self, key, value):
        pass
`,
      signature: 'LFUCache',
      runSignature: 'run(ops: list[list]) -> list',
      solution: code`from collections import defaultdict, OrderedDict


class LFUCache:
    def __init__(self, capacity):
        self.cap = capacity
        self.vals = {}
        self.freq = {}
        self.buckets = defaultdict(OrderedDict)
        self.min_freq = 0

    def _touch(self, key):
        f = self.freq[key]
        del self.buckets[f][key]
        if not self.buckets[f]:
            del self.buckets[f]
            if self.min_freq == f:
                self.min_freq = f + 1
        self.freq[key] = f + 1
        self.buckets[f + 1][key] = None

    def get(self, key):
        if key not in self.vals:
            return -1
        self._touch(key)
        return self.vals[key]

    def put(self, key, value):
        if self.cap <= 0:
            return
        if key in self.vals:
            self.vals[key] = value
            self._touch(key)
            return
        if len(self.vals) == self.cap:
            old, _ = self.buckets[self.min_freq].popitem(last=False)
            if not self.buckets[self.min_freq]:
                del self.buckets[self.min_freq]
            del self.vals[old]
            del self.freq[old]
        self.vals[key] = value
        self.freq[key] = 1
        self.buckets[1][key] = None
        self.min_freq = 1
`,
      driver: OPS_RUN('LFUCache'),
      explanation: md('Buckets per frequency keep recency order; the minimum frequency only resets to 1 on insert or increments when its bucket empties, so eviction is O(1).'),
      tests: [
        ex('Example', [['new', 2], ['put', 1, 1], ['put', 2, 2], ['get', 1], ['put', 3, 3], ['get', 2], ['get', 3], ['put', 4, 4], ['get', 1], ['get', 3], ['get', 4]]),
        ex('Zero capacity', [['new', 0], ['put', 0, 0], ['get', 0]]),
        hid('Tie broken by recency', [['new', 2], ['put', 1, 1], ['put', 2, 2], ['put', 3, 3], ['get', 1], ['get', 2], ['get', 3]]),
        hid('Update counts as use', [['new', 2], ['put', 1, 1], ['put', 2, 2], ['put', 1, 5], ['put', 3, 3], ['get', 1], ['get', 2]]),
      ],
    }),

    dsa({
      id: 'dsa-merge-k-sorted',
      title: 'Merge k Sorted Lists with a Heap',
      difficulty: 'Hard',
      topics: ['Heaps', 'Linked Lists'],
      prelude: 'list',
      patterns: ['k-way merge'],
      summary: 'Merge k sorted linked lists into one in O(N log k).',
      description: md('Write `merge_k(lists)` that merges k sorted linked lists into one sorted list.'),
      hints: ['Push (value, list_index, node) for each head; pop the smallest, push its successor.'],
      signature: 'merge_k(lists: list[ListNode | None]) -> ListNode | None',
      runSignature: 'run(lists: list[list[int]]) -> list[int]',
      solution: code`import heapq

def merge_k(lists):
    heap = [(node.val, i, node) for i, node in enumerate(lists) if node]
    heapq.heapify(heap)
    dummy = tail = ListNode()
    while heap:
        _, i, node = heapq.heappop(heap)
        tail.next = node
        tail = node
        if node.next:
            heapq.heappush(heap, (node.next.val, i, node.next))
    return dummy.next
`,
      driver: code`def run(lists):
    return list_values(merge_k([build_list(v) for v in lists]))`,
      explanation: md('The heap holds one candidate per list, so each of N nodes costs O(log k). The list index breaks ties so nodes are never compared.'),
      tests: [
        ex('Example', [[1, 4, 5], [1, 3, 4], [2, 6]]),
        ex('Empty lists', [[], []]),
        hid('No lists', []),
        hid('Single list', [[1, 2, 3]]),
      ],
    }),

    dsa({
      id: 'dsa-k-closest-points',
      title: 'k Points Closest to the Origin',
      difficulty: 'Medium',
      topics: ['Heaps'],
      patterns: ['Bounded max-heap of size k'],
      summary: 'Return the k nearest points (ties by coordinates).',
      description: md('Return the `k` points closest to `(0, 0)` by Euclidean distance, sorted by (distance², x, y).'),
      hints: ['Keep a max-heap of size k keyed by negative distance, or use heapq.nsmallest.'],
      signature: 'k_closest(points: list[list[int]], k: int) -> list[list[int]]',
      solution: code`import heapq

def k_closest(points: list[list[int]], k: int) -> list[list[int]]:
    heap = []
    for x, y in points:
        key = (-(x * x + y * y), -x, -y)
        if len(heap) < k:
            heapq.heappush(heap, key)
        elif key > heap[0]:
            heapq.heapreplace(heap, key)
    return sorted(([-nx, -ny] for _, nx, ny in heap), key=lambda p: (p[0] ** 2 + p[1] ** 2, p[0], p[1]))
`,
      explanation: md('A size-k max-heap keeps the best k seen so far in O(n log k) — better than sorting when k ≪ n. Quickselect gives O(n) average.'),
      tests: [
        ex('Example', [[1, 3], [-2, 2]], 1),
        ex('Two of three', [[3, 3], [5, -1], [-2, 4]], 2),
        hid('Ties', [[1, 0], [0, 1], [-1, 0], [5, 5]], 3),
        hid('All', [[2, 2], [1, 1]], 2),
      ],
    }),

    dsa({
      id: 'dsa-task-cooldown',
      title: 'Shortest Schedule with Cooldowns',
      difficulty: 'Medium',
      topics: ['Heaps', 'Greedy'],
      patterns: ['Most frequent first / frame counting'],
      summary: 'Same task types need n idle slots between them — minimum total time.',
      description: md('Each task takes one unit; two tasks of the same type must be at least `n` units apart. Return the minimum time to finish all tasks (idling allowed).'),
      hints: ['(max_count − 1) × (n + 1) + number of task types with max_count; at least len(tasks).'],
      signature: 'least_interval(tasks: list[str], n: int) -> int',
      solution: code`from collections import Counter

def least_interval(tasks: list[str], n: int) -> int:
    if not tasks:
        return 0
    counts = Counter(tasks).values()
    top = max(counts)
    tied = sum(1 for c in counts if c == top)
    return max(len(tasks), (top - 1) * (n + 1) + tied)
`,
      explanation: md('The most frequent task defines frames of length n + 1; other tasks fill gaps. When there are enough distinct tasks no idling is needed. A max-heap simulation gives the same answer and an explicit order.'),
      tests: [
        ex('Example', ['A', 'A', 'A', 'B', 'B', 'B'], 2),
        ex('No cooldown', ['A', 'A', 'A', 'B', 'B', 'B'], 0),
        hid('Enough variety', ['A', 'A', 'A', 'B', 'C', 'D', 'E', 'F', 'G'], 2),
        hid('Single type', ['X', 'X', 'X'], 3),
      ],
    }),

    dsa({
      id: 'dsa-top-k-pair-sums',
      title: 'Largest k Sums of One Item from Each List',
      difficulty: 'Medium',
      topics: ['Heaps'],
      patterns: ['Best-first expansion with a visited set'],
      summary: 'Top-k values of a[i] + b[j] without forming all pairs.',
      description: md('Return the `k` largest sums `a[i] + b[j]` (i, j any indices), in descending order.'),
      hints: ['Sort both descending; start at (0, 0); pop the best, push (i+1, j) and (i, j+1) if unseen.'],
      signature: 'max_pair_sums(a: list[int], b: list[int], k: int) -> list[int]',
      solution: code`import heapq

def max_pair_sums(a: list[int], b: list[int], k: int) -> list[int]:
    a, b = sorted(a, reverse=True), sorted(b, reverse=True)
    if not a or not b:
        return []
    heap, seen, out = [(-(a[0] + b[0]), 0, 0)], {(0, 0)}, []
    while heap and len(out) < k:
        s, i, j = heapq.heappop(heap)
        out.append(-s)
        for ni, nj in ((i + 1, j), (i, j + 1)):
            if ni < len(a) and nj < len(b) and (ni, nj) not in seen:
                seen.add((ni, nj))
                heapq.heappush(heap, (-(a[ni] + b[nj]), ni, nj))
    return out
`,
      explanation: md('The sum matrix is sorted along rows and columns, so the next best is always adjacent to something already taken. O(k log k).'),
      tests: [
        ex('Example', [1, 4, 2, 3], [2, 5, 1, 6], 4),
        ex('k exceeds pairs', [1], [2], 5),
        hid('Duplicates', [3, 3], [1, 1], 3),
        hid('Empty list', [], [1, 2], 2),
      ],
    }),

    dsa({
      id: 'dsa-no-adjacent-repeats',
      title: 'Rearrange So No Two Neighbours Match',
      difficulty: 'Medium',
      topics: ['Heaps', 'Greedy', 'Strings'],
      patterns: ['Take the most frequent, hold it back one step'],
      summary: 'Reorder a string so equal characters are never adjacent ("" if impossible).',
      description: md('Return a rearrangement of `s` with no two equal adjacent characters, built greedily: at each step use the most frequent remaining character that differs from the previous one (ties: smaller character). Return `""` if impossible.'),
      hints: ['Max-heap of (−count, char); pop one, append it, and push back the previously used character.'],
      signature: 'reorganize(s: str) -> str',
      solution: code`import heapq
from collections import Counter

def reorganize(s: str) -> str:
    heap = [(-c, ch) for ch, c in Counter(s).items()]
    heapq.heapify(heap)
    out, held = [], None
    while heap:
        c, ch = heapq.heappop(heap)
        out.append(ch)
        if held:
            heapq.heappush(heap, held)
        held = (c + 1, ch) if c + 1 < 0 else None
    return "".join(out) if len(out) == len(s) else ""
`,
      explanation: md('Holding the just-used character out of the heap for one step guarantees it isn’t repeated; it is impossible exactly when one character exceeds ⌈n/2⌉.'),
      tests: [
        ex('Example', 'aab'),
        ex('Impossible', 'aaab'),
        hid('Many letters', 'aaabbc'),
        hid('Empty', ''),
      ],
    }),
  ],
};
