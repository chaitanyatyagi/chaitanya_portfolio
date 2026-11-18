export default {
  id: 'median-search-frequency',
  track: 'sql',
  title: 'Median from a Frequency Table',
  difficulty: 'Hard',
  topics: ['Aggregation', 'Subqueries', 'CTEs'],
  patterns: ['Expand a frequency table', 'Median'],
  domains: ['Search'],
  companies: ['Google'],
  sources: [{ company: 'Google', label: 'DataLemur — Google "Median Google Search Frequency"', url: 'https://datalemur.com/questions' }],
  summary: 'The data is pre-aggregated as (value, how many users) — compute the true median.',

  description: `A search team stores a **summary** instead of raw rows: \`search_frequency\` says that \`num_users\` users made \`searches\` searches last week.

Compute the **median** number of searches per user, rounded to 1 decimal, as a single column \`median\`. With an even number of users the median is the average of the two middle values.`,

  hints: [
    'Conceptually, repeat each row num_users times — then it\'s a normal median.',
    'In DuckDB, unnest(range(num_users)) turns one row into num_users rows.',
    'MEDIAN() (or PERCENTILE_CONT(0.5)) averages the two middle values for you.',
  ],

  schema: [{ name: 'search_frequency', columns: [['searches', 'INTEGER', 'Searches per user'], ['num_users', 'INTEGER', 'Users with that many searches']] }],
  outputColumns: ['median'],

  starter: `-- Table: search_frequency
SELECT AVG(searches) AS median
FROM search_frequency;
`,

  solution: `WITH expanded AS (
  SELECT searches, unnest(range(num_users)) AS copy
  FROM search_frequency
)
SELECT ROUND(MEDIAN(searches)::DOUBLE, 1) AS median
FROM expanded;
`,

  explanation: `**Undo the aggregation, then take the median.** Each row stands for \`num_users\` identical values; \`unnest(range(num_users))\` repeats it that many times, giving the per-user list the median is defined over. \`MEDIAN\` then averages the two middle values when the count is even.

Expanding is simple and right for small tables. At scale you'd avoid it: compute a running sum of \`num_users\` ordered by \`searches\` and pick the value(s) where it crosses half of the total — the same idea without materialising every row.`,

  tests: [
    { name: 'Example', ordered: true, tables: { search_frequency: [[1, 2], [2, 2], [3, 3], [4, 1]] }, expected: [[2.5]] },
    { name: 'Odd number of users', ordered: true, tables: { search_frequency: [[5, 1], [10, 2]] }, expected: [[10]] },
    { name: 'Zero searches', hidden: true, ordered: true, tables: { search_frequency: [[0, 3], [1, 1]] }, expected: [[0]] },
    { name: 'A single user', hidden: true, ordered: true, tables: { search_frequency: [[7, 1]] }, expected: [[7]] },
    { name: 'Unordered rows', hidden: true, ordered: true, tables: { search_frequency: [[9, 1], [1, 1], [4, 1], [2, 1]] }, expected: [[3]] },
  ],
};
