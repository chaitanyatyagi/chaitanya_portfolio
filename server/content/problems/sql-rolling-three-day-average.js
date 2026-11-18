export default {
  id: 'rolling-three-day-average',
  track: 'sql',
  title: 'Rolling Three-Day Average',
  difficulty: 'Medium',
  topics: ['Window Functions', 'Running Totals', 'Date & Time'],
  patterns: ['Moving average (ROWS BETWEEN … PRECEDING)'],
  domains: ['Social media'],
  companies: ['Twitter (X)'],
  sources: [
    { company: 'Twitter (X)', label: 'DataLemur — Twitter "Tweets\' Rolling Averages"', url: 'https://datalemur.com/questions' },
    { company: 'Twitter (X)', label: 'SparkPlayground — Twitter "Rolling Sales Average"', url: 'https://www.sparkplayground.com/pyspark-coding-interview-questions' },
  ],
  summary: 'Smooth a daily metric with a 3-row moving average per user.',

  description: `\`daily_posts\` has one row per user per day they posted, with how many posts they made. Days without posts have **no row**.

For every row, compute \`rolling_avg\`: the average of \`posts\` over that row and the **two previous rows for the same user** (fewer at the start), rounded to 2 decimals.

Return \`user_id\`, \`post_date\`, \`rolling_avg\`, ordered by \`user_id\`, then \`post_date\`.`,

  hints: [
    'A window frame limits which rows an aggregate sees: ROWS BETWEEN 2 PRECEDING AND CURRENT ROW.',
    'Partition by user, order by date.',
    'ROUND(AVG(posts) OVER (...), 2).',
  ],

  schema: [
    { name: 'daily_posts', columns: [['user_id', 'INTEGER', 'User'], ['post_date', 'DATE', 'Day'], ['posts', 'INTEGER', 'Posts that day']] },
  ],
  outputColumns: ['user_id', 'post_date', 'rolling_avg'],

  starter: `-- Table: daily_posts
SELECT user_id, post_date, posts AS rolling_avg
FROM daily_posts
ORDER BY user_id, post_date;
`,

  solution: `SELECT
  user_id,
  post_date,
  ROUND(AVG(posts) OVER (
    PARTITION BY user_id
    ORDER BY post_date
    ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
  ), 2) AS rolling_avg
FROM daily_posts
ORDER BY user_id, post_date;
`,

  explanation: `**A framed window.** \`ROWS BETWEEN 2 PRECEDING AND CURRENT ROW\` makes \`AVG\` see at most three rows: this one and the two before it in the same user's partition. The first rows of each user average over fewer values automatically.

\`ROWS\` counts physical rows. If the requirement were *calendar* days (a missing day counts as zero), you would use \`RANGE BETWEEN INTERVAL 2 DAY PRECEDING AND CURRENT ROW\` or fill the missing days first — a good follow-up question to ask in the interview.

**Complexity:** one sort per user — O(n log n).`,

  tests: [
    {
      name: 'Example',
      ordered: true,
      tables: {
        daily_posts: [[1, '2024-05-01', 2], [1, '2024-05-02', 4], [1, '2024-05-03', 6], [1, '2024-05-04', 1], [2, '2024-05-01', 3], [2, '2024-05-02', 0]],
      },
      expected: [[1, '2024-05-01', 2], [1, '2024-05-02', 3], [1, '2024-05-03', 4], [1, '2024-05-04', 3.67], [2, '2024-05-01', 3], [2, '2024-05-02', 1.5]],
    },
    {
      name: 'Unordered input',
      ordered: true,
      tables: { daily_posts: [[3, '2024-06-03', 9], [3, '2024-06-01', 3], [3, '2024-06-02', 6]] },
      expected: [[3, '2024-06-01', 3], [3, '2024-06-02', 4.5], [3, '2024-06-03', 6]],
    },
    { name: 'Single row', hidden: true, ordered: true, tables: { daily_posts: [[7, '2024-07-01', 5]] }, expected: [[7, '2024-07-01', 5]] },
    {
      name: 'The oldest day drops out of the window',
      hidden: true,
      ordered: true,
      tables: { daily_posts: [[8, '2024-08-01', 1], [8, '2024-08-02', 2], [8, '2024-08-03', 3], [8, '2024-08-04', 4], [8, '2024-08-05', 10]] },
      expected: [[8, '2024-08-01', 1], [8, '2024-08-02', 1.5], [8, '2024-08-03', 2], [8, '2024-08-04', 3], [8, '2024-08-05', 5.67]],
    },
    { name: 'Empty table', hidden: true, ordered: true, tables: { daily_posts: [] }, expected: [] },
  ],
};
