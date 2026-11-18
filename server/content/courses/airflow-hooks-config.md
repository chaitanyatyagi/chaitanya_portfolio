# Airflow: Hooks, Connections, Variables, Pools & SLAs

## Hooks

Hooks are interfaces to external platforms — they abstract connection management, auth, and sessions. Operators use hooks internally; you can also use them directly inside Python callables.

```python
# PostgresHook — the workhorse
from airflow.providers.postgres.hooks.postgres import PostgresHook

def query_db(**context):
    hook = PostgresHook(postgres_conn_id='my_postgres')

    rows  = hook.get_records('SELECT id, name FROM customers LIMIT 10')
    count = hook.get_first('SELECT COUNT(*) FROM orders')[0]
    df    = hook.get_pandas_df('SELECT * FROM orders WHERE dt = %s',
                               parameters=['2024-01-15'])
    hook.run('DELETE FROM staging WHERE dt < %s', parameters=['2024-01-01'])

    engine = hook.get_sqlalchemy_engine()
    df.to_sql('target_table', engine, if_exists='append', index=False)
```

```python
# S3Hook
from airflow.providers.amazon.aws.hooks.s3 import S3Hook

def s3_operations(**context):
    hook = S3Hook(aws_conn_id='aws_default')
    exists  = hook.check_for_key('data/2024-01-15/file.csv', 'my-bucket')
    keys    = hook.list_keys(bucket_name='my-bucket', prefix='data/2024/')
    hook.load_file(filename='/tmp/output.csv',
                   key='data/{{ ds }}/output.csv',
                   bucket_name='my-bucket', replace=True)
    content = hook.read_key('data/2024/config.json', 'my-bucket')
```

## Connections

Four ways to manage them, in rough order of production preference:

```bash
# 1. Environment variables (preferred in production — no DB writes, secret-manager friendly)
AIRFLOW_CONN_MY_POSTGRES='postgresql://user:pass@localhost:5432/mydb'
AIRFLOW_CONN_AWS_DEFAULT='aws://@?region_name=us-east-1'

# 2. CLI
airflow connections add my_postgres \
  --conn-type postgres --conn-host localhost \
  --conn-login user --conn-password pass \
  --conn-port 5432 --conn-schema mydb

# 3. The UI: Admin → Connections
# 4. Python (test setups only)
```

## Custom Hook

```python
from airflow.hooks.base import BaseHook

class MyAPIHook(BaseHook):
    conn_name_attr = 'my_api_conn_id'
    default_conn_name = 'my_api_default'

    def __init__(self, my_api_conn_id: str = default_conn_name):
        super().__init__()
        self.conn = self.get_connection(my_api_conn_id)

    def get_data(self, endpoint: str, params: dict = None):
        import requests
        session = requests.Session()
        session.headers.update({'Authorization': f'Bearer {self.conn.password}'})
        resp = session.get(f'https://{self.conn.host}/{endpoint}', params=params)
        resp.raise_for_status()
        return resp.json()
```

## Variables

```python
from airflow.models import Variable

env    = Variable.get('environment', default_var='dev')
config = Variable.get('etl_config', deserialize_json=True)

Variable.set('last_run_date', '2024-01-15')
Variable.set('config', {'key': 'val'}, serialize_json=True)

# Templates: {{ var.value.my_var }}   {{ var.json.my_config.batch_size }}
```

> **The parse-time anti-pattern.** Never call `Variable.get()` (or any DB/API call) at module level in a DAG file. The scheduler re-parses DAG files constantly — top-level calls execute on *every* parse cycle, hammering the metadata DB. Fetch variables **inside task callables**, where they run only during actual task execution.

```python
# BAD — runs on every scheduler heartbeat
MY_CONFIG = Variable.get('config')

# GOOD — runs only when the task runs
def my_task():
    config = Variable.get('config', deserialize_json=True)
```

## Pools — Concurrency Control

Pools cap concurrency for a *set* of tasks — protecting databases, API rate limits, or any scarce resource.

```bash
airflow pools set db_pool 5 'Max 5 concurrent DB tasks'
```

```python
PythonOperator(
    task_id='db_heavy_task',
    python_callable=run_query,
    pool='db_pool',
    pool_slots=2,   # this task occupies 2 of the 5 slots
)
```

**Classic interview scenario:** 50 table-load tasks, but the database allows only 10 connections. Create a 10-slot pool, assign all 50 tasks to it — they queue and run at most 10 at a time. No custom throttling code.

## SLAs

```python
def sla_miss_callback(dag, task_list, blocking_task_list, slas, blocking_tis):
    print(f'SLA missed for: {[t.task_id for t in task_list]}')
    # page/Slack/PagerDuty here

with DAG(
    dag_id='sla_example',
    sla_miss_callback=sla_miss_callback,
    schedule='@daily',
    start_date=datetime(2024, 1, 1),
) as dag:
    critical_task = PythonOperator(
        task_id='critical_etl',
        python_callable=run_etl,
        sla=timedelta(hours=2),   # must finish within 2h of the DagRun start
    )
```
