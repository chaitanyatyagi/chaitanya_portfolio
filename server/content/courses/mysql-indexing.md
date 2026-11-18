# Database Indexing Architecture

An index is a sorted data structure the engine maintains **alongside** your table so it can find rows without scanning everything. Understanding *how* they work — not just that they "make queries fast" — is what separates real answers from cargo cult in interviews and in production tuning.

## The B+Tree — the structure under almost every index

MySQL (InnoDB), Postgres, SQL Server — the default index is a **B+Tree**: a balanced, wide, shallow tree.

```text
                      ┌────────────[ 40 | 80 ]────────────┐        root
              ┌───[10|25]───┐                      ┌───[55|70]───┐  internal
              ▼      ▼      ▼                      ▼      ▼      ▼
           [1..9][10..24][25..39]              [40..54][55..69][70..79]   leaves
              ◀──────────── doubly-linked list ────────────▶
```

Why it wins:

- **Wide, not deep** — hundreds of keys per node mean a billion-row table is only 3–4 levels tall: any lookup is 3–4 page reads.
- **Leaves are linked** — range scans (`BETWEEN`, `>`, `ORDER BY`) walk the leaf list sequentially instead of re-descending the tree.
- **Always balanced** — inserts split pages, deletes merge them; lookup cost stays logarithmic forever.

Contrast with a **hash index**: O(1) exact-match lookups, but zero support for ranges or ordering — which is why B+Trees run the world.

## Clustered vs. Secondary Indexes (InnoDB)

This distinction explains half of MySQL's performance behavior.

**Clustered index** — the table *is* the index. InnoDB physically stores row data in the leaves of the primary-key B+Tree. One per table, by definition.

**Secondary index** — leaves store the indexed column(s) + **the primary key**, not a row pointer. Every secondary-index lookup that needs other columns does a second B+Tree descent on the PK — the *lookup penalty* (a.k.a. bookmark lookup).

```text
Secondary index on email:            Clustered (PK) index:
[email → id=42] ──── id=42 ────▶ [42 → full row data]
        1st descent                  2nd descent
```

Two hard-earned consequences:

- **Keep primary keys small.** The PK is copied into *every* secondary index entry. A 36-byte UUID PK bloats every index on the table; an 8-byte auto-increment doesn't.
- **Prefer monotonic PKs.** Auto-increment keys append to the rightmost leaf — clean sequential writes. Random UUIDs insert into random pages, causing page splits and fragmentation everywhere.

## Composite Indexes & the Leftmost-Prefix Rule

An index on `(a, b, c)` is sorted by `a`, then `b` within `a`, then `c` within `b`. It can serve queries filtering on:

```text
(a)         ✔
(a, b)      ✔
(a, b, c)   ✔
(b)         ✘  — b alone isn't sorted globally
(b, c)      ✘
(a, c)      ~  — uses the 'a' part only; 'c' is filtered after
```

Ordering rule of thumb: **equality columns first, then the range column, then sort columns**. A range predicate "consumes" the index — columns after it can't be used for seeking.

```sql
-- Query: WHERE tenant_id = ? AND status = ? AND created_at > ? ORDER BY created_at
-- Right index:
CREATE INDEX idx_orders ON orders (tenant_id, status, created_at);
```

## Covering Indexes

If the index contains **every column the query touches**, the engine answers from the index alone — no row lookup at all. In `EXPLAIN` this shows as `Using index`.

```sql
-- Query: SELECT user_id, status FROM orders WHERE user_id = 42;
CREATE INDEX idx_covering ON orders (user_id, status);
-- The PK is implicitly included in InnoDB secondary indexes,
-- so (user_id, status) covers SELECT id, user_id, status too.
```

Covering indexes are the cheapest big win in read-heavy systems — you're trading a little write cost and storage for eliminating the lookup penalty entirely.

## Cardinality & Selectivity

**Selectivity = distinct values / total rows.** Indexes pay off on selective columns (`email`, near 1.0) and are nearly useless on low-selectivity ones (`is_active`, ~0.000001).

Why: for a low-selectivity filter matching 40% of a table, walking the index *and* doing 40%-of-the-table random row lookups is slower than one sequential full scan. The optimizer knows this and will ignore the index — correctly.

**Exception:** a low-cardinality column *earns* a spot inside a composite index when combined with selective columns, or when the index covers the query.

## Reading EXPLAIN

```sql
EXPLAIN SELECT * FROM orders WHERE user_id = 42 AND status = 'shipped';
```

The fields that matter:

| Field | What to look for |
| --- | --- |
| `type` | `const` > `eq_ref` > `ref` > `range` > `index` > **`ALL`** (full scan — the red flag) |
| `key` | Which index was actually chosen (not just considered) |
| `rows` | Estimated rows examined — the cost proxy |
| `Extra` | `Using index` = covering ✓ · `Using filesort` = sort couldn't use an index · `Using temporary` = worse |

`Using filesort` on a hot query usually means your index doesn't match the `ORDER BY` — extend the composite index to include the sort column.

## When Indexes Hurt

Indexes aren't free — every one is a second data structure maintained on **every write**:

- **Write amplification** — an `INSERT` into a table with 6 indexes performs 7 structure updates. Bulk loads often go faster by dropping indexes and rebuilding after.
- **Optimizer confusion** — redundant/overlapping indexes (`(a)` when `(a,b)` exists) waste space and can bait the optimizer into worse plans.
- **Index invisibility to functions** — `WHERE YEAR(created_at) = 2024` cannot use an index on `created_at`. Rewrite as a range: `created_at >= '2024-01-01' AND created_at < '2025-01-01'`.
- **Leading wildcards** — `LIKE '%@gmail.com'` can't seek a B+Tree (nothing sorted to descend into). Full-text or reversed-column tricks apply.

## Practical Checklist

- Index the columns in your `WHERE`, `JOIN ... ON`, and `ORDER BY` — as **composite** indexes matching real query shapes, not one index per column.
- Equality → range → sort: that's your composite column order.
- Chase covering indexes for the hottest read paths.
- Keep PKs small and monotonic; remember every secondary index carries the PK.
- Audit with `EXPLAIN` before and after; drop indexes that `sys.schema_unused_indexes` proves dead.
- Don't index low-selectivity columns alone; don't wrap indexed columns in functions.
