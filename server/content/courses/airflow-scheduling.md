# Airflow: Scheduling, Timetables & Dynamic DAGs

## Schedule Options

| Schedule | Meaning |
| --- | --- |
| `@once` | Run a single time |
| `@hourly` | `0 * * * *` |
| `@daily` | `0 0 * * *` — midnight UTC |
| `@weekly` | `0 0 * * 0` |
| `@monthly` | `0 0 1 * *` |
| `None` | Manual trigger only |
| `timedelta(hours=6)` | Relative interval |
| `'0 8 * * MON-FRI'` | Cron expression |
| `CronTriggerTimetable` | 2.4+ — richer cron semantics |
| `EventsTimetable` | 2.4+ — trigger on an explicit list of datetimes |

```text
# Cron: minute hour day-of-month month day-of-week
'0 6 * * *'          every day 06:00
'0 */4 * * *'        every 4 hours
'30 8 * * MON'       Mondays 08:30
'0 9-17 * * MON-FRI' hourly, business hours, weekdays
'*/15 * * * *'       every 15 minutes
```

## The Data Interval

Every DagRun covers a **data interval** — `data_interval_start` → `data_interval_end` — and the DAG runs *after* the interval ends:

```python
def my_task(**context):
    start = context['data_interval_start']
    end   = context['data_interval_end']
    ds    = context['ds']
    # Daily DAG running on 2024-01-02:
    #   start = 2024-01-01 00:00 UTC
    #   end   = 2024-01-02 00:00 UTC
    #   ds    = '2024-01-01'
```

## Custom Timetables

When cron can't express your business calendar (trading days, fiscal periods), implement a `Timetable`:

```python
from airflow.timetables.base import DagRunInfo, DataInterval, Timetable

class BusinessHoursTimetable(Timetable):
    """Run hourly, but only 9-17 Mon-Fri."""

    def next_dagrun_info(self, *, last_automated_data_interval, restriction):
        if last_automated_data_interval:
            last_start = last_automated_data_interval.end
        else:
            last_start = restriction.earliest
            if last_start is None:
                return None
        next_start = last_start.add(hours=1)
        while not (9 <= next_start.hour < 17 and next_start.weekday() < 5):
            next_start = next_start.add(hours=1)
        return DagRunInfo.interval(start=next_start, end=next_start.add(hours=1))

    def infer_manual_data_interval(self, *, run_after):
        return DataInterval(start=run_after.subtract(hours=1), end=run_after)
```

## Dataset-Driven Scheduling (2.4+)

Datasets enable **data-aware scheduling**: a producer DAG declares a dataset as its *outlet*; consumer DAGs schedule on that dataset and trigger automatically when it updates. This replaces webs of `ExternalTaskSensor`s with loose coupling.

```python
from airflow import Dataset

orders_dataset    = Dataset('s3://my-bucket/data/orders/')
customers_dataset = Dataset('s3://my-bucket/data/customers/')

@dag(schedule='@daily', ...)
def producer_dag():
    @task(outlets=[orders_dataset])       # marks the dataset updated on success
    def load_orders(): ...
    load_orders()

@dag(schedule=[orders_dataset, customers_dataset], ...)   # fires when BOTH update
def consumer_dag():
    @task
    def join_data(): ...
    join_data()
```

## Dynamic Task Mapping (2.3+)

Create a **variable number of task instances at runtime** — the count isn't known when the DAG is authored:

```python
@dag(schedule='@daily', start_date=datetime(2024, 1, 1), catchup=False)
def dynamic_mapping_dag():

    @task
    def get_tables() -> list:
        return ['orders', 'customers', 'products', 'inventory']  # could come from a DB

    @task
    def process_table(table_name: str) -> dict:
        print(f'Processing {table_name}')
        return {'table': table_name, 'rows': 1000}

    @task
    def aggregate_results(results: list) -> None:
        print(f"Total rows: {sum(r['rows'] for r in results)}")

    # .expand() = one mapped task instance per element
    aggregate_results(process_table.expand(table_name=get_tables()))

dynamic_mapping_dag()
```

```python
# expand_kwargs — map over multiple parameters at once
@task
def get_configs() -> list:
    return [
        {'schema': 'raw', 'table': 'orders',    'partition': '2024-01'},
        {'schema': 'raw', 'table': 'customers', 'partition': '2024-01'},
        {'schema': 'raw', 'table': 'orders',    'partition': '2024-02'},
    ]

load_partition.expand_kwargs(get_configs())   # 3 task instances
```

## Generating DAGs Programmatically

One DAG per table/source, from a loop:

```python
TABLES = ['orders', 'customers', 'products']

for table in TABLES:
    dag_id = f'etl_{table}'
    with DAG(dag_id=dag_id, schedule='@daily',
             start_date=datetime(2024, 1, 1), catchup=False,
             tags=['dynamic', table]) as dag:

        def run_etl(table_name=table, **context):   # ← capture via default arg!
            print(f'ETL for {table_name}')

        PythonOperator(task_id=f'process_{table}', python_callable=run_etl)

    globals()[dag_id] = dag   # register so Airflow discovers it
```

> **The closure gotcha:** Python closures capture variables **by reference**. Without the `table_name=table` default argument, every generated DAG would process the *last* table in the loop. This bug is a rite of passage — skip it.
