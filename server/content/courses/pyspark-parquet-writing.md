# Parquet & Writing Data

"Why is Parquet Spark's default format?" is a guaranteed interview question, and the good answer goes three levels deep: the columnar layout, the encodings, and the metadata that lets Spark **skip reading data entirely**. Then we cover the write side — modes, `partitionBy`, `bucketBy` — where layout decisions you make once get paid for (or paid back) on every future read.

## Row vs columnar storage

How records `(id, name, age)` physically sit on disk:

```text
ROW-ORIENTED  (CSV, Avro, OLTP databases)
│ 1 │ kapil │ 28 │ 2 │ satish │ 35 │ 3 │ riya │ 41 │ ...
  → whole records adjacent. Great for "fetch record 2",
    INSERT-heavy OLTP. Bad when you need 2 of 100 columns.

COLUMN-ORIENTED
│ 1 │ 2 │ 3 │ ... │ kapil │ satish │ riya │ ... │ 28 │ 35 │ 41 │
  → column values adjacent. "SELECT avg(age)" reads ONLY
    the age bytes. Analytics (OLAP) native.
```

## Parquet's hybrid layout

Pure columnar has a flaw at scale: to reassemble one row you'd seek across the entire file. Parquet is a **hybrid**: rows are first cut into **row groups** (default 128 MB), and *within* each row group, data is stored column by column:

```text
FILE
├── Row Group 0           (~128 MB of rows)
│   ├── Column chunk: id      ├─ page │ page │ page
│   ├── Column chunk: name    ├─ page │ page
│   └── Column chunk: age     └─ page │ page
├── Row Group 1
│   └── ...
└── FOOTER  — the metadata brain:
      schema, and per row-group / per column-chunk:
      type · path · encoding · codec · num values ·
      offsets · sizes · MIN / MAX statistics
```

Pages (~1 MB) are the unit of encoding/compression; each carries a small header plus repetition & definition levels (how Parquet represents nesting and nulls). The **footer** is why Parquet is "self-describing" — schema travels with the data, and those min/max stats power the magic below.

## Encodings & compression

Parquet compresses brilliantly because *values in one column look alike*:

- **Dictionary encoding** — column stores `{0: "India", 1: "USA"}` + tiny integer refs instead of repeating strings millions of times.
- **RLE (run-length encoding)** — `aaabbbbbccd` → `a3 b5 c2 d1`. Devastatingly effective on sorted or low-cardinality columns.
- **Bit packing** — values that fit in 3 bits use 3 bits, not 32.

On top of encoding, each page is compressed with a codec — **Snappy** (default: fast, decent ratio), GZIP (smaller, slower), ZSTD/LZO. Encoding + columnar layout is why a 1 GB CSV routinely becomes a ~100 MB Parquet file.

## The two prunings — reading less instead of reading faster

**Projection pruning** — need 2 columns of 100? Column chunks are contiguous, so Spark reads only those chunks. Row formats can't do this at all.

**Predicate pushdown** — the filter travels down to the file scan and uses the footer's **min/max stats to skip whole row groups**. The canonical example: 1.4 billion Aadhaar-style records, query `WHERE age < 18`. A row group whose footer says `age: min 22, max 85` **cannot contain a match — Spark never reads it.** No index, no scan: the metadata answered.

```python
spark.read.parquet(path).select("id", "age").filter(col("age") < 18)
#          projection pruning ──┘            predicate pushdown ──┘
```

This combination — not just compression — is the real answer to "why Parquet".

## The DataFrameWriter

```python
(
    df.write
    .format("parquet")
    .mode("overwrite")             # append | overwrite | errorIfExists | ignore
    .option("compression", "snappy")
    .save("/data/out/employees/")
)
```

| Mode | Behavior |
| --- | --- |
| `append` | Add new files alongside existing |
| `overwrite` | Delete target, write fresh |
| `errorIfExists` *(default)* | Fail if the path exists |
| `ignore` | Silently skip the write if target exists |

## partitionBy — directory-level pruning

```python
df.write.partitionBy("country", "state").parquet("/data/sales/")
```

```text
/data/sales/country=IN/state=UP/part-....parquet
/data/sales/country=IN/state=DL/part-....parquet
/data/sales/country=US/state=CA/part-....parquet
```

A query filtering `country = 'IN'` never lists the other directories — partition pruning before a single byte is read. Two rules: **order matters** (filter-by-country-then-state wants `partitionBy("country","state")`, not the reverse), and **never partition by high-cardinality columns** (partitioning by `user_id` creates millions of directories — that's what bucketing is for).

## bucketBy — pre-shuffling your data at write time

Partitioning by a high-cardinality key is impossible; **bucketing** hashes the key into a fixed number of files: `hash(id) % 3` → bucket 0/1/2.

```python
(
    df.repartition(3)                       # ← see gotcha below
      .write
      .bucketBy(3, "id")
      .sortBy("id")
      .mode("overwrite")
      .saveAsTable("emp_bucketed")           # needs a table (metastore), not save(path)
)
```

Why bother? Two payoffs:

1. **Shuffle-free joins.** Two tables bucketed on the join key into the same bucket count are already co-located by key — the sort-merge join runs with **no shuffle at all**. Bucket once at write, save the shuffle on every subsequent join.
2. **Bucket pruning.** Looking for `id = 12345` in 1B rows across 100 buckets? `hash(12345) % 100` names the one file that can contain it — scan ~10M rows, not 1B.

**The file-explosion gotcha:** each of your job's partitions writes its own file *per bucket*. Writing 200 partitions × 5 buckets = **1000 files**. `repartition(n_buckets)` (or by the bucket column) first → exactly one file per bucket.

## The small-file problem

The write-side disease every data engineer meets: a streaming job or an over-partitioned batch writes thousands of KB-sized files. Each file costs a listing call, an open, a footer read, and a task — a 10 GB dataset in 100,000 files can be slower to read than a 100 GB dataset in 800 files. Prevention and cure:

```python
df.repartition("event_date").write.partitionBy("event_date")...   # ~1 file per partition dir
df.coalesce(64).write...                                          # cap output file count
spark.read.parquet(messy_path).repartition(256).write...          # periodic compaction job
```

Aim for output files in the **128 MB–1 GB** range — aligned with row-group and HDFS/object-store block sizes.

> **Interview quickfire:** *Why Parquet?* Columnar row-groups + dictionary/RLE encodings + footer min/max → projection pruning **and** predicate pushdown. *How does Spark skip a row group?* Footer min/max vs the predicate. *partitionBy vs bucketBy?* Directories for low-cardinality filters vs hashed files for high-cardinality keys & shuffle-free joins. *Why did bucketBy(5) make 1000 files?* 200 shuffle partitions × 5 buckets — repartition first.
