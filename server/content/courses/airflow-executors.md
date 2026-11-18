# Airflow: Executors & Scaling

The executor decides **how and where tasks physically run**. Choosing one is an infrastructure decision with direct consequences for isolation, elasticity, and operational overhead.

## Executor Comparison

| Executor | Characteristics |
| --- | --- |
| `SequentialExecutor` | Single process, one task at a time. Dev/testing only — never production |
| `LocalExecutor` | Python multiprocessing on one machine. Fine for small/medium workloads |
| `CeleryExecutor` | Distributes tasks across worker machines via Redis/RabbitMQ. The production standard |
| `KubernetesExecutor` | Every task runs in its own K8s pod. Perfect isolation, elastic scaling, no idle workers |
| `CeleryKubernetesExecutor` | Hybrid — Celery workers by default, K8s pods for selected tasks |
| `LocalKubernetesExecutor` | Hybrid — local by default, K8s pods for selected tasks |
| `DebugExecutor` | Runs tasks as plain Python calls for IDE debugging |

## CeleryExecutor Setup

```ini
# airflow.cfg
[core]
executor = CeleryExecutor

[celery]
broker_url = redis://redis:6379/0
result_backend = db+postgresql://user:pass@postgres/airflow
worker_concurrency = 16        # tasks per worker
```

```bash
# Start workers, optionally pinned to queues
airflow celery worker --concurrency 16 --queues default,heavy

# Flower — Celery monitoring UI
airflow celery flower
```

```python
# Route heavy tasks to dedicated workers
PythonOperator(
    task_id='heavy_task',
    python_callable=run_spark,
    queue='heavy',
    pool='spark_pool',
)
```

## KubernetesExecutor Setup

```ini
[core]
executor = KubernetesExecutor

[kubernetes]
namespace = airflow
worker_container_repository = apache/airflow
worker_container_tag = 2.8.0
delete_worker_pods = True
delete_worker_pods_on_failure = False   # keep failed pods for debugging
```

```python
# Per-task pod override — e.g., a GPU training task
from kubernetes.client import models as k8s

PythonOperator(
    task_id='ml_training',
    python_callable=train_model,
    executor_config={
        'pod_override': k8s.V1Pod(spec=k8s.V1PodSpec(containers=[
            k8s.V1Container(
                name='base',
                resources=k8s.V1ResourceRequirements(
                    requests={'cpu': '4', 'memory': '16Gi', 'nvidia.com/gpu': '1'},
                    limits={'cpu': '4', 'memory': '16Gi', 'nvidia.com/gpu': '1'},
                ),
            )
        ]))
    },
)
```

> **Rule of thumb:** homogeneous workloads → Celery; wildly varying resource needs (some tasks need 16 GB + GPU, others need 100 MB) → Kubernetes. For a single special task in an otherwise normal DAG, use `KubernetesPodOperator` rather than switching the whole executor.

## Scheduler & Performance Tuning

```ini
[scheduler]
min_file_process_interval = 30    # re-parse DAG files every 30s (NOT 0)
dag_dir_list_interval = 300       # rescan the DAG folder every 5 min
max_tis_per_query = 512           # scheduler query batch size
parsing_processes = 4             # parallel DAG-file parsing

[core]
parallelism = 64                  # max running tasks across ALL DAGs
max_active_tasks_per_dag = 16     # per-DAG default

# DAG serialization (2.x default — verify it's on)
store_serialized_dags = True

# Metadata DB connection pool
sql_alchemy_pool_size = 5
sql_alchemy_max_overflow = 10
sql_alchemy_pool_recycle = 1800
```

## DAG Serialization — why it matters

Serialization stores parsed DAG objects **in the metadata DB**. The webserver reads from the DB instead of re-parsing DAG files itself — so it can run on a machine *without* the DAG files at all. This is what makes multi-node deployments clean, and it's on by default in 2.x.

## Keep DAG Parse Time Under a Second

The scheduler re-parses every DAG file continuously. Slow parses (API calls, DB queries, heavy imports at module level) degrade the **entire deployment**, not just one DAG.

```bash
# Measure it
time python dags/my_dag.py
```

Move heavy imports inside task callables, never do I/O at module level, and keep dynamic DAG generation cheap.
