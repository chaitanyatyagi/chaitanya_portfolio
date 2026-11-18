export default {
  id: 'moving-revenue',
  track: 'pandas',
  title: 'Three-Month Moving Revenue',
  difficulty: 'Medium',
  topics: ['Window & Rolling', 'Datetime', 'GroupBy & Aggregation', 'Selection & Filtering'],
  patterns: ['Moving average (rolling window)', 'Monthly rollup'],
  domains: ['E-commerce / Sales'],
  companies: ['Amazon'],
  sources: [{ company: 'Amazon', label: 'StrataScratch — Amazon "Revenue Over Time"', url: 'https://www.stratascratch.com/blog/python-pandas-interview-questions-for-data-science-part-2' }],
  summary: 'Roll purchases up to months and smooth them with a 3-month moving average.',

  description: `\`purchases\` has one row per purchase; refunds are recorded as **negative** amounts and must be **ignored**.

1. Compute monthly revenue (sum of non-negative amounts) for every month that has at least one counted purchase. Format the month as \`YYYY-MM\`.
2. Add \`moving_avg\`: the average revenue of this month and the **two previous months in the result** (fewer at the start), rounded to 2 decimals.

Return \`month\`, \`revenue\` (rounded to 2), \`moving_avg\`, ordered by \`month\`.`,

  hints: [
    'Filter amount >= 0 first.',
    'df["created_at"].dt.strftime("%Y-%m") gives the month label — and sorts correctly as text.',
    'Series.rolling(3, min_periods=1).mean() averages up to three rows.',
  ],

  entry: 'solve',
  signature: 'solve(purchases: pd.DataFrame) -> pd.DataFrame',
  schema: [{ name: 'purchases', columns: [['purchase_id', 'INTEGER', 'Primary key'], ['created_at', 'DATE', 'Purchase day'], ['amount', 'DOUBLE', 'Negative for refunds']] }],
  outputColumns: ['month', 'revenue', 'moving_avg'],

  starter: `import pandas as pd


def solve(purchases: pd.DataFrame) -> pd.DataFrame:
    df = purchases.assign(month=purchases["created_at"].dt.strftime("%Y-%m"))
    out = df.groupby("month", as_index=False)["amount"].sum().rename(columns={"amount": "revenue"})
    out["moving_avg"] = out["revenue"]
    return out
`,

  solution: `import pandas as pd


def solve(purchases: pd.DataFrame) -> pd.DataFrame:
    df = purchases[purchases["amount"] >= 0].copy()
    df["month"] = df["created_at"].dt.strftime("%Y-%m")
    out = (df.groupby("month", as_index=False)["amount"].sum()
             .rename(columns={"amount": "revenue"})
             .sort_values("month")
             .reset_index(drop=True))
    out["moving_avg"] = out["revenue"].rolling(3, min_periods=1).mean().round(2)
    out["revenue"] = out["revenue"].round(2)
    return out[["month", "revenue", "moving_avg"]]
`,

  explanation: `**Filter → monthly rollup → rolling mean.** Refunds are dropped before grouping. \`rolling(3, min_periods=1)\` averages the current and up to two previous rows, so the first two months average over one and two values.

Round **after** computing the moving average — rounding monthly totals first would compound rounding error.

**Complexity:** O(n) to group plus O(m) for m months.`,

  tests: [
    {
      name: 'Example',
      ordered: true,
      tables: {
        purchases: [
          [1, '2024-01-05', 100.0], [2, '2024-01-20', 50.0], [3, '2024-02-03', 30.0], [4, '2024-02-10', -20.0],
          [5, '2024-03-15', 200.0], [6, '2024-04-01', 10.0],
        ],
      },
      expected: [['2024-01', 150, 150], ['2024-02', 30, 90], ['2024-03', 200, 126.67], ['2024-04', 10, 80]],
    },
    {
      name: 'A month with only refunds disappears',
      ordered: true,
      tables: { purchases: [[1, '2024-05-02', 40.0], [2, '2024-06-02', -40.0], [3, '2024-07-02', 20.0]] },
      expected: [['2024-05', 40, 40], ['2024-07', 20, 30]],
    },
    { name: 'No purchases', hidden: true, ordered: true, tables: { purchases: [] }, expected: [] },
    {
      name: 'Year boundary and decimals',
      hidden: true,
      ordered: true,
      tables: { purchases: [[1, '2024-12-31', 10.5], [2, '2025-01-01', 0.5], [3, '2025-01-31', 0.25], [4, '2024-11-30', 1.0]] },
      expected: [['2024-11', 1, 1], ['2024-12', 10.5, 5.75], ['2025-01', 0.75, 4.08]],
    },
  ],
};
