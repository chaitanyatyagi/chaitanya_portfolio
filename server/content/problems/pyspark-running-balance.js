export default {
  id: 'running-balance',
  track: 'pyspark',
  title: 'Running Balance per User',
  difficulty: 'Medium',
  topics: ['Window Functions', 'Column Expressions', 'Aggregation'],
  patterns: ['Running total (unbounded preceding window)', 'Signed amounts with when/otherwise'],
  domains: ['Fintech'],
  companies: ['Amazon'],
  sources: [{ company: 'Amazon', label: 'SparkPlayground — Amazon "Running Balance per User"', url: 'https://www.sparkplayground.com/pyspark-coding-interview-questions' }],
  summary: 'Turn credits and debits into each user\'s balance after every transaction.',

  description: `\`transactions\` holds wallet movements. \`txn_type\` is \`'credit'\` (adds \`amount\`) or \`'debit'\` (subtracts it).

For every transaction, return the user's **balance right after it**: the signed sum of all their transactions up to and including this one, in \`txn_ts\` order (ties broken by \`txn_id\`).

Return \`user_id\`, \`txn_id\`, \`txn_ts\`, \`balance\` (rounded to 2 decimals), ordered by \`user_id\`, \`txn_ts\`, \`txn_id\`.`,

  hints: [
    'Make a signed column first: F.when(F.col("txn_type") == "debit", -F.col("amount")).otherwise(F.col("amount")).',
    'Window.partitionBy("user_id").orderBy("txn_ts", "txn_id").rowsBetween(Window.unboundedPreceding, Window.currentRow).',
    'F.sum(signed).over(w), then F.round(…, 2).',
  ],

  entry: 'solve',
  signature: 'solve(spark: SparkSession, transactions: DataFrame) -> DataFrame',
  schema: [
    {
      name: 'transactions',
      columns: [['txn_id', 'INTEGER', 'Primary key'], ['user_id', 'INTEGER', 'Wallet owner'], ['txn_ts', 'TIMESTAMP', 'When'], ['txn_type', 'VARCHAR', "'credit' · 'debit'"], ['amount', 'DOUBLE', 'Always positive']],
    },
  ],
  outputColumns: ['user_id', 'txn_id', 'txn_ts', 'balance'],

  starter: `from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.window import Window


def solve(spark: SparkSession, transactions: DataFrame) -> DataFrame:
    return transactions.select("user_id", "txn_id", "txn_ts", F.col("amount").alias("balance"))
`,

  solution: `from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.window import Window


def solve(spark: SparkSession, transactions: DataFrame) -> DataFrame:
    signed = F.when(F.col("txn_type") == "debit", -F.col("amount")).otherwise(F.col("amount"))
    w = (Window.partitionBy("user_id")
         .orderBy("txn_ts", "txn_id")
         .rowsBetween(Window.unboundedPreceding, Window.currentRow))
    return (transactions
            .withColumn("balance", F.round(F.sum(signed).over(w), 2))
            .select("user_id", "txn_id", "txn_ts", "balance")
            .orderBy("user_id", "txn_ts", "txn_id"))
`,

  explanation: `**Signed amounts + a running-sum window.** \`when/otherwise\` turns debits negative; \`sum\` over a frame from the partition start to the current row is the running balance.

Spell the frame out: with an \`orderBy\` but no frame, Spark defaults to \`RANGE … CURRENT ROW\`, which lumps together rows with the **same** timestamp — two transactions at the same instant would both show the balance after *both*. \`rowsBetween\` plus a unique tie-breaker (\`txn_id\`) makes it exact.

**Complexity:** one shuffle by user and a sort within each partition.`,

  tests: [
    {
      name: 'Example',
      ordered: true,
      tables: {
        transactions: [
          [1, 10, '2024-06-01 09:00:00', 'credit', 100.0], [2, 10, '2024-06-01 12:00:00', 'debit', 30.5],
          [3, 20, '2024-06-01 10:00:00', 'credit', 50.0], [4, 10, '2024-06-02 08:00:00', 'credit', 10.0],
        ],
      },
      expected: [[10, 1, '2024-06-01 09:00:00', 100], [10, 2, '2024-06-01 12:00:00', 69.5], [10, 4, '2024-06-02 08:00:00', 79.5], [20, 3, '2024-06-01 10:00:00', 50]],
    },
    {
      name: 'Balance can go negative',
      ordered: true,
      tables: { transactions: [[7, 30, '2024-06-03 10:00:00', 'debit', 20.0], [8, 30, '2024-06-03 11:00:00', 'credit', 5.0]] },
      expected: [[30, 7, '2024-06-03 10:00:00', -20], [30, 8, '2024-06-03 11:00:00', -15]],
    },
    {
      name: 'Same timestamp: txn_id decides',
      hidden: true,
      ordered: true,
      tables: { transactions: [[12, 40, '2024-06-05 10:00:00', 'debit', 5.0], [11, 40, '2024-06-05 10:00:00', 'credit', 20.0]] },
      expected: [[40, 11, '2024-06-05 10:00:00', 20], [40, 12, '2024-06-05 10:00:00', 15]],
    },
    { name: 'No transactions', hidden: true, ordered: true, tables: { transactions: [] }, expected: [] },
    {
      name: 'Decimals',
      hidden: true,
      ordered: true,
      tables: { transactions: [[1, 50, '2024-07-01 00:00:00', 'credit', 0.1], [2, 50, '2024-07-01 00:00:01', 'credit', 0.2], [3, 50, '2024-07-01 00:00:02', 'debit', 0.05]] },
      expected: [[50, 1, '2024-07-01 00:00:00', 0.1], [50, 2, '2024-07-01 00:00:01', 0.3], [50, 3, '2024-07-01 00:00:02', 0.25]],
    },
  ],
};
