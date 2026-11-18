export default {
  id: 'odd-even-measurements',
  track: 'sql',
  title: 'Odd and Even Readings per Day',
  difficulty: 'Medium',
  topics: ['Window Functions', 'Conditional Logic', 'Date & Time'],
  patterns: ['Position within a group (ROW_NUMBER)', 'Conditional aggregation (SUM CASE)'],
  domains: ['IoT / Sensors'],
  companies: ['Google'],
  sources: [
    { company: 'Google', label: 'DataLemur — Google "Odd and Even Measurements"', url: 'https://datalemur.com/questions' },
    { company: 'Google', label: 'SparkPlayground — Google "Smart Meter Readings"', url: 'https://www.sparkplayground.com/pyspark-coding-interview-questions' },
  ],
  summary: 'Number each day\'s sensor readings in time order and sum the odd and even ones.',

  description: `A sensor takes several readings a day. Within each **calendar day**, number the readings 1, 2, 3… in \`measured_at\` order.

Return \`measurement_day\`, \`odd_sum\` (sum of the 1st, 3rd, 5th… readings' \`value\`) and \`even_sum\` (2nd, 4th…; 0 when there are none), ordered by day.`,

  hints: [
    'ROW_NUMBER() OVER (PARTITION BY the day ORDER BY measured_at).',
    'n % 2 = 1 is odd.',
    'SUM(CASE WHEN … THEN value ELSE 0 END) gives 0 instead of NULL when nothing matches.',
  ],

  schema: [{ name: 'measurements', columns: [['measurement_id', 'INTEGER', 'Primary key'], ['value', 'DOUBLE', 'Reading'], ['measured_at', 'TIMESTAMP', 'When']] }],
  outputColumns: ['measurement_day', 'odd_sum', 'even_sum'],

  starter: `-- Table: measurements
SELECT CAST(measured_at AS DATE) AS measurement_day, SUM(value) AS odd_sum, 0 AS even_sum
FROM measurements
GROUP BY 1
ORDER BY 1;
`,

  solution: `WITH numbered AS (
  SELECT
    CAST(measured_at AS DATE) AS measurement_day,
    value,
    ROW_NUMBER() OVER (PARTITION BY CAST(measured_at AS DATE) ORDER BY measured_at) AS n
  FROM measurements
)
SELECT
  measurement_day,
  SUM(CASE WHEN n % 2 = 1 THEN value ELSE 0 END) AS odd_sum,
  SUM(CASE WHEN n % 2 = 0 THEN value ELSE 0 END) AS even_sum
FROM numbered
GROUP BY measurement_day
ORDER BY measurement_day;
`,

  explanation: `**Number within the day, then pivot with conditional sums.** The window is partitioned by the *date* (not the timestamp), so numbering restarts at midnight. Two \`SUM(CASE …)\` columns split the readings by parity — the classic way to pivot a few known categories into columns. \`ELSE 0\` makes a day with a single reading report \`even_sum = 0\`, not NULL.`,

  tests: [
    {
      name: 'Example',
      ordered: true,
      tables: { measurements: [[1, 100.5, '2024-07-10 10:00:00'], [2, 50.0, '2024-07-10 12:00:00'], [3, 20.0, '2024-07-10 15:00:00'], [4, 10.0, '2024-07-11 09:00:00']] },
      expected: [['2024-07-10', 120.5, 50], ['2024-07-11', 10, 0]],
    },
    {
      name: 'Unordered within a day',
      ordered: true,
      tables: { measurements: [[1, 5.0, '2024-08-01 18:00:00'], [2, 1.0, '2024-08-01 08:00:00'], [3, 2.0, '2024-08-01 09:00:00'], [4, 3.0, '2024-08-01 10:00:00']] },
      expected: [['2024-08-01', 4, 7]],
    },
    { name: 'Empty table', hidden: true, ordered: true, tables: { measurements: [] }, expected: [] },
    { name: 'A single reading', hidden: true, ordered: true, tables: { measurements: [[1, 7.0, '2024-09-01 12:00:00']] }, expected: [['2024-09-01', 7, 0]] },
    {
      name: 'Numbering restarts at midnight',
      hidden: true,
      ordered: true,
      tables: { measurements: [[1, 1.0, '2024-10-01 23:59:59'], [2, 2.0, '2024-10-02 00:00:00'], [3, 4.0, '2024-10-02 00:00:01']] },
      expected: [['2024-10-01', 1, 0], ['2024-10-02', 2, 4]],
    },
  ],
};
