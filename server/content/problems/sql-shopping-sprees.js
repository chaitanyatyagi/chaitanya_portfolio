export default {
  id: 'shopping-sprees',
  track: 'sql',
  title: 'Three-Day Shopping Sprees',
  difficulty: 'Medium',
  topics: ['Gaps & Islands', 'Window Functions', 'Deduplication', 'Date & Time'],
  patterns: ['Gaps & islands (date − ROW_NUMBER)'],
  domains: ['E-commerce / Sales'],
  companies: ['Amazon'],
  sources: [{ company: 'Amazon', label: 'DataLemur — Amazon "User Shopping Sprees"', url: 'https://datalemur.com/questions' }],
  summary: 'Find users who bought something on at least three consecutive days.',

  description: `A **shopping spree** is purchasing on **3 or more consecutive calendar days**. Several purchases on one day count as one day.

Return the \`user_id\` of every user who had at least one spree, ordered by \`user_id\`.`,

  hints: [
    'Reduce to distinct (user_id, purchase day).',
    'day − ROW_NUMBER() (per user, by day) is constant across consecutive days.',
    'Group by (user, that constant) and keep groups with 3 or more days — then list each user once.',
  ],

  schema: [{ name: 'purchases', columns: [['user_id', 'INTEGER', 'Buyer'], ['amount', 'DOUBLE', 'Order value'], ['purchased_at', 'TIMESTAMP', 'When']] }],
  outputColumns: ['user_id'],

  starter: `-- Table: purchases
SELECT user_id
FROM purchases
GROUP BY user_id
HAVING COUNT(*) >= 3
ORDER BY user_id;
`,

  solution: `WITH days AS (
  SELECT DISTINCT user_id, CAST(purchased_at AS DATE) AS d
  FROM purchases
),
islands AS (
  SELECT user_id, d - CAST(ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY d) AS INTEGER) AS island
  FROM days
)
SELECT DISTINCT user_id
FROM islands
GROUP BY user_id, island
HAVING COUNT(*) >= 3
ORDER BY user_id;
`,

  explanation: `**Gaps and islands.** After deduplicating to days, subtracting each day's position from its date gives the same value for every day in a consecutive run. Group by that "island" and count its days.

Counting purchases instead of days (\`HAVING COUNT(*) >= 3\`) is the trap: three orders on one day are not a spree, and three orders on Monday, Wednesday and Friday aren't either.`,

  tests: [
    {
      name: 'Example',
      ordered: true,
      tables: {
        purchases: [
          [1, 10.0, '2024-06-01 10:00:00'], [1, 15.0, '2024-06-02 10:00:00'], [1, 20.0, '2024-06-03 10:00:00'],
          [2, 10.0, '2024-06-01 10:00:00'], [2, 10.0, '2024-06-02 10:00:00'], [2, 10.0, '2024-06-04 10:00:00'],
          [3, 5.0, '2024-06-05 10:00:00'], [3, 5.0, '2024-06-06 10:00:00'], [3, 5.0, '2024-06-07 10:00:00'], [3, 5.0, '2024-06-08 10:00:00'],
        ],
      },
      expected: [[1], [3]],
    },
    {
      name: 'Many orders on one day are one day',
      ordered: true,
      tables: { purchases: [[4, 1.0, '2024-07-01 09:00:00'], [4, 1.0, '2024-07-01 10:00:00'], [4, 1.0, '2024-07-01 11:00:00'], [4, 1.0, '2024-07-02 09:00:00']] },
      expected: [],
    },
    { name: 'No purchases', hidden: true, ordered: true, tables: { purchases: [] }, expected: [] },
    { name: 'Across a month boundary', hidden: true, ordered: true, tables: { purchases: [[5, 1.0, '2024-01-31 23:00:00'], [5, 1.0, '2024-02-01 08:00:00'], [5, 1.0, '2024-02-02 08:00:00']] }, expected: [[5]] },
    {
      name: 'Two short runs are not a spree',
      hidden: true,
      ordered: true,
      tables: { purchases: [[6, 1.0, '2024-03-01 10:00:00'], [6, 1.0, '2024-03-02 10:00:00'], [6, 1.0, '2024-03-04 10:00:00'], [6, 1.0, '2024-03-05 10:00:00']] },
      expected: [],
    },
  ],
};
