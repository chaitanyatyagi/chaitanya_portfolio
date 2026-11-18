# Caching, Persist & Resource Allocation

Two levers for not wasting the cluster: **caching** (don't recompute what you'll reuse) and **dynamic resource allocation** (don't hold executors you aren't using). Both look like free wins; both have failure modes that this chapter spells out.

## Why cache — the recomputation chain

Executor memory is **short-lived**: intermediate results are cleared after each operation. So when you branch off one DataFrame repeatedly:

```python
df  = spark.read.format("csv").option(...).load(path)   # expensive read + parse
df1 = df.filter(...)         # ── each of these walks the DAG
df2 = df.groupBy(...)        # ── ALL THE WAY BACK to the file read.
df3 = df.join(...)           # ── 4 reuses = the read + parse
df4 = df.select(...)         # ── executed 4 separate times
```

Lineage-based recomputation is Spark's fault-tolerance superpower and its performance tax. `cache()` converts the repeated recomputation into one materialization:

```python
df = spark.read.format("csv").option(...).load(path).cache()
df.count()          # ← an ACTION actually populates the cache (cache is lazy!)
```

Cached blocks live in the **storage memory pool** (see memory chapter). What if it doesn't all fit? Example: `df` is 2 GB in 15 partitions; storage memory can hold 12 partitions. With the default level, 12 partitions sit in memory and 3 go to disk. Note that caching is **per-partition all-or-nothing** — a partition is either fully cached or not at all.

## cache vs persist & storage levels

`cache()` is just `persist(StorageLevel.MEMORY_AND_DISK)` — persist is the same machinery with a choice of level:

```python
from pyspark import StorageLevel
df.persist(StorageLevel.MEMORY_ONLY)
df.unpersist()                          # release it when done
```

| Level | Where | Form | Trade-off |
| --- | --- | --- | --- |
| `MEMORY_ONLY` | RAM only | deserialized | Fastest reads; what doesn't fit is **recomputed** each use; highest memory use |
| `MEMORY_AND_DISK` *(default)* | RAM, spill rest to disk | disk part serialized | Balanced; disk reads pay CPU to deserialize |
| `MEMORY_ONLY_SER` | RAM | serialized | Smaller (e.g. 8 GB → 5 GB) but CPU-heavy reads — **Scala/Java only** |
| `MEMORY_AND_DISK_SER` | both | serialized | Same idea — **Scala/Java only** |
| `DISK_ONLY` | disk | serialized | Slowest; cheaper than recompute only for very expensive lineage |
| `MEMORY_ONLY_2` | RAM ×2 nodes | deserialized | Replicated — survives an executor/node loss |

Why the `_SER` levels don't exist in PySpark: Python objects are **always stored serialized** anyway, so the distinction is meaningless there. And the vocabulary: **serialization** = object → byte stream (compact, transmittable); **deserialization** = bytes → object Spark can operate on. Serialized = less memory, more CPU.

**When NOT to cache** (as important as when to): the DataFrame is used once; the dataset is small/cheap to recompute; memory is tight — a cache that evicts productive execution memory, or that gets LRU-evicted before its second use, is pure cost. Cache at the point of **reuse of something expensive**, verify in the Spark UI's Storage tab that it actually stayed cached, and `unpersist()` when you're done.

## Static allocation and the FIFO problem

Recall the production submit: 49 executors × 20 GB grabbed at startup. With **static allocation** those resources are blocked for the job's whole lifetime — *running or idle doesn't matter*:

```text
Cluster queue (FIFO):
  dev1 → 200 GB   ┐
  dev2 → 300 GB   ├── holding resources, partly idle
  dev3 → 500 GB   ┘
  dev4 → WAITING… (asks others to release, cluster "full" of idle memory)
```

A job that needs 1000 GB during its first heavy stage but 400 GB afterwards still holds 1000 GB to the end. That's the problem **dynamic resource allocation** solves: release when idle, re-request when needed.

## Dynamic resource allocation

```bash
--conf spark.dynamicAllocation.enabled=true
--conf spark.dynamicAllocation.minExecutors=5
--conf spark.dynamicAllocation.maxExecutors=49
--conf spark.dynamicAllocation.executorIdleTimeout=45s
--conf spark.dynamicAllocation.schedulerBacklogTimeout=2s
--conf spark.dynamicAllocation.shuffleTracking.enabled=true
```

**When Spark releases:** an executor idle past `executorIdleTimeout` (60 s default) is returned to the cluster.

**When Spark asks:** if tasks queue past `schedulerBacklogTimeout`, Spark requests executors — **exponentially**: 2, then 4, then 8… each round doubling until the backlog clears or `maxExecutors` caps it.

**The risk scenario** — why `minExecutors` matters: your job releases 750 GB after stage 1; another team's job grabs it; your stage 2 needs it back and **can't get it** — you're now queued behind others on a cluster you "had". `minExecutors` is the floor you never give away.

## External shuffle service — the reason releasing is even safe

Killing an executor destroys its JVM — including the **shuffle files and cached blocks** it held. Downstream stages that needed those shuffle outputs would trigger recomputation, erasing the savings. The **External Shuffle Service** fixes this: a small daemon **on each worker node, independent of any executor**, that serves shuffle files. Executors write shuffle data through it; when an executor is released, its shuffle output **survives on the node** and stages downstream read on unbothered. (On Kubernetes, where an ESS isn't available, `shuffleTracking.enabled` is the alternative — Spark simply avoids releasing executors that still hold live shuffle data.)

**When to avoid dynamic allocation:** strict-SLA critical production jobs. The re-acquisition gamble (stage 2 might wait for resources that were released) is a fine trade for ad-hoc and shared-cluster workloads, a poor one for the 2 a.m. pipeline the morning dashboards depend on — there, static sizing is predictable.

> **Interview quickfire:** *cache vs persist?* `cache()` = `persist(MEMORY_AND_DISK)`. *Why no MEMORY_ONLY_SER in PySpark?* Python data is always serialized. *Is cache() eager?* No — first action materializes it. *How does dynamic allocation decide?* Idle-timeout to release, exponential (2→4→8) backlog-triggered requests to grow. *Why does releasing executors not lose shuffle data?* External Shuffle Service holds it on the worker node.
