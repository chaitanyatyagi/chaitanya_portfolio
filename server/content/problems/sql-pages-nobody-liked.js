export default {
  id: 'pages-nobody-liked',
  track: 'sql',
  title: 'Pages Nobody Liked',
  difficulty: 'Easy',
  topics: ['Joins', 'Subqueries', 'NULL Handling'],
  patterns: ['Anti-join (LEFT JOIN … IS NULL / NOT EXISTS)'],
  domains: ['Social media'],
  companies: ['Meta'],
  sources: [{ company: 'Meta', label: 'DataLemur — Facebook "Page With No Likes"', url: 'https://datalemur.com/questions' }],
  summary: 'Find the pages with zero likes — and dodge the NOT IN + NULL trap.',

  description: `A social network stores its pages in \`pages\` and every like in \`page_likes\`. The growth team wants to nudge page owners whose pages have **never been liked**.

Return the \`page_id\` and \`page_name\` of every page with **no rows** in \`page_likes\`, ordered by \`page_id\`.

Watch out: \`page_likes.page_id\` is nullable (likes on deleted pages are kept with a NULL page), and it may also contain ids that no longer exist in \`pages\`.`,

  hints: [
    'This is an anti-join: keep rows of one table that have no match in another.',
    'LEFT JOIN page_likes and keep rows where the joined side IS NULL — or use NOT EXISTS.',
    'Why is NOT IN dangerous here? What does `1 NOT IN (2, NULL)` evaluate to?',
  ],

  schema: [
    { name: 'pages', columns: [['page_id', 'INTEGER', 'Primary key'], ['page_name', 'VARCHAR', 'Display name']] },
    {
      name: 'page_likes',
      columns: [['user_id', 'INTEGER', 'Who liked'], ['page_id', 'INTEGER', 'Liked page (nullable)'], ['liked_at', 'TIMESTAMP', 'When']],
    },
  ],
  outputColumns: ['page_id', 'page_name'],

  starter: `-- Tables: pages, page_likes
SELECT page_id, page_name
FROM pages;
`,

  solution: `SELECT p.page_id, p.page_name
FROM pages p
WHERE NOT EXISTS (
  SELECT 1 FROM page_likes l WHERE l.page_id = p.page_id
)
ORDER BY p.page_id;
`,

  explanation: `**Anti-join.** \`NOT EXISTS\` keeps a page when no like references it. It is NULL-safe: a like with \`page_id = NULL\` simply never matches.

The tempting \`WHERE page_id NOT IN (SELECT page_id FROM page_likes)\` returns **nothing** as soon as the subquery contains a NULL, because \`x NOT IN (…, NULL)\` is unknown, never true. \`LEFT JOIN … WHERE l.page_id IS NULL\` is the other safe spelling.

**Complexity:** one hash anti-join — O(n + m).`,

  tests: [
    {
      name: 'Example',
      ordered: true,
      tables: {
        pages: [[1, 'Data Eng Weekly'], [2, 'SQL Tips'], [3, 'Spark Memes'], [4, 'Airflow Fans']],
        page_likes: [[10, 1, '2024-05-01 10:00:00'], [11, 1, '2024-05-02 10:00:00'], [12, 3, '2024-05-02 11:00:00']],
      },
      expected: [[2, 'SQL Tips'], [4, 'Airflow Fans']],
    },
    {
      name: 'Every page liked',
      ordered: true,
      tables: { pages: [[1, 'A'], [2, 'B']], page_likes: [[1, 1, '2024-05-01 10:00:00'], [2, 2, '2024-05-01 10:00:00']] },
      expected: [],
    },
    {
      name: 'Likes with a NULL page',
      hidden: true,
      ordered: true,
      tables: { pages: [[1, 'A'], [2, 'B'], [3, 'C']], page_likes: [[5, null, '2024-05-01 10:00:00'], [6, 2, '2024-05-01 10:00:00']] },
      expected: [[1, 'A'], [3, 'C']],
    },
    {
      name: 'No likes at all, unordered pages',
      hidden: true,
      ordered: true,
      tables: { pages: [[7, 'X'], [5, 'Y']], page_likes: [] },
      expected: [[5, 'Y'], [7, 'X']],
    },
    {
      name: 'Likes on pages that no longer exist',
      hidden: true,
      ordered: true,
      tables: { pages: [[1, 'A']], page_likes: [[1, 99, '2024-05-01 10:00:00']] },
      expected: [[1, 'A']],
    },
  ],
};
