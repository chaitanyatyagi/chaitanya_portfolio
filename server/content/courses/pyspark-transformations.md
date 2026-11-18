# DataFrame Transformations

The daily-driver API: selecting, filtering, deriving columns, deduplicating, unioning, aggregating, and controlling partitions. Individually simple — but each has a sharp edge (union's positional matching, `count()`'s null behavior, `coalesce`'s skew) that this chapter calls out explicitly.

## Creating DataFrames in tests

You'll constantly need small DataFrames to prototype against:

```python
from pyspark.sql import Row

data = [(1, "kapil", 28), (2, "satish", 35), (3, None, 41)]
df = spark.createDataFrame(data, schema="id INT, name STRING, age INT")
```

## Five ways to select (and when each matters)

```python
from pyspark.sql.functions import col, expr

df.select("id", "name")                        # plain strings
df.select(col("id"), col("name"))              # col() — needed for .cast(), .alias(), .desc()
df.select(df["id"], df.name)                   # bracket / attribute — disambiguates in joins
df.select(expr("id AS emp_id"))                # expr() — SQL inside the API
df.selectExpr("id AS emp_id", "age + 1 AS age_next")   # shorthand for many exprs
```

They're interchangeable until they aren't: `col()` unlocks column methods, `df["x"]` resolves ambiguity after joins, and `expr()` lets you drop into SQL for things like `concat(first_name, ' ', last_name)` without importing a dozen functions.

## Filtering

`filter` and `where` are aliases. Compound conditions need **`&` / `|` with parentheses** (Python's `and`/`or` don't work on columns):

```python
df.filter((col("age") > 25) & (col("salary") >= 50000))
df.where(col("dept").isin("DE", "DS") | col("name").isNull())
```

## Adding, renaming, casting, dropping

```python
from pyspark.sql.functions import lit

df2 = (
    df.withColumn("country", lit("India"))            # constant needs lit()
      .withColumn("age", col("age").cast("string"))   # cast in place
      .withColumnRenamed("name", "full_name")
      .drop("obsolete_col")
)
```

`lit()` trips up beginners: `withColumn("country", "India")` fails because the second argument must be a *Column* — `lit` wraps a literal into one.

## Deduplication and sorting

```python
df.distinct()                          # exact duplicate rows
df.dropDuplicates(["id", "name"])      # duplicates by a subset of columns
df.sort(col("salary").desc(), col("age").asc())   # multi-priority sort
```

`dropDuplicates` on a subset keeps an **arbitrary** row from each group — if you need "the latest row per key", that's a window function (`row_number` + filter), covered in the window chapter.

## Union — the positional trap

In the DataFrame API, `union` and `unionAll` are **the same thing**: no dedup, and — the trap — matching is **by position, not by name**:

```python
df1: (id, name, age)
df2: (id, age, name)          # same columns, different order!

df1.union(df2)                # ✗ silently puts age under name — garbage data
df1.unionByName(df2)          # ✓ matches by column name
```

Two related interview facts: **SQL's `UNION` deduplicates** (unlike the DataFrame API's `union`), and `unionByName(df2, allowMissingColumns=True)` handles schema drift by null-filling.

## Conditional logic: when / otherwise

```python
from pyspark.sql.functions import when

df.withColumn(
    "age_band",
    when(col("age") < 18, "minor")
    .when((col("age") >= 18) & (col("age") < 60), "adult")
    .when(col("age").isNull(), "unknown")        # nulls fail every other branch!
    .otherwise("senior"),
)
```

Remember null semantics: `null < 18` evaluates to null (falsy), so **null rows fall through every `when`** into `otherwise` unless you catch them explicitly with `isNull()`.

## Aggregations — and count()'s split personality

```python
from pyspark.sql.functions import count, sum, avg, max, min

df.count()                                  # ACTION — returns a number now
df.select(count("*"))                       # TRANSFORMATION — lazy, returns a DataFrame

df.select(count("name"))                    # skips NULLs in name
df.select(count("*"))                       # counts every row, nulls included

df.groupBy("dept").agg(
    sum("salary").alias("total_comp"),
    avg("salary").alias("avg_comp"),
    count("*").alias("headcount"),
)
```

Two distinct gotchas hiding in `count`: (1) `df.count()` is an eager **action** while `select(count(...))` is a lazy **transformation**; (2) `count("column")` **ignores nulls**, `count("*")` doesn't — a one-word difference that changes results.

## repartition vs coalesce

Both change partition count; they are not interchangeable.

| | `repartition(n)` | `coalesce(n)` |
| --- | --- | --- |
| Mechanism | **Full shuffle** — every row re-dealt | **Merge** neighboring partitions on the same executor |
| Direction | Up or down | Down only |
| Result balance | Even partitions | Can be **uneven** (merging preserves lumps) |
| Cost | Expensive | Cheap |

```python
df.repartition(8)                    # rebalance 8 even partitions (shuffle)
df.repartition(8, col("dept"))       # partition BY a column
df.coalesce(1)                       # cheap collapse, e.g. before a single-file write

from pyspark.sql.functions import spark_partition_id
df.groupBy(spark_partition_id()).count().show()   # inspect the actual distribution
```

The decision rule: **shrinking a lot at the end of a job → `coalesce`** (avoid a pointless shuffle); **fixing skew or increasing parallelism → `repartition`** (the shuffle is the point — it's what evens the data out). Using `coalesce` to "fix" skew makes skew *worse*, because it merges without rebalancing.

> **Interview quickfire:** *union vs unionAll in PySpark?* Identical — and positional; use `unionByName`. *Why did my literal column fail?* Missing `lit()`. *count("col") vs count("\*")?* Null-skipping vs not. *Can coalesce increase partitions?* No — merge only, and unevenly at that.
