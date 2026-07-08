// ---------------------------------------------------------------------------
// Default site content — used to seed MongoDB on first run (and for resets).
// After seeding, all edits happen through the /admin panel.
// Text wrapped in *asterisks* renders in the accent color on the frontend.
// ---------------------------------------------------------------------------

export const defaultContent = {
  meta: {
    siteName: 'Chaitanya Tyagi',
    logoLetter: 'C',
    role: 'Data Engineer',
  },

  nav: {
    items: [
      { href: '#work', label: 'Experience' },
      { href: '#projects', label: 'Projects' },
      { href: '#knowledge', label: 'Knowledge Base' },
      { href: '#course', label: 'Course' },
      { href: '#chatbot', label: 'Ask AI' },
      { href: '#connect', label: 'Connect' },
    ],
    resumeLabel: 'Résumé',
  },

  hero: {
    kicker: 'Data Engineer · Accenture → Blinkit',
    title: 'I build data pipelines that *move markets* at scale.',
    intro:
      "I'm Chaitanya — a data engineer with 2+ years designing scalable ETL workflows, real-time streaming, and cloud-native platforms on GCP. I modernized regulatory reporting for American Express at Accenture, and I'm now joining Blinkit as a Data Engineer / BI Engineer.",
    ctaPrimary: 'View featured work',
    ctaSecondary: 'Book a 1:1 call',
    pipelineLabel: '// how i think about data',
    pipeline: [
      { step: '01', name: 'Ingest', tool: 'Pub/Sub · Kafka' },
      { step: '02', name: 'Transform', tool: 'PySpark · dbt' },
      { step: '03', name: 'Validate', tool: 'DQ framework' },
      { step: '04', name: 'Orchestrate', tool: 'Airflow' },
      { step: '05', name: 'Serve', tool: 'BigQuery · APIs' },
    ],
    stats: [
      { value: '2+ yrs', label: 'Building production data systems' },
      { value: '10+', label: 'Global markets migrated to GCP' },
      { value: '100%', label: 'Automated DQ validation delivered' },
      { value: '500+', label: 'DSA problems · LeetCode ~1800' },
    ],
  },

  about: {
    heading: 'Turning messy, high-volume data into reliable systems.',
    paragraphs: [
      'I graduated from NIT Jaipur in 2024 and jumped straight into large-scale data engineering — two years at Accenture migrating global markets for American Express from on-prem platforms to GCP, where correctness, parity, and SLAs aren’t optional. Next up: Blinkit, building data and BI systems for quick commerce.',
      'I care about idempotent design, automated data-quality validation, and event-driven orchestration. Outside work I write a growing reference library of data engineering design patterns and build AI-powered data tools.',
    ],
    facts: [
      { k: 'EDU', a: 'B.Tech, NIT Jaipur', b: '2020–2024 · GPA 7.72' },
      { k: 'CERT', a: 'Google Cloud', b: 'Digital Leader' },
      { k: 'DSA', a: '500+ solved', b: 'LeetCode ~1800 global' },
    ],
    stackLabel: '// tech stack',
    stackGroups: [
      { label: 'Languages & Core', items: ['Python', 'SQL', 'Bash', 'Node.js', 'Express.js', 'Git'] },
      { label: 'Big Data & Processing', items: ['PySpark', 'Spark SQL', 'Hive', 'HDFS', 'Kafka', 'Batch + Real-time'] },
      { label: 'GCP Services', items: ['BigQuery', 'GCS', 'Pub/Sub', 'Dataproc', 'Cloud Composer', 'Airflow'] },
      { label: 'Modeling & Tools', items: ['Data Modeling', 'Data Warehousing', 'DBT', 'Pandas', 'REST API', 'Jira'] },
    ],
  },

  experience: {
    heading: "Where I've made an impact",
    jobs: [
      {
        company: 'Blinkit',
        role: 'Data Engineer · Business Intelligence',
        client: '',
        period: 'JOINING · JUL 2026',
        location: 'Gurugram, India',
        badge: '● Joining soon',
        summary:
          "Joining Blinkit — India's leading quick-commerce platform — to build the data and business-intelligence systems behind 10-minute deliveries at scale.",
        stack: [],
        bullets: [],
      },
      {
        company: 'Accenture',
        role: 'Data Engineer',
        client: 'Client · American Express (AMEX)',
        period: 'JUL 2024 — JUL 2026',
        location: 'Pune, India',
        badge: 'Cornerstone → GCP (LUMI)',
        summary:
          'Modernized regulatory reporting and bureau submission for American Express — migrated 10+ global markets from the on-prem Cornerstone platform to GCP (LUMI).',
        stack: ['BigQuery', 'PySpark', 'Airflow', 'Pub/Sub', 'Dataproc', 'GCS'],
        bullets: [
          { tag: 'MIGRATION', text: 'Migrated complex ETL pipelines to BigQuery with complete output parity — resolving syntax, transformation, and query-level gaps.' },
          { tag: 'DATA QUALITY', text: 'Built a PySpark validation framework orchestrated via Airflow — 100% automated reconciliation of regulatory reports across GCP projects.' },
          { tag: 'REAL-TIME', text: 'Architected the Maestro orchestration DAG — Pub/Sub-driven automation that triggers downstream ETL the moment ingestion events land.' },
          { tag: 'WAREHOUSE', text: 'Owned ingestion into the LUMI Unified Data Warehouse — schema alignment and pipeline reliability across multiple markets.' },
          { tag: 'HYBRID PIPELINES', text: 'Designed batch + streaming pipelines so scheduled bulk reports and event-driven workflows meet per-market SLAs.' },
          { tag: 'AUTOMATION', text: 'Reusable PySpark utilities for bureau file generation, edge-case validation, and SFTP delivery — zero manual steps.' },
        ],
      },
    ],
  },

  projects: {
    heading: "Things I've built end-to-end",
    description: 'Production-grade pipelines and AI-powered data tools — architecture, code, and results.',
    items: [
      {
        kind: 'AI × HEALTHCARE',
        name: 'EOC Data Extraction & AI Query System',
        desc: 'PDF-extraction pipeline that parses dense healthcare EOC documents into queryable datasets, plus a two-stage AI chatbot — intent classification + deterministic pandas filtering — answering plan questions at ~90% accuracy.',
        tech: ['Python', 'pdfplumber', 'PySpark', 'LLM (Ollama)', 'Streamlit'],
        url: 'https://github.com/chaitanyatyagi/EOCDataExtraction_AIChatbotSystem',
      },
      {
        kind: 'DATA LAKE · GCP',
        name: 'Healthcare RCM Data Lake',
        desc: 'Revenue-cycle analytics lake integrating EMR systems, daily claims feeds, and CPT/ICD codes through a Bronze → Silver → Gold architecture with SCD Type 2 history and a unified Common Data Model.',
        tech: ['GCP', 'BigQuery', 'Dataproc', 'Airflow', 'PySpark'],
        url: 'https://github.com/chaitanyatyagi/Healthcare_RevenueCycleManagement_DataLake',
      },
      {
        kind: 'ANALYTICS ENGINEERING',
        name: 'Netflix Analytics — dbt Warehouse',
        desc: 'Layered dbt warehouse on PostgreSQL — staging → dimensional → marts — with incremental fact tables, SCD Type 2 snapshots, custom validation macros, and schema tests enforcing referential integrity.',
        tech: ['dbt', 'PostgreSQL', 'SQL', 'Jinja'],
        url: 'https://github.com/chaitanyatyagi/dbt_netflix_project',
      },
      {
        kind: 'ETL PIPELINE',
        name: 'IPL Data Engineering Pipeline',
        desc: 'Production-style PySpark ETL over IPL match data — Bronze → Silver → Gold layers producing optimized Parquet datasets and a star schema modeled with surrogate keys.',
        tech: ['PySpark', 'SQL', 'HDFS', 'Parquet'],
        url: 'https://github.com/chaitanyatyagi',
      },
    ],
  },

  knowledge: {
    heading: 'Data Engineering Design Patterns',
    description:
      'An evolving reference library of production-grade architectural patterns — from ingestion to storage, quality, security, and value extraction.',
    githubUrl: 'https://github.com/chaitanyatyagi/DataEngineering_DesignPatterns',
    githubLabel: 'View on GitHub',
    chapters: [
      { num: '01', title: 'Data Flow', patterns: 'Idempotency · Dedup · Schema evolution · Backfill' },
      { num: '02', title: 'Data Quality', patterns: 'Gatekeeper · Quarantine · Anomaly detection' },
      { num: '03', title: 'Data Security', patterns: 'Vertical partition · Tokenizer · Encryption' },
      { num: '04', title: 'Data Storage', patterns: 'Partitioning · Bucketing · Materialization' },
      { num: '05', title: 'Data Value', patterns: 'Enrichment · Aggregation · Sessionization' },
    ],
    moreText: 'More chapters in progress — new patterns are added regularly. Watch the repo to stay updated.',
  },

  course: {
    badge: '◷ Coming soon',
    heading: "The Data Engineer's Interview Playbook",
    description:
      'A structured course built from real interviews and production experience — downloadable PDFs plus a curated bank of interview questions and answers across the modern data stack.',
    modules: [
      { no: '01', title: 'Data Modeling & Warehousing fundamentals', meta: '12 lessons' },
      { no: '02', title: 'PySpark & distributed processing', meta: '15 lessons' },
      { no: '03', title: 'Orchestration with Airflow', meta: '9 lessons' },
      { no: '04', title: 'GCP & the modern data stack', meta: '11 lessons' },
      { no: '05', title: 'System design & the interview loop', meta: '18 lessons' },
    ],
    moreText: 'More modules on the way — drop your email to be the first to know.',
    qaQuestion: 'Q. How do you guarantee exactly-once writes?',
    qaAnswer:
      'Use deterministic keys with MERGE/upsert semantics so every write is safely re-executable — the Idempotent Writer pattern…',
    qaMore: '+ a full bank of interview Q&As at launch',
  },

  chatbot: {
    comingSoon: true,
    badge: '◷ Coming soon',
    kicker: '// ask ai',
    heading: 'Ask my data engineering assistant',
    description:
      'An AI assistant trained on my focus areas — pipelines, PySpark, BigQuery, Airflow, data modeling, and design patterns. Launching soon.',
    statusText: 'de-assistant · in training',
    poweredBy: 'powered by Claude',
    greeting:
      "Hey! I'm Chaitanya's data engineering assistant. Ask me about ETL design, PySpark, BigQuery, Airflow orchestration, or data engineering patterns.",
    placeholder: 'Ask about ETL, PySpark, BigQuery, Airflow…',
    suggestions: [
      { label: 'Idempotent pipelines?', q: 'How do you design an idempotent data pipeline?' },
      { label: 'PySpark vs SQL?', q: 'When should I use PySpark over BigQuery SQL for transformations?' },
      { label: 'Slowly changing dims', q: 'Explain SCD Type 2 and when to use it.' },
    ],
  },

  scheduler: {
    heading: 'Book a 1:1 mentorship call',
    description:
      "Career advice, mock interviews, or a deep-dive on your data architecture. Pick a date and a slot, and let's talk.",
    // Weekdays open for booking: 0 = Sunday … 6 = Saturday
    availableWeekdays: [1, 3, 5, 6],
    slots: [
      { time: '09:00 AM', dur: '30 MIN' },
      { time: '11:30 AM', dur: '30 MIN' },
      { time: '02:00 PM', dur: '45 MIN' },
      { time: '05:30 PM', dur: '30 MIN' },
    ],
    note: 'Slots are confirmed over email within 24 hours.',
  },

  links: {
    email: 'chaitanyatyagi1540@gmail.com',
    phone: '+91 78040 02781',
    github: 'https://github.com/chaitanyatyagi',
    linkedin: 'https://www.linkedin.com/in/chaitanya-tyagi-21964b201/',
    resume: '/Chaitanya-Tyagi-Resume.pdf',
    location: 'Pune, India',
  },

  footer: {
    headline: "Let's build reliable data systems together.",
    tagline: 'Built with data-driven intent.',
    copyright: '© 2026 Chaitanya Tyagi · Data Engineer',
  },
};
