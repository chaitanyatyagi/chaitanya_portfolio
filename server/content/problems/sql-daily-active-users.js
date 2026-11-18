export default {
  id: 'daily-active-users',
  track: 'sql',
  title: 'Daily Active Users',
  difficulty: 'Easy',
  topics: ['Aggregation', 'Date & Time', 'Filtering & Sorting'],
  patterns: ['Distinct count per group', 'Daily rollup (timestamp → date)'],
  domains: ['Product analytics'],
  companies: [],
  sources: [],
  summary: 'Roll raw app events up to one row per day: active users and event count, ignoring heartbeats.',

  description: `The product team's dashboard needs **daily active users (DAU)**.

The \`events\` table has one row per app event. Background \`heartbeat\` events are sent automatically by the app and **must not count** — neither as activity nor as events.

For every calendar day that has at least one counted event, return:

- \`activity_date\` — the day (the date part of \`event_ts\`);
- \`active_users\` — the number of **distinct** users with a counted event that day;
- \`events\` — the number of counted events that day.

Order the result by \`activity_date\` ascending.`,

  hints: [
    'CAST(event_ts AS DATE) turns a timestamp into its calendar day.',
    'COUNT(DISTINCT user_id) counts users once however many events they have.',
    'Filter heartbeats in WHERE, before grouping — then a day with only heartbeats disappears by itself.',
  ],

  schema: [
    {
      name: 'events',
      columns: [
        ['event_id', 'INTEGER', 'Primary key'],
        ['user_id', 'INTEGER', 'User who triggered the event'],
        ['event_type', 'VARCHAR', "'click', 'view', … or 'heartbeat'"],
        ['event_ts', 'TIMESTAMP', 'When it happened'],
      ],
    },
  ],
  outputColumns: ['activity_date', 'active_users', 'events'],

  starter: `-- Write your query below. The table \`events\` is available.
-- Press Ctrl/Cmd + ' to run the examples, Ctrl/Cmd + Enter to submit.

SELECT
  event_ts,
  user_id
FROM events;
`,

  solution: `SELECT
  CAST(event_ts AS DATE)  AS activity_date,
  COUNT(DISTINCT user_id) AS active_users,
  COUNT(*)                AS events
FROM events
WHERE event_type <> 'heartbeat'
GROUP BY CAST(event_ts AS DATE)
ORDER BY activity_date;
`,

  explanation: `**Filter, truncate to the day, aggregate.**

1. \`WHERE event_type <> 'heartbeat'\` drops background pings *before* grouping, so a day that only has heartbeats produces no row at all.
2. \`CAST(event_ts AS DATE)\` keeps only the calendar day — 23:59:59 and 00:00:00 land on different days.
3. \`COUNT(DISTINCT user_id)\` counts each user once per day; \`COUNT(*)\` counts the events.

**Complexity:** one pass plus a hash aggregation — O(n).`,

  tests: [
    {
      name: 'Example',
      ordered: true,
      tables: {
        events: [
          [1, 1, 'click', '2024-03-01 09:00:00'],
          [2, 1, 'view', '2024-03-01 10:00:00'],
          [3, 2, 'click', '2024-03-01 23:59:59'],
          [4, 2, 'heartbeat', '2024-03-02 00:00:01'],
          [5, 3, 'view', '2024-03-02 08:15:00'],
          [6, 1, 'click', '2024-03-03 12:00:00'],
          [7, 3, 'click', '2024-03-03 12:30:00'],
          [8, 3, 'view', '2024-03-03 13:00:00'],
        ],
      },
      expected: [
        ['2024-03-01', 2, 3],
        ['2024-03-02', 1, 1],
        ['2024-03-03', 2, 3],
      ],
    },
    {
      name: 'A day with only heartbeats has no row',
      ordered: true,
      tables: {
        events: [
          [1, 1, 'heartbeat', '2024-04-01 01:00:00'],
          [2, 2, 'view', '2024-04-02 02:00:00'],
        ],
      },
      expected: [['2024-04-02', 1, 1]],
    },
    {
      name: 'Empty table',
      hidden: true,
      ordered: true,
      tables: { events: [] },
      expected: [],
    },
    {
      name: 'Midnight boundaries',
      hidden: true,
      ordered: true,
      tables: {
        events: [
          [1, 5, 'view', '2024-05-01 00:00:00'],
          [2, 5, 'view', '2024-05-01 23:59:59'],
          [3, 6, 'click', '2024-05-02 00:00:00'],
          [4, 5, 'click', '2024-05-02 00:00:00'],
        ],
      },
      expected: [
        ['2024-05-01', 1, 2],
        ['2024-05-02', 2, 2],
      ],
    },
    {
      name: 'Unordered input, heartbeats mixed in',
      hidden: true,
      ordered: true,
      tables: {
        events: [
          [1, 10, 'view', '2024-06-02 10:00:00'],
          [2, 11, 'view', '2024-06-01 10:00:00'],
          [3, 12, 'click', '2024-06-02 11:00:00'],
          [4, 10, 'heartbeat', '2024-06-01 09:00:00'],
          [5, 10, 'click', '2024-06-02 12:00:00'],
          [6, 13, 'view', '2024-06-01 18:00:00'],
        ],
      },
      expected: [
        ['2024-06-01', 2, 2],
        ['2024-06-02', 2, 3],
      ],
    },
  ],
};
