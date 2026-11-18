# Data Quality Design Patterns

Trust is the currency of any dataset. If consumers can't trust a dataset — because it's incomplete, inaccurate, or inconsistent — every insight extracted from it is suspect. Quality patterns split across three pillars: **quality enforcement** (blocking bad data), **schema consistency** (evolving structures safely), and **quality observation** (watching trends over time).

## Audit-Write-Audit-Publish (AWAP)

**Problem.** A batch ETL job aggregates daily visitor metrics. A source anomaly makes unique-visitor counts drop 50%. Unit tests can't catch this — they run against static mocks at development time, not against live run-time data. Downstream teams launch an expensive marketing campaign based on the wrong numbers.

**Solution.** AWAP evolves the classic Write-Audit-Publish (WAP) strategy by adding a **lightweight input audit before transformation**, so you don't waste compute transforming already-corrupted input.

```text
Raw store ─▶ AUDIT(input) ─▶ Extract ─▶ Transform ─▶ Staging ─▶ AUDIT(output) ─▶ Publish ─▶ Prod
```

The two audit layers have different jobs:

1. **Input audit** — cheap checks on the source *before* mutation: header row shape, file format, size/line-count thresholds. Must stay lightweight to avoid double-reading big datasets.
2. **Output audit** — a production-level unit test on live data in staging: did the transform introduce anomalies (e.g., a buggy join silently nulling a critical column)?

Three strategies when an audit fails:

- **Fail the pipeline** — hard stop; 100% downstream protection.
- **Dead-letter dispatch** — route corrupt rows to error storage, promote healthy rows. Guided by explicit assertion rules, not runtime exceptions.
- **Nonblocking annotation** — write the data but tag its metadata with warnings; consumers judge fitness for their own context.

```python
def validate_file_before_processing(**context):
    errors = []
    if f_size < min_size:
        errors.append(f"File too small — expected at least {min_size} bytes.")
    if lines < min_lines:
        errors.append(f"File too short — expected at least {min_lines} lines.")
    if invalid_json_line:
        errors.append("File contains invalid JSON lines.")
    if errors:
        raise Exception("Input Audit Failed:\n" + "\n".join(errors))

def validate_transformed_output(**context):
    visits = pandas.read_csv(partition_file(context, 'csv'))
    required = ['visit_id', 'event_time', 'user_id', 'page']
    nulls = [c for c in required if visits[c].isnull().any()]
    if nulls:
        raise Exception(f"Nulls found in non-nullable columns: {','.join(nulls)}")

# audit_input >> transform >> audit_output >> load_to_final_table
```

**Streaming variants.** A continuous stream has no natural "input" boundary, so AWAP adapts:

```text
A) Window-based:   Source ─▶ Stream job ─▶ time window ─▶ audit fn ─▶ sink
B) Staging-based:  Source ─▶ Stream job ─▶ staging (Delta) ─▶ audit stream ─▶ sink
```

- *Window-based* buffers rows per processing window and audits before committing — adds latency equal to the window length.
- *Staging-based* writes transformed rows immediately to a staging table (e.g., Delta Lake) where an independent audit stream validates and forwards them.

```python
# Job 1: continuously write inputs to a Delta staging layer
write_query = (visits.writeStream
    .trigger(processingTime='15 seconds')
    .option('checkpointLocation', checkpoint_dir)
    .foreachBatch(write_dataset_to_staging_table)
    .start())

# Job 2: consume staging, evaluate quality, commit to final target
visits_audit = (spark.readStream.format('delta')
    .option('maxBytesPerTrigger', 20_000_000)
    .table(staging_visits_table)
    .withColumn('is_valid', row_validation_expression))
```

**Trade-offs.**
- *Compute cost* — row-level validation isn't free; metadata checks are cheap, deep structural checks aren't.
- *Rules decay* — static rules can't predict future data drift. A green audit today doesn't guarantee health tomorrow.
- *False positives* — a volume spike might be a viral marketing win, not a bug. Sometimes alert instead of hard-failing.

## Constraints Enforcer

**Problem.** Hand-coding validation assertions for every basic structural rule (missing fields, wrong types) buries your pipeline in boilerplate.

**Solution.** Go declarative — delegate validation to the **storage engine, database, or serialization format** itself.

Constraint classes:

