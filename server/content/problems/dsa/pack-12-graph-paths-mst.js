// DSA pack 12 — weighted graphs and connectivity: shortest paths in a DAG
// (topological relaxation), unit-weight BFS, Dijkstra (with path), binary-maze
// paths, minimum-effort paths, cheapest flights within k stops, counting
// shortest routes, BFS over states (multiply-mod), Bellman–Ford with negative
// cycles, Floyd–Warshall + threshold city, Prim and Kruskal MSTs, union-find
// (network repair, dynamic islands, biggest island after one flip, stones),
// Kosaraju SCCs, Tarjan bridges and articulation points.
import { dsa, md, code, ex, hid } from './define.js';

const SP = ['Graphs: Shortest Paths'];
const UF = ['Graphs: MST & Union-Find'];

export default {
  problems: [
    dsa({
      id: 'dsa-dag-shortest-paths',
      title: 'Shortest Paths in a DAG via Topological Order',
      difficulty: 'Medium',
      topics: [...SP, 'Topological Sort'],
      patterns: ['Relax edges in topological order'],
      summary: 'Single-source shortest distances in a weighted DAG in O(V + E).',
      description: md('Directed acyclic graph with weighted edges `[u, v, w]` (weights may be negative). Return the shortest distance from node 0 to each node (−1 if unreachable).'),
      hints: ['Topologically sort, then relax each node’s outgoing edges in that order.'],
      signature: 'dag_shortest(n: int, edges: list[list[int]]) -> list[int]',
      solution: code`from collections import deque

def dag_shortest(n: int, edges: list[list[int]]) -> list[int]:
    adj = [[] for _ in range(n)]
    indeg = [0] * n
    for u, v, w in edges:
        adj[u].append((v, w))
        indeg[v] += 1
    q = deque(v for v in range(n) if indeg[v] == 0)
    order = []
    while q:
        v = q.popleft()
        order.append(v)
        for u, _ in adj[v]:
            indeg[u] -= 1
            if indeg[u] == 0:
                q.append(u)
    INF = float("inf")
    dist = [INF] * n
    dist[0] = 0
    for v in order:
        if dist[v] == INF:
            continue
        for u, w in adj[v]:
            dist[u] = min(dist[u], dist[v] + w)
    return [d if d != INF else -1 for d in dist]
`,
      explanation: md('With no cycles, processing nodes in topological order finalises each distance before it is used — faster than Dijkstra and correct with negative weights.'),
      tests: [
        ex('Example', 6, [[0, 1, 2], [0, 4, 1], [4, 5, 4], [4, 2, 2], [1, 2, 3], [2, 3, 6], [5, 3, 1]]),
        ex('Unreachable', 3, [[1, 2, 5]]),
        hid('Negative weight', 3, [[0, 1, 5], [1, 2, -3], [0, 2, 4]]),
        hid('Single', 1, []),
      ],
    }),

    dsa({
      id: 'dsa-unit-weight-distances',
      title: 'Shortest Hops from a Source (Unit Weights)',
      difficulty: 'Easy',
      topics: [...SP, 'Graphs: Traversal'],
      patterns: ['BFS distances'],
      summary: 'Distances in an unweighted undirected graph.',
      description: md('Return the number of edges on the shortest path from `src` to every node (−1 if unreachable).'),
      hints: ['BFS distance = parent distance + 1.'],
      signature: 'bfs_distances(n: int, edges: list[list[int]], src: int) -> list[int]',
      solution: code`from collections import deque

def bfs_distances(n: int, edges: list[list[int]], src: int) -> list[int]:
    adj = [[] for _ in range(n)]
    for a, b in edges:
        adj[a].append(b)
        adj[b].append(a)
    dist = [-1] * n
    dist[src] = 0
    q = deque([src])
    while q:
        v = q.popleft()
        for u in adj[v]:
            if dist[u] < 0:
                dist[u] = dist[v] + 1
                q.append(u)
    return dist
`,
      explanation: md('With equal weights, BFS order is distance order; Dijkstra would add an unnecessary log factor.'),
      tests: [
        ex('Example', 9, [[0, 1], [0, 3], [3, 4], [4, 5], [5, 6], [1, 2], [2, 6], [6, 7], [7, 8], [6, 8]], 0),
        ex('Isolated', 3, [[0, 1]], 0),
        hid('Middle source', 5, [[0, 1], [1, 2], [2, 3], [3, 4]], 2),
        hid('Single', 1, [], 0),
      ],
    }),

    dsa({
      id: 'dsa-dijkstra-with-path',
      title: 'Dijkstra: Distances and the Actual Route',
      difficulty: 'Medium',
      topics: [...SP, 'Heaps'],
      patterns: ['Min-heap with lazy deletion + parent array'],
      summary: 'Shortest distances from node 1, and the path from 1 to n.',
      description: md('Nodes `1..n`, undirected edges `[u, v, w]` (w ≥ 0). Return `[dist, path]`: distances from node 1 to nodes 1..n (−1 if unreachable) and one shortest path from 1 to n (preferring the smaller predecessor when ties occur — relax only on strictly shorter, process the heap in (dist, node) order), or `[]`.'),
      hints: ['Skip heap entries whose distance is stale.'],
      signature: 'dijkstra(n: int, edges: list[list[int]]) -> list',
      solution: code`import heapq

def dijkstra(n: int, edges: list[list[int]]) -> list:
    adj = [[] for _ in range(n + 1)]
    for u, v, w in edges:
        adj[u].append((v, w))
        adj[v].append((u, w))
    INF = float("inf")
    dist, parent = [INF] * (n + 1), [0] * (n + 1)
    dist[1] = 0
    heap = [(0, 1)]
    while heap:
        d, v = heapq.heappop(heap)
        if d > dist[v]:
            continue
        for u, w in adj[v]:
            if d + w < dist[u]:
                dist[u] = d + w
                parent[u] = v
                heapq.heappush(heap, (dist[u], u))
    path = []
    if dist[n] < INF:
        v = n
        while v:
            path.append(v)
            v = parent[v] if v != 1 else 0
        path.reverse()
    return [[d if d < INF else -1 for d in dist[1:]], path]
`,
      explanation: md('Non-negative weights mean the smallest tentative distance is final when popped. O((V + E) log V). Parent pointers reconstruct the route.'),
      tests: [
        ex('Example', 5, [[1, 2, 2], [2, 5, 5], [2, 3, 4], [1, 4, 1], [4, 3, 3], [3, 5, 1]]),
        ex('Unreachable', 3, [[1, 2, 1]]),
        hid('Single node', 1, []),
        hid('Direct vs detour', 3, [[1, 3, 10], [1, 2, 3], [2, 3, 4]]),
      ],
    }),

    dsa({
      id: 'dsa-binary-maze-path',
      title: 'Shortest Path Through a 0/1 Maze (8 Directions)',
      difficulty: 'Medium',
      topics: [...SP, 'Matrices'],
      patterns: ['BFS on a grid'],
      summary: 'Length (in cells) of the shortest clear path from top-left to bottom-right.',
      description: md('`grid` has 0 for open and 1 for blocked. Moving in any of 8 directions, return the number of cells on the shortest path from `(0, 0)` to `(n−1, n−1)`, or −1.'),
      hints: ['BFS from the start if it is open; count cells, not moves.'],
      signature: 'shortest_clear_path(grid: list[list[int]]) -> int',
      solution: code`from collections import deque

def shortest_clear_path(grid: list[list[int]]) -> int:
    n = len(grid)
    if grid[0][0] or grid[n - 1][n - 1]:
        return -1
    dist = {(0, 0): 1}
    q = deque([(0, 0)])
    while q:
        r, c = q.popleft()
        if (r, c) == (n - 1, n - 1):
            return dist[(r, c)]
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                nr, nc = r + dr, c + dc
                if 0 <= nr < n and 0 <= nc < n and not grid[nr][nc] and (nr, nc) not in dist:
                    dist[(nr, nc)] = dist[(r, c)] + 1
                    q.append((nr, nc))
    return -1
`,
      explanation: md('Uniform step costs → BFS, O(n²).'),
      tests: [
        ex('Example', [[0, 0, 0], [1, 1, 0], [1, 1, 0]]),
        ex('Diagonal', [[0, 1], [1, 0]]),
        hid('Blocked start', [[1, 0], [0, 0]]),
        hid('Walled off', [[0, 1, 0], [1, 1, 0], [0, 0, 0]]),
      ],
    }),

    dsa({
      id: 'dsa-min-effort-route',
      title: 'Route with the Gentlest Steepest Step',
      difficulty: 'Medium',
      topics: [...SP, 'Matrices', 'Heaps'],
      patterns: ['Dijkstra on a minimax cost'],
      summary: 'Minimise the maximum height difference along a path.',
      description: md('Moving 4-directionally across `heights`, the effort of a route is its largest absolute height difference between consecutive cells. Return the minimum effort from top-left to bottom-right.'),
      hints: ['Dijkstra where the path cost is max(previous cost, step) instead of a sum.'],
      signature: 'min_effort(heights: list[list[int]]) -> int',
      solution: code`import heapq

def min_effort(heights: list[list[int]]) -> int:
    R, C = len(heights), len(heights[0])
    best = [[float("inf")] * C for _ in range(R)]
    best[0][0] = 0
    heap = [(0, 0, 0)]
    while heap:
        e, r, c = heapq.heappop(heap)
        if (r, c) == (R - 1, C - 1):
            return e
        if e > best[r][c]:
            continue
        for nr, nc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
            if 0 <= nr < R and 0 <= nc < C:
                ne = max(e, abs(heights[nr][nc] - heights[r][c]))
                if ne < best[nr][nc]:
                    best[nr][nc] = ne
                    heapq.heappush(heap, (ne, nr, nc))
    return 0
`,
      explanation: md('Dijkstra works for any path cost that never decreases when extended — the max is such a cost. Binary search on the answer + BFS is an alternative.'),
      tests: [
        ex('Example', [[1, 2, 2], [3, 8, 2], [5, 3, 5]]),
        ex('Flat route exists', [[1, 2, 3], [3, 8, 4], [5, 3, 5]]),
        hid('Single cell', [[7]]),
        hid('Zero effort', [[1, 2, 1, 1, 1], [1, 2, 1, 2, 1], [1, 2, 1, 2, 1], [1, 2, 1, 2, 1], [1, 1, 1, 2, 1]]),
      ],
    }),

    dsa({
      id: 'dsa-cheapest-k-stops',
      title: 'Cheapest Flight with at Most k Stops',
      difficulty: 'Medium',
      topics: SP,
      patterns: ['Bellman–Ford limited to k + 1 rounds'],
      summary: 'Minimum price from src to dst using at most k intermediate airports.',
      description: md('Flights are `[from, to, price]`. Return the cheapest price from `src` to `dst` with at most `k` stops, or −1.'),
      hints: ['Relax all edges k + 1 times, each round from a copy of the previous distances.'],
      signature: 'cheapest_flight(n: int, flights: list[list[int]], src: int, dst: int, k: int) -> int',
      solution: code`def cheapest_flight(n: int, flights: list[list[int]], src: int, dst: int, k: int) -> int:
    INF = float("inf")
    dist = [INF] * n
    dist[src] = 0
    for _ in range(k + 1):
        nxt = dist[:]
        for u, v, w in flights:
            if dist[u] + w < nxt[v]:
                nxt[v] = dist[u] + w
        dist = nxt
    return dist[dst] if dist[dst] < INF else -1
`,
      explanation: md('Round i of Bellman–Ford finds shortest paths with at most i edges — exactly the stop budget. Copying prevents using several new edges in one round. O(k · E).'),
      tests: [
        ex('Example', 4, [[0, 1, 100], [1, 2, 100], [2, 0, 100], [1, 3, 600], [2, 3, 200]], 0, 3, 1),
        ex('More stops allowed', 3, [[0, 1, 100], [1, 2, 100], [0, 2, 500]], 0, 2, 1),
        hid('Direct only', 3, [[0, 1, 100], [1, 2, 100], [0, 2, 500]], 0, 2, 0),
        hid('Unreachable', 3, [[0, 1, 5]], 0, 2, 3),
      ],
    }),

    dsa({
      id: 'dsa-count-shortest-routes',
      title: 'How Many Fastest Routes Are There?',
      difficulty: 'Medium',
      topics: [...SP, 'Dynamic Programming'],
      patterns: ['Dijkstra with path counts'],
      summary: 'Number of distinct shortest paths from 0 to n − 1, modulo 1e9+7.',
      description: md('Undirected roads `[u, v, time]`. Return the number of ways to travel from 0 to n − 1 in the minimum total time, modulo `1_000_000_007`.'),
      hints: ['When a strictly shorter distance is found, reset the count; on an equal distance, add the predecessor’s count.'],
      signature: 'count_paths(n: int, roads: list[list[int]]) -> int',
      solution: code`import heapq

def count_paths(n: int, roads: list[list[int]]) -> int:
    MOD = 1_000_000_007
    adj = [[] for _ in range(n)]
    for u, v, t in roads:
        adj[u].append((v, t))
        adj[v].append((u, t))
    INF = float("inf")
    dist, ways = [INF] * n, [0] * n
    dist[0], ways[0] = 0, 1
    heap = [(0, 0)]
    while heap:
        d, v = heapq.heappop(heap)
        if d > dist[v]:
            continue
        for u, t in adj[v]:
            nd = d + t
            if nd < dist[u]:
                dist[u], ways[u] = nd, ways[v]
                heapq.heappush(heap, (nd, u))
            elif nd == dist[u]:
                ways[u] = (ways[u] + ways[v]) % MOD
    return ways[n - 1] % MOD
`,
      explanation: md('Dijkstra pops nodes in distance order, so every predecessor’s count is final before it propagates. O((V + E) log V).'),
      tests: [
        ex('Example', 7, [[0, 6, 7], [0, 1, 2], [1, 2, 3], [2, 3, 3], [6, 3, 3], [3, 5, 1], [6, 5, 1], [2, 5, 1], [0, 4, 5], [4, 6, 2]]),
        ex('Single road', 2, [[1, 0, 10]]),
        hid('Diamond', 4, [[0, 1, 1], [0, 2, 1], [1, 3, 1], [2, 3, 1]]),
        hid('One node', 1, []),
      ],
    }),

    dsa({
      id: 'dsa-multiply-to-target',
      title: 'Fewest Multiplications to Reach a Code (mod 100000)',
      difficulty: 'Medium',
      topics: [...SP, 'Graphs: Traversal'],
      patterns: ['BFS over a state space'],
      summary: 'Start at a value; each step multiplies by one of the given factors modulo 100000.',
      description: md('From `start`, each step replaces x with `(x * f) % 100000` for any `f` in `factors`. Return the minimum steps to reach `end`, or −1.'),
      hints: ['States are 0..99999; BFS with a distance array.'],
      signature: 'min_multiplications(factors: list[int], start: int, end: int) -> int',
      solution: code`from collections import deque

def min_multiplications(factors: list[int], start: int, end: int) -> int:
    MOD = 100000
    if start == end:
        return 0
    dist = [-1] * MOD
    dist[start] = 0
    q = deque([start])
    while q:
        x = q.popleft()
        for f in factors:
            y = x * f % MOD
            if dist[y] < 0:
                dist[y] = dist[x] + 1
                if y == end:
                    return dist[y]
                q.append(y)
    return -1
`,
      explanation: md('Many puzzle problems are shortest paths on an implicit graph of states; here 10⁵ states × |factors| edges.'),
      tests: [
        ex('Example', [2, 5, 7], 3, 30),
        ex('Another', [3, 4, 65], 7, 66175),
        hid('Already there', [2], 9, 9),
        hid('Unreachable', [10], 1, 3),
      ],
    }),

    dsa({
      id: 'dsa-bellman-ford',
      title: 'Bellman–Ford with Negative-Cycle Detection',
      difficulty: 'Medium',
      topics: SP,
      patterns: ['V − 1 relaxation rounds + one check'],
      summary: 'Shortest distances with negative edges, or report a reachable negative cycle.',
      description: md('Directed edges `[u, v, w]`. Return the distances from `src` (`None` for unreachable), or the string `"negative cycle"` if a negative cycle is reachable from `src`.'),
      hints: ['After V − 1 rounds, any further improvement means a negative cycle.'],
      signature: 'bellman_ford(n: int, edges: list[list[int]], src: int) -> list | str',
      solution: code`def bellman_ford(n: int, edges: list[list[int]], src: int):
    INF = float("inf")
    dist = [INF] * n
    dist[src] = 0
    for _ in range(n - 1):
        changed = False
        for u, v, w in edges:
            if dist[u] != INF and dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                changed = True
        if not changed:
            break
    for u, v, w in edges:
        if dist[u] != INF and dist[u] + w < dist[v]:
            return "negative cycle"
    return [d if d != INF else None for d in dist]
`,
      explanation: md('A shortest simple path has at most V − 1 edges. O(V · E) — slower than Dijkstra but handles negative weights.'),
      tests: [
        ex('Example', 5, [[0, 1, 5], [1, 2, 1], [1, 3, 2], [2, 4, 1], [4, 3, -1]], 0),
        ex('Negative cycle', 3, [[0, 1, 1], [1, 2, -1], [2, 1, -1]], 0),
        hid('Unreachable', 3, [[1, 2, 4]], 0),
        hid('Cycle not reachable', 4, [[0, 1, 2], [2, 3, -5], [3, 2, 1]], 0),
      ],
    }),

    dsa({
      id: 'dsa-floyd-threshold-city',
      title: 'All-Pairs Distances and the Quietest City',
      difficulty: 'Medium',
      topics: SP,
      patterns: ['Floyd–Warshall'],
      summary: 'Which city reaches the fewest others within a distance threshold?',
      description: md('Undirected weighted edges. Using all-pairs shortest paths, return the city with the fewest other cities reachable within `threshold` (the largest index on ties).'),
      hints: ['dist[i][j] = min(dist[i][j], dist[i][k] + dist[k][j]) for every intermediate k.'],
      signature: 'quietest_city(n: int, edges: list[list[int]], threshold: int) -> int',
      solution: code`def quietest_city(n: int, edges: list[list[int]], threshold: int) -> int:
    INF = float("inf")
    d = [[0 if i == j else INF for j in range(n)] for i in range(n)]
    for u, v, w in edges:
        d[u][v] = d[v][u] = min(d[u][v], w)
    for k in range(n):
        for i in range(n):
            for j in range(n):
                if d[i][k] + d[k][j] < d[i][j]:
                    d[i][j] = d[i][k] + d[k][j]
    best, city = INF, -1
    for i in range(n):
        reach = sum(1 for j in range(n) if j != i and d[i][j] <= threshold)
        if reach <= best:
            best, city = reach, i
    return city
`,
      explanation: md('Floyd–Warshall is O(V³) but tiny to write and handles all pairs at once — ideal for small dense graphs.'),
      tests: [
        ex('Example', 4, [[0, 1, 3], [1, 2, 1], [1, 3, 4], [2, 3, 1]], 4),
        ex('Another', 5, [[0, 1, 2], [0, 4, 8], [1, 2, 3], [1, 4, 2], [2, 3, 1], [3, 4, 1]], 2),
        hid('Isolated city', 3, [[0, 1, 1]], 5),
        hid('All reachable', 3, [[0, 1, 1], [1, 2, 1]], 10),
      ],
    }),

    dsa({
      id: 'dsa-prim-mst',
      title: 'Minimum Spanning Tree with Prim’s Algorithm',
      difficulty: 'Medium',
      topics: [...UF, 'Heaps'],
      patterns: ['Grow from a vertex with a min-heap'],
      summary: 'Total weight of the MST of a connected undirected graph.',
      description: md('Return the total weight of a minimum spanning tree of the connected graph, and the number of edges in it.'),
      hints: ['Push (weight, node) of edges leaving the tree; skip nodes already included.'],
      signature: 'prim(n: int, edges: list[list[int]]) -> list[int]',
      solution: code`import heapq

def prim(n: int, edges: list[list[int]]) -> list[int]:
    adj = [[] for _ in range(n)]
    for u, v, w in edges:
        adj[u].append((w, v))
        adj[v].append((w, u))
    seen, heap, total, used = [False] * n, [(0, 0)], 0, -1
    while heap:
        w, v = heapq.heappop(heap)
        if seen[v]:
            continue
        seen[v] = True
        total += w
        used += 1
        for e in adj[v]:
            if not seen[e[1]]:
                heapq.heappush(heap, e)
    return [total, used]
`,
      explanation: md('The cut property: the lightest edge leaving the current tree is always in some MST. O(E log V).'),
      tests: [
        ex('Example', 5, [[0, 1, 2], [0, 3, 6], [1, 2, 3], [1, 3, 8], [1, 4, 5], [2, 4, 7], [3, 4, 9]]),
        ex('Triangle', 3, [[0, 1, 5], [1, 2, 3], [0, 2, 1]]),
        hid('Single', 1, []),
        hid('Parallel edges', 2, [[0, 1, 4], [0, 1, 2]]),
      ],
    }),

    dsa({
      id: 'dsa-kruskal-mst',
      title: 'Minimum Spanning Tree with Kruskal’s Algorithm',
      difficulty: 'Medium',
      topics: UF,
      patterns: ['Sort edges + union-find'],
      summary: 'MST edges chosen by Kruskal (sorted by weight, then u, then v).',
      description: md('Return `[total_weight, chosen_edges]`, processing edges sorted by `(w, u, v)` and taking each that joins two different components (union by size, path compression). If the graph is disconnected, return the minimum spanning forest.'),
      hints: ['find(u) != find(v) → take the edge and union.'],
      signature: 'kruskal(n: int, edges: list[list[int]]) -> list',
      solution: code`def kruskal(n: int, edges: list[list[int]]) -> list:
    parent, size = list(range(n)), [1] * n

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    total, chosen = 0, []
    for u, v, w in sorted(edges, key=lambda e: (e[2], e[0], e[1])):
        a, b = find(u), find(v)
        if a != b:
            if size[a] < size[b]:
                a, b = b, a
            parent[b] = a
            size[a] += size[b]
            total += w
            chosen.append([u, v, w])
    return [total, chosen]
`,
      explanation: md('Union-find with path compression and union by size makes each check almost O(1); sorting dominates at O(E log E).'),
      tests: [
        ex('Example', 4, [[0, 1, 10], [0, 2, 6], [0, 3, 5], [1, 3, 15], [2, 3, 4]]),
        ex('Disconnected', 4, [[0, 1, 1], [2, 3, 2]]),
        hid('Ties', 3, [[0, 1, 1], [1, 2, 1], [0, 2, 1]]),
        hid('No edges', 2, []),
      ],
    }),

    dsa({
      id: 'dsa-network-repair',
      title: 'Fewest Cable Moves to Connect Every Computer',
      difficulty: 'Medium',
      topics: UF,
      patterns: ['Count components and spare edges'],
      summary: 'Move redundant cables to join all components.',
      description: md('`connections` are cables between computers 0..n−1. You may unplug any cable and reconnect it elsewhere. Return the minimum moves to connect all computers, or −1 if there aren’t enough cables.'),
      hints: ['Need at least n − 1 cables; answer = components − 1.'],
      signature: 'make_connected(n: int, connections: list[list[int]]) -> int',
      solution: code`def make_connected(n: int, connections: list[list[int]]) -> int:
    if len(connections) < n - 1:
        return -1
    parent = list(range(n))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    components = n
    for a, b in connections:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb
            components -= 1
    return components - 1
`,
      explanation: md('Every redundant cable can bridge two components, and n − 1 cables guarantee enough of them. O(E α(n)).'),
      tests: [
        ex('Example', 4, [[0, 1], [0, 2], [1, 2]]),
        ex('Not enough cables', 6, [[0, 1], [0, 2], [0, 3], [1, 2]]),
        hid('Already connected', 3, [[0, 1], [1, 2]]),
        hid('Two moves', 6, [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3]]),
      ],
    }),

    dsa({
      id: 'dsa-islands-online',
      title: 'Island Count After Each New Piece of Land',
      difficulty: 'Hard',
      topics: [...UF, 'Matrices'],
      patterns: ['Online union-find'],
      summary: 'Add land cells one at a time and report the island count after each.',
      description: md('Start with an `R × C` sea. For each `[r, c]` in `adds`, turn that cell into land (repeats are no-ops) and record the number of 4-connected islands.'),
      hints: ['Each new cell is +1 island, then −1 for every union with a different neighbouring island.'],
      signature: 'islands_online(R: int, C: int, adds: list[list[int]]) -> list[int]',
      solution: code`def islands_online(R: int, C: int, adds: list[list[int]]) -> list[int]:
    parent, count, out = {}, 0, []

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for r, c in adds:
        cell = (r, c)
        if cell not in parent:
            parent[cell] = cell
            count += 1
            for nb in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
                if nb in parent:
                    a, b = find(cell), find(nb)
                    if a != b:
                        parent[a] = b
                        count -= 1
        out.append(count)
    return out
`,
      explanation: md('Re-running a flood fill after each addition is O(k · R · C); union-find answers each addition in near-constant time.'),
      tests: [
        ex('Example', 3, 3, [[0, 0], [0, 1], [1, 2], [2, 1]]),
        ex('Merge three', 3, 3, [[0, 0], [0, 2], [1, 1], [0, 1]]),
        hid('Repeat', 2, 2, [[0, 0], [0, 0]]),
        hid('Fill all', 2, 2, [[0, 0], [1, 1], [0, 1], [1, 0]]),
      ],
    }),

    dsa({
      id: 'dsa-biggest-island-one-flip',
      title: 'Biggest Island After Flipping One Water Cell',
      difficulty: 'Hard',
      topics: [...UF, 'Matrices'],
      patterns: ['Label components, then try each zero'],
      summary: 'Change at most one 0 to 1 to maximise the largest island.',
      description: md('Return the size of the largest 4-connected island obtainable by changing at most one `0` to `1`.'),
      hints: ['Label islands with sizes; for each 0, sum the sizes of distinct neighbouring labels + 1.'],
      signature: 'largest_island(grid: list[list[int]]) -> int',
      solution: code`def largest_island(grid: list[list[int]]) -> int:
    n = len(grid)
    label, sizes, nxt = [[0] * n for _ in range(n)], {}, 2
    for r in range(n):
        for c in range(n):
            if grid[r][c] == 1 and not label[r][c]:
                stack, size = [(r, c)], 0
                label[r][c] = nxt
                while stack:
                    y, x = stack.pop()
                    size += 1
                    for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                        if 0 <= ny < n and 0 <= nx < n and grid[ny][nx] == 1 and not label[ny][nx]:
                            label[ny][nx] = nxt
                            stack.append((ny, nx))
                sizes[nxt] = size
                nxt += 1
    best = max(sizes.values(), default=0)
    for r in range(n):
        for c in range(n):
            if grid[r][c] == 0:
                seen = {label[y][x] for y, x in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1))
                        if 0 <= y < n and 0 <= x < n and label[y][x]}
                best = max(best, 1 + sum(sizes[s] for s in seen))
    return best
`,
      explanation: md('Pre-computing component sizes lets every candidate flip be evaluated in O(1). Deduplicating neighbour labels avoids double counting one island. O(n²).'),
      tests: [
        ex('Example', [[1, 0], [0, 1]]),
        ex('Nearly full', [[1, 1], [1, 0]]),
        hid('All land', [[1, 1], [1, 1]]),
        hid('All water', [[0, 0], [0, 0]]),
      ],
    }),

    dsa({
      id: 'dsa-remove-stones',
      title: 'Remove the Most Stones Sharing a Row or Column',
      difficulty: 'Medium',
      topics: UF,
      patterns: ['Union rows with columns'],
      summary: 'A stone can be removed if another stone shares its row or column.',
      description: md('Return the maximum number of stones that can be removed (one at a time, each sharing a row or column with a remaining stone).'),
      hints: ['Answer = stones − connected components (connect each stone’s row node with its column node).'],
      signature: 'remove_stones(stones: list[list[int]]) -> int',
      solution: code`def remove_stones(stones: list[list[int]]) -> int:
    parent = {}

    def find(x):
        parent.setdefault(x, x)
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for r, c in stones:
        a, b = find(("r", r)), find(("c", c))
        if a != b:
            parent[a] = b
    roots = {find(("r", r)) for r, _ in stones}
    return len(stones) - len(roots)
`,
      explanation: md('Every component can be reduced to a single stone by removing leaves of its spanning tree, so the answer counts components. O(n α(n)).'),
      tests: [
        ex('Example', [[0, 0], [0, 1], [1, 0], [1, 2], [2, 1], [2, 2]]),
        ex('Another', [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]]),
        hid('Single', [[0, 0]]),
        hid('Separate', [[0, 0], [1, 1], [2, 2]]),
      ],
    }),

    dsa({
      id: 'dsa-strongly-connected',
      title: 'Strongly Connected Components (Kosaraju)',
      difficulty: 'Hard',
      topics: ['Graphs: Traversal'],
      patterns: ['Finish order + transpose graph'],
      summary: 'Group nodes that can all reach each other.',
      description: md('Directed graph on `0..n−1`. Return the strongly connected components, each sorted ascending, the list sorted by first element.'),
      hints: ['DFS to get finish order; DFS the reversed graph in decreasing finish order — each tree is one SCC.'],
      signature: 'scc(n: int, edges: list[list[int]]) -> list[list[int]]',
      solution: code`def scc(n: int, edges: list[list[int]]) -> list[list[int]]:
    adj = [[] for _ in range(n)]
    radj = [[] for _ in range(n)]
    for a, b in edges:
        adj[a].append(b)
        radj[b].append(a)
    seen, order = [False] * n, []
    for s in range(n):
        if seen[s]:
            continue
        stack = [(s, iter(adj[s]))]
        seen[s] = True
        while stack:
            v, it = stack[-1]
            nxt = next(it, None)
            if nxt is None:
                stack.pop()
                order.append(v)
            elif not seen[nxt]:
                seen[nxt] = True
                stack.append((nxt, iter(adj[nxt])))
    comp, groups = [-1] * n, []
    for s in reversed(order):
        if comp[s] >= 0:
            continue
        group, stack = [], [s]
        comp[s] = len(groups)
        while stack:
            v = stack.pop()
            group.append(v)
            for u in radj[v]:
                if comp[u] < 0:
                    comp[u] = len(groups)
                    stack.append(u)
        groups.append(sorted(group))
    return sorted(groups)
`,
      explanation: md('The node finishing last lies in a "source" SCC of the condensation; in the transposed graph it can reach only its own SCC. Two passes, O(V + E). Iterative DFS avoids recursion limits.'),
      tests: [
        ex('Example', 5, [[1, 0], [0, 2], [2, 1], [0, 3], [3, 4]]),
        ex('One big cycle', 4, [[0, 1], [1, 2], [2, 3], [3, 0]]),
        hid('No edges', 3, []),
        hid('Two cycles bridged', 6, [[0, 1], [1, 0], [1, 2], [2, 3], [3, 4], [4, 2], [5, 5]]),
      ],
    }),

    dsa({
      id: 'dsa-critical-links',
      title: 'Critical Connections and Cut Vertices (Tarjan)',
      difficulty: 'Hard',
      topics: ['Graphs: Traversal'],
      patterns: ['Discovery time and low-link'],
      summary: 'Bridges (edges) and articulation points (nodes) whose removal disconnects the graph.',
      description: md('Undirected connected graph on `0..n−1`. Return `[bridges, articulation_points]`: bridges as `[min, max]` pairs sorted, and articulation points sorted.'),
      hints: ['low[v] = min discovery time reachable via one back edge from v’s subtree. Edge (p, v) is a bridge if low[v] > disc[p]; p is a cut vertex if low[v] ≥ disc[p] (root: if it has ≥ 2 DFS children).'],
      signature: 'critical(n: int, edges: list[list[int]]) -> list',
      solution: code`import sys

def critical(n: int, edges: list[list[int]]) -> list:
    sys.setrecursionlimit(10000)
    adj = [[] for _ in range(n)]
    for a, b in edges:
        adj[a].append(b)
        adj[b].append(a)
    disc, low = [-1] * n, [0] * n
    bridges, cuts, timer = [], set(), [0]

    def dfs(v, parent):
        disc[v] = low[v] = timer[0]
        timer[0] += 1
        children = 0
        for u in adj[v]:
            if u == parent:
                continue
            if disc[u] >= 0:
                low[v] = min(low[v], disc[u])
            else:
                children += 1
                dfs(u, v)
                low[v] = min(low[v], low[u])
                if low[u] > disc[v]:
                    bridges.append(sorted([v, u]))
                if parent != -1 and low[u] >= disc[v]:
                    cuts.add(v)
        if parent == -1 and children > 1:
            cuts.add(v)

    for s in range(n):
        if disc[s] < 0:
            dfs(s, -1)
    return [sorted(bridges), sorted(cuts)]
`,
      explanation: md('One DFS computes discovery times and low-links; comparing a child’s low-link with its parent’s discovery time decides both properties. O(V + E).'),
      tests: [
        ex('Example', 4, [[0, 1], [1, 2], [2, 0], [1, 3]]),
        ex('Path', 4, [[0, 1], [1, 2], [2, 3]]),
        hid('Cycle has none', 4, [[0, 1], [1, 2], [2, 3], [3, 0]]),
        hid('Two triangles sharing a node', 5, [[0, 1], [1, 2], [2, 0], [2, 3], [3, 4], [4, 2]]),
      ],
    }),
  ],
};
