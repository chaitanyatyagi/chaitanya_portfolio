# Joins & Join Strategies

Joins are where Spark jobs go to die — they're the most shuffle-heavy, skew-sensitive operation in the engine. This chapter covers the API, then the part that decides whether your join takes minutes or hours: **how Spark physically executes it**, and how to influence that choice.

## The join API

```python
joined = df_emp.join(
    df_dept,
    df_emp["dept_id"] == df_dept["id"],    # join expression
    "inner",                                # join type
)

# Multi-condition — parenthesize each clause
joined = df1.join(
    df2,
    (df1["id"] == df2["emp_id"]) & (df1["region"] == df2["region"]),
    "left",
)
```

After a join, duplicate column names become ambiguous — resolve with the `df["col"]` form (`df_emp["dept_id"]`), or `.alias("e")` each side and reference `col("e.dept_id")`.

## Join types

| Type | Keeps |
| --- | --- |
| `inner` | Only matching rows from both sides |
| `left` / `right` | All rows from that side; nulls where no match |
| `outer` (full) | Everything from both sides |
| `cross` | Cartesian product — every pair (be very sure) |
| `left_semi` | Left rows **that have a match** — left's columns only |
| `left_anti` | Left rows **with no match** — the "NOT IN" join |

Semi and anti are the underrated ones, and they're better than the naive alternatives: `left_semi` is an EXISTS filter that never duplicates left rows even when the right side has multiple matches, and `left_anti` is *the* idiom for "find records missing from the other table" — new customers, unprocessed events, referential-integrity checks:

```python
new_customers = sales_df.join(dim_df, sales_df["customer_id"] == dim_df["id"], "left_anti")
```

## What a join physically requires

For any two rows to be joined, they must be **in the same place at the same time**. With both DataFrames scattered across executors, Spark's default move is to shuffle **both sides** by the join key — `hash(key) % 200` (that `spark.sql.shuffle.partitions` default again) — so all rows with the same key land in the same partition:

```text
   df1 partitions            df2 partitions
   ┌────┐ ┌────┐             ┌────┐ ┌────┐
   │k1,k3│ │k2,k4│           │k2,k3│ │k1,k4│
   └──┬──┘ └──┬──┘           └──┬──┘ └──┬──┘
      └───────┴──── SHUFFLE ────┴───────┘
                hash(key) % 200
      ┌────────┐  ┌────────┐  ┌────────┐
      │ k1: df1│  │ k2: df1│  │ k3: df1│ ...
      │     df2│  │     df2│  │     df2│   ← co-located, now joinable
      └────────┘  └────────┘  └────────┘
```

Two full network shuffles before any matching begins — that's the cost you're trying to avoid or shrink with everything that follows.

## The five join strategies

Catalyst's physical planner (cost model) picks one of five:

**1. Shuffle sort-merge join — the default.** Shuffle both sides, **sort** each partition by key, merge the sorted streams (O(n log n) for the sort, then a linear zip). Robust at any scale, spills gracefully to disk. When keys are equi-join and no side is broadcastable, this is what you get.

**2. Shuffle hash join.** Shuffle both sides, then instead of sorting, **build a hash table from the smaller side** in memory and probe it with the larger (O(1) lookups, no sort). Faster when one side per-partition comfortably fits in memory — but the hash table lives in execution memory, so it's less forgiving than sort-merge.

**3. Broadcast hash join — the one you tune for.** If one table is small, skip shuffling the big table entirely: ship a full copy of the small table to **every executor** and hash-join locally. **Zero shuffle of the large side.**

```python
from pyspark.sql.functions import broadcast

result = big_facts.join(broadcast(small_dim), "dept_id")
```

- Auto-triggers when a side is under **`spark.sql.autoBroadcastJoinThreshold`** (default 10 MB); set to `-1` to disable.
- The flow: small table is collected **to the driver**, then re-sent to each executor — so the costs are: driver memory (it must hold the table), network transfer (one copy per executor), and executor memory (each holds the full copy). Broadcasting a "small" 2 GB table to 100 executors is 200 GB of network traffic and a likely driver OOM. Broadcast is for genuinely small dimensions.

**4. Cartesian join** — every row × every row. Only for explicit `cross` joins.

**5. Broadcast nested loop join** — the fallback for **non-equi joins** (`df1.a > df2.b`): broadcast one side, loop-compare everything. Brutally slow; if you see it in a plan you didn't expect, your join condition probably isn't an equality.

## Choosing (and verifying) a strategy

| Situation | Expect / do |
| --- | --- |
| Big ⋈ small (< ~10 MB, or you know it's small) | Broadcast hash — hint it explicitly |
| Big ⋈ big, equi-join | Shuffle sort-merge (default is right) |
| Big ⋈ big, both bucketed on the key | Shuffle-free sort-merge (see Parquet chapter) |
| Non-equi condition | Broadcast nested loop — redesign if possible |
| One side skewed | AQE skew handling / salting (optimization chapter) |

Always confirm with the plan — `joined.explain()` — and look for `BroadcastHashJoin` vs `SortMergeJoin` rather than trusting assumptions. AQE (covered later) can even **switch the strategy at runtime** when a side turns out smaller than estimated after filters.

> **Interview quickfire:** *Default join strategy?* Shuffle sort-merge. *When broadcast?* One side under the 10 MB threshold or hinted; watch driver + executor memory and transfer cost. *left_semi vs inner?* Semi returns left columns only and never duplicates on multiple matches. *Why is my join a BroadcastNestedLoopJoin?* Non-equi condition. *How do rows with equal keys meet?* Both sides shuffled with hash(key) % shuffle.partitions.
