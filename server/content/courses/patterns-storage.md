# Data Storage Design Patterns

In big data systems, query time is money. You can react to slow queries by throwing compute at the cluster — expensive and temporary — or you can **design the storage layer** so engines scan less data, shuffle less across the network, and present data in the shape queries actually want. That's what these patterns do.

## Horizontal Partitioner

**Problem.** A batch job computes rolling aggregates over a multi-day window. As months of records accumulate, the job degrades — most of its time goes to scanning ancient history just to filter it out.

**Solution.** Split the dataset into physically distinct directories/locations based on a **partitioning attribute**, so the engine targets only the required directories and skips the rest entirely.

```text
visits/2024/05/
├── country=france/
├── country=india/
└── country=usa/
```

Where does the partition value come from?

- **Job execution context (run date)** — everything written in one run lands in one folder. Simple, but late data lands in the "wrong" partition.
- **The data itself (event time)** — partitions reflect record timestamps; one ingestion batch may fan out to multiple historical partitions ("late data phenomena").
- **Business keys** — customer, partner, country; keys can nest hierarchically.

```python
partitioned = (input_users
    .withColumn('year',  F.year('change_date'))
    .withColumn('month', F.month('change_date'))
    .withColumn('day',   F.day('change_date'))
    .withColumn('hour',  F.hour('change_date')))

(partitioned.write
    .mode('overwrite')
    .format('delta')
    .partitionBy('year', 'month', 'day', 'hour')
    .save(output_dir))
```

**Critical drawback — cardinality.** Horizontal partitioning needs **low-cardinality** keys (dates, regions). Partition by `user_id` and you spawn millions of tiny directories — the *small files problem* — choking the system with file listings and metadata overhead.

**Skew in streaming.** Unbalanced partitions bottleneck micro-batches on the largest one. A practical mitigation is **backpressure buffering**: overflow entries go to a temporary buffer store and are processed in subsequent micro-batches, keeping the other lanes real-time.

## Vertical Partitioner

**Problem.** Rows mix fields with totally different lifecycles: highly mutable values (click counts, last-active time) glued to heavy immutable ones (registration IP, device specs). Every update drags dead weight across the network.

**Solution.** Split the *columns* of one logical record into standalone tables/files joined by a key.

```text
Raw unified row ──▶ Table A: mutable   (id, page, clicks)
                └─▶ Table B: immutable (id, ip, device)
```

**Why it's powerful:** each column group gets independent retention, lifecycle, and security policies. (This same mechanic powers GDPR-friendly PII isolation — see the Security chapter.)

**Trade-offs.** Ingestion needs multiple writes; reads need joins to reconstruct the full row.

## Bucket

**Problem.** You need fast lookups and joins on a **high-cardinality** key (`user_id`) where horizontal partitioning would explode the metadata catalog.

**Solution.** Group keys into a **fixed number** of deterministic containers:

```text
bucket_id = hash(key) % total_buckets
```

Two optimization wins:

1. **Bucket pruning** — filtering on the bucketed column lets the engine compute the target bucket instantly and skip every other file.
2. **Shuffle-free joins** — joining two datasets bucketed identically (same key, same count) matches records file-to-file locally, eliminating the distributed shuffle.

```sql
CREATE EXTERNAL TABLE visits (
    visit_id   STRING,
    user_id    STRING,
    event_time TIMESTAMP
)
CLUSTERED BY (user_id) INTO 50 BUCKETS
TBLPROPERTIES ('bucketing_format' = 'spark');
```

## Sorter

**Problem.** Even with good partitioning, range scans on continuous attributes (exact timestamps) stay slow — matching rows are scattered across every file.

**Solution.** Physically **sort rows on disk before writing**. Modern lake formats then use file-level min/max statistics to skip whole files during planning.

| Aspect | Lexicographical sort | Z-Order (curved) sort |
| --- | --- | --- |
| Structure | Strict primary-key-first ordering | Maps multiple columns onto a space-filling curve |
| Multi-column filters | Fast only when the leading sort key is in the filter | Equally efficient across all configured columns |
| Tooling | BigQuery cluster keys, Snowflake clustered tables | Delta `OPTIMIZE ZORDER`, Iceberg, Redshift interleaved keys |

```python
(DeltaTable.forPath(spark, output_dir)
    .optimize()
    .executeZOrderBy(['visit_id', 'page']))
```

## Metadata Enhancer

**Problem.** Selective queries against massive tables cost a fortune because the engine parses mountains of records just to apply a simple filter.

