# Airflow: Interview Q&A

The questions that actually come up — with the answers that demonstrate production experience rather than tutorial knowledge.

## execution_date vs. actual run time?

`execution_date` (`data_interval_start` in 2.2+) is the **logical** date identifying the data interval being processed. The task runs *after* `data_interval_end`. For a daily DAG, the run for Jan 1's data executes at midnight Jan 2. Get this wrong and every backfill and date filter you write is off by one interval.

## How do you pass data between tasks?

Via **XCom**. Return a value from a callable (auto-pushed) or `ti.xcom_push`; retrieve with `ti.xcom_pull(task_ids=...)`. In TaskFlow, function arguments resolve from XCom automatically. Keep values small — paths, counts, flags. Large data goes to S3/GCS; pass the URI.

## What happens with catchup=True and an old start_date?

Airflow creates a DagRun for **every missed interval** between `start_date` and now — potentially thousands, all at once. Production DAGs set `catchup=False` and use `airflow dags backfill` for controlled historical processing.

## KubernetesPodOperator vs. KubernetesExecutor?

The **executor** runs *all* tasks of *all* DAGs as pods — right for homogeneous, containerized workloads. The **operator** runs *one specific task* as a pod while the rest use regular workers — right when a single task needs a custom image, GPU, or unusual resources.

## Why prefer sensor mode='reschedule' over 'poke'?

`poke` holds a worker slot for the entire wait, sleeping between checks — 20 long-waiting sensors can starve a 20-slot deployment doing literally nothing. `reschedule` releases the slot between checks. Always use it for waits longer than a couple of minutes; consider deferrable operators for very long waits.

## How do you make a task idempotent?

Design it so multiple executions produce identical results. DB writes: **UPSERT/MERGE**, or delete-the-range-then-insert. Files: **overwrite** destination partitions, never append. This is non-negotiable — retries and backfills assume it.

## Why doesn't my midnight DAG run at exactly midnight?

Three stacked delays: (1) interval semantics — the run for a day fires after that day *ends*; (2) scheduler heartbeat — DAG files are evaluated at intervals, not continuously; (3) queue time — the task waits for an executor slot.

## What is DAG serialization and why does it matter?

Parsed DAGs are stored in the metadata DB, so the **webserver reads from the DB instead of parsing DAG files**. The webserver can run on a machine without DAG files entirely — essential for clean multi-node deployments. Default-on in 2.x.

## 50 parallel table loads, but the DB allows 10 connections?

**Pools.** `airflow pools set db_pool 10`, assign all 50 tasks `pool='db_pool'` — Airflow queues them and runs at most 10 concurrently. Use `pool_slots=N` for tasks that consume multiple connections.

## How do you implement cross-DAG dependencies?

Three tools, in order of coupling: `ExternalTaskSensor` (wait for another DAG's task; set `execution_delta` when schedules differ), `TriggerDagRunOperator` (push-style explicit triggering), and **Datasets** (2.4+, loosest coupling — consumer DAGs schedule on data updates, not on other DAGs).

## What are Datasets (2.4+)?

Data-aware scheduling. A producer task declares `outlets=[Dataset('s3://.../orders/')]`; a consumer DAG uses `schedule=[that_dataset]` and triggers automatically when all its input datasets update. Decouples producers from consumers without sensor webs.

## The 'Variable at parse time' anti-pattern?

Calling `Variable.get()` (or any I/O) at module level in a DAG file executes on **every scheduler parse cycle** — hundreds of times an hour, hammering the metadata DB. Fetch inside task callables, where the code runs only during task execution.

## How would you debug a task that works locally but fails in production?

In order: (1) `airflow tasks test dag_id task_id date` on the prod host — bypasses the scheduler and prints logs directly; (2) diff the runtime environment — worker image, Python deps, env vars, connections; (3) check the task's pod/worker resources — OOM kills often masquerade as mysterious failures; (4) inspect XCom inputs — upstream may have pushed something unexpected; (5) check for timezone/interval math on the logical date.

## How do you handle a DAG that must process late-arriving data?

Options, by rigor: (1) delay the schedule to when data is reliably complete; (2) a **Readiness Marker** sensor on the upstream output instead of trusting the clock; (3) reprocess windows — each run recomputes the trailing N days to absorb stragglers; (4) event-driven triggering (datasets or storage notifications) so the pipeline runs when data actually arrives.
