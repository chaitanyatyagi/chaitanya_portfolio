# Real-World Patterns: JSON, UDFs & SCD2

The closing chapter is the applied one — three things you *will* build as a data engineer: flattening nested JSON from APIs and event streams, writing UDFs without destroying performance, and implementing Slowly Changing Dimension Type 2, the pattern behind every warehouse's history tracking.

## Flattening nested JSON

API responses arrive nested: structs inside structs, arrays of structs. Warehouses want flat tables. Two tools do all the work — **dot paths** for structs, **`explode`** for arrays.

```json
{"id": 1, "name": "kapil",
 "address": {"city": "gurugram", "pin": 122001},
 "orders": [{"sku": "A1", "qty": 2}, {"sku": "B7", "qty": 1}]}
```

```python
from pyspark.sql.functions import col, explode, explode_outer

flat = (
    spark.read.json("/data/customers.json")
    .withColumn("order", explode_outer("orders"))    # array → one ROW per element
    .select(
        "id", "name",
        col("address.city").alias("city"),           # struct → dot path
        col("address.pin").alias("pin"),
        col("order.sku").alias("sku"),
        col("order.qty").alias("qty"),
    )
)
```

Arrays nested inside arrays? **Explode repeatedly** — one `explode` per level, outermost first.

The `explode` vs `explode_outer` distinction bites in production: **`explode` silently drops rows whose array is null or empty** (it's an inner-join-like operation); `explode_outer` keeps them with null element columns. A customer with zero orders disappears entirely under `explode` — usually a bug, occasionally a lawsuit.

## UDFs — and why pandas_udf exists

When no built-in function fits, a UDF wraps your Python:

```python
from pyspark.sql.functions import udf
from pyspark.sql.types import StringType

@udf(returnType=StringType())
def mask_pan(pan):
    return pan[:2] + "****" + pan[-2:] if pan else None

df.withColumn("pan_masked", mask_pan(col("pan")))
```

Recall the architecture chapter: this forces every executor to run a **Python worker beside the JVM** and serialize **every row** across — JVM → Python → your function → Python → JVM — and Catalyst treats the function as an unoptimizable black box (no pushdown through it). Plain Python UDFs are routinely 10–100× slower than built-ins.

The escalation ladder:

1. **Built-in functions first, always** — `pyspark.sql.functions` has ~400 of them; masking above is doable with `concat`/`substring`.
2. **`pandas_udf` when you truly need Python** — same worker architecture, but rows cross the boundary in **Arrow-encoded columnar batches**, and your function receives whole **pandas Series** instead of single values. Vectorization + cheap (de)serialization ≈ 3–30× faster than a plain UDF:

```python
import pandas as pd
from pyspark.sql.functions import pandas_udf
from pyspark.sql.types import DoubleType

@pandas_udf(DoubleType())
def zscore(s: pd.Series) -> pd.Series:        # a whole batch at once
    return (s - s.mean()) / s.std()

df.withColumn("amount_z", zscore(col("amount")))
```

3. **RDD-level code** — last resort, loses Catalyst entirely.

Also file under "distributed variables you should know": **broadcast variables** (`spark.sparkContext.broadcast(lookup_dict)` — ship a read-only lookup to every executor once, instead of inside every task/UDF closure) and **accumulators** (executor-side counters — e.g. counting bad rows — readable only on the driver).

## SCD2 — history-preserving dimensions

The setup: a warehouse **dimension** must remember history. When a customer moves cities, don't overwrite — **expire the old row, insert a new current row**:

| id | name | city | active | start_date | end_date |
| --- | --- | --- | --- | --- | --- |
| 1 | manish | noida | **N** | 2022-09-15 | 2022-09-25 |
| 1 | manish | gurgaon | **Y** | 2022-09-25 | null |

`active='Y'` + `end_date IS NULL` = the current truth; the rest is history. Now the daily batch: `customer_dim_df` (as above) and today's `sales_df` arrivals `(sales_id, customer_id, name, sales_date, addr, country)`. Three row-sets to produce:

```python
from pyspark.sql.functions import col, lit

# Detect: join current dim to today's facts
joined = customer_dim_df.join(
    sales_df, customer_dim_df["id"] == sales_df["customer_id"], "left"
)

# ① NEW VERSIONS — active customers whose address changed:
#    a fresh current row starting at the sale date
new_records = (
    joined
    .where((col("addr") != col("city")) & (col("active") == "Y"))
    .select(
        col("id"), col("name"), col("addr").alias("city"), sales_df["country"],
        lit("Y").alias("active"),
        col("sales_date").alias("start_date"),
        lit(None).alias("end_date"),
    )
)

# ② EXPIRED VERSIONS — the same customers' OLD rows:
#    flip to inactive, close end_date at the sale date
old_records_update = (
    joined
    .where((col("addr") != col("city")) & (col("active") == "Y"))
    .select(
        col("id"), col("name"), col("city"), customer_dim_df["country"],
        lit("N").alias("active"),
        col("start_date"),
        col("sales_date").alias("end_date"),
    )
)

# ③ BRAND-NEW CUSTOMERS — in sales but not in the dimension: left_anti
new_customers = (
    sales_df.join(customer_dim_df,
                  sales_df["customer_id"] == customer_dim_df["id"], "left_anti")
    .select(
        col("customer_id").alias("id"), col("name"),
        col("addr").alias("city"), col("country"),
        lit("Y").alias("active"),
        col("sales_date").alias("start_date"),
        lit(None).alias("end_date"),
    )
)

# Assemble: untouched dim rows + expired + new versions + new customers
unchanged = customer_dim_df.join(
    new_records.select("id"), "id", "left_anti")     # drop rows we re-emitted
final_dim = unchanged.unionByName(old_records_update) \
                     .unionByName(new_records) \
                     .unionByName(new_customers)
```

One integrity check before writing — **exactly one active row per id**. A window catches violations (e.g. a customer who changed address twice in the batch):

```python
from pyspark.sql.window import Window
from pyspark.sql.functions import rank, desc

w = Window.partitionBy("id", "active").orderBy(desc("start_date"))
final_dim = (
    final_dim.withColumn("rnk", rank().over(w))
    .filter(~((col("active") == "Y") & (col("rnk") >= 2)))   # keep newest current
    .drop("rnk")
)
```

Notice how the whole pattern is assembled from earlier chapters: a **left join** to detect changes, **left_anti** for new keys, **unionByName** to assemble, a **window + rank** to enforce the single-current-row invariant. (In a lakehouse, the same logic compresses into a Delta/Iceberg `MERGE INTO` — the reasoning transfers unchanged.)

## Production checklist

The habits that separate a working notebook from a production job:

- **Schemas explicit, always.** Inference is for exploration.
- **Filter and select as early as possible** — let pushdown and pruning earn their keep.
- **Know every shuffle in your job** — `explain()` before you ship; each `Exchange` should be there on purpose.
- **Broadcast small dimensions; bucket repeat-join tables; salt or trust AQE for skew.**
- **Cache only what's reused, unpersist when done, verify in the UI.**
- **Never `collect()` at scale**; write out or aggregate first.
- **Right-size output files** (128 MB–1 GB) — your readers inherit your writer settings.
- **Built-ins > pandas_udf > udf > RDD**, in that order, every time.
- **Idempotent writes** — overwrite-by-partition or MERGE, so reruns heal instead of duplicate.

> **Interview quickfire:** *explode vs explode_outer?* explode drops null/empty-array rows; outer keeps them. *Why are Python UDFs slow and what's the fix?* Per-row JVM↔Python serialization + optimizer black box; use built-ins or Arrow-batched `pandas_udf`. *SCD2 in one breath?* Expire the old row (active N, end_date set), insert the new current row (active Y, end_date null), left_anti for brand-new keys, one active row per key enforced with a window.
