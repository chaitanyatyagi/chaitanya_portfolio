export default {
  id: 'revenue-by-country',
  track: 'pandas',
  title: 'Revenue by Country',
  difficulty: 'Medium',
  topics: ['Merge & Join', 'GroupBy & Aggregation', 'Missing Data', 'Selection & Filtering', 'Sorting & Ranking'],
  patterns: ['Filter → join → aggregate', 'Named aggregation', 'Distinct count per group'],
  domains: ['E-commerce / Sales'],
  companies: [],
  sources: [],
  summary: 'Join orders to customers, drop cancellations and summarise revenue per country.',

  description: `Finance wants a per-country revenue summary from two DataFrames, \`customers\` and \`orders\`.

Implement \`solve(customers, orders)\` and return a DataFrame with one row per country:

| column | meaning |
|---|---|
| \`country\` | the customer's country — customers with no country count as \`"Unknown"\` |
| \`customers\` | number of **distinct** customers with at least one counted order |
| \`orders\` | number of counted orders |
| \`revenue\` | sum of \`amount\` over counted orders, rounded to 2 decimals |

- **Counted orders**: every order whose \`status\` is not \`"cancelled"\`.
- Orders whose \`customer_id\` doesn't exist in \`customers\` are dropped.
- Countries with no counted orders don't appear.
- Sort by \`revenue\` descending, then \`country\` ascending; the index doesn't matter.`,

  hints: [
    'Filter orders first: orders[orders["status"] != "cancelled"]',
    'An inner merge on customer_id drops orders for unknown customers.',
    'df["country"].fillna("Unknown") before grouping, or the NaN group disappears.',
    'Named aggregation does everything at once: .agg(customers=("customer_id", "nunique"), orders=("order_id", "count"), revenue=("amount", "sum"))',
  ],

  entry: 'solve',
  signature: 'solve(customers: pd.DataFrame, orders: pd.DataFrame) -> pd.DataFrame',
  schema: [
    {
      name: 'customers',
      columns: [
        ['customer_id', 'INTEGER', 'Customer key'],
        ['name', 'VARCHAR', 'Customer name'],
        ['country', 'VARCHAR', 'Country (nullable)'],
      ],
    },
    {
      name: 'orders',
      columns: [
        ['order_id', 'INTEGER', 'Order key'],
        ['customer_id', 'INTEGER', 'May reference a customer that does not exist'],
        ['amount', 'DOUBLE', 'Order value'],
        ['status', 'VARCHAR', "'placed' · 'shipped' · 'cancelled'"],
        ['order_date', 'DATE', 'Order date'],
      ],
    },
  ],
  outputColumns: ['country', 'customers', 'orders', 'revenue'],

  starter: `import pandas as pd


def solve(customers: pd.DataFrame, orders: pd.DataFrame) -> pd.DataFrame:
    # print(orders.head()) shows up in the Result panel's stdout
    return customers
`,

  solution: `import pandas as pd


def solve(customers: pd.DataFrame, orders: pd.DataFrame) -> pd.DataFrame:
    counted = orders[orders["status"] != "cancelled"]
    df = counted.merge(customers, on="customer_id", how="inner")
    df["country"] = df["country"].fillna("Unknown")
    out = df.groupby("country", as_index=False).agg(
        customers=("customer_id", "nunique"),
        orders=("order_id", "count"),
        revenue=("amount", "sum"),
    )
    out["revenue"] = out["revenue"].round(2)
    return out.sort_values(["revenue", "country"], ascending=[False, True]).reset_index(drop=True)
`,

  explanation: `**Filter → join → aggregate.**

1. Drop cancelled orders *before* joining — less data to merge, and no risk of counting them.
2. \`merge(..., how="inner")\` keeps only orders whose customer exists (a left join would keep orphans with a NaN country).
3. \`fillna("Unknown")\` matters: \`groupby\` drops NaN keys by default (\`dropna=True\`), so customers without a country would silently vanish from the report.
4. **Named aggregation** computes all three measures in one pass; \`nunique\` counts distinct customers, \`count\` counts orders.
5. Sorting by two keys with mixed directions uses \`ascending=[False, True]\`.

The SQL equivalent is \`SELECT coalesce(country,'Unknown'), count(DISTINCT customer_id), count(*), round(sum(amount),2) … GROUP BY 1 ORDER BY 4 DESC, 1\`.`,

  tests: [
    {
      name: 'Example',
      ordered: true,
      tables: {
        customers: [
          [1, 'Asha', 'India'],
          [2, 'Ben', 'UK'],
          [3, 'Chen', 'India'],
        ],
        orders: [
          [10, 1, 120.5, 'shipped', '2024-05-01'],
          [11, 2, 80.0, 'placed', '2024-05-02'],
          [12, 1, 30.0, 'cancelled', '2024-05-02'],
          [13, 3, 50.25, 'shipped', '2024-05-03'],
          [14, 2, 20.0, 'shipped', '2024-05-04'],
        ],
      },
      expected: [
        ['India', 2, 2, 170.75],
        ['UK', 1, 2, 100],
      ],
    },
    {
      name: 'Missing country and unknown customer',
      ordered: true,
      tables: {
        customers: [
          [1, 'Dev', null],
          [2, 'Eva', 'Spain'],
        ],
        orders: [
          [20, 1, 40.0, 'placed', '2024-06-01'],
          [21, 2, 15.0, 'placed', '2024-06-01'],
          [22, 99, 500.0, 'shipped', '2024-06-02'],
        ],
      },
      expected: [
        ['Unknown', 1, 1, 40],
        ['Spain', 1, 1, 15],
      ],
    },
    {
      name: 'Revenue ties sort by country',
      ordered: true,
      tables: {
        customers: [
          [1, 'Fay', 'Peru'],
          [2, 'Gus', 'Chile'],
        ],
        orders: [
          [30, 1, 10.0, 'placed', '2024-07-01'],
          [31, 2, 10.0, 'placed', '2024-07-01'],
        ],
      },
      expected: [
        ['Chile', 1, 1, 10],
        ['Peru', 1, 1, 10],
      ],
    },
    {
      name: 'Country with only cancelled orders disappears',
      hidden: true,
      ordered: true,
      tables: {
        customers: [
          [1, 'Hal', 'Kenya'],
          [2, 'Ivy', 'Ghana'],
        ],
        orders: [
          [40, 1, 99.0, 'cancelled', '2024-08-01'],
          [41, 2, 12.35, 'shipped', '2024-08-01'],
          [42, 2, 7.0, 'placed', '2024-08-02'],
        ],
      },
      expected: [
        ['Ghana', 1, 2, 19.35],
      ],
    },
    {
      name: 'Repeat customer counted once',
      hidden: true,
      ordered: true,
      tables: {
        customers: [
          [1, 'Jo', 'Japan'],
          [2, 'Ken', 'Japan'],
        ],
        orders: [
          [50, 1, 5.0, 'placed', '2024-09-01'],
          [51, 1, 5.0, 'placed', '2024-09-02'],
          [52, 1, 5.0, 'shipped', '2024-09-03'],
          [53, 2, 1.5, 'placed', '2024-09-03'],
        ],
      },
      expected: [
        ['Japan', 2, 4, 16.5],
      ],
    },
    {
      name: 'Every order cancelled',
      hidden: true,
      ordered: true,
      tables: {
        customers: [[1, 'Lu', 'Fiji']],
        orders: [[60, 1, 10.0, 'cancelled', '2024-10-01']],
      },
      expected: [],
    },
  ],
};
