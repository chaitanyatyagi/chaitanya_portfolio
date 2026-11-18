// ---------------------------------------------------------------------------
// Guide registry — groups → topics → markdown content.
// Markdown files live in ./content/*.md (imported raw via Vite).
// To add a topic: drop a .md file in content/ and register it below.
// ---------------------------------------------------------------------------
import overview from './content/overview.md?raw';
import patternsFlow from './content/patterns-flow.md?raw';
import patternsQuality from './content/patterns-quality.md?raw';
import patternsStorage from './content/patterns-storage.md?raw';
import patternsSecurity from './content/patterns-security.md?raw';
import patternsValue from './content/patterns-value.md?raw';
import airflowCore from './content/airflow-core.md?raw';
import airflowDags from './content/airflow-dags.md?raw';
import airflowOperators from './content/airflow-operators.md?raw';
import airflowSensors from './content/airflow-sensors.md?raw';
import airflowXcom from './content/airflow-xcom-taskflow.md?raw';
import airflowHooks from './content/airflow-hooks-config.md?raw';
import airflowExecutors from './content/airflow-executors.md?raw';
import airflowScheduling from './content/airflow-scheduling.md?raw';
import airflowProduction from './content/airflow-production.md?raw';
import airflowInterview from './content/airflow-interview.md?raw';
import pysparkFundamentals from './content/pyspark-fundamentals.md?raw';
import pysparkArchitecture from './content/pyspark-architecture.md?raw';
import pysparkExecution from './content/pyspark-execution-model.md?raw';
import pysparkReading from './content/pyspark-reading-data.md?raw';
import pysparkTransformations from './content/pyspark-transformations.md?raw';
import pysparkWindows from './content/pyspark-window-functions.md?raw';
import pysparkJoins from './content/pyspark-joins.md?raw';
import pysparkParquet from './content/pyspark-parquet-writing.md?raw';
import pysparkMemory from './content/pyspark-memory.md?raw';
import pysparkCaching from './content/pyspark-caching-resources.md?raw';
import pysparkOptimization from './content/pyspark-optimization.md?raw';
import pysparkRealWorld from './content/pyspark-real-world.md?raw';
import mysqlIndexing from './content/mysql-indexing.md?raw';
import mysqlProcedures from './content/mysql-procedures.md?raw';
import mysqlTriggers from './content/mysql-triggers.md?raw';

export const GUIDE_GROUPS = [
  {
    id: 'start',
    label: 'Start Here',
    topics: [
      { slug: 'overview', title: 'Welcome & Roadmap', md: overview },
    ],
  },
  {
    id: 'patterns',
    label: 'Data Design Patterns',
    topics: [
      { slug: 'data-flow-patterns', title: 'Data Flow Patterns', md: patternsFlow },
      { slug: 'data-quality-patterns', title: 'Data Quality Patterns', md: patternsQuality },
      { slug: 'data-storage-patterns', title: 'Data Storage Patterns', md: patternsStorage },
      { slug: 'data-security-patterns', title: 'Data Security Patterns', md: patternsSecurity },
      { slug: 'data-value-patterns', title: 'Data Value Patterns', md: patternsValue },
    ],
  },
  {
    id: 'airflow',
    label: 'Apache Airflow',
    topics: [
      { slug: 'airflow-architecture', title: 'Architecture & Core Concepts', md: airflowCore },
      { slug: 'airflow-dags', title: 'DAGs Deep Dive', md: airflowDags },
      { slug: 'airflow-operators', title: 'Operators & Trigger Rules', md: airflowOperators },
      { slug: 'airflow-sensors', title: 'Sensors', md: airflowSensors },
      { slug: 'airflow-xcom-taskflow', title: 'XComs & TaskFlow API', md: airflowXcom },
      { slug: 'airflow-hooks-config', title: 'Hooks, Variables & Pools', md: airflowHooks },
      { slug: 'airflow-executors', title: 'Executors & Scaling', md: airflowExecutors },
      { slug: 'airflow-scheduling', title: 'Scheduling & Dynamic DAGs', md: airflowScheduling },
      { slug: 'airflow-production', title: 'Testing & Production Practices', md: airflowProduction },
      { slug: 'airflow-interview-qa', title: 'Interview Q&A', md: airflowInterview },
    ],
  },
  {
    id: 'pyspark',
    label: 'PySpark',
    topics: [
      { slug: 'spark-fundamentals', title: 'Spark Fundamentals', md: pysparkFundamentals },
      { slug: 'spark-architecture', title: 'Architecture & How PySpark Runs', md: pysparkArchitecture },
      { slug: 'spark-execution-model', title: 'DAGs, Stages & Catalyst', md: pysparkExecution },
      { slug: 'pyspark-reading-data', title: 'Reading Data & Schemas', md: pysparkReading },
      { slug: 'pyspark-transformations', title: 'DataFrame Transformations', md: pysparkTransformations },
      { slug: 'pyspark-window-functions', title: 'Window Functions', md: pysparkWindows },
      { slug: 'pyspark-joins', title: 'Joins & Join Strategies', md: pysparkJoins },
      { slug: 'spark-parquet-writing', title: 'Parquet & Writing Data', md: pysparkParquet },
      { slug: 'spark-memory-management', title: 'Memory Management', md: pysparkMemory },
      { slug: 'spark-caching-resources', title: 'Caching & Resource Allocation', md: pysparkCaching },
      { slug: 'spark-optimization', title: 'AQE, Skew & Optimization', md: pysparkOptimization },
      { slug: 'pyspark-real-world', title: 'JSON, UDFs & SCD2 Patterns', md: pysparkRealWorld },
    ],
  },
  {
    id: 'databases',
    label: 'Databases & MySQL',
    topics: [
      { slug: 'database-indexing', title: 'Indexing Architecture', md: mysqlIndexing },
      { slug: 'mysql-stored-procedures', title: 'Stored Procedures', md: mysqlProcedures },
      { slug: 'mysql-triggers', title: 'Triggers', md: mysqlTriggers },
    ],
  },
];

export const ALL_TOPICS = GUIDE_GROUPS.flatMap((g) =>
  g.topics.map((topic) => ({ ...topic, groupId: g.id, groupLabel: g.label }))
);

export function findTopic(slug) {
  return ALL_TOPICS.find((topic) => topic.slug === slug) || ALL_TOPICS[0];
}

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// Section list for the sidebar: every `## ` heading in the topic's markdown.
export function topicSections(md) {
  return (md.match(/^## .+$/gm) || []).map((line) => {
    const title = line.slice(3).trim();
    return { id: slugify(title), title };
  });
}

// Stats used by the home-page highlight cards.
export const GUIDE_STATS = {
  topics: ALL_TOPICS.length,
  sections: ALL_TOPICS.reduce((n, topic) => n + topicSections(topic.md).length, 0),
};
