# Execution Model: DAGs, Stages & Catalyst

Nothing in Spark makes sense until you internalize one idea: **your code doesn't run when you write it**. Spark collects transformations into a plan, optimizes the plan, and only executes when an action forces it to. This chapter is that whole pipeline: transformation → DAG → optimized plan → jobs, stages, tasks.

## Transformations: narrow vs wide

A **transformation** produces a new DataFrame/RDD from an existing one (they're immutable — nothing is modified in place). The classification that drives all performance reasoning:

**Narrow** — each output partition depends on **one** input partition. No data moves between executors.
`filter`, `select`, `map`, `union`, `sample`, `mapPartitions`, `coalesce`*

**Wide** — output partitions need data from **many** input partitions. Rows must be **shuffled** across the network. Expensive.
`groupBy`, `join`, `distinct`, `repartition`, `reduceByKey`, `aggregateByKey`

*`coalesce` merges partitions on the same executor without a full shuffle — that's why it sits in the narrow list despite changing partition count.

Concrete picture — 200 MB of employee data split across 2 executors (128 MB + 72 MB partitions):

```text
Q1: filter(age < 18)              Q2: total income per employee id
─────────────────────             ────────────────────────────────
exec1: filter its partition ✓     id 3 has rows on exec1 AND exec2 —
exec2: filter its partition ✓     matching ids must MOVE to the same
no movement → NARROW              executor first → SHUFFLE → WIDE

                                  exec1 ──(id 3 rows)──▶ exec2
```

## Actions and jobs

Transformations describe; **actions execute**. `count()`, `show()`, `collect()`, `save()` — each action triggers a **job**: every staged transformation runs, executors compute, results flow to the driver.

One trap worth knowing early: `collect()` pulls the **entire dataset into driver memory**. 15 GB of results into a 10 GB driver = driver OOM, job dead. Use `show()` (20 rows) or write to storage instead.

## Lazy evaluation & the DAG

When an action fires, Spark builds a **DAG** (directed acyclic graph) of everything you asked for, per job. Laziness isn't a quirk — it's what makes optimization possible, because **Spark sees your whole program before running any of it**.

```python
df = spark.read.option("header", True).csv("/data/flights")   # job(s): infer schema
df2 = df.repartition(3)                                        # nothing runs
df3 = df2.filter(col("count") > 100)                           # nothing runs
df4 = df3.filter(col("dest") == "USA")                         # nothing runs
df5 = df4.groupBy("origin").sum("count")                       # nothing runs
df5.show()                                                     # NOW the DAG executes
```

Because it sees everything, Spark rewrites it: the two consecutive filters are **combined into one** (`dest = 'USA' AND count > 100`) and executed in a single pass. You wrote two scans' worth of logic; Spark runs one.

(Yes, the `read` with `inferSchema`/`header` triggers a small job of its own — Spark must peek at the file. Lines 2–5 trigger exactly zero.)

## Jobs → stages → tasks

The hierarchy every Spark UI question comes down to:

- **Job** — one per action.
- **Stage** — the DAG is cut **at every shuffle boundary** (wide transformation). Narrow transformations chain together inside a stage.
- **Task** — one per partition per stage. The actual unit of work an executor core runs.

Worked example — count flights per origin:

```python
df = spark.read.csv(path, header=True)      # 1 partition
df = df.repartition(2)                      # wide — shuffle
df = df.filter(col("count") > 500)          # narrow ─┐ same
df = df.select("origin", "dest", "count")   # narrow ─┘ stage
df = df.groupBy("origin").count()           # wide — shuffle
df.collect()                                # action
```

| Job | Stage | What runs | Tasks |
| --- | --- | --- | --- |
| 1 (read w/ header) | s0 | sample file to read header | 1 |
| 2 (collect) | s1 | read | 1 |
| | s2 | repartition output | 2 |
| | s3 | filter + select + groupBy(partial) | 2 |
| | s4 | final aggregation after shuffle | **200** |

**2 jobs, 4 stages (+1 from the header job), 1+1+2+2+200 = ~205 tasks.** Where did 200 come from? **`spark.sql.shuffle.partitions` defaults to 200** — every shuffle produces 200 partitions unless you tune it. On small data most of those 200 tasks are empty overhead; this single default explains half of all "why is my tiny job slow" questions (and AQE, covered later, fixes it automatically).

## The Catalyst optimizer

Between your DataFrame code and those RDD tasks sits the **Spark SQL engine / Catalyst optimizer** — the reason `WHAT you want` (DataFrames/SQL) beats `HOW to do it` (raw RDDs). Four phases:

```text
 SQL / DataFrame / Dataset
        │
        ▼
 ① ANALYSIS            unresolved plan + CATALOG (table/column metadata)
        │              → resolved logical plan.  Column doesn't exist?
        │                AnalysisException happens HERE.
        ▼
 ② LOGICAL OPTIMIZATION  rule-based rewrites: predicate pushdown,
        │                combine filters, prune columns
        ▼
 ③ PHYSICAL PLANNING     generate several physical plans →
        │                COST MODEL picks the cheapest (join strategy!)
        ▼
 ④ CODE GENERATION       compile to Java bytecode → RDDs of the final
                         plan distributed to executors
```

Example of phase ② at work: `SELECT * FROM t` wrapped by `SELECT DISTINCT a, b` collapses into a single scan of just columns `a, b` — the `*` never materializes. Phase ③ is where "which join strategy" gets decided by estimated sizes.

## RDDs: what they are and why you'll rarely touch them

**RDD — Resilient Distributed Dataset** — the low-level abstraction everything compiles down to. *Distributed*: partitions spread across the cluster. *Resilient*: each RDD is immutable and **knows its parent** — lose a partition, and Spark replays the lineage (`100 rows → filter → 60 → filter → 40`; if the 40-row partition dies, recompute from the parent).

Why you write DataFrames instead:

| | RDD API | DataFrame API |
| --- | --- | --- |
| You express | **How** to compute (map, reduceByKey…) | **What** you want |
| Catalyst optimization | ✗ none — Spark runs your steps literally | ✓ full |
| Verbosity (group-avg example) | map → reduceByKey → map | one line |
| Type safety | compile-time (Scala) | runtime |
| Unstructured data (raw text, binaries) | ✓ natural fit | awkward |

The killer detail: with RDDs, if you shuffle *then* filter, Spark **does exactly that** — it cannot reorder your steps. The DataFrame version filters first, because Catalyst is allowed to be smarter than your code. Reach for RDDs only when you truly need row-level control or genuinely unstructured input.

> **Interview quickfire:** *Where does AnalysisException come from?* Phase ① — a name that isn't in the catalog. *Why 200 tasks after a groupBy?* `spark.sql.shuffle.partitions` default. *What defines a stage boundary?* A shuffle (wide transformation). *Why are DataFrames faster than RDDs?* Catalyst can rewrite declarative plans; it can't rewrite your imperative RDD code.
