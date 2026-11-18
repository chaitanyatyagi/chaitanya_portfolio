// Pack 8 — original hard challenges (DataDrill-authored): graph flood fill,
// FIFO inventory costing, constraint validation, interval merging, forward
// fill, seat blocks, friend recommendations, greedy budgeting.
import { sql, md } from './define.js';

const ALL = ['Data Engineer', 'Data Analyst', 'Data Scientist', 'Analytics Engineer'];
const DE = ['Data Engineer', 'Analytics Engineer'];

export default {
  problems: [
    sql({
      id: 'grid-islands', title: 'Count Islands on a Map', difficulty: 'Hard',
      topics: ['Recursive CTEs', 'Hierarchies & Graphs'], patterns: ['Connected components by min-label propagation', 'Flood fill in SQL'], domains: ['Puzzles / Algorithms'], interview: true, roles: ['Data Engineer', 'Data Scientist'],
      summary: 'Count connected land regions (4-directional) on a grid — graph components in pure SQL.',
      description: md('`grid(r, c, land)` describes a map; `land` is TRUE for land. Land cells connect **up, down, left and right** (not diagonally).', '', 'Return each island\'s `island_id` (the smallest `r * 100 + c` of its cells), `cells` and `min_row`, ordered by `island_id`.'),
      hints: ['Label every land cell with its own id, then repeatedly take the minimum label over itself and its land neighbours — a recursive CTE that propagates labels.', 'Stop when labels stop shrinking; each cell\'s final label is its component id.'],
      schema: { grid: 'r INTEGER Row, c INTEGER Column, land BOOLEAN Land or water' },
      solution: `WITH RECURSIVE cells AS (SELECT r, c, r * 100 + c AS id FROM grid WHERE land),\nedges AS (\n  SELECT a.id AS src, b.id AS dst FROM cells a JOIN cells b ON abs(a.r - b.r) + abs(a.c - b.c) = 1\n),\nreach(src, dst) AS (\n  SELECT id, id FROM cells\n  UNION\n  SELECT r.src, e.dst FROM reach r JOIN edges e ON e.src = r.dst\n),\nlabel AS (SELECT src AS id, MIN(dst) AS island_id FROM reach GROUP BY src)\nSELECT l.island_id, COUNT(*) AS cells, MIN(c.r) AS min_row\nFROM label l JOIN cells c ON c.id = l.id\nGROUP BY l.island_id\nORDER BY l.island_id;\n`,
      explanation: 'Connected components: compute which cells reach which (a recursive closure over neighbour edges, UNION de-duplicating so it terminates), then label each cell with the smallest id it can reach. Cells with the same label form one island. This is graph processing expressed relationally — the same idea as label propagation in Spark GraphFrames.',
      tests: [
        { name: 'Example', tables: { grid: [[0, 0, true], [0, 1, true], [0, 2, false], [1, 0, false], [1, 1, true], [1, 2, false], [2, 0, true], [2, 1, false], [2, 2, true]] } },
        { name: 'Diagonals don\'t connect', hidden: true, tables: { grid: [[0, 0, true], [0, 1, false], [1, 0, false], [1, 1, true]] } },
        { name: 'A U-shape is one island', hidden: true, tables: { grid: [[0, 0, true], [0, 1, false], [0, 2, true], [1, 0, true], [1, 1, false], [1, 2, true], [2, 0, true], [2, 1, true], [2, 2, true]] } },
      ],
    }),
    sql({
      id: 'fifo-cost-of-goods', title: 'FIFO Cost of Goods Sold', difficulty: 'Hard',
      topics: ['Running Totals', 'Window Functions', 'Joins'], patterns: ['FIFO matching with cumulative ranges (interval overlap of running sums)'], domains: ['Finance'], interview: true, roles: ['Data Engineer', 'Data Analyst', 'Analytics Engineer'],
      summary: 'Match sales to purchase lots first-in-first-out and compute each sale\'s cost.',
      description: md('Inventory is consumed **first in, first out**. `purchases(lot_id, qty, unit_cost)` arrive in `lot_id` order; `sales(sale_id, qty)` happen in `sale_id` order. Total sales never exceed total purchases.', '', 'Return `sale_id`, `qty`, `cost` (the FIFO cost of the units sold, rounded to 2), ordered by `sale_id`.'),
      hints: ['Give every lot and every sale a cumulative range [start, end) of unit numbers with running sums.', 'A sale uses units from a lot where the ranges overlap; the overlap length × unit_cost is that part of the cost.'],
      schema: { purchases: 'lot_id INTEGER Lot (arrival order), qty INTEGER Units, unit_cost DOUBLE Cost per unit', sales: 'sale_id INTEGER Sale (time order), qty INTEGER Units sold' },
      solution: `WITH p AS (\n  SELECT lot_id, unit_cost, SUM(qty) OVER (ORDER BY lot_id) - qty AS p_from, SUM(qty) OVER (ORDER BY lot_id) AS p_to FROM purchases\n),\ns AS (\n  SELECT sale_id, qty, SUM(qty) OVER (ORDER BY sale_id) - qty AS s_from, SUM(qty) OVER (ORDER BY sale_id) AS s_to FROM sales\n)\nSELECT s.sale_id, s.qty, ROUND(SUM((LEAST(s.s_to, p.p_to) - GREATEST(s.s_from, p.p_from)) * p.unit_cost), 2) AS cost\nFROM s JOIN p ON p.p_from < s.s_to AND s.s_from < p.p_to\nGROUP BY s.sale_id, s.qty\nORDER BY s.sale_id;\n`,
      explanation: 'Number the units: lot k covers units (cum_before, cum_after], and so does each sale. FIFO pairs a sale with exactly the lots whose unit ranges overlap its range — an interval-overlap join on running sums, no procedural loop needed. The overlap length is LEAST(ends) − GREATEST(starts).',
      tests: [
        { name: 'Example', tables: { purchases: [[1, 10, 2.0], [2, 5, 3.0], [3, 10, 4.0]], sales: [[1, 4], [2, 8], [3, 6]] } },
        { name: 'One sale spans three lots', hidden: true, tables: { purchases: [[1, 1, 1.0], [2, 1, 2.0], [3, 1, 3.0]], sales: [[1, 3]] } },
        { name: 'Exact lot boundaries', hidden: true, tables: { purchases: [[1, 5, 1.5], [2, 5, 2.5]], sales: [[1, 5], [2, 5]] } },
      ],
    }),
    sql({
      id: 'sudoku-validator', title: 'Validate a Sudoku', difficulty: 'Hard',
      topics: ['Aggregation', 'Set Operations', 'Data Quality'], patterns: ['Constraint checks with GROUP BY … HAVING', 'Derived grouping keys (box = row/3, col/3)'], domains: ['Puzzles / Algorithms'], interview: true, roles: ALL,
      summary: 'List every rule a filled 9×9 Sudoku breaks.',
      description: md('`cells(r, c, v)` holds a **completely filled** 9×9 grid (r, c from 0 to 8). Each row, column and 3×3 box must contain 1–9 exactly once.', '', 'Return every violated unit as `unit` (`row`, `col` or `box`) and `idx` (row/column number, or box number 0–8 counted left-to-right, top-to-bottom), ordered by `unit`, `idx`. A valid grid returns no rows.'),
      hints: ['A unit is valid when COUNT(DISTINCT v) = 9 and every v is between 1 and 9.', 'box = (r / 3) * 3 + c / 3 with integer division.'],
      schema: { cells: 'r INTEGER Row 0–8, c INTEGER Column 0–8, v INTEGER Digit' },
      solution: `WITH units AS (\n  SELECT 'row' AS unit, r AS idx, v FROM cells\n  UNION ALL SELECT 'col', c, v FROM cells\n  UNION ALL SELECT 'box', (r // 3) * 3 + c // 3, v FROM cells\n)\nSELECT unit, idx\nFROM units\nGROUP BY unit, idx\nHAVING COUNT(DISTINCT v) <> 9 OR MIN(v) < 1 OR MAX(v) > 9\nORDER BY unit, idx;\n`,
      explanation: 'Reshape every cell into three memberships (row, column, box) with UNION ALL, then one GROUP BY checks all 27 constraints at once. Deriving the box index with integer division is the key step.',
      tests: [
        {
          name: 'Example',
          tables: { cells: (() => { const base = [[5, 3, 4, 6, 7, 8, 9, 1, 2], [6, 7, 2, 1, 9, 5, 3, 4, 8], [1, 9, 8, 3, 4, 2, 5, 6, 7], [8, 5, 9, 7, 6, 1, 4, 2, 3], [4, 2, 6, 8, 5, 3, 7, 9, 1], [7, 1, 3, 9, 2, 4, 8, 5, 6], [9, 6, 1, 5, 3, 7, 2, 8, 4], [2, 8, 7, 4, 1, 9, 6, 3, 5], [3, 4, 5, 2, 8, 6, 1, 7, 9]]; base[0][0] = 3; return base.flatMap((row, r) => row.map((v, c) => [r, c, v])); })() },
        },
        { name: 'Valid grid', hidden: true, tables: { cells: [[5, 3, 4, 6, 7, 8, 9, 1, 2], [6, 7, 2, 1, 9, 5, 3, 4, 8], [1, 9, 8, 3, 4, 2, 5, 6, 7], [8, 5, 9, 7, 6, 1, 4, 2, 3], [4, 2, 6, 8, 5, 3, 7, 9, 1], [7, 1, 3, 9, 2, 4, 8, 5, 6], [9, 6, 1, 5, 3, 7, 2, 8, 4], [2, 8, 7, 4, 1, 9, 6, 3, 5], [3, 4, 5, 2, 8, 6, 1, 7, 9]].flatMap((row, r) => row.map((v, c) => [r, c, v])) } },
        { name: 'Swapped rows break boxes only', hidden: true, tables: { cells: [[5, 3, 4, 6, 7, 8, 9, 1, 2], [6, 7, 2, 1, 9, 5, 3, 4, 8], [8, 5, 9, 7, 6, 1, 4, 2, 3], [1, 9, 8, 3, 4, 2, 5, 6, 7], [4, 2, 6, 8, 5, 3, 7, 9, 1], [7, 1, 3, 9, 2, 4, 8, 5, 6], [9, 6, 1, 5, 3, 7, 2, 8, 4], [2, 8, 7, 4, 1, 9, 6, 3, 5], [3, 4, 5, 2, 8, 6, 1, 7, 9]].flatMap((row, r) => row.map((v, c) => [r, c, v])) } },
      ],
    }),
    sql({
      id: 'merge-intervals-sql', title: 'Merge Overlapping Intervals in SQL', difficulty: 'Hard',
      topics: ['Gaps & Islands', 'Window Functions', 'Running Totals'], patterns: ['Running MAX(end) to start new islands', 'Interval packing'], domains: ['Scheduling'], interview: true, roles: ALL,
      summary: 'Pack overlapping or touching [start, end] ranges per resource into continuous blocks.',
      description: md('`busy(resource, start_min, end_min)` are closed ranges in minutes. Merge ranges of the same resource that **overlap or touch** (end = next start). Return `resource`, `block_start`, `block_end`, ordered by `resource`, `block_start`.'),
      hints: ['Sort by start. A range starts a new block when its start is greater than the MAX(end) of all earlier ranges (not just the previous one — think of a long range swallowing several short ones).', 'Running SUM of those flags numbers the blocks.'],
      schema: { busy: 'resource VARCHAR Resource, start_min INTEGER Start, end_min INTEGER End' },
      solution: `WITH o AS (\n  SELECT *, MAX(end_min) OVER (PARTITION BY resource ORDER BY start_min, end_min ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prev_max_end\n  FROM busy\n),\nf AS (SELECT *, CASE WHEN prev_max_end IS NULL OR start_min > prev_max_end THEN 1 ELSE 0 END AS new_block FROM o),\ng AS (SELECT *, SUM(new_block) OVER (PARTITION BY resource ORDER BY start_min, end_min ROWS UNBOUNDED PRECEDING) AS block FROM f)\nSELECT resource, MIN(start_min) AS block_start, MAX(end_min) AS block_end\nFROM g GROUP BY resource, block\nORDER BY resource, block_start;\n`,
      explanation: 'Comparing with only the previous row breaks when an earlier long interval covers several later ones. The running MAX(end) over all preceding rows is the correct "current block end"; a gap after it starts a new island.',
      tests: [
        { name: 'Example', tables: { busy: [['A', 1, 10], ['A', 2, 3], ['A', 5, 6], ['A', 11, 12], ['A', 12, 15], ['B', 4, 5]] } },
        { name: 'Long interval swallows later ones', hidden: true, tables: { busy: [['X', 0, 100], ['X', 10, 20], ['X', 30, 40], ['X', 101, 102]] } },
        { name: 'No overlaps', hidden: true, tables: { busy: [['Y', 5, 6], ['Y', 1, 2], ['Y', 3, 4]] } },
      ],
    }),
    sql({
      id: 'forward-fill-readings', title: 'Forward-Fill Missing Sensor Readings', difficulty: 'Medium',
      topics: ['Window Functions', 'NULL Handling'], patterns: ['Last non-null value (LAST_VALUE … IGNORE NULLS)'], domains: ['IoT / Sensors'], interview: true, roles: ['Data Engineer', 'Data Scientist'],
      summary: 'Replace NULL readings with the device\'s last known value.',
      description: md('Return `device`, `ts`, `reading` (as stored) and `filled` — the reading, or if NULL the **last non-NULL reading before it** for that device (NULL if none yet). Order by `device`, `ts`.'),
      hints: ['LAST_VALUE(reading IGNORE NULLS) OVER (PARTITION BY device ORDER BY ts ROWS UNBOUNDED PRECEDING).', 'Without IGNORE NULLS: group rows by COUNT(reading) running, then take the group\'s first value.'],
      schema: { readings: 'device VARCHAR Device, ts TIMESTAMP When, reading DOUBLE Value (nullable)' },
      solution: `SELECT device, ts, reading,\n  LAST_VALUE(reading IGNORE NULLS) OVER (PARTITION BY device ORDER BY ts ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS filled\nFROM readings\nORDER BY device, ts;\n`,
      explanation: 'IGNORE NULLS makes LAST_VALUE skip missing values, so the window returns the most recent real reading. The portable alternative is the "running count of non-nulls" grouping trick.',
      tests: [
        { name: 'Example', tables: { readings: [['d1', '2024-01-01 00:00:00', 1.5], ['d1', '2024-01-01 00:01:00', null], ['d1', '2024-01-01 00:02:00', null], ['d1', '2024-01-01 00:03:00', 2.0], ['d2', '2024-01-01 00:00:00', null], ['d2', '2024-01-01 00:01:00', 9.0]] } },
        { name: 'All NULL', hidden: true, tables: { readings: [['d3', '2024-01-01 00:00:00', null], ['d3', '2024-01-01 00:01:00', null]] } },
        { name: 'Unordered input', hidden: true, tables: { readings: [['d4', '2024-01-01 00:02:00', null], ['d4', '2024-01-01 00:00:00', 4.0], ['d4', '2024-01-01 00:01:00', 5.0]] } },
      ],
    }),
    sql({
      id: 'consecutive-free-seats', title: 'Find Blocks of Free Seats', difficulty: 'Medium',
      topics: ['Gaps & Islands', 'Window Functions'], patterns: ['Gaps & islands on integers (seat − ROW_NUMBER)'], domains: ['Ticketing'], interview: true, roles: ALL,
      summary: 'Find runs of at least 3 adjacent free seats in each row of a cinema.',
      description: md('`seats(row_label, seat_no, is_free)`. Return each run of **3 or more adjacent free seats** as `row_label`, `first_seat`, `last_seat`, `size`, ordered by `row_label`, `first_seat`.'),
      hints: ['Keep free seats; seat_no − ROW_NUMBER() per row is constant along a run.'],
      schema: { seats: 'row_label VARCHAR Row, seat_no INTEGER Seat number, is_free BOOLEAN Free?' },
      solution: `WITH f AS (\n  SELECT row_label, seat_no, seat_no - ROW_NUMBER() OVER (PARTITION BY row_label ORDER BY seat_no) AS grp\n  FROM seats WHERE is_free\n)\nSELECT row_label, MIN(seat_no) AS first_seat, MAX(seat_no) AS last_seat, COUNT(*) AS size\nFROM f GROUP BY row_label, grp\nHAVING COUNT(*) >= 3\nORDER BY row_label, first_seat;\n`,
      explanation: 'Gaps & islands again: among free seats, the seat number minus its rank is constant across consecutive seats, so it labels each run.',
      tests: [
        { name: 'Example', tables: { seats: [['A', 1, true], ['A', 2, true], ['A', 3, true], ['A', 4, false], ['A', 5, true], ['A', 6, true], ['B', 1, true], ['B', 2, true], ['B', 3, true], ['B', 4, true]] } },
        { name: 'No long runs', hidden: true, tables: { seats: [['C', 1, true], ['C', 2, false], ['C', 3, true], ['C', 4, true]] } },
        { name: 'Two runs in a row', hidden: true, tables: { seats: [['D', 1, true], ['D', 2, true], ['D', 3, true], ['D', 4, false], ['D', 5, true], ['D', 6, true], ['D', 7, true]] } },
      ],
    }),
    sql({
      id: 'people-you-may-know', title: 'People You May Know', difficulty: 'Hard',
      topics: ['Joins', 'Hierarchies & Graphs', 'Aggregation', 'Set Operations'], patterns: ['Friends-of-friends (2-hop join)', 'Exclude existing edges'], domains: ['Social media'], interview: true, roles: ['Data Scientist', 'Data Engineer'],
      summary: 'Recommend non-friends ranked by the number of mutual friends.',
      description: md('`friendships(user_a, user_b)` stores each friendship **once**, in either direction. For every user, recommend people who are **not** already friends (and not themselves) with at least 2 mutual friends.', '', 'Return `user_id`, `suggested`, `mutual_friends`, ordered by `user_id`, `mutual_friends` descending, `suggested`.'),
      hints: ['First make the graph symmetric: UNION the reversed edges.', 'Two hops: f1(u, m) JOIN f2(m, s). Exclude s = u and existing friends, then count distinct m.'],
      schema: { friendships: 'user_a INTEGER One side, user_b INTEGER Other side' },
      solution: `WITH f AS (SELECT user_a AS u, user_b AS v FROM friendships UNION SELECT user_b, user_a FROM friendships)\nSELECT f1.u AS user_id, f2.v AS suggested, COUNT(DISTINCT f1.v) AS mutual_friends\nFROM f f1 JOIN f f2 ON f2.u = f1.v\nWHERE f2.v <> f1.u\n  AND NOT EXISTS (SELECT 1 FROM f x WHERE x.u = f1.u AND x.v = f2.v)\nGROUP BY f1.u, f2.v\nHAVING COUNT(DISTINCT f1.v) >= 2\nORDER BY user_id, mutual_friends DESC, suggested;\n`,
      explanation: 'Symmetrise the edge list, then a 2-hop self-join finds friends of friends; NOT EXISTS removes people you already know. Counting distinct middle nodes gives the mutual-friend score used by real recommenders as a baseline.',
      tests: [
        { name: 'Example', tables: { friendships: [[1, 2], [1, 3], [2, 4], [3, 4], [4, 5], [2, 5], [3, 5]] } },
        { name: 'Already friends are excluded', hidden: true, tables: { friendships: [[1, 2], [2, 3], [1, 4], [4, 3], [1, 3]] } },
        { name: 'Edges stored in both directions', hidden: true, tables: { friendships: [[1, 2], [2, 1], [1, 3], [3, 1], [2, 4], [3, 4]] } },
      ],
    }),
    sql({
      id: 'max-items-within-budget', title: 'Most Items Within a Budget', difficulty: 'Medium',
      topics: ['Running Totals', 'Window Functions', 'Filtering & Sorting'], patterns: ['Greedy prefix sum (cheapest first)'], domains: ['Retail'], interview: true, roles: ALL,
      companies: ['EPAM'], sources: [{ company: 'EPAM', label: 'SparkPlayground — EPAM "Maximize Items Within Budget"', url: 'https://www.sparkplayground.com/pyspark-coding-interview-questions' }],
      summary: 'Each shopper buys as many items as possible from their wishlist within their budget.',
      description: md('To maximise the **number** of items, a shopper buys their wishlist items cheapest first (ties by `item`) while the running total stays within `budget`.', '', 'Return `shopper`, `items_bought`, `spent` (rounded to 2) for every shopper (0 and 0 when they can\'t afford anything), ordered by `shopper`.'),
      hints: ['Running SUM(price) ordered by price, item per shopper.', 'Keep rows with running total ≤ budget; LEFT JOIN from shoppers so broke shoppers still appear.'],
      schema: { shoppers: 'shopper VARCHAR Shopper, budget DOUBLE Budget', wishlist: 'shopper VARCHAR Shopper, item VARCHAR Item, price DOUBLE Price' },
      solution: `WITH r AS (\n  SELECT w.shopper, w.price, SUM(w.price) OVER (PARTITION BY w.shopper ORDER BY w.price, w.item ROWS UNBOUNDED PRECEDING) AS running\n  FROM wishlist w\n)\nSELECT s.shopper, COUNT(r.price) AS items_bought, ROUND(COALESCE(SUM(r.price), 0), 2) AS spent\nFROM shoppers s LEFT JOIN r ON r.shopper = s.shopper AND r.running <= s.budget\nGROUP BY s.shopper\nORDER BY s.shopper;\n`,
      explanation: 'Buying cheapest first maximises the count (an exchange argument proves it); the running sum turns "how many fit?" into a filter. The LEFT JOIN keeps shoppers who can\'t afford anything.',
      tests: [
        { name: 'Example', tables: { shoppers: [['ana', 50.0], ['ben', 5.0], ['cy', 1.0]], wishlist: [['ana', 'book', 20.0], ['ana', 'pen', 2.0], ['ana', 'lamp', 30.0], ['ana', 'mug', 15.0], ['ben', 'gum', 1.0], ['ben', 'tea', 4.0], ['cy', 'cake', 3.0]] } },
        { name: 'Exact budget', hidden: true, tables: { shoppers: [['d', 10.0]], wishlist: [['d', 'a', 4.0], ['d', 'b', 6.0], ['d', 'c', 1.0]] } },
        { name: 'Equal prices tie by item', hidden: true, tables: { shoppers: [['e', 2.0]], wishlist: [['e', 'z', 1.0], ['e', 'a', 1.0], ['e', 'm', 1.0]] } },
      ],
    }),
  ],
};
