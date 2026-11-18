export default {
  id: 'third-ride-per-rider',
  track: 'sql',
  title: "Each Rider's Third Ride",
  difficulty: 'Medium',
  topics: ['Window Functions', 'Ranking', 'CTEs'],
  patterns: ['Nth event per entity (ROW_NUMBER)'],
  domains: ['Ride-hailing'],
  companies: ['Uber'],
  sources: [{ company: 'Uber', label: 'DataLemur — Uber "User\'s Third Transaction"', url: 'https://datalemur.com/questions' }],
  summary: 'Pick out every rider\'s third trip — a classic "Nth event per user" window question.',

  description: `Marketing sends a thank-you voucher after a rider's **third** trip. Using \`rides\`, return each rider's third ride.

- Order a rider's rides by \`requested_at\`; if two rides have the same \`requested_at\`, the smaller \`ride_id\` comes first.
- Riders with fewer than three rides don't appear.
- Return \`rider_id\`, \`ride_id\`, \`fare\`, \`requested_at\`, ordered by \`rider_id\`.`,

  hints: [
    'Number each rider\'s rides 1, 2, 3… in time order.',
    'ROW_NUMBER() OVER (PARTITION BY rider_id ORDER BY requested_at, ride_id) gives every ride a distinct position, even on ties.',
    'Filter on the number in an outer query (or with QUALIFY).',
  ],

  schema: [
    {
      name: 'rides',
      columns: [['ride_id', 'INTEGER', 'Primary key'], ['rider_id', 'INTEGER', 'Rider'], ['fare', 'DOUBLE', 'Fare paid'], ['requested_at', 'TIMESTAMP', 'When the ride was requested']],
    },
  ],
  outputColumns: ['rider_id', 'ride_id', 'fare', 'requested_at'],

  starter: `-- Table: rides
SELECT rider_id, ride_id, fare, requested_at
FROM rides;
`,

  solution: `WITH numbered AS (
  SELECT
    *,
    ROW_NUMBER() OVER (PARTITION BY rider_id ORDER BY requested_at, ride_id) AS n
  FROM rides
)
SELECT rider_id, ride_id, fare, requested_at
FROM numbered
WHERE n = 3
ORDER BY rider_id;
`,

  explanation: `**Number, then filter.** \`ROW_NUMBER()\` partitioned by rider and ordered by time (with \`ride_id\` as the tie-breaker) gives each ride its position. Keep position 3.

Why not \`RANK()\`? With two rides at the same instant, \`RANK\` would give both position 2 and skip 3 — the rider would silently lose their voucher. A deterministic tie-breaker matters whenever "the Nth" must be exactly one row.

**Complexity:** one sort per rider partition — O(n log n).`,

  tests: [
    {
      name: 'Example',
      ordered: true,
      tables: {
        rides: [
          [101, 1, 12.5, '2024-01-01 08:00:00'], [102, 1, 8.0, '2024-01-02 09:00:00'], [103, 1, 20.0, '2024-01-05 10:00:00'],
          [104, 1, 5.0, '2024-01-06 10:00:00'], [201, 2, 9.0, '2024-01-03 10:00:00'], [202, 2, 11.0, '2024-01-04 10:00:00'],
        ],
      },
      expected: [[1, 103, 20, '2024-01-05 10:00:00']],
    },
    {
      name: 'Unordered input, two riders qualify',
      ordered: true,
      tables: {
        rides: [
          [303, 3, 7.0, '2024-02-03 10:00:00'], [301, 3, 5.0, '2024-02-01 10:00:00'], [302, 3, 6.0, '2024-02-02 10:00:00'],
          [402, 4, 2.0, '2024-02-02 08:00:00'], [401, 4, 1.0, '2024-02-01 08:00:00'], [403, 4, 3.0, '2024-02-03 08:00:00'],
        ],
      },
      expected: [[3, 303, 7, '2024-02-03 10:00:00'], [4, 403, 3, '2024-02-03 08:00:00']],
    },
    {
      name: 'Same timestamp: smaller ride_id first',
      hidden: true,
      ordered: true,
      tables: { rides: [[503, 5, 3.0, '2024-03-01 10:00:00'], [501, 5, 1.0, '2024-03-01 09:00:00'], [502, 5, 2.0, '2024-03-01 10:00:00']] },
      expected: [[5, 503, 3, '2024-03-01 10:00:00']],
    },
    { name: 'Empty table', hidden: true, ordered: true, tables: { rides: [] }, expected: [] },
    {
      name: 'Nobody has three rides',
      hidden: true,
      ordered: true,
      tables: { rides: [[1, 6, 4.0, '2024-04-01 10:00:00'], [2, 6, 4.0, '2024-04-02 10:00:00'], [3, 7, 9.0, '2024-04-01 10:00:00']] },
      expected: [],
    },
  ],
};
