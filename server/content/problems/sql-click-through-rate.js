export default {
  id: 'click-through-rate',
  track: 'sql',
  title: 'App Click-Through Rate',
  difficulty: 'Easy',
  topics: ['Aggregation', 'Conditional Logic', 'Date & Time', 'Filtering & Sorting'],
  patterns: ['Conditional aggregation (COUNT FILTER / SUM CASE)', 'Rate with a zero-denominator guard'],
  domains: ['Ads / Marketing'],
  companies: ['Meta'],
  sources: [{ company: 'Meta', label: 'DataLemur — Facebook "App Click-through Rate (CTR)"', url: 'https://datalemur.com/questions' }],
  summary: 'Clicks ÷ impressions per app for 2024 — without integer division or divide-by-zero.',

  description: `\`events\` records ad \`impression\`s and \`click\`s per app.

For events in **calendar year 2024**, compute each app's click-through rate: \`ctr\` = 100 × clicks ÷ impressions, rounded to 2 decimals. Apps with **no impressions** in 2024 are left out.

Return \`app_id\`, \`ctr\`, ordered by \`app_id\`.`,

  hints: [
    'COUNT(*) FILTER (WHERE event_type = \'click\') counts only clicks (SUM(CASE …) works too).',
    'Multiply by 100.0, not 100 — in many engines integer ÷ integer truncates.',
    'Filter 2024 with a half-open range: >= \'2024-01-01\' AND < \'2025-01-01\'.',
  ],

  schema: [{ name: 'events', columns: [['app_id', 'INTEGER', 'App'], ['event_type', 'VARCHAR', "'impression' · 'click'"], ['event_ts', 'TIMESTAMP', 'When']] }],
  outputColumns: ['app_id', 'ctr'],

  starter: `-- Table: events
SELECT app_id, COUNT(*) AS ctr
FROM events
GROUP BY app_id
ORDER BY app_id;
`,

  solution: `SELECT
  app_id,
  ROUND(100.0 * COUNT(*) FILTER (WHERE event_type = 'click')
              / COUNT(*) FILTER (WHERE event_type = 'impression'), 2) AS ctr
FROM events
WHERE event_ts >= TIMESTAMP '2024-01-01' AND event_ts < TIMESTAMP '2025-01-01'
GROUP BY app_id
HAVING COUNT(*) FILTER (WHERE event_type = 'impression') > 0
ORDER BY app_id;
`,

  explanation: `**Two conditional counts and a guarded ratio.** \`FILTER\` (or \`SUM(CASE …)\`) counts clicks and impressions in one pass. \`100.0\` forces decimal arithmetic. \`HAVING … > 0\` removes apps that would divide by zero.

The half-open date range (\`>= start AND < next start\`) includes 23:59:59 on 31 December and excludes midnight on 1 January — safer than \`BETWEEN\` or \`EXTRACT(year)\` (which also defeats an index on the timestamp).`,

  tests: [
    {
      name: 'Example',
      ordered: true,
      tables: {
        events: [
          [1, 'impression', '2024-03-01 10:00:00'], [1, 'impression', '2024-03-01 11:00:00'], [1, 'click', '2024-03-01 11:00:05'],
          [1, 'impression', '2024-03-02 09:00:00'], [1, 'click', '2023-12-31 10:00:00'], [2, 'impression', '2024-05-01 10:00:00'],
          [2, 'click', '2024-05-01 10:00:03'], [2, 'impression', '2024-05-02 10:00:00'], [2, 'click', '2024-05-02 10:00:04'],
        ],
      },
      expected: [[1, 33.33], [2, 100]],
    },
    {
      name: 'No impressions, no clicks',
      ordered: true,
      tables: { events: [[3, 'click', '2024-02-01 10:00:00'], [4, 'impression', '2024-02-01 10:00:00'], [4, 'impression', '2024-02-02 10:00:00']] },
      expected: [[4, 0]],
    },
    { name: 'No events', hidden: true, ordered: true, tables: { events: [] }, expected: [] },
    {
      name: 'Year boundaries',
      hidden: true,
      ordered: true,
      tables: { events: [[5, 'impression', '2024-12-31 23:59:59'], [5, 'click', '2025-01-01 00:00:00']] },
      expected: [[5, 0]],
    },
    {
      name: 'No integer division',
      hidden: true,
      ordered: true,
      tables: { events: [[6, 'impression', '2024-06-01 10:00:00'], [6, 'impression', '2024-06-01 11:00:00'], [6, 'impression', '2024-06-01 12:00:00'], [6, 'click', '2024-06-01 10:00:01'], [6, 'click', '2024-06-01 11:00:01']] },
      expected: [[6, 66.67]],
    },
  ],
};
