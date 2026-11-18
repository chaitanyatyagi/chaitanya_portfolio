# Airflow: DAGs Deep Dive

Everything in Airflow starts with the DAG definition. Getting the properties right — retries, catchup, concurrency limits, templating — is the difference between a pipeline that self-heals and one that pages you at 3 AM.

## Anatomy of a Production DAG

```python
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.bash import BashOperator
from datetime import datetime, timedelta

default_args = {
    'owner': 'data_engineer',
    'depends_on_past': False,          # don't wait for previous run's success
    'email': ['alerts@company.com'],
    'email_on_failure': True,
    'email_on_retry': False,
    'retries': 3,
    'retry_delay': timedelta(minutes=5),
    'retry_exponential_backoff': True,  # 5m, 10m, 20m…
    'max_retry_delay': timedelta(hours=1),
    'execution_timeout': timedelta(hours=2),
}

with DAG(
    dag_id='my_etl_pipeline',
    default_args=default_args,
    description='Daily ETL pipeline',
    schedule='0 6 * * *',              # every day, 6 AM UTC
    start_date=datetime(2024, 1, 1),
    catchup=False,                     # do NOT auto-backfill
    max_active_runs=1,                 # one DagRun at a time
    max_active_tasks=5,                # parallel tasks within a run
    tags=['etl', 'production'],
    params={'env': 'prod'},            # runtime parameters
) as dag:

    start = BashOperator(task_id='start', bash_command='echo starting')

    def process(**context):
        ds = context['ds']             # execution date 'YYYY-MM-DD'
        print(f'Processing {ds}')

    process_task = PythonOperator(task_id='process_data', python_callable=process)
    end = BashOperator(task_id='end', bash_command='echo done')

    start >> process_task >> end
```

## Dependency Syntax

```python
# Bitshift operators (the idiomatic way)
task_a >> task_b >> task_c            # a → b → c
task_a >> [task_b, task_c] >> task_d  # fan-out, then fan-in

# Method style
task_b.set_upstream(task_a)           # same as task_a >> task_b
task_b.set_downstream(task_c)         # same as task_b >> task_c

# Cross-DAG dependency
from airflow.sensors.external_task import ExternalTaskSensor
wait_for_upstream = ExternalTaskSensor(
    task_id='wait_for_dag_x',
    external_dag_id='upstream_dag',
    external_task_id='final_task',    # None = wait for the entire DagRun
    mode='reschedule',                # frees the worker slot while waiting
    timeout=3600,
)
```

## Runtime Params

```python
from airflow.models.param import Param

with DAG(
    dag_id='parameterized_dag',
    params={
        'table_name': Param('orders', type='string', description='Target table'),
        'batch_size': Param(1000, type='integer', minimum=100, maximum=10000),
        'dry_run':    Param(False, type='boolean'),
    },
    schedule=None,   # manual trigger only
) as dag:
    def run_etl(**context):
        p = context['params']
        print(f"Loading {p['table_name']} in batches of {p['batch_size']}")
```

## DAG Properties That Matter in Production

| Property | Why it matters |
| --- | --- |
| `catchup=False` | Disables auto-backfill. **Almost always set this** — backfill explicitly instead |
| `max_active_runs` | Caps concurrent DagRuns; protects downstream systems and the metadata DB |
| `max_active_tasks` | Caps parallelism inside one DagRun |
| `is_paused_upon_creation` | `True` prevents immediate triggering on first deploy |
| `render_template_as_native_obj` | Jinja returns Python objects instead of strings |
| `on_failure_callback` | Hook for alerting when the whole DAG fails |
| `sla_miss_callback` | Hook for SLA breach alerts |

## Jinja Templating

Templated operator fields accept Jinja2 expressions, resolved per run:

```python
# The template context cheat sheet
# {{ ds }}                  execution date: '2024-01-15'
# {{ ds_nodash }}           '20240115'
# {{ ts }}                  ISO timestamp
# {{ data_interval_start }} start of the data interval (2.2+)
# {{ data_interval_end }}   end of the data interval
# {{ prev_ds }} {{ next_ds }} adjacent logical dates
# {{ dag.dag_id }} {{ task.task_id }} {{ run_id }}
# {{ params.my_param }}     runtime param
# {{ var.value.my_var }}    Airflow Variable
# {{ conn.my_conn.host }}   Connection attribute

BashOperator(
    task_id='load',
    bash_command='python load.py --date {{ ds }} --env {{ params.env }}',
)

# Custom operators declare which fields get rendered
class MyOperator(BaseOperator):
    template_fields = ('sql', 'schema')
    template_ext = ('.sql',)   # file extensions to load + template
```

## The catchup=True Landmine

Deploy a DAG with `catchup=True` (the default!) and a `start_date` six months in the past, and Airflow will immediately create **~180 DagRuns** trying to "catch up" — hammering your database and downstream systems. Set `catchup=False` and use `airflow dags backfill` for controlled historical runs:

```bash
airflow dags backfill my_dag --start-date 2024-01-01 --end-date 2024-01-31
```
