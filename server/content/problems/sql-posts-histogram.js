export default {
  id: 'posts-histogram',
  track: 'sql',
  title: 'Histogram of Posts per User',
  difficulty: 'Easy',
  topics: ['Aggregation', 'Subqueries', 'Date & Time'],
  patterns: ['Aggregate then aggregate again (histogram)'],
  domains: ['Social media'],
  companies: ['Twitter (X)'],
  sources: [{ company: 'Twitter (X)', label: 'DataLemur — Twitter "Histogram of Tweets"', url: 'https://datalemur.com/questions' }],
  summary: 'How many users posted once, twice, three times… in 2024?',

  description: `Using \`posts\`, build a histogram for **2024**: for each number of posts a user made in 2024 (\`post_bucket\`), how many users made exactly that many (\`users_num\`).

Users with no 2024 posts don't appear. Order by \`post_bucket\`.`,

  hints: [
    'Step 1: posts per user in 2024 (GROUP BY user_id).',
    'Step 2: group step 1\'s result by that count.',
    'A CTE or subquery holds step 1.',
  ],

  schema: [{ name: 'posts', columns: [['post_id', 'INTEGER', 'Primary key'], ['user_id', 'INTEGER', 'Author'], ['posted_at', 'TIMESTAMP', 'When']] }],
  outputColumns: ['post_bucket', 'users_num'],

  starter: `-- Table: posts
SELECT user_id AS post_bucket, COUNT(*) AS users_num
FROM posts
GROUP BY user_id
ORDER BY 1;
`,

  solution: `WITH per_user AS (
  SELECT user_id, COUNT(*) AS post_bucket
  FROM posts
  WHERE posted_at >= TIMESTAMP '2024-01-01' AND posted_at < TIMESTAMP '2025-01-01'
  GROUP BY user_id
)
SELECT post_bucket, COUNT(*) AS users_num
FROM per_user
GROUP BY post_bucket
ORDER BY post_bucket;
`,

  explanation: `**Aggregate twice.** The first \`GROUP BY\` turns posts into "posts per user"; the second groups *those numbers*, counting users per bucket. This two-level aggregation is how you build any distribution (orders per customer, sessions per day…).`,

  tests: [
    {
      name: 'Example',
      ordered: true,
      tables: { posts: [[1, 1, '2024-01-05 10:00:00'], [2, 1, '2024-02-05 10:00:00'], [3, 2, '2024-03-01 10:00:00'], [4, 3, '2024-04-01 10:00:00'], [5, 3, '2024-04-02 10:00:00'], [6, 4, '2023-12-31 23:00:00']] },
      expected: [[1, 1], [2, 2]],
    },
    { name: 'One busy user', ordered: true, tables: { posts: [[1, 9, '2024-06-01 10:00:00'], [2, 9, '2024-06-01 11:00:00'], [3, 9, '2024-06-02 10:00:00']] }, expected: [[3, 1]] },
    { name: 'No posts', hidden: true, ordered: true, tables: { posts: [] }, expected: [] },
    { name: 'Only 2024 posts count', hidden: true, ordered: true, tables: { posts: [[1, 5, '2023-06-01 10:00:00'], [2, 5, '2024-06-01 10:00:00'], [3, 5, '2025-01-01 00:00:00']] }, expected: [[1, 1]] },
    {
      name: 'Several buckets',
      hidden: true,
      ordered: true,
      tables: { posts: [[1, 1, '2024-01-01 00:00:00'], [2, 2, '2024-01-01 00:00:00'], [3, 2, '2024-01-02 00:00:00'], [4, 3, '2024-01-01 00:00:00'], [5, 3, '2024-01-02 00:00:00'], [6, 3, '2024-01-03 00:00:00'], [7, 4, '2024-05-05 00:00:00']] },
      expected: [[1, 2], [2, 1], [3, 1]],
    },
  ],
};
