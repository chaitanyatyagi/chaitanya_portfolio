export default {
  id: 'longest-login-streak',
  track: 'sql',
  title: 'Longest Login Streak',
  difficulty: 'Hard',
  topics: ['Gaps & Islands', 'Window Functions', 'Deduplication', 'Date & Time', 'CTEs'],
  patterns: ['Gaps & islands (date − ROW_NUMBER)', 'Top-1 per group (ROW_NUMBER)'],
  domains: ['Product analytics'],
  companies: ['PayPal', 'Intuit'],
  sources: [
    { company: 'PayPal', label: 'SparkPlayground — PayPal "Employee Attendance Streaks"', url: 'https://www.sparkplayground.com/pyspark-coding-interview-questions' },
    { company: 'Intuit', label: 'DataLemur — Intuit "Consecutive Filing Years"', url: 'https://datalemur.com/questions' },
  ],
  summary: "Find each user's longest run of consecutive login days, and the day it started.",

  description: `Growth wants to reward loyal users, so they need each user's **longest login streak**.

The \`logins\` table has one row per login; a user can log in many times a day. A **streak** is a run of consecutive calendar days on which the user logged in at least once.

For every user, return:

- \`user_id\`;
- \`longest_streak\` — the length, in days, of their longest streak;
- \`streak_start\` — the first day of that streak. If a user has several streaks of the same longest length, use the **earliest** one.

Order by \`longest_streak\` descending, then \`user_id\` ascending.`,

  hints: [
    'First reduce the table to one row per (user, day) — several logins on one day are still one day.',
    'Number each user\'s days with ROW_NUMBER() in date order. For consecutive days, day − row_number is the same value: that value identifies the streak (the "island").',
    'Group by (user, island) to get each streak\'s start and length, then keep the best one per user with another ROW_NUMBER().',
  ],

  schema: [
    {
      name: 'logins',
      columns: [
        ['user_id', 'INTEGER', 'Who logged in'],
        ['login_ts', 'TIMESTAMP', 'When'],
      ],
    },
  ],
  outputColumns: ['user_id', 'longest_streak', 'streak_start'],

  starter: `-- Write your query below. The table \`logins\` is available.
-- Press Ctrl/Cmd + ' to run the examples, Ctrl/Cmd + Enter to submit.

SELECT
  user_id,
  CAST(login_ts AS DATE) AS login_date
FROM logins;
`,

  solution: `WITH days AS (
  SELECT DISTINCT user_id, CAST(login_ts AS DATE) AS d
  FROM logins
),
islands AS (
  SELECT
    user_id,
    d,
    d - CAST(ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY d) AS INTEGER) AS island
  FROM days
),
streaks AS (
  SELECT user_id, MIN(d) AS streak_start, COUNT(*) AS streak_len
  FROM islands
  GROUP BY user_id, island
),
best AS (
  SELECT
    *,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY streak_len DESC, streak_start) AS rn
  FROM streaks
)
SELECT user_id, streak_len AS longest_streak, streak_start
FROM best
WHERE rn = 1
ORDER BY longest_streak DESC, user_id;
`,

  explanation: `**Gaps and islands.**

1. \`days\`: \`DISTINCT\` on (user, date) — three logins on one day are one day of the streak.
2. \`islands\`: number each user's days 1, 2, 3… in date order. While the days are consecutive, the day and the row number both go up by 1, so **day − row_number stays constant**. A gap of one or more days changes it. That constant labels the island.
3. \`streaks\`: one row per island, with its first day and its length.
4. \`best\`: \`ROW_NUMBER()\` ordered by length (longest first) and start (earliest first) picks one streak per user, breaking ties towards the earliest.

The same trick finds consecutive months, sessions, or uptime windows — anywhere "consecutive" is the question.

**Complexity:** a distinct, two window sorts per user and a group-by — O(n log n).`,

  tests: [
    {
      name: 'Example',
      ordered: true,
      tables: {
        logins: [
          [1, '2024-03-01 08:00:00'],
          [1, '2024-03-02 09:00:00'],
          [1, '2024-03-02 21:00:00'],
          [1, '2024-03-03 07:30:00'],
          [1, '2024-03-05 10:00:00'],
          [1, '2024-03-06 10:00:00'],
          [2, '2024-03-10 12:00:00'],
          [3, '2024-03-01 12:00:00'],
          [3, '2024-03-03 12:00:00'],
          [3, '2024-03-04 12:00:00'],
        ],
      },
      expected: [
        [1, 3, '2024-03-01'],
        [3, 2, '2024-03-03'],
        [2, 1, '2024-03-10'],
      ],
    },
    {
      name: 'Equal streaks: keep the earliest',
      ordered: true,
      tables: {
        logins: [
          [7, '2024-04-10 10:00:00'],
          [7, '2024-04-11 10:00:00'],
          [7, '2024-04-01 10:00:00'],
          [7, '2024-04-02 10:00:00'],
          [8, '2024-04-05 10:00:00'],
          [8, '2024-04-06 10:00:00'],
        ],
      },
      expected: [
        [7, 2, '2024-04-01'],
        [8, 2, '2024-04-05'],
      ],
    },
    {
      name: 'Across month and year boundaries',
      hidden: true,
      ordered: true,
      tables: {
        logins: [
          [4, '2024-01-30 10:00:00'],
          [4, '2024-01-31 10:00:00'],
          [4, '2024-02-01 10:00:00'],
          [4, '2024-02-02 10:00:00'],
          [4, '2024-02-04 10:00:00'],
          [4, '2024-02-28 10:00:00'],
          [4, '2024-02-29 10:00:00'],
          [4, '2024-03-01 10:00:00'],
          [5, '2023-12-31 23:00:00'],
          [5, '2024-01-01 00:30:00'],
        ],
      },
      expected: [
        [4, 4, '2024-01-30'],
        [5, 2, '2023-12-31'],
      ],
    },
    {
      name: 'Many logins on the same day',
      hidden: true,
      ordered: true,
      tables: {
        logins: [
          [9, '2024-06-01 08:00:00'],
          [9, '2024-06-01 09:00:00'],
          [9, '2024-06-01 23:59:59'],
          [9, '2024-06-02 00:00:00'],
          [10, '2024-06-01 08:00:00'],
          [10, '2024-06-01 12:00:00'],
          [10, '2024-06-01 18:00:00'],
        ],
      },
      expected: [
        [9, 2, '2024-06-01'],
        [10, 1, '2024-06-01'],
      ],
    },
    {
      name: 'Empty table',
      hidden: true,
      ordered: true,
      tables: { logins: [] },
      expected: [],
    },
    {
      name: 'Unordered input',
      hidden: true,
      ordered: true,
      tables: {
        logins: [
          [11, '2024-07-05 10:00:00'],
          [11, '2024-07-03 10:00:00'],
          [11, '2024-07-04 10:00:00'],
          [11, '2024-07-01 10:00:00'],
        ],
      },
      expected: [[11, 3, '2024-07-03']],
    },
  ],
};
