# Data Value Design Patterns

Data sitting quietly in storage isn't an asset. Raw ingested records are usually poor, unstructured, and context-starved. Value patterns **augment, enrich, decorate, or aggregate** raw structures into contextual, query-optimized assets — through two contrasting frameworks: *information augmentation* (enrichment & decoration) and *information reduction* (aggregation & sessionization).

## Static Joiner

**Problem.** Stakeholders want page-visit events connected to customer registration data. The event stream carries only a raw `user_id`; the user properties live in a relational dimension table.

**Solution.** Join incoming records against the reference dataset **at rest** using key attributes — the classic heterogeneous pipeline where a streaming job reads a batch dimension table.

**SCD integration.** When the reference table itself changes over time, temporal keys must enter the join to keep backfills reproducible:

- **SCD Type 2** — history lives in one table via validity timestamps (`start_date`, `end_date`); the active row has a NULL/max end date.
- **SCD Type 4** — two tables: one holding only current values, one logging the full historical trace.

```sql
-- SCD Type 2 temporal join: pick the user version valid AT event time
SELECT v.visit_id, v.event_time, v.page, u.id, u.login, u.email
FROM dedp.visits v
JOIN dedp.users u
  ON u.id = v.user_id
 AND v.event_time BETWEEN u.start_date AND u.end_date;
```

> **Danger — direct API enrichment.** Calling an HTTP endpoint per record inside a stream worker adds network strain and latency, and breaks idempotency when the API's answers change between replays. Materialize API context locally *before* joining whenever possible.

When API lookups are unavoidable, **bulk micro-batch** them:

```python
class KafkaWriterWithEnricher:
    BUFFER_THRESHOLD = 100

    def process(self, row):
        if len(self.buffered_to_enrich) == self.BUFFER_THRESHOLD:
            self._enrich_ips()
            self._flush_records()
        else:
            self.buffered_to_enrich.append(row)

    def _enrich_ips(self):
        ips = ','.join(set(v.ip for v in self.buffered_to_enrich))
        resp = requests.get(f"http://localhost:8080/geolocation?ips={ips}")
        if resp.status_code == 200:
            self.enriched_ips.update(json.loads(resp.content)['mapped'])
```

## Dynamic Joiner

**Problem.** Both streams move: the event feed *and* the enrichment feed (e.g., CDC user profiles). Static joins return empty matches because the two streams lag each other unpredictably.

**Solution.** Build **time-bounded state buffers** on both paths. The faster stream parks unmatched keys in memory until the slower stream catches up.

```text
Stream A (fast visits) ──┐
                         ├──▶ time-bounded state buffer ──▶ enriched stream
Stream B (slow users)  ──┘
```

```python
visits_with_ads = (visits_from_kafka
    .withWatermark('event_time', '10 minutes')
    .join(
        ads_from_kafka.withWatermark('display_time', '10 minutes'),
        expr("""page = visit_page
                AND display_time BETWEEN event_time AND event_time + INTERVAL 2 MINUTE"""),
        joinType='left_outer'))
```

> **GC watermarks.** You can't hold state forever. The watermark defines maximum allowed lateness; events arriving after it find their partner's state already evicted — that join is sacrificed to keep memory stable. Choosing the watermark is choosing your accuracy/memory trade-off.

## Wrapper

**Problem.** Events arrive from disjoint providers with mismatched, fluid schemas. Downstream wants one consolidated schema — but auditors need the original raw structures preserved untouched.

**Solution.** Keep the raw record intact and **encapsulate** it inside a clean envelope that carries parsed, first-class properties alongside the nested original.

Two wrapping strategies:

1. **Nested attribute wrapping** — the original row stays flat; derived values live inside a dedicated nested struct.
2. **Raw struct inversion** — parsed values are promoted to top-level columns; the messy raw payload is tucked into a nested metadata column.

```sql
-- Raw struct inversion
SELECT
  CASE WHEN context.user.connected_since IS NULL THEN false ELSE true END AS is_connected,
  CONCAT_WS('-', page, context.referral) AS page_referral_key,
  STRUCT(visit_id, event_time, user_id, page, context) AS raw_ingested_source
FROM input_visits;
```

## Metadata Decorator

**Problem.** Engineers need execution parameters (job version, batch number) attached to every record to trace deployments — but business users get confused seeing technical fields in their dashboards.

**Solution.** Store operational properties in **out-of-band metadata locations** — Kafka headers, object-store tags — decoupled from the payload users query.

```python
visits_with_metadata = visits_to_save.withColumn('headers', F.array(
    F.struct(F.lit('job_version').alias('key'),
             F.lit(job_version).cast('binary').alias('value')),
    F.struct(F.lit('batch_id').alias('key'),
             F.lit(str(batch_num)).cast('binary').alias('value')),
))

(visits_with_metadata.write.format('kafka')
    .option('kafka.bootstrap.servers', 'localhost:9094')
    .option('includeHeaders', True)
    .save())
```

