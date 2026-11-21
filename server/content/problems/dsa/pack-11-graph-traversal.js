// DSA pack 11 — graph traversal: BFS/DFS orders, components (provinces,
// islands, distinct island shapes), flood fill, multi-source BFS (rotting,
// nearest zero), boundary-connected regions (surrounded, enclaves), cycle
// detection (undirected, directed), bipartite check, Kahn / course schedules,
// safe states, alien alphabet order, and word ladders.
import { dsa, md, code, ex, hid } from './define.js';

const G = ['Graphs: Traversal'];

export default {
  problems: [
    dsa({
      id: 'dsa-bfs-dfs-orders',
      title: 'Breadth-First and Depth-First Visit Orders',
      difficulty: 'Easy',
      topics: G,
      patterns: ['Queue vs recursion'],
      summary: 'Visit order of BFS and recursive DFS from node 0, neighbours in ascending order.',
      description: md('Nodes `0..n−1`, undirected `edges`. Starting at 0 and visiting neighbours in ascending order, return `[bfs_order, dfs_order]` (only reachable nodes).'),
      hints: ['Sort each adjacency list. Mark nodes visited when enqueued in BFS.'],
      signature: 'orders(n: int, edges: list[list[int]]) -> list[list[int]]',
      solution: code`from collections import deque

def orders(n: int, edges: list[list[int]]) -> list[list[int]]:
    adj = [[] for _ in range(n)]
    for a, b in edges:
        adj[a].append(b)
        adj[b].append(a)
    for nb in adj:
        nb.sort()
    bfs, seen, q = [], {0}, deque([0])
    while q:
        v = q.popleft()
        bfs.append(v)
        for u in adj[v]:
            if u not in seen:
                seen.add(u)
                q.append(u)
    dfs, seen = [], set()

    def go(v):
        seen.add(v)
        dfs.append(v)
        for u in adj[v]:
            if u not in seen:
                go(u)

    go(0)
    return [bfs, dfs]
`,
      explanation: md('Both are O(V + E). Marking on enqueue (not dequeue) keeps a node from entering the BFS queue twice.'),
      tests: [
        ex('Example', 5, [[0, 1], [0, 2], [0, 3], [2, 4]]),
        ex('Cycle', 4, [[0, 1], [1, 2], [2, 3], [3, 0]]),
        hid('Disconnected', 4, [[0, 1], [2, 3]]),
        hid('Single node', 1, []),
      ],
    }),

    dsa({
      id: 'dsa-count-provinces',
      title: 'How Many Groups of Connected Cities?',
      difficulty: 'Medium',
      topics: [...G, 'Graphs: MST & Union-Find'],
      patterns: ['Count DFS launches'],
      summary: 'Connected components from an adjacency matrix.',
      description: md('`connected[i][j] == 1` means cities i and j are directly connected (symmetric). Return the number of provinces (connected components).'),
      hints: ['Start a DFS from every unvisited city; each start is a new province.'],
      signature: 'provinces(connected: list[list[int]]) -> int',
      solution: code`def provinces(connected: list[list[int]]) -> int:
    n, seen, count = len(connected), set(), 0
    for s in range(n):
        if s in seen:
            continue
        count += 1
        stack = [s]
        seen.add(s)
        while stack:
            v = stack.pop()
            for u in range(n):
                if connected[v][u] and u not in seen:
                    seen.add(u)
                    stack.append(u)
    return count
`,
      explanation: md('O(n²) with a matrix; union-find gives the same count with near-constant merges.'),
      tests: [
        ex('Example', [[1, 1, 0], [1, 1, 0], [0, 0, 1]]),
        ex('All separate', [[1, 0, 0], [0, 1, 0], [0, 0, 1]]),
        hid('All connected', [[1, 1, 1], [1, 1, 1], [1, 1, 1]]),
        hid('Chain', [[1, 1, 0, 0], [1, 1, 1, 0], [0, 1, 1, 1], [0, 0, 1, 1]]),
      ],
    }),

    dsa({
      id: 'dsa-count-islands',
      title: 'Count Islands (8-Directional)',
      difficulty: 'Medium',
      topics: [...G, 'Matrices'],
      patterns: ['Grid flood fill'],
      summary: 'Islands of "1" connected horizontally, vertically or diagonally.',
      description: md('`grid` is a list of strings of `1` (land) and `0` (water). Land cells touching in any of the **8** directions form one island. Return the number of islands and the size of the largest one.'),
      hints: ['BFS/DFS from each unvisited land cell, marking as you go.'],
      signature: 'islands(grid: list[str]) -> list[int]',
      solution: code`def islands(grid: list[str]) -> list[int]:
    R = len(grid)
    C = len(grid[0]) if R else 0
    seen = set()
    count, biggest = 0, 0
    for r in range(R):
        for c in range(C):
            if grid[r][c] != "1" or (r, c) in seen:
                continue
            count += 1
            size, stack = 0, [(r, c)]
            seen.add((r, c))
            while stack:
                y, x = stack.pop()
                size += 1
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < R and 0 <= nx < C and grid[ny][nx] == "1" and (ny, nx) not in seen:
                            seen.add((ny, nx))
                            stack.append((ny, nx))
            biggest = max(biggest, size)
    return [count, biggest]
`,
      explanation: md('Each cell is visited once: O(R · C). Switching between 4- and 8-connectivity only changes the neighbour list.'),
      tests: [
        ex('Example', ['0110', '0110', '0010', '0000', '1101']),
        ex('Diagonal joins', ['10', '01']),
        hid('No land', ['000']),
        hid('Several', ['1001', '0000', '1001']),
      ],
    }),

    dsa({
      id: 'dsa-flood-fill',
      title: 'Paint Bucket Fill',
      difficulty: 'Easy',
      topics: [...G, 'Matrices'],
      patterns: ['DFS from a seed'],
      summary: 'Recolour the 4-connected region of the start pixel.',
      description: md('Starting from `(sr, sc)`, replace the colour of every 4-connected pixel that has the start pixel’s original colour with `colour`. Return the image.'),
      hints: ['If the new colour equals the old one, return immediately (otherwise you loop forever).'],
      signature: 'flood_fill(image: list[list[int]], sr: int, sc: int, colour: int) -> list[list[int]]',
      solution: code`def flood_fill(image: list[list[int]], sr: int, sc: int, colour: int) -> list[list[int]]:
    old = image[sr][sc]
    if old == colour:
        return image
    stack = [(sr, sc)]
    while stack:
        r, c = stack.pop()
        if 0 <= r < len(image) and 0 <= c < len(image[0]) and image[r][c] == old:
            image[r][c] = colour
            stack.extend(((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)))
    return image
`,
      explanation: md('The colour change doubles as the visited mark. O(pixels in the region).'),
      tests: [
        ex('Example', [[1, 1, 1], [1, 1, 0], [1, 0, 1]], 1, 1, 2),
        ex('Same colour', [[0, 0], [0, 0]], 0, 0, 0),
        hid('Single pixel region', [[1, 2], [2, 2]], 0, 0, 5),
        hid('Whole image', [[3, 3], [3, 3]], 1, 1, 4),
      ],
    }),

    dsa({
      id: 'dsa-rotting-spread',
      title: 'Minutes Until Every Orange Rots',
      difficulty: 'Medium',
      topics: [...G, 'Matrices'],
      patterns: ['Multi-source BFS'],
      summary: 'Rot spreads to 4-neighbours each minute; return the time or −1.',
      description: md('Cells: 0 empty, 1 fresh, 2 rotten. Each minute, fresh oranges adjacent (4-directional) to a rotten one rot. Return the minutes until no fresh orange remains, or −1 if impossible.'),
      hints: ['Start a BFS with all rotten cells in the queue at time 0.'],
      signature: 'rot_time(grid: list[list[int]]) -> int',
      solution: code`from collections import deque

def rot_time(grid: list[list[int]]) -> int:
    R, C = len(grid), len(grid[0])
    q, fresh = deque(), 0
    for r in range(R):
        for c in range(C):
            if grid[r][c] == 2:
                q.append((r, c, 0))
            elif grid[r][c] == 1:
                fresh += 1
    t = 0
    while q:
        r, c, t = q.popleft()
        for nr, nc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
            if 0 <= nr < R and 0 <= nc < C and grid[nr][nc] == 1:
                grid[nr][nc] = 2
                fresh -= 1
                q.append((nr, nc, t + 1))
    return t if fresh == 0 else -1
`,
      explanation: md('Seeding the queue with every source computes the distance to the nearest source for all cells in one O(R · C) pass.'),
      tests: [
        ex('Example', [[2, 1, 1], [1, 1, 0], [0, 1, 1]]),
        ex('Unreachable', [[2, 1, 1], [0, 1, 1], [1, 0, 1]]),
        hid('Nothing fresh', [[0, 2]]),
        hid('Two sources', [[2, 1, 1, 1, 2]]),
      ],
    }),

    dsa({
      id: 'dsa-nearest-zero-distance',
      title: 'Distance to the Nearest Zero',
      difficulty: 'Medium',
      topics: [...G, 'Matrices'],
      patterns: ['Multi-source BFS'],
      summary: 'For each cell, the 4-directional steps to the closest 0.',
      description: md('Return a matrix where each cell holds the distance to the nearest `0` (at least one zero exists).'),
      hints: ['BFS from all zeros simultaneously.'],
      signature: 'nearest_zero(mat: list[list[int]]) -> list[list[int]]',
      solution: code`from collections import deque

def nearest_zero(mat: list[list[int]]) -> list[list[int]]:
    R, C = len(mat), len(mat[0])
    dist = [[-1] * C for _ in range(R)]
    q = deque()
    for r in range(R):
        for c in range(C):
            if mat[r][c] == 0:
                dist[r][c] = 0
                q.append((r, c))
    while q:
        r, c = q.popleft()
        for nr, nc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
            if 0 <= nr < R and 0 <= nc < C and dist[nr][nc] < 0:
                dist[nr][nc] = dist[r][c] + 1
                q.append((nr, nc))
    return dist
`,
      explanation: md('Running BFS from each 1 would be O((RC)²); one multi-source BFS is O(RC). A two-pass DP also works.'),
      tests: [
        ex('Example', [[0, 0, 0], [0, 1, 0], [1, 1, 1]]),
        ex('Single zero', [[1, 1], [1, 0]]),
        hid('Row', [[1, 1, 0, 1, 1, 1]]),
        hid('All zeros', [[0, 0]]),
      ],
    }),

    dsa({
      id: 'dsa-capture-surrounded',
      title: 'Capture Regions Not Touching the Border',
      difficulty: 'Medium',
      topics: [...G, 'Matrices'],
      patterns: ['Mark from the boundary inward'],
      summary: 'Flip every "O" region that is fully surrounded by "X".',
      description: md('`board` is a list of strings of `X` and `O`. Replace every `O` that is **not** connected (4-directionally) to the border with `X`. Also return how many enclosed land cells (`O`s flipped) there were.'),
      hints: ['DFS from every border O to mark the safe ones; flip the rest.'],
      signature: 'capture(board: list[str]) -> list',
      solution: code`def capture(board: list[str]) -> list:
    g = [list(r) for r in board]
    R = len(g)
    C = len(g[0]) if R else 0
    stack = [(r, c) for r in range(R) for c in range(C) if (r in (0, R - 1) or c in (0, C - 1)) and g[r][c] == "O"]
    while stack:
        r, c = stack.pop()
        if 0 <= r < R and 0 <= c < C and g[r][c] == "O":
            g[r][c] = "S"
            stack.extend(((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)))
    flipped = 0
    for r in range(R):
        for c in range(C):
            if g[r][c] == "O":
                g[r][c] = "X"
                flipped += 1
            elif g[r][c] == "S":
                g[r][c] = "O"
    return [["".join(row) for row in g], flipped]
`,
      explanation: md('Instead of testing each region for escape, start from the escapes. The same idea counts "enclaves" (land that can’t walk off the grid). O(R · C).'),
      tests: [
        ex('Example', ['XXXX', 'XOOX', 'XXOX', 'XOXX']),
        ex('Single', ['X']),
        hid('Border region kept', ['OOO', 'OXO', 'OOO']),
        hid('Nested', ['XXXXX', 'XOXOX', 'XXXXX']),
      ],
    }),

    dsa({
      id: 'dsa-distinct-island-shapes',
      title: 'How Many Differently Shaped Islands?',
      difficulty: 'Medium',
      topics: [...G, 'Hashing'],
      patterns: ['Canonical shape by relative offsets'],
      summary: 'Count islands that differ by translation only (no rotation/reflection).',
      description: md('Return the number of distinct island shapes (4-connected `1`s), where two islands are the same if one can be translated onto the other.'),
      hints: ['Record each cell’s offset from the island’s first cell (in scan order) as a frozenset/tuple.'],
      signature: 'distinct_islands(grid: list[list[int]]) -> int',
      solution: code`def distinct_islands(grid: list[list[int]]) -> int:
    R, C = len(grid), len(grid[0])
    seen, shapes = set(), set()
    for r in range(R):
        for c in range(C):
            if grid[r][c] and (r, c) not in seen:
                cells, stack = [], [(r, c)]
                seen.add((r, c))
                while stack:
                    y, x = stack.pop()
                    cells.append((y - r, x - c))
                    for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                        if 0 <= ny < R and 0 <= nx < C and grid[ny][nx] and (ny, nx) not in seen:
                            seen.add((ny, nx))
                            stack.append((ny, nx))
                shapes.add(tuple(sorted(cells)))
    return len(shapes)
`,
      explanation: md('Normalising coordinates relative to a fixed anchor gives a translation-invariant key. O(R · C log k) with the sort.'),
      tests: [
        ex('Example', [[1, 1, 0, 0, 0], [1, 1, 0, 0, 0], [0, 0, 0, 1, 1], [0, 0, 0, 1, 1]]),
        ex('Different shapes', [[1, 1, 0, 1, 1], [1, 0, 0, 0, 0], [0, 0, 0, 0, 1], [1, 1, 0, 1, 1]]),
        hid('No land', [[0, 0]]),
        hid('Same singles', [[1, 0, 1], [0, 0, 0], [1, 0, 1]]),
      ],
    }),

    dsa({
      id: 'dsa-cycle-undirected',
      title: 'Does an Undirected Graph Contain a Cycle?',
      difficulty: 'Medium',
      topics: G,
      patterns: ['DFS ignoring the parent edge'],
      summary: 'Detect a cycle in each of several undirected graphs.',
      description: md('Each case is `[n, edges]` (no self-loops or parallel edges). Return whether each graph has a cycle.'),
      hints: ['A visited neighbour that is not the parent closes a cycle. Check every component.'],
      signature: 'has_cycle(cases: list[list]) -> list[bool]',
      solution: code`def has_cycle(cases: list[list]) -> list[bool]:
    out = []
    for n, edges in cases:
        adj = [[] for _ in range(n)]
        for a, b in edges:
            adj[a].append(b)
            adj[b].append(a)
        seen, found = [False] * n, False
        for s in range(n):
            if seen[s] or found:
                continue
            seen[s] = True
            stack = [(s, -1)]
            while stack and not found:
                v, parent = stack.pop()
                for u in adj[v]:
                    if u == parent:
                        continue
                    if seen[u]:
                        found = True
                        break
                    seen[u] = True
                    stack.append((u, v))
        out.append(found)
    return out
`,
      explanation: md('In a forest every non-tree edge closes a cycle; skipping only the edge back to the parent detects them. Union-find works too: an edge joining two already-connected nodes closes a cycle.'),
      tests: [
        ex('Example', [[5, [[0, 1], [1, 2], [2, 3], [3, 1], [3, 4]]], [4, [[0, 1], [1, 2], [2, 3]]]]),
        ex('Disconnected cycle', [[6, [[0, 1], [2, 3], [3, 4], [4, 2]]]]),
        hid('No edges', [[3, []]]),
        hid('Triangle', [[3, [[0, 1], [1, 2], [2, 0]]]]),
      ],
    }),

    dsa({
      id: 'dsa-cycle-directed',
      title: 'Does a Directed Graph Contain a Cycle?',
      difficulty: 'Medium',
      topics: [...G, 'Topological Sort'],
      patterns: ['Three-colour DFS'],
      summary: 'Detect cycles with white/grey/black states.',
      description: md('Each case is `[n, edges]` with directed edges `a → b`. Return whether each graph has a directed cycle.'),
      hints: ['An edge into a node currently on the recursion stack (grey) is a back edge.'],
      signature: 'has_directed_cycle(cases: list[list]) -> list[bool]',
      solution: code`import sys

def has_directed_cycle(cases: list[list]) -> list[bool]:
    sys.setrecursionlimit(10000)
    out = []
    for n, edges in cases:
        adj = [[] for _ in range(n)]
        for a, b in edges:
            adj[a].append(b)
        state = [0] * n

        def dfs(v):
            state[v] = 1
            for u in adj[v]:
                if state[u] == 1 or (state[u] == 0 and dfs(u)):
                    return True
            state[v] = 2
            return False

        out.append(any(state[v] == 0 and dfs(v) for v in range(n)))
    return out
`,
      explanation: md('Undirected parent-skipping doesn’t work here: a node can be reached twice without a cycle. Grey = "on the current path" distinguishes back edges from cross edges.'),
      tests: [
        ex('Example', [[4, [[0, 1], [1, 2], [2, 3], [3, 1]]], [4, [[0, 1], [0, 2], [1, 3], [2, 3]]]]),
        ex('Self loop', [[1, [[0, 0]]]]),
        hid('No edges', [[2, []]]),
        hid('Separate components', [[5, [[0, 1], [2, 3], [3, 4], [4, 2]]]]),
      ],
    }),

    dsa({
      id: 'dsa-two-colourable',
      title: 'Can the Graph Be Split into Two Sides?',
      difficulty: 'Medium',
      topics: G,
      patterns: ['BFS 2-colouring'],
      summary: 'Bipartite check on an adjacency list (possibly disconnected).',
      description: md('`adj[i]` lists the neighbours of node i (undirected). Return whether the graph is bipartite.'),
      hints: ['Colour the start 0 and alternate; a neighbour with the same colour means an odd cycle.'],
      signature: 'is_bipartite(adj: list[list[int]]) -> bool',
      solution: code`from collections import deque

def is_bipartite(adj: list[list[int]]) -> bool:
    colour = [-1] * len(adj)
    for s in range(len(adj)):
        if colour[s] != -1:
            continue
        colour[s] = 0
        q = deque([s])
        while q:
            v = q.popleft()
            for u in adj[v]:
                if colour[u] == -1:
                    colour[u] = 1 - colour[v]
                    q.append(u)
                elif colour[u] == colour[v]:
                    return False
    return True
`,
      explanation: md('A graph is bipartite iff it has no odd cycle; BFS colouring finds one if it exists. O(V + E).'),
      tests: [
        ex('Odd cycle', [[1, 2, 3], [0, 2], [0, 1, 3], [0, 2]]),
        ex('Square', [[1, 3], [0, 2], [1, 3], [0, 2]]),
        hid('Disconnected with a triangle', [[1], [0], [3, 4], [2, 4], [2, 3]]),
        hid('Isolated nodes', [[], []]),
      ],
    }),

    dsa({
      id: 'dsa-course-order',
      title: 'Order Courses Given Prerequisites (Kahn’s Algorithm)',
      difficulty: 'Medium',
      topics: ['Topological Sort', ...G],
      patterns: ['In-degree queue (smallest first)'],
      summary: 'A valid course order (lexicographically smallest), or [] if impossible.',
      description: md('`prereqs` holds `[course, required]` pairs: `required` must come before `course`. Return the lexicographically smallest valid order of all `n` courses, or `[]` if there is a cycle.'),
      hints: ['Kahn’s algorithm with a min-heap instead of a queue yields the smallest order.'],
      signature: 'course_order(n: int, prereqs: list[list[int]]) -> list[int]',
      solution: code`import heapq

def course_order(n: int, prereqs: list[list[int]]) -> list[int]:
    adj = [[] for _ in range(n)]
    indeg = [0] * n
    for course, req in prereqs:
        adj[req].append(course)
        indeg[course] += 1
    heap = [v for v in range(n) if indeg[v] == 0]
    heapq.heapify(heap)
    order = []
    while heap:
        v = heapq.heappop(heap)
        order.append(v)
        for u in adj[v]:
            indeg[u] -= 1
            if indeg[u] == 0:
                heapq.heappush(heap, u)
    return order if len(order) == n else []
`,
      explanation: md('Nodes with no remaining prerequisites can go next; if some never reach in-degree 0 they sit on a cycle. O((V + E) log V) with the heap.'),
      tests: [
        ex('Example', 4, [[1, 0], [2, 0], [3, 1], [3, 2]]),
        ex('Cycle', 2, [[1, 0], [0, 1]]),
        hid('No prerequisites', 3, []),
        hid('Chain', 4, [[0, 3], [3, 2], [2, 1]]),
      ],
    }),

    dsa({
      id: 'dsa-safe-states',
      title: 'Nodes Guaranteed to Reach a Dead End',
      difficulty: 'Medium',
      topics: ['Topological Sort', ...G],
      patterns: ['Reverse graph + Kahn'],
      summary: 'Eventual safe states: every path from them ends at a terminal node.',
      description: md('`graph[i]` lists the directed edges out of i. A node is safe if every path starting there leads to a terminal node (no outgoing edges). Return all safe nodes ascending.'),
      hints: ['Reverse the edges and run Kahn from terminal nodes (out-degree 0).'],
      signature: 'safe_nodes(graph: list[list[int]]) -> list[int]',
      solution: code`from collections import deque

def safe_nodes(graph: list[list[int]]) -> list[int]:
    n = len(graph)
    rev = [[] for _ in range(n)]
    out = [len(g) for g in graph]
    for v, nbrs in enumerate(graph):
        for u in nbrs:
            rev[u].append(v)
    q = deque(v for v in range(n) if out[v] == 0)
    safe = [False] * n
    while q:
        v = q.popleft()
        safe[v] = True
        for u in rev[v]:
            out[u] -= 1
            if out[u] == 0:
                q.append(u)
    return [v for v in range(n) if safe[v]]
`,
      explanation: md('Peeling terminal nodes backwards removes exactly the nodes that can’t reach a cycle. O(V + E).'),
      tests: [
        ex('Example', [[1, 2], [2, 3], [5], [0], [5], [], []]),
        ex('Self loop', [[1, 2, 3, 4], [1, 2], [3, 4], [0, 4], []]),
        hid('All terminal', [[], [], []]),
        hid('Whole cycle', [[1], [2], [0]]),
      ],
    }),

    dsa({
      id: 'dsa-alien-alphabet',
      title: 'Recover an Alien Alphabet from a Sorted Dictionary',
      difficulty: 'Hard',
      topics: ['Topological Sort', 'Strings', ...G],
      patterns: ['First differing letter gives an edge'],
      summary: 'Derive a letter order consistent with a sorted word list.',
      description: md('`words` are sorted in an unknown alphabet. Return the lexicographically smallest letter order (by normal character order among valid choices) consistent with it, using only letters that appear. Return `""` if inconsistent (a cycle, or a word before its own prefix).'),
      hints: ['Compare adjacent words; the first differing letters a, b give a → b. Then Kahn with a min-heap.'],
      signature: 'alien_order(words: list[str]) -> str',
      solution: code`import heapq

def alien_order(words: list[str]) -> str:
    letters = sorted({ch for w in words for ch in w})
    adj = {ch: set() for ch in letters}
    indeg = {ch: 0 for ch in letters}
    for a, b in zip(words, words[1:]):
        for x, y in zip(a, b):
            if x != y:
                if y not in adj[x]:
                    adj[x].add(y)
                    indeg[y] += 1
                break
        else:
            if len(a) > len(b):
                return ""
    heap = [ch for ch in letters if indeg[ch] == 0]
    heapq.heapify(heap)
    order = []
    while heap:
        ch = heapq.heappop(heap)
        order.append(ch)
        for nxt in adj[ch]:
            indeg[nxt] -= 1
            if indeg[nxt] == 0:
                heapq.heappush(heap, nxt)
    return "".join(order) if len(order) == len(letters) else ""
`,
      explanation: md('Only the first mismatch between neighbours carries information; the rest is a topological sort. A longer word before its own prefix is impossible in any alphabet.'),
      tests: [
        ex('Example', ['wrt', 'wrf', 'er', 'ett', 'rftt']),
        ex('Cycle', ['z', 'x', 'z']),
        hid('Prefix violation', ['abc', 'ab']),
        hid('Several letters', ['baa', 'abcd', 'abca', 'cab', 'cad']),
      ],
    }),

    dsa({
      id: 'dsa-word-ladder',
      title: 'Shortest Word Ladder (and All Shortest Ladders)',
      difficulty: 'Hard',
      topics: [...G, 'Strings', 'Hashing'],
      patterns: ['BFS over one-letter edits + parent map'],
      summary: 'Fewest words from begin to end changing one letter at a time.',
      description: md('Each step changes exactly one letter and must produce a word in `words`. Return `[length, ladders]`: the number of words in the shortest ladder (0 if none) and all shortest ladders, sorted.'),
      hints: ['BFS level by level; record every parent that reaches a word at its first level, then backtrack from the end.'],
      signature: 'ladders(begin: str, end: str, words: list[str]) -> list',
      solution: code`from collections import defaultdict
import string

def ladders(begin: str, end: str, words: list[str]) -> list:
    pool = set(words)
    if end not in pool:
        return [0, []]
    parents = defaultdict(set)
    level, found = {begin}, False
    pool.discard(begin)
    while level and not found:
        pool -= level
        nxt = set()
        for w in level:
            for i in range(len(w)):
                for ch in string.ascii_lowercase:
                    cand = w[:i] + ch + w[i + 1:]
                    if cand in pool:
                        parents[cand].add(w)
                        nxt.add(cand)
                        if cand == end:
                            found = True
        level = nxt
    if not found:
        return [0, []]
    paths = []

    def back(w, path):
        if w == begin:
            paths.append(path[::-1])
            return
        for p in parents[w]:
            back(p, path + [p])

    back(end, [end])
    return [len(paths[0]), sorted(paths)]
`,
      explanation: md('BFS guarantees shortest lengths; removing each level from the pool only after the level is done keeps every shortest parent. Generating 26·L neighbours per word beats comparing all word pairs.'),
      tests: [
        ex('Example', 'hit', 'cog', ['hot', 'dot', 'dog', 'lot', 'log', 'cog']),
        ex('Unreachable', 'hit', 'cog', ['hot', 'dot', 'dog', 'lot', 'log']),
        hid('One step', 'a', 'c', ['a', 'b', 'c']),
        hid('Several shortest ladders', 'red', 'tax', ['ted', 'tex', 'red', 'tax', 'tad', 'den', 'rex', 'pee']),
      ],
    }),
  ],
};
