# Airflow: Operators & Trigger Rules

Operators are the templates tasks are built from. Three broad categories: **action** operators (do something), **transfer** operators (move data between systems), and **sensor** operators (wait for a condition — covered in their own chapter).

## PythonOperator

```python
from airflow.operators.python import PythonOperator

def my_function(param1, param2, **context):
    ti  = context['ti']        # TaskInstance
    ds  = context['ds']        # execution date
    print(f'Running for {ds}')
    return 'result_value'      # automatically stored in XCom

task = PythonOperator(
    task_id='run_python',
    python_callable=my_function,
    op_kwargs={'param1': 'hello', 'param2': 42},
    op_args=['positional_arg'],
    templates_dict={'query': 'SELECT * FROM t WHERE dt={{ ds }}'},
)
```

## BashOperator

```python
from airflow.operators.bash import BashOperator

run_script = BashOperator(
    task_id='run_script',
    bash_command='python /opt/scripts/etl.py --date {{ ds }}',
    env={'MY_VAR': 'value', 'DB_HOST': '{{ conn.my_db.host }}'},
    cwd='/opt/scripts/',
    # The last line of stdout lands in XCom as 'return_value'
)

BashOperator(
    task_id='multi_step',
    bash_command="""
    set -e                 # exit on first error
    echo 'Step 1' && python process.py
    echo 'Step 2' && python validate.py
    """,
)
```

## BranchPythonOperator

```python
from airflow.operators.python import BranchPythonOperator
from airflow.operators.empty import EmptyOperator

def choose_branch(**context):
    hour = context['data_interval_start'].hour
    if hour < 12:
        return 'morning_task'                 # a task_id string…
    return ['evening_task', 'log_task']       # …or a list of them

branch  = BranchPythonOperator(task_id='branch_on_hour', python_callable=choose_branch)
morning = EmptyOperator(task_id='morning_task')
evening = EmptyOperator(task_id='evening_task')
log     = EmptyOperator(task_id='log_task')

# Skipped branches propagate 'skipped' — the join MUST relax its trigger rule
join = EmptyOperator(task_id='join', trigger_rule='none_failed_min_one_success')

branch >> [morning, evening] >> join
branch >> log >> join
```

## Trigger Rules

| Rule | Fires when… |
| --- | --- |
| `all_success` *(default)* | every upstream task succeeded |
| `all_failed` | every upstream task failed |
| `all_done` | all upstream tasks finished, any state |
| `one_success` | at least one upstream succeeded |
| `one_failed` | at least one upstream failed |
| `none_failed` | nothing failed (success or skipped OK) |
| `none_skipped` | nothing was skipped |
| `none_failed_min_one_success` | nothing failed AND ≥1 succeeded — **use after branching** |
| `always` | unconditionally |

## SQL Operators

```python
# Airflow 2.4+ generic SQL operator
from airflow.providers.common.sql.operators.sql import SQLExecuteQueryOperator

run_query = SQLExecuteQueryOperator(
    task_id='run_query',
    conn_id='my_postgres',
    sql='sql/load_customers.sql',    # .sql files are templated too
    parameters={'batch_size': 1000},
    autocommit=True,
    split_statements=True,
)

# Older but still everywhere
from airflow.providers.postgres.operators.postgres import PostgresOperator
PostgresOperator(task_id='run_pg', postgres_conn_id='my_postgres', sql='SELECT 1')
```

## SparkSubmitOperator

```python
from airflow.providers.apache.spark.operators.spark_submit import SparkSubmitOperator

spark_job = SparkSubmitOperator(
    task_id='spark_etl',
    application='/opt/spark/jobs/etl_job.py',
    conn_id='spark_default',
    conf={
        'spark.executor.memory': '4g',
        'spark.executor.cores': '2',
        'spark.driver.memory': '2g',
    },
    application_args=['--date', '{{ ds }}', '--env', 'prod'],
    num_executors=10,
    py_files='/opt/spark/common.zip',
)
```

## The Wider Operator Toolbox

| Operator | Use |
| --- | --- |
| `EmptyOperator` | No-op structural node (replaces `DummyOperator`) |
| `S3ToRedshiftOperator` | `COPY` S3 data into Redshift |
| `GCSToGCSOperator` | Copy between GCS buckets |
| `BigQueryInsertJobOperator` | Run BigQuery queries/loads/exports |
| `HttpOperator` | Call HTTP APIs and assert on responses |
| `DockerOperator` | Run the task inside a Docker container |
| `KubernetesPodOperator` | Run the task as a K8s pod — full isolation, custom images |
| `EmailOperator` / `SlackAPIPostOperator` | Notifications |
| `TriggerDagRunOperator` | Trigger another DAG programmatically |

> **KubernetesPodOperator vs. KubernetesExecutor** — the executor makes *every* task a pod; the operator makes *one specific task* a pod. Reach for the operator when a single task needs a custom image, a GPU, or unusual resource limits while the rest of the DAG runs on normal workers.
