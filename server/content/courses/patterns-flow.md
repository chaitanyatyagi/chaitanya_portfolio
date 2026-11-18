# Data Flow Design Patterns

Generating business value from raw data means designing and coordinating **every step required to produce a dataset** — chaining tasks inside a pipeline, managing parallel or exclusive branches, and coordinating dependencies across physically separate systems. These patterns operate at two structural levels: **pipeline orchestration** (tasks inside one pipeline) and **cross-pipeline coordination** (dependencies between pipelines).

## Readiness Marker

**Problem.** A downstream marketing pipeline runs at 02:00 AM sharp to compute churn metrics from files an upstream sync job writes into GCS. One night the upstream job runs slow and finishes at 02:15. The downstream job starts blindly at 02:00 anyway, reads a half-written dataset, and ships wrong metrics to every dashboard downstream.

**Solution.** Decouple pipelines from brittle time-based assumptions. The upstream pipeline creates a small, highly visible **marker** — an empty `_SUCCESS` file or a control-table row — *only after* all data is completely written and closed out. The downstream pipeline waits for the marker before starting its core work.

```text
Upstream job ──▶ writes Parquet files ──▶ drops _SUCCESS marker
                                                 │
                                                 ▼ (sensor detects)
                     Downstream job ◀── safe to process payload
```

Three implementation variations:

1. **File-based markers** — Spark writes an empty `_SUCCESS` flag beside dataset directories automatically; downstream file sensors poll for it.
2. **Relational audit tables** — the upstream job inserts `(dataset_name, partition_date, status='COMPLETED')` into a control table; downstream jobs poll via SQL.
3. **Object-store eventing** — S3/GCS fire real-time notifications (SNS, SQS, EventBridge, Pub/Sub) the moment the marker lands, so downstream starts instantly instead of polling.

```python
from airflow import DAG
from datetime import datetime
from airflow.providers.amazon.aws.sensors.s3 import S3KeySensor
from airflow.operators.python import PythonOperator

with DAG(dag_id='marketing_analytics_flow', start_date=datetime(2026, 1, 1),
         schedule_interval='@daily', catchup=False) as dag:

    wait_for_upstream_dataset = S3KeySensor(
        task_id='wait_for_upstream_dataset',
        bucket_name='company-data-lake',
        bucket_key='orders/year=2026/month=05/day=27/_SUCCESS',
        poke_interval=60,        # check every 60 seconds
        timeout=7200,            # hard fail after 2 hours
        mode='reschedule',       # frees the worker slot while sleeping
    )

    generate_analytics_report = PythonOperator(
        task_id='generate_analytics_report',
        python_callable=lambda: print("Marker found — partitions are closed, safe to read."),
    )

    wait_for_upstream_dataset >> generate_analytics_report
```

**Trade-offs.**
- *Orphaned dependency locking* — if the upstream job hard-crashes mid-write, the marker never appears and downstream jobs sit waiting until their timeout. You need operational alerts on sensor timeouts.
- *Polling cost* — checking storage every few seconds creates API noise and cost. Use `mode='reschedule'` (or event-driven triggers) instead of holding a worker slot.

## Fan-Out / Fan-In

**Problem.** A telemetry pipeline loads the same transformed data into three independent targets: a data lake for archival, a warehouse for BI, and an indexing engine for the security team. Running the loads sequentially means a slow warehouse step delays the security team — even though the steps are completely independent.

**Solution.** Split one execution path into parallel branches (**fan-out**), then recombine them into a single synchronization task (**fan-in**) once the branches finish.

```text
                    ┌──▶ Load data lake ──────┐
Core transform ─────┼──▶ Load warehouse ──────┼──▶ Success signal / alert
                    └──▶ Load index engine ───┘
```

Two fan-in semantics:

- **Aligned (strict)** — the sync task runs only if *every* branch succeeds. One flaky network call halts everything downstream.
- **Unaligned (relaxed)** — the sync task proceeds when *at least one* branch completes. Great for non-critical logging or partial rollups.

```python
from airflow.operators.empty import EmptyOperator

transform_core = EmptyOperator(task_id='transform_core')
load_lake      = EmptyOperator(task_id='load_lake')
load_warehouse = EmptyOperator(task_id='load_warehouse')
load_indexer   = EmptyOperator(task_id='load_indexer')

# Aligned: requires ALL branches to succeed
pipeline_complete = EmptyOperator(task_id='pipeline_complete', trigger_rule='all_success')
# Unaligned: fires as soon as ONE branch succeeds
partial_notify    = EmptyOperator(task_id='partial_notify', trigger_rule='one_success')

transform_core >> [load_lake, load_warehouse, load_indexer]
[load_lake, load_warehouse, load_indexer] >> pipeline_complete
[load_lake, load_warehouse, load_indexer] >> partial_notify
```

**Trade-offs.**
- *Worker-slot monopolization* — launching dozens of parallel tasks can exhaust orchestrator slots and starve other production DAGs.
- *The straggler bottleneck* — in an aligned topology, total pipeline speed is capped by the slowest branch.

## Conditional Router