**Solution.** Use columnar formats (**Parquet**) whose file footers embed per-row-group statistics — `min`, `max`, `null_count` — for every column.

```text
┌───────────────────────────────┐
│ Row group data blocks         │  ◀ column-oriented binary arrays
├───────────────────────────────┤
│ Footer: age min=19 max=50 ... │  ◀ read FIRST, tiny
└───────────────────────────────┘
```

A query like `WHERE age > 50` reads only the footers; if a file's max age is 50, the whole file is skipped — massive I/O savings for free.

**Watch out:** in warehouses, stats update asynchronously and drift as data changes, producing bad query plans. Run `ANALYZE TABLE` to realign them.

## Dataset Materializer

**Problem.** The same heavy multi-table join runs hundreds of times a day in dashboards.

**Solution.** Precompute and persist the result — a physical table or managed **materialized view** — and let queries hit that instead.

- **Automatic refresh** — Redshift/BigQuery refresh materialized views in the background, but timing depends on cluster load (less predictable).
- **Incremental refresh via MERGE** — for insert-only feeds, append just the new slice:

```sql
MERGE INTO dedp.visits_counter AS target
USING (
  SELECT user_id, COUNT(*) AS visits FROM dedp.visits
  WHERE insertion_time > '2024-11-09T03:27:32'
  GROUP BY user_id
) AS input
ON target.user_id = input.user_id
WHEN MATCHED     THEN UPDATE SET count = target.count + input.visits
WHEN NOT MATCHED THEN INSERT (user_id, count) VALUES (input.user_id, input.visits);
```

## Manifest

**Problem.** With millions of objects in a bucket, even *listing* the files via API calls is slow and expensive.

**Solution.** Producers write an explicit list of the files created in each transaction into a central **manifest** (transaction log). Readers skip directory listings entirely and read the manifest to find target files directly. This is the core mechanic behind Delta Lake and Iceberg transaction logs.

## Normalizer

**Focus:** eliminate redundancy → absolute consistency and cheap updates, at the cost of read performance.

The three core normal forms:

1. **1NF** — atomic, non-repeating column values; every row uniquely identified by a primary key.
2. **2NF** — 1NF + every non-key column fully depends on the *whole* primary key (no partial dependency on a composite key).
3. **3NF** — 2NF + no transitive dependencies (non-key attributes depend *only* on the key).

**Snowflake schema** — a dimensional variant where dimensions are themselves normalized into sub-dimensions (Date → Month → Quarter). Storage-efficient, but queries become long chains of joins that hurt in distributed engines.

## Denormalizer

**Focus:** eliminate runtime joins → fast analytics, at the cost of redundancy and pricier updates.

- **One Big Table (OBT)** — flatten everything into one wide row; zero shuffles because every value is local.
- **Star schema** — a central fact table joined directly to a single layer of wide, denormalized dimensions. No sub-dimensions.

> **Antipattern — the "trash bag" OBT.** If a table mixes user metrics, purchase history, and random web analytics with no shared business context, it's unmaintainable. Heuristic: if the table name needs conjunctions (`users_and_orders_with_web_visits`), your denormalization scope is too broad.

**The hybrid that production systems actually use:**

```text
Visits ┐
Devices ├─ Normalized master (snowflake, source of truth, safe updates)
Users  ┘        │
                ▼ automated flatten job
        One Big Table (read-optimized) ──▶ analysts & dashboards
```

Keep a normalized core as the single source of truth, and continuously flatten it into a denormalized presentation layer for analytics.

## Pattern Selection Matrix

| Pattern | Optimizes | Best for | Key trade-off |
| --- | --- | --- | --- |
| Horizontal Partitioner | Scan pruning | Low-cardinality keys (date, region) | Small-files problem on high cardinality |
| Vertical Partitioner | Update efficiency + policy isolation | Mixed-lifecycle columns | Reads require joins |
| Bucket | Lookups/joins on high-cardinality keys | `user_id`-style keys | Fixed bucket count needs planning |
| Sorter | Range scans, file skipping | Timestamp/continuous filters | Rewrite cost to maintain order |
| Metadata Enhancer | I/O skipping | Columnar analytical workloads | Stats drift → bad plans |
| Dataset Materializer | Repeated heavy queries | Dashboard workloads | Staleness + refresh management |
| Manifest | File discovery | Million-object data lakes | Producers must maintain the log |
| Normalizer | Consistency, update cost | Transactional sources of truth | Join-heavy reads |
| Denormalizer | Read speed | Analytics presentation layers | Redundancy, expensive updates |
