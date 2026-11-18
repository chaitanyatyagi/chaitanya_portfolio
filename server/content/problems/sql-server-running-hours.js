export default {
  id: 'server-running-hours',
  track: 'sql',
  title: 'Server Running Hours',
  difficulty: 'Hard',
  topics: ['Window Functions', 'Date & Time', 'Aggregation'],
  patterns: ['Pair start/stop events (LEAD)'],
  domains: ['Cloud infrastructure'],
  companies: ['Amazon'],
  sources: [
    { company: 'Amazon', label: 'DataLemur — Amazon "Server Utilization Time"', url: 'https://datalemur.com/questions' },
    { company: 'Amazon', label: 'SparkPlayground — Amazon "EV Charger Utilization"', url: 'https://www.sparkplayground.com/pyspark-coding-interview-questions' },
  ],
  summary: 'Pair each server\'s start and stop events and total the hours it ran.',

  description: `\`server_events\` logs when servers start and stop (\`status\` is \`'start'\` or \`'stop'\`). A server's running period is a \`start\` followed **immediately** (next event for that server) by a \`stop\`. A trailing \`start\` with no \`stop\` yet is still running and is **not** counted.

Return \`server_id\`, \`running_hours\` (total, rounded to 2 decimals) for servers with at least one completed period, ordered by \`server_id\`.`,

  hints: [
    'LEAD(status) and LEAD(event_ts) over each server\'s events in time order give "the next event".',
    'Keep rows where status = \'start\' and the next status = \'stop\'.',
    'date_diff(\'second\', start, stop) / 3600.0 → hours.',
  ],

  schema: [{ name: 'server_events', columns: [['server_id', 'INTEGER', 'Server'], ['status', 'VARCHAR', "'start' · 'stop'"], ['event_ts', 'TIMESTAMP', 'When']] }],
  outputColumns: ['server_id', 'running_hours'],

  starter: `-- Table: server_events
SELECT server_id, COUNT(*) AS running_hours
FROM server_events
GROUP BY server_id
ORDER BY server_id;
`,

  solution: `WITH paired AS (
  SELECT
    server_id,
    status,
    event_ts,
    LEAD(status)   OVER w AS next_status,
    LEAD(event_ts) OVER w AS next_ts
  FROM server_events
  WINDOW w AS (PARTITION BY server_id ORDER BY event_ts)
)
SELECT server_id, ROUND(SUM(date_diff('second', event_ts, next_ts)) / 3600.0, 2) AS running_hours
FROM paired
WHERE status = 'start' AND next_status = 'stop'
GROUP BY server_id
ORDER BY server_id;
`,

  explanation: `**Pair each event with the next one.** \`LEAD\` over a server's events turns the event log into (this event, next event) pairs; a running period is a pair (start, stop). Summing the seconds and dividing by 3600 gives hours.

A trailing \`start\` has no next event, so its \`next_status\` is NULL and it drops out. The named \`WINDOW\` clause avoids repeating the same partition/order twice.`,

  tests: [
    {
      name: 'Example',
      ordered: true,
      tables: {
        server_events: [
          [1, 'start', '2024-05-01 08:00:00'], [1, 'stop', '2024-05-01 10:30:00'], [1, 'start', '2024-05-01 12:00:00'],
          [1, 'stop', '2024-05-01 13:00:00'], [2, 'start', '2024-05-01 09:00:00'], [2, 'stop', '2024-05-01 09:45:00'],
        ],
      },
      expected: [[1, 3.5], [2, 0.75]],
    },
    {
      name: 'A trailing start is not counted',
      ordered: true,
      tables: { server_events: [[3, 'start', '2024-05-02 10:00:00'], [3, 'stop', '2024-05-02 11:00:00'], [3, 'start', '2024-05-02 12:00:00']] },
      expected: [[3, 1]],
    },
    { name: 'No events', hidden: true, ordered: true, tables: { server_events: [] }, expected: [] },
    { name: 'Across midnight', hidden: true, ordered: true, tables: { server_events: [[4, 'start', '2024-01-01 23:00:00'], [4, 'stop', '2024-01-02 01:30:00']] }, expected: [[4, 2.5]] },
    {
      name: 'Unordered input; a server that never stopped',
      hidden: true,
      ordered: true,
      tables: { server_events: [[5, 'stop', '2024-03-01 06:00:00'], [5, 'start', '2024-03-01 05:00:00'], [6, 'start', '2024-03-01 05:00:00']] },
      expected: [[5, 1]],
    },
  ],
};
