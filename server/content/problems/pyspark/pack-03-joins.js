// PySpark pack 3 — joins: inner / left / full outer, left_anti and left_semi,
// self joins with aliases, range (non-equi) joins, relational division,
// join fan-out, reconciliation, and set operations.
import { pyspark, md, code } from './define.js';
import { sp } from '../sql/define.js';
import { tag } from '../python/sources.js';

const DE = ['Data Engineer'];
const DE_DA = ['Data Engineer', 'Data Analyst'];

export default {
  problems: [
    pyspark({
      id: 'spark-ride-driver-details', title: 'Ride-Level Data with Driver Details', difficulty: 'Easy',
      topics: ['Joins'], patterns: ['Inner join with column selection'], domains: ['Mobility / Ride-hailing'], roles: DE_DA,
      ...tag(sp('VISA', 'Driver Details for Rides')),
      summary: 'Join rides to drivers and return a tidy ride-level table without duplicate columns.',
      description: md('Return `ride_id`, `driver_name`, `vehicle`, `fare` for every ride whose driver exists. Rides with an unknown `driver_id` are dropped.'),
      hints: ['Join on the column **name** (`"driver_id"`) to avoid two `driver_id` columns; rename with `alias`.'],
      schema: { rides: 'ride_id INTEGER Ride, driver_id INTEGER Driver, fare DOUBLE Fare', drivers: 'driver_id INTEGER Driver, name VARCHAR Name, vehicle VARCHAR Vehicle' },
      solution: code`def solve(spark, rides, drivers):
    return (rides.join(drivers, "driver_id")
            .select("ride_id", F.col("name").alias("driver_name"), "vehicle", "fare"))
`,
      explanation: 'An inner join keeps only matching keys. Joining with a string key merges the key columns; joining with an expression (`rides.driver_id == drivers.driver_id`) keeps both and forces you to disambiguate later.',
      tests: [
        { name: 'Example', tables: { rides: [[1, 10, 12.5], [2, 11, 7.0], [3, 99, 3.0]], drivers: [[10, 'Ana', 'sedan'], [11, 'Raj', 'bike']] } },
        { name: 'No drivers', hidden: true, tables: { rides: [[1, 1, 1.0]], drivers: [] } },
        { name: 'Driver with many rides', hidden: true, tables: { rides: [[1, 5, 1.0], [2, 5, 2.0]], drivers: [[5, 'Li', 'van']] } },
      ],
    }),

    pyspark({
      id: 'spark-left-anti-unsold', title: 'Products With No Orders (left_anti)', difficulty: 'Easy',
      topics: ['Joins'], patterns: ['Anti join'], domains: ['E-commerce / Sales'], roles: DE_DA,
      ...tag(sp('Meta', 'Podcasts With No Listens')),
      summary: 'Find catalogue items that never appear in the orders table — without the NOT IN null trap.',
      description: md('Return `product_id` and `name` of products that have no order line at all. Order lines may have a null `product_id` (data quality issue) — those must not hide every product.'),
      hints: ['`products.join(order_lines, "product_id", "left_anti")` keeps left rows with no match; nulls never match, so they can\'t empty the result the way `NOT IN (… NULL …)` does in SQL.'],
      schema: { products: 'product_id INTEGER Product, name VARCHAR Name', order_lines: 'line_id INTEGER Line, product_id INTEGER Product' },
      solution: code`def solve(spark, products, order_lines):
    return products.join(order_lines, "product_id", "left_anti")
`,
      explanation: 'An anti join returns left rows with **no** match and never duplicates them — the idiomatic "never happened" query. It is also cheaper than a left join + `isNull` filter because unmatched rows needn\'t be materialised with nulls.',
      tests: [
        { name: 'Example', tables: { products: [[1, 'tea'], [2, 'cake'], [3, 'bun']], order_lines: [[10, 1], [11, 1], [12, null]] } },
        { name: 'Everything sold', hidden: true, tables: { products: [[1, 'a']], order_lines: [[1, 1]] } },
        { name: 'No orders', hidden: true, tables: { products: [[1, 'a'], [2, 'b']], order_lines: [] } },
      ],
    }),

    pyspark({
      id: 'spark-left-semi-active', title: 'Customers Who Ordered (left_semi)', difficulty: 'Easy',
      topics: ['Joins', 'Deduplication'], patterns: ['Semi join instead of join + distinct'], domains: ['E-commerce / Sales'], roles: DE_DA,
      summary: 'Keep each customer who placed at least one order, exactly once.',
      description: md('Return the `customers` rows (all columns) for customers with at least one order in 2024. Each customer appears once however many orders they have.'),
      hints: ['A plain join duplicates the customer per order; `left_semi` only tests for existence.'],
      schema: { customers: 'customer_id INTEGER Customer, name VARCHAR Name', orders: 'order_id INTEGER Order, customer_id INTEGER Customer, order_date DATE Date' },
      solution: code`def solve(spark, customers, orders):
    orders_2024 = orders.filter(F.year("order_date") == 2024)
    return customers.join(orders_2024, "customer_id", "left_semi")
`,
      explanation: 'A semi join is `WHERE EXISTS`: it returns left columns only and never multiplies rows, so no `distinct` is needed afterwards.',
      tests: [
        { name: 'Example', tables: { customers: [[1, 'Ana'], [2, 'Raj'], [3, 'Li']], orders: [[1, 1, '2024-01-01'], [2, 1, '2024-02-01'], [3, 3, '2023-12-31']] } },
        { name: 'Nobody ordered', hidden: true, tables: { customers: [[1, 'x']], orders: [] } },
        { name: 'Everyone ordered', hidden: true, tables: { customers: [[1, 'a'], [2, 'b']], orders: [[1, 1, '2024-05-05'], [2, 2, '2024-06-06']] } },
      ],
    }),

    pyspark({
      id: 'spark-full-outer-reconcile', title: 'Reconcile Source vs Target Totals', difficulty: 'Hard',
      topics: ['Joins', 'Data Quality', 'Aggregation'], patterns: ['Full outer join reconciliation'], domains: ['Finance'], roles: DE,
      summary: 'Compare per-account totals between a source ledger and the warehouse, flagging every mismatch.',
      description: md(
        'Aggregate both sides per `account_id` (sum of `amount`, rounded to 2). Return `account_id`, `source_total`, `target_total`, `variance` (target − source, treating a missing side as 0, rounded to 2) and `status`:',
        '`"missing_in_target"`, `"missing_in_source"`, `"mismatch"` (|variance| > 0.01) or `"ok"`.',
      ),
      hints: ['Aggregate first, then a `full_outer` join; a missing side shows up as nulls.', 'Take the key with `F.coalesce(left_key, right_key)` — for right-only rows the left key is null.'],
      schema: { source: 'txn_id INTEGER Txn, account_id INTEGER Account, amount DOUBLE Amount', target: 'txn_id INTEGER Txn, account_id INTEGER Account, amount DOUBLE Amount' },
      solution: code`def solve(spark, source, target):
    s = source.groupBy("account_id").agg(F.round(F.sum("amount"), 2).alias("source_total"))
    t = target.groupBy("account_id").agg(F.round(F.sum("amount"), 2).alias("target_total"))
    j = (s.alias("s").join(t.alias("t"), F.col("s.account_id") == F.col("t.account_id"), "full_outer")
         .select(F.coalesce("s.account_id", "t.account_id").alias("account_id"), "source_total", "target_total"))
    variance = F.round(F.coalesce(F.col("target_total"), F.lit(0.0)) - F.coalesce(F.col("source_total"), F.lit(0.0)), 2)
    status = (F.when(F.col("target_total").isNull(), "missing_in_target")
               .when(F.col("source_total").isNull(), "missing_in_source")
               .when(F.abs(F.col("variance")) > 0.01, "mismatch")
               .otherwise("ok"))
    return (j.withColumn("variance", variance)
            .withColumn("status", status)
            .select("account_id", "source_total", "target_total", "variance", "status"))
`,
      explanation: 'A full outer join is the only join that surfaces keys missing on **either** side. Aggregating before the join keeps it one-to-one; the tolerance avoids flagging float rounding noise.',
      tests: [
        { name: 'Example', tables: { source: [[1, 100, 10.0], [2, 100, 5.0], [3, 200, 7.0], [4, 300, 1.0]], target: [[1, 100, 15.0], [3, 200, 6.5], [9, 400, 2.0]] } },
        { name: 'Perfect match', hidden: true, tables: { source: [[1, 1, 1.0]], target: [[1, 1, 1.0]] } },
        { name: 'Rounding noise is ok', hidden: true, tables: { source: [[1, 5, 0.1], [2, 5, 0.2]], target: [[1, 5, 0.3]] } },
      ],
    }),

    pyspark({
      id: 'spark-employee-manager', title: 'Employees Who Earn More Than Their Manager', difficulty: 'Medium',
      topics: ['Joins'], patterns: ['Self join with aliases'], domains: ['HR / People'], roles: DE_DA,
      summary: 'Self-join an employee table to compare each person with their manager.',
      description: md('Return `employee`, `salary`, `manager`, `manager_salary` for employees paid strictly more than their manager.'),
      hints: ['`e = employees.alias("e")`, `m = employees.alias("m")`, join on `F.col("e.manager_id") == F.col("m.emp_id")`, then select qualified columns.'],
      schema: { employees: 'emp_id INTEGER Id, name VARCHAR Name, salary INTEGER Salary, manager_id INTEGER Manager' },
      solution: code`def solve(spark, employees):
    e, m = employees.alias("e"), employees.alias("m")
    return (e.join(m, F.col("e.manager_id") == F.col("m.emp_id"))
            .filter(F.col("e.salary") > F.col("m.salary"))
            .select(F.col("e.name").alias("employee"), F.col("e.salary").alias("salary"),
                    F.col("m.name").alias("manager"), F.col("m.salary").alias("manager_salary")))
`,
      explanation: 'A self join needs aliases so each column reference says which "copy" it means. The CEO (null manager) drops out of the inner join naturally.',
      tests: [
        { name: 'Example', tables: { employees: [[1, 'ceo', 300, null], [2, 'vp', 320, 1], [3, 'eng', 150, 2], [4, 'pm', 200, 2]] } },
        { name: 'Nobody out-earns their manager', hidden: true, tables: { employees: [[1, 'a', 10, null], [2, 'b', 5, 1]] } },
        { name: 'Equal pay is not more', hidden: true, tables: { employees: [[1, 'x', 100, null], [2, 'y', 100, 1]] } },
      ],
    }),

    pyspark({
      id: 'spark-connected-airports', title: 'Distinct Connected Airport Pairs', difficulty: 'Medium',
      topics: ['Set Operations', 'Deduplication'], patterns: ['Undirected pair normalisation'], domains: ['Travel'], roles: DE_DA,
      ...tag(sp('Amazon', 'Connected Airports')),
      summary: 'Count each undirected airport pair once, whichever direction the flights went.',
      description: md('Flights are directed (`origin → destination`). Return each connected pair once as `airport_a`, `airport_b` (alphabetically smaller first) with `flights` = number of flights in either direction.'),
      hints: ['`F.least("origin", "destination")` and `F.greatest(...)` normalise the direction; then group.'],
      schema: { flights: 'flight_id INTEGER Flight, origin VARCHAR From, destination VARCHAR To' },
      solution: code`def solve(spark, flights):
    return (flights
            .groupBy(F.least("origin", "destination").alias("airport_a"),
                     F.greatest("origin", "destination").alias("airport_b"))
            .agg(F.count("*").alias("flights")))
`,
      explanation: 'Ordering the two endpoints turns (DEL, BOM) and (BOM, DEL) into the same key. The self-join alternative (`a < b` on both directions) is slower and easy to get wrong.',
      tests: [
        { name: 'Example', tables: { flights: [[1, 'DEL', 'BOM'], [2, 'BOM', 'DEL'], [3, 'DEL', 'BLR'], [4, 'DEL', 'BOM']] } },
        { name: 'One flight', hidden: true, tables: { flights: [[1, 'SFO', 'JFK']] } },
        { name: 'Many routes', hidden: true, tables: { flights: [[1, 'A', 'B'], [2, 'B', 'C'], [3, 'C', 'A'], [4, 'A', 'C']] } },
      ],
    }),

    pyspark({
      id: 'spark-range-join-prices', title: 'Price at the Time of Each Order (Range Join)', difficulty: 'Hard',
      topics: ['Joins', 'Date & Time'], patterns: ['Non-equi (range) join'], domains: ['E-commerce / Sales'], roles: DE,
      summary: 'Join orders to the price list row whose validity interval contains the order date.',
      description: md('`prices` has one row per price period: valid from `valid_from` (inclusive) to `valid_to` (exclusive; null = still valid). Return `order_id`, `sku`, `order_date`, `unit_price` and `amount = qty * unit_price`. Orders with no valid price get a null price and amount.'),
      hints: ['Join on `sku` **and** `valid_from <= order_date` **and** (`valid_to` is null or `order_date < valid_to`), as a left join.'],
      schema: { orders: 'order_id INTEGER Order, sku VARCHAR SKU, order_date DATE Date, qty INTEGER Quantity', prices: 'sku VARCHAR SKU, valid_from DATE From, valid_to DATE To (exclusive), unit_price DOUBLE Price' },
      solution: code`def solve(spark, orders, prices):
    o, p = orders.alias("o"), prices.alias("p")
    cond = ((F.col("o.sku") == F.col("p.sku"))
            & (F.col("p.valid_from") <= F.col("o.order_date"))
            & (F.col("p.valid_to").isNull() | (F.col("o.order_date") < F.col("p.valid_to"))))
    return (o.join(p, cond, "left")
            .select(F.col("o.order_id").alias("order_id"), F.col("o.sku").alias("sku"),
                    F.col("o.order_date").alias("order_date"), F.col("p.unit_price").alias("unit_price"),
                    F.round(F.col("o.qty") * F.col("p.unit_price"), 2).alias("amount")))
`,
      explanation: 'A join condition can be any boolean expression. Half-open intervals (`from <= d < to`) guarantee each date matches exactly one period, so the join never fans out.',
      tests: [
        { name: 'Example', tables: { orders: [[1, 'A', '2024-01-15', 2], [2, 'A', '2024-03-01', 1], [3, 'B', '2024-01-01', 5]], prices: [['A', '2024-01-01', '2024-03-01', 10.0], ['A', '2024-03-01', null, 12.0]] } },
        { name: 'Order before any price', hidden: true, tables: { orders: [[1, 'A', '2023-12-31', 1]], prices: [['A', '2024-01-01', null, 5.0]] } },
        { name: 'Boundary day takes the new price', hidden: true, tables: { orders: [[1, 'C', '2024-02-01', 3]], prices: [['C', '2024-01-01', '2024-02-01', 1.0], ['C', '2024-02-01', null, 2.0]] } },
      ],
    }),

    pyspark({
      id: 'spark-relational-division', title: 'Students Who Completed Every Active Track', difficulty: 'Medium',
      topics: ['Joins', 'Aggregation'], patterns: ['Relational division by counting'], domains: ['Education'], roles: DE_DA,
      ...tag(sp('Microsoft', 'Full-Track Learners')),
      summary: 'Find students who completed at least one course in every active learning track.',
      description: md('Return the `student_id`s who completed a course in **every** track that is `active`. Completions in inactive tracks don\'t count (and inactive tracks aren\'t required).'),
      hints: ['Join completions to active tracks, count distinct tracks per student, and keep students whose count equals the number of active tracks.'],
      schema: { tracks: 'track_id INTEGER Track, active BOOLEAN Active', courses: 'course_id INTEGER Course, track_id INTEGER Track', completions: 'student_id INTEGER Student, course_id INTEGER Course' },
      solution: code`def solve(spark, tracks, courses, completions):
    active = tracks.filter("active").select("track_id")
    n = active.count()
    done = (completions.join(courses, "course_id").join(active, "track_id")
            .groupBy("student_id").agg(F.countDistinct("track_id").alias("tracks")))
    return done.filter(F.col("tracks") == n).select("student_id")
`,
      explanation: '"For all" questions are relational division: count what each candidate covers and compare with the total required. Counting **distinct** tracks stops two courses in one track from counting twice.',
      tests: [
        { name: 'Example', tables: { tracks: [[1, true], [2, true], [3, false]], courses: [[10, 1], [11, 1], [20, 2], [30, 3]], completions: [[100, 10], [100, 20], [101, 10], [101, 11], [102, 20], [102, 11], [102, 30]] } },
        { name: 'Nobody qualifies', hidden: true, tables: { tracks: [[1, true], [2, true]], courses: [[1, 1], [2, 2]], completions: [[5, 1]] } },
        { name: 'Single active track', hidden: true, tables: { tracks: [[7, true]], courses: [[70, 7]], completions: [[1, 70], [2, 70]] } },
      ],
    }),

    pyspark({
      id: 'spark-join-fanout', title: 'Fix the Join Fan-Out', difficulty: 'Medium',
      topics: ['Joins', 'Aggregation', 'Data Quality'], patterns: ['Aggregate before joining'], domains: ['E-commerce / Sales'], roles: DE,
      summary: 'Order revenue doubles when joined to payments — compute per-order revenue and paid amounts correctly.',
      description: md('Each order has several `order_items` and several `payments` (split tender). Return `order_id`, `revenue` (sum of item `qty * price`) and `paid` (sum of payments), both rounded to 2. Joining items and payments directly multiplies rows and inflates both sums.'),
      hints: ['Aggregate each child table to one row per order **before** joining them together.'],
      schema: { order_items: 'order_id INTEGER Order, sku VARCHAR SKU, qty INTEGER Quantity, price DOUBLE Price', payments: 'order_id INTEGER Order, method VARCHAR Method, amount DOUBLE Amount' },
      solution: code`def solve(spark, order_items, payments):
    rev = order_items.groupBy("order_id").agg(F.round(F.sum(F.col("qty") * F.col("price")), 2).alias("revenue"))
    paid = payments.groupBy("order_id").agg(F.round(F.sum("amount"), 2).alias("paid"))
    return (rev.alias("r").join(paid.alias("p"), F.col("r.order_id") == F.col("p.order_id"), "full_outer")
            .select(F.coalesce("r.order_id", "p.order_id").alias("order_id"), "revenue", "paid"))
`,
      explanation: 'Joining two one-to-many children on the same parent produces items × payments rows per order, so every sum is multiplied. Reducing each side to the parent grain first is the standard fix.',
      tests: [
        { name: 'Example', tables: { order_items: [[1, 'A', 2, 10.0], [1, 'B', 1, 5.0], [2, 'C', 1, 3.0]], payments: [[1, 'card', 15.0], [1, 'wallet', 10.0], [2, 'cash', 3.0]] } },
        { name: 'Unpaid order', hidden: true, tables: { order_items: [[3, 'A', 1, 1.0]], payments: [] } },
        { name: 'Many payments', hidden: true, tables: { order_items: [[4, 'X', 1, 9.0]], payments: [[4, 'a', 3.0], [4, 'b', 3.0], [4, 'c', 3.0]] } },
      ],
    }),

    pyspark({
      id: 'spark-top-delivery-cities', title: 'Top Cities by Delivered Orders', difficulty: 'Easy',
      topics: ['Joins', 'NULL Handling', 'Ranking & Top-N'], patterns: ['Join, filter nulls, rank'], domains: ['Food delivery'], roles: DE_DA,
      ...tag(sp('Robinhood', 'Top Delivery Cities')),
      ordered: true,
      summary: 'Rank cities by delivered orders, ignoring orders whose customer city is unknown.',
      description: md('Return the top 3 `city` values by number of **delivered** orders as `city`, `delivered`, ordered by `delivered` descending then `city`. Customers with a null or blank city are excluded.'),
      hints: ['Clean and filter the customers first (trim the city, drop null/blank), filter delivered orders, join, group, then `orderBy(...).limit(3)`.'],
      schema: { orders: 'order_id INTEGER Order, customer_id INTEGER Customer, status VARCHAR delivered · cancelled', customers: 'customer_id INTEGER Customer, city VARCHAR City' },
      solution: code`def solve(spark, orders, customers):
    known = (customers.withColumn("city", F.trim("city"))
             .filter(F.col("city").isNotNull() & (F.col("city") != "")))
    return (orders.filter(F.col("status") == "delivered")
            .join(known, "customer_id")
            .groupBy("city").agg(F.count("*").alias("delivered"))
            .orderBy(F.desc("delivered"), "city").limit(3))
`,
      explanation: 'Unknown values (null or blank) would otherwise form their own "city". `orderBy(...).limit(n)` gives a deterministic top-N only when the sort keys are unique — hence the city tie-break.',
      tests: [
        { name: 'Example', tables: { orders: [[1, 1, 'delivered'], [2, 1, 'delivered'], [3, 2, 'delivered'], [4, 3, 'delivered'], [5, 4, 'cancelled'], [6, 5, 'delivered'], [7, 6, 'delivered']], customers: [[1, 'Pune'], [2, 'Goa'], [3, null], [4, 'Pune'], [5, 'Agra'], [6, ' ']] } },
        { name: 'Fewer than three cities', hidden: true, tables: { orders: [[1, 1, 'delivered']], customers: [[1, 'Delhi']] } },
        { name: 'Ties alphabetical', hidden: true, tables: { orders: [[1, 1, 'delivered'], [2, 2, 'delivered'], [3, 3, 'delivered'], [4, 4, 'delivered']], customers: [[1, 'd'], [2, 'c'], [3, 'b'], [4, 'a']] } },
      ],
    }),

    pyspark({
      id: 'spark-except-intersect', title: 'What Changed Between Two Exports (Set Operations)', difficulty: 'Easy',
      topics: ['Set Operations'], patterns: ['exceptAll / intersect'], domains: ['Data quality'], roles: DE,
      summary: 'Classify rows as only-old, only-new or both using DataFrame set operations.',
      description: md('`old` and `new` have the same columns. Return every distinct row with a `side` column: `"removed"` (only in old), `"added"` (only in new), `"unchanged"` (in both).'),
      hints: ['`new.exceptAll(old).distinct()`, `old.exceptAll(new).distinct()`, `old.intersect(new)` — then tag each and `unionByName`.'],
      schema: { old: 'id INTEGER Id, value VARCHAR Value', new: 'id INTEGER Id, value VARCHAR Value' },
      solution: code`def solve(spark, old, new):
    added = new.exceptAll(old).distinct().withColumn("side", F.lit("added"))
    removed = old.exceptAll(new).distinct().withColumn("side", F.lit("removed"))
    same = old.intersect(new).withColumn("side", F.lit("unchanged"))
    return added.unionByName(removed).unionByName(same)
`,
      explanation: 'Set operations compare whole rows. A row whose value changed appears as one removal and one addition — exactly what a row-level diff should report. (`subtract` is `EXCEPT DISTINCT`; `exceptAll` keeps multiplicity.)',
      tests: [
        { name: 'Example', tables: { old: [[1, 'a'], [2, 'b'], [3, 'c']], new: [[1, 'a'], [2, 'B'], [4, 'd']] } },
        { name: 'Identical', hidden: true, tables: { old: [[1, 'x']], new: [[1, 'x']] } },
        { name: 'Duplicates collapse', hidden: true, tables: { old: [[1, 'x'], [1, 'x']], new: [] } },
      ],
    }),

    pyspark({
      id: 'spark-engaged-shoppers', title: 'Engaged Shoppers: Sessions and Orders the Same Day', difficulty: 'Hard',
      topics: ['Joins', 'Aggregation', 'Date & Time'], patterns: ['Join on key + date'], domains: ['Retail'], roles: DE_DA,
      ...tag(sp('Walmart', 'Engaged Shoppers Analysis')),
      summary: 'Find users with 2+ sessions on a day who also ordered that day, and total their non-returned orders.',
      description: md('A user-day is **engaged** if the user had at least 2 sessions that day and placed at least one order that day. Return `user_id`, `day`, `sessions`, `order_total` (sum of `amount` of that day\'s orders that were not returned, rounded to 2).'),
      hints: ['Aggregate sessions per (user, day) and orders per (user, day) separately, then join on both keys.'],
      schema: { sessions: 'session_id INTEGER Session, user_id INTEGER User, started_at TIMESTAMP Start', orders: 'order_id INTEGER Order, user_id INTEGER User, ordered_at TIMESTAMP When, amount DOUBLE Amount, returned BOOLEAN Returned' },
      solution: code`def solve(spark, sessions, orders):
    s = (sessions.groupBy("user_id", F.to_date("started_at").alias("day"))
         .agg(F.count("*").alias("sessions")).filter(F.col("sessions") >= 2))
    o = (orders.groupBy("user_id", F.to_date("ordered_at").alias("day"))
         .agg(F.round(F.sum(F.when(~F.col("returned"), F.col("amount")).otherwise(0.0)), 2).alias("order_total")))
    return s.join(o, ["user_id", "day"])
`,
      explanation: 'Reducing both sides to the (user, day) grain first keeps the join one-to-one. Excluding returned orders inside the sum still counts the day as having an order.',
      tests: [
        { name: 'Example', tables: { sessions: [[1, 1, '2024-05-01 09:00:00'], [2, 1, '2024-05-01 18:00:00'], [3, 2, '2024-05-01 10:00:00'], [4, 1, '2024-05-02 10:00:00']], orders: [[1, 1, '2024-05-01 19:00:00', 40.0, false], [2, 1, '2024-05-01 20:00:00', 10.0, true], [3, 2, '2024-05-01 11:00:00', 5.0, false], [4, 1, '2024-05-02 11:00:00', 7.0, false]] } },
        { name: 'All orders returned', hidden: true, tables: { sessions: [[1, 3, '2024-01-01 01:00:00'], [2, 3, '2024-01-01 02:00:00']], orders: [[1, 3, '2024-01-01 03:00:00', 9.0, true]] } },
        { name: 'Order on another day', hidden: true, tables: { sessions: [[1, 4, '2024-01-01 01:00:00'], [2, 4, '2024-01-01 02:00:00']], orders: [[1, 4, '2024-01-02 03:00:00', 9.0, false]] } },
      ],
    }),
  ],
};