## Distributed Aggregator

**Problem.** Metrics must be computed over a massive dataset spanning many physically separate servers.

**Solution.** The MapReduce strategy: run local filters and **partial aggregations on each node first**, then shuffle related keys across the network to dedicated nodes for final reduction. Pre-aggregation shrinks what crosses the wire.

> **Data skew.** When one key holds vastly more records than the rest, the shuffle sends them all to one node — a hard bottleneck. Fix with **salting**: append a random prefix to the hot key so work spreads across the cluster, then run a second aggregation to strip the prefix and combine totals.

```text
key "IN"  (10M rows)  ──▶  "IN_0".."IN_7"  ──▶  8 nodes aggregate in parallel
                                              ──▶ second pass merges the 8 partials
```

## Local Aggregator

**Problem.** The shuffle itself is your bottleneck, and you want it gone.

**Solution.** Make the storage layout match the aggregation: if data is **already partitioned by the aggregation key**, each task aggregates its partition completely locally — zero cross-network movement.

```python
# Physically sort within partitions so tasks can process blocks independently
sorted_visits = visits_to_save.sortWithinPartitions(['visit_id', 'event_time'])
sorted_visits.foreachPartition(write_records_from_partition_to_kafka)
```

## Incremental Sessionizer

**Problem.** Group user events into sessions in a **batch** world where sessions routinely span partition boundaries (a user active from 23:50 to 00:10 must be one session, not two).

**Solution.** An hourly batch workflow with three storage paths and a feedback loop:

```text
Hourly raw input ─┐
                  ├──▶ session join & map (window + expiry checks) ──▶ Completed sessions (public)
Pending sessions ─┘                                             └──▶ Updated pending (private)
        ▲                                                                  │
        └──────────────────────── feedback loop ◀──────────────────────────┘
```

1. **Input storage** — the new hourly partition of raw events.
2. **Pending storage** — private state holding incomplete sessions from previous runs.
3. **Completed storage** — finalized sessions exposed to users (optionally with active ones flagged `is_completed = false`).

## Stateful Sessionizer

**Problem.** The business wants sessions in near real-time, not at the next hourly batch.

**Solution.** A streaming job tracks sessions in a local **state store** (checkpointed for fault tolerance), opening and closing sessions as events flow.

> **Expire on watermarks, not event time.** Trigger session timeouts from **watermark progression** — which tracks overall pipeline progress — rather than raw event timestamps. Otherwise cluster restarts or network lag make sessions expire prematurely while the data was merely delayed.

## Bin Pack Orderer

**Problem.** Your destination has **partial commit semantics** (DynamoDB `BatchWrite`, Kinesis `PutRecords`): a batch can half-succeed, and retrying the failed records can write data out of order.

**Solution.** Sort records by entity key + timestamp, then pack them into sequential delivery **bins with at most one row per entity key per bin**. A failed bin retries in isolation without reordering any entity's history.

```text
Key=A t=09:00 ┐        Bin 1: A[09:00], B[09:01]   ─▶ target
Key=A t=09:05 ├─sort─▶
Key=B t=09:01 ┘        Bin 2: A[09:05]             ─▶ target (after Bin 1)
```

## FIFO Orderer

**Problem.** Same ordering requirement, lower volume — bin-packing is overkill.

**Solution.** Route messages with strict first-in-first-out semantics — single-concurrency delivery, or idempotent producers with ordered in-flight batching:

```python
# Kafka: deterministic order with up to 5 concurrent in-flight batches
producer_config = {
    'enable.idempotence': True,
    'max.in.flight.requests.per.connection': 5,
    'queue.buffering.max.ms': 2000,
}
```

## Pattern Selection Matrix

| Pattern | Family | Use it for | Key trade-off |
| --- | --- | --- | --- |
| Static Joiner | Enrichment | Stream × batch dimension joins (SCD-aware) | API enrichment breaks idempotency |
| Dynamic Joiner | Enrichment | Stream × stream joins with lag | Watermark = accuracy vs. memory |
| Wrapper | Decoration | Unified schema + preserved raw payloads | Larger rows, nested access paths |
| Metadata Decorator | Decoration | Operational lineage without polluting payloads | Metadata invisible to naive consumers |
| Distributed Aggregator | Aggregation | Cluster-wide metrics via partial aggregation | Skew requires salting |
| Local Aggregator | Aggregation | Shuffle-free aggregation on aligned layouts | Layout must match the key |
| Incremental Sessionizer | Sessionization | Batch sessions across partition boundaries | Feedback-loop state management |
| Stateful Sessionizer | Sessionization | Real-time sessions | State store + watermark discipline |
| Bin Pack Orderer | Ordering | Ordered delivery to partial-commit sinks | Extra sort + packing step |
| FIFO Orderer | Ordering | Simple ordered delivery at lower volume | Throughput ceiling |
