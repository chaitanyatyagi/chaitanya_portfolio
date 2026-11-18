export default {
  id: 'top-customers-by-region',
  track: 'sql',
  title: 'Top Customers by Region',
  difficulty: 'Medium',
  topics: ['Aggregation', 'Window Functions', 'Ranking', 'CTEs'],
  patterns: ['Top-N per group', 'Ranking with ties (DENSE_RANK)'],
  domains: ['E-commerce / Sales'],
  companies: ['EPAM'],
  sources: [{ company: 'EPAM', label: 'SparkPlayground — EPAM "Top Customers by Spend" (top 2 per region)', url: 'https://www.sparkplayground.com/pyspark-coding-interview-questions' }],
  summary: 'Rank customers by net revenue within each region and keep the top two ranks.',

  description: `The sales team wants to know who their most valuable customers are **in each region**.

Using the \`orders\` table, compute each customer's **net revenue** per region — the sum of \`amount\`, where refunds are recorded as negative amounts. Then rank customers within their region by net revenue, highest first.

Return every customer whose rank is **1 or 2** in their region.

- Customers with equal net revenue **share the same rank**, and the next distinct value takes the next rank (no gaps). So a region can return more than two customers.
- Return the columns \`region\`, \`customer_id\`, \`total_revenue\`, \`revenue_rank\`.
- Order the result by \`region\` ascending, then \`revenue_rank\` ascending, then \`customer_id\` ascending.`,

  hints: [
    'Aggregate first: one row per (region, customer_id) with SUM(amount).',
    'Which ranking function gives ties the same rank without leaving gaps — RANK, DENSE_RANK or ROW_NUMBER?',
    'You cannot filter on a window function in the same SELECT’s WHERE. Wrap it in a CTE (or use QUALIFY in DuckDB).',
  ],

  schema: [
    {
      name: 'orders',
      columns: [
        ['order_id', 'INTEGER', 'Primary key'],
        ['customer_id', 'INTEGER', 'Customer who placed the order'],
        ['region', 'VARCHAR', 'Sales region'],
        ['amount', 'DOUBLE', 'Order value; negative for refunds'],
        ['order_date', 'DATE', 'Date of the order'],
      ],
    },
  ],
  outputColumns: ['region', 'customer_id', 'total_revenue', 'revenue_rank'],

  starter: `-- Write your query below. The table \`orders\` is available.
-- Press Ctrl/Cmd + ' to run the examples, Ctrl/Cmd + Enter to submit.

SELECT
  region,
  customer_id
FROM orders;
`,

  solution: `WITH totals AS (
  SELECT
    region,
    customer_id,
    SUM(amount) AS total_revenue
  FROM orders
  GROUP BY region, customer_id
),
ranked AS (
  SELECT
    *,
    DENSE_RANK() OVER (
      PARTITION BY region
      ORDER BY total_revenue DESC
    ) AS revenue_rank
  FROM totals
)
SELECT region, customer_id, total_revenue, revenue_rank
FROM ranked
WHERE revenue_rank <= 2
ORDER BY region, revenue_rank, customer_id;
`,

  explanation: `**Aggregate, rank, then filter.**

1. The \`totals\` CTE collapses orders to one row per customer per region. Summing raw \`amount\` nets refunds out automatically.
2. \`DENSE_RANK()\` partitioned by \`region\` gives tied customers the same rank and does not skip the next rank — exactly the "top 2 distinct revenue values" semantics asked for. \`RANK()\` would skip ranks after ties; \`ROW_NUMBER()\` would break ties arbitrarily.
3. Window functions are evaluated after \`WHERE\`, so the filter happens in an outer query. In DuckDB/Snowflake/BigQuery you could also write \`QUALIFY revenue_rank <= 2\`.

**Complexity:** one aggregation plus one sort per region partition — O(n log n).`,

  tests: [
    {
      name: 'Example',
      ordered: true,
      tables: {
        orders: [
          [1, 101, 'North', 120.0, '2024-01-03'],
          [2, 102, 'North', 80.0, '2024-01-04'],
          [3, 101, 'North', 30.0, '2024-01-09'],
          [4, 103, 'North', 200.0, '2024-01-11'],
          [5, 201, 'South', 50.0, '2024-01-02'],
          [6, 202, 'South', 75.0, '2024-01-05'],
          [7, 203, 'South', 20.0, '2024-01-07'],
        ],
      },
      expected: [
        ['North', 103, 200, 1],
        ['North', 101, 150, 2],
        ['South', 202, 75, 1],
        ['South', 201, 50, 2],
      ],
    },
    {
      name: 'Ties share a rank',
      ordered: true,
      tables: {
        orders: [
          [1, 301, 'East', 100.0, '2024-02-01'],
          [2, 302, 'East', 60.0, '2024-02-01'],
          [3, 302, 'East', 40.0, '2024-02-03'],
          [4, 303, 'East', 60.0, '2024-02-04'],
          [5, 304, 'East', 40.0, '2024-02-05'],
        ],
      },
      expected: [
        ['East', 301, 100, 1],
        ['East', 302, 100, 1],
        ['East', 303, 60, 2],
      ],
    },
    {
      name: 'Refunds reduce revenue',
      ordered: true,
      tables: {
        orders: [
          [1, 401, 'West', 90.0, '2024-03-01'],
          [2, 401, 'West', -40.0, '2024-03-02'],
          [3, 402, 'West', 70.0, '2024-03-02'],
          [4, 403, 'West', 60.0, '2024-03-03'],
        ],
      },
      expected: [
        ['West', 402, 70, 1],
        ['West', 403, 60, 2],
      ],
    },
    {
      name: 'Single-customer region and a two-way tie',
      hidden: true,
      ordered: true,
      tables: {
        orders: [
          [1, 501, 'Central', 10.0, '2024-04-01'],
          [2, 501, 'Central', 15.0, '2024-04-02'],
          [3, 601, 'North', 40.0, '2024-04-01'],
          [4, 602, 'North', 40.0, '2024-04-03'],
        ],
      },
      expected: [
        ['Central', 501, 25, 1],
        ['North', 601, 40, 1],
        ['North', 602, 40, 1],
      ],
    },
    {
      name: 'Empty table',
      hidden: true,
      ordered: true,
      tables: { orders: [] },
      expected: [],
    },
    {
      name: 'Many regions, decimals and zero revenue',
      hidden: true,
      ordered: true,
      tables: {
        orders: [
          [1, 1, 'A', 10.0, '2024-05-01'],
          [2, 2, 'A', 20.0, '2024-05-01'],
          [3, 3, 'A', 30.0, '2024-05-02'],
          [4, 4, 'A', 15.0, '2024-05-02'],
          [5, 4, 'A', 15.0, '2024-05-03'],
          [6, 5, 'B', 5.5, '2024-05-01'],
          [7, 6, 'B', 5.25, '2024-05-02'],
          [8, 7, 'C', 10.0, '2024-05-01'],
          [9, 7, 'C', -10.0, '2024-05-04'],
          [10, 8, 'C', -5.0, '2024-05-05'],
        ],
      },
      expected: [
        ['A', 3, 30, 1],
        ['A', 4, 30, 1],
        ['A', 2, 20, 2],
        ['B', 5, 5.5, 1],
        ['B', 6, 5.25, 2],
        ['C', 7, 0, 1],
        ['C', 8, -5, 2],
      ],
    },
  ],
};
