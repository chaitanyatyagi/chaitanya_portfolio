# Airflow: Testing, Debugging & Production Practices

## CLI Debugging Toolkit

```bash
# Test one task WITHOUT recording to the metadata DB — your first move
airflow tasks test my_dag process_data 2024-01-15

airflow dags list                       # what's deployed
airflow dags show my_dag                # visualize structure
airflow dags trigger my_dag --conf '{"env": "staging"}'
airflow dags backfill my_dag --start-date 2024-01-01 --end-date 2024-01-31
airflow tasks clear my_dag --task-regex 'process_.*' --start-date 2024-01-15
airflow dags unpause my_dag

# Is my DAG file slow to parse? (Keep it < 1 second)
time python dags/my_dag.py
```

## Unit Testing with pytest

```python
from airflow.models import DagBag
from unittest.mock import patch

class TestMyDag:
    def test_dag_loaded(self):
        dagbag = DagBag(dag_folder='dags/', include_examples=False)
        assert 'my_etl_dag' in dagbag.dags
        assert len(dagbag.import_errors) == 0

    def test_dependencies(self):
        dag = DagBag(dag_folder='dags/', include_examples=False).get_dag('my_etl_dag')
        extract   = dag.get_task('extract')
        transform = dag.get_task('transform')
        assert transform in extract.downstream_list

# Test the callable directly, mocking I/O
class TestExtractFunction:
    @patch('dags.my_dag.boto3.client')
    def test_extract(self, mock_boto):
        mock_boto.return_value.list_objects_v2.return_value = {
            'Contents': [{'Key': 'file.csv', 'Size': 1024}]
        }
        from dags.my_dag import extract_data
        assert extract_data(ds='2024-01-15')['file_count'] == 1
```

```python
# CI gate every deployment on this:
def test_no_import_errors():
    dagbag = DagBag(dag_folder='dags/', include_examples=False)
    assert not dagbag.import_errors, f'Import errors: {dagbag.import_errors}'
```

## The Production Checklist

| Practice | Why |
| --- | --- |
| `catchup=False` | No surprise backfills; backfill explicitly |
| `max_active_runs=1` | Concurrent DagRuns don't trample downstream systems |
| Sensors in `reschedule` mode | Free worker slots while waiting |
| DAG parse time < 1s | No I/O, API calls, or heavy imports at module level |
| Connections & Variables, never hardcoded | Credentials stay out of DAG files |
| Tag every DAG | Filterable UI at scale |
| Set `execution_timeout` | No task hangs forever |
| Pools for scarce resources | DB/API protection built into the platform |
| **Idempotent tasks** | Same result on every rerun — `MERGE`/upsert or delete+insert, never blind appends |
| **Atomic writes** | Write to temp location, move/rename on success |
| Small XComs only | Big payloads go to object storage; pass the URI |
| One responsibility per DAG | Compose small DAGs via sensors/datasets, not monoliths |

## Monitoring & Alerting

```python
def on_failure_callback(context):
    dag_id  = context['dag'].dag_id
    task_id = context['task'].task_id
    exc     = context.get('exception')

    from airflow.providers.slack.operators.slack_webhook import SlackWebhookHook
    SlackWebhookHook(slack_webhook_conn_id='slack_alert').send(
        text=f":red_circle: *FAILED* `{dag_id}` / `{task_id}` on `{context['ds']}`\n```{exc}```"
    )

# Apply everywhere via default_args
default_args = {'on_failure_callback': on_failure_callback}
```

```ini
# Prometheus metrics via StatsD
[metrics]
statsd_on = True
statsd_host = localhost
statsd_port = 8125
statsd_prefix = airflow
```

## Idempotency — the habit that saves you

Every retry, every backfill, every manual re-run assumes tasks can safely execute twice. Concretely:

- **Database writes:** `MERGE`/UPSERT keyed on deterministic IDs — or `DELETE` the date range, then `INSERT`.
- **File outputs:** overwrite the destination partition (`INSERT OVERWRITE`, `mode('overwrite')`), never append blindly.
- **Notifications/side effects:** guard with state checks so a rerun doesn't email your users twice.

If a task can't be made idempotent (true one-shot side effects), isolate it, mark it clearly, and gate it behind explicit run conditions — don't let it sit in the middle of a retried pipeline.
