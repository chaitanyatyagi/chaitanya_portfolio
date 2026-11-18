export default {
  id: 'day-over-day-change',
  track: 'pyspark',
  title: 'Day-over-Day Price Change',
  difficulty: 'Easy',
  topics: ['Window Functions', 'Date & Time', 'NULL Handling'],
  patterns: ['Previous row (LAG)'],
  domains: ['Finance / Markets'],
  companies: ['Nielsen'],
  sources: [{ company: 'Nielsen', label: 'SparkPlayground — Nielsen "Daily Stock Price Change"', url: 'https://www.sparkplayground.com/pyspark-coding-interview-questions' }],
  summary: 'Compare each closing price with the previous trading day\'s close.',

  description: `\`prices\` has one closing price per ticker per trading day (weekends and holidays have no row).

For every row, add \`change\` = this \`close\` minus the **previous trading day's** \`close\` for the same ticker, rounded to 2 decimals. The first day of each ticker has \`change = null\`.

Return \`ticker\`, \`trade_date\`, \`close\`, \`change\`, ordered by \`ticker\`, \`trade_date\`.`,

  hints: [
    'F.lag("close").over(Window.partitionBy("ticker").orderBy("trade_date")) is the previous row\'s close.',
    'Subtracting a null gives null — exactly what the first day needs.',
  ],

  entry: 'solve',
  signature: 'solve(spark: SparkSession, prices: DataFrame) -> DataFrame',
  schema: [{ name: 'prices', columns: [['ticker', 'VARCHAR', 'Symbol'], ['trade_date', 'DATE', 'Trading day'], ['close', 'DOUBLE', 'Closing price']] }],
  outputColumns: ['ticker', 'trade_date', 'close', 'change'],

  starter: `from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.window import Window


def solve(spark: SparkSession, prices: DataFrame) -> DataFrame:
    return prices.withColumn("change", F.lit(0.0)).orderBy("ticker", "trade_date")
`,

  solution: `from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.window import Window


def solve(spark: SparkSession, prices: DataFrame) -> DataFrame:
    w = Window.partitionBy("ticker").orderBy("trade_date")
    return (prices
            .withColumn("change", F.round(F.col("close") - F.lag("close").over(w), 2))
            .select("ticker", "trade_date", "close", "change")
            .orderBy("ticker", "trade_date"))
`,

  explanation: `**\`lag\` over a per-ticker window.** \`lag\` reads the previous row in the partition's order, so missing calendar days don't matter — "previous" means previous *trading* day. The first row has no previous row, \`lag\` returns null, and \`close - null\` is null.

**Complexity:** one shuffle by ticker and a sort within each.`,

  tests: [
    {
      name: 'Example',
      ordered: true,
      tables: { prices: [['ACME', '2024-03-01', 10.0], ['ACME', '2024-03-04', 10.5], ['ACME', '2024-03-05', 9.75], ['BOLT', '2024-03-01', 50.0]] },
      expected: [['ACME', '2024-03-01', 10, null], ['ACME', '2024-03-04', 10.5, 0.5], ['ACME', '2024-03-05', 9.75, -0.75], ['BOLT', '2024-03-01', 50, null]],
    },
    {
      name: 'Unordered input',
      ordered: true,
      tables: { prices: [['ZED', '2024-04-03', 3.0], ['ZED', '2024-04-01', 1.0], ['ZED', '2024-04-02', 2.5]] },
      expected: [['ZED', '2024-04-01', 1, null], ['ZED', '2024-04-02', 2.5, 1.5], ['ZED', '2024-04-03', 3, 0.5]],
    },
    { name: 'No rows', hidden: true, ordered: true, tables: { prices: [] }, expected: [] },
    {
      name: 'Tickers are independent',
      hidden: true,
      ordered: true,
      tables: { prices: [['A', '2024-05-02', 2.0], ['B', '2024-05-01', 100.0], ['A', '2024-05-01', 1.0], ['B', '2024-05-02', 99.99]] },
      expected: [['A', '2024-05-01', 1, null], ['A', '2024-05-02', 2, 1], ['B', '2024-05-01', 100, null], ['B', '2024-05-02', 99.99, -0.01]],
    },
  ],
};
