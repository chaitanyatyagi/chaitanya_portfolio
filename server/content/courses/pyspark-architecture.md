# Architecture & How PySpark Runs

This chapter follows one `spark-submit` from your terminal to five running executors — including the part most tutorials skip: what *actually* happens when the code you submitted is Python.

## Anatomy of a cluster

A worked example we'll keep reusing: a cluster of **10 machines × 100 GB RAM = 1 TB**, managed by YARN. Your job needs a **20 GB driver** and **5 executors × 25 GB × 5 cores**.

```text
                    ┌──────────────────┐
                    │ RESOURCE MANAGER │   (YARN)
                    └────────┬─────────┘
         ┌───────────────────┼─────────────────────┐
         ▼                   ▼                     ▼
   ┌───────────┐      ┌───────────┐         ┌───────────┐
   │ Worker 1  │      │ Worker 2  │   ...   │ Worker 9  │
   │ ┌───────┐ │      │ ┌───────┐ │         │ ┌───────┐ │
   │ │DRIVER │ │      │ │ exec1 │ │         │ │ exec5 │ │
   │ │ 20GB  │ │      │ │ 25GB  │ │         │ │ 25GB  │ │
   │ └───────┘ │      │ │5 cores│ │         │ │5 cores│ │
   └───────────┘      │ └───────┘ │         │ └───────┘ │
                      └───────────┘         └───────────┘
```

- **Driver** — the brain. Runs your `main()`, builds the plan, schedules tasks, collects results.
- **Executors** — JVM processes that execute tasks on partitions of data and report back.
- **Resource manager** — hands out containers (CPU + memory boxes) on workers.

## What happens on spark-submit

Step by step, for `--master yarn`:

1. **The Resource Manager creates one container** (20 GB) on some worker and starts the **Application Master** in it — for Spark, that's your driver.
2. **The driver computes what it needs** — here, 5 executors × 25 GB × 5 cores.
3. **The driver asks the RM** for those containers.
4. **The RM allocates 5 containers** across the workers; Spark starts an **executor JVM** in each.
5. Driver distributes tasks to executors, monitors them, and the job runs.

## Client vs cluster deploy mode

`--deploy-mode` decides **where the driver lives** — a favorite interview follow-up:

| | `client` mode | `cluster` mode |
| --- | --- | --- |
| Driver runs | On the machine you submitted from (edge node, laptop) | Inside a container **on the cluster** |
| If you close your laptop | Job dies with it | Job keeps running |
| Best for | Interactive work — notebooks, spark-shell, debugging | Production jobs |
| Network | Driver↔executor chat crosses into the cluster | All traffic stays inside the cluster |

Rule of thumb: **notebooks are client mode, production is cluster mode.**

## How PySpark really runs

Spark is written in Scala and runs on the JVM. So what executes your Python?

```text
   YOUR PYTHON CODE
        │
        ▼
 ┌────────────────────  DRIVER CONTAINER ───────────────────┐
 │  PySpark driver (Python)  ──py4j──▶  JVM driver (Scala)  │
 │  "a Python wrapper           translates every call        │
 │   around the JVM main()"     into JVM objects             │
 └───────────────────────────────┬───────────────────────────┘
                                 ▼
                     executors (pure JVM)  ← DataFrame ops
                     run entirely here — no Python involved
```

- Your `main()` is a **Python wrapper**; through **py4j** every PySpark call manipulates a mirrored **JVM driver**. The plan that ships to executors is pure JVM code.
- For built-in DataFrame operations (`select`, `filter`, `groupBy`, joins…), **Python never touches the data**. PySpark and Scala Spark run at effectively the same speed.

**The exception: Python UDFs.** If you use a Python UDF, each executor must spin up a **Python worker process next to the JVM** and pump rows across: serialize row → send to Python → run your function → serialize result → send back to JVM. Two serialization hops per row, and Catalyst can't see inside your function to optimize it. That's the real reason "avoid Python UDFs" is a rule — not superstition. (Full UDF chapter later covers `pandas_udf`, the mitigation.)

## SparkSession vs SparkContext

Before Spark 2.0 you juggled separate entry points: `SparkContext` (core/RDDs), `SQLContext`, `HiveContext`, `StreamingContext`. **SparkSession unified them** — it's the single entry point, and it *contains* a SparkContext (`spark.sparkContext`).

```python
from pyspark.sql import SparkSession

spark = (
    SparkSession.builder
    .master("local[5]")            # 5 cores locally; "yarn" on a cluster
    .appName("testing_app")
    .config("spark.driver.memory", "12g")
    .getOrCreate()                 # reuse the session if one exists
)
```

`getOrCreate()` matters: sessions are meant to be singletons per application — in notebooks it silently returns the existing one, which is why late `.config()` changes sometimes don't take effect.

## A production spark-submit, annotated

```bash
spark-submit \
  --name customer_pipeline \
  --master yarn \
  --deploy-mode cluster \
  --conf spark.dynamicAllocation.enabled=true \
  --conf spark.dynamicAllocation.minExecutors=5 \
  --conf spark.dynamicAllocation.maxExecutors=49 \
  --conf spark.dynamicAllocation.shuffleTracking.enabled=true \
  --conf spark.dynamicAllocation.executorIdleTimeout=45s \
  --conf spark.dynamicAllocation.schedulerBacklogTimeout=2s \
  --conf spark.executor.memory=20g \
  --conf spark.executor.cores=4 \
  --conf spark.driver.memory=20g \
  --py-files dependencies.zip \
  main.py
```

Do the arithmetic before you submit — interviewers do: at the max, this job holds **49 executors × 20 GB + 20 GB driver ≈ 1 TB of RAM** and **49 × 4 = 196 cores**. If a colleague then submits a job asking for 25 GB on the same queue, **they wait** — the resource manager is FIFO by default, and you've taken the cluster. The caching-and-resources chapter covers dynamic allocation, which exists precisely to fix this.

> **Interview quickfire:** *Where does the driver run in cluster mode?* In a container on the cluster — submit machine can disconnect. *Is PySpark slower than Scala Spark?* Not for DataFrame ops (all JVM); only Python UDFs pay a serialization penalty. *What replaced SQLContext/HiveContext?* SparkSession, since 2.0.
