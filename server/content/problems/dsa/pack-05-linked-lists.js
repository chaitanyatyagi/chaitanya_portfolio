// DSA pack 05 — singly linked lists with real ListNode objects: reversal
// (whole, in k-groups, between positions), fast/slow pointers (middle, cycle,
// cycle start, palindrome, nth from end), merging and sorting, arithmetic on
// digit lists, intersection, rotation, partition, reorder, dedupe, odd/even,
// pair swaps, and deep-copying a list with random pointers.
// Each problem's driver builds the list from JSON and serialises the result.
import { dsa, md, code, ex, hid } from './define.js';

const L = { prelude: 'list', topics: ['Linked Lists'] };

export default {
  problems: [
    dsa({
      ...L,
      id: 'dsa-reverse-linked-list',
      title: 'Reverse a Linked List (Iteratively and Recursively)',
      difficulty: 'Easy',
      patterns: ['Pointer reversal'],
      summary: 'Reverse a singly linked list in place.',
      description: md('Write `reverse_list(head)` that reverses the list in place and returns the new head. The tests pass the list as values and read the result back.'),
      hints: ['Keep prev, cur; on each step save cur.next, point cur.next at prev, advance.'],
      signature: 'reverse_list(head: ListNode | None) -> ListNode | None',
      runSignature: 'run(values: list[int]) -> list[int]',
      solution: code`def reverse_list(head):
    prev = None
    while head:
        head.next, prev, head = prev, head, head.next
    return prev
`,
      driver: code`def run(values):
    return list_values(reverse_list(build_list(values)))`,
      explanation: md('Iterative reversal is O(n) time and O(1) space. The recursive version (reverse the rest, then hook `head.next.next = head`) is elegant but uses O(n) stack.'),
      tests: [
        ex('Example', [1, 2, 3, 4, 5]),
        ex('Two nodes', [1, 2]),
        hid('Single', [7]),
        hid('Empty', []),
      ],
    }),

    dsa({
      ...L,
      id: 'dsa-middle-node',
      title: 'Middle of a Linked List in One Pass',
      difficulty: 'Easy',
      patterns: ['Fast and slow pointers'],
      summary: 'Return the middle node (the second middle for even lengths).',
      description: md('Write `middle_node(head)` returning the middle node; for an even number of nodes return the second of the two middles. The driver returns the values from the middle to the end.'),
      hints: ['Fast moves two steps, slow one; when fast runs off, slow is at the middle.'],
      signature: 'middle_node(head: ListNode | None) -> ListNode | None',
      runSignature: 'run(values: list[int]) -> list[int]',
      solution: code`def middle_node(head):
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
    return slow
`,
      driver: code`def run(values):
    return list_values(middle_node(build_list(values)))`,
      explanation: md('The tortoise-and-hare pattern finds the midpoint without knowing the length — and is the first step of list merge sort and palindrome checks.'),
      tests: [
        ex('Odd', [1, 2, 3, 4, 5]),
        ex('Even', [1, 2, 3, 4, 5, 6]),
        hid('Single', [9]),
        hid('Two', [1, 2]),
      ],
    }),

    dsa({
      ...L,
      id: 'dsa-merge-two-sorted-lists',
      title: 'Splice Two Sorted Lists Together',
      difficulty: 'Easy',
      patterns: ['Dummy head'],
      summary: 'Merge two sorted linked lists by relinking nodes.',
      description: md('Write `merge_lists(a, b)` that merges two sorted lists into one sorted list by relinking the existing nodes (stable: on ties take from `a` first).'),
      hints: ['A dummy node avoids special-casing the head.'],
      signature: 'merge_lists(a: ListNode | None, b: ListNode | None) -> ListNode | None',
      runSignature: 'run(a: list[int], b: list[int]) -> list[int]',
      solution: code`def merge_lists(a, b):
    dummy = tail = ListNode()
    while a and b:
        if a.val <= b.val:
            tail.next, a = a, a.next
        else:
            tail.next, b = b, b.next
        tail = tail.next
    tail.next = a or b
    return dummy.next
`,
      driver: code`def run(a, b):
    return list_values(merge_lists(build_list(a), build_list(b)))`,
      explanation: md('O(n + m) time and O(1) extra space: no new nodes, just pointer changes.'),
      tests: [
        ex('Example', [1, 2, 4], [1, 3, 4]),
        ex('One empty', [], [0]),
        hid('Both empty', [], []),
        hid('Disjoint ranges', [5, 6], [1, 2, 3]),
      ],
    }),

    dsa({
      ...L,
      id: 'dsa-drop-nth-from-end',
      title: 'Remove the n-th Node from the End',
      difficulty: 'Medium',
      patterns: ['Gap of n between two pointers'],
      summary: 'Delete the n-th node from the end in one pass.',
      description: md('Write `remove_nth_from_end(head, n)` (1 ≤ n ≤ length) that removes that node and returns the head.'),
      hints: ['Advance a lead pointer n steps from a dummy, then move both until the lead hits the end.'],
      signature: 'remove_nth_from_end(head: ListNode | None, n: int) -> ListNode | None',
      runSignature: 'run(values: list[int], n: int) -> list[int]',
      solution: code`def remove_nth_from_end(head, n):
    dummy = ListNode(0, head)
    lead = trail = dummy
    for _ in range(n):
        lead = lead.next
    while lead.next:
        lead, trail = lead.next, trail.next
    trail.next = trail.next.next
    return dummy.next
`,
      driver: code`def run(values, n):
    return list_values(remove_nth_from_end(build_list(values), n))`,
      explanation: md('Keeping the pointers n apart means the trailing one stops just before the target. The dummy handles removing the head.'),
      tests: [
        ex('Example', [1, 2, 3, 4, 5], 2),
        ex('Remove head', [1, 2], 2),
        hid('Remove tail', [1, 2, 3], 1),
        hid('Only node', [1], 1),
      ],
    }),

    dsa({
      ...L,
      id: 'dsa-add-digit-lists',
      title: 'Add Two Numbers Stored as Digit Lists',
      difficulty: 'Medium',
      topics: ['Linked Lists', 'Math & Number Theory'],
      patterns: ['Carry propagation'],
      summary: 'Digits are stored least-significant first; return the sum as a list.',
      description: md('Two non-negative integers are stored as linked lists of digits in **reverse** order. Write `add_numbers(a, b)` returning their sum in the same format.'),
      hints: ['Walk both lists with a carry; continue while either list or the carry remains.'],
      signature: 'add_numbers(a: ListNode | None, b: ListNode | None) -> ListNode | None',
      runSignature: 'run(a: list[int], b: list[int]) -> list[int]',
      solution: code`def add_numbers(a, b):
    dummy = tail = ListNode()
    carry = 0
    while a or b or carry:
        total = carry + (a.val if a else 0) + (b.val if b else 0)
        carry, digit = divmod(total, 10)
        tail.next = ListNode(digit)
        tail = tail.next
        a = a.next if a else None
        b = b.next if b else None
    return dummy.next
`,
      driver: code`def run(a, b):
    return list_values(add_numbers(build_list(a), build_list(b)))`,
      explanation: md('Schoolbook addition, digit by digit; lists of any length work because nothing is converted to a machine integer.'),
      tests: [
        ex('Example', [2, 4, 3], [5, 6, 4]),
        ex('Final carry', [9, 9, 9, 9], [9, 9]),
        hid('Zeros', [0], [0]),
        hid('Different lengths', [1], [9, 9, 9]),
      ],
    }),

    dsa({
      ...L,
      id: 'dsa-plus-one-list',
      title: 'Add One to a Number Stored Most-Significant First',
      difficulty: 'Medium',
      topics: ['Linked Lists', 'Recursion & Backtracking'],
      patterns: ['Reverse, add, reverse — or recursion'],
      summary: 'Increment a number whose digits are stored head-first.',
      description: md('Write `plus_one(head)`: the list stores a number with the most significant digit first. Return the list for the number + 1.'),
      hints: ['Find the last digit that isn’t 9: increment it and zero everything after. If all are 9, prepend a 1.'],
      signature: 'plus_one(head: ListNode | None) -> ListNode | None',
      runSignature: 'run(values: list[int]) -> list[int]',
      solution: code`def plus_one(head):
    dummy = ListNode(0, head)
    last = dummy
    node = head
    while node:
        if node.val != 9:
            last = node
        node = node.next
    last.val += 1
    node = last.next
    while node:
        node.val = 0
        node = node.next
    return dummy if dummy.val else dummy.next
`,
      driver: code`def run(values):
    return list_values(plus_one(build_list(values)))`,
      explanation: md('Only the trailing run of 9s changes besides one digit; finding the last non-9 gives an O(n), O(1) solution with no reversal.'),
      tests: [
        ex('Example', [1, 2, 3]),
        ex('All nines', [9, 9]),
        hid('Trailing nines', [1, 9, 9]),
        hid('Zero', [0]),
      ],
    }),

    dsa({
      ...L,
      id: 'dsa-detect-loop',
      title: 'Does the List Loop? Where Does the Loop Start?',
      difficulty: 'Medium',
      topics: ['Linked Lists', 'Two Pointers'],
      patterns: ['Floyd cycle detection'],
      summary: 'Detect a cycle, find its entry node and its length — O(1) memory.',
      description: md('Write `cycle_info(head)` returning `[entry_value, cycle_length]` or `[None, 0]` when there is no cycle. The driver links the tail to the node at index `pos` (−1 = no cycle).'),
      hints: ['After slow and fast meet, a pointer from the head and one from the meeting point meet at the entry.'],
      signature: 'cycle_info(head: ListNode | None) -> list',
      runSignature: 'run(values: list[int], pos: int) -> list',
      solution: code`def cycle_info(head):
    slow = fast = head
    while fast and fast.next:
        slow, fast = slow.next, fast.next.next
        if slow is fast:
            break
    else:
        return [None, 0]
    a = head
    while a is not slow:
        a, slow = a.next, slow.next
    length, node = 1, a.next
    while node is not a:
        length += 1
        node = node.next
    return [a.val, length]
`,
      driver: code`def run(values, pos):
    head = build_list(values)
    if pos >= 0:
        nodes, node = [], head
        while node:
            nodes.append(node)
            node = node.next
        nodes[-1].next = nodes[pos]
    return cycle_info(head)`,
      explanation: md('If the distance to the entry is a and they meet b steps into a cycle of length c, then a ≡ c − b (mod c): walking a from both the head and the meeting point lands on the entry.'),
      tests: [
        ex('Example', [3, 2, 0, -4], 1),
        ex('No cycle', [1, 2, 3], -1),
        hid('Self loop', [1], 0),
        hid('Whole list is the loop', [5, 6, 7, 8], 0),
      ],
    }),

    dsa({
      ...L,
      id: 'dsa-list-palindrome',
      title: 'Does the List Read the Same Backwards?',
      difficulty: 'Medium',
      topics: ['Linked Lists', 'Two Pointers'],
      patterns: ['Find middle, reverse second half, compare'],
      summary: 'Palindrome check in O(n) time and O(1) space.',
      description: md('Write `is_palindrome(head)` returning whether the values read the same in both directions, using O(1) extra memory.'),
      hints: ['Find the middle, reverse the second half, compare, (optionally) restore.'],
      signature: 'is_palindrome(head: ListNode | None) -> bool',
      runSignature: 'run(values: list[int]) -> bool',
      solution: code`def is_palindrome(head):
    slow = fast = head
    while fast and fast.next:
        slow, fast = slow.next, fast.next.next
    prev = None
    while slow:
        slow.next, prev, slow = prev, slow, slow.next
    a, b = head, prev
    while b:
        if a.val != b.val:
            return False
        a, b = a.next, b.next
    return True
`,
      driver: code`def run(values):
    return is_palindrome(build_list(values))`,
      explanation: md('Combining two primitives — middle via fast/slow and in-place reversal — avoids copying values into an array.'),
      tests: [
        ex('Example', [1, 2, 2, 1]),
        ex('Not a palindrome', [1, 2]),
        hid('Odd length', [1, 2, 3, 2, 1]),
        hid('Empty', []),
      ],
    }),

    dsa({
      ...L,
      id: 'dsa-reverse-in-groups',
      title: 'Reverse Every Block of k Nodes',
      difficulty: 'Hard',
      patterns: ['Group reversal with connectors'],
      summary: 'Reverse nodes k at a time; a short final block stays as is.',
      description: md('Write `reverse_k_group(head, k)` that reverses each consecutive block of `k` nodes; if fewer than `k` remain at the end, leave them in order.'),
      hints: ['Check that k nodes remain, reverse exactly k, connect the previous group’s tail to the new head.'],
      signature: 'reverse_k_group(head: ListNode | None, k: int) -> ListNode | None',
      runSignature: 'run(values: list[int], k: int) -> list[int]',
      solution: code`def reverse_k_group(head, k):
    dummy = ListNode(0, head)
    group_prev = dummy
    while True:
        kth = group_prev
        for _ in range(k):
            kth = kth.next
            if kth is None:
                return dummy.next
        group_next = kth.next
        prev, cur = group_next, group_prev.next
        while cur is not group_next:
            cur.next, prev, cur = prev, cur, cur.next
        first = group_prev.next
        group_prev.next = kth
        group_prev = first
`,
      driver: code`def run(values, k):
    return list_values(reverse_k_group(build_list(values), k))`,
      explanation: md('Reversing each block onto `group_next` makes the old first node the new tail, which becomes the connector for the next block. O(n), O(1).'),
      tests: [
        ex('Example', [1, 2, 3, 4, 5], 2),
        ex('Groups of three', [1, 2, 3, 4, 5], 3),
        hid('k = 1', [1, 2, 3], 1),
        hid('Exact multiple', [1, 2, 3, 4], 4),
      ],
    }),

    dsa({
      ...L,
      id: 'dsa-reverse-between',
      title: 'Reverse Only Positions left..right',
      difficulty: 'Medium',
      patterns: ['Head insertion within a sublist'],
      summary: 'Reverse the sublist between two 1-based positions in one pass.',
      description: md('Write `reverse_between(head, left, right)` that reverses nodes at positions `left` to `right` (1-based, inclusive).'),
      hints: ['Walk to the node before `left`, then repeatedly move the next node to the front of the sublist.'],
      signature: 'reverse_between(head: ListNode | None, left: int, right: int) -> ListNode | None',
      runSignature: 'run(values: list[int], left: int, right: int) -> list[int]',
      solution: code`def reverse_between(head, left, right):
    dummy = ListNode(0, head)
    before = dummy
    for _ in range(left - 1):
        before = before.next
    cur = before.next
    for _ in range(right - left):
        moved = cur.next
        cur.next = moved.next
        moved.next = before.next
        before.next = moved
    return dummy.next
`,
      driver: code`def run(values, left, right):
    return list_values(reverse_between(build_list(values), left, right))`,
      explanation: md('"Head insertion" moves one node per step to the front of the window — a single pass with constant pointers.'),
      tests: [
        ex('Example', [1, 2, 3, 4, 5], 2, 4),
        ex('Whole list', [3, 5], 1, 2),
        hid('Single position', [1, 2, 3], 2, 2),
        hid('From the head', [1, 2, 3, 4], 1, 3),
      ],
    }),

    dsa({
      ...L,
      id: 'dsa-list-intersection',
      title: 'Where Do Two Lists Merge?',
      difficulty: 'Easy',
      topics: ['Linked Lists', 'Two Pointers'],
      patterns: ['Switch heads to equalise lengths'],
      summary: 'Find the first shared node of two lists that merge into a common tail.',
      description: md('Write `intersection(a, b)` returning the first node shared by both lists (by identity), or `None`. The driver builds two prefixes and links both to a shared tail; it returns the shared node’s value (`None` if none).'),
      hints: ['Walk both pointers; when one ends, restart it at the other list’s head. They meet after at most |a| + |b| steps.'],
      signature: 'intersection(a: ListNode | None, b: ListNode | None) -> ListNode | None',
      runSignature: 'run(prefix_a: list[int], prefix_b: list[int], shared: list[int]) -> int | None',
      solution: code`def intersection(a, b):
    p, q = a, b
    while p is not q:
        p = p.next if p else b
        q = q.next if q else a
    return p
`,
      driver: code`def run(prefix_a, prefix_b, shared):
    tail = build_list(shared)

    def attach(values):
        head = build_list(values)
        if head is None:
            return tail
        node = head
        while node.next:
            node = node.next
        node.next = tail
        return head

    node = intersection(attach(prefix_a), attach(prefix_b))
    return node.val if node else None`,
      explanation: md('Both pointers travel |a| + |b| total before meeting, aligning their remaining lengths without computing them. Values may repeat — identity, not value, defines the meeting point.'),
      tests: [
        ex('Example', [4, 1], [5, 6, 1], [8, 4, 5]),
        ex('No intersection', [2, 6, 4], [1, 5], []),
        hid('Same values, different nodes', [1, 9], [1], [9, 2]),
        hid('One list is the tail', [], [3, 3], [7]),
      ],
    }),

    dsa({
      ...L,
      id: 'dsa-rotate-list-right',
      title: 'Rotate a Linked List Right by k',
      difficulty: 'Medium',
      patterns: ['Close into a ring, cut'],
      summary: 'Move the last k nodes to the front.',
      description: md('Write `rotate_right(head, k)` that rotates the list to the right by `k` places (k may exceed the length).'),
      hints: ['Measure the length, connect the tail to the head, then cut at length − k % length.'],
      signature: 'rotate_right(head: ListNode | None, k: int) -> ListNode | None',
      runSignature: 'run(values: list[int], k: int) -> list[int]',
      solution: code`def rotate_right(head, k):
    if not head:
        return head
    n, tail = 1, head
    while tail.next:
        tail, n = tail.next, n + 1
    k %= n
    if k == 0:
        return head
    tail.next = head
    new_tail = head
    for _ in range(n - k - 1):
        new_tail = new_tail.next
    new_head = new_tail.next
    new_tail.next = None
    return new_head
`,
      driver: code`def run(values, k):
    return list_values(rotate_right(build_list(values), k))`,
      explanation: md('Turning the list into a ring makes rotation a single cut. O(n).'),
      tests: [
        ex('Example', [1, 2, 3, 4, 5], 2),
        ex('k beyond length', [0, 1, 2], 4),
        hid('Zero', [1, 2], 0),
        hid('Empty', [], 3),
      ],
    }),

    dsa({
      ...L,
      id: 'dsa-sort-linked-list',
      title: 'Sort a Linked List in O(n log n)',
      difficulty: 'Medium',
      topics: ['Linked Lists', 'Sorting'],
      patterns: ['Merge sort on lists'],
      summary: 'Sort by relinking nodes with merge sort.',
      description: md('Write `sort_list(head)` that sorts the list ascending in O(n log n) time.'),
      hints: ['Split at the middle (slow/fast with fast starting at head.next), sort halves recursively, merge.'],
      signature: 'sort_list(head: ListNode | None) -> ListNode | None',
      runSignature: 'run(values: list[int]) -> list[int]',
      solution: code`def sort_list(head):
    if not head or not head.next:
        return head
    slow, fast = head, head.next
    while fast and fast.next:
        slow, fast = slow.next, fast.next.next
    right = slow.next
    slow.next = None
    a, b = sort_list(head), sort_list(right)
    dummy = tail = ListNode()
    while a and b:
        if a.val <= b.val:
            tail.next, a = a, a.next
        else:
            tail.next, b = b, b.next
        tail = tail.next
    tail.next = a or b
    return dummy.next
`,
      driver: code`def run(values):
    return list_values(sort_list(build_list(values)))`,
      explanation: md('Merge sort suits lists: splitting and merging need no random access or extra arrays. Starting fast at head.next makes two-node lists split correctly.'),
      tests: [
        ex('Example', [4, 2, 1, 3]),
        ex('Negatives', [-1, 5, 3, 4, 0]),
        hid('Duplicates', [2, 1, 2, 1]),
        hid('Empty', []),
      ],
    }),

    dsa({
      ...L,
      id: 'dsa-odd-even-positions',
      title: 'Group Odd Positions Before Even Positions',
      difficulty: 'Medium',
      patterns: ['Two interleaved chains'],
      summary: 'Nodes at positions 1, 3, 5… first, then 2, 4, 6…, preserving order.',
      description: md('Write `odd_even(head)` that reorders the list so all nodes at odd positions (1-based) come first, followed by those at even positions, keeping relative order. O(1) extra space.'),
      hints: ['Build the odd chain and the even chain simultaneously, then attach even after odd.'],
      signature: 'odd_even(head: ListNode | None) -> ListNode | None',
      runSignature: 'run(values: list[int]) -> list[int]',
      solution: code`def odd_even(head):
    if not head:
        return head
    odd, even = head, head.next
    even_head = even
    while even and even.next:
        odd.next = even.next
        odd = odd.next
        even.next = odd.next
        even = even.next
    odd.next = even_head
    return head
`,
      driver: code`def run(values):
    return list_values(odd_even(build_list(values)))`,
      explanation: md('Two pointers leapfrog each other, each skipping one node. O(n), O(1).'),
      tests: [
        ex('Example', [1, 2, 3, 4, 5]),
        ex('Longer list', [2, 1, 3, 5, 6, 4, 7]),
        hid('Two nodes', [1, 2]),
        hid('Empty', []),
      ],
    }),

    dsa({
      ...L,
      id: 'dsa-dedupe-sorted-list',
      title: 'Remove Every Value That Repeats (Sorted List)',
      difficulty: 'Medium',
      patterns: ['Dummy head + skip runs'],
      summary: 'Keep only values that appear exactly once.',
      description: md('Write `drop_repeated(head)` for a sorted list: delete **all** nodes whose value occurs more than once, leaving only distinct values.'),
      hints: ['From a dummy, if the next run has length > 1 skip it entirely; otherwise advance.'],
      signature: 'drop_repeated(head: ListNode | None) -> ListNode | None',
      runSignature: 'run(values: list[int]) -> list[int]',
      solution: code`def drop_repeated(head):
    dummy = ListNode(0, head)
    prev = dummy
    while prev.next:
        node = prev.next
        if node.next and node.next.val == node.val:
            v = node.val
            while node and node.val == v:
                node = node.next
            prev.next = node
        else:
            prev = node
    return dummy.next
`,
      driver: code`def run(values):
    return list_values(drop_repeated(build_list(values)))`,
      explanation: md('Because the list is sorted, duplicates form contiguous runs; detecting a run of length > 1 and unlinking it is O(n).'),
      tests: [
        ex('Example', [1, 2, 3, 3, 4, 4, 5]),
        ex('Head repeats', [1, 1, 1, 2, 3]),
        hid('All repeat', [2, 2]),
        hid('No repeats', [1, 2]),
      ],
    }),

    dsa({
      ...L,
      id: 'dsa-reorder-zigzag',
      title: 'Reorder as First, Last, Second, Second-Last…',
      difficulty: 'Medium',
      patterns: ['Middle + reverse + weave'],
      summary: 'L0 → Ln → L1 → Ln−1 → … in place.',
      description: md('Write `reorder(head)` that rearranges the list in place to `L0, Ln, L1, Ln−1, L2, …` and returns the head.'),
      hints: ['Split at the middle, reverse the second half, then interleave.'],
      signature: 'reorder(head: ListNode | None) -> ListNode | None',
      runSignature: 'run(values: list[int]) -> list[int]',
      solution: code`def reorder(head):
    if not head:
        return head
    slow, fast = head, head
    while fast.next and fast.next.next:
        slow, fast = slow.next, fast.next.next
    second, slow.next = slow.next, None
    prev = None
    while second:
        second.next, prev, second = prev, second, second.next
    a, b = head, prev
    while b:
        a_next, b_next = a.next, b.next
        a.next, b.next = b, a_next
        a, b = a_next, b_next
    return head
`,
      driver: code`def run(values):
    return list_values(reorder(build_list(values)))`,
      explanation: md('Three primitives composed — split, reverse, merge alternately — O(n) time, O(1) space.'),
      tests: [
        ex('Example', [1, 2, 3, 4]),
        ex('Odd', [1, 2, 3, 4, 5]),
        hid('Single', [1]),
        hid('Two', [1, 2]),
      ],
    }),

    dsa({
      ...L,
      id: 'dsa-partition-around-x',
      title: 'Partition a List Around a Value',
      difficulty: 'Medium',
      patterns: ['Two dummy chains'],
      summary: 'Nodes < x first, then the rest, both keeping original order.',
      description: md('Write `partition(head, x)` so all nodes with value less than `x` come before nodes with value ≥ x, preserving relative order within each group.'),
      hints: ['Append each node to a "less" chain or a "rest" chain; join them; terminate the rest chain.'],
      signature: 'partition(head: ListNode | None, x: int) -> ListNode | None',
      runSignature: 'run(values: list[int], x: int) -> list[int]',
      solution: code`def partition(head, x):
    less = lt = ListNode()
    rest = rt = ListNode()
    while head:
        if head.val < x:
            lt.next = head
            lt = head
        else:
            rt.next = head
            rt = head
        head = head.next
    rt.next = None
    lt.next = rest.next
    return less.next
`,
      driver: code`def run(values, x):
    return list_values(partition(build_list(values), x))`,
      explanation: md('A stable partition (the quicksort step for lists). Forgetting `rt.next = None` creates a cycle — a classic bug.'),
      tests: [
        ex('Example', [1, 4, 3, 2, 5, 2], 3),
        ex('Two nodes', [2, 1], 2),
        hid('All smaller', [1, 1], 5),
        hid('Empty', [], 0),
      ],
    }),

    dsa({
      ...L,
      id: 'dsa-swap-adjacent-pairs',
      title: 'Swap Every Two Adjacent Nodes',
      difficulty: 'Medium',
      patterns: ['Pairwise relinking'],
      summary: 'Swap nodes (not values) in pairs.',
      description: md('Write `swap_pairs(head)` that swaps every two adjacent nodes by relinking them (don’t just swap values).'),
      hints: ['prev → a → b → next becomes prev → b → a → next.'],
      signature: 'swap_pairs(head: ListNode | None) -> ListNode | None',
      runSignature: 'run(values: list[int]) -> list[int]',
      solution: code`def swap_pairs(head):
    dummy = ListNode(0, head)
    prev = dummy
    while prev.next and prev.next.next:
        a, b = prev.next, prev.next.next
        prev.next, a.next, b.next = b, b.next, a
        prev = a
    return dummy.next
`,
      driver: code`def run(values):
    return list_values(swap_pairs(build_list(values)))`,
      explanation: md('It is reverse-in-k-groups with k = 2. O(n), O(1).'),
      tests: [
        ex('Example', [1, 2, 3, 4]),
        ex('Odd', [1, 2, 3]),
        hid('Single', [1]),
        hid('Empty', []),
      ],
    }),

    dsa({
      ...L,
      id: 'dsa-delete-middle',
      title: 'Delete the Middle Node',
      difficulty: 'Medium',
      patterns: ['Fast and slow pointers'],
      summary: 'Remove the ⌊n/2⌋-th node (0-based).',
      description: md('Write `delete_middle(head)` that removes the node at index `len // 2` (0-based) and returns the head (an empty list for a single node).'),
      hints: ['Start fast two steps ahead so slow stops just before the middle.'],
      signature: 'delete_middle(head: ListNode | None) -> ListNode | None',
      runSignature: 'run(values: list[int]) -> list[int]',
      solution: code`def delete_middle(head):
    if not head or not head.next:
        return None
    slow, fast = head, head.next.next
    while fast and fast.next:
        slow, fast = slow.next, fast.next.next
    slow.next = slow.next.next
    return head
`,
      driver: code`def run(values):
    return list_values(delete_middle(build_list(values)))`,
      explanation: md('Offsetting the fast pointer by one extra step leaves slow on the predecessor of the middle. O(n), O(1).'),
      tests: [
        ex('Example', [1, 3, 4, 7, 1, 2, 6]),
        ex('Even', [1, 2, 3, 4]),
        hid('Two', [2, 1]),
        hid('One', [5]),
      ],
    }),

    dsa({
      ...L,
      id: 'dsa-copy-random-list',
      title: 'Deep-Copy a List with Random Pointers',
      difficulty: 'Medium',
      topics: ['Linked Lists', 'Hashing'],
      patterns: ['Interleave copies (O(1) extra)'],
      summary: 'Each node has next and random pointers; clone the whole structure.',
      description: md(
        'Each node has `val`, `next` and `random` (any node or `None`). Write `copy_random(head)` that returns a deep copy — no pointer in the copy may refer to an original node.',
        '',
        'The driver passes `[[val, random_index], …]` and returns the copy in the same format plus whether any original node leaked into it.',
      ),
      hints: ['Insert each copy right after its original, set copy.random = orig.random.next, then unweave.'],
      starter: code`class Node:
    def __init__(self, val, next=None, random=None):
        self.val = val
        self.next = next
        self.random = random

def copy_random(head):
    pass
`,
      signature: 'copy_random(head: Node | None) -> Node | None',
      runSignature: 'run(spec: list[list]) -> list',
      solution: code`class Node:
    def __init__(self, val, next=None, random=None):
        self.val = val
        self.next = next
        self.random = random

def copy_random(head):
    if not head:
        return None
    node = head
    while node:
        node.next = Node(node.val, node.next)
        node = node.next.next
    node = head
    while node:
        node.next.random = node.random.next if node.random else None
        node = node.next.next
    copy_head, node = head.next, head
    while node:
        clone = node.next
        node.next = clone.next
        clone.next = clone.next.next if clone.next else None
        node = node.next
    return copy_head
`,
      driver: code`def run(spec):
    nodes = [Node(v) for v, _ in spec]
    for i, (_, r) in enumerate(spec):
        if i + 1 < len(nodes):
            nodes[i].next = nodes[i + 1]
        nodes[i].random = nodes[r] if r is not None else None
    originals = set(map(id, nodes))
    copy = copy_random(nodes[0] if nodes else None)
    out, index, node = [], {}, copy
    while node:
        index[id(node)] = len(out)
        out.append(node)
        node = node.next
    leaked = any(id(n) in originals for n in out)
    return [[[n.val, index.get(id(n.random)) if n.random else None] for n in out], leaked]`,
      explanation: md('A hash map original→copy is the straightforward O(n)-space approach; interleaving copies next to originals gives O(1) extra space and restores the original list afterwards.'),
      tests: [
        ex('Example', [[7, null], [13, 0], [11, 4], [10, 2], [1, 0]]),
        ex('Self random', [[1, 0], [2, 0]]),
        hid('All null randoms', [[3, null], [3, null], [3, null]]),
        hid('Empty', []),
      ],
    }),
  ],
};
