# Airflow: Architecture & Core Concepts

Apache Airflow is an open-source platform to **programmatically author, schedule, and monitor workflows**. Created at Airbnb in 2014, it treats workflows as Python code — versionable, testable, reviewable. The founding principle: *workflows as code*.

## Core Architecture

| Component | Responsibility |
| --- | --- |
| **Webserver** | Flask-based UI for monitoring DAGs, task logs, connections, variables |
| **Scheduler** | Parses DAG files, creates DagRuns, triggers tasks, respects schedules |
| **Executor** | Defines *how* tasks run — Local, Sequential, Celery, Kubernetes |
| **Metadata DB** | PostgreSQL/MySQL — stores DagRuns, task instances, XComs, connections |
| **Worker(s)** | The processes that actually execute task code (Celery/K8s setups) |
| **Triggerer** | Airflow 2.2+ — powers deferrable operators via async I/O |
| **DAG Bag** | The container holding all DAG objects after parsing `.py` files |

```text
DAG files (.py) ──▶ Scheduler ──▶ Executor
                        │             │
                   Metadata DB ◀── Workers
                        │
                    Webserver
```

## Key Vocabulary

| Term | Meaning |
| --- | --- |
| **DAG** | Directed Acyclic Graph — tasks + dependencies |
| **Task** | A unit of work; one node in the DAG |
| **Operator** | The template that defines *what* a task does |
| **TaskInstance** | One specific run of a task at a particular logical date |
| **DagRun** | One instantiation of a DAG for a specific logical date |
| **execution_date** | The *logical* date being processed (Airflow 2.x: `data_interval_start`) |
| **Schedule interval** | Cron expression, timedelta, or timetable |
| **Backfill** | Running a DAG for historical dates retroactively |
| **Catchup** | Auto-backfilling every missed DagRun since `start_date` (default `True`!) |

## The Most-Asked Concept: execution_date vs. run time

`execution_date` (renamed `data_interval_start` in 2.2+) is the **logical date identifying the data interval being processed** — *not* when the task runs. A DagRun executes **after** its `data_interval_end`.

```text
Daily DAG, start_date = 2024-01-01

Interval:  Jan 1 00:00 ────────────▶ Jan 2 00:00
                                        │
                                        ▼
                            DAG actually RUNS here,
                            with ds = '2024-01-01'
```

This is the number-one source of confusion in interviews and in production date logic. Internalize it: **the run for January 1st's data executes at midnight on January 2nd.**

```python
def my_task(**context):
    start = context['data_interval_start']  # pendulum.DateTime
    end   = context['data_interval_end']
    ds    = context['ds']                   # 'YYYY-MM-DD' string of the interval start
    print(f'Processing data from {start} to {end}')
```

## Why Airflow (and when not)

**Airflow shines at:** scheduled batch orchestration, dependency management across heterogeneous systems, retries/alerting/SLA tracking, and giving every pipeline a UI, logs, and an audit trail for free.

**Airflow is the wrong tool for:** sub-second streaming (use Kafka/Flink/Spark Streaming — then let Airflow orchestrate *around* them), moving actual data through the scheduler (XComs are for metadata, not DataFrames), and request/response services.

## Scheduling Lag — the classic gotcha

A daily DAG scheduled `0 0 * * *` never fires at *exactly* midnight, for three stacked reasons:

1. **Interval semantics** — the run for Jan 1 data fires *after* the interval ends, i.e., at midnight Jan 2.
2. **Scheduler heartbeat** — the scheduler evaluates DAGs at intervals (`min_file_process_interval`), adding seconds to minutes.
3. **Queue time** — the task waits for a free worker slot, depending on executor load.
