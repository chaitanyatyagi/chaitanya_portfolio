// ---------------------------------------------------------------------------
// Platform brand & marketing copy.
//   BRAND          → name / tagline used across nav, footer, page titles
//   ROLES          → career paths shown on the landing page
// Marketing copy only. Courses, tracks, problems and stats come from the API
// (/api/catalog) — see src/lib/useApi.js.
// ---------------------------------------------------------------------------

export const BRAND = {
  name: 'DataDrill',
  tagline: 'Practice data engineering like the job.',
  description:
    'Structured courses and hands-on practice for data engineers, analytics engineers and analysts — SQL, Python, PySpark, data modeling, pipelines and system design.',
};

export const ROLES = [
  {
    id: 'data-engineer',
    title: 'Data Engineer',
    level: 'Beginner → Advanced',
    blurb: 'Build reliable batch and streaming pipelines, from ingestion to serving.',
    skills: ['SQL', 'Python', 'PySpark', 'Airflow', 'Data Modeling', 'System Design'],
  },
  {
    id: 'analytics-engineer',
    title: 'Analytics Engineer',
    level: 'Beginner → Intermediate',
    blurb: 'Turn raw tables into trusted, well-modeled datasets the business can use.',
    skills: ['SQL', 'Data Modeling', 'Data Quality', 'Warehousing', 'Python'],
  },
  {
    id: 'data-analyst',
    title: 'Data Analyst',
    level: 'Beginner',
    blurb: 'Answer business questions with clean queries, metrics and clear insight.',
    skills: ['SQL', 'Python', 'Window Functions', 'Metrics Design'],
  },
];

export const UPCOMING_TRACKS = ['dbt', 'Airflow', 'Kafka', 'Data Quality', 'Cloud (GCP / AWS)'];
