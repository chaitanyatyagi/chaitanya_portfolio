// PySpark pack 7 — complex types: arrays (split, explode, posexplode,
// array_distinct / array_remove / array_contains, sort_array), higher-order
// functions (transform, filter, aggregate), structs and flattening, JSON
// (from_json, get_json_object), maps (map_from_arrays, element_at), and
// generating rows with sequence.
import { pyspark, md, code } from './define.js';
import { sp } from '../sql/define.js';
import { gfg, tag } from '../python/sources.js';

const DE = ['Data Engineer'];
const DE_DA = ['Data Engineer', 'Data Analyst'];

export default {
  problems: [
    pyspark({
      id: 'spark-explode-json-orders', title: 'Flatten Nested JSON Orders', difficulty: 'Medium',
      topics: ['Maps & JSON', 'Complex Types (Arrays / Structs)'], patterns: ['from_json → explode → select struct fields'], domains: ['E-commerce / Sales'], roles: DE,
      ...tag(sp('Amazon', 'Load & Transform JSON file'), gfg('Flipkart', 'machine coding round on JSON documents (solved with Spark)')),
      summary: 'Parse a JSON payload column and explode its line items into one row per item.',
      description: md('`payload` is JSON like `{"order_id": 7, "customer": "ana", "items": [{"sku": "A", "qty": 2}, …]}`. Return `order_id`, `customer`, `sku`, `qty` — one row per item. Orders with an empty items array produce no rows.'),
      hints: ['`F.from_json("payload", "order_id INT, customer STRING, items ARRAY<STRUCT<sku: STRING, qty: INT>>")`, then `F.explode("o.items")`.'],
      schema: { raw: 'payload VARCHAR JSON text' },
      solution: code`SCHEMA = "order_id INT, customer STRING, items ARRAY<STRUCT<sku: STRING, qty: INT>>"

def solve(spark, raw):
    o = raw.select(F.from_json("payload", SCHEMA).alias("o"))
    items = o.select("o.order_id", "o.customer", F.explode("o.items").alias("item"))
    return items.select("order_id", "customer", F.col("item.sku").alias("sku"), F.col("item.qty").alias("qty"))
`,
      explanation: 'Giving `from_json` an explicit schema (rather than inferring) makes parsing fast and predictable; struct fields are then addressable with dots. `explode` drops rows whose array is empty or null — use `explode_outer` in Spark when they must be kept.',
      tests: [
        { name: 'Example', tables: { raw: [['{"order_id": 7, "customer": "ana", "items": [{"sku": "A", "qty": 2}, {"sku": "B", "qty": 1}]}'], ['{"order_id": 8, "customer": "raj", "items": []}']] } },
        { name: 'Single item', hidden: true, tables: { raw: [['{"order_id": 1, "customer": "li", "items": [{"sku": "Z", "qty": 9}]}']] } },
        { name: 'Many orders', hidden: true, tables: { raw: [['{"order_id": 2, "customer": "a", "items": [{"sku": "X", "qty": 1}]}'], ['{"order_id": 3, "customer": "b", "items": [{"sku": "Y", "qty": 2}, {"sku": "Y", "qty": 3}]}']] } },
      ],
    }),

    pyspark({
      id: 'spark-parse-attributes-json', title: 'Parse Product Attributes JSON and Filter', difficulty: 'Medium',
      topics: ['Maps & JSON', 'Filtering'], patterns: ['from_json with a DDL schema'], domains: ['E-commerce / Sales'], roles: DE_DA,
      summary: 'Extract brand, rating and colour from a JSON string column and keep well-rated products.',
      description: md('`attrs` is JSON like `{"brand": "Acme", "rating": 4.5, "color": "red"}` (every key is present; values may be null). Return `sku`, `brand`, `rating`, `color` for products with `rating >= 4.0`.'),
      hints: ['`F.from_json("attrs", "brand STRING, rating DOUBLE, color STRING")` parses once into a struct; select its fields with dots.', 'Null ratings fail the `>=` filter automatically.'],
      schema: { products: 'sku VARCHAR SKU, attrs VARCHAR JSON attributes' },
      solution: code`def solve(spark, products):
    a = F.from_json("attrs", "brand STRING, rating DOUBLE, color STRING")
    return (products.select("sku", a.alias("a"))
            .select("sku", F.col("a.brand").alias("brand"), F.col("a.rating").alias("rating"), F.col("a.color").alias("color"))
            .filter(F.col("rating") >= 4.0))
`,
      explanation: 'Parsing once into a struct and selecting its fields is cheaper and cleaner than calling `get_json_object` per field, which re-parses the string each time. An explicit schema also fixes the types (an integer rating becomes a double).',
      tests: [
        { name: 'Example', tables: { products: [['A', '{"brand": "Acme", "rating": 4.5, "color": "red"}'], ['B', '{"brand": "Bolt", "rating": 3.9, "color": null}'], ['C', '{"brand": null, "rating": 4.0, "color": null}']] } },
        { name: 'No rating', hidden: true, tables: { products: [['D', '{"brand": "X", "rating": null, "color": "x"}']] } },
        { name: 'Integer rating', hidden: true, tables: { products: [['E', '{"brand": "Y", "rating": 5, "color": "blue"}']] } },
      ],
    }),

    pyspark({
      id: 'spark-clean-tag-arrays', title: 'Clean Support Ticket Tags', difficulty: 'Easy',
      topics: ['Complex Types (Arrays / Structs)'], patterns: ['array_remove / array_distinct / sort_array'], domains: ['Customer support'], roles: DE_DA,
      summary: 'Turn comma-separated tags into a clean, sorted, deduplicated array without a deprecated tag.',
      description: md('`tags` is comma-separated text. Return `ticket_id`, `tags_clean` (the tags trimmed and lowercased, without `"legacy"` and empty entries, deduplicated and sorted, joined with `","`) and `tag_count`.'),
      hints: ['`F.transform(F.split(...), lambda t: F.lower(F.trim(t)))`, then `F.array_remove(..., "legacy")`, `F.array_remove(..., "")`, `F.array_distinct`, `F.sort_array`.'],
      schema: { tickets: 'ticket_id INTEGER Ticket, tags VARCHAR Comma-separated tags' },
      solution: code`def solve(spark, tickets):
    arr = F.transform(F.split("tags", ","), lambda t: F.lower(F.trim(t)))
    clean = F.sort_array(F.array_distinct(F.array_remove(F.array_remove(arr, "legacy"), "")))
    return tickets.select("ticket_id", F.array_join(clean, ",").alias("tags_clean"), F.size(clean).alias("tag_count"))
`,
      explanation: 'Array functions work on the whole list inside one row — no explode/regroup round trip. `transform` applies a lambda to every element (a higher-order function, evaluated by the engine, not Python).',
      tests: [
        { name: 'Example', tables: { tickets: [[1, 'Billing, refund,billing,LEGACY'], [2, 'login']] } },
        { name: 'Only legacy', hidden: true, tables: { tickets: [[3, 'legacy, Legacy']] } },
        { name: 'Empty entries', hidden: true, tables: { tickets: [[4, 'a,,b, ,a']] } },
      ],
    }),

    pyspark({
      id: 'spark-array-ops-purchases', title: 'Array Operations on Purchased Items', difficulty: 'Medium',
      topics: ['Complex Types (Arrays / Structs)', 'Aggregation'], patterns: ['collect_set + array predicates'], domains: ['E-commerce / Sales'], roles: DE_DA,
      summary: 'Collect each user\'s distinct items and answer array questions on them.',
      description: md('Return `user_id`, `items` (distinct items, sorted, joined with `"|"`), `n_items`, `bought_milk` (array contains `"milk"`) and `first_item` (alphabetically first).'),
      hints: ['`F.sort_array(F.collect_set("item"))`, then `F.size`, `F.array_contains`, `F.element_at(arr, 1)` (1-based).'],
      schema: { purchases: 'user_id INTEGER User, item VARCHAR Item' },
      solution: code`def solve(spark, purchases):
    items = F.sort_array(F.collect_set("item"))
    return (purchases.groupBy("user_id").agg(items.alias("arr"))
            .select("user_id", F.array_join("arr", "|").alias("items"), F.size("arr").alias("n_items"),
                    F.array_contains("arr", "milk").alias("bought_milk"), F.element_at("arr", 1).alias("first_item")))
`,
      explanation: '`collect_set` deduplicates but has no order; sorting makes outputs deterministic. `element_at` is 1-based (and supports negative indexes from the end).',
      tests: [
        { name: 'Example', tables: { purchases: [[1, 'milk'], [1, 'bread'], [1, 'milk'], [2, 'eggs']] } },
        { name: 'Single item', hidden: true, tables: { purchases: [[3, 'tea']] } },
        { name: 'Case matters', hidden: true, tables: { purchases: [[4, 'Milk'], [4, 'milk']] } },
      ],
    }),

    pyspark({
      id: 'spark-flatten-struct', title: 'Flatten a Nested Struct Dynamically', difficulty: 'Medium',
      topics: ['Complex Types (Arrays / Structs)', 'Schema Handling', 'Maps & JSON'], patterns: ['Recursive select over schema'], domains: ['APIs / Integration'], roles: DE,
      summary: 'Parse nested JSON and flatten every struct field to a top-level column named parent_child.',
      description: md('`doc` is JSON with nested objects: `{"id": 1, "user": {"name": "ana", "address": {"city": "Pune", "zip": "411001"}}, "total": 9.5}`. Parse it with the schema below and flatten **all** nested fields into columns named with underscores: `id`, `user_name`, `user_address_city`, `user_address_zip`, `total` — by walking the schema, not by listing the names. (Every document contains all keys, possibly null.)'),
      hints: ['Recurse over the struct\'s `fields`: for a `StructType` field, recurse with the longer path; otherwise select `F.col(path).alias(name)` where name joins the path parts with `_`.'],
      schema: { raw: 'doc VARCHAR JSON document' },
      solution: code`from pyspark.sql.types import StructType

SCHEMA = "id INT, user STRUCT<name: STRING, address: STRUCT<city: STRING, zip: STRING>>, total DOUBLE"

def flat_columns(struct, path, name=""):
    cols = []
    for field in struct.fields:
        p, n = f"{path}.{field.name}", f"{name}_{field.name}" if name else field.name
        if isinstance(field.dataType, StructType):
            cols += flat_columns(field.dataType, p, n)
        else:
            cols.append(F.col(p).alias(n))
    return cols

def solve(spark, raw):
    parsed = raw.select(F.from_json("doc", SCHEMA).alias("d"))
    struct = parsed.schema.fields[0].dataType
    return parsed.select(*flat_columns(struct, "d"))
`,
      explanation: 'The schema is data you can traverse; a short recursive function flattens any depth and adapts when fields are added. (In Spark, `select("d.*")` also lifts a struct\'s fields one level.)',
      tests: [
        { name: 'Example', tables: { raw: [['{"id": 1, "user": {"name": "ana", "address": {"city": "Pune", "zip": "411001"}}, "total": 9.5}']] } },
        { name: 'Null nested object', hidden: true, tables: { raw: [['{"id": 2, "user": null, "total": 1.0}']] } },
        { name: 'Several documents', hidden: true, tables: { raw: [['{"id": 3, "user": {"name": "raj", "address": {"city": "Goa", "zip": null}}, "total": 2}'], ['{"id": 4, "user": {"name": "li", "address": null}, "total": null}']] } },
      ],
    }),

    pyspark({
      id: 'spark-feature-flag-map', title: 'Per-User Feature Flag Map', difficulty: 'Medium',
      topics: ['Maps & JSON', 'Aggregation'], patterns: ['map_from_arrays + element_at'], domains: ['Experimentation'], roles: DE,
      ...tag(sp('Microsoft', 'Feature Flag Map')),
      summary: 'Build each user\'s current flag map from flag events and read specific flags from it.',
      description: md('Keep each user\'s latest event per flag. Build `flags` = map flag → enabled, then return `user_id`, `dark_mode` and `beta` read from the map (null if the flag was never set) and `enabled_count` (number of flags currently true).'),
      hints: ['Latest per (user, flag) with `row_number`; then `F.map_from_arrays(F.collect_list("flag"), F.collect_list("enabled"))`; read with `F.element_at(map, "beta")`.'],
      schema: { flag_events: 'user_id INTEGER User, flag VARCHAR Flag name, enabled BOOLEAN Value, set_at TIMESTAMP When' },
      solution: code`def solve(spark, flag_events):
    w = Window.partitionBy("user_id", "flag").orderBy(F.desc("set_at"))
    latest = flag_events.withColumn("rn", F.row_number().over(w)).filter("rn = 1")
    maps = latest.groupBy("user_id").agg(
        F.map_from_arrays(F.collect_list("flag"), F.collect_list("enabled")).alias("flags"),
        F.sum(F.col("enabled").cast("int")).alias("enabled_count"),
    )
    return maps.select("user_id", F.element_at("flags", "dark_mode").alias("dark_mode"),
                       F.element_at("flags", "beta").alias("beta"), "enabled_count")
`,
      explanation: 'A map column stores sparse key/value attributes compactly. Two `collect_list`s in the **same** aggregation stay aligned, so zipping them into a map is safe.',
      tests: [
        { name: 'Example', tables: { flag_events: [[1, 'dark_mode', true, '2024-01-01 00:00:00'], [1, 'dark_mode', false, '2024-02-01 00:00:00'], [1, 'beta', true, '2024-01-05 00:00:00'], [2, 'beta', false, '2024-01-01 00:00:00']] } },
        { name: 'Flag never set', hidden: true, tables: { flag_events: [[3, 'other', true, '2024-01-01 00:00:00']] } },
        { name: 'Toggled back on', hidden: true, tables: { flag_events: [[4, 'beta', true, '2024-01-01 00:00:00'], [4, 'beta', false, '2024-01-02 00:00:00'], [4, 'beta', true, '2024-01-03 00:00:00']] } },
      ],
    }),

    pyspark({
      id: 'spark-ordered-page-path', title: 'Chronological Page Path without Repeats', difficulty: 'Medium',
      topics: ['Complex Types (Arrays / Structs)', 'Window Functions'], patterns: ['Collapse consecutive duplicates, then ordered collect'], domains: ['Web analytics'], roles: DE_DA,
      summary: 'Build each user\'s page path in time order, collapsing consecutive views of the same page.',
      description: md('Return `user_id` and `path` (pages joined with `" → "`) in `ts` order, where consecutive repeats of the same page collapse into one (A, A, B, A → A → B → A).'),
      hints: ['Drop rows equal to the previous page (`lag`), then collect structs of (ts, page), sort and extract pages.'],
      schema: { pageviews: 'user_id INTEGER User, ts TIMESTAMP When, page VARCHAR Page' },
      solution: code`def solve(spark, pageviews):
    w = Window.partitionBy("user_id").orderBy("ts")
    changes = pageviews.withColumn("prev", F.lag("page").over(w)).filter(F.col("prev").isNull() | (F.col("prev") != F.col("page")))
    steps = F.sort_array(F.collect_list(F.struct("ts", "page")))
    return (changes.groupBy("user_id").agg(steps.alias("steps"))
            .select("user_id", F.array_join(F.transform("steps", lambda s: s["page"]), " → ").alias("path")))
`,
      explanation: 'Filtering on "different from the previous row" is the run-collapse pattern (like `uniq`). Sorting an array of (ts, page) structs guarantees the path order regardless of shuffles.',
      tests: [
        { name: 'Example', tables: { pageviews: [[1, '2024-01-01 10:00:00', 'home'], [1, '2024-01-01 10:01:00', 'home'], [1, '2024-01-01 10:02:00', 'cart'], [1, '2024-01-01 10:03:00', 'home'], [2, '2024-01-01 09:00:00', 'search']] } },
        { name: 'Unsorted input', hidden: true, tables: { pageviews: [[3, '2024-01-01 10:02:00', 'c'], [3, '2024-01-01 10:00:00', 'a'], [3, '2024-01-01 10:01:00', 'b']] } },
        { name: 'All the same page', hidden: true, tables: { pageviews: [[4, '2024-01-01 00:00:00', 'x'], [4, '2024-01-01 00:00:01', 'x']] } },
      ],
    }),

    pyspark({
      id: 'spark-basket-pairs', title: 'Item Pairs Bought Together', difficulty: 'Hard',
      topics: ['Joins', 'Aggregation', 'Complex Types (Arrays / Structs)'], patterns: ['Self join on order with a < b'], domains: ['Retail'], roles: ['Data Engineer', 'Data Scientist'],
      ...tag(sp('Walmart', 'Grocery Basket Pairs')),
      summary: 'Find item pairs that appear together in at least two orders.',
      description: md('Return `item_a`, `item_b` (alphabetical, `item_a < item_b`) and `orders` for pairs appearing together in at least 2 distinct orders. An item listed twice in one order counts once.'),
      hints: ['Deduplicate (order, item) first, self-join on `order_id` with `a.item < b.item`, then count distinct orders per pair.'],
      schema: { order_items: 'order_id INTEGER Order, item VARCHAR Item' },
      solution: code`def solve(spark, order_items):
    oi = order_items.select("order_id", "item").distinct()
    a, b = oi.alias("a"), oi.alias("b")
    pairs = a.join(b, (F.col("a.order_id") == F.col("b.order_id")) & (F.col("a.item") < F.col("b.item")))
    return (pairs.groupBy(F.col("a.item").alias("item_a"), F.col("b.item").alias("item_b"))
            .agg(F.countDistinct("a.order_id").alias("orders"))
            .filter(F.col("orders") >= 2))
`,
      explanation: '`a.item < b.item` produces each unordered pair once and excludes self-pairs. Market-basket joins grow quadratically with basket size — at scale, cap basket sizes or use FP-growth.',
      tests: [
        { name: 'Example', tables: { order_items: [[1, 'bread'], [1, 'milk'], [1, 'eggs'], [2, 'milk'], [2, 'bread'], [3, 'eggs'], [3, 'milk'], [3, 'milk']] } },
        { name: 'No repeated pairs', hidden: true, tables: { order_items: [[1, 'a'], [1, 'b'], [2, 'c'], [2, 'd']] } },
        { name: 'Duplicate lines', hidden: true, tables: { order_items: [[1, 'x'], [1, 'x'], [1, 'y'], [2, 'y'], [2, 'x']] } },
      ],
    }),

    pyspark({
      id: 'spark-expand-subscription-months', title: 'Expand Subscriptions into Monthly Rows (MRR)', difficulty: 'Medium',
      topics: ['Date & Time', 'Complex Types (Arrays / Structs)'], patterns: ['sequence + explode'], domains: ['Subscriptions / SaaS'], roles: DE_DA,
      summary: 'Generate one row per active month for each subscription and total monthly recurring revenue.',
      description: md('A subscription is active from the month of `start_date` through the month of `end_date` (inclusive). Return `month` (first day of month) and `mrr` (sum of `monthly_fee` over subscriptions active that month, rounded to 2).'),
      hints: ['`F.sequence(F.trunc("start_date", "month"), F.trunc("end_date", "month"), F.expr("interval 1 month"))`, then `explode`.'],
      schema: { subscriptions: 'sub_id INTEGER Subscription, start_date DATE Start, end_date DATE End, monthly_fee DOUBLE Fee' },
      solution: code`def solve(spark, subscriptions):
    months = F.sequence(F.trunc("start_date", "month"), F.trunc("end_date", "month"), F.expr("interval 1 month"))
    rows = subscriptions.select(F.explode(months).cast("date").alias("month"), "monthly_fee")
    return rows.groupBy("month").agg(F.round(F.sum("monthly_fee"), 2).alias("mrr"))
`,
      explanation: '`sequence` + `explode` generates rows from ranges — the DataFrame way to build calendar spines. Truncating both ends to the month first makes partial months count as active.',
      tests: [
        { name: 'Example', tables: { subscriptions: [[1, '2024-01-15', '2024-03-02', 10.0], [2, '2024-02-01', '2024-02-29', 25.5]] } },
        { name: 'Single month', hidden: true, tables: { subscriptions: [[1, '2024-05-01', '2024-05-31', 9.99]] } },
        { name: 'Across a year', hidden: true, tables: { subscriptions: [[1, '2023-12-10', '2024-01-05', 5.0]] } },
      ],
    }),

    pyspark({
      id: 'spark-array-higher-order', title: 'Higher-Order Functions on Price Arrays', difficulty: 'Medium',
      topics: ['Complex Types (Arrays / Structs)'], patterns: ['transform / filter / aggregate'], domains: ['E-commerce / Sales'], roles: DE,
      summary: 'Apply tax, drop free items and total each cart — without exploding.',
      description: md('`prices` is a comma-separated list of item prices per cart. Return `cart_id`, `paid_items` (number of items with price > 0), `total_with_tax` (sum of price × 1.18 over paid items, rounded to 2).'),
      hints: ['`F.transform(F.split(...), lambda p: p.cast("double"))`, `F.filter(arr, lambda p: p > 0)`, `F.aggregate(arr, F.lit(0.0), lambda acc, p: acc + p * 1.18)`.'],
      schema: { carts: 'cart_id INTEGER Cart, prices VARCHAR Comma-separated prices' },
      solution: code`def solve(spark, carts):
    arr = F.transform(F.split("prices", ","), lambda p: F.trim(p).cast("double"))
    paid = F.filter(arr, lambda p: p > 0)
    # Spark returns the start value for an empty array; this sandbox engine errors, so seed one 0.
    total = F.aggregate(F.concat(paid, F.array(F.lit(0.0))), F.lit(0.0), lambda acc, p: acc + p * 1.18)
    return carts.select("cart_id", F.size(paid).alias("paid_items"), F.round(total, 2).alias("total_with_tax"))
`,
      explanation: 'Higher-order functions (`transform`, `filter`, `aggregate`) process arrays element-wise inside the engine — avoiding an explode + groupBy round trip or a slow Python UDF.',
      tests: [
        { name: 'Example', tables: { carts: [[1, '10, 0, 5.5'], [2, '0']] } },
        { name: 'Single item', hidden: true, tables: { carts: [[3, '100']] } },
        { name: 'Rounding', hidden: true, tables: { carts: [[4, '0.1,0.2,0.3']] } },
      ],
    }),

    pyspark({
      id: 'spark-posexplode-positions', title: 'Position of Each Item in a List (posexplode)', difficulty: 'Easy',
      topics: ['Complex Types (Arrays / Structs)'], patterns: ['posexplode'], domains: ['Search & text'], roles: DE_DA,
      summary: 'Explode a ranked list of search results with each result\'s position.',
      description: md('`results` is a `|`-separated ranked list of result ids. Return `query_id`, `position` (1-based) and `result_id` for the top 3 positions.'),
      hints: ['`F.posexplode(arr)` yields `pos` (0-based) and `col`.'],
      schema: { searches: 'query_id INTEGER Query, results VARCHAR Pipe-separated ids' },
      solution: code`def solve(spark, searches):
    exploded = searches.select("query_id", F.posexplode(F.split("results", r"\|")).alias("pos", "result_id"))
    return exploded.filter(F.col("pos") < 3).select("query_id", (F.col("pos") + 1).alias("position"), "result_id")
`,
      explanation: '`posexplode` keeps each element\'s index, which plain `explode` loses. `split` takes a regex, so a literal `|` must be escaped.',
      tests: [
        { name: 'Example', tables: { searches: [[1, 'r9|r3|r7|r1'], [2, 'r5']] } },
        { name: 'Exactly three', hidden: true, tables: { searches: [[3, 'a|b|c']] } },
        { name: 'Two queries', hidden: true, tables: { searches: [[4, 'x|y'], [5, 'p|q|r|s|t']] } },
      ],
    }),
  ],
};