- **Type** — every value adheres to one type (`TIMESTAMP`).
- **Nullability** — `NOT NULL` blocks rows with missing values at the engine level.
- **Value (check)** — custom business rules (`status IN (...)`, date ranges).
- **Integrity** — referential associations across tables; inserts blocked if the reference key is missing.

```sql
-- Delta Lake: types + nullability + a declarative value check
CREATE TABLE default.visits (
    visit_id   STRING    NOT NULL,
    event_time TIMESTAMP NOT NULL
) USING delta;

ALTER TABLE default.visits
  ADD CONSTRAINT dateWithinPast CHECK (event_time < current_timestamp());
```

```protobuf
// Protobuf + protovalidate: constraints in the schema itself
message Visit {
  string visit_id = 1 [(buf.validate.field).string.min_len = 16];
  google.protobuf.Timestamp event_time = 2 [
    (buf.validate.field).timestamp.lt_now = true,
    (buf.validate.field).required = true
  ];
  string user_id = 3 [(buf.validate.field).required = true];
  string page = 4;
}
```

**Trade-offs.**
- *All-or-nothing semantics* — one bad row out of millions rolls back the entire batch.
- *Debugging friction* — engines stop at the *first* violation; finding all bugs in a batch takes repeated reruns.
- *Producer-consumer mismatch* — constraints protect writers, but an "optional" column for the producer might be mandatory for a specific consumer.

## Schema Compatibility Enforcer

**Problem.** An upstream team "cleans up" their application schema and removes fields they think nobody uses. Your production aggregation relied on those fields. It starts failing immediately.

**Solution.** A programmatic validation layer that tests **every proposed schema change against compatibility rules** before it can be saved to the registry or table.

```text
Producer ─▶ validate against Schema Registry ─▶ (valid) ─▶ write
                        │
                        └─ (invalid upgrade) ─▶ reject / fail the job
```

Three implementation modes:

1. **External registry** (Confluent Schema Registry) — producers/consumers talk to the registry; incompatible versions are rejected.
2. **Implicit table enforcement** (Delta Lake) — the writer checks incoming batch structure against the table manifest; unapproved columns block the write.
3. **Event-driven DDL triggers** (PostgreSQL / SQL Server) — catch `DROP COLUMN` style DDL and roll back unapproved alterations.

Compatibility modes:

| Mode | Allowed changes | Meaning |
| --- | --- | --- |
| Backward | delete field · add optional field | New-schema consumers can read **old** data |
| Forward | add field · delete optional field | Old-schema consumers can read **new** data |
| Full | add/delete optional fields only | Works in both directions |

Each can be **nontransitive** (checked against the previous version only) or **transitive** (checked against *all* historical versions).

**The transitive trap.** v0 defines `order_id LONG REQUIRED`. v1 adds `amount DOUBLE DEFAULT 0.0` (fine, backward-compatible). v2 removes the default, making `amount` required. Checking only v1→v2 passes — v1 data always has a default value. But under *transitive* backward compatibility, v2 fails: a v2 consumer can't read **v0** data, which has no `amount` at all.

**Trade-offs.** Strict compliance with upgrade modes takes discipline and slows down schema changes — that friction is the feature, but teams need to understand why.

## Schema Migrator

**Problem.** An event schema has bloated to 60+ top-level attributes. You want to nest related fields into logical entities (`user.email`, `user.age`) — a breaking change that would snap every existing consumer.

**Solution.** Make breaking changes safely via an explicit **grace period**: temporarily produce both old and new structures in parallel while consumers migrate.

```text
Step 1  Identify the evolution (rename / restructure / removal)
Step 2  Grace window — write BOTH structures in parallel
Step 3  Track consumption via lineage until all consumers migrate
Step 4  Remove the legacy structure permanently
```

```sql
-- Safe column rename: from_page → referral
-- Step 1: add the new column alongside the old one
ALTER TABLE dedp.visits ADD COLUMN referral VARCHAR(25);

-- Step 2: populate BOTH columns during the grace period
INSERT INTO dedp.connected_users_visits
SELECT visit_id, event_time, user_id, page, from_page, from_page AS referral
FROM dedp.visits_input;

-- Step 3 (after lineage confirms all consumers moved): drop the legacy column
ALTER TABLE dedp.visits DROP COLUMN from_page;
```

**Trade-offs.**
- *Storage inflation* — duplicate fields during the window increase data size.
- *Serialization overhead* — even unpopulated Protobuf fields carry structural overhead; huge schemas hit compilation limits.
- *Metadata costs* — Delta Lake collects stats on the first 32 columns by default; a pile of temporary migration columns slows writes.

