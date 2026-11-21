// PySpark pack 2 — aggregation: groupBy/agg, conditional aggregates,
// countDistinct, median, collect_list, pivots as conditional aggregation, weighted
// mode, HAVING-style filters, and subtotals built from several groupings
// (rollup itself isn't available in the sandbox engine).
import { pyspark, md, code } from './define.js';
import { sp } from '../sql/define.js';
import { tag } from '../python/sources.js';

const DE_DA = ['Data Engineer', 'Data Analyst'];

export default {
  problems: [
    pyspark({
      id: 'spark-total-purchases', title: 'Total Purchases per Customer', difficulty: 'Easy',
      topics: ['Aggregation', 'Filtering'], patterns: ['Filter → group → aggregate'], domains: ['E-commerce / Sales'], roles: DE_DA,
      summary: 'Sum completed purchases per customer, ignoring refunds and test accounts.',
      description: md('Return `customer_id`, `orders` (count) and `total` (sum of `amount`, rounded to 2) over purchases with `status = "completed"` from customers whose id is not in the test range (ids ≥ 9000 are test accounts).'),
      hints: ['Filter first, then `groupBy("customer_id").agg(F.count("*"), F.round(F.sum("amount"), 2))`.'],
      schema: { purchases: 'purchase_id INTEGER Id, customer_id INTEGER Customer, amount DOUBLE Amount, status VARCHAR completed · refunded · pending' },
      solution: code`def solve(spark, purchases):
    return (purchases
            .filter((F.col("status") == "completed") & (F.col("customer_id") < 9000))
            .groupBy("customer_id")
            .agg(F.count("*").alias("orders"), F.round(F.sum("amount"), 2).alias("total")))
`,
      explanation: 'Filtering before grouping is both correct (refunds never enter the sums) and cheaper — less data is shuffled for the aggregation.',
      tests: [
        { name: 'Example', tables: { purchases: [[1, 10, 20.0, 'completed'], [2, 10, 5.5, 'completed'], [3, 10, 9.0, 'refunded'], [4, 11, 7.25, 'completed'], [5, 9001, 99.0, 'completed']] } },
        { name: 'Only pending', hidden: true, tables: { purchases: [[1, 1, 1.0, 'pending']] } },
        { name: 'Rounding', hidden: true, tables: { purchases: [[1, 2, 0.1, 'completed'], [2, 2, 0.2, 'completed']] } },
      ],
    }),

    pyspark({
      id: 'spark-food-beverage-sales', title: 'Product Sales, Revenue and Stock Left', difficulty: 'Medium',
      topics: ['Aggregation', 'Joins'], patterns: ['Aggregate then join'], domains: ['Food & beverage'], roles: DE_DA,
      summary: 'Join a product catalogue to sales and report units sold, revenue and remaining stock — including unsold products.',
      description: md('For every product return `product_id`, `name`, `units_sold`, `revenue` (units × catalogue price, rounded to 2) and `stock_left` (`opening_stock − units_sold`). Products with no sales show 0 units and 0 revenue.'),
      hints: ['Aggregate sales per product, then **left** join from products and `coalesce` the missing sums to 0.'],
      schema: { products: 'product_id INTEGER Product, name VARCHAR Name, price DOUBLE Unit price, opening_stock INTEGER Opening stock', sales: 'sale_id INTEGER Sale, product_id INTEGER Product, qty INTEGER Units' },
      solution: code`def solve(spark, products, sales):
    sold = sales.groupBy("product_id").agg(F.sum("qty").alias("units"))
    joined = (products.join(sold, "product_id", "left")
              .withColumn("units_sold", F.coalesce(F.col("units"), F.lit(0))))
    return joined.select(
        "product_id", "name", "units_sold",
        F.round(F.col("units_sold") * F.col("price"), 2).alias("revenue"),
        (F.col("opening_stock") - F.col("units_sold")).alias("stock_left"),
    )
`,
      explanation: 'A left join keeps products that never sold; their aggregates are null, and `coalesce` turns them into the zeros the report needs.',
      tests: [
        { name: 'Example', tables: { products: [[1, 'Latte', 3.5, 100], [2, 'Muffin', 2.25, 40], [3, 'Tea', 2.0, 50]], sales: [[1, 1, 3], [2, 1, 2], [3, 2, 10]] } },
        { name: 'No sales at all', hidden: true, tables: { products: [[1, 'X', 1.0, 5]], sales: [] } },
        { name: 'Oversold', hidden: true, tables: { products: [[9, 'Y', 1.5, 1]], sales: [[1, 9, 3]] } },
      ],
    }),

    pyspark({
      id: 'spark-monthly-transactions', title: 'Monthly Transaction Summary', difficulty: 'Medium',
      topics: ['Aggregation', 'Date & Time'], patterns: ['Group by month'], domains: ['Payments'], roles: DE_DA,
      ...tag(sp('Amazon', 'Monthly Transaction Summary')),
      summary: 'Count, sum and average transactions per account per month.',
      description: md('Return `account_id`, `month` (first day of the month, as a date), `txns`, `total` and `avg_amount` (both rounded to 2).'),
      hints: ['`F.trunc("txn_date", "month")` gives the first day of the month as a date.'],
      schema: { transactions: 'txn_id INTEGER Id, account_id INTEGER Account, txn_date DATE Date, amount DOUBLE Amount' },
      solution: code`def solve(spark, transactions):
    return (transactions
            .groupBy("account_id", F.trunc("txn_date", "month").alias("month"))
            .agg(F.count("*").alias("txns"),
                 F.round(F.sum("amount"), 2).alias("total"),
                 F.round(F.avg("amount"), 2).alias("avg_amount")))
`,
      explanation: 'Grouping by a truncated date is the standard monthly bucket; keeping it as a date (rather than a "2024-03" string) keeps it sortable and joinable to calendar tables.',
      tests: [
        { name: 'Example', tables: { transactions: [[1, 7, '2024-01-03', 10.0], [2, 7, '2024-01-28', 20.0], [3, 7, '2024-02-01', 5.0], [4, 8, '2024-01-15', 1.5]] } },
        { name: 'Year boundary', hidden: true, tables: { transactions: [[1, 1, '2023-12-31', 1.0], [2, 1, '2024-01-01', 2.0]] } },
        { name: 'Averages round', hidden: true, tables: { transactions: [[1, 2, '2024-05-01', 1.0], [2, 2, '2024-05-02', 1.0], [3, 2, '2024-05-03', 2.0]] } },
      ],
    }),

    pyspark({
      id: 'spark-daily-store-sales', title: 'Daily Total Sales per Store', difficulty: 'Easy',
      topics: ['Aggregation', 'Date & Time'], patterns: ['Group by day'], domains: ['Retail'], roles: DE_DA,
      ...tag(sp('Walmart', 'Daily Total Sales')),
      summary: 'Roll timestamped sales up to one row per store and calendar day.',
      description: md('Return `store_id`, `sale_date` (date of `sold_at`) and `total_sales` (sum of `qty * price`, rounded to 2).'),
      hints: ['`F.to_date("sold_at")` drops the time part.'],
      schema: { sales: 'sale_id INTEGER Sale, store_id INTEGER Store, sold_at TIMESTAMP When, qty INTEGER Units, price DOUBLE Unit price' },
      solution: code`def solve(spark, sales):
    return (sales
            .groupBy("store_id", F.to_date("sold_at").alias("sale_date"))
            .agg(F.round(F.sum(F.col("qty") * F.col("price")), 2).alias("total_sales")))
`,
      explanation: 'Aggregating an expression (`qty * price`) inside `sum` avoids a separate `withColumn`. Converting the timestamp to a date is what defines the daily grain.',
      tests: [
        { name: 'Example', tables: { sales: [[1, 1, '2024-07-01 09:00:00', 2, 3.5], [2, 1, '2024-07-01 21:00:00', 1, 10.0], [3, 1, '2024-07-02 08:00:00', 1, 1.0], [4, 2, '2024-07-01 12:00:00', 4, 2.25]] } },
        { name: 'Midnight boundary', hidden: true, tables: { sales: [[1, 5, '2024-07-01 23:59:59', 1, 1.0], [2, 5, '2024-07-02 00:00:00', 1, 1.0]] } },
        { name: 'Single sale', hidden: true, tables: { sales: [[1, 3, '2024-01-01 00:00:00', 3, 0.1]] } },
      ],
    }),

    pyspark({
      id: 'spark-item-weight-per-person', title: 'Total Weight of Each Item per Person', difficulty: 'Easy',
      topics: ['Aggregation'], patterns: ['Group by two keys'], domains: ['Logistics'], roles: DE_DA,
      ...tag(sp('Amazon', 'Aggregate Item Weight per Person')),
      summary: 'Sum shipment weights per (person, item) and keep only heavy combinations.',
      description: md('Return `person`, `item`, `total_kg` (rounded to 2) for (person, item) pairs whose total weight is at least `5` kg. Item names are case-insensitive — report them lowercased.'),
      hints: ['Normalise the key (`F.lower`) before grouping; filter on the aggregate afterwards (SQL\'s HAVING).'],
      schema: { shipments: 'id INTEGER Id, person VARCHAR Person, item VARCHAR Item, weight_kg DOUBLE Weight' },
      solution: code`def solve(spark, shipments):
    return (shipments
            .groupBy("person", F.lower("item").alias("item"))
            .agg(F.round(F.sum("weight_kg"), 2).alias("total_kg"))
            .filter(F.col("total_kg") >= 5))
`,
      explanation: 'A filter after `agg` is HAVING. Normalising the grouping key avoids "Rice" and "rice" becoming separate groups.',
      tests: [
        { name: 'Example', tables: { shipments: [[1, 'ana', 'Rice', 3.0], [2, 'ana', 'rice', 2.5], [3, 'ana', 'Salt', 1.0], [4, 'raj', 'Oil', 6.0]] } },
        { name: 'Nothing heavy enough', hidden: true, tables: { shipments: [[1, 'x', 'a', 4.99]] } },
        { name: 'Exactly five', hidden: true, tables: { shipments: [[1, 'y', 'B', 2.5], [2, 'y', 'b', 2.5]] } },
      ],
    }),

    pyspark({
      id: 'spark-call-center-daily', title: 'Unique Callers and Talk Time per Day', difficulty: 'Easy',
      topics: ['Aggregation', 'Date & Time'], patterns: ['countDistinct'], domains: ['Customer support'], roles: DE_DA,
      ...tag(sp('Workday', 'Call Center')),
      summary: 'Per day: distinct callers, total calls and total minutes.',
      description: md('Return `call_date`, `unique_callers`, `calls` and `minutes` (sum of `duration_sec` / 60, rounded to 1).'),
      hints: ['`F.countDistinct("caller")` next to `F.count("*")`.'],
      schema: { calls: 'call_id INTEGER Call, caller VARCHAR Caller number, started_at TIMESTAMP Start, duration_sec INTEGER Duration' },
      solution: code`def solve(spark, calls):
    return (calls
            .groupBy(F.to_date("started_at").alias("call_date"))
            .agg(F.countDistinct("caller").alias("unique_callers"),
                 F.count("*").alias("calls"),
                 F.round(F.sum("duration_sec") / 60, 1).alias("minutes")))
`,
      explanation: '`countDistinct` is exact but needs to track every value; at scale `approx_count_distinct` (HyperLogLog) trades a small error for constant memory.',
      tests: [
        { name: 'Example', tables: { calls: [[1, '555-1', '2024-03-01 09:00:00', 120], [2, '555-1', '2024-03-01 10:00:00', 60], [3, '555-2', '2024-03-01 11:00:00', 30], [4, '555-1', '2024-03-02 09:00:00', 600]] } },
        { name: 'Single call', hidden: true, tables: { calls: [[1, 'x', '2024-01-01 00:00:00', 45]] } },
        { name: 'Many repeat callers', hidden: true, tables: { calls: [[1, 'a', '2024-02-02 01:00:00', 6], [2, 'a', '2024-02-02 02:00:00', 6], [3, 'a', '2024-02-02 03:00:00', 6]] } },
      ],
    }),

    pyspark({
      id: 'spark-frequent-error-codes', title: 'Most Frequent Error Codes per Service', difficulty: 'Medium',
      topics: ['Aggregation', 'Ranking & Top-N'], patterns: ['Count then rank with ties'], domains: ['Platform / Ops'], roles: ['Data Engineer'],
      ...tag(sp('Juniper Networks', 'Most Frequent Error Codes')),
      summary: 'Find each service\'s most common error code, keeping ties.',
      description: md('Considering only events with `level = "ERROR"`, return `service`, `error_code` and `occurrences` for the code(s) that occur most often in each service — all tied codes included.'),
      hints: ['Count per (service, code), then `F.max("occurrences").over(Window.partitionBy("service"))` and keep rows equal to it.'],
      schema: { events: 'event_id INTEGER Id, service VARCHAR Service, level VARCHAR INFO · WARN · ERROR, error_code VARCHAR Code' },
      solution: code`def solve(spark, events):
    counts = (events.filter(F.col("level") == "ERROR")
              .groupBy("service", "error_code").agg(F.count("*").alias("occurrences")))
    top = F.max("occurrences").over(Window.partitionBy("service"))
    return counts.withColumn("top", top).filter(F.col("occurrences") == F.col("top")).drop("top")
`,
      explanation: 'Comparing each count with the partition maximum keeps ties naturally — `row_number() == 1` would arbitrarily keep only one of the tied codes.',
      tests: [
        { name: 'Example', tables: { events: [[1, 'api', 'ERROR', 'E500'], [2, 'api', 'ERROR', 'E500'], [3, 'api', 'ERROR', 'E404'], [4, 'db', 'ERROR', 'E1'], [5, 'db', 'ERROR', 'E2'], [6, 'db', 'WARN', 'E1']] } },
        { name: 'No errors', hidden: true, tables: { events: [[1, 'x', 'INFO', 'I1']] } },
        { name: 'Single code', hidden: true, tables: { events: [[1, 'q', 'ERROR', 'Q9'], [2, 'q', 'ERROR', 'Q9']] } },
      ],
    }),

    pyspark({
      id: 'spark-attendance-pivot', title: 'Attendance Status Counts as Columns', difficulty: 'Medium',
      topics: ['Pivoting', 'Aggregation'], patterns: ['pivot with fixed values'], domains: ['HR / People'], roles: DE_DA,
      ...tag(sp('TCS', 'Employee Attendance'), sp('Infosys', 'Employee Attendance')),
      summary: 'Turn one row per attendance record into one row per employee with a count per status — a pivot via conditional aggregation.',
      description: md('Return `employee_id`, `present`, `absent`, `leave` — the number of days with each status. Every employee has all three columns, with 0 where they had none.'),
      hints: ['One conditional count per status: `F.sum(F.when(F.col("status") == "present", 1).otherwise(0))` — this is exactly what `pivot` compiles to, and it gives a fixed set of columns.', 'In this sandbox engine `pivot` with a value list mis-groups rows, so use the conditional form (it is portable to any engine).'],
      schema: { attendance: 'employee_id INTEGER Employee, day DATE Day, status VARCHAR present · absent · leave' },
      solution: code`STATUSES = ["present", "absent", "leave"]

def solve(spark, attendance):
    counts = [F.sum(F.when(F.col("status") == s, 1).otherwise(0)).alias(s) for s in STATUSES]
    return attendance.groupBy("employee_id").agg(*counts)
`,
      explanation: 'A pivot is a group-by with one conditional aggregate per output column. Writing it that way fixes the schema (all three columns even if nobody took leave), fills absent combinations with 0 for free, and runs in one pass — no extra job to discover distinct values.',
      tests: [
        { name: 'Example', tables: { attendance: [[1, '2024-01-01', 'present'], [1, '2024-01-02', 'absent'], [1, '2024-01-03', 'present'], [2, '2024-01-01', 'leave']] } },
        { name: 'Nobody on leave', hidden: true, tables: { attendance: [[3, '2024-01-01', 'present'], [3, '2024-01-02', 'absent']] } },
        { name: 'One status only', hidden: true, tables: { attendance: [[4, '2024-01-01', 'leave'], [4, '2024-01-02', 'leave']] } },
      ],
    }),

    pyspark({
      id: 'spark-event-type-pivot', title: 'Pivot Event Types per User', difficulty: 'Medium',
      topics: ['Pivoting', 'Aggregation'], patterns: ['pivot + derived ratio'], domains: ['Product analytics'], roles: DE_DA,
      summary: 'One row per user with view, click and purchase counts plus a click-through rate.',
      description: md('Return `user_id`, `view`, `click`, `purchase` (counts, 0 if none) and `ctr` = click / view rounded to 3 (null when the user has no views).'),
      hints: ['Build the three counts with conditional sums (the portable pivot), then a null-safe division: `F.when(F.col("view") > 0, F.round(F.col("click") / F.col("view"), 3))`.'],
      schema: { events: 'user_id INTEGER User, event VARCHAR view · click · purchase, ts TIMESTAMP When' },
      solution: code`def solve(spark, events):
    counts = [F.sum(F.when(F.col("event") == e, 1).otherwise(0)).alias(e) for e in ("view", "click", "purchase")]
    wide = events.groupBy("user_id").agg(*counts)
    return wide.withColumn("ctr", F.when(F.col("view") > 0, F.round(F.col("click") / F.col("view"), 3)))
`,
      explanation: 'One column per event type turns ratios into column arithmetic. `when` without `otherwise` yields null — the honest answer for "no views". Unknown event types simply match no column.',
      tests: [
        { name: 'Example', tables: { events: [[1, 'view', '2024-01-01 10:00:00'], [1, 'view', '2024-01-01 10:01:00'], [1, 'click', '2024-01-01 10:02:00'], [2, 'purchase', '2024-01-01 11:00:00']] } },
        { name: 'All clicks', hidden: true, tables: { events: [[3, 'view', '2024-01-01 00:00:00'], [3, 'click', '2024-01-01 00:00:01'], [3, 'click', '2024-01-01 00:00:02']] } },
        { name: 'Unknown event types ignored', hidden: true, tables: { events: [[4, 'scroll', '2024-01-01 00:00:00'], [4, 'view', '2024-01-01 00:00:00']] } },
      ],
    }),

    pyspark({
      id: 'spark-sales-subtotals', title: 'Subtotals and a Grand Total', difficulty: 'Medium',
      topics: ['Aggregation', 'Set Operations'], patterns: ['Grouping sets by union'], domains: ['Retail'], roles: DE_DA,
      summary: 'Build region × category totals, region subtotals and a grand total as labelled rows.',
      description: md('Return `region`, `category`, `revenue` (rounded to 2) at three levels: each (region, category); each region with `category = "ALL"`; and one row with both `"ALL"`. (In full Spark this is `rollup`; build it here from three aggregations.)'),
      hints: ['Aggregate three times with different keys, add `F.lit("ALL")` for the rolled-up columns, and `unionByName` the results.'],
      schema: { sales: 'region VARCHAR Region, category VARCHAR Category, revenue DOUBLE Revenue' },
      solution: code`def solve(spark, sales):
    total = F.round(F.sum("revenue"), 2).alias("revenue")
    detail = sales.groupBy("region", "category").agg(total)
    by_region = sales.groupBy("region").agg(total).withColumn("category", F.lit("ALL"))
    grand = sales.agg(total).withColumn("region", F.lit("ALL")).withColumn("category", F.lit("ALL"))
    return detail.unionByName(by_region).unionByName(grand)
`,
      explanation: 'Subtotal reports are a union of aggregations at different grains — what `rollup` / `GROUPING SETS` generate for you. Labelling the rolled-up level with `"ALL"` (instead of null) keeps it distinguishable from genuinely null keys.',
      tests: [
        { name: 'Example', tables: { sales: [['north', 'toys', 10.0], ['north', 'books', 5.0], ['south', 'toys', 2.5], ['north', 'toys', 1.0]] } },
        { name: 'Single row', hidden: true, tables: { sales: [['east', 'food', 3.0]] } },
        { name: 'Decimals', hidden: true, tables: { sales: [['w', 'a', 0.1], ['w', 'a', 0.2], ['w', 'b', 0.3]] } },
      ],
    }),

    pyspark({
      id: 'spark-collect-sorted-list', title: 'Group Values into an Ordered List', difficulty: 'Hard',
      topics: ['Complex Types (Arrays / Structs)', 'Aggregation'], patterns: ['collect_list in a deterministic order'], domains: ['E-commerce / Sales'], roles: ['Data Engineer'],
      ...tag(sp('Tiger Analytics', 'Group By and Aggregate List')),
      summary: 'List each customer\'s purchased products in purchase order as one string.',
      description: md('Return `customer_id`, `products` (product names joined with `" > "` in `purchased_at` order, ties by product name) and `distinct_products` (count of distinct products).'),
      hints: ['`collect_list` order is not guaranteed after a shuffle. Collect `F.struct("purchased_at", "product")`, `sort_array` it, then take the `product` field.'],
      schema: { purchases: 'customer_id INTEGER Customer, product VARCHAR Product, purchased_at TIMESTAMP When' },
      solution: code`def solve(spark, purchases):
    pairs = F.sort_array(F.collect_list(F.struct("purchased_at", "product")))
    return (purchases.groupBy("customer_id")
            .agg(pairs.alias("pairs"), F.countDistinct("product").alias("distinct_products"))
            .select("customer_id",
                    F.array_join(F.transform("pairs", lambda p: p["product"]), " > ").alias("products"),
                    "distinct_products"))
`,
      explanation: 'Sorting an array of structs orders by the first field, then the next — a reliable way to get a deterministic `collect_list`. `transform` (a higher-order function) then extracts the field without exploding.',
      tests: [
        { name: 'Example', tables: { purchases: [[1, 'tea', '2024-01-02 10:00:00'], [1, 'cup', '2024-01-01 09:00:00'], [1, 'tea', '2024-01-03 10:00:00'], [2, 'pen', '2024-01-05 00:00:00']] } },
        { name: 'Same timestamp ties by name', hidden: true, tables: { purchases: [[3, 'b', '2024-01-01 00:00:00'], [3, 'a', '2024-01-01 00:00:00']] } },
        { name: 'Single purchase', hidden: true, tables: { purchases: [[4, 'x', '2024-06-01 00:00:00']] } },
      ],
    }),

    pyspark({
      id: 'spark-most-common-cart-size', title: 'Most Common Cart Size from Counts', difficulty: 'Easy',
      topics: ['Aggregation', 'Statistics'], patterns: ['Weighted mode'], domains: ['E-commerce / Sales'], roles: DE_DA,
      ...tag(sp('Alibaba', 'Most Common Cart Size')),
      summary: 'Find the mode cart size when the data is already aggregated per region.',
      description: md('Each row says how many orders (`orders`) in a region had a given `cart_size`. Across all regions, return the `cart_size`(s) with the largest total number of orders and that total as `orders`.'),
      hints: ['Sum orders per cart size first (regions overlap), then keep the size(s) equal to the maximum.'],
      schema: { cart_stats: 'region VARCHAR Region, cart_size INTEGER Items per cart, orders INTEGER Number of orders' },
      solution: code`def solve(spark, cart_stats):
    totals = cart_stats.groupBy("cart_size").agg(F.sum("orders").alias("orders"))
    best = totals.agg(F.max("orders").alias("m"))
    return totals.join(best, totals["orders"] == best["m"]).select("cart_size", "orders")
`,
      explanation: 'With pre-aggregated data the mode is the value with the largest **summed weight**, not the most frequent row. Joining to a one-row max keeps all ties.',
      tests: [
        { name: 'Example', tables: { cart_stats: [['in', 1, 100], ['in', 2, 80], ['us', 2, 50], ['us', 3, 10]] } },
        { name: 'Tie', hidden: true, tables: { cart_stats: [['a', 1, 5], ['b', 2, 5]] } },
        { name: 'Single region', hidden: true, tables: { cart_stats: [['x', 4, 1]] } },
      ],
    }),

    pyspark({
      id: 'spark-median-delivery-time', title: 'Median Delivery Time per Courier', difficulty: 'Easy',
      topics: ['Statistics', 'Aggregation', 'Date & Time'], patterns: ['Median + conditional rate'], domains: ['Food delivery'], roles: DE_DA,
      ...tag(sp('Google', 'Median Delivery Time')),
      summary: 'Median minutes from pickup to drop-off and the share delivered within 30 minutes.',
      description: md('Return `courier_id`, `median_minutes` (median of delivery minutes, rounded to 1) and `on_time_rate` (share of deliveries ≤ 30 minutes, rounded to 3).'),
      hints: ['Minutes: `(unix_timestamp(dropoff) - unix_timestamp(pickup)) / 60`.', '`F.median` (Spark 3.4+) or `F.percentile_approx(col, 0.5)`; the rate is `avg` of a 0/1 flag.'],
      schema: { deliveries: 'delivery_id INTEGER Delivery, courier_id INTEGER Courier, pickup TIMESTAMP Picked up, dropoff TIMESTAMP Delivered' },
      solution: code`def solve(spark, deliveries):
    minutes = (F.unix_timestamp("dropoff") - F.unix_timestamp("pickup")) / 60
    df = deliveries.withColumn("minutes", minutes)
    return df.groupBy("courier_id").agg(
        F.round(F.median("minutes"), 1).alias("median_minutes"),
        F.round(F.avg(F.when(F.col("minutes") <= 30, 1).otherwise(0)), 3).alias("on_time_rate"),
    )
`,
      explanation: 'The median resists a few very late deliveries better than the mean. Averaging a 0/1 indicator is the idiomatic way to compute a rate in one aggregation.',
      tests: [
        { name: 'Example', tables: { deliveries: [[1, 7, '2024-01-01 12:00:00', '2024-01-01 12:20:00'], [2, 7, '2024-01-01 13:00:00', '2024-01-01 13:40:00'], [3, 7, '2024-01-01 14:00:00', '2024-01-01 14:25:00'], [4, 8, '2024-01-01 12:00:00', '2024-01-01 12:30:00']] } },
        { name: 'Even count median', hidden: true, tables: { deliveries: [[1, 9, '2024-01-01 00:00:00', '2024-01-01 00:10:00'], [2, 9, '2024-01-01 00:00:00', '2024-01-01 00:21:00']] } },
        { name: 'All late', hidden: true, tables: { deliveries: [[1, 5, '2024-01-01 00:00:00', '2024-01-01 01:00:00']] } },
      ],
    }),

    pyspark({
      id: 'spark-duplicate-listings', title: 'Agents Who Listed a Property Twice', difficulty: 'Easy',
      topics: ['Aggregation', 'Deduplication'], patterns: ['Group + having count > 1'], domains: ['Real estate'], roles: DE_DA,
      ...tag(sp('LinkedIn', 'Duplicate Rental Listings')),
      summary: 'Find agents with the same property listed more than once.',
      description: md('A listing is a duplicate when the same agent lists the same `address` (case- and space-insensitive) more than once. Return `agent_id` and `duplicated_addresses` (how many addresses they listed more than once).'),
      hints: ['Normalise the address, count per (agent, address), keep counts > 1, then count per agent.'],
      schema: { listings: 'listing_id INTEGER Listing, agent_id INTEGER Agent, address VARCHAR Address' },
      solution: code`def solve(spark, listings):
    addr = F.lower(F.regexp_replace(F.trim("address"), r"\s+", " "))
    dupes = (listings.groupBy("agent_id", addr.alias("addr")).count()
             .filter(F.col("count") > 1))
    return dupes.groupBy("agent_id").agg(F.count("*").alias("duplicated_addresses"))
`,
      explanation: 'Duplicate detection is group-and-count; normalising first is what makes it catch real duplicates ("12  Main St" vs "12 main st").',
      tests: [
        { name: 'Example', tables: { listings: [[1, 10, '12 Main St'], [2, 10, '12  main st'], [3, 10, '9 Oak Ave'], [4, 11, '1 Pine Rd']] } },
        { name: 'No duplicates', hidden: true, tables: { listings: [[1, 1, 'a'], [2, 1, 'b']] } },
        { name: 'Several duplicated addresses', hidden: true, tables: { listings: [[1, 5, 'x'], [2, 5, 'X'], [3, 5, 'y'], [4, 5, 'y '], [5, 5, 'y']] } },
      ],
    }),

    pyspark({
      id: 'spark-device-split', title: 'Viewing Sessions by Device Bucket', difficulty: 'Easy',
      topics: ['Aggregation', 'Strings & Regex'], patterns: ['Conditional aggregation'], domains: ['Streaming / Media'], roles: DE_DA,
      ...tag(sp('New York Times', 'Streaming Device Split')),
      summary: 'Bucket device strings into mobile / desktop / tv and compute the mobile share of minutes.',
      description: md('Device names are free text. `mobile` if it contains "phone" or "android" or "ios", `tv` if it contains "tv", else `desktop` (case-insensitive). Return one row: `mobile_sessions`, `desktop_sessions`, `tv_sessions`, `mobile_minutes_share` (mobile minutes / all minutes, rounded to 3).'),
      hints: ['Bucket with `when` + `rlike("(?i)phone|android|ios")`, then one `agg` with conditional sums.'],
      schema: { sessions: 'session_id INTEGER Session, device VARCHAR Device, minutes DOUBLE Minutes watched' },
      solution: code`def solve(spark, sessions):
    bucket = (F.when(F.col("device").rlike("(?i)phone|android|ios"), "mobile")
               .when(F.col("device").rlike("(?i)tv"), "tv")
               .otherwise("desktop"))
    df = sessions.withColumn("bucket", bucket)
    is_ = lambda b: F.col("bucket") == b
    return df.agg(
        F.sum(F.when(is_("mobile"), 1).otherwise(0)).alias("mobile_sessions"),
        F.sum(F.when(is_("desktop"), 1).otherwise(0)).alias("desktop_sessions"),
        F.sum(F.when(is_("tv"), 1).otherwise(0)).alias("tv_sessions"),
        F.round(F.sum(F.when(is_("mobile"), F.col("minutes")).otherwise(0)) / F.sum("minutes"), 3).alias("mobile_minutes_share"),
    )
`,
      explanation: 'A global `agg` (no groupBy) returns exactly one row. `(?i)` makes the regex case-insensitive. Checking mobile before tv matters for strings like "Android TV" — rule order is a business decision.',
      tests: [
        { name: 'Example', tables: { sessions: [[1, 'iPhone 15 (iOS)', 30.0], [2, 'Chrome on Mac', 60.0], [3, 'Samsung Smart TV', 90.0], [4, 'android tablet', 20.0]] } },
        { name: 'Only desktop', hidden: true, tables: { sessions: [[1, 'Firefox', 10.0]] } },
        { name: 'Android TV counts as mobile', hidden: true, tables: { sessions: [[1, 'Android TV', 40.0], [2, 'LG TV', 10.0]] } },
      ],
    }),
  ],
};
