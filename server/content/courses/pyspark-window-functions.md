# Window Functions

Window functions answer the questions plain `groupBy` can't: *top-N per group, compare to the previous row, running totals, share of a group's total* — all while **keeping every input row**. A `groupBy` collapses rows; a window function decorates them. This is comfortably the most-tested PySpark topic in data-engineering interviews.

## The anatomy of a window

```python
from pyspark.sql.window import Window
from pyspark.sql.functions import col, row_number, rank, dense_rank, sum

window = Window.partitionBy("dept").orderBy(col("salary").desc())
#                └── restart per group   └── ordering inside the group

df.withColumn("rn", row_number().over(window))
```

Three ingredients: **partitionBy** (the group), **orderBy** (the order within it), and optionally a **frame** (which nearby rows feed the calculation — last section). The function then runs `over()` that specification, once per row.

## row_number vs rank vs dense_rank

The difference is exactly one thing: **ties**.

```text
salary (desc)   row_number   rank   dense_rank
   90000            1          1        1
   85000            2          2        2
   85000            3          2        2      ← tie
   80000            4          4        3      ← rank skips, dense doesn't
```

- `row_number` — unique sequence, ties broken arbitrarily (add tiebreaker columns to `orderBy` if you care).
- `rank` — ties share a rank; the next rank **skips** (1,2,2,4). Olympic-medal style.
- `dense_rank` — ties share a rank; **no gap** (1,2,2,3). Use when you want "the 3rd distinct salary level".

## Exercise: top-2 earners per department

The single most-asked window question:

```python
window = Window.partitionBy("dept").orderBy(col("salary").desc())

top2 = (
    df.withColumn("rnk", dense_rank().over(window))
      .filter(col("rnk") <= 2)
      .drop("rnk")
)
```

Why `dense_rank` and not `row_number`? If two people tie for 2nd, `dense_rank` keeps both — usually what "top 2 earners" means. Saying that sentence out loud in an interview is worth more than the code.

## Exercise: percent of department total

Aggregate over the window **without collapsing rows**:

```python
from pyspark.sql.functions import round as sround

dept_window = Window.partitionBy("dept")     # no orderBy — whole group

df.withColumn(
    "pct_of_dept",
    sround(col("salary") * 100 / sum("salary").over(dept_window), 2),
)
```

Every employee row survives, now annotated with its share of the department payroll. This groupBy-without-losing-rows trick is the core reason window functions exist.

## lag & lead — talking to neighboring rows

```python
from pyspark.sql.functions import lag, lead

w = Window.partitionBy("store").orderBy("month")

df.withColumn("prev_sales", lag(col("sales"), 1).over(w)) \
  .withColumn("growth", col("sales") - col("prev_sales"))
```

`lag(col, n)` reaches **n rows back** in the window order; `lead` reaches forward. First row of each partition has no predecessor → `null` (handle with `coalesce()` or accept it). This is the month-over-month / detect-gaps / compare-to-previous-event workhorse.

## Frames: rowsBetween vs rangeBetween

By default an ordered window runs from the partition start to the current row. **Frames** override that:

```python
w = Window.partitionBy("store").orderBy("month")

# Running (cumulative) total — start of partition to current row
df.withColumn("running", sum("sales").over(
    w.rowsBetween(Window.unboundedPreceding, Window.currentRow)))

# Moving window — 2 physical rows behind through 2 ahead
df.withColumn("moving5", sum("sales").over(w.rowsBetween(-2, 2)))

# Trailing 3 rows including current
df.withColumn("trailing3", sum("sales").over(w.rowsBetween(-2, 0)))
```

The `rows` vs `range` distinction — a genuinely senior interview question:

- **`rowsBetween(-1, 1)`** — *physical* rows: exactly one row above and below, whatever their values.
- **`rangeBetween(-1, 1)`** — *value-based*: every row whose **orderBy value** is within ±1 of the current row's value. Ties and gaps change the frame size; `rangeBetween` with `orderBy("salary")` and offset -1000 means "all rows within 1000 of my salary".

Markers: `Window.unboundedPreceding`, `Window.currentRow`, `Window.unboundedFollowing`.

## Exercise: first login & last logout per user per day

A real exercise combining timestamp parsing with windows — given events `(user, date, time, action)`:

```python
from pyspark.sql.functions import concat, unix_timestamp, from_unixtime, first

events = df.withColumn(
    "ts",
    from_unixtime(unix_timestamp(concat("date", "time"), "dd-MM-yyyyHH:mm")),
)

asc_w  = Window.partitionBy("user", "date").orderBy(col("ts").asc())
desc_w = Window.partitionBy("user", "date").orderBy(col("ts").desc())

result = (
    events
    .withColumn("first_login",  first("ts").over(asc_w))
    .withColumn("last_logout",  first("ts").over(desc_w))
    .select("user", "date", "first_login", "last_logout")
    .distinct()
)
```

The trick worth remembering: `first().over(desc-ordered window)` **is** "last" — one function, two windows, both boundaries.

> **Interview quickfire:** *rank vs dense_rank?* Both share ranks on ties; rank leaves gaps (1,2,2,4), dense_rank doesn't (1,2,2,3). *Top-N per group?* Window + rank + filter. *rows vs range?* Physical row offsets vs orderBy-value offsets. *Running total?* `rowsBetween(unboundedPreceding, currentRow)`. *Are window functions cheap?* No — `partitionBy` shuffles like a groupBy; skewed partitions hurt here too.
