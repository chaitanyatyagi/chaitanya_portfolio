export default {
  id: 'purchase-gaps',
  track: 'pyspark',
  title: 'Average Days Between Purchases',
  difficulty: 'Medium',
  topics: ['Window Functions', 'Date & Time', 'Aggregation', 'Deduplication'],
  patterns: ['Previous row (LAG)', 'Gap between consecutive events'],
  domains: ['E-commerce / Sales'],
  companies: ['Amazon'],
  sources: [{ company: 'Amazon', label: 'SparkPlayground — Amazon "Customer Purchase Gaps"', url: 'https://www.sparkplayground.com/pyspark-coding-interview-questions' }],
  summary: 'How many days, on average, pass between a customer\'s consecutive purchase days?',

  description: `From \`orders\`, compute for each customer the **average number of days between consecutive purchase days**.

- Several orders on the same day count as **one** purchase day.
- Customers with fewer than two distinct purchase days are left out.
- \`avg_gap_days\` is rounded to 2 decimals.

Return \`customer_id\`, \`avg_gap_days\`, ordered by \`customer_id\`.`,

  hints: [
    'Reduce to distinct (customer_id, order_date) first.',
    'F.datediff(F.col("order_date"), F.lag("order_date").over(w)) is the gap to the previous purchase day.',
    'Average the non-null gaps per customer — avg ignores nulls, and customers with one day have only nulls.',
  ],

  entry: 'solve',
  signature: 'solve(spark: SparkSession, orders: DataFrame) -> DataFrame',
  schema: [{ name: 'orders', columns: [['order_id', 'INTEGER', 'Primary key'], ['customer_id', 'INTEGER', 'Customer'], ['order_date', 'DATE', 'Order day']] }],
  outputColumns: ['customer_id', 'avg_gap_days'],

  starter: `from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.window import Window


def solve(spark: SparkSession, orders: DataFrame) -> DataFrame:
    return orders.groupBy("customer_id").agg(F.count("*").alias("avg_gap_days")).orderBy("customer_id")
`,

  solution: `from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.window import Window


def solve(spark: SparkSession, orders: DataFrame) -> DataFrame:
    days = orders.select("customer_id", "order_date").distinct()
    w = Window.partitionBy("customer_id").orderBy("order_date")
    gaps = days.withColumn("gap", F.datediff(F.col("order_date"), F.lag("order_date").over(w)))
    return (gaps
            .where(F.col("gap").isNotNull())
            .groupBy("customer_id")
            .agg(F.round(F.avg("gap"), 2).alias("avg_gap_days"))
            .orderBy("customer_id"))
`,

  explanation: `**Distinct days → lag → datediff → average.**

1. \`distinct()\` on (customer, day) makes three orders on one day a single purchase day — otherwise you'd average in zero-day gaps.
2. \`lag\` over each customer's days gives the previous purchase day; \`datediff\` turns the pair into a gap in days.
3. Dropping the null gap (the first day) and averaging leaves exactly the customers with at least two days.

**Complexity:** one distinct, one window shuffle, one aggregation.`,

  tests: [
    {
      name: 'Example',
      ordered: true,
      tables: { orders: [[1, 7, '2024-01-01'], [2, 7, '2024-01-04'], [3, 7, '2024-01-10'], [4, 8, '2024-02-01'], [5, 9, '2024-03-01'], [6, 9, '2024-03-03']] },
      expected: [[7, 4.5], [9, 2]],
    },
    {
      name: 'Same-day orders count once',
      ordered: true,
      tables: { orders: [[1, 1, '2024-05-01'], [2, 1, '2024-05-01'], [3, 1, '2024-05-02'], [4, 1, '2024-05-02'], [5, 1, '2024-05-05']] },
      expected: [[1, 2]],
    },
    { name: 'No orders', hidden: true, ordered: true, tables: { orders: [] }, expected: [] },
    {
      name: 'Unordered input, uneven gaps, across a month',
      hidden: true,
      ordered: true,
      tables: { orders: [[1, 3, '2024-02-27'], [2, 3, '2024-01-31'], [3, 3, '2024-03-01'], [4, 2, '2024-06-10'], [5, 2, '2024-06-01']] },
      expected: [[2, 9], [3, 15]],
    },
  ],
};
