// PySpark pack 4 — window functions and ranking: row_number / rank /
// dense_rank, top-N per group, lag / lead, running and moving aggregates with
// explicit frames, ntile and percent_rank, first / last value, and comparing a
// row with its partition.
import { pyspark, md, code } from './define.js';
import { sp } from '../sql/define.js';
import { tag } from '../python/sources.js';

const DE = ['Data Engineer'];
const DE_DA = ['Data Engineer', 'Data Analyst'];

export default {
  problems: [
    pyspark({
      id: 'spark-rank-functions', title: 'row_number vs rank vs dense_rank', difficulty: 'Easy',
      topics: ['Window Functions', 'Ranking & Top-N'], patterns: ['Ranking semantics'], domains: ['Education'], roles: DE_DA,
      summary: 'Rank scores per subject three ways to see how ties are treated.',
      description: md('Per `subject`, ordered by `score` descending: return `subject`, `student`, `score`, `row_num` (ties broken by `student`), `rnk`, `dense_rnk`.'),
      hints: ['One `Window.partitionBy("subject").orderBy(F.desc("score"))`, plus `student` as a tie-breaker for `row_number`.'],
      schema: { scores: 'student VARCHAR Student, subject VARCHAR Subject, score INTEGER Score' },
      solution: code`def solve(spark, scores):
    w = Window.partitionBy("subject").orderBy(F.desc("score"))
    w_unique = Window.partitionBy("subject").orderBy(F.desc("score"), "student")
    return scores.select(
        "subject", "student", "score",
        F.row_number().over(w_unique).alias("row_num"),
        F.rank().over(w).alias("rnk"),
        F.dense_rank().over(w).alias("dense_rnk"),
    )
`,
      explanation: 'With two people tied for first: `row_number` → 1, 2; `rank` → 1, 1, 3; `dense_rank` → 1, 1, 2. `row_number` needs a unique ordering to be deterministic.',
      tests: [
        { name: 'Example', tables: { scores: [['amy', 'math', 90], ['bob', 'math', 85], ['cat', 'math', 90], ['dan', 'math', 70], ['amy', 'art', 60]] } },
        { name: 'All tied', hidden: true, tables: { scores: [['x', 'm', 5], ['w', 'm', 5], ['y', 'm', 5]] } },
        { name: 'No ties', hidden: true, tables: { scores: [['a', 's', 1], ['b', 's', 2], ['c', 's', 3]] } },
      ],
    }),

    pyspark({
      id: 'spark-top-n-per-store', title: 'Top N Sales per Store', difficulty: 'Medium',
      topics: ['Window Functions', 'Ranking & Top-N'], patterns: ['Top-N per group'], domains: ['Retail'], roles: DE_DA,
      ...tag(sp('Amazon', 'Top N Sales per Store'), sp('Walmart', 'Top 5 Products by Sales')),
      summary: 'Keep each store\'s two largest transactions.',
      description: md('Return `store_id`, `txn_id`, `amount`, `rank` for the 2 largest transactions per store (ties broken by smaller `txn_id`).'),
      hints: ['`row_number()` over `partitionBy("store_id").orderBy(F.desc("amount"), "txn_id")`, then filter `<= 2`.'],
      schema: { sales: 'txn_id INTEGER Txn, store_id INTEGER Store, amount DOUBLE Amount' },
      solution: code`def solve(spark, sales):
    w = Window.partitionBy("store_id").orderBy(F.desc("amount"), "txn_id")
    return (sales.withColumn("rank", F.row_number().over(w))
            .filter(F.col("rank") <= 2)
            .select("store_id", "txn_id", "amount", "rank"))
`,
      explanation: 'Top-N per group is the most common window pattern: number rows within each partition, then filter. Use `dense_rank` instead when ties should all be kept.',
      tests: [
        { name: 'Example', tables: { sales: [[1, 10, 50.0], [2, 10, 80.0], [3, 10, 20.0], [4, 11, 5.0]] } },
        { name: 'Ties use txn_id', hidden: true, tables: { sales: [[9, 1, 10.0], [8, 1, 10.0], [7, 1, 10.0]] } },
        { name: 'Many stores', hidden: true, tables: { sales: [[1, 1, 1.0], [2, 2, 2.0], [3, 3, 3.0], [4, 3, 4.0], [5, 3, 5.0]] } },
      ],
    }),

    pyspark({
      id: 'spark-top-customers-region', title: 'Top Two Customers by Spend per Region', difficulty: 'Hard',
      topics: ['Window Functions', 'Ranking & Top-N', 'Joins'], patterns: ['Aggregate → rank → filter (with ties)'], domains: ['E-commerce / Sales'], roles: DE_DA,
      ...tag(sp('EPAM', 'Top Customers by Spend')),
      summary: 'Join, aggregate spend per customer and keep the top two per region, ties included.',
      description: md('Return `region`, `customer_id`, `spend` (rounded to 2) and `rnk` for customers whose `dense_rank` by spend within their region is ≤ 2.'),
      hints: ['Aggregate orders per customer first, join to customers for the region, then `dense_rank` over region.'],
      schema: { customers: 'customer_id INTEGER Customer, region VARCHAR Region', orders: 'order_id INTEGER Order, customer_id INTEGER Customer, amount DOUBLE Amount' },
      solution: code`def solve(spark, customers, orders):
    spend = orders.groupBy("customer_id").agg(F.round(F.sum("amount"), 2).alias("spend"))
    w = Window.partitionBy("region").orderBy(F.desc("spend"))
    return (customers.join(spend, "customer_id")
            .withColumn("rnk", F.dense_rank().over(w))
            .filter(F.col("rnk") <= 2)
            .select("region", "customer_id", "spend", "rnk"))
`,
      explanation: '`dense_rank` keeps every customer tied at a rank, so "top two" may return more than two rows — usually what the business means. Aggregate before ranking: windows run per row.',
      tests: [
        { name: 'Example', tables: { customers: [[1, 'north'], [2, 'north'], [3, 'north'], [4, 'south']], orders: [[1, 1, 100.0], [2, 2, 50.0], [3, 2, 50.0], [4, 3, 10.0], [5, 4, 5.0]] } },
        { name: 'Ties at second place', hidden: true, tables: { customers: [[1, 'w'], [2, 'w'], [3, 'w']], orders: [[1, 1, 9.0], [2, 2, 5.0], [3, 3, 5.0]] } },
        { name: 'Customer without orders', hidden: true, tables: { customers: [[1, 'e'], [2, 'e']], orders: [[1, 1, 1.0]] } },
      ],
    }),

    pyspark({
      id: 'spark-above-dept-average', title: 'Employees Above Their Department Average', difficulty: 'Medium',
      topics: ['Window Functions', 'Aggregation'], patterns: ['Compare row with partition aggregate'], domains: ['HR / People'], roles: DE_DA,
      ...tag(sp('Accenture', 'Employee Earnings')),
      summary: 'Use a window average (no join) to find employees paid above their department mean.',
      description: md('Return `dept`, `name`, `salary`, `dept_avg` (rounded to 2) for employees whose salary is strictly above their department\'s average.'),
      hints: ['`F.avg("salary").over(Window.partitionBy("dept"))` attaches the department average to every row.'],
      schema: { employees: 'emp_id INTEGER Id, name VARCHAR Name, dept VARCHAR Department, salary INTEGER Salary' },
      solution: code`def solve(spark, employees):
    w = Window.partitionBy("dept")
    return (employees.withColumn("dept_avg", F.round(F.avg("salary").over(w), 2))
            .filter(F.col("salary") > F.col("dept_avg"))
            .select("dept", "name", "salary", "dept_avg"))
`,
      explanation: 'An aggregate over a window without `orderBy` covers the whole partition, so every row sees its group\'s average — no group-by-then-join needed.',
      tests: [
        { name: 'Example', tables: { employees: [[1, 'a', 'eng', 100], [2, 'b', 'eng', 200], [3, 'c', 'eng', 150], [4, 'd', 'ops', 50]] } },
        { name: 'Everyone equal', hidden: true, tables: { employees: [[1, 'x', 'hr', 10], [2, 'y', 'hr', 10]] } },
        { name: 'Fractional average', hidden: true, tables: { employees: [[1, 'p', 'bi', 1], [2, 'q', 'bi', 2], [3, 'r', 'bi', 2]] } },
      ],
    }),

    pyspark({
      id: 'spark-lag-price-change', title: 'Day-over-Day Change and Percent Change', difficulty: 'Medium',
      topics: ['Window Functions', 'Date & Time'], patterns: ['Previous row (lag)'], domains: ['Trading'], roles: DE_DA,
      ...tag(sp('Nielsen', 'Daily Stock Price Change')),
      summary: 'Compare each closing price with the previous trading day per ticker.',
      description: md('Return `ticker`, `day`, `close`, `change` (close − previous close, rounded to 2) and `pct_change` (change / previous close × 100, rounded to 2). The first day per ticker has nulls.'),
      hints: ['`F.lag("close").over(Window.partitionBy("ticker").orderBy("day"))`.'],
      schema: { prices: 'ticker VARCHAR Ticker, day DATE Trading day, close DOUBLE Close' },
      solution: code`def solve(spark, prices):
    prev = F.lag("close").over(Window.partitionBy("ticker").orderBy("day"))
    return (prices.withColumn("prev", prev)
            .select("ticker", "day", "close",
                    F.round(F.col("close") - F.col("prev"), 2).alias("change"),
                    F.round((F.col("close") - F.col("prev")) / F.col("prev") * 100, 2).alias("pct_change")))
`,
      explanation: '`lag` reads the previous row in the window order; with gaps (weekends) "previous trading day" is just the previous row — no calendar arithmetic needed.',
      tests: [
        { name: 'Example', tables: { prices: [['ACME', '2024-01-02', 100.0], ['ACME', '2024-01-03', 105.0], ['ACME', '2024-01-05', 99.75], ['ZED', '2024-01-02', 10.0]] } },
        { name: 'Unsorted input', hidden: true, tables: { prices: [['X', '2024-02-02', 2.0], ['X', '2024-02-01', 1.0]] } },
        { name: 'Flat price', hidden: true, tables: { prices: [['Y', '2024-03-01', 5.0], ['Y', '2024-03-02', 5.0]] } },
      ],
    }),

    pyspark({
      id: 'spark-price-active-days', title: 'How Long Was Each Price Active? (lead)', difficulty: 'Medium',
      topics: ['Window Functions', 'Date & Time'], patterns: ['Next row (lead) to build intervals'], domains: ['E-commerce / Sales'], roles: DE,
      ...tag(sp('Nielsen', 'Price History Tracker')),
      summary: 'Turn price-change events into validity intervals and their length in days.',
      description: md('Each row is a price change. Return `sku`, `price`, `valid_from` (= `changed_on`), `valid_to` (the next change date for the SKU, or null if current) and `days_active` (`datediff(valid_to, valid_from)`, null if current).'),
      hints: ['`F.lead("changed_on").over(Window.partitionBy("sku").orderBy("changed_on"))`.'],
      schema: { price_changes: 'sku VARCHAR SKU, changed_on DATE Changed, price DOUBLE New price' },
      solution: code`def solve(spark, price_changes):
    nxt = F.lead("changed_on").over(Window.partitionBy("sku").orderBy("changed_on"))
    return (price_changes.withColumn("valid_to", nxt)
            .select("sku", "price", F.col("changed_on").alias("valid_from"), "valid_to",
                    F.datediff("valid_to", "changed_on").alias("days_active")))
`,
      explanation: 'Turning point-in-time events into `[from, to)` intervals with `lead` is how SCD2 tables and as-of joins are built from change logs.',
      tests: [
        { name: 'Example', tables: { price_changes: [['A', '2024-01-01', 10.0], ['A', '2024-01-11', 12.0], ['A', '2024-02-01', 11.0], ['B', '2024-01-05', 3.0]] } },
        { name: 'Single change', hidden: true, tables: { price_changes: [['C', '2024-06-01', 1.0]] } },
        { name: 'Unsorted changes', hidden: true, tables: { price_changes: [['D', '2024-03-10', 2.0], ['D', '2024-03-01', 1.0]] } },
      ],
    }),

    pyspark({
      id: 'spark-rolling-average', title: 'Trailing 3-Day Average and Above-Trend Days', difficulty: 'Medium',
      topics: ['Window Functions'], patterns: ['Moving average with rowsBetween'], domains: ['Retail'], roles: DE_DA,
      ...tag(sp('Twitter (X)', 'Rolling Sales Average')),
      summary: 'Compute a trailing 3-row moving average per store and flag days above it.',
      description: md('Per store, ordered by `day`, return `store_id`, `day`, `sales`, `avg_3d` (average of this day and the two previous rows, rounded to 2) and `above_trend` (`sales > avg_3d`).'),
      hints: ['`.rowsBetween(-2, 0)` is "two rows before through the current row".'],
      schema: { daily_sales: 'store_id INTEGER Store, day DATE Day, sales DOUBLE Sales' },
      solution: code`def solve(spark, daily_sales):
    w = Window.partitionBy("store_id").orderBy("day").rowsBetween(-2, 0)
    return (daily_sales.withColumn("avg_3d", F.round(F.avg("sales").over(w), 2))
            .withColumn("above_trend", F.col("sales") > F.col("avg_3d")))
`,
      explanation: 'An explicit row frame defines the moving window. The first two days average over fewer rows — say so in the spec, or filter them out if a "full window" is required.',
      tests: [
        { name: 'Example', tables: { daily_sales: [[1, '2024-01-01', 10.0], [1, '2024-01-02', 20.0], [1, '2024-01-03', 30.0], [1, '2024-01-04', 5.0], [2, '2024-01-01', 7.0]] } },
        { name: 'Flat sales', hidden: true, tables: { daily_sales: [[3, '2024-01-01', 1.0], [3, '2024-01-02', 1.0], [3, '2024-01-03', 1.0]] } },
        { name: 'Unsorted days', hidden: true, tables: { daily_sales: [[4, '2024-01-03', 3.0], [4, '2024-01-01', 1.0], [4, '2024-01-02', 2.0]] } },
      ],
    }),

    pyspark({
      id: 'spark-cumulative-share', title: 'Running Total and Share of the Grand Total', difficulty: 'Medium',
      topics: ['Window Functions', 'Aggregation'], patterns: ['Running sum + whole-partition sum'], domains: ['E-commerce / Sales'], roles: DE_DA,
      summary: 'Pareto view: cumulative revenue share of products sorted from best to worst seller.',
      description: md('Order products by `revenue` descending (ties by `product`). Return `product`, `revenue`, `cum_revenue` and `cum_share` (cumulative revenue / total revenue, rounded to 3).'),
      hints: ['One window with `rowsBetween(Window.unboundedPreceding, Window.currentRow)` for the running sum; a window with no ordering for the total.'],
      schema: { product_revenue: 'product VARCHAR Product, revenue DOUBLE Revenue' },
      solution: code`def solve(spark, product_revenue):
    running = Window.orderBy(F.desc("revenue"), "product").rowsBetween(Window.unboundedPreceding, Window.currentRow)
    whole = Window.partitionBy(F.lit(1))
    return (product_revenue
            .withColumn("cum_revenue", F.round(F.sum("revenue").over(running), 2))
            .withColumn("cum_share", F.round(F.col("cum_revenue") / F.sum("revenue").over(whole), 3)))
`,
      explanation: 'Mixing a running frame and a full-partition window answers "what share of revenue do the top N products make?" without a separate total query. A window with no partition puts all data on one task — fine for small summaries, a bottleneck at scale.',
      tests: [
        { name: 'Example', tables: { product_revenue: [['a', 50.0], ['b', 30.0], ['c', 15.0], ['d', 5.0]] } },
        { name: 'Ties by name', hidden: true, tables: { product_revenue: [['y', 10.0], ['x', 10.0]] } },
        { name: 'Single product', hidden: true, tables: { product_revenue: [['z', 3.0]] } },
      ],
    }),

    pyspark({
      id: 'spark-salary-quartiles', title: 'Salary Quartiles and Percentile Position', difficulty: 'Medium',
      topics: ['Window Functions', 'Statistics'], patterns: ['ntile + percent_rank'], domains: ['HR / People'], roles: DE_DA,
      ...tag(sp('Google', 'Salary Quartile Bands')),
      summary: 'Assign quartiles and percentile ranks within each department.',
      description: md('Return `dept`, `emp_id`, `salary`, `quartile` (`ntile(4)` by salary descending, ties by `emp_id`) and `pct_rank` (`percent_rank` by salary ascending, rounded to 3).'),
      hints: ['Two windows: one descending for `ntile`, one ascending for `percent_rank`.'],
      schema: { employees: 'emp_id INTEGER Id, dept VARCHAR Department, salary INTEGER Salary' },
      solution: code`def solve(spark, employees):
    desc = Window.partitionBy("dept").orderBy(F.desc("salary"), "emp_id")
    asc = Window.partitionBy("dept").orderBy("salary")
    return employees.select(
        "dept", "emp_id", "salary",
        F.ntile(4).over(desc).alias("quartile"),
        F.round(F.percent_rank().over(asc), 3).alias("pct_rank"),
    )
`,
      explanation: '`ntile(4)` splits each partition into four nearly equal buckets; `percent_rank` = (rank − 1) / (rows − 1), so the lowest salary is 0 and the highest 1.',
      tests: [
        { name: 'Example', tables: { employees: [[1, 'eng', 100], [2, 'eng', 200], [3, 'eng', 300], [4, 'eng', 400], [5, 'eng', 500], [6, 'ops', 50]] } },
        { name: 'Ties', hidden: true, tables: { employees: [[1, 'hr', 10], [2, 'hr', 10], [3, 'hr', 20]] } },
        { name: 'Two people', hidden: true, tables: { employees: [[1, 'bi', 5], [2, 'bi', 6]] } },
      ],
    }),

    pyspark({
      id: 'spark-first-last-value', title: 'First and Latest Plan per Subscriber', difficulty: 'Medium',
      topics: ['Window Functions', 'Aggregation'], patterns: ['min_by / max_by'], domains: ['Subscriptions / SaaS'], roles: DE_DA,
      summary: 'Find each subscriber\'s first plan, current plan and how many times they changed plan.',
      description: md('From plan-change events, return `user_id`, `first_plan` (plan at the earliest event), `current_plan` (plan at the latest event), and `changes` (number of events where the plan differs from the previous event\'s plan).'),
      hints: ['`F.min_by("plan", "changed_at")` / `F.max_by(...)` give the plan at the min / max time in one aggregation.', 'Count changes with `lag` + a flag, then sum.'],
      schema: { plan_events: 'user_id INTEGER User, changed_at TIMESTAMP When, plan VARCHAR Plan' },
      solution: code`def solve(spark, plan_events):
    w = Window.partitionBy("user_id").orderBy("changed_at")
    flagged = plan_events.withColumn(
        "changed", F.when(F.lag("plan").over(w).isNotNull() & (F.lag("plan").over(w) != F.col("plan")), 1).otherwise(0))
    return flagged.groupBy("user_id").agg(
        F.min_by("plan", "changed_at").alias("first_plan"),
        F.max_by("plan", "changed_at").alias("current_plan"),
        F.sum("changed").alias("changes"),
    )
`,
      explanation: '`min_by`/`max_by` return the value of one column at the minimum/maximum of another — "latest record per key" without ranking and filtering. Events that repeat the same plan aren\'t changes, hence comparing with the previous row.',
      tests: [
        { name: 'Example', tables: { plan_events: [[1, '2024-01-01 00:00:00', 'free'], [1, '2024-02-01 00:00:00', 'pro'], [1, '2024-03-01 00:00:00', 'pro'], [1, '2024-04-01 00:00:00', 'team'], [2, '2024-01-05 00:00:00', 'pro']] } },
        { name: 'Downgrade and back', hidden: true, tables: { plan_events: [[3, '2024-01-01 00:00:00', 'pro'], [3, '2024-01-02 00:00:00', 'free'], [3, '2024-01-03 00:00:00', 'pro']] } },
        { name: 'Unsorted input', hidden: true, tables: { plan_events: [[4, '2024-05-02 00:00:00', 'b'], [4, '2024-05-01 00:00:00', 'a']] } },
      ],
    }),

    pyspark({
      id: 'spark-nth-purchase', title: 'Each Customer\'s Third Purchase', difficulty: 'Easy',
      topics: ['Window Functions', 'Ranking & Top-N'], patterns: ['Nth event per key'], domains: ['E-commerce / Sales'], roles: DE_DA,
      summary: 'Pick the third purchase of every customer who made at least three.',
      description: md('Return `customer_id`, `purchase_id`, `purchased_at`, `amount` of each customer\'s 3rd purchase by time (ties by `purchase_id`).'),
      hints: ['`row_number()` then filter `== 3`.'],
      schema: { purchases: 'purchase_id INTEGER Purchase, customer_id INTEGER Customer, purchased_at TIMESTAMP When, amount DOUBLE Amount' },
      solution: code`def solve(spark, purchases):
    w = Window.partitionBy("customer_id").orderBy("purchased_at", "purchase_id")
    return (purchases.withColumn("n", F.row_number().over(w))
            .filter(F.col("n") == 3).drop("n"))
`,
      explanation: 'Numbering events per key answers every "Nth occurrence" question; the tie-breaker makes it deterministic when timestamps collide.',
      tests: [
        { name: 'Example', tables: { purchases: [[1, 7, '2024-01-01 10:00:00', 5.0], [2, 7, '2024-01-02 10:00:00', 6.0], [3, 7, '2024-01-03 10:00:00', 7.0], [4, 7, '2024-01-04 10:00:00', 8.0], [5, 8, '2024-01-01 10:00:00', 1.0]] } },
        { name: 'Same timestamp', hidden: true, tables: { purchases: [[30, 9, '2024-01-01 00:00:00', 3.0], [10, 9, '2024-01-01 00:00:00', 1.0], [20, 9, '2024-01-01 00:00:00', 2.0]] } },
        { name: 'Nobody has three', hidden: true, tables: { purchases: [[1, 1, '2024-01-01 00:00:00', 1.0]] } },
      ],
    }),

    pyspark({
      id: 'spark-last-visit-checkouts', title: 'Books Borrowed on the Latest Visit', difficulty: 'Easy',
      topics: ['Window Functions', 'Aggregation'], patterns: ['Latest group per key'], domains: ['Retail'], roles: DE_DA,
      ...tag(sp('Walmart', 'Last Visit Checkouts')),
      summary: 'Count how many items each member checked out on their most recent visit date.',
      description: md('Return `member_id`, `last_visit` (latest `visit_date`) and `books` (number of checkouts on that date).'),
      hints: ['`F.max("visit_date").over(Window.partitionBy("member_id"))`, keep rows on that date, then count.'],
      schema: { checkouts: 'checkout_id INTEGER Checkout, member_id INTEGER Member, visit_date DATE Visit date, book VARCHAR Book' },
      solution: code`def solve(spark, checkouts):
    last = F.max("visit_date").over(Window.partitionBy("member_id"))
    return (checkouts.withColumn("last_visit", last)
            .filter(F.col("visit_date") == F.col("last_visit"))
            .groupBy("member_id", "last_visit").agg(F.count("*").alias("books")))
`,
      explanation: 'Attaching the partition max to each row and filtering keeps **all** rows of the latest visit, which a `row_number() == 1` filter would cut to one.',
      tests: [
        { name: 'Example', tables: { checkouts: [[1, 1, '2024-01-01', 'a'], [2, 1, '2024-02-01', 'b'], [3, 1, '2024-02-01', 'c'], [4, 2, '2024-01-05', 'd']] } },
        { name: 'Single visit', hidden: true, tables: { checkouts: [[1, 3, '2024-03-03', 'x'], [2, 3, '2024-03-03', 'y'], [3, 3, '2024-03-03', 'z']] } },
        { name: 'Older busier visit', hidden: true, tables: { checkouts: [[1, 4, '2024-01-01', 'a'], [2, 4, '2024-01-01', 'b'], [3, 4, '2024-01-09', 'c']] } },
      ],
    }),

    pyspark({
      id: 'spark-top-support-agents', title: 'Top Support Agents, Ties Included', difficulty: 'Easy',
      topics: ['Ranking & Top-N', 'Aggregation'], patterns: ['dense_rank ≤ k'], domains: ['Customer support'], roles: DE_DA,
      ...tag(sp('Microsoft', 'Top Support Agents')),
      summary: 'Agents with the two highest resolved-ticket counts in August, keeping ties.',
      description: md('Count tickets with `status = "resolved"` and `resolved_on` in August 2024 per agent. Return `agent`, `resolved`, `rnk` for agents with `dense_rank` ≤ 2 by count.'),
      hints: ['Filter by month with `F.month(...) == 8` and year, aggregate, then dense_rank over all agents.'],
      schema: { tickets: 'ticket_id INTEGER Ticket, agent VARCHAR Agent, status VARCHAR Status, resolved_on DATE Resolved' },
      solution: code`def solve(spark, tickets):
    aug = tickets.filter((F.col("status") == "resolved") & (F.year("resolved_on") == 2024) & (F.month("resolved_on") == 8))
    counts = aug.groupBy("agent").agg(F.count("*").alias("resolved"))
    return counts.withColumn("rnk", F.dense_rank().over(Window.orderBy(F.desc("resolved")))).filter(F.col("rnk") <= 2)
`,
      explanation: '"Top two counts" means two distinct count values — `dense_rank`. A global window (no partition) is fine on a small aggregated table.',
      tests: [
        { name: 'Example', tables: { tickets: [[1, 'ana', 'resolved', '2024-08-01'], [2, 'ana', 'resolved', '2024-08-02'], [3, 'raj', 'resolved', '2024-08-03'], [4, 'li', 'resolved', '2024-08-04'], [5, 'li', 'open', null], [6, 'zoe', 'resolved', '2024-07-31']] } },
        { name: 'Single agent', hidden: true, tables: { tickets: [[1, 'x', 'resolved', '2024-08-10']] } },
        { name: 'Other years excluded', hidden: true, tables: { tickets: [[1, 'a', 'resolved', '2023-08-01'], [2, 'b', 'resolved', '2024-08-01']] } },
      ],
    }),
  ],
};
