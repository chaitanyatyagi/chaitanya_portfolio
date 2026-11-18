export default {
  id: 'month-over-month-retention',
  track: 'sql',
  title: 'Month-over-Month Retention',
  difficulty: 'Hard',
  topics: ['Date & Time', 'Joins', 'Aggregation', 'CTEs'],
  patterns: ['Self-join on the previous period', 'Retention / cohort'],
  domains: ['Product analytics'],
  companies: ['Meta'],
  sources: [
    { company: 'Meta', label: 'DataLemur — Facebook "Active User Retention"', url: 'https://datalemur.com/questions' },
    { company: 'Meta', label: 'SparkPlayground — Meta "Gym Member Retention"', url: 'https://www.sparkplayground.com/pyspark-coding-interview-questions' },
  ],
  summary: 'For each month, how many active users were also active the month before?',

  description: `\`user_actions\` logs every action users take. A user is **active in a month** if they have at least one action in it.

For every calendar month that has activity, return:

- \`month\` — formatted \`YYYY-MM\`;
- \`retained_users\` — users active in that month **and** in the immediately preceding calendar month;
- \`active_users\` — users active in that month.

Order by \`month\`. A gap counts: activity in January and March does **not** make a user retained in March.`,

  hints: [
    'First reduce to one row per (user, month): DISTINCT user_id, DATE_TRUNC(\'month\', action_ts).',
    'LEFT JOIN that set to itself on the same user and month = previous month (month - INTERVAL 1 MONTH).',
    'COUNT(prev.user_id) counts only the matches; COUNT(*) counts every active user.',
  ],

  schema: [
    { name: 'user_actions', columns: [['user_id', 'INTEGER', 'User'], ['action_ts', 'TIMESTAMP', 'When'], ['action', 'VARCHAR', "'login', 'post', 'like', …"]] },
  ],
  outputColumns: ['month', 'retained_users', 'active_users'],

  starter: `-- Table: user_actions
SELECT strftime(action_ts, '%Y-%m') AS month, COUNT(DISTINCT user_id) AS active_users
FROM user_actions
GROUP BY 1
ORDER BY 1;
`,

  solution: `WITH monthly AS (
  SELECT DISTINCT user_id, CAST(DATE_TRUNC('month', action_ts) AS DATE) AS mon
  FROM user_actions
)
SELECT
  strftime(cur.mon, '%Y-%m')  AS month,
  COUNT(prev.user_id)         AS retained_users,
  COUNT(*)                    AS active_users
FROM monthly cur
LEFT JOIN monthly prev
  ON prev.user_id = cur.user_id
 AND prev.mon = cur.mon - INTERVAL 1 MONTH
GROUP BY cur.mon
ORDER BY cur.mon;
`,

  explanation: `**Collapse to user-months, then self-join to the previous month.**

1. \`monthly\` has one row per user per active month, so several actions in a month count once.
2. The LEFT JOIN looks for the same user exactly one calendar month earlier. \`cur.mon - INTERVAL 1 MONTH\` handles year boundaries (January → previous December).
3. \`COUNT(prev.user_id)\` ignores the NULLs from users with no match; \`COUNT(*)\` counts everyone active.

The same shape answers "reactivated users" (active now, *not* active last month) and cohort retention tables.

**Complexity:** one distinct and one hash join — O(n).`,

  tests: [
    {
      name: 'Example',
      ordered: true,
      tables: {
        user_actions: [
          [1, '2024-01-05 10:00:00', 'login'], [1, '2024-02-10 10:00:00', 'post'], [2, '2024-01-20 10:00:00', 'login'],
          [3, '2024-02-01 09:00:00', 'login'], [3, '2024-03-02 09:00:00', 'post'], [1, '2024-03-15 09:00:00', 'like'],
        ],
      },
      expected: [['2024-01', 0, 2], ['2024-02', 1, 2], ['2024-03', 2, 2]],
    },
    {
      name: 'A skipped month breaks retention',
      ordered: true,
      tables: {
        user_actions: [
          [1, '2024-01-01 00:00:00', 'login'], [1, '2024-03-31 23:59:59', 'login'], [2, '2024-01-31 23:59:59', 'login'],
          [2, '2024-02-01 00:00:00', 'post'], [2, '2024-02-15 00:00:00', 'post'], [2, '2024-03-01 00:00:00', 'like'],
        ],
      },
      expected: [['2024-01', 0, 2], ['2024-02', 1, 1], ['2024-03', 1, 2]],
    },
    {
      name: 'Across the new year',
      hidden: true,
      ordered: true,
      tables: { user_actions: [[5, '2023-12-30 10:00:00', 'login'], [5, '2024-01-02 10:00:00', 'login'], [6, '2024-01-03 10:00:00', 'login']] },
      expected: [['2023-12', 0, 1], ['2024-01', 1, 2]],
    },
    { name: 'Empty table', hidden: true, ordered: true, tables: { user_actions: [] }, expected: [] },
    {
      name: 'Months with nothing in between',
      hidden: true,
      ordered: true,
      tables: { user_actions: [[7, '2024-01-01 08:00:00', 'login'], [7, '2024-04-01 08:00:00', 'login']] },
      expected: [['2024-01', 0, 1], ['2024-04', 0, 1]],
    },
  ],
};

