export default {
  id: 'current-customer-snapshot',
  track: 'pyspark',
  title: 'Current Customer Snapshot from a CDC Log',
  difficulty: 'Medium',
  topics: ['Window Functions', 'Deduplication', 'SCD & Incremental Loads'],
  patterns: ['Latest record per key', 'CDC merge (current state)', 'Window ranking (row_number)'],
  domains: ['CRM / Customer data'],
  companies: [],
  sources: [],
  summary: 'Rebuild the current state of a table from an insert/update/delete change log.',

  description: `A change-data-capture (CDC) feed streams every change to the \`customers\` table into a log, \`updates\`. Each row is a **full copy** of the customer record plus the operation that produced it: \`I\` (insert), \`U\` (update) or \`D\` (delete).

Rows can arrive **out of order**, so only \`updated_at\` tells you which change is newest.

Implement \`solve(spark, updates)\` and return a DataFrame with the **current state** of every customer:

- For each \`customer_id\`, take the record with the **latest** \`updated_at\`. Within one customer, \`updated_at\` values are unique.
- If that latest record is a delete (\`op = 'D'\`), the customer no longer exists — leave them out.
- A customer can be deleted and later re-inserted; only the latest record matters.
- Return the columns \`customer_id\`, \`email\`, \`city\`, \`updated_at\`, ordered by \`customer_id\` ascending.`,

  hints: [
    'Window.partitionBy("customer_id").orderBy(F.col("updated_at").desc()) puts each customer\'s newest change first.',
    'F.row_number() over that window marks the newest change with 1.',
    'Filter for the newest row first, then drop deletes. If you drop deletes first, an older non-deleted row would wrongly survive.',
  ],

  entry: 'solve',
  signature: 'solve(spark: SparkSession, updates: DataFrame) -> DataFrame',
  schema: [
    {
      name: 'updates',
      columns: [
        ['customer_id', 'INTEGER', 'Customer key'],
        ['email', 'VARCHAR', 'Email at the time of the change'],
        ['city', 'VARCHAR', 'City at the time of the change (nullable)'],
        ['op', 'VARCHAR', "'I' insert · 'U' update · 'D' delete"],
        ['updated_at', 'TIMESTAMP', 'When the change happened'],
      ],
    },
  ],
  outputColumns: ['customer_id', 'email', 'city', 'updated_at'],

  starter: `from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.window import Window


def solve(spark: SparkSession, updates: DataFrame) -> DataFrame:
    # updates.show() prints the input in the Result panel's stdout
    return updates.select("customer_id", "email", "city", "updated_at")
`,

  solution: `from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.window import Window


def solve(spark: SparkSession, updates: DataFrame) -> DataFrame:
    newest_first = Window.partitionBy("customer_id").orderBy(F.col("updated_at").desc())
    return (
        updates
        .withColumn("rn", F.row_number().over(newest_first))
        .filter((F.col("rn") == 1) & (F.col("op") != "D"))
        .select("customer_id", "email", "city", "updated_at")
        .orderBy("customer_id")
    )
`,

  explanation: `**Latest-row-per-key, then drop tombstones.**

1. A window partitioned by \`customer_id\` and ordered by \`updated_at\` descending ranks each customer's changes newest-first; \`row_number() == 1\` is the current version. Arrival order doesn't matter because the window orders by event time.
2. Only **after** picking the newest row do we drop deletes. Filtering \`op != 'D'\` first is the classic bug: a deleted customer's older insert would resurface.
3. Because each CDC row is a full record, the newest row *is* the current state — nulls included. (If the feed only sent changed columns, you'd use \`F.last(col, ignorenulls=True)\` per column instead.)

This is the core of building SCD Type 1 tables and \`MERGE\`-based upserts from CDC streams. In production you'd run it incrementally on new changes and merge into the target.`,

  tests: [
    {
      name: 'Example',
      ordered: true,
      tables: {
        updates: [
          [1, 'asha@mail.com', 'Pune', 'I', '2024-05-01 09:00:00'],
          [2, 'ravi@mail.com', 'Delhi', 'I', '2024-05-01 09:05:00'],
          [1, 'asha@mail.com', 'Mumbai', 'U', '2024-05-03 18:30:00'],
          [3, 'neha@mail.com', 'Jaipur', 'I', '2024-05-02 11:00:00'],
          [2, 'ravi@mail.com', 'Delhi', 'D', '2024-05-04 08:00:00'],
        ],
      },
      expected: [
        [1, 'asha@mail.com', 'Mumbai', '2024-05-03 18:30:00'],
        [3, 'neha@mail.com', 'Jaipur', '2024-05-02 11:00:00'],
      ],
    },
    {
      name: 'Changes arrive out of order',
      ordered: true,
      tables: {
        updates: [
          [5, 'b@x.com', 'Goa', 'U', '2024-06-02 10:00:00'],
          [5, 'a@x.com', 'Goa', 'I', '2024-06-01 10:00:00'],
          [6, 'c@x.com', 'Agra', 'I', '2024-06-01 12:00:00'],
        ],
      },
      expected: [
        [5, 'b@x.com', 'Goa', '2024-06-02 10:00:00'],
        [6, 'c@x.com', 'Agra', '2024-06-01 12:00:00'],
      ],
    },
    {
      name: 'Deleted, then re-created',
      ordered: true,
      tables: {
        updates: [
          [7, 'old@x.com', 'Kochi', 'I', '2024-07-01 08:00:00'],
          [7, 'old@x.com', 'Kochi', 'D', '2024-07-02 08:00:00'],
          [7, 'new@x.com', 'Kochi', 'I', '2024-07-03 08:00:00'],
        ],
      },
      expected: [
        [7, 'new@x.com', 'Kochi', '2024-07-03 08:00:00'],
      ],
    },
    {
      name: 'Every customer deleted',
      hidden: true,
      ordered: true,
      tables: {
        updates: [
          [8, 'p@x.com', 'Pune', 'I', '2024-08-01 00:00:00'],
          [8, 'p@x.com', 'Pune', 'D', '2024-08-02 00:00:00'],
          [9, 'q@x.com', 'Nagpur', 'D', '2024-08-03 00:00:00'],
          [9, 'q@x.com', 'Nagpur', 'I', '2024-08-01 00:00:00'],
        ],
      },
      expected: [],
    },
    {
      name: 'Empty change log',
      hidden: true,
      ordered: true,
      tables: { updates: [] },
      expected: [],
    },
    {
      name: 'Latest change has a null field',
      hidden: true,
      ordered: true,
      tables: {
        updates: [
          [10, 'z@x.com', 'Surat', 'I', '2024-08-01 00:00:00'],
          [10, 'z@x.com', null, 'U', '2024-08-05 00:00:00'],
          [11, 'y@x.com', 'Kota', 'I', '2024-08-02 00:00:00'],
        ],
      },
      expected: [
        [10, 'z@x.com', null, '2024-08-05 00:00:00'],
        [11, 'y@x.com', 'Kota', '2024-08-02 00:00:00'],
      ],
    },
    {
      name: 'Deleted customer with an older insert',
      hidden: true,
      ordered: true,
      tables: {
        updates: [
          [12, 'm@x.com', 'Indore', 'I', '2024-09-01 10:00:00'],
          [13, 'n@x.com', 'Bhopal', 'I', '2024-09-01 11:00:00'],
          [12, 'm@x.com', 'Indore', 'U', '2024-09-02 10:00:00'],
          [12, 'm@x.com', 'Indore', 'D', '2024-09-03 10:00:00'],
          [13, 'n@x.com', 'Ujjain', 'U', '2024-09-04 11:00:00'],
        ],
      },
      expected: [
        [13, 'n@x.com', 'Ujjain', '2024-09-04 11:00:00'],
      ],
    },
  ],
};
