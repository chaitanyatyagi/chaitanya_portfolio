export default {
  id: 'yoy-growth',
  track: 'sql',
  title: 'Year-over-Year Spend Growth',
  difficulty: 'Medium',
  topics: ['Date & Time', 'Joins', 'Aggregation', 'CTEs', 'NULL Handling'],
  patterns: ['Self-join on the previous period', 'Growth rate with a zero guard (NULLIF)'],
  domains: ['E-commerce / Sales'],
  companies: ['Wayfair'],
  sources: [
    { company: 'Wayfair', label: 'DataLemur — Wayfair "Y-on-Y Growth Rate"', url: 'https://datalemur.com/questions' },
    { company: 'Wayfair', label: 'SparkPlayground — Wayfair "Compute Annual GDP Growth Rate"', url: 'https://www.sparkplayground.com/pyspark-coding-interview-questions' },
  ],
  summary: 'Compare each product\'s yearly spend with the previous calendar year.',

  description: `Roll \`transactions\` up to **total spend per product per calendar year**, then compare each year with the **previous calendar year** for the same product.

Return \`year\`, \`product_id\`, \`curr_spend\`, \`prev_spend\`, \`yoy_rate\`:

- \`prev_spend\` is the product's spend in \`year - 1\`, or NULL if it had none that year (a gap year does **not** count as "previous");
- \`yoy_rate\` = 100 × (curr − prev) / prev, rounded to 2 decimals; NULL when \`prev_spend\` is NULL **or 0**;
- spends rounded to 2 decimals.

Order by \`product_id\`, then \`year\`.`,

  hints: [
    'First aggregate: one row per (product_id, year) with SUM(spend).',
    'LEFT JOIN that result to itself on the same product and year = year - 1 — LAG would wrongly treat 2021 as "previous" for 2023.',
    'Divide by NULLIF(prev, 0) so a zero previous year gives NULL instead of an error.',
  ],

  schema: [{ name: 'transactions', columns: [['txn_id', 'INTEGER', 'Primary key'], ['product_id', 'INTEGER', 'Product'], ['spend', 'DOUBLE', 'Amount'], ['txn_date', 'DATE', 'Day']] }],
  outputColumns: ['year', 'product_id', 'curr_spend', 'prev_spend', 'yoy_rate'],

  starter: `-- Table: transactions
SELECT EXTRACT(year FROM txn_date) AS year, product_id, SUM(spend) AS curr_spend,
       NULL AS prev_spend, NULL AS yoy_rate
FROM transactions
GROUP BY 1, 2
ORDER BY 2, 1;
`,

  solution: `WITH yearly AS (
  SELECT product_id, CAST(EXTRACT(year FROM txn_date) AS INTEGER) AS year, SUM(spend) AS spend
  FROM transactions
  GROUP BY 1, 2
)
SELECT
  c.year,
  c.product_id,
  ROUND(c.spend, 2) AS curr_spend,
  ROUND(p.spend, 2) AS prev_spend,
  ROUND(100.0 * (c.spend - p.spend) / NULLIF(p.spend, 0), 2) AS yoy_rate
FROM yearly c
LEFT JOIN yearly p ON p.product_id = c.product_id AND p.year = c.year - 1
ORDER BY c.product_id, c.year;
`,

  explanation: `**Aggregate, then self-join on year − 1.** Joining on the exact previous year (rather than \`LAG\`) makes a gap year produce NULL instead of silently comparing with an older year. \`NULLIF(p.spend, 0)\` turns division by zero into NULL — a growth rate from zero is undefined.

This "current period vs. previous period" join is the backbone of YoY, MoM and WoW reporting.`,

  tests: [
    {
      name: 'Example',
      ordered: true,
      tables: { transactions: [[1, 1, 100.0, '2022-03-01'], [2, 1, 100.0, '2023-02-01'], [3, 1, 50.0, '2023-09-01'], [4, 1, 120.0, '2024-01-15'], [5, 2, 80.0, '2023-05-05']] },
      expected: [[2022, 1, 100, null, null], [2023, 1, 150, 100, 50], [2024, 1, 120, 150, -20], [2023, 2, 80, null, null]],
    },
    {
      name: 'A gap year is not "previous"',
      ordered: true,
      tables: { transactions: [[1, 3, 50.0, '2021-06-01'], [2, 3, 75.0, '2023-06-01']] },
      expected: [[2021, 3, 50, null, null], [2023, 3, 75, null, null]],
    },
    { name: 'Empty table', hidden: true, ordered: true, tables: { transactions: [] }, expected: [] },
    { name: 'Fractional growth', hidden: true, ordered: true, tables: { transactions: [[1, 4, 30.0, '2023-01-01'], [2, 4, 40.0, '2024-01-01']] }, expected: [[2023, 4, 30, null, null], [2024, 4, 40, 30, 33.33]] },
    { name: 'Previous year spend of zero', hidden: true, ordered: true, tables: { transactions: [[1, 5, 0.0, '2023-01-01'], [2, 5, 10.0, '2024-01-01']] }, expected: [[2023, 5, 0, null, null], [2024, 5, 10, 0, null]] },
  ],
};
