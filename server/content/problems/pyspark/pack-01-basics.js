// PySpark pack 1 — DataFrame basics: select, rename, cast, derived columns,
// when/otherwise, filters (isin, like, between, null checks), fillna / dropna,
// unionByName with evolving schemas, and dynamic column renames.
import { pyspark, md, code } from './define.js';
import { sp } from '../sql/define.js';
import { tag } from '../python/sources.js';

const DE = ['Data Engineer'];
const DE_DA = ['Data Engineer', 'Data Analyst'];

export default {
  problems: [
    pyspark({
      id: 'spark-select-cast-clean', title: 'Load, Cast and Tidy a Raw Extract', difficulty: 'Easy',
      topics: ['DataFrame Basics', 'Column Expressions'], patterns: ['Cast string columns'], domains: ['E-commerce / Sales'], roles: DE,
      summary: 'Cast text columns to proper types, normalise names and drop rows whose price can\'t be parsed.',
      description: md(
        'A raw CSV extract arrived with every column typed as text. Return `product_id` (int), `name` (trimmed, upper-case), `price` (double) and `in_stock` (boolean: `stock` as an int is > 0; null if `stock` isn\'t an integer).',
        '',
        'Drop rows whose `price` isn\'t a number. Row order doesn\'t matter.',
      ),
      hints: ['Spark (non-ANSI) turns a bad cast into null, but strict engines raise instead. Guard the cast so it works everywhere: `F.when(F.col("price").rlike(NUMBER), F.col("price").cast("double"))`.', '`F.upper(F.trim("name"))`.'],
      schema: { raw_products: 'product_id VARCHAR Id as text, name VARCHAR Name, price VARCHAR Price as text, stock VARCHAR Units as text' },
      solution: code`NUMBER = r"^\s*-?\d+(\.\d+)?\s*$"
INTEGER = r"^\s*-?\d+\s*$"

def solve(spark, raw_products):
    price = F.when(F.col("price").rlike(NUMBER), F.trim("price").cast("double"))
    stock = F.when(F.col("stock").rlike(INTEGER), F.trim("stock").cast("int"))
    df = raw_products.select(
        F.col("product_id").cast("int").alias("product_id"),
        F.upper(F.trim("name")).alias("name"),
        price.alias("price"),
        (stock > 0).alias("in_stock"),
    )
    return df.filter(F.col("price").isNotNull())
`,
      explanation: 'Casting is how text-typed landing data becomes typed. Whether a bad value becomes null or fails the job depends on the engine (`spark.sql.ansi.enabled` is on by default in Spark 4), so validating with `rlike` before casting makes the rule explicit and portable. Unparseable stock gives a null `in_stock`.',
      tests: [
        { name: 'Example', tables: { raw_products: [['1', ' tea ', '2.50', '10'], ['2', 'cake', 'n/a', '3'], ['3', 'Bun', '1', '0']] } },
        { name: 'Negative stock is not in stock', hidden: true, tables: { raw_products: [['9', 'x', '0', '-1']] } },
        { name: 'Unparseable stock', hidden: true, tables: { raw_products: [['4', 'jam', '3.0', 'lots']] } },
      ],
    }),

    pyspark({
      id: 'spark-handle-nulls', title: 'Fill and Drop Nulls by Column', difficulty: 'Easy',
      topics: ['NULL Handling', 'DataFrame Basics'], patterns: ['fillna with a per-column dict'], domains: ['Marketing / CRM'], roles: DE_DA,
      summary: 'Apply a different missing-value rule to each column.',
      description: md('Clean `customers`: drop rows with no `email`; fill a missing `country` with `"unknown"`, a missing `age` with `-1`, and a missing `newsletter` with `false`. Return all columns.'),
      hints: ['`dropna(subset=["email"])`, then `fillna({...})` with a dict of column → default.'],
      schema: { customers: 'id INTEGER Id, email VARCHAR Email, country VARCHAR Country, age INTEGER Age, newsletter BOOLEAN Opted in' },
      solution: code`def solve(spark, customers):
    return (customers
            .dropna(subset=["email"])
            .fillna({"country": "unknown", "age": -1, "newsletter": False}))
`,
      explanation: 'A dict passed to `fillna` applies per-column defaults in one step, and each value only fills columns of a compatible type. `dropna(subset=…)` limits the null check to the columns that matter.',
      tests: [
        { name: 'Example', tables: { customers: [[1, 'a@x.io', null, 30, null], [2, null, 'IN', 40, true], [3, 'c@x.io', 'US', null, false]] } },
        { name: 'Nothing to fix', hidden: true, tables: { customers: [[5, 'e@x', 'DE', 22, true]] } },
        { name: 'Everything missing but email', hidden: true, tables: { customers: [[6, 'f@x', null, null, null]] } },
      ],
    }),

    pyspark({
      id: 'spark-discounted-prices', title: 'Add a Discounted Price Column', difficulty: 'Easy',
      topics: ['Column Expressions'], patterns: ['Arithmetic on columns'], domains: ['Retail'], roles: DE_DA,
      summary: 'Compute sale prices from a percentage discount, rounded to cents.',
      description: md('Return `sku`, `price`, `discount_pct` (null means no discount) and `sale_price = round(price * (1 - discount_pct / 100), 2)`.'),
      hints: ['`F.coalesce("discount_pct", F.lit(0))` treats a null discount as 0 — otherwise the whole expression becomes null.'],
      schema: { products: 'sku VARCHAR SKU, price DOUBLE List price, discount_pct DOUBLE Percent off' },
      solution: code`def solve(spark, products):
    pct = F.coalesce(F.col("discount_pct"), F.lit(0.0))
    return products.withColumn("sale_price", F.round(F.col("price") * (1 - pct / 100), 2))
`,
      explanation: 'Any arithmetic with a null yields null, so a missing discount would wipe out the price. `coalesce` supplies the default only where it is needed.',
      tests: [
        { name: 'Example', tables: { products: [['A', 100.0, 15.0], ['B', 19.99, null], ['C', 5.0, 100.0]] } },
        { name: 'Fractional discount', hidden: true, tables: { products: [['D', 9.99, 12.5]] } },
        { name: 'Zero price', hidden: true, tables: { products: [['E', 0.0, 50.0]] } },
      ],
    }),

    pyspark({
      id: 'spark-price-categories', title: 'Bucket Products by Price', difficulty: 'Easy',
      topics: ['Column Expressions'], patterns: ['when / otherwise chain'], domains: ['Retail'], roles: DE_DA,
      summary: 'Label each product budget, standard or premium with a chained when.',
      description: md('Add `tier`: `"budget"` under 20, `"standard"` from 20 up to (not including) 100, `"premium"` at 100 or more, and `"unpriced"` when `price` is null. Return `sku`, `price`, `tier`.'),
      hints: ['`F.when(...).when(...).otherwise(...)` is evaluated top to bottom; test for null first.'],
      schema: { products: 'sku VARCHAR SKU, price DOUBLE Price' },
      solution: code`def solve(spark, products):
    tier = (F.when(F.col("price").isNull(), "unpriced")
             .when(F.col("price") < 20, "budget")
             .when(F.col("price") < 100, "standard")
             .otherwise("premium"))
    return products.select("sku", "price", tier.alias("tier"))
`,
      explanation: 'The first matching branch wins, so ordering the conditions from most specific to least avoids overlapping ranges. A null price fails every comparison, which is why it needs its own branch rather than falling into `otherwise`.',
      tests: [
        { name: 'Example', tables: { products: [['a', 5.0], ['b', 20.0], ['c', 99.99], ['d', 100.0], ['e', null]] } },
        { name: 'All premium', hidden: true, tables: { products: [['x', 500.0], ['y', 1000.0]] } },
        { name: 'Negative price is budget', hidden: true, tables: { products: [['z', -1.0]] } },
      ],
    }),

    pyspark({
      id: 'spark-marks-to-grade', title: 'Marks to Letter Grades', difficulty: 'Easy',
      topics: ['Column Expressions', 'Aggregation'], patterns: ['when / otherwise chain', 'Count per derived label'], domains: ['Education'], roles: DE_DA,
      ...tag(sp('Amazon', 'Student Marks to Grade')),
      summary: 'Assign grades from marks, then count students per grade.',
      description: md('Grade each student: A ≥ 90, B ≥ 75, C ≥ 60, D ≥ 40, otherwise F. Return `grade` and `students` (count) for every grade that occurs.'),
      hints: ['Derive the grade with `when`, then `groupBy("grade").count()` (rename the column).'],
      schema: { marks: 'student VARCHAR Student, marks INTEGER Marks out of 100' },
      solution: code`def solve(spark, marks):
    grade = (F.when(F.col("marks") >= 90, "A").when(F.col("marks") >= 75, "B")
              .when(F.col("marks") >= 60, "C").when(F.col("marks") >= 40, "D").otherwise("F"))
    return (marks.withColumn("grade", grade)
            .groupBy("grade").agg(F.count("*").alias("students")))
`,
      explanation: 'Deriving a column and grouping by it is the DataFrame version of `GROUP BY CASE … END`. `F.count("*")` counts rows; `F.count("col")` would skip nulls.',
      tests: [
        { name: 'Example', tables: { marks: [['a', 95], ['b', 90], ['c', 76], ['d', 59], ['e', 12]] } },
        { name: 'Boundaries', hidden: true, tables: { marks: [['p', 75], ['q', 60], ['r', 40], ['s', 39]] } },
        { name: 'Everyone fails', hidden: true, tables: { marks: [['x', 0], ['y', 1]] } },
      ],
    }),

    pyspark({
      id: 'spark-filter-catalog', title: 'Filter with isin, like and between', difficulty: 'Easy',
      topics: ['Filtering'], patterns: ['Compound filter'], domains: ['Retail'], roles: DE_DA,
      summary: 'Find active electronics in a price band whose name looks like a phone or tablet.',
      description: md('Keep products where `active` is true, `category` is one of `electronics` or `mobile`, `price` is between 100 and 500 inclusive, and `name` (case-insensitive) starts with `phone` or `tab`. Return `sku`, `name`, `price`.'),
      hints: ['Combine conditions with `&` and `|`, wrapping each in parentheses.', '`F.lower("name").like("phone%")`; `.isin(...)`; `.between(100, 500)`.'],
      schema: { products: 'sku VARCHAR SKU, name VARCHAR Name, category VARCHAR Category, price DOUBLE Price, active BOOLEAN Listed' },
      solution: code`def solve(spark, products):
    name = F.lower(F.col("name"))
    return (products
            .filter(F.col("active")
                    & F.col("category").isin("electronics", "mobile")
                    & F.col("price").between(100, 500)
                    & (name.like("phone%") | name.like("tab%")))
            .select("sku", "name", "price"))
`,
      explanation: 'Python\'s `and`/`or` don\'t work on Columns — use `&`, `|` and `~`, and parenthesise every comparison because `&` binds tighter than `==`. `between` is inclusive on both ends.',
      tests: [
        { name: 'Example', tables: { products: [['1', 'Phone X', 'mobile', 499.0, true], ['2', 'Tablet 9', 'electronics', 100.0, true], ['3', 'Phone Mini', 'mobile', 50.0, true], ['4', 'Laptop', 'electronics', 300.0, true], ['5', 'tab pro', 'electronics', 250.0, false]] } },
        { name: 'Other categories excluded', hidden: true, tables: { products: [['6', 'phone case', 'accessories', 120.0, true]] } },
        { name: 'Upper bound inclusive', hidden: true, tables: { products: [['7', 'PHONE Z', 'mobile', 500.0, true]] } },
      ],
    }),

    pyspark({
      id: 'spark-order-date-parts', title: 'Break Order Dates into Parts', difficulty: 'Easy',
      topics: ['Date & Time', 'Column Expressions'], patterns: ['Date part extraction'], domains: ['E-commerce / Sales'], roles: DE_DA,
      summary: 'Add year, month, day, weekday and quarter columns from an order date.',
      description: md('Return `order_id`, `order_date` and `year`, `month`, `day`, `quarter`, and `is_weekend` (Saturday or Sunday).'),
      hints: ['`F.year`, `F.month`, `F.dayofmonth`, `F.quarter`; `F.dayofweek` is 1 for Sunday and 7 for Saturday.'],
      schema: { orders: 'order_id INTEGER Order, order_date DATE Date' },
      solution: code`def solve(spark, orders):
    return orders.select(
        "order_id", "order_date",
        F.year("order_date").alias("year"),
        F.month("order_date").alias("month"),
        F.dayofmonth("order_date").alias("day"),
        F.quarter("order_date").alias("quarter"),
        F.dayofweek("order_date").isin(1, 7).alias("is_weekend"),
    )
`,
      explanation: 'Spark\'s `dayofweek` counts from Sunday = 1 (unlike Python\'s Monday = 0), so weekends are 1 and 7. Date-part columns are the usual first step before monthly or weekday aggregates.',
      tests: [
        { name: 'Example', tables: { orders: [[1, '2024-03-30'], [2, '2024-04-01'], [3, '2024-12-31']] } },
        { name: 'Sunday', hidden: true, tables: { orders: [[4, '2024-06-02']] } },
        { name: 'Leap day', hidden: true, tables: { orders: [[5, '2024-02-29']] } },
      ],
    }),

    pyspark({
      id: 'spark-flight-delay-buckets', title: 'Categorise Flight Delays per Airline', difficulty: 'Medium',
      topics: ['Date & Time', 'Column Expressions', 'Aggregation'], patterns: ['Timestamp difference', 'Conditional counts'], domains: ['Travel'], roles: DE_DA,
      summary: 'Compute delay minutes from scheduled vs actual departure, bucket them, and count per airline.',
      description: md('Delay = actual − scheduled departure in minutes (negative = early). Buckets: `on_time` (≤ 15), `delayed` (16–60), `severe` (> 60); a null actual departure is `cancelled`. Return `airline`, `on_time`, `delayed`, `severe`, `cancelled` counts.'),
      hints: ['`(F.unix_timestamp("actual") - F.unix_timestamp("scheduled")) / 60`.', 'Conditional counts: `F.sum(F.when(bucket == "x", 1).otherwise(0))`.'],
      schema: { flights: 'flight VARCHAR Flight, airline VARCHAR Airline, scheduled TIMESTAMP Scheduled departure, actual TIMESTAMP Actual departure' },
      solution: code`def solve(spark, flights):
    minutes = (F.unix_timestamp("actual") - F.unix_timestamp("scheduled")) / 60
    bucket = (F.when(F.col("actual").isNull(), "cancelled")
               .when(minutes <= 15, "on_time")
               .when(minutes <= 60, "delayed")
               .otherwise("severe"))
    df = flights.withColumn("bucket", bucket)
    counts = [F.sum(F.when(F.col("bucket") == b, 1).otherwise(0)).alias(b)
              for b in ("on_time", "delayed", "severe", "cancelled")]
    return df.groupBy("airline").agg(*counts)
`,
      explanation: 'Converting both timestamps to epoch seconds makes the difference a plain number. One `groupBy` with several conditional sums produces a fixed set of columns even for buckets an airline never hit — unlike `pivot`, which only creates columns for values present.',
      tests: [
        { name: 'Example', tables: { flights: [['F1', 'AI', '2024-05-01 10:00:00', '2024-05-01 10:10:00'], ['F2', 'AI', '2024-05-01 11:00:00', '2024-05-01 11:45:00'], ['F3', '6E', '2024-05-01 09:00:00', '2024-05-01 10:30:00'], ['F4', '6E', '2024-05-01 12:00:00', null]] } },
        { name: 'Early departures are on time', hidden: true, tables: { flights: [['F5', 'UK', '2024-05-01 10:00:00', '2024-05-01 09:50:00']] } },
        { name: 'Exactly 15 and 60 minutes', hidden: true, tables: { flights: [['F6', 'QP', '2024-05-01 10:00:00', '2024-05-01 10:15:00'], ['F7', 'QP', '2024-05-01 10:00:00', '2024-05-01 11:00:00']] } },
      ],
    }),

    pyspark({
      id: 'spark-union-by-name', title: 'Combine Feeds with Different Columns', difficulty: 'Easy',
      topics: ['Schema Handling', 'Set Operations'], patterns: ['unionByName with missing columns'], domains: ['Payments'], roles: DE,
      summary: 'Stack two transaction feeds whose columns differ in order and presence.',
      description: md('`web` has `txn_id, amount, user_id`; `pos` has `user_id, txn_id, amount, store_id`. Return one DataFrame with `txn_id, user_id, amount, store_id, channel` where `channel` is `"web"` or `"pos"` and web rows have a null `store_id`.'),
      hints: ['`union` matches columns by **position** — use `unionByName(..., allowMissingColumns=True)`.'],
      schema: { web: 'txn_id INTEGER Id, amount DOUBLE Amount, user_id INTEGER User', pos: 'user_id INTEGER User, txn_id INTEGER Id, amount DOUBLE Amount, store_id INTEGER Store' },
      solution: code`def solve(spark, web, pos):
    a = web.withColumn("channel", F.lit("web"))
    b = pos.withColumn("channel", F.lit("pos"))
    return (a.unionByName(b, allowMissingColumns=True)
            .select("txn_id", "user_id", "amount", "store_id", "channel"))
`,
      explanation: 'Positional `union` silently puts user ids into the amount column when column orders differ. `unionByName` aligns by name, and `allowMissingColumns=True` fills columns a side lacks with nulls — the normal tool for schema evolution between sources.',
      tests: [
        { name: 'Example', tables: { web: [[1, 9.5, 100]], pos: [[200, 2, 20.0, 7]] } },
        { name: 'Empty web feed', hidden: true, tables: { web: [], pos: [[1, 5, 1.0, 3]] } },
        { name: 'Several rows each', hidden: true, tables: { web: [[1, 1.0, 1], [2, 2.0, 2]], pos: [[3, 3, 3.0, 9], [4, 4, 4.0, 9]] } },
      ],
    }),

    pyspark({
      id: 'spark-dynamic-rename-cast', title: 'Rename Legacy Columns from a Mapping', difficulty: 'Medium',
      topics: ['Schema Handling', 'Column Expressions'], patterns: ['Programmatic select'], domains: ['Finance'], roles: DE,
      summary: 'Rename and cast columns driven by a mapping, then derive USD amounts.',
      description: md(
        'A legacy table uses names like `cust_no`, `ord_amt_local`, `fx_rate`, `ord_dt` (all text). Using a mapping (old → new name, type) — `cust_no → customer_id int`, `ord_amt_local → amount_local double`, `fx_rate → fx_rate double`, `ord_dt → order_date date` — build the columns **in a loop** (not one hand-written line per column), then add `amount_usd = round(amount_local * fx_rate, 2)`.',
      ),
      hints: ['Build a list of `F.col(old).cast(t).alias(new)` from the mapping and pass it to `select(*cols)`.'],
      schema: { legacy_orders: 'cust_no VARCHAR Customer, ord_amt_local VARCHAR Amount in local currency, fx_rate VARCHAR Rate to USD, ord_dt VARCHAR Order date' },
      solution: code`MAPPING = [
    ("cust_no", "customer_id", "int"),
    ("ord_amt_local", "amount_local", "double"),
    ("fx_rate", "fx_rate", "double"),
    ("ord_dt", "order_date", "date"),
]

def solve(spark, legacy_orders):
    df = legacy_orders.select(*[F.col(old).cast(t).alias(new) for old, new, t in MAPPING])
    return df.withColumn("amount_usd", F.round(F.col("amount_local") * F.col("fx_rate"), 2))
`,
      explanation: 'Driving the select from data keeps renames in one reviewable place and scales to hundreds of columns. One `select` with all expressions is also cheaper to plan than a long chain of `withColumnRenamed`/`withColumn` calls.',
      tests: [
        { name: 'Example', tables: { legacy_orders: [['7', '1000', '0.012', '2024-01-05'], ['8', '50.5', '1.1', '2024-02-10']] } },
        { name: 'Large amounts', hidden: true, tables: { legacy_orders: [['9', '123456.5', '1.0', '2024-03-01']] } },
        { name: 'Rounding', hidden: true, tables: { legacy_orders: [['1', '3.333', '3', '2024-01-01']] } },
      ],
    }),

    pyspark({
      id: 'spark-order-line-metrics', title: 'Several Derived Columns at Once', difficulty: 'Easy',
      topics: ['Column Expressions', 'DataFrame Basics'], patterns: ['withColumns'], domains: ['E-commerce / Sales'], roles: DE_DA,
      summary: 'Derive gross, tax and net columns for order lines with one withColumns call.',
      description: md('Return the input columns plus `gross = qty * unit_price`, `tax = round(gross * tax_rate, 2)` and `net = round(gross + tax, 2)`, and drop lines with `qty <= 0`.'),
      hints: ['`withColumns({"gross": ..., ...})` — but a column defined in the same call can\'t reference another new one; derive `gross` first.'],
      schema: { lines: 'order_id INTEGER Order, sku VARCHAR SKU, qty INTEGER Quantity, unit_price DOUBLE Unit price, tax_rate DOUBLE Tax rate' },
      solution: code`def solve(spark, lines):
    df = lines.filter(F.col("qty") > 0).withColumn("gross", F.col("qty") * F.col("unit_price"))
    return df.withColumns({
        "tax": F.round(F.col("gross") * F.col("tax_rate"), 2),
        "net": F.round(F.col("gross") * (1 + F.col("tax_rate")), 2),
    })
`,
      explanation: 'All expressions in one `withColumns` are evaluated against the **input** DataFrame, so they can\'t see each other. Deriving shared building blocks first (or repeating the expression) keeps it correct; each chained `withColumn` adds a projection to the plan.',
      tests: [
        { name: 'Example', tables: { lines: [[1, 'A', 2, 10.0, 0.18], [1, 'B', 0, 5.0, 0.18], [2, 'C', 3, 1.5, 0.05]] } },
        { name: 'No tax', hidden: true, tables: { lines: [[3, 'D', 1, 9.99, 0.0]] } },
        { name: 'Negative quantity dropped', hidden: true, tables: { lines: [[4, 'E', -1, 1.0, 0.1], [4, 'F', 1, 1.0, 0.1]] } },
      ],
    }),

    pyspark({
      id: 'spark-positive-balances', title: 'Customers with a Positive Balance', difficulty: 'Medium',
      topics: ['Joins', 'Filtering', 'Column Expressions'], patterns: ['Join then filter'], domains: ['Banking'], roles: DE_DA,
      ...tag(sp('Amazon', 'Positive Balance Customer Details')),
      summary: 'Join customers to accounts and report strictly positive balances, rounded to cents.',
      description: md('Return `customer_id`, `name` and `balance` (sum of the customer\'s account balances, rounded to 2) for customers whose total is **strictly** positive. Customers without accounts are excluded.'),
      hints: ['Aggregate accounts per customer first, then join to customers — joining first would duplicate customer columns per account.'],
      schema: { customers: 'customer_id INTEGER Customer, name VARCHAR Name', accounts: 'account_id INTEGER Account, customer_id INTEGER Owner, balance DOUBLE Balance' },
      solution: code`def solve(spark, customers, accounts):
    totals = accounts.groupBy("customer_id").agg(F.round(F.sum("balance"), 2).alias("balance"))
    return (customers.join(totals, "customer_id")
            .filter(F.col("balance") > 0)
            .select("customer_id", "name", "balance"))
`,
      explanation: 'Aggregating before joining keeps the join one-to-one and the data small. Joining on a column name (string) also avoids a duplicated `customer_id` column in the result.',
      tests: [
        { name: 'Example', tables: { customers: [[1, 'Ana'], [2, 'Raj'], [3, 'Li']], accounts: [[10, 1, 50.0], [11, 1, -20.125], [12, 2, -5.0], [13, 2, 5.0]] } },
        { name: 'No accounts', hidden: true, tables: { customers: [[1, 'Ana']], accounts: [] } },
        { name: 'Tiny positive', hidden: true, tables: { customers: [[4, 'Zed']], accounts: [[1, 4, 0.01]] } },
      ],
    }),
  ],
};
