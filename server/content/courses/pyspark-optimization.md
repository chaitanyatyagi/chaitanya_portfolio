# AQE, Skew & Advanced Optimization

Everything so far optimized at *plan time* — but Catalyst's cost model works on **estimates**, and estimates lie: filters remove more than expected, joins explode, one key hoards half the data. Spark 3's answer is to **re-optimize at runtime**. This chapter covers Adaptive Query Execution, Dynamic Partition Pruning, and the manual technique AQE hasn't retired: salting.

## The skew problem, concretely

**Skew** = a few keys own most of the rows. One `product_id` with 5 M sales while others have hundreds. After a shuffle by that key, one partition is a whale:

```text
shuffle partitions:  [12MB] [9MB] [11MB] [4.7GB ←] [8MB] ...
tasks:                 3s     2s    3s     48min      2s
```

Consequences stack: the whole stage waits on one straggler task, that task's working set may not fit execution memory (→ spill, or the un-spillable single-partition OOM from the memory chapter), and joins multiply the pain — a skewed key × matching rows on the other side explodes row counts (5×2 + 2×2 + 1×1 = 15 output rows from 8+5 inputs, scaled to billions).

## Adaptive Query Execution (AQE)

Enabled by default since Spark 3.2 (`spark.sql.adaptive.enabled`). The idea: **shuffle boundaries produce real statistics** — actual sizes, actual row counts. AQE pauses at each boundary, compares reality to the plan, and rewrites the rest. Three features:

**1. Dynamically coalescing shuffle partitions.** The `spark.sql.shuffle.partitions = 200` default is wrong for almost every query. Filter-heavy example: after `WHERE crop = 'sugarcane'`, 195 of 200 shuffle partitions are empty and the rest are tiny. AQE **merges small adjacent partitions and drops empty ones** at runtime — 200 scheduled tasks become, say, 5 meaningful ones. No more hand-tuning shuffle partitions per query.

**2. Dynamically switching join strategies.** The plan chose sort-merge because both tables *looked* big. At runtime, the build side post-filter turns out to be 8 MB → AQE **converts sort-merge to broadcast hash join mid-query**, skipping the remaining shuffle work.

**3. Dynamically optimizing skew joins.** AQE detects a skewed partition — the default-ish thresholds: **larger than 5× the median partition size AND larger than 256 MB** — and **splits it into sub-partitions**, duplicating the matching other-side partition for each split:

```text
  BEFORE                          AFTER (AQE skew handling)
  df1-p3  4.7GB ──┐               df1-p3a 1.2GB ─┬─ join copy of df2-p3
                  ├─ 1 task       df1-p3b 1.2GB ─┼─ join copy of df2-p3
  df2-p3  20MB ───┘               df1-p3c 1.2GB ─┼─ join copy of df2-p3
                                  df1-p3d 1.1GB ─┴─ join copy of df2-p3
        48 min straggler                4 parallel ~12 min tasks
```

Reference for all knobs: the Spark SQL performance-tuning docs (`spark.apache.org/docs/latest/sql-performance-tuning.html`).

## Dynamic Partition Pruning (DPP)

Ordinary partition pruning: data partitioned by a column + a **literal filter** on that column → Spark reads only matching directories. But star-schema queries filter the **dimension**, not the fact:

```python
sales = spark.read.parquet("/data/sales")        # partitioned by date_key
dates = spark.read.parquet("/data/dim_date")

result = sales.join(dates, "date_key") \
              .filter(dates["quarter"] == "2026-Q1")   # filter is on the DIM side!
```

Statically, Spark knows nothing about which `date_key`s survive that filter — it would scan **every** sales partition. **DPP injects a filter at runtime**: execute the dimension side first, broadcast the surviving keys, and turn them into a partition filter on the fact scan. A full-table scan becomes a ~90-partition read.

Conditions for DPP to kick in (know these): **(1)** the fact table is **partitioned** on the join column, **(2)** the dimension side is **broadcastable** (small enough), **(3)** Spark 3.0+ — enabled by default (`spark.sql.optimizer.dynamicPartitionPruning.enabled`).

## Salting — the manual skew fix

AQE handles skewed *joins* it can see, but salting remains the interview classic and the fallback (aggregation skew, older Spark, stubborn cases). The idea: **a skewed key becomes N artificial keys**, spreading the whale partition across N tasks.

```python
from pyspark.sql.functions import col, rand, floor, concat, lit, explode, array

SALT = 8

# Big skewed side: split each key into 8 random sub-keys
big_salted = big_df.withColumn("salt", floor(rand() * SALT)) \
                   .withColumn("join_key", concat(col("product_id"), lit("_"), col("salt")))

# Small side: EXPLODE — every row duplicated once per possible salt,
# so each sub-key still finds its match
small_exploded = (
    small_df
    .withColumn("salt", explode(array(*[lit(i) for i in range(SALT)])))
    .withColumn("join_key", concat(col("product_id"), lit("_"), col("salt")))
)

result = big_salted.join(small_exploded, "join_key").drop("salt", "join_key")
```

What happened: `product_id 1` (the whale) became `1_0 … 1_7` — eight partitions instead of one; the small side was duplicated ×8 so every salted key joins correctly. The costs, stated honestly: the small side grows N-fold, and post-join aggregations need a second, unsalted aggregation pass. Salting for a skewed `groupBy` is the same two-step: aggregate on `(key, salt)` first, then aggregate the partials by `key`.

## An optimization checklist

Order of operations when a job is slow — cheapest diagnosis first:

1. **Read the Spark UI** — which stage, which task? A straggler = skew; uniform slowness = under-parallelized or under-resourced.
2. **Check the plan** (`df.explain()`) — expected broadcast happened? Predicate pushdown reached the scan? Surprise `BroadcastNestedLoopJoin`?
3. **Cut data early** — select needed columns, filter before joins, let Parquet pruning work for you.
4. **Right-size shuffles** — AQE on; still tune `shuffle.partitions` upward for huge shuffles AQE can only merge, not split (pre-3.0 skew rules apply).
5. **Broadcast the small side**; bucket tables that join repeatedly.
6. **Cache only reused, expensive intermediates** — and verify the cache held.
7. **Skew: AQE first, salting when it isn't enough.**
8. Only *then* touch memory/executor sizing.

> **Interview quickfire:** *AQE's three features?* Coalesce shuffle partitions, switch join strategy at runtime, split skewed join partitions (>5× median AND >256 MB). *Why can AQE do what Catalyst can't?* Shuffle boundaries yield real statistics, not estimates. *DPP conditions?* Partitioned fact + broadcastable dim + Spark 3.0+. *Salting in one sentence?* Turn 1 hot key into N sub-keys on the big side, duplicate the small side N×, join on the salted key.
