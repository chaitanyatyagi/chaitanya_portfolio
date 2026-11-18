# Airflow: XComs & the TaskFlow API

## XComs — Passing Data Between Tasks

XCom ("cross-communication") lets tasks exchange **small** pieces of data. Values live in the metadata DB — so keep them tiny (KB, not MB). For anything big, write to S3/GCS/HDFS and pass the **path** via XCom.

```python
# Method 1: return value → auto-pushed as XCom key 'return_value'
def extract(**context):
    return {'records': 1500, 'source': 's3://bucket/path'}

# Method 2: explicit push
def transform(**context):
    ti = context['ti']
    ti.xcom_push(key='record_count', value=1500)
    ti.xcom_push(key='output_path', value='s3://output/data.parquet')

# Pulling
def load(**context):
    ti = context['ti']
    data  = ti.xcom_pull(task_ids='extract', key='return_value')
    count = ti.xcom_pull(task_ids='transform', key='record_count')

    # Pull the same key from several tasks at once → list
    counts = ti.xcom_pull(task_ids=['extract_a', 'extract_b'], key='record_count')
    print(f'Total records: {sum(counts)}')

# In Jinja templates
BashOperator(
    task_id='echo_path',
    bash_command="echo {{ ti.xcom_pull(task_ids='extract', key='output_path') }}",
)
```

> **Never put DataFrames or raw data in XCom.** It bloats the metadata DB and slows the scheduler for every DAG in the deployment. Paths, counts, and small dicts only.

**Custom XCom backends** (2.x) reroute XCom storage to object storage when you genuinely need bigger payloads:

```ini
# airflow.cfg
[core]
xcom_backend = airflow.providers.amazon.aws.xcom_backends.s3.S3XComBackend
```

## TaskFlow API — Modern DAG Authoring

TaskFlow (Airflow 2.0+) uses decorators to define DAGs and tasks. XCom wiring becomes **automatic function arguments** — the preferred style for new DAGs.

```python
from airflow.decorators import dag, task
from datetime import datetime, timedelta

@dag(
    dag_id='taskflow_etl',
    schedule='@daily',
    start_date=datetime(2024, 1, 1),
    catchup=False,
    tags=['taskflow'],
)
def my_etl_dag():

    @task(task_id='extract')
    def extract() -> dict:
        return {'order_count': 1500, 'path': 's3://bucket/orders.csv'}  # auto-XCom

    @task(retries=2, retry_delay=timedelta(minutes=5), pool='heavy_tasks')
    def transform(raw: dict) -> dict:
        return {'cleaned_count': raw['order_count'], 'source': raw['path']}

    @task
    def load(data: dict) -> None:
        print(f"Loading {data['cleaned_count']} records")

    load(transform(extract()))   # dependencies inferred from the data flow

dag_instance = my_etl_dag()
```

## TaskFlow Power Features

```python
# multiple_outputs: dict keys become individually addressable XComs
@task(multiple_outputs=True)
def extract() -> dict:
    return {'count': 100, 'path': 's3://...'}

result = extract()
# result['count'], result['path'] are separate XCom references

# @task.branch — TaskFlow-native branching
@task.branch(task_id='check_volume')
def check_volume(stats: dict) -> str:
    return 'heavy_load' if stats['count'] > 1000 else 'light_load'

# @task.sensor — decorated sensors
from airflow.sensors.base import PokeReturnValue

@task.sensor(poke_interval=30, timeout=3600, mode='reschedule')
def wait_for_file(path: str) -> PokeReturnValue:
    import os
    exists = os.path.exists(path)
    return PokeReturnValue(is_done=exists, xcom_value=path if exists else None)
```

## Mixing TaskFlow with Classic Operators

Both styles interoperate — chain them with `>>` and function calls:

```python
@dag(schedule='@daily', start_date=datetime(2024, 1, 1), catchup=False)
def mixed_dag():

    @task
    def get_config() -> dict:
        return {'schema': 'public', 'table': 'orders'}

    create_table = PostgresOperator(
        task_id='create_table',
        postgres_conn_id='pg_default',
        sql='CREATE TABLE IF NOT EXISTS staging.orders (...)',
    )

    @task
    def load_data(config: dict):
        print(f"Loading into {config['schema']}.{config['table']}")

    cfg = get_config()
    create_table >> load_data(cfg)   # classic >> mixed with TaskFlow calls

mixed_dag()
```
