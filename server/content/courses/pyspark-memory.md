# Memory Management

"Container killed by YARN for exceeding memory limits." "java.lang.OutOfMemoryError: Java heap space." Every Spark engineer meets these, and fixing them by blindly doubling `executor.memory` is the mark of a junior. This chapter builds the actual memory map — driver and executor — so OOMs become diagnosable instead of mystical.

## Driver memory: two budgets, not one

The driver container holds **two** separately-configured pieces:

| Setting | What lives there |
| --- | --- |
| `spark.driver.memory` | The JVM heap — collected results, query plans, broadcast variables before shipping, JVM GC overhead |
| `spark.driver.memoryOverhead` | Off-heap: `max(10% of driver memory, 384 MB)` — Python driver processes (PySpark!), native libs, network buffers |

The classic driver OOM: `df.collect()` on a 15 GB result with a 10 GB driver heap. `collect()` materializes **everything** on the driver; `show()` fetches 20 rows. In PySpark the overhead partition matters more than people think — your Python process lives *there*, not in the JVM heap.

## Executor container layout

What YARN actually allocates per executor is **container = executor memory + overhead**:

```text
YARN CONTAINER for one executor (spark.executor.memory = 10 GB)
┌─────────────────────────────────────────────────┐
│  memoryOverhead  max(10%, 384MB)  ≈ 1 GB        │  off-heap: Python
│                                                  │  workers, shuffle
├──────────────── JVM HEAP (10 GB) ───────────────┤  buffers, native
│                                                  │
│  ① RESERVED — 300 MB flat                        │  Spark internals
│  ─────────────────────────────────────────────   │
│  ② USER MEMORY — 40% of (heap − 300MB) ≈ 3.9 GB  │  your objects: UDF
│                                                  │  data structures,
│  ─────────────────────────────────────────────   │  custom hashmaps,
│  ③ SPARK (UNIFIED) MEMORY — 60% ≈ 5.8 GB         │  RDD-op closures
│     ┌──────────────────┬──────────────────┐      │
│     │  STORAGE  50%    │  EXECUTION  50%  │      │
│     │  cache/persist,  │  join hash tabl.,│      │
│     │  broadcast vars  │  shuffle & sort  │      │
│     │  (long-lived,    │  buffers, aggs   │      │
│     │   LRU-evicted)   │  (short-lived,   │      │
│     │                  │   spill to disk) │      │
│     └──────────────────┴──────────────────┘      │
└─────────────────────────────────────────────────┘
```

Walking the numbers for `spark.executor.memory=10g`: reserved 300 MB (fixed — and Spark refuses to start an executor smaller than ~1.5× reserved); user memory (10240−300) × 0.4 ≈ 3976 MB; unified Spark memory (10240−300) × 0.6 ≈ **5964 MB**, split 50/50 into storage and execution pools (`spark.memory.fraction=0.6`, `spark.memory.storageFraction=0.5`).

The two pools have opposite personalities: **storage** holds long-lived cached blocks and evicts by **LRU** when full; **execution** holds short-lived working state (hash tables for joins/aggregations, sort buffers) and **spills to disk** when full rather than evicting.

## Static vs unified memory manager

Before Spark 1.6, the storage/execution wall was **static** — a job doing heavy shuffles with nothing cached still couldn't touch the idle storage half. The **Unified Memory Manager** made the wall soft:

- Execution can **borrow** unused storage memory, and vice versa.
- If storage borrowed execution's space and execution needs it back, **cached blocks get evicted** — execution's claim wins (it can't make progress otherwise; a cache can always be recomputed).
- Execution memory in active use is never stolen for caching.

This is why "my cached DataFrame keeps disappearing" during shuffle-heavy jobs isn't a bug — it's the design.

## The OOM that spilling can't save

"Execution memory spills to disk — so how does an executor still OOM?" A senior-level answer:

**Spill granularity is per-partition-ish, not per-row.** Operations need certain working structures wholly in memory — one skewed partition's hash-aggregation table, one giant row group, one monster `groupBy` key's buffer. If a **single partition** is bigger than what the execution pool can offer, there is no half-spill that saves you:

```text
executor execution pool:  2.9 GB
partition sizes:  [180MB, 200MB, 190MB, 6GB ← skew, 185MB]
                                        └── cannot fit, cannot
                                            partially spill → OOM
```

The fix is never "more memory" first — it's **make the partitions smaller**: `repartition()` to more/evener partitions, fix the skewed key (salting — optimization chapter), or increase `spark.sql.shuffle.partitions`. Other frequent OOM culprits, mapped to their region: fat Python UDFs → **overhead** (raise `memoryOverhead`, not heap!); giant collected results / broadcasting a big table → **driver**; caching too much MEMORY_ONLY → storage pressure and eviction churn rather than OOM.

## Sizing cheat-sheet

| Symptom | Region to suspect | First move |
| --- | --- | --- |
| Driver OOM on collect | Driver heap | Stop collecting; write out or aggregate first |
| "Container killed by YARN" (exit 137) | **Overhead**, not heap | Raise `spark.executor.memoryOverhead` (PySpark UDFs are the usual cause) |
| Executor heap OOM in a join/groupBy | Execution pool, one fat partition | Repartition / fix skew / more shuffle partitions |
| Cache keeps re-computing | Storage evicted by execution | Persist `MEMORY_AND_DISK`, cache less, or accept it |
| Everything slow, much disk I/O | Spilling constantly | More executor memory *or* fewer concurrent cores per executor |

One last sizing rule of thumb: 3–5 cores per executor. More cores share one heap — 8+ cores per executor means 8 tasks fighting for the same execution pool, multiplying spill and OOM odds.

> **Interview quickfire:** *Executor memory regions?* Reserved 300 MB, user 40%, unified 60% → storage + execution 50/50 with mutual borrowing (unified manager). *Storage vs execution under pressure?* Storage evicts LRU; execution spills to disk. *Spilling exists — why OOM?* A single oversized (skewed) partition's working set can't partially spill. *YARN killed my container but heap was fine?* Overhead exhausted — classic PySpark UDF symptom.
