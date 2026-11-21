// ---------------------------------------------------------------------------
// Practice tracks — seed source for the `tracks` table. Design / hackathon
// tracks also get their format, rubric and sample briefs from ./challenges.js.
// Run `npm run seed` (in server/) after editing.
// ---------------------------------------------------------------------------
// kind: 'editor'    → solved in the in-browser code editor against test cases
//       'design'    → modeling challenge, submitted as a design
//       'hackathon' → open-ended build / architecture challenge
// status: 'live' | 'soon'
// topics: the track's full skill taxonomy — every problem's `topics` must come from it.
//
// Problem tag vocabulary (see docs §8.12):
//   difficulty  Easy | Medium | Hard           → base points 10 | 20 | 40
//   topics      skills, from the track taxonomy below
//   patterns    reusable technique, shared across tracks, e.g. 'Top-N per group',
//               'Latest record per key', 'Filter → join → aggregate'
//   domains     scenario industry, e.g. 'E-commerce / Sales', 'Web server logs'
//   companies   ONLY verified interview reports (with a source) — never invented
export const TRACKS = [
  {
    id: 'sql', title: 'SQL', short: 'SQL', kind: 'editor', status: 'live', icon: 'sql', course: 'databases',
    blurb: 'Joins, aggregations, window functions and CTEs on realistic business tables.',
    topics: [
      'Filtering & Sorting', 'Aggregation', 'Joins', 'Subqueries', 'CTEs', 'Window Functions', 'Ranking',
      'Conditional Logic', 'NULL Handling', 'Date & Time', 'String Functions', 'Set Operations',
      'Pivoting', 'Deduplication', 'Gaps & Islands', 'Running Totals',
      'Recursive CTEs', 'Hierarchies & Graphs', 'Regular Expressions', 'Statistics', 'Funnels & Retention',
      'Data Quality', 'Arrays & Nested Data', 'Case Studies',
    ],
  },
  {
    id: 'python', title: 'Python', short: 'Python', kind: 'editor', status: 'live', icon: 'python', course: null,
    blurb: 'Core Python in depth — functions, closures, decorators, generators, OOP, exceptions — plus the parsing, streaming and DSA problems data interviews ask.',
    topics: [
      // language core
      'Strings', 'Lists & Tuples', 'Dicts & Sets', 'Sorting', 'Comprehensions', 'Functions & Lambdas',
      'Arguments & Scope', 'Higher-Order Functions', 'Closures & Decorators', 'Generators & Iterators',
      'Recursion', 'Copying & Mutability', 'Modules & Packages',
      // object-oriented Python
      'OOP', 'Inheritance & MRO', 'Magic Methods',
      // standard library & runtime
      'Error Handling', 'Parsing (CSV / JSON)', 'Serialization', 'Regular Expressions', 'Datetime', 'Logging',
      'Concurrency', 'Database Access (DB-API)', 'Collections & itertools',
      // data engineering
      'Data Wrangling', 'Intervals & Sessions', 'Streaming & State',
      // algorithms interviews ask
      'Hash Maps & Counting', 'Two Pointers & Sliding Window', 'Stacks & Queues', 'Heaps', 'Binary Search',
      'Graphs (BFS / DFS)', 'Trees', 'Dynamic Programming', 'Math & Bits', 'Matrices',
    ],
  },
  {
    id: 'dsa', title: 'DSA', short: 'DSA', kind: 'editor', status: 'live', icon: 'code', course: null,
    blurb: 'Every core algorithm pattern for coding rounds — arrays to graphs, trees, tries and DP — solved in Python and graded on hidden tests.',
    topics: [
      'Arrays', 'Matrices', 'Hashing', 'Prefix Sums', 'Two Pointers', 'Sliding Window', 'Sorting', 'Binary Search',
      'Strings', 'Linked Lists', 'Recursion & Backtracking', 'Greedy', 'Intervals', 'Stacks & Queues', 'Monotonic Stack',
      'Heaps', 'Binary Trees', 'Binary Search Trees', 'Tries', 'Graphs: Traversal', 'Graphs: Shortest Paths',
      'Graphs: MST & Union-Find', 'Topological Sort', 'Dynamic Programming', 'Bit Manipulation', 'Math & Number Theory',
      'Design',
    ],
  },
  {
    id: 'pyspark', title: 'PySpark', short: 'PySpark', kind: 'editor', status: 'live', icon: 'spark', course: 'pyspark',
    blurb: 'DataFrame transformations, windows, joins and incremental loads — graded on output.',
    topics: [
      'DataFrame Basics', 'Column Expressions', 'Filtering', 'Aggregation', 'Joins', 'Window Functions',
      'Ranking & Top-N', 'Deduplication', 'NULL Handling', 'Date & Time', 'Strings & Regex',
      'Complex Types (Arrays / Structs)', 'Maps & JSON', 'Pivoting', 'Set Operations', 'Spark SQL',
      'Schema Handling', 'Data Quality', 'Gaps & Islands', 'Statistics', 'Funnels & Retention',
      'SCD & Incremental Loads', 'Sessionization',
    ],
  },
  {
    id: 'pandas', title: 'Pandas', short: 'Pandas', kind: 'editor', status: 'live', icon: 'pandas', course: null,
    blurb: 'Clean, join, reshape and aggregate DataFrames — the analyst and DE workhorse, graded on the output frame.',
    topics: [
      'Selection & Filtering', 'Missing Data', 'GroupBy & Aggregation', 'Merge & Join', 'Reshaping (Pivot / Melt)',
      'Sorting & Ranking', 'Deduplication', 'Datetime', 'String Methods', 'Window & Rolling', 'Apply & Vectorization',
      'Data Cleaning',
    ],
  },
  {
    id: 'shell', title: 'Shell', short: 'Shell', kind: 'editor', status: 'live', icon: 'terminal', course: null,
    blurb: 'Bash one-liners and scripts for logs and files — grep, awk, sed, sort, uniq, pipes — run in a sandboxed shell.',
    topics: [
      'Text Search (grep)', 'Field Extraction (cut / awk)', 'Sorting & Counting', 'Stream Editing (sed / tr)',
      'Pipes & Redirection', 'Variables & Loops', 'Conditionals & Exit Codes', 'Log Analysis', 'CSV Processing',
      'JSON (jq)', 'File Operations',
    ],
  },
  {
    id: 'data-modeling', title: 'Data Modeling', short: 'Modeling', kind: 'design', status: 'soon', icon: 'model', course: 'patterns',
    blurb: 'Design relational and dimensional models for real products — facts, dims, grain, SCDs.',
    topics: [
      'Normalization', 'ER Modeling', 'Star Schema', 'Snowflake Schema', 'Fact Grain', 'SCD Types',
      'Bridge Tables', 'Data Vault', 'Many-to-Many',
    ],
  },
  {
    id: 'pipeline-hackathon', title: 'Pipeline Development', short: 'Pipeline', kind: 'hackathon', status: 'soon', icon: 'pipeline', course: 'airflow',
    blurb: 'Hackathon: build an end-to-end pipeline — ingest, transform, validate, orchestrate.',
    topics: ['Batch Ingestion', 'CDC', 'Idempotency', 'Backfills', 'Data Quality', 'Orchestration', 'Late Data', 'Streaming'],
  },
  {
    id: 'system-design-hackathon', title: 'System Design', short: 'System Design', kind: 'hackathon', status: 'soon', icon: 'system', course: 'patterns',
    blurb: 'Hackathon: architect data platforms at scale — streaming, lakehouse, SLAs and cost.',
    topics: ['Batch Platforms', 'Streaming', 'Lakehouse', 'CDC Replication', 'Real-time Analytics', 'Governance', 'Scalability', 'Cost & SLAs'],
  },
];

export const UPCOMING_TRACKS = ['dbt', 'Airflow', 'Kafka', 'Data Quality', 'Cloud (GCP / AWS)'];

