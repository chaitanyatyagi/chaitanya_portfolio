// DSA pack 09 — binary trees with real TreeNode objects (built from a
// level-order list): all traversals (iterative + Morris), depth, balance,
// diameter, max path sum, identical/symmetric, zigzag, boundary, vertical /
// top / bottom / side views, max width, root-to-node path, LCA, nodes at
// distance k, burn time, complete-tree count, building from traversals,
// serialise / deserialise, flatten, invert, root-to-leaf sums and paths.
import { dsa, md, code, ex, hid } from './define.js';

const T = { prelude: 'tree', topics: ['Binary Trees'] };
const call = (fn) => code`def run(values):
    return ${fn}(build_tree(values))`;

export default {
  problems: [
    dsa({
      ...T,
      id: 'dsa-tree-traversals',
      title: 'Pre-, In- and Post-Order Without Recursion',
      difficulty: 'Medium',
      topics: ['Binary Trees', 'Stacks & Queues'],
      patterns: ['Explicit stack traversals'],
      summary: 'Return all three depth-first orders using stacks instead of recursion.',
      description: md('Write `traversals(root)` returning `[preorder, inorder, postorder]` value lists, implemented iteratively with explicit stacks.'),
      hints: ['Preorder: pop, visit, push right then left. Inorder: go left pushing, pop, visit, go right. Postorder: reverse of a root-right-left preorder.'],
      signature: 'traversals(root: TreeNode | None) -> list[list[int]]',
      runSignature: 'run(values: list) -> list[list[int]]',
      solution: code`def traversals(root):
    pre, st = [], [root] if root else []
    while st:
        node = st.pop()
        pre.append(node.val)
        if node.right:
            st.append(node.right)
        if node.left:
            st.append(node.left)
    ino, st, node = [], [], root
    while st or node:
        while node:
            st.append(node)
            node = node.left
        node = st.pop()
        ino.append(node.val)
        node = node.right
    post, st = [], [root] if root else []
    while st:
        node = st.pop()
        post.append(node.val)
        if node.left:
            st.append(node.left)
        if node.right:
            st.append(node.right)
    return [pre, ino, post[::-1]]
`,
      driver: call('traversals'),
      explanation: md('Iterative traversals avoid recursion limits on deep trees and are a frequent follow-up question. Each is O(n) time, O(h) stack.'),
      tests: [
        ex('Example', [1, 2, 3, 4, 5, null, 6]),
        ex('Right chain', [1, null, 2, null, 3]),
        hid('Single', [7]),
        hid('Empty', []),
      ],
    }),

    dsa({
      ...T,
      id: 'dsa-morris-inorder',
      title: 'Inorder Traversal in O(1) Extra Space (Morris)',
      difficulty: 'Hard',
      patterns: ['Threaded tree'],
      summary: 'Visit nodes in order by temporarily threading predecessors to their successors.',
      description: md('Write `morris_inorder(root)` that returns the inorder values without recursion or a stack, and restores the tree. The driver also checks that the tree is unchanged afterwards.'),
      hints: ['For each node with a left child, find its inorder predecessor; if its right is empty, thread it to the node and go left; if threaded, remove it, visit, go right.'],
      signature: 'morris_inorder(root: TreeNode | None) -> list[int]',
      runSignature: 'run(values: list) -> list',
      solution: code`def morris_inorder(root):
    out, node = [], root
    while node:
        if node.left is None:
            out.append(node.val)
            node = node.right
        else:
            pred = node.left
            while pred.right and pred.right is not node:
                pred = pred.right
            if pred.right is None:
                pred.right = node
                node = node.left
            else:
                pred.right = None
                out.append(node.val)
                node = node.right
    return out
`,
      driver: code`def run(values):
    root = build_tree(values)
    order = morris_inorder(root)
    return [order, tree_values(root) == tree_values(build_tree(values))]`,
      explanation: md('Each edge is threaded and un-threaded once, so the traversal is O(n) time with O(1) extra space — useful for BST validation or k-th smallest under memory limits.'),
      tests: [
        ex('Example', [4, 2, 6, 1, 3, 5, 7]),
        ex('Left chain', [3, 2, null, 1]),
        hid('Single', [1]),
        hid('Irregular', [1, 2, 3, null, 4, 5]),
      ],
    }),

    dsa({
      ...T,
      id: 'dsa-level-order',
      title: 'Level-by-Level Values (and Zigzag)',
      difficulty: 'Medium',
      topics: ['Binary Trees', 'Stacks & Queues'],
      patterns: ['BFS by levels'],
      summary: 'Return levels top-down, and the same levels in alternating direction.',
      description: md('Write `levels(root)` returning `[level_order, zigzag]`: a list of value lists per depth, and the zigzag order (left→right, then right→left, alternating).'),
      hints: ['Process the queue one level at a time using its current length.'],
      signature: 'levels(root: TreeNode | None) -> list',
      runSignature: 'run(values: list) -> list',
      solution: code`def levels(root):
    out, q = [], deque([root] if root else [])
    while q:
        row = []
        for _ in range(len(q)):
            node = q.popleft()
            row.append(node.val)
            if node.left:
                q.append(node.left)
            if node.right:
                q.append(node.right)
        out.append(row)
    zig = [row if i % 2 == 0 else row[::-1] for i, row in enumerate(out)]
    return [out, zig]
`,
      driver: call('levels'),
      explanation: md('Snapshotting the queue length separates levels without sentinels. O(n).'),
      tests: [
        ex('Example', [3, 9, 20, null, null, 15, 7]),
        ex('Full', [1, 2, 3, 4, 5, 6, 7]),
        hid('Empty', []),
        hid('Deep left', [1, 2, null, 3, null, 4]),
      ],
    }),

    dsa({
      ...T,
      id: 'dsa-height-and-balance',
      title: 'Tree Height and Is It Height-Balanced?',
      difficulty: 'Easy',
      patterns: ['Post-order with sentinel'],
      summary: 'Max depth, min depth, and whether every node’s subtrees differ in height by ≤ 1.',
      description: md('Write `shape(root)` returning `[max_depth, min_depth, balanced]` where min depth counts nodes down to the nearest **leaf** (0 for an empty tree).'),
      hints: ['Return −1 from the helper as soon as an unbalanced subtree is found to keep it O(n).'],
      signature: 'shape(root: TreeNode | None) -> list',
      runSignature: 'run(values: list) -> list',
      solution: code`def shape(root):
    def height(node):
        if not node:
            return 0
        l, r = height(node.left), height(node.right)
        if l < 0 or r < 0 or abs(l - r) > 1:
            return -1
        return 1 + max(l, r)

    def max_depth(node):
        return 0 if not node else 1 + max(max_depth(node.left), max_depth(node.right))

    def min_depth(node):
        if not node:
            return 0
        if not node.left or not node.right:
            return 1 + min_depth(node.left or node.right)
        return 1 + min(min_depth(node.left), min_depth(node.right))

    return [max_depth(root), min_depth(root), height(root) >= 0]
`,
      driver: call('shape'),
      explanation: md('Checking balance top-down recomputes heights (O(n²)); returning a sentinel from one bottom-up pass is O(n). Min depth must not treat a missing child as a leaf.'),
      tests: [
        ex('Example', [3, 9, 20, null, null, 15, 7]),
        ex('Unbalanced', [1, 2, 2, 3, 3, null, null, 4, 4]),
        hid('One-sided', [1, null, 2]),
        hid('Empty', []),
      ],
    }),

    dsa({
      ...T,
      id: 'dsa-tree-diameter',
      title: 'Longest Path Between Any Two Nodes',
      difficulty: 'Easy',
      patterns: ['Height recursion with a global best'],
      summary: 'Diameter in edges.',
      description: md('Write `diameter(root)` returning the number of edges on the longest path between any two nodes.'),
      hints: ['At each node the longest path through it is left height + right height.'],
      signature: 'diameter(root: TreeNode | None) -> int',
      runSignature: 'run(values: list) -> int',
      solution: code`def diameter(root):
    best = 0

    def height(node):
        nonlocal best
        if not node:
            return 0
        l, r = height(node.left), height(node.right)
        best = max(best, l + r)
        return 1 + max(l, r)

    height(root)
    return best
`,
      driver: call('diameter'),
      explanation: md('The diameter needn’t pass through the root, so track the best "bend" at every node during one O(n) height pass.'),
      tests: [
        ex('Example', [1, 2, 3, 4, 5]),
        ex('Two nodes', [1, 2]),
        hid('Not through root', [1, 2, null, 3, 4, 5, null, null, 6]),
        hid('Empty', []),
      ],
    }),

    dsa({
      ...T,
      id: 'dsa-max-path-sum',
      title: 'Highest-Sum Path Anywhere in the Tree',
      difficulty: 'Hard',
      patterns: ['Gain recursion with a global best'],
      summary: 'Maximum sum of any non-empty node path (values may be negative).',
      description: md('Write `max_path_sum(root)`: a path is any sequence of connected nodes, each used once; it need not pass the root. Return the largest sum.'),
      hints: ['Gain(node) = node.val + max(0, gain(left), gain(right)); the best path through node uses both sides’ positive gains.'],
      signature: 'max_path_sum(root: TreeNode) -> int',
      runSignature: 'run(values: list) -> int',
      solution: code`def max_path_sum(root):
    best = float("-inf")

    def gain(node):
        nonlocal best
        if not node:
            return 0
        l, r = max(0, gain(node.left)), max(0, gain(node.right))
        best = max(best, node.val + l + r)
        return node.val + max(l, r)

    gain(root)
    return best
`,
      driver: call('max_path_sum'),
      explanation: md('Negative branches are dropped (max with 0); a parent can only extend one side, but a path can bend at the current node. O(n).'),
      tests: [
        ex('Example', [1, 2, 3]),
        ex('Negatives', [-10, 9, 20, null, null, 15, 7]),
        hid('All negative', [-3, -1, -2]),
        hid('Bend below root', [5, 4, 8, 11, null, 13, 4, 7, 2, null, null, null, 1]),
      ],
    }),

    dsa({
      ...T,
      id: 'dsa-same-and-mirror',
      title: 'Identical Trees, and Is One the Mirror of the Other?',
      difficulty: 'Easy',
      patterns: ['Paired recursion'],
      summary: 'Compare two trees for equality and for mirror symmetry.',
      description: md('Write `compare(a, b)` returning `[identical, mirrored]`.'),
      hints: ['Mirrored: a.left vs b.right and a.right vs b.left.'],
      signature: 'compare(a: TreeNode | None, b: TreeNode | None) -> list[bool]',
      runSignature: 'run(a: list, b: list) -> list[bool]',
      solution: code`def compare(a, b):
    def same(x, y):
        if not x or not y:
            return x is y
        return x.val == y.val and same(x.left, y.left) and same(x.right, y.right)

    def mirror(x, y):
        if not x or not y:
            return x is y
        return x.val == y.val and mirror(x.left, y.right) and mirror(x.right, y.left)

    return [same(a, b), mirror(a, b)]
`,
      driver: code`def run(a, b):
    return compare(build_tree(a), build_tree(b))`,
      explanation: md('Walking both trees in lockstep is O(min(n, m)). Symmetry of one tree is `mirror(root.left, root.right)`.'),
      tests: [
        ex('Same', [1, 2, 3], [1, 2, 3]),
        ex('Mirror', [1, 2, 3], [1, 3, 2]),
        hid('Mirrored shapes', [1, 2], [1, null, 2]),
        hid('Both empty', [], []),
      ],
    }),

    dsa({
      ...T,
      id: 'dsa-boundary-walk',
      title: 'Walk the Boundary Anticlockwise',
      difficulty: 'Medium',
      patterns: ['Left edge + leaves + reversed right edge'],
      summary: 'Root, left boundary (no leaves), all leaves left→right, right boundary bottom-up.',
      description: md('Write `boundary(root)` returning the anticlockwise boundary: the root, then the left boundary top-down excluding leaves, then every leaf left to right, then the right boundary bottom-up excluding leaves. Each node appears once.'),
      hints: ['Left boundary: keep going left (or right if no left). Leaves via DFS. Right boundary collected top-down then reversed.'],
      signature: 'boundary(root: TreeNode | None) -> list[int]',
      runSignature: 'run(values: list) -> list[int]',
      solution: code`def boundary(root):
    if not root:
        return []
    leaf = lambda n: not n.left and not n.right
    out = [root.val]
    if leaf(root):
        return out
    node = root.left
    while node:
        if not leaf(node):
            out.append(node.val)
        node = node.left or node.right
    def leaves(n):
        if not n:
            return
        if leaf(n):
            out.append(n.val)
            return
        leaves(n.left)
        leaves(n.right)
    leaves(root)
    right, node = [], root.right
    while node:
        if not leaf(node):
            right.append(node.val)
        node = node.right or node.left
    return out + right[::-1]
`,
      driver: call('boundary'),
      explanation: md('Three separate walks, each O(h) or O(n), stitched together with care to avoid listing a node twice.'),
      tests: [
        ex('Example', [1, 2, 3, 4, 5, 6, 7, null, null, 8, 9]),
        ex('Root only right', [1, null, 2, 3, 4]),
        hid('Single', [5]),
        hid('Left chain', [1, 2, null, 3, null, 4]),
      ],
    }),

    dsa({
      ...T,
      id: 'dsa-vertical-columns',
      title: 'Vertical Columns, Top View and Bottom View',
      difficulty: 'Hard',
      topics: ['Binary Trees', 'Hashing'],
      patterns: ['BFS with column indices'],
      summary: 'Group nodes by horizontal distance; derive the views from the columns.',
      description: md(
        'Write `vertical(root)` returning `[columns, top_view, bottom_view]`:',
        '',
        '- `columns`: for each column from leftmost to rightmost, its values ordered by depth, then by value for nodes at the same depth and column.',
        '- `top_view`: the first node seen from above per column (shallowest; the leftmost in BFS order on ties).',
        '- `bottom_view`: the last node per column in BFS order (deepest; the later one on ties).',
      ),
      hints: ['BFS carrying (node, column, depth); bucket by column.'],
      signature: 'vertical(root: TreeNode | None) -> list',
      runSignature: 'run(values: list) -> list',
      solution: code`from collections import defaultdict

def vertical(root):
    if not root:
        return [[], [], []]
    cells, top, bottom = defaultdict(list), {}, {}
    q = deque([(root, 0, 0)])
    while q:
        node, col, depth = q.popleft()
        cells[col].append((depth, node.val))
        top.setdefault(col, node.val)
        bottom[col] = node.val
        if node.left:
            q.append((node.left, col - 1, depth + 1))
        if node.right:
            q.append((node.right, col + 1, depth + 1))
    cols = sorted(cells)
    return [[[v for _, v in sorted(cells[c])] for c in cols], [top[c] for c in cols], [bottom[c] for c in cols]]
`,
      driver: call('vertical'),
      explanation: md('One BFS gives every node its (column, depth); the three outputs are different projections of that table. O(n log n) for the sorting.'),
      tests: [
        ex('Example', [3, 9, 20, null, null, 15, 7]),
        ex('Same cell', [1, 2, 3, 4, 6, 5, 7]),
        hid('Skewed', [1, 2, null, 3, null, 4]),
        hid('Empty', []),
      ],
    }),

    dsa({
      ...T,
      id: 'dsa-side-views',
      title: 'What You See from the Left and from the Right',
      difficulty: 'Medium',
      patterns: ['First / last node per level'],
      summary: 'Left view and right view of a binary tree.',
      description: md('Write `side_views(root)` returning `[left_view, right_view]`: the first and last node of each level.'),
      hints: ['Level-order BFS; record row[0] and row[-1].'],
      signature: 'side_views(root: TreeNode | None) -> list',
      runSignature: 'run(values: list) -> list',
      solution: code`def side_views(root):
    left, right, q = [], [], deque([root] if root else [])
    while q:
        n = len(q)
        for i in range(n):
            node = q.popleft()
            if i == 0:
                left.append(node.val)
            if i == n - 1:
                right.append(node.val)
            if node.left:
                q.append(node.left)
            if node.right:
                q.append(node.right)
    return [left, right]
`,
      driver: call('side_views'),
      explanation: md('A DFS that visits the preferred side first and records the first node at each new depth works too, with O(h) memory.'),
      tests: [
        ex('Example', [1, 2, 3, null, 5, null, 4]),
        ex('Hidden deeper left', [1, 2, 3, 4]),
        hid('Single', [1]),
        hid('Empty', []),
      ],
    }),

    dsa({
      ...T,
      id: 'dsa-max-level-width',
      title: 'Widest Level (Counting Gaps)',
      difficulty: 'Medium',
      patterns: ['Heap-style position indices'],
      summary: 'Width between the leftmost and rightmost non-null nodes of any level.',
      description: md('Write `max_width(root)`: the width of a level is the distance between its leftmost and rightmost non-null nodes counting the null positions between them (as in a complete tree). Return the maximum.'),
      hints: ['Give the root index 0 and children 2i + 1, 2i + 2; subtract the level’s first index to keep numbers small.'],
      signature: 'max_width(root: TreeNode | None) -> int',
      runSignature: 'run(values: list) -> int',
      solution: code`def max_width(root):
    if not root:
        return 0
    best, q = 0, deque([(root, 0)])
    while q:
        base = q[0][1]
        first = last = 0
        for _ in range(len(q)):
            node, idx = q.popleft()
            idx -= base
            last = idx
            if node.left:
                q.append((node.left, 2 * idx + 1))
            if node.right:
                q.append((node.right, 2 * idx + 2))
        best = max(best, last - first + 1)
    return best
`,
      driver: call('max_width'),
      explanation: md('Complete-tree numbering measures gaps; normalising each level prevents indices from doubling into huge numbers on deep trees.'),
      tests: [
        ex('Example', [1, 3, 2, 5, 3, null, 9]),
        ex('Gap in the middle', [1, 3, 2, 5, null, null, 9, 6, null, 7]),
        hid('Single', [1]),
        hid('Narrow', [1, 2, null, 3]),
      ],
    }),

    dsa({
      ...T,
      id: 'dsa-path-to-node',
      title: 'Root-to-Node Path and Lowest Common Ancestor',
      difficulty: 'Medium',
      patterns: ['Return-the-found-node recursion'],
      summary: 'Path from the root to a target, and the LCA of two values.',
      description: md('Values are unique. Write `ancestry(root, a, b)` returning `[path_to_a, lca_of_a_and_b]` where the path lists values from the root to `a` (empty if absent).'),
      hints: ['LCA: if the node is a or b, return it; otherwise recurse; if both sides return non-null, this node is the LCA.'],
      signature: 'ancestry(root: TreeNode | None, a: int, b: int) -> list',
      runSignature: 'run(values: list, a: int, b: int) -> list',
      solution: code`def ancestry(root, a, b):
    path = []

    def find(node):
        if not node:
            return False
        path.append(node.val)
        if node.val == a or find(node.left) or find(node.right):
            return True
        path.pop()
        return False

    find(root)

    def lca(node):
        if not node or node.val in (a, b):
            return node
        l, r = lca(node.left), lca(node.right)
        return node if l and r else l or r

    found = lca(root)
    return [path, found.val if found else None]
`,
      driver: code`def run(values, a, b):
    return ancestry(build_tree(values), a, b)`,
      explanation: md('Both are single O(n) DFS passes. In a BST the LCA needs only one root-to-split walk.'),
      tests: [
        ex('Example', [3, 5, 1, 6, 2, 0, 8, null, null, 7, 4], 7, 4),
        ex('Ancestor of itself', [3, 5, 1, 6, 2, 0, 8, null, null, 7, 4], 5, 4),
        hid('Across the root', [3, 5, 1, 6, 2, 0, 8], 6, 8),
        hid('Missing target', [1, 2], 9, 2),
      ],
    }),

    dsa({
      ...T,
      id: 'dsa-distance-k-nodes',
      title: 'All Nodes Exactly k Edges Away',
      difficulty: 'Medium',
      topics: ['Binary Trees', 'Graphs: Traversal'],
      patterns: ['Parent pointers + BFS'],
      summary: 'Values of all nodes at distance k from a target node.',
      description: md('Values are unique. Write `distance_k(root, target, k)` returning the values of all nodes at exactly `k` edges from the node with value `target`, sorted ascending.'),
      hints: ['Record each node’s parent, then BFS from the target over left, right and parent.'],
      signature: 'distance_k(root: TreeNode | None, target: int, k: int) -> list[int]',
      runSignature: 'run(values: list, target: int, k: int) -> list[int]',
      solution: code`def distance_k(root, target, k):
    parent, start, q = {}, None, deque([root] if root else [])
    while q:
        node = q.popleft()
        if node.val == target:
            start = node
        for child in (node.left, node.right):
            if child:
                parent[child] = node
                q.append(child)
    if not start:
        return []
    seen, frontier = {start}, [start]
    for _ in range(k):
        nxt = []
        for node in frontier:
            for nb in (node.left, node.right, parent.get(node)):
                if nb and nb not in seen:
                    seen.add(nb)
                    nxt.append(nb)
        frontier = nxt
    return sorted(n.val for n in frontier)
`,
      driver: code`def run(values, target, k):
    return distance_k(build_tree(values), target, k)`,
      explanation: md('Adding parent edges turns the tree into an undirected graph, where "distance k" is a BFS layer. O(n).'),
      tests: [
        ex('Example', [3, 5, 1, 6, 2, 0, 8, null, null, 7, 4], 5, 2),
        ex('k = 0', [1], 1, 0),
        hid('Up through the root', [1, 2, 3, 4], 4, 3),
        hid('Too far', [1, 2], 1, 5),
      ],
    }),

    dsa({
      ...T,
      id: 'dsa-burn-tree',
      title: 'How Long Until the Whole Tree Burns?',
      difficulty: 'Hard',
      topics: ['Binary Trees', 'Graphs: Traversal'],
      patterns: ['Parent pointers + BFS'],
      summary: 'Fire spreads one edge per second from a start node.',
      description: md('Write `burn_time(root, start)`: fire starts at the node with value `start` and spreads each second to the parent and children of every burning node. Return the seconds until all nodes burn.'),
      hints: ['BFS from the start over children and parents; the answer is the number of layers − 1.'],
      signature: 'burn_time(root: TreeNode, start: int) -> int',
      runSignature: 'run(values: list, start: int) -> int',
      solution: code`def burn_time(root, start):
    parent, src, q = {}, None, deque([root])
    while q:
        node = q.popleft()
        if node.val == start:
            src = node
        for child in (node.left, node.right):
            if child:
                parent[child] = node
                q.append(child)
    seen, frontier, t = {src}, [src], -1
    while frontier:
        t += 1
        nxt = []
        for node in frontier:
            for nb in (node.left, node.right, parent.get(node)):
                if nb and nb not in seen:
                    seen.add(nb)
                    nxt.append(nb)
        frontier = nxt
    return t
`,
      driver: code`def run(values, start):
    return burn_time(build_tree(values), start)`,
      explanation: md('The burn time is the eccentricity of the start node in the tree graph — the BFS depth. O(n).'),
      tests: [
        ex('Example', [1, 5, 3, null, 4, 10, 6, 9, 2], 3),
        ex('Single', [1], 1),
        hid('From a leaf', [1, 2, 3, 4, 5], 4),
        hid('From the root', [1, 2, 3, 4], 1),
      ],
    }),

    dsa({
      ...T,
      id: 'dsa-count-complete-tree',
      title: 'Count Nodes of a Complete Tree in Less Than O(n)',
      difficulty: 'Medium',
      topics: ['Binary Trees', 'Binary Search'],
      patterns: ['Compare left and right spine heights'],
      summary: 'Use perfect subtrees to skip work: O(log² n).',
      description: md('The tree is complete. Write `count_nodes(root)` in better than linear time.'),
      hints: ['If the leftmost and rightmost depths match, the subtree is perfect: 2^h − 1 nodes. Otherwise recurse on both children.'],
      signature: 'count_nodes(root: TreeNode | None) -> int',
      runSignature: 'run(values: list) -> int',
      solution: code`def count_nodes(root):
    if not root:
        return 0
    lh, node = 0, root
    while node:
        lh, node = lh + 1, node.left
    rh, node = 0, root
    while node:
        rh, node = rh + 1, node.right
    if lh == rh:
        return 2 ** lh - 1
    return 1 + count_nodes(root.left) + count_nodes(root.right)
`,
      driver: call('count_nodes'),
      explanation: md('At every level at least one child subtree is perfect, so only one recursion path goes deep: O(log n) levels × O(log n) height checks.'),
      tests: [
        ex('Example', [1, 2, 3, 4, 5, 6]),
        ex('Perfect', [1, 2, 3, 4, 5, 6, 7]),
        hid('Empty', []),
        hid('Last level nearly full', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]),
      ],
    }),

    dsa({
      ...T,
      id: 'dsa-build-pre-in',
      title: 'Rebuild a Tree from Preorder and Inorder',
      difficulty: 'Medium',
      topics: ['Binary Trees', 'Hashing'],
      patterns: ['Root splits the inorder range'],
      summary: 'Reconstruct a tree (unique values) from two traversals.',
      description: md('Write `build_pre_in(preorder, inorder)` returning the root; the driver serialises it level by level.'),
      hints: ['The next preorder value is the root of the current inorder range; a map gives its index in O(1).'],
      signature: 'build_pre_in(preorder: list[int], inorder: list[int]) -> TreeNode | None',
      runSignature: 'run(preorder: list[int], inorder: list[int]) -> list',
      solution: code`def build_pre_in(preorder, inorder):
    pos = {v: i for i, v in enumerate(inorder)}
    it = iter(preorder)

    def build(lo, hi):
        if lo > hi:
            return None
        node = TreeNode(next(it))
        mid = pos[node.val]
        node.left = build(lo, mid - 1)
        node.right = build(mid + 1, hi)
        return node

    return build(0, len(inorder) - 1)
`,
      driver: code`def run(preorder, inorder):
    return tree_values(build_pre_in(preorder, inorder))`,
      explanation: md('Consuming preorder left-first matches building the left subtree first; the index map makes it O(n).'),
      tests: [
        ex('Example', [3, 9, 20, 15, 7], [9, 3, 15, 20, 7]),
        ex('Single', [1], [1]),
        hid('Left chain', [3, 2, 1], [1, 2, 3]),
        hid('Empty', [], []),
      ],
    }),

    dsa({
      ...T,
      id: 'dsa-build-post-in',
      title: 'Rebuild a Tree from Postorder and Inorder',
      difficulty: 'Medium',
      topics: ['Binary Trees', 'Hashing'],
      patterns: ['Root splits the inorder range'],
      summary: 'Reconstruct a tree from postorder + inorder.',
      description: md('Write `build_post_in(postorder, inorder)` returning the root (unique values).'),
      hints: ['Consume postorder from the end, building the right subtree first.'],
      signature: 'build_post_in(postorder: list[int], inorder: list[int]) -> TreeNode | None',
      runSignature: 'run(postorder: list[int], inorder: list[int]) -> list',
      solution: code`def build_post_in(postorder, inorder):
    pos = {v: i for i, v in enumerate(inorder)}
    stack = list(postorder)

    def build(lo, hi):
        if lo > hi:
            return None
        node = TreeNode(stack.pop())
        mid = pos[node.val]
        node.right = build(mid + 1, hi)
        node.left = build(lo, mid - 1)
        return node

    return build(0, len(inorder) - 1)
`,
      driver: code`def run(postorder, inorder):
    return tree_values(build_post_in(postorder, inorder))`,
      explanation: md('Postorder read backwards is root-right-left, so the right subtree is built first. (Preorder + postorder alone does not determine a tree unless it is full.)'),
      tests: [
        ex('Example', [9, 15, 7, 20, 3], [9, 3, 15, 20, 7]),
        ex('Single', [1], [1]),
        hid('Right chain', [3, 2, 1], [1, 2, 3]),
        hid('Full', [4, 5, 2, 6, 7, 3, 1], [4, 2, 5, 1, 6, 3, 7]),
      ],
    }),

    dsa({
      ...T,
      id: 'dsa-serialise-tree',
      title: 'Serialise and Deserialise a Binary Tree',
      difficulty: 'Hard',
      topics: ['Binary Trees', 'Design'],
      patterns: ['Preorder with null markers'],
      summary: 'Encode a tree to a string and decode it back exactly.',
      description: md('Write `serialize(root) -> str` and `deserialize(data) -> root`. Your format is up to you, but the driver requires `deserialize(serialize(t))` to reproduce the tree and returns `[round_trip_level_order, string_is_str]`.'),
      hints: ['Preorder with "#" for nulls, comma-separated; deserialise with an iterator.'],
      starter: code`def serialize(root):
    pass

def deserialize(data):
    pass
`,
      signature: 'serialize(root) / deserialize(data)',
      runSignature: 'run(values: list) -> list',
      solution: code`def serialize(root):
    out = []

    def go(node):
        if not node:
            out.append("#")
            return
        out.append(str(node.val))
        go(node.left)
        go(node.right)

    go(root)
    return ",".join(out)

def deserialize(data):
    it = iter(data.split(","))

    def go():
        tok = next(it)
        if tok == "#":
            return None
        node = TreeNode(int(tok))
        node.left = go()
        node.right = go()
        return node

    return go()
`,
      driver: code`def run(values):
    data = serialize(build_tree(values))
    return [tree_values(deserialize(data)), isinstance(data, str)]`,
      explanation: md('Null markers make preorder unambiguous, so one traversal suffices. O(n) both ways.'),
      tests: [
        ex('Example', [1, 2, 3, null, null, 4, 5]),
        ex('Negative values', [-1, -20, 300]),
        hid('Empty', []),
        hid('Deep', [1, null, 2, null, 3, null, 4]),
      ],
    }),

    dsa({
      ...T,
      id: 'dsa-flatten-to-list',
      title: 'Flatten a Tree into a Right-Leaning List',
      difficulty: 'Medium',
      topics: ['Binary Trees', 'Linked Lists'],
      patterns: ['Reverse preorder with a prev pointer'],
      summary: 'In place, rewire so right pointers follow preorder and lefts are null.',
      description: md('Write `flatten(root)` that rewires the tree in place so each node’s `right` points to the next node in preorder and every `left` is `None`. The driver walks the right pointers and checks that all lefts are empty.'),
      hints: ['Process right, then left, then the node, linking node.right = prev.'],
      signature: 'flatten(root: TreeNode | None) -> None',
      runSignature: 'run(values: list) -> list',
      solution: code`def flatten(root):
    prev = None

    def go(node):
        nonlocal prev
        if not node:
            return
        go(node.right)
        go(node.left)
        node.right, node.left = prev, None
        prev = node

    go(root)
`,
      driver: code`def run(values):
    root = build_tree(values)
    flatten(root)
    out, lefts, node = [], True, root
    while node and len(out) < 10000:
        out.append(node.val)
        lefts = lefts and node.left is None
        node = node.right
    return [out, lefts]`,
      explanation: md('Reverse preorder builds the list from the tail backwards. Morris-style rewiring achieves O(1) extra space.'),
      tests: [
        ex('Example', [1, 2, 5, 3, 4, null, 6]),
        ex('Single', [0]),
        hid('Left chain', [1, 2, null, 3]),
        hid('Empty', []),
      ],
    }),

    dsa({
      ...T,
      id: 'dsa-invert-tree',
      title: 'Mirror a Tree in Place',
      difficulty: 'Easy',
      patterns: ['Swap children recursively'],
      summary: 'Swap every node’s left and right subtrees.',
      description: md('Write `invert(root)` returning the root of the mirrored tree.'),
      hints: ['Swap, then recurse (or use a queue).'],
      signature: 'invert(root: TreeNode | None) -> TreeNode | None',
      runSignature: 'run(values: list) -> list',
      solution: code`def invert(root):
    if root:
        root.left, root.right = invert(root.right), invert(root.left)
    return root
`,
      driver: code`def run(values):
    return tree_values(invert(build_tree(values)))`,
      explanation: md('Each node is visited once: O(n). Inverting twice restores the original.'),
      tests: [
        ex('Example', [4, 2, 7, 1, 3, 6, 9]),
        ex('Two levels', [2, 1, 3]),
        hid('Empty', []),
        hid('One-sided', [1, 2]),
      ],
    }),

    dsa({
      ...T,
      id: 'dsa-root-leaf-paths',
      title: 'Root-to-Leaf Paths Hitting a Target Sum',
      difficulty: 'Medium',
      topics: ['Binary Trees', 'Recursion & Backtracking'],
      patterns: ['DFS with a path stack'],
      summary: 'All root-to-leaf paths whose values sum to the target, plus the sum of all root-to-leaf numbers.',
      description: md('Write `paths(root, target)` returning `[matching_paths, number_sum]`: every root-to-leaf path (left to right) whose sum is `target`, and the sum of all root-to-leaf paths read as decimal numbers (digits 0–9 assumed for that part).'),
      hints: ['Carry the running sum and the running number (num * 10 + val).'],
      signature: 'paths(root: TreeNode | None, target: int) -> list',
      runSignature: 'run(values: list, target: int) -> list',
      solution: code`def paths(root, target):
    found, total, path = [], 0, []

    def go(node, s, num):
        nonlocal total
        if not node:
            return
        path.append(node.val)
        s += node.val
        num = num * 10 + node.val
        if not node.left and not node.right:
            if s == target:
                found.append(path[:])
            total += num
        go(node.left, s, num)
        go(node.right, s, num)
        path.pop()

    go(root, 0, 0)
    return [found, total]
`,
      driver: code`def run(values, target):
    return paths(build_tree(values), target)`,
      explanation: md('One DFS carries both accumulators; copying the path only at matching leaves keeps it O(n · h) worst case.'),
      tests: [
        ex('Example', [5, 4, 8, 1, null, 3, 4, 7, 2, null, null, 5, 1], 22),
        ex('Digits', [1, 2, 3], 3),
        hid('No match', [1, 2], 5),
        hid('Empty', [], 0),
      ],
    }),

    dsa({
      ...T,
      id: 'dsa-children-sum-fix',
      title: 'Raise Values So Every Parent Equals Its Children’s Sum',
      difficulty: 'Medium',
      patterns: ['Push down, then pull up'],
      summary: 'Only increments allowed: make node.val == left.val + right.val for every non-leaf.',
      description: md('Write `children_sum(root)` that only **increases** values so that each non-leaf node equals the sum of its children. Use the standard approach: on the way down, if the children’s sum is less than the node, set each existing child to the node value; on the way up, set node = sum of children. The driver returns the level order.'),
      hints: ['Going down guarantees children are never too small; going up fixes the parent.'],
      signature: 'children_sum(root: TreeNode | None) -> None',
      runSignature: 'run(values: list) -> list',
      solution: code`def children_sum(root):
    def go(node):
        if not node:
            return
        kids = (node.left.val if node.left else 0) + (node.right.val if node.right else 0)
        if kids < node.val:
            if node.left:
                node.left.val = node.val
            if node.right:
                node.right.val = node.val
        go(node.left)
        go(node.right)
        if node.left or node.right:
            node.val = (node.left.val if node.left else 0) + (node.right.val if node.right else 0)

    go(root)
`,
      driver: code`def run(values):
    root = build_tree(values)
    children_sum(root)
    return tree_values(root)`,
      explanation: md('Increasing children before recursing ensures the bottom-up sum is at least the original value, so no decrement is ever needed. O(n).'),
      tests: [
        ex('Example', [40, 10, 20, 2, 5, 30, 40]),
        ex('Already valid', [10, 4, 6]),
        hid('Leaf only', [3]),
        hid('One child', [50, 7, null, 2, 3]),
      ],
    }),
  ],
};
