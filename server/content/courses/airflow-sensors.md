# Airflow: Sensors

Sensors are operators that **wait for a condition** — a file landing, an API turning healthy, another DAG finishing. Used carelessly, they silently eat your worker slots; used well, they're the glue of cross-system coordination.

## Sensor Modes — the interview favorite

| Mode | Behavior |
| --- | --- |
| `poke` *(default)* | Holds a worker slot the whole time, sleeping between checks. Wasteful. |
| `reschedule` | **Releases the worker slot between checks.** Far more scalable — the production default. |
| deferrable | 2.2+ — offloads the wait to the async Triggerer process. Most efficient for long waits. |

> In `poke` mode, 20 sensors waiting 2 hours = 20 worker slots doing nothing. In `reschedule` mode they occupy slots only during the actual checks. Always prefer `reschedule` (or deferrable operators) for long waits.

## The Common Sensors

```python
from airflow.sensors.filesystem import FileSensor
from airflow.providers.amazon.aws.sensors.s3 import S3KeySensor
from airflow.sensors.external_task import ExternalTaskSensor
from airflow.providers.common.sql.sensors.sql import SqlSensor
from airflow.providers.http.sensors.http import HttpSensor

# Local file
wait_file = FileSensor(
    task_id='wait_for_file',
    filepath='/data/input/{{ ds }}/data.csv',
    poke_interval=60,     # check every 60s
    timeout=3600,         # give up after 1 hour
    mode='reschedule',
    soft_fail=False,      # True = mark skipped instead of failed on timeout
)

# S3 object
wait_s3 = S3KeySensor(
    task_id='wait_for_s3',
    bucket_name='my-bucket',
    bucket_key='data/{{ ds }}/file.parquet',
    aws_conn_id='aws_default',
    mode='reschedule',
    poke_interval=30,
)

# HTTP health check
wait_api = HttpSensor(
    task_id='wait_for_api',
    http_conn_id='my_api',
    endpoint='health',
    response_check=lambda r: r.json()['status'] == 'ok',
    mode='reschedule',
    poke_interval=120,
)

# Another DAG's task
wait_upstream = ExternalTaskSensor(
    task_id='wait_for_upstream_dag',
    external_dag_id='upstream_pipeline',
    external_task_id='final_task',            # None = whole DagRun
    execution_delta=timedelta(hours=1),       # offset when schedules differ
    mode='reschedule',
    timeout=7200,
)

# SQL condition
wait_data = SqlSensor(
    task_id='wait_for_data',
    conn_id='my_postgres',
    sql='SELECT COUNT(*) FROM staging WHERE dt = {{ ds }}',
    success=lambda cnt: cnt[0][0] > 0,
    mode='reschedule',
)
```

## Writing a Custom Sensor

Subclass `BaseSensorOperator` and implement `poke()` — return `True` when the condition is met:

```python
from airflow.sensors.base import BaseSensorOperator

class DataReadySensor(BaseSensorOperator):
    """Wait until an external API reports data is ready."""
    template_fields = ('endpoint', 'date_str')

    def __init__(self, endpoint: str, date_str: str, **kwargs):
        super().__init__(**kwargs)
        self.endpoint = endpoint
        self.date_str = date_str

    def poke(self, context) -> bool:
        import requests
        resp = requests.get(f'https://api.example.com/{self.endpoint}/{self.date_str}')
        return resp.json().get('ready', False)

sensor = DataReadySensor(
    task_id='check_data_ready',
    endpoint='status',
    date_str='{{ ds }}',
    mode='reschedule',
    poke_interval=120,
    timeout=14400,
)
```

## Sensor Hygiene Checklist

- **Always set a `timeout`** — a sensor with no timeout can wait forever, hiding a dead upstream (see the Readiness Marker pattern's orphaned-lock trade-off).
- **`mode='reschedule'`** for anything that might wait more than a couple of minutes.
- **`soft_fail=True`** when a missing upstream should skip downstream work rather than page someone.
- **Alert on sensor timeouts** — a timeout usually means the upstream is broken, and that's the alert you actually care about.
- Consider **dataset-driven scheduling** (Airflow 2.4+) or event-driven triggers instead of long polling when the platform supports it.