**Problem.** User-profile updates arrive from multiple regions. EU data must pass through GDPR anonymization and masking; US/APAC data can load directly. Cramming all regional variations into one transformation script makes the pipeline fragile and unreadable.

**Solution.** Evaluate a runtime condition (file prefix, config value, record count) at a routing point, then send execution down **exactly one path**, skipping the alternatives.

```text
Inbound file ──▶ Router (evaluates region)
                   ├──▶ EU: GDPR masking flow ──▶ load
                   └──▶ Default: fast load      (other path skipped)
```

```python
from airflow.operators.python import BranchPythonOperator
from airflow.operators.empty import EmptyOperator

def determine_compliance_path(**context):
    region = context['params'].get('region', 'US').upper()
    return 'eu_gdpr_masking_workflow' if region == 'EU' else 'standard_cleartext_load'

route = BranchPythonOperator(
    task_id='evaluate_region_routing',
    python_callable=determine_compliance_path,
    params={'region': 'EU'},
)

eu_flow  = EmptyOperator(task_id='eu_gdpr_masking_workflow')
std_flow = EmptyOperator(task_id='standard_cleartext_load')
sink     = EmptyOperator(
    task_id='final_consolidation_sink',
    trigger_rule='one_success',   # critical — see trade-offs
)

route >> [eu_flow, std_flow]
eu_flow >> sink
std_flow >> sink
```

**Trade-offs.**
- *Skipped-status propagation* — orchestrators propagate "skipped" downstream: if a parent is skipped, its children skip too. Set the join task's trigger rule to `one_success` or `none_failed_min_one_success` or your pipeline silently ends early.
- *Monitoring complexity* — task colors flip between green and skipped across runs, which confuses support teams. Descriptive task names and docs are essential.

## Single Runner

**Problem.** An hourly accounting pipeline reads the last known balances from a tracking table, processes new transactions, and writes updated totals. If the 12:00 run drags past 13:00, the 13:00 run starts in parallel, reads the same stale balances, and double-counts transactions — corrupting financial records.

**Solution.** Enforce strict sequential isolation: **exactly one instance** of the pipeline may run at any moment. New instances queue until the older one finishes.

```text
Run 12:00 [ACTIVE] ──blocks──▶ Run 13:00 [QUEUED] ──blocks──▶ Run 14:00 [QUEUED]
```

```python
with DAG(
    dag_id='stateful_ledger_aggregation',
    start_date=datetime(2026, 4, 1),
    schedule_interval='@hourly',
    max_active_runs=1,   # the Single Runner switch
    catchup=True,        # historical runs also process sequentially
) as dag:
    extract_ledger_deltas >> recalculate_account_balances
```

**Trade-offs.**
- *Backfill bottlenecks* — re-running three months of hourly data means 2,160 strictly sequential runs.
- *Queue build-up after outages* — a 12-hour database outage piles up 12 queued runs that must drain one by one, extending recovery time.

## Concurrent Runner

**Problem.** You need to re-run a **stateless** clickstream aggregation across two years of history to apply a new attribution formula. Each day is processed independently — running the backfill one day at a time would take weeks.

**Solution.** Lift execution limits and let multiple instances of the same pipeline run in parallel, one per partition. Safe only when tasks are stateless **and idempotent**.

```text
Run A (2026-01-01) ─ RUNNING ┐
Run B (2026-01-02) ─ RUNNING ├─ all writing to isolated partitions
Run C (2026-01-03) ─ RUNNING ┘
```

```python
with DAG(
    dag_id='stateless_clickstream_backfill',
    start_date=datetime(2025, 1, 1),
    schedule_interval='@daily',
    max_active_runs=16,  # 16 instances in parallel
    catchup=True,
) as dag:
    parse_raw_logs >> load_analytics_mart
```

Requirements for safe concurrency:

- **Strict idempotency** — re-running a partition must yield identical results. Use `MERGE`/upserts or `INSERT OVERWRITE`, never blind appends.
- **Dynamic partition scoping** — scripts must template read/write targets per partition (Airflow's `{{ ds }}`) so parallel instances never touch each other's data.

**Trade-offs.**
- *Downstream exhaustion* — 16 parallel heavy transforms can exhaust warehouse connection pools and IOPS limits, slowing interactive queries for business users.
- *Out-of-order completion* — Day 5 may finish before Day 2. Downstream consumers that assume chronological arrival will show display bugs.

## Pattern Selection Matrix

| Pattern | Scope | Use it for | Key trade-off |
| --- | --- | --- | --- |
| Readiness Marker | Inter-pipeline | Safe handoffs between decoupled pipelines without time-based guessing | Stalls forever if upstream crashes before the marker |
| Fan-Out / Fan-In | Intra-pipeline | Parallelizing independent tasks to cut total runtime | Speed capped by slowest branch; slot exhaustion |
| Conditional Router | Intra-pipeline | Runtime path selection (compliance, volume, source type) | Skipped-status propagation needs explicit trigger rules |
| Single Runner | Lifecycle | Protecting stateful, incremental computations | Sequential backfills; queue build-up after outages |
| Concurrent Runner | Lifecycle | Fast parallel backfills of stateless partitions | Demands strict idempotency; can overwhelm downstream |