## Offline Observer

**Problem.** Your active guards run clean, but you want to watch **subtle trends** — like a slow creep of nulls in optional fields — without adding any latency or compute to the core pipeline.

**Solution.** An isolated monitoring component, fully decoupled from processing, reads the produced tables **on its own schedule** and generates statistics, profiles, and alerts.

```text
Core pipeline (daily) ──writes──▶ Production gold tables
                                        │  (independent async pull)
                                        ▼
                          Offline observer (nightly profiling job)
```

```sql
-- Record scan boundaries so metric runs stay idempotent
INSERT INTO dedp.visits_monitoring_state(execution_time, first_row_id, last_row_id)
SELECT '{{ execution_date }}'::TIMESTAMP, MIN(id), MAX(id) FROM dedp.visits_output;

-- Compute aggregate quality metrics over the captured boundary
INSERT INTO dedp.visits_monitoring(execution_time, all_rows, invalid_user_id, invalid_page)
SELECT '{{ execution_date }}', COUNT(*),
       SUM(CASE WHEN user_id IS NULL THEN 1 ELSE 0 END),
       SUM(CASE WHEN page    IS NULL THEN 1 ELSE 0 END)
FROM dedp.visits_output
WHERE id BETWEEN (SELECT first_row_id FROM dedp.visits_monitoring_state WHERE execution_time = '{{ execution_date }}')
             AND (SELECT last_row_id  FROM dedp.visits_monitoring_state WHERE execution_time = '{{ execution_date }}');
```

```python
from ydata_profiling import ProfileReport

def generate_profile_report(visits_df, batch_version):
    profile = ProfileReport(visits_df, minimal=True)
    profile.to_file(f'/mnt/observability/profile_{batch_version}.html')
```

**Trade-offs.**
- *Detection latency* — issues surface hours or days later; consumers may see corrupted data before your alert fires.
- *Resource spikes* — one nightly run over a day's data is a much bigger burst than continuous inline checks.

## Online Observer

**Problem.** Offline profiling misses immediate regressions — a zip-code format change ships at 10 AM and breaks consumers by noon, but your nightly profiler won't notice until 2 AM.

**Solution.** Embed monitoring **inside** the active processing components: compute metrics in real time alongside transformations and publish them within the same run.

Two orchestration approaches for batch:

- **Parallel split** — load and observe run simultaneously; fast, but the observer may read data the loader hasn't finished writing.
- **Local sequencer** — observation runs immediately *after* the load; guarantees you monitor exactly what users see, at the cost of added runtime.

```text
Extract ─▶ Transform ─▶ Load ─▶ Online observer   (local sequencer)
```

```python
def write_to_kafka_with_observer(visits_df, batch_id):
    ctx = visits_df.sparkSession.sparkContext
    all_events   = ctx.accumulator(0)
    null_users   = ctx.accumulator(0)

    def analyze(rows):
        for record in rows:
            all_events.add(1)
            if not record.user_id:
                null_users.add(1)     # count missing values in real time

    visits_df.foreachPartition(analyze)   # no second read of the stream

    publish_to_monitoring_store({
        "timestamp": datetime.utcnow().isoformat(),
        "total_records": all_events.value,
        "missing_users": null_users.value,
    })
```

**Trade-offs.**
- *Shared risk* — a memory leak in monitoring code can crash the production pipeline. Mitigate in Airflow with `trigger_rule='all_done'` on the final task so monitoring failures don't fail the run.
- *Latency overhead* — inline calculation always adds runtime.

## Pattern Selection Matrix

| Pattern | Pillar | Primary advantage | Key trade-off |
| --- | --- | --- | --- |
| AWAP | Enforcement | Stops bad data before it reaches consumers | Compute cost + validation complexity |
| Constraints Enforcer | Enforcement | Declarative, out-of-the-box engine validation | All-or-nothing transactional rollbacks |
| Schema Compatibility Enforcer | Consistency | Blocks breaking schema changes at the source | Strict version-upgrade discipline required |
| Schema Migrator | Consistency | Makes breaking changes safely via grace periods | Storage/overhead inflation during transition |
| Offline Observer | Observation | Zero performance impact on production jobs | Delay between error and alert |
| Online Observer | Observation | Near real-time quality signals | Monitoring bugs can crash core pipelines |
