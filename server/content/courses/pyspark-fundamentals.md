# Spark Fundamentals

Apache Spark is a **unified computing engine and a set of libraries for parallel data processing on compute clusters**. Every word in that definition is doing work, and interviewers love to pull on each one — so let's unpack it properly before touching any code.

## What "unified computing engine" actually means

**Unified** — one engine, many workloads. The same Spark cluster (and largely the same API) handles batch ETL, SQL analytics, streaming, machine learning, and graph processing. Before Spark you stitched together separate systems for each.

**Computing engine** — Spark *computes*; it does **not store**. It has no storage layer of its own. Instead it connects to wherever your data already lives:

```text
                ┌───────────────────────────┐
                │      APACHE SPARK          │
                │   (compute only — no       │
                │    storage of its own)     │
                └────────────┬──────────────┘
        ┌──────────┬─────────┼──────────┬───────────┐
        ▼          ▼         ▼          ▼           ▼
      HDFS       S3 /      JDBC /     Kafka      Delta /
                 GCS       ODBC                  Iceberg
```

**Cluster** — a group of machines working as one, in a master/slave arrangement. One driver coordinates; many executors do the work. This is what lets you process 5 TB of data on machines that individually have only 16 GB of RAM — the data is split up and processed **in parallel**.

## MapReduce — the ancestor

Spark's design is a reaction to Hadoop MapReduce, so you need the basics. MapReduce processes data in three phases: **map** (emit key-value pairs), **shuffle** (group identical keys together), **reduce** (aggregate per key).

The classic word count:

```text
INPUT              MAP                 SHUFFLE            REDUCE
─────              ───                 ───────            ──────
"spark is fast"    (spark,1)(is,1)     (spark,[1,1])      (spark,2)
"spark is easy" →  (fast,1)(spark,1) → (is,[1,1])       → (is,2)
                   (is,1)(easy,1)      (fast,[1])         (fast,1)
                                       (easy,[1])         (easy,1)
```

The ideas MapReduce pioneered — and Spark kept — are worth stating explicitly:

- **Move the code to the data**, not the data to the code. The map program is shipped to the node holding the block; a distributed file system means no bulk data movement to a central processor.
- **Key-value structure** makes distributed grouping possible.
- **Machine failure is expected**, not exceptional — a failed stage is simply re-performed. Tasks are idempotent, so re-running them is safe.

## Hadoop vs Spark — the honest comparison

Three misconceptions to clear up first, because they're common interview bait:

1. **"Hadoop is a database."** No — it's a distributed file system (HDFS) plus a processing framework (MapReduce) plus a resource manager (YARN).
2. **"Spark is 100× faster than Hadoop."** That number comes from a specific in-memory iterative benchmark. If your job reads 10 GB from a single disk, does one pass, and writes it back, the difference is unspectacular. Spark's edge shows on **multi-step pipelines** where MapReduce would write to disk between every stage.
3. **"Spark uses RAM but Hadoop doesn't."** MapReduce uses RAM too — everything computes in RAM. The difference is that MapReduce **persists intermediate results to disk after each map/reduce round**, while Spark keeps intermediates **in executor memory across stages** whenever it can.

| Dimension | Hadoop MapReduce | Spark |
| --- | --- | --- |
| **Performance** | Writes to disk between every MR iteration | Keeps intermediates in memory across executor stages |
| **Workloads** | Batch only | Batch **and** streaming |
| **Ease of use** | Hard — verbose Java; Hive was invented to soften it | Interactive shells, high- and low-level APIs, four languages |
| **Security** | Mature — Kerberos + ACLs | No solid built-in story; relies on HDFS/YARN Kerberos underneath |
| **Fault tolerance** | Replication — every 128 MB block copied to multiple nodes | Lineage — DAG + immutable RDDs let any lost partition be recomputed |

The fault-tolerance row deserves emphasis: Hadoop pays for safety with **storage** (replication factor 3 = 3× disk), Spark pays with **potential recomputation** (lost partition → replay the lineage that produced it). Neither is free.

## The Spark ecosystem

```text
┌───────────────────────────────────────────────────────────┐
│                 HIGH-LEVEL LIBRARIES                       │
│  Spark SQL /        Structured      MLlib      GraphX     │
│  DataFrames         Streaming                              │
├───────────────────────────────────────────────────────────┤
│                     SPARK CORE                             │
│      Python  ·  Scala  ·  Java  ·  R      →      RDD       │
├───────────────────────────────────────────────────────────┤
│                    SPARK ENGINE                            │
│   scheduling · memory management · fault recovery · I/O    │
└───────────────────────────────────────────────────────────┘
```

Everything you write — SQL, DataFrame code, streaming queries, ML pipelines — funnels down to the same core and engine. That's the "unified" promise made concrete: learn the execution model once and it explains every library above it.

## Cluster managers

Spark doesn't manage cluster resources itself; it asks a **cluster manager** for containers. Four options:

| Manager | When you'll meet it |
| --- | --- |
| **YARN** | The classic Hadoop-ecosystem choice; most on-prem and EMR/Dataproc clusters |
| **Kubernetes** | The modern default for cloud-native deployments |
| **Standalone** | Spark's built-in manager; simple clusters and local labs |
| **Mesos** | Legacy — deprecated, but still name-dropped in interviews |

## Where PySpark fits

PySpark is the **Python API over Spark's JVM core** — you write Python, Spark executes on the JVM. For DataFrame operations this costs almost nothing, because your Python code is just *describing* a plan that runs entirely in the JVM. The costs appear when actual Python execution gets involved (UDFs) — we cover exactly how that works in the architecture chapter.

> **Interview quickfire:** *Is Spark a database?* No — a compute engine with no storage. *Why is Spark faster than MapReduce?* In-memory intermediates across stages vs disk writes between every iteration — not a blanket "100×". *How does Spark achieve fault tolerance without replication?* Immutable RDDs + DAG lineage: recompute lost partitions instead of storing copies.
