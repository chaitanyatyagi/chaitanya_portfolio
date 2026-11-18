# Reading Data & Schemas

Every pipeline starts with a read, and most production incidents start with a *bad* read — a schema that drifted, a corrupt row that slipped through, a JSON file that wasn't shaped the way you assumed. This chapter is the DataFrameReader end-to-end, including the corrupt-record machinery most people discover only during an incident.

## The DataFrameReader API

One fluent pattern for every source:

```python
df = (
    spark.read
    .format("csv")                      # csv | json | parquet | orc | jdbc | table
    .option("header", "true")           # source-specific options
    .option("inferSchema", "true")
    .option("mode", "FAILFAST")
    .schema(my_schema)                  # OR let Spark infer
    .load("/data/employees/*.csv")
)
```

`format()` is optional — **Parquet is the default** (that's a deliberate choice; the Parquet chapter explains why). Two habits worth building immediately: prefer an **explicit schema** over `inferSchema` (inference costs an extra pass over the data and guesses wrong on dates/decimals), and always set a **read mode** consciously.

## Read modes — what happens to malformed rows

| Mode | Behavior on a corrupt record |
| --- | --- |
| `PERMISSIVE` *(default)* | Keep the row; unparseable fields become `null` |
| `DROPMALFORMED` | Silently drop corrupt rows |
| `FAILFAST` | Throw immediately, kill the read |

Concretely — a 3-row file where 2 rows have extra columns: PERMISSIVE loads 3 rows (with nulls), DROPMALFORMED loads 1, FAILFAST loads 0 and raises. The right choice is contextual: FAILFAST for financial data where silent nulls are unacceptable; PERMISSIVE + a quarantine pattern (below) for high-volume feeds that must keep flowing.

## Defining schemas

Two equivalent ways:

```python
from pyspark.sql.types import StructType, StructField, IntegerType, StringType

# 1. Programmatic — StructType is the table, StructField is a column
my_schema = StructType([
    StructField("id",   IntegerType(), True),   # (name, type, nullable)
    StructField("name", StringType(),  True),
    StructField("age",  IntegerType(), True),
])

# 2. DDL string — terser, reads like SQL
ddl_schema = "id INT, name STRING, age INT"

df = spark.read.schema(my_schema).option("header", True).csv(path)
df.printSchema()
```

Useful companion option: `option("skipRows", 1)` to skip junk header lines beyond the standard header. The full option catalog lives in the Spark docs under *CSV data source options* — worth a bookmark.

## Capturing bad records instead of losing them

PERMISSIVE nulls-out bad fields, but you usually want to **see** what was wrong. Two escalating tools:

**1. The `_corrupt_record` column.** Add it to your schema and Spark routes the *raw text* of every unparseable row into it:

```python
schema_with_corrupt = StructType([
    StructField("id",              IntegerType(), True),
    StructField("name",            StringType(),  True),
    StructField("age",             IntegerType(), True),
    StructField("_corrupt_record", StringType(),  True),   # magic name
])

bad = df.filter(col("_corrupt_record").isNotNull())
```

**2. `badRecordsPath` — the quarantine pattern.** Spark writes every rejected record (with the exception that killed it) to files at that path, and the read continues:

```python
df = (
    spark.read.schema(my_schema)
    .option("badRecordsPath", "/data/quarantine/employees/")
    .csv(path)
)
```

Gotcha that costs people interview points: **when `badRecordsPath` is set, the `mode` option is ignored** — quarantining takes over the malformed-row handling entirely.

## Reading JSON

JSON has its own trapdoors:

**Line-delimited vs multiline.** Spark's default expects **one complete JSON object per line** — this is splittable and fast. Pretty-printed JSON (one object across many lines) needs `option("multiline", "true")`, which is slower because a file can no longer be split blindly on newlines.

```python
df = spark.read.option("multiline", "true").json("/data/pretty.json")
```

**Uneven keys.** JSON lines don't all need the same keys. Spark takes the **union of all keys** as columns; missing keys become `null`. No error — which is both convenient and a silent schema-drift risk.

**Corrupt JSON.** Malformed lines automatically get the `_corrupt_record` treatment: all real columns null, raw text preserved — even without declaring the column in your schema (Spark adds it during inference).

Nested JSON (structs, arrays, `explode`) is a big enough topic that it has its own section in the real-world patterns chapter.

## Reading over JDBC

For completeness — pulling from an operational database:

```python
df = (
    spark.read.format("jdbc")
    .option("url", "jdbc:mysql://db-host:3306/shop")
    .option("dbtable", "(SELECT * FROM orders WHERE order_date >= '2026-01-01') AS t")
    .option("user", "etl_reader")
    .option("password", pw)
    .option("partitionColumn", "order_id")   # ┐ parallel read:
    .option("lowerBound", "1")               # │ split the range
    .option("upperBound", "10000000")        # │ across
    .option("numPartitions", "8")            # ┘ 8 concurrent queries
    .load()
)
```

Without the last four options the entire table is read **through a single connection into a single partition** — the most common JDBC-read mistake, and the difference between an 8-minute and an 8-hour extract.

> **Interview quickfire:** *Default read mode?* PERMISSIVE. *How do you keep bad rows for inspection?* `_corrupt_record` in the schema, or `badRecordsPath` for a persistent quarantine (which ignores `mode`). *Why is multiline JSON slower?* The file stops being line-splittable. *Why explicit schemas?* Skip the inference pass + no wrong guesses on types.
