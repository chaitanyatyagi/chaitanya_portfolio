// PySpark pack 5 — deduplication, NULL handling and data quality: latest
// record per key, dropDuplicates, forward fill without last(ignorenulls),
// null profiles, IQR outliers, survivorship, rule-based checks, schema
// validation, value mapping and surrogate keys.
import { pyspark, md, code } from './define.js';
import { sp } from '../sql/define.js';
import { tag } from '../python/sources.js';

const DE = ['Data Engineer'];
const DE_DA = ['Data Engineer', 'Data Analyst'];

export default {
  problems: [
    pyspark({
      id: 'spark-dedupe-latest', title: 'Keep the Latest Version of Each Record', difficulty: 'Medium',
      topics: ['Deduplication', 'Window Functions'], patterns: ['Latest record per key'], domains: ['Event pipelines'], roles: DE,
      ...tag(sp('Amazon', 'Remove Duplicates From Dataset')),
      summary: 'A feed redelivers rows; keep one row per order — the most recently updated, ties by highest ingest id.',
      description: md('Return the latest row per `order_id` by `updated_at`, breaking ties by the larger `ingest_id`. Keep all columns.'),
      hints: ['`row_number()` over `partitionBy("order_id").orderBy(F.desc("updated_at"), F.desc("ingest_id"))`, keep `== 1`.'],
      schema: { orders_raw: 'ingest_id INTEGER Load sequence, order_id INTEGER Order, status VARCHAR Status, updated_at TIMESTAMP Updated' },
      solution: code`def solve(spark, orders_raw):
    w = Window.partitionBy("order_id").orderBy(F.desc("updated_at"), F.desc("ingest_id"))
    return orders_raw.withColumn("rn", F.row_number().over(w)).filter("rn = 1").drop("rn")
`,
      explanation: '`dropDuplicates(["order_id"])` keeps an **arbitrary** row per key; ranking with an explicit order and tie-break makes the choice deterministic and reproducible across reruns.',
      tests: [
        { name: 'Example', tables: { orders_raw: [[1, 10, 'new', '2024-01-01 10:00:00'], [2, 10, 'paid', '2024-01-01 11:00:00'], [3, 11, 'new', '2024-01-01 09:00:00'], [4, 10, 'paid', '2024-01-01 11:00:00']] } },
        { name: 'Older redelivery arrives later', hidden: true, tables: { orders_raw: [[1, 5, 'shipped', '2024-02-02 00:00:00'], [2, 5, 'paid', '2024-02-01 00:00:00']] } },
        { name: 'No duplicates', hidden: true, tables: { orders_raw: [[1, 1, 'a', '2024-01-01 00:00:00'], [2, 2, 'b', '2024-01-01 00:00:00']] } },
      ],
    }),

    pyspark({
      id: 'spark-drop-duplicates-subset', title: 'Exact vs Key-Based Duplicates', difficulty: 'Easy',
      topics: ['Deduplication', 'Aggregation'], patterns: ['distinct vs dropDuplicates(subset)'], domains: ['Marketing / CRM'], roles: DE_DA,
      summary: 'Report how many rows are exact duplicates and how many share an email.',
      description: md('Return one row with `rows`, `distinct_rows` (whole-row distinct count) and `distinct_emails` (distinct lowercased, trimmed emails).'),
      hints: ['`df.distinct().count()` vs grouping on a normalised email — or one `agg` with `countDistinct`.'],
      schema: { signups: 'name VARCHAR Name, email VARCHAR Email, source VARCHAR Source' },
      solution: code`def solve(spark, signups):
    email = F.lower(F.trim("email"))
    return signups.agg(
        F.count("*").alias("rows"),
        F.countDistinct("name", "email", "source").alias("distinct_rows"),
        F.countDistinct(email).alias("distinct_emails"),
    )
`,
      explanation: 'Whole-row duplicates and business-key duplicates are different problems. `countDistinct` over several columns counts distinct combinations — but skips rows where any of them is null, so mind nullable columns.',
      tests: [
        { name: 'Example', tables: { signups: [['Ana', 'ana@x.io', 'web'], ['Ana', 'ana@x.io', 'web'], ['Ana', ' ANA@x.io', 'app'], ['Raj', 'raj@x.io', 'web']] } },
        { name: 'All unique', hidden: true, tables: { signups: [['a', 'a@x', 'w'], ['b', 'b@x', 'w']] } },
        { name: 'One row', hidden: true, tables: { signups: [['z', 'z@x', 'app']] } },
      ],
    }),

    pyspark({
      id: 'spark-forward-fill', title: 'Forward-Fill Missing Sensor Readings', difficulty: 'Medium',
      topics: ['NULL Handling', 'Window Functions'], patterns: ['Forward fill via running group id'], domains: ['IoT / Telemetry'], roles: DE,
      summary: 'Replace null readings with the last known value per device, without last(ignorenulls).',
      description: md(
        'Per `device_id` in `ts` order, return `device_id`, `ts`, `reading` (original) and `filled` — the reading, or the most recent earlier non-null reading. Leading nulls stay null.',
        '',
        'In Spark you could write `F.last("reading", ignorenulls=True)` over a running frame; this sandbox engine doesn\'t support that, so use the portable "group id" technique.',
      ),
      hints: ['Running count of non-null readings: `F.count("reading").over(running)` — it only increases on non-null rows, so each non-null starts a new group.', 'Within (device, group), the filled value is `F.max("reading")` over the group.'],
      schema: { readings: 'device_id INTEGER Device, ts TIMESTAMP When, reading DOUBLE Value' },
      solution: code`def solve(spark, readings):
    running = Window.partitionBy("device_id").orderBy("ts").rowsBetween(Window.unboundedPreceding, Window.currentRow)
    grouped = readings.withColumn("grp", F.count("reading").over(running))
    fill = F.max("reading").over(Window.partitionBy("device_id", "grp"))
    return grouped.withColumn("filled", fill).select("device_id", "ts", "reading", "filled")
`,
      explanation: '`count(col)` ignores nulls, so the running count stays flat across a run of nulls and they share the group of the last non-null value; that group contains exactly one non-null reading, so `max` returns it. Leading nulls are in group 0, which has no value.',
      tests: [
        { name: 'Example', tables: { readings: [[1, '2024-01-01 00:00:00', 20.0], [1, '2024-01-01 00:01:00', null], [1, '2024-01-01 00:02:00', null], [1, '2024-01-01 00:03:00', 22.5], [1, '2024-01-01 00:04:00', null], [2, '2024-01-01 00:00:00', null], [2, '2024-01-01 00:01:00', 5.0]] } },
        { name: 'No nulls', hidden: true, tables: { readings: [[3, '2024-01-01 00:00:00', 1.0], [3, '2024-01-01 00:01:00', 2.0]] } },
        { name: 'All nulls', hidden: true, tables: { readings: [[4, '2024-01-01 00:00:00', null], [4, '2024-01-01 00:01:00', null]] } },
      ],
    }),

    pyspark({
      id: 'spark-null-profile', title: 'Null Profile of Every Column', difficulty: 'Medium',
      topics: ['Data Quality', 'Schema Handling'], patterns: ['Programmatic aggregation over df.columns'], domains: ['Data quality'], roles: DE,
      summary: 'Count nulls and null percentage for every column, in long format.',
      description: md('Return one row per column of `customers`: `column`, `nulls`, `null_pct` (rounded to 1). Build the aggregation from `df.columns` so it works for any table.'),
      hints: ['`agg(*[F.sum(F.col(c).isNull().cast("int")).alias(c) for c in df.columns])` gives one wide row; turn it into rows with `unpivot` or by building a small DataFrame from the collected values.'],
      schema: { customers: 'id INTEGER Id, email VARCHAR Email, phone VARCHAR Phone, city VARCHAR City' },
      solution: code`def solve(spark, customers):
    cols = customers.columns
    wide = customers.agg(F.count("*").alias("__rows"),
                         *[F.sum(F.col(c).isNull().cast("int")).alias(c) for c in cols]).collect()[0]
    total = wide["__rows"]
    rows = [(c, int(wide[c] or 0), round(100.0 * (wide[c] or 0) / total, 1) if total else 0.0) for c in cols]
    return spark.createDataFrame(rows, "column string, nulls int, null_pct double")
`,
      explanation: 'Iterating over `df.columns` makes quality checks generic. The aggregate is tiny, so collecting it to the driver and reshaping in Python is fine — the expensive part (scanning the data) still runs in one Spark job.',
      tests: [
        { name: 'Example', tables: { customers: [[1, 'a@x', null, 'Pune'], [2, null, null, 'Goa'], [3, 'c@x', '555', null], [4, 'd@x', null, 'Agra']] } },
        { name: 'No nulls', hidden: true, tables: { customers: [[1, 'a', 'b', 'c']] } },
        { name: 'All nulls in one column', hidden: true, tables: { customers: [[1, null, '1', 'x'], [2, null, '2', 'y']] } },
      ],
    }),

    pyspark({
      id: 'spark-iqr-outliers', title: 'Remove Outliers with the IQR Rule', difficulty: 'Medium',
      topics: ['Statistics', 'Data Quality', 'Filtering'], patterns: ['Quantiles then filter'], domains: ['Mobility / Ride-hailing'], roles: ['Data Engineer', 'Data Scientist'],
      ...tag(sp('VISA', 'Remove Outliers from Trip Data')),
      summary: 'Drop trips whose fare is outside [Q1 − 1.5·IQR, Q3 + 1.5·IQR].',
      description: md('Compute Q1 and Q3 of `fare` with `F.percentile_approx` (exact for small data). Keep trips with fare within the IQR fences (inclusive) and return them with all columns.'),
      hints: ['One small aggregate gives Q1 and Q3; `collect()` it to the driver (two numbers), compute the fences in Python, and filter with `between(lo, hi)`.'],
      schema: { trips: 'trip_id INTEGER Trip, fare DOUBLE Fare' },
      solution: code`def solve(spark, trips):
    q = trips.agg(F.percentile_approx("fare", 0.25).alias("q1"),
                  F.percentile_approx("fare", 0.75).alias("q3")).collect()[0]
    iqr = q["q3"] - q["q1"]
    lo, hi = q["q1"] - 1.5 * iqr, q["q3"] + 1.5 * iqr
    return trips.filter(F.col("fare").between(lo, hi))
`,
      explanation: 'IQR fences are robust to the outliers themselves (unlike mean ± 3σ). Collecting a one-row aggregate and using the numbers as literals is cheap and keeps the filter simple; cross-joining the one-row result is the all-Spark alternative.',
      tests: [
        { name: 'Example', tables: { trips: [[1, 10.0], [2, 12.0], [3, 11.0], [4, 13.0], [5, 95.0], [6, 12.5], [7, 11.5], [8, 0.5]] } },
        { name: 'No outliers', hidden: true, tables: { trips: [[1, 5.0], [2, 6.0], [3, 7.0], [4, 8.0]] } },
        { name: 'Identical fares', hidden: true, tables: { trips: [[1, 3.0], [2, 3.0], [3, 3.0]] } },
      ],
    }),

    pyspark({
      id: 'spark-loyalty-score', title: 'Customer Loyalty Score', difficulty: 'Hard',
      topics: ['Aggregation', 'Joins', 'Column Expressions'], patterns: ['Feature aggregation + scoring formula'], domains: ['Mobility / Ride-hailing'], roles: DE_DA,
      ...tag(sp('VISA', 'Customer Loyalty Score')),
      summary: 'Combine trip counts and ratings into a loyalty score for customers with enough trips.',
      description: md('For customers with at least 3 completed trips: `trips`, `avg_rating` (rounded to 2, null ratings ignored) and `score = round(trips * 2 + avg_rating * 10, 1)`. Return `customer_id`, `name`, `trips`, `avg_rating`, `score`. Cancelled trips don\'t count.'),
      hints: ['`F.avg` ignores nulls automatically; filter completed trips before aggregating.'],
      schema: { trips: 'trip_id INTEGER Trip, customer_id INTEGER Customer, status VARCHAR completed · cancelled, rating INTEGER Rating 1-5', customers: 'customer_id INTEGER Customer, name VARCHAR Name' },
      solution: code`def solve(spark, trips, customers):
    stats = (trips.filter(F.col("status") == "completed")
             .groupBy("customer_id")
             .agg(F.count("*").alias("trips"), F.round(F.avg("rating"), 2).alias("avg_rating"))
             .filter(F.col("trips") >= 3))
    return (stats.join(customers, "customer_id")
            .withColumn("score", F.round(F.col("trips") * 2 + F.col("avg_rating") * 10, 1))
            .select("customer_id", "name", "trips", "avg_rating", "score"))
`,
      explanation: 'Build features with one aggregation, filter on them, then join dimensions for display. Averages skip null ratings, so unrated trips still count as trips but don\'t drag the rating to zero.',
      tests: [
        { name: 'Example', tables: { trips: [[1, 1, 'completed', 5], [2, 1, 'completed', 4], [3, 1, 'completed', null], [4, 2, 'completed', 3], [5, 2, 'cancelled', 1], [6, 2, 'completed', 3]], customers: [[1, 'Ana'], [2, 'Raj']] } },
        { name: 'Exactly three trips', hidden: true, tables: { trips: [[1, 3, 'completed', 1], [2, 3, 'completed', 2], [3, 3, 'completed', 3]], customers: [[3, 'Li']] } },
        { name: 'Cancellations do not count', hidden: true, tables: { trips: [[1, 4, 'cancelled', 5], [2, 4, 'cancelled', 5], [3, 4, 'completed', 5]], customers: [[4, 'Zoe']] } },
      ],
    }),

    pyspark({
      id: 'spark-rule-checks', title: 'Count Data-Quality Rule Violations', difficulty: 'Medium',
      topics: ['Data Quality', 'Aggregation'], patterns: ['Rules as boolean columns'], domains: ['Data quality'], roles: DE,
      summary: 'Evaluate several validation rules in one pass and report violations per rule.',
      description: md('Rules for `orders`: `amount_positive` (amount > 0), `status_valid` (status in new/paid/shipped), `email_present` (email not null or blank), `date_not_future` (order_date ≤ 2024-12-31). Return one row with the number of violating rows per rule (a null amount violates `amount_positive`).'),
      hints: ['A violation flag per rule: `F.when(condition, 0).otherwise(1)` — `otherwise` also catches nulls, where the condition is null.'],
      schema: { orders: 'order_id INTEGER Order, amount DOUBLE Amount, status VARCHAR Status, email VARCHAR Email, order_date DATE Date' },
      solution: code`RULES = {
    "amount_positive": F.col("amount") > 0,
    "status_valid": F.col("status").isin("new", "paid", "shipped"),
    "email_present": F.col("email").isNotNull() & (F.trim("email") != ""),
    "date_not_future": F.col("order_date") <= F.lit("2024-12-31").cast("date"),
}

def solve(spark, orders):
    return orders.agg(*[F.sum(F.when(cond, 0).otherwise(1)).alias(name) for name, cond in RULES.items()])
`,
      explanation: 'A null comparison is neither true nor false, so `when(cond, 0).otherwise(1)` counts nulls as violations — usually what a quality check wants. Rules as a dict of Column expressions make the check list data-driven and run in a single scan.',
      tests: [
        { name: 'Example', tables: { orders: [[1, 10.0, 'paid', 'a@x', '2024-05-01'], [2, -1.0, 'lost', ' ', '2025-01-01'], [3, null, 'new', null, '2024-01-01']] } },
        { name: 'All clean', hidden: true, tables: { orders: [[1, 1.0, 'shipped', 'x@y', '2024-12-31']] } },
        { name: 'Null status is invalid', hidden: true, tables: { orders: [[1, 5.0, null, 'a@b', '2024-01-01']] } },
      ],
    }),

    pyspark({
      id: 'spark-survivorship', title: 'Survivorship: the Most Complete Customer Record', difficulty: 'Hard',
      topics: ['Deduplication', 'Window Functions', 'NULL Handling'], patterns: ['Rank by completeness, then recency'], domains: ['Marketing / CRM'], roles: DE,
      summary: 'Several systems hold the same customer; keep the record with the most filled fields, newest on ties.',
      description: md('Group records by normalised email (trimmed, lowercased). Keep the record with the most non-null fields among `name`, `phone`, `city`; on ties the latest `updated_at`. Return `email` (normalised), `name`, `phone`, `city`, `source`.'),
      hints: ['Completeness score: sum of `F.col(c).isNotNull().cast("int")` over the fields; then `row_number` ordered by score desc, updated_at desc.'],
      schema: { records: 'source VARCHAR System, email VARCHAR Email, name VARCHAR Name, phone VARCHAR Phone, city VARCHAR City, updated_at TIMESTAMP Updated' },
      solution: code`FIELDS = ["name", "phone", "city"]

def solve(spark, records):
    score = sum(F.col(c).isNotNull().cast("int") for c in FIELDS)
    df = records.withColumn("email", F.lower(F.trim("email"))).withColumn("score", score)
    w = Window.partitionBy("email").orderBy(F.desc("score"), F.desc("updated_at"))
    return (df.withColumn("rn", F.row_number().over(w)).filter("rn = 1")
            .select("email", "name", "phone", "city", "source"))
`,
      explanation: 'Master-data "survivorship" picks the best record by explicit rules — completeness first, recency second. Python\'s `sum` over Column expressions builds one `a + b + c` expression.',
      tests: [
        { name: 'Example', tables: { records: [['crm', 'Ana@X.io', 'Ana', null, 'Pune', '2024-01-01 00:00:00'], ['web', 'ana@x.io ', 'Ana L', '555', 'Pune', '2023-06-01 00:00:00'], ['crm', 'raj@x.io', 'Raj', null, null, '2024-01-01 00:00:00']] } },
        { name: 'Tie goes to the newest', hidden: true, tables: { records: [['a', 'z@x', 'Z1', null, null, '2024-01-01 00:00:00'], ['b', 'z@x', null, '1', null, '2024-02-01 00:00:00']] } },
        { name: 'Single record', hidden: true, tables: { records: [['s', 'q@x', null, null, null, '2024-01-01 00:00:00']] } },
      ],
    }),

    pyspark({
      id: 'spark-schema-drift-check', title: 'Detect Schema Drift', difficulty: 'Medium',
      topics: ['Schema Handling', 'Data Quality'], patterns: ['Compare df.dtypes with a contract'], domains: ['Event pipelines'], roles: DE,
      summary: 'Compare an incoming DataFrame\'s schema with the expected contract and report differences.',
      description: md('The contract is `order_id: int`, `amount: double`, `currency: string`, `created_at: timestamp`. Return one row per difference: `column`, `issue` (`"missing"`, `"unexpected"` or `"type"`), `expected`, `actual` (Spark simple type names like `int`, `string`; null where not applicable).'),
      hints: ['`{f.name: f.dataType.simpleString() for f in df.schema.fields}` maps column → type string (same as `dict(df.dtypes)`); compare with the contract and build a small DataFrame from the findings.'],
      schema: { incoming: 'order_id INTEGER Order, amount VARCHAR Amount (wrong type), currency VARCHAR Currency, channel VARCHAR New column' },
      solution: code`CONTRACT = {"order_id": "int", "amount": "double", "currency": "string", "created_at": "timestamp"}

def solve(spark, incoming):
    actual = {f.name: f.dataType.simpleString() for f in incoming.schema.fields}
    rows = []
    for col, t in CONTRACT.items():
        if col not in actual:
            rows.append((col, "missing", t, None))
        elif actual[col] != t:
            rows.append((col, "type", t, actual[col]))
    for col, t in actual.items():
        if col not in CONTRACT:
            rows.append((col, "unexpected", None, t))
    return spark.createDataFrame(rows, "column string, issue string, expected string, actual string")
`,
      explanation: 'Schema checks run on metadata (`df.dtypes`), not data, so they are instant and should gate a pipeline before any heavy work. Missing, unexpected and changed-type columns need different responses (fail, ignore, cast).',
      tests: [
        { name: 'Example', tables: { incoming: [[1, '9.5', 'USD', 'web']] } },
        { name: 'Empty table still has a schema', hidden: true, tables: { incoming: [] } },
        { name: 'Many rows, same drift', hidden: true, tables: { incoming: [[1, '1', 'EUR', 'app'], [2, '2', 'INR', 'pos']] } },
      ],
    }),

    pyspark({
      id: 'spark-value-mapping', title: 'Standardise Codes with a Mapping Table', difficulty: 'Easy',
      topics: ['Joins', 'Column Expressions'], patterns: ['Lookup join with default'], domains: ['Data quality'], roles: DE_DA,
      summary: 'Map messy country codes to standard ones via a lookup table, keeping unknowns visible.',
      description: md('Normalise `country_raw` (trim, upper-case) and look it up in `country_map` (`alias → iso2`). Return `user_id`, `country_raw`, `iso2` — `"UNKNOWN"` when there is no mapping.'),
      hints: ['Left join on the normalised value; `coalesce` the result with `"UNKNOWN"`.'],
      schema: { users: 'user_id INTEGER User, country_raw VARCHAR Typed country', country_map: 'alias VARCHAR Upper-case alias, iso2 VARCHAR ISO code' },
      solution: code`def solve(spark, users, country_map):
    u = users.withColumn("alias", F.upper(F.trim("country_raw")))
    return (u.join(country_map, "alias", "left")
            .withColumn("iso2", F.coalesce(F.col("iso2"), F.lit("UNKNOWN")))
            .select("user_id", "country_raw", "iso2"))
`,
      explanation: 'Mappings belong in data (a lookup table), not in long `when` chains. Defaulting unknown codes to a sentinel keeps them countable so the mapping can be extended.',
      tests: [
        { name: 'Example', tables: { users: [[1, ' india'], [2, 'IN'], [3, 'U.S.'], [4, 'Narnia']], country_map: [['INDIA', 'IN'], ['IN', 'IN'], ['U.S.', 'US']] } },
        { name: 'Empty mapping', hidden: true, tables: { users: [[1, 'x']], country_map: [] } },
        { name: 'Case and spaces', hidden: true, tables: { users: [[1, '  uk ']], country_map: [['UK', 'GB']] } },
      ],
    }),

    pyspark({
      id: 'spark-surrogate-keys', title: 'Assign Surrogate Keys to New Dimension Rows', difficulty: 'Medium',
      topics: ['SCD & Incremental Loads', 'Window Functions'], patterns: ['Surrogate keys continuing from max'], domains: ['Data warehousing'], roles: DE,
      summary: 'Give new customers keys that continue after the current maximum, deterministically.',
      description: md('`dim` holds existing `(customer_key, customer_id)` rows; `staging` has incoming `customer_id`s (possibly repeated, possibly already in dim). Return only the **new** customers as `customer_key`, `customer_id`: keys continue from the current max (or from 1 for an empty dim), assigned in `customer_id` order.'),
      hints: ['Distinct new ids via `left_anti`; `row_number()` over `orderBy("customer_id")` plus the max existing key.', '`monotonically_increasing_id` is not consecutive (and isn\'t available here) — use `row_number`.'],
      schema: { dim: 'customer_key INTEGER Surrogate key, customer_id VARCHAR Natural key', staging: 'customer_id VARCHAR Natural key, name VARCHAR Name' },
      solution: code`def solve(spark, dim, staging):
    max_key = dim.agg(F.coalesce(F.max("customer_key"), F.lit(0)).alias("m"))
    new_ids = staging.select("customer_id").distinct().join(dim, "customer_id", "left_anti")
    numbered = new_ids.withColumn("rn", F.row_number().over(Window.orderBy("customer_id")))
    return numbered.crossJoin(max_key).select((F.col("m") + F.col("rn")).alias("customer_key"), "customer_id")
`,
      explanation: 'Ordering by the natural key makes key assignment reproducible on reruns. A global `row_number` uses one partition — fine for the (small) set of new rows per load.',
      tests: [
        { name: 'Example', tables: { dim: [[1, 'C1'], [2, 'C2']], staging: [['C3', 'x'], ['C2', 'y'], ['C0', 'z'], ['C3', 'x']] } },
        { name: 'Empty dimension', hidden: true, tables: { dim: [], staging: [['B', 'b'], ['A', 'a']] } },
        { name: 'Nothing new', hidden: true, tables: { dim: [[7, 'Z']], staging: [['Z', 'z']] } },
      ],
    }),

    pyspark({
      id: 'spark-drop-all-null-rows', title: 'Merge Firm Data and Drop Empty Rows', difficulty: 'Medium',
      topics: ['Joins', 'NULL Handling'], patterns: ['Left joins + drop rows with all nulls'], domains: ['Finance'], roles: DE_DA,
      summary: 'Join firms, funds and investments, then remove rows where every measure is missing.',
      description: md('Left-join `funds` to `firms` (on `firm_id`) and `investments` (on `fund_id`). Return `firm_name`, `fund_name`, `company`, `amount`, dropping rows where **both** `company` and `amount` are null.'),
      hints: ['`dropna(how="all", subset=["company", "amount"])` — or an explicit filter with `isNotNull()` on either column.'],
      schema: { firms: 'firm_id INTEGER Firm, firm_name VARCHAR Name', funds: 'fund_id INTEGER Fund, firm_id INTEGER Firm, fund_name VARCHAR Name', investments: 'fund_id INTEGER Fund, company VARCHAR Portfolio company, amount DOUBLE Amount' },
      solution: code`def solve(spark, firms, funds, investments):
    j = (funds.join(firms, "firm_id", "left").join(investments, "fund_id", "left")
         .select("firm_name", "fund_name", "company", "amount"))
    return j.filter(F.col("company").isNotNull() | F.col("amount").isNotNull())
`,
      explanation: 'Left joins keep funds without investments, producing all-null measure columns; removing rows only when **every** measure is missing keeps partially known investments. `dropna(how="all", subset=...)` expresses the same rule.',
      tests: [
        { name: 'Example', tables: { firms: [[1, 'Alpha']], funds: [[10, 1, 'Growth I'], [11, 1, 'Seed II']], investments: [[10, 'Acme', 5.0], [10, null, 2.0]] } },
        { name: 'Fund without a firm', hidden: true, tables: { firms: [], funds: [[1, 9, 'Orphan']], investments: [[1, 'X', 1.0]] } },
        { name: 'Company with unknown amount', hidden: true, tables: { firms: [[1, 'B']], funds: [[2, 1, 'F']], investments: [[2, 'Y', null]] } },
      ],
    }),
  ],
};
