// DSA pack 10 — binary search trees and tries: search / insert / delete,
// validation, k-th smallest & largest, BST LCA, successor & predecessor,
// floor & ceil, building from preorder and from a sorted array, BST iterator
// pair sum, recovering two swapped nodes, largest BST inside a tree, merging
// two BSTs; tries with prefix counts and erase, the longest fully-prefixed
// word, distinct substrings, and maximum XOR (plain and with query limits).
import { dsa, md, code, ex, hid } from './define.js';

const B = { prelude: 'tree', topics: ['Binary Search Trees'] };

export default {
  problems: [
    dsa({
      ...B,
      id: 'dsa-bst-insert-delete',
      title: 'Insert and Delete in a Binary Search Tree',
      difficulty: 'Medium',
      patterns: ['Replace with inorder successor'],
      summary: 'Apply a sequence of inserts and deletes and return the inorder and level order.',
      description: md('Write `insert(root, x)` and `delete(root, x)` (both return the new root; deleting a missing key is a no-op, inserting an existing key is a no-op). For a node with two children, replace its value with its inorder **successor** and delete that. The driver applies `ops` to the tree built from `values` and returns `[inorder, level_order]`.'),
      hints: ['Delete: no child → None; one child → that child; two → copy the successor (leftmost of the right subtree) and delete it from the right.'],
      starter: code`def insert(root, x):
    pass

def delete(root, x):
    pass
`,
      signature: 'insert(root, x) / delete(root, x)',
      runSignature: 'run(values: list, ops: list[list]) -> list',
      solution: code`def insert(root, x):
    if not root:
        return TreeNode(x)
    if x < root.val:
        root.left = insert(root.left, x)
    elif x > root.val:
        root.right = insert(root.right, x)
    return root

def delete(root, x):
    if not root:
        return None
    if x < root.val:
        root.left = delete(root.left, x)
    elif x > root.val:
        root.right = delete(root.right, x)
    else:
        if not root.left:
            return root.right
        if not root.right:
            return root.left
        succ = root.right
        while succ.left:
            succ = succ.left
        root.val = succ.val
        root.right = delete(root.right, succ.val)
    return root
`,
      driver: code`def run(values, ops):
    root = build_tree(values)
    for op, x in ops:
        root = insert(root, x) if op == "insert" else delete(root, x)
    out, st, node = [], [], root
    while st or node:
        while node:
            st.append(node)
            node = node.left
        node = st.pop()
        out.append(node.val)
        node = node.right
    return [out, tree_values(root)]`,
      explanation: md('Each operation follows one root-to-leaf path: O(h), which is O(log n) when balanced and O(n) in the worst case — the motivation for AVL / red-black trees.'),
      tests: [
        ex('Example', [5, 3, 6, 2, 4, null, 7], [['delete', 3], ['insert', 1]]),
        ex('Delete root', [5, 3, 8], [['delete', 5]]),
        hid('From empty', [], [['insert', 2], ['insert', 1], ['insert', 3], ['delete', 9]]),
        hid('Delete leaf and missing', [2, 1, 3], [['delete', 1], ['delete', 1], ['insert', 2]]),
      ],
    }),

    dsa({
      ...B,
      id: 'dsa-validate-bst',
      title: 'Is This Really a Binary Search Tree?',
      difficulty: 'Medium',
      patterns: ['Pass down (low, high) bounds'],
      summary: 'Every node must lie strictly between the bounds set by its ancestors.',
      description: md('Write `is_bst(root)` — left subtree values strictly less, right subtree values strictly greater, recursively.'),
      hints: ['Checking only parent–child pairs is wrong; carry bounds.'],
      signature: 'is_bst(root: TreeNode | None) -> bool',
      runSignature: 'run(values: list) -> bool',
      solution: code`def is_bst(root):
    def ok(node, lo, hi):
        if not node:
            return True
        if not (lo < node.val < hi):
            return False
        return ok(node.left, lo, node.val) and ok(node.right, node.val, hi)
    return ok(root, float("-inf"), float("inf"))
`,
      driver: code`def run(values):
    return is_bst(build_tree(values))`,
      explanation: md('A deep node can violate an ancestor’s bound while satisfying its parent. Bounds (or an increasing inorder sequence) catch it. O(n).'),
      tests: [
        ex('Valid', [2, 1, 3]),
        ex('Deep violation', [5, 4, 6, null, null, 3, 7]),
        hid('Duplicate', [2, 2]),
        hid('Empty', []),
      ],
    }),

    dsa({
      ...B,
      id: 'dsa-kth-in-bst',
      title: 'k-th Smallest and k-th Largest in a BST',
      difficulty: 'Medium',
      patterns: ['Inorder / reverse inorder with early stop'],
      summary: 'Find both order statistics without collecting all values.',
      description: md('Write `kth(root, k)` returning `[kth_smallest, kth_largest]` (1-based, k ≤ size).'),
      hints: ['Iterative inorder stops after k pops; reverse inorder (right first) gives the largest.'],
      signature: 'kth(root: TreeNode, k: int) -> list[int]',
      runSignature: 'run(values: list, k: int) -> list[int]',
      solution: code`def kth(root, k):
    def walk(first, second):
        st, node, count = [], root, 0
        while st or node:
            while node:
                st.append(node)
                node = getattr(node, first)
            node = st.pop()
            count += 1
            if count == k:
                return node.val
            node = getattr(node, second)
    return [walk("left", "right"), walk("right", "left")]
`,
      driver: code`def run(values, k):
    return kth(build_tree(values), k)`,
      explanation: md('Stopping early makes it O(h + k). If the tree is queried often, storing subtree sizes gives O(h) per query.'),
      tests: [
        ex('Example', [3, 1, 4, null, 2], 1),
        ex('Middle', [5, 3, 6, 2, 4, null, null, 1], 3),
        hid('Single', [9], 1),
        hid('Last', [2, 1, 3], 3),
      ],
    }),

    dsa({
      ...B,
      id: 'dsa-bst-lca',
      title: 'Lowest Common Ancestor in a BST',
      difficulty: 'Easy',
      patterns: ['Walk until the values split'],
      summary: 'Use ordering to find the LCA in O(h).',
      description: md('Write `bst_lca(root, p, q)` returning the value of the lowest node that has both `p` and `q` in its subtree (a node counts as its own descendant).'),
      hints: ['If both are smaller go left; both larger go right; otherwise this is the split point.'],
      signature: 'bst_lca(root: TreeNode, p: int, q: int) -> int',
      runSignature: 'run(values: list, p: int, q: int) -> int',
      solution: code`def bst_lca(root, p, q):
    node = root
    while node:
        if p < node.val and q < node.val:
            node = node.left
        elif p > node.val and q > node.val:
            node = node.right
        else:
            return node.val
`,
      driver: code`def run(values, p, q):
    return bst_lca(build_tree(values), p, q)`,
      explanation: md('The first node whose value lies between p and q is the LCA — no need to explore both subtrees as in a general tree.'),
      tests: [
        ex('Example', [6, 2, 8, 0, 4, 7, 9, null, null, 3, 5], 2, 8),
        ex('Ancestor itself', [6, 2, 8, 0, 4, 7, 9, null, null, 3, 5], 2, 4),
        hid('Deep', [6, 2, 8, 0, 4, 7, 9, null, null, 3, 5], 3, 5),
        hid('Root split', [2, 1, 3], 1, 3),
      ],
    }),

    dsa({
      ...B,
      id: 'dsa-bst-neighbours',
      title: 'Floor, Ceiling, Predecessor and Successor in a BST',
      difficulty: 'Medium',
      patterns: ['Track best candidate on the search path'],
      summary: 'Four neighbour queries answered by a single root-to-leaf walk each.',
      description: md('Write `neighbours(root, x)` returning `[floor, ceil, predecessor, successor]`: floor = largest ≤ x, ceil = smallest ≥ x, predecessor = largest < x, successor = smallest > x (`None` when absent). `x` need not be in the tree.'),
      hints: ['Walk down; whenever a node qualifies as a candidate, record it and move toward a better one.'],
      signature: 'neighbours(root: TreeNode | None, x: int) -> list',
      runSignature: 'run(values: list, x: int) -> list',
      solution: code`def neighbours(root, x):
    def search(better_left):
        best, node = None, root
        while node:
            if better_left(node.val):
                best = node.val
                node = node.right
            else:
                node = node.left
        return best

    def search_up(qualifies):
        best, node = None, root
        while node:
            if qualifies(node.val):
                best = node.val
                node = node.left
            else:
                node = node.right
        return best

    return [search(lambda v: v <= x), search_up(lambda v: v >= x), search(lambda v: v < x), search_up(lambda v: v > x)]
`,
      driver: code`def run(values, x):
    return neighbours(build_tree(values), x)`,
      explanation: md('Each query is O(h): when the current node qualifies, the answer is it or something closer in the direction of x.'),
      tests: [
        ex('Example', [8, 4, 12, 2, 6, 10, 14], 11),
        ex('Present value', [8, 4, 12, 2, 6, 10, 14], 6),
        hid('Below everything', [5, 3, 7], 1),
        hid('Above everything', [5, 3, 7], 9),
      ],
    }),

    dsa({
      ...B,
      id: 'dsa-bst-from-preorder',
      title: 'Build a BST from Its Preorder Sequence',
      difficulty: 'Medium',
      patterns: ['Upper-bound recursion'],
      summary: 'Reconstruct the unique BST in O(n).',
      description: md('Write `bst_from_preorder(preorder)` returning the root; the driver returns the level order.'),
      hints: ['Recurse with an upper bound: consume values while they are below the bound.'],
      signature: 'bst_from_preorder(preorder: list[int]) -> TreeNode | None',
      runSignature: 'run(preorder: list[int]) -> list',
      solution: code`def bst_from_preorder(preorder):
    i = 0

    def build(bound):
        nonlocal i
        if i == len(preorder) or preorder[i] > bound:
            return None
        node = TreeNode(preorder[i])
        i += 1
        node.left = build(node.val)
        node.right = build(bound)
        return node

    return build(float("inf"))
`,
      driver: code`def run(preorder):
    return tree_values(bst_from_preorder(preorder))`,
      explanation: md('Inserting one by one is O(n²) worst case; the bound trick consumes each value once: O(n).'),
      tests: [
        ex('Example', [8, 5, 1, 7, 10, 12]),
        ex('Increasing', [1, 2, 3]),
        hid('Single', [4]),
        hid('Decreasing', [3, 2, 1]),
      ],
    }),

    dsa({
      ...B,
      id: 'dsa-sorted-to-balanced-bst',
      title: 'Turn a Sorted List into a Height-Balanced BST',
      difficulty: 'Easy',
      patterns: ['Middle element as root'],
      summary: 'Pick the (left) middle as root recursively.',
      description: md('Write `sorted_to_bst(nums)` using the **left-middle** element `(lo + hi) // 2` as each root. Return the root; the driver returns level order.'),
      hints: ['Recurse on [lo, mid − 1] and [mid + 1, hi].'],
      signature: 'sorted_to_bst(nums: list[int]) -> TreeNode | None',
      runSignature: 'run(nums: list[int]) -> list',
      solution: code`def sorted_to_bst(nums):
    def build(lo, hi):
        if lo > hi:
            return None
        mid = (lo + hi) // 2
        node = TreeNode(nums[mid])
        node.left = build(lo, mid - 1)
        node.right = build(mid + 1, hi)
        return node
    return build(0, len(nums) - 1)
`,
      driver: code`def run(nums):
    return tree_values(sorted_to_bst(nums))`,
      explanation: md('Splitting at the middle keeps subtree sizes within one of each other, so height is ⌈log₂(n + 1)⌉. O(n).'),
      tests: [
        ex('Example', [-10, -3, 0, 5, 9]),
        ex('Two', [1, 3]),
        hid('Seven', [1, 2, 3, 4, 5, 6, 7]),
        hid('Empty', []),
      ],
    }),

    dsa({
      ...B,
      id: 'dsa-bst-pair-sum',
      title: 'Two Values in a BST That Sum to k (Two Iterators)',
      difficulty: 'Medium',
      topics: ['Binary Search Trees', 'Two Pointers', 'Design'],
      patterns: ['Forward and backward BST iterators'],
      summary: 'Implement a BST iterator and use two of them like two pointers.',
      description: md('Implement `BSTIterator(root, reverse=False)` with `next()` and `has_next()` (ascending, or descending when `reverse`), each amortised O(1) with O(h) memory. Then `pair_sum(root, k)` returns the pair `[a, b]` (a < b) with the smallest `a` that sums to k, or `[]`.'),
      hints: ['Push the left spine (or right spine for reverse); after popping, push the spine of the other child.'],
      starter: code`class BSTIterator:
    def __init__(self, root, reverse=False):
        pass

    def has_next(self):
        pass

    def next(self):
        pass

def pair_sum(root, k):
    pass
`,
      signature: 'pair_sum(root: TreeNode | None, k: int) -> list[int]',
      runSignature: 'run(values: list, k: int) -> list',
      solution: code`class BSTIterator:
    def __init__(self, root, reverse=False):
        self.reverse = reverse
        self.stack = []
        self._push(root)

    def _push(self, node):
        while node:
            self.stack.append(node)
            node = node.right if self.reverse else node.left

    def has_next(self):
        return bool(self.stack)

    def next(self):
        node = self.stack.pop()
        self._push(node.left if self.reverse else node.right)
        return node.val

def pair_sum(root, k):
    lo, hi = BSTIterator(root), BSTIterator(root, reverse=True)
    if not lo.has_next():
        return []
    a, b = lo.next(), hi.next()
    while a < b:
        s = a + b
        if s == k:
            return [a, b]
        if s < k:
            if not lo.has_next():
                break
            a = lo.next()
        else:
            if not hi.has_next():
                break
            b = hi.next()
    return []
`,
      driver: code`def run(values, k):
    root = build_tree(values)
    it, seen = BSTIterator(root), []
    while it.has_next() and len(seen) < 1000:
        seen.append(it.next())
    return [seen, pair_sum(root, k)]`,
      explanation: md('Two lazy iterators give the sorted order from both ends without materialising it: O(n) time, O(h) space for the pair search.'),
      tests: [
        ex('Example', [5, 3, 6, 2, 4, null, 7], 9),
        ex('None', [5, 3, 6, 2, 4, null, 7], 28),
        hid('Smallest a wins', [4, 2, 6, 1, 3, 5, 7], 8),
        hid('Single node', [5], 10),
      ],
    }),

    dsa({
      ...B,
      id: 'dsa-recover-swapped-bst',
      title: 'Fix a BST Where Two Values Were Swapped',
      difficulty: 'Hard',
      patterns: ['Find inversions in the inorder sequence'],
      summary: 'Exactly two nodes have swapped values — restore the tree without changing its shape.',
      description: md('Write `recover(root)` that swaps the two misplaced values back in place. The driver returns the level order.'),
      hints: ['In the inorder walk, the first inversion’s larger value and the last inversion’s smaller value are the swapped pair (adjacent nodes give a single inversion).'],
      signature: 'recover(root: TreeNode) -> None',
      runSignature: 'run(values: list) -> list',
      solution: code`def recover(root):
    first = second = prev = None
    st, node = [], root
    while st or node:
        while node:
            st.append(node)
            node = node.left
        node = st.pop()
        if prev and prev.val > node.val:
            if not first:
                first = prev
            second = node
        prev = node
        node = node.right
    first.val, second.val = second.val, first.val
`,
      driver: code`def run(values):
    root = build_tree(values)
    recover(root)
    return tree_values(root)`,
      explanation: md('A sorted sequence with two elements swapped has one or two descents; identifying them is O(n) time and O(h) space (O(1) with Morris traversal).'),
      tests: [
        ex('Example', [1, 3, null, null, 2]),
        ex('Across the root', [3, 1, 4, null, null, 2]),
        hid('Adjacent', [2, 3, 1]),
        hid('Far apart', [6, 2, 8, 9, 4, 7, 1]),
      ],
    }),

    dsa({
      ...B,
      id: 'dsa-largest-bst-subtree',
      title: 'Largest Subtree That Is a Valid BST',
      difficulty: 'Hard',
      topics: ['Binary Search Trees', 'Binary Trees'],
      patterns: ['Post-order returning (size, min, max)'],
      summary: 'Size of the biggest subtree satisfying the BST property.',
      description: md('Write `largest_bst(root)` returning the number of nodes in the largest subtree (a node and all its descendants) that is a BST.'),
      hints: ['Return (is_bst, size, min, max) from each child; combine at the parent.'],
      signature: 'largest_bst(root: TreeNode | None) -> int',
      runSignature: 'run(values: list) -> int',
      solution: code`def largest_bst(root):
    best = 0
    INF = float("inf")

    def go(node):
        nonlocal best
        if not node:
            return True, 0, INF, -INF
        lb, ls, lmin, lmax = go(node.left)
        rb, rs, rmin, rmax = go(node.right)
        if lb and rb and lmax < node.val < rmin:
            size = ls + rs + 1
            best = max(best, size)
            return True, size, min(lmin, node.val), max(rmax, node.val)
        return False, 0, -INF, INF

    go(root)
    return best
`,
      driver: code`def run(values):
    return largest_bst(build_tree(values))`,
      explanation: md('Bottom-up summaries let each node decide in O(1) whether it roots a BST: O(n) total, versus O(n²) for validating every subtree independently.'),
      tests: [
        ex('Example', [10, 5, 15, 1, 8, null, 7]),
        ex('Whole tree', [2, 1, 3]),
        hid('Empty', []),
        hid('Only leaves', [5, 6, 4]),
      ],
    }),

    dsa({
      ...B,
      id: 'dsa-merge-two-bsts',
      title: 'All Values from Two BSTs in Sorted Order',
      difficulty: 'Medium',
      topics: ['Binary Search Trees', 'Sorting'],
      patterns: ['Two inorder iterators merged'],
      summary: 'Merge two BSTs into one sorted list in O(n + m).',
      description: md('Write `merge_bsts(a, b)` returning every value from both trees ascending (duplicates kept).'),
      hints: ['Run two iterative inorder traversals in lockstep, like merging two sorted lists.'],
      signature: 'merge_bsts(a: TreeNode | None, b: TreeNode | None) -> list[int]',
      runSignature: 'run(a: list, b: list) -> list[int]',
      solution: code`def merge_bsts(a, b):
    def push(st, node):
        while node:
            st.append(node)
            node = node.left

    sa, sb, out = [], [], []
    push(sa, a)
    push(sb, b)
    while sa or sb:
        if sb and (not sa or sb[-1].val < sa[-1].val):
            node = sb.pop()
            push(sb, node.right)
        else:
            node = sa.pop()
            push(sa, node.right)
        out.append(node.val)
    return out
`,
      driver: code`def run(a, b):
    return merge_bsts(build_tree(a), build_tree(b))`,
      explanation: md('Lazy inorder iteration avoids materialising both lists first; memory is O(h₁ + h₂).'),
      tests: [
        ex('Example', [2, 1, 4], [1, 0, 3]),
        ex('One empty', [], [5, 1, 7]),
        hid('Interleaved', [5, 3, 7], [4, 2, 6]),
        hid('Both empty', [], []),
      ],
    }),

    dsa({
      id: 'dsa-trie-basic',
      title: 'Implement a Trie: insert, search, starts_with',
      difficulty: 'Medium',
      topics: ['Tries', 'Design'],
      patterns: ['Nested child maps with an end flag'],
      summary: 'A prefix tree for word lookup and prefix queries.',
      description: md('Implement `Trie` with `insert(word)`, `search(word)` (exact word present?) and `starts_with(prefix)`. The tests run a list of operations.'),
      hints: ['Each node: dict of children + is_end flag.'],
      starter: code`class Trie:
    def __init__(self):
        pass

    def insert(self, word):
        pass

    def search(self, word):
        pass

    def starts_with(self, prefix):
        pass
`,
      signature: 'Trie',
      runSignature: 'run(ops: list[list]) -> list',
      solution: code`class Trie:
    def __init__(self):
        self.root = {}

    def insert(self, word):
        node = self.root
        for ch in word:
            node = node.setdefault(ch, {})
        node["$"] = True

    def _walk(self, s):
        node = self.root
        for ch in s:
            if ch not in node:
                return None
            node = node[ch]
        return node

    def search(self, word):
        node = self._walk(word)
        return bool(node and node.get("$"))

    def starts_with(self, prefix):
        return self._walk(prefix) is not None
`,
      driver: code`def run(ops):
    obj, out = None, []
    for op in ops:
        if op[0] == "new":
            obj = Trie()
            out.append(None)
        else:
            out.append(getattr(obj, op[0])(*op[1:]))
    return out`,
      explanation: md('Operations cost O(L) for a word of length L regardless of how many words are stored — the basis of autocomplete and spell-checkers.'),
      tests: [
        ex('Example', [['new'], ['insert', 'apple'], ['search', 'apple'], ['search', 'app'], ['starts_with', 'app'], ['insert', 'app'], ['search', 'app']]),
        ex('Empty prefix', [['new'], ['starts_with', ''], ['search', '']]),
        hid('Shared prefixes', [['new'], ['insert', 'car'], ['insert', 'cart'], ['search', 'cart'], ['search', 'ca'], ['starts_with', 'carts']]),
        hid('Empty word inserted', [['new'], ['insert', ''], ['search', '']]),
      ],
    }),

    dsa({
      id: 'dsa-trie-counts',
      title: 'A Trie That Counts Words and Prefixes (with Erase)',
      difficulty: 'Medium',
      topics: ['Tries', 'Design'],
      patterns: ['Per-node pass and end counters'],
      summary: 'Count exact words, count words with a prefix, and erase one occurrence.',
      description: md('Implement `CountingTrie` with `insert(word)`, `count_equal(word)`, `count_prefix(prefix)` and `erase(word)` (removes one occurrence; guaranteed to exist).'),
      hints: ['Store at each node how many words pass through it and how many end there; erase decrements along the path.'],
      starter: code`class CountingTrie:
    def __init__(self):
        pass

    def insert(self, word):
        pass

    def count_equal(self, word):
        pass

    def count_prefix(self, prefix):
        pass

    def erase(self, word):
        pass
`,
      signature: 'CountingTrie',
      runSignature: 'run(ops: list[list]) -> list',
      solution: code`class _TNode:
    __slots__ = ("kids", "passing", "ending")

    def __init__(self):
        self.kids, self.passing, self.ending = {}, 0, 0


class CountingTrie:
    def __init__(self):
        self.root = _TNode()

    def insert(self, word):
        node = self.root
        for ch in word:
            node = node.kids.setdefault(ch, _TNode())
            node.passing += 1
        node.ending += 1

    def _walk(self, s):
        node = self.root
        for ch in s:
            node = node.kids.get(ch)
            if node is None:
                return None
        return node

    def count_equal(self, word):
        node = self._walk(word)
        return node.ending if node else 0

    def count_prefix(self, prefix):
        node = self._walk(prefix)
        return node.passing if node else 0

    def erase(self, word):
        node = self.root
        for ch in word:
            child = node.kids[ch]
            child.passing -= 1
            if child.passing == 0:
                del node.kids[ch]
                return
            node = child
        node.ending -= 1
`,
      driver: code`def run(ops):
    obj, out = None, []
    for op in ops:
        if op[0] == "new":
            obj = CountingTrie()
            out.append(None)
        else:
            out.append(getattr(obj, op[0])(*op[1:]))
    return out`,
      explanation: md('Counters on nodes answer frequency queries in O(L); pruning nodes whose pass count drops to 0 keeps memory proportional to live words.'),
      tests: [
        ex('Example', [['new'], ['insert', 'apple'], ['insert', 'apple'], ['count_equal', 'apple'], ['count_prefix', 'app'], ['erase', 'apple'], ['count_equal', 'apple'], ['count_prefix', 'app'], ['erase', 'apple'], ['count_prefix', 'app']]),
        ex('Prefix not word', [['new'], ['insert', 'data'], ['count_equal', 'dat'], ['count_prefix', 'dat']]),
        hid('Several words', [['new'], ['insert', 'sea'], ['insert', 'seat'], ['insert', 'see'], ['count_prefix', 'se'], ['erase', 'seat'], ['count_prefix', 'sea'], ['count_equal', 'sea']]),
        hid('Unknown prefix', [['new'], ['count_prefix', 'x'], ['count_equal', 'x']]),
      ],
    }),

    dsa({
      id: 'dsa-longest-buildable-word',
      title: 'Longest Word Whose Every Prefix Is Also a Word',
      difficulty: 'Medium',
      topics: ['Tries', 'Strings'],
      patterns: ['Trie walk checking end flags'],
      summary: 'The longest word buildable one letter at a time from other words.',
      description: md('Return the longest word in `words` such that every prefix of it is also in `words` (lexicographically smallest on ties; `""` if none).'),
      hints: ['Insert all words in a trie; a word qualifies if every node on its path is a word end.'],
      signature: 'longest_buildable(words: list[str]) -> str',
      solution: code`def longest_buildable(words: list[str]) -> str:
    root = {}
    for w in words:
        node = root
        for ch in w:
            node = node.setdefault(ch, {})
        node["$"] = True
    best = ""
    for w in words:
        node, ok = root, True
        for ch in w:
            node = node[ch]
            if "$" not in node:
                ok = False
                break
        if ok and (len(w) > len(best) or (len(w) == len(best) and w < best)):
            best = w
    return best
`,
      explanation: md('Checking each prefix against a set is O(L²) per word (slicing); the trie checks all prefixes in one O(L) walk.'),
      tests: [
        ex('Example', ['w', 'wo', 'wor', 'worl', 'world']),
        ex('Tie', ['a', 'banana', 'app', 'appl', 'ap', 'apply', 'apple']),
        hid('None', ['abc', 'bc']),
        hid('Empty list', []),
      ],
    }),

    dsa({
      id: 'dsa-distinct-substrings',
      title: 'How Many Distinct Substrings?',
      difficulty: 'Medium',
      topics: ['Tries', 'Strings'],
      patterns: ['Insert every suffix into a trie'],
      summary: 'Count distinct non-empty substrings using a trie of suffixes.',
      description: md('Return the number of distinct **non-empty** substrings of `s`.'),
      hints: ['Every new trie node created while inserting all suffixes is a new distinct substring.'],
      signature: 'count_distinct_substrings(s: str) -> int',
      solution: code`def count_distinct_substrings(s: str) -> int:
    root, count = {}, 0
    for i in range(len(s)):
        node = root
        for ch in s[i:]:
            if ch not in node:
                node[ch] = {}
                count += 1
            node = node[ch]
    return count
`,
      explanation: md('O(n²) nodes at most; suffix automata or suffix arrays bring this to O(n) / O(n log n).'),
      tests: [
        ex('Example', 'abab'),
        ex('Repeated', 'aaa'),
        hid('Distinct letters', 'abc'),
        hid('Empty', ''),
      ],
    }),

    dsa({
      id: 'dsa-max-xor-pair',
      title: 'Maximum XOR of Any Two Numbers',
      difficulty: 'Medium',
      topics: ['Tries', 'Bit Manipulation'],
      patterns: ['Binary trie, greedy opposite bit'],
      summary: 'max(a ^ b) over all pairs in O(n · 31).',
      description: md('Return the maximum `nums[i] ^ nums[j]` over all pairs (i may equal j). Values are non-negative and < 2^31.'),
      hints: ['Insert numbers bit by bit (MSB first); for each number walk the trie preferring the opposite bit.'],
      signature: 'max_xor(nums: list[int]) -> int',
      solution: code`def max_xor(nums: list[int]) -> int:
    root, best = {}, 0
    for x in nums:
        node = root
        for b in range(30, -1, -1):
            node = node.setdefault((x >> b) & 1, {})
    for x in nums:
        node, cur = root, 0
        for b in range(30, -1, -1):
            bit = (x >> b) & 1
            if 1 - bit in node:
                cur |= 1 << b
                node = node[1 - bit]
            else:
                node = node[bit]
        best = max(best, cur)
    return best
`,
      explanation: md('Greedily matching the opposite bit from the top maximises XOR because a higher bit outweighs all lower bits combined.'),
      tests: [
        ex('Example', [3, 10, 5, 25, 2, 8]),
        ex('Two', [0, 7]),
        hid('Single', [4]),
        hid('Large', [14, 70, 53, 83, 49, 91, 36, 80, 92, 51, 66, 70]),
      ],
    }),

    dsa({
      id: 'dsa-max-xor-with-limit',
      title: 'Maximum XOR with an Element Not Exceeding a Limit',
      difficulty: 'Hard',
      topics: ['Tries', 'Bit Manipulation', 'Sorting'],
      patterns: ['Offline queries sorted by limit'],
      summary: 'For each query [x, m], max x ^ a over a ≤ m (−1 if none).',
      description: md('For each query `[x, m]` return the maximum `x ^ a` over elements `a` of `nums` with `a <= m`, or −1 if no element qualifies.'),
      hints: ['Sort nums and queries by m; insert nums ≤ m into the binary trie before answering each query.'],
      signature: 'max_xor_queries(nums: list[int], queries: list[list[int]]) -> list[int]',
      solution: code`def max_xor_queries(nums: list[int], queries: list[list[int]]) -> list[int]:
    nums = sorted(nums)
    order = sorted(range(len(queries)), key=lambda i: queries[i][1])
    root, out, j, size = {}, [-1] * len(queries), 0, 0
    for qi in order:
        x, m = queries[qi]
        while j < len(nums) and nums[j] <= m:
            node = root
            for b in range(30, -1, -1):
                node = node.setdefault((nums[j] >> b) & 1, {})
            j += 1
            size += 1
        if size == 0:
            continue
        node, cur = root, 0
        for b in range(30, -1, -1):
            bit = (x >> b) & 1
            if 1 - bit in node:
                cur |= 1 << b
                node = node[1 - bit]
            else:
                node = node[bit]
        out[qi] = cur
    return out
`,
      explanation: md('Processing queries offline in order of their limit lets the trie grow monotonically: O((n + q) · 31 + sorting).'),
      tests: [
        ex('Example', [0, 1, 2, 3, 4], [[3, 1], [1, 3], [5, 6]]),
        ex('Another', [5, 2, 4, 6, 6, 3], [[12, 4], [8, 1], [6, 3]]),
        hid('Nothing small enough', [10, 20], [[1, 5]]),
        hid('Repeated limits', [1, 2, 3], [[0, 3], [7, 3], [1, 1]]),
      ],
    }),
  ],
};
