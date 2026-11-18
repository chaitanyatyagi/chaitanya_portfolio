// ---------------------------------------------------------------------------
// Design & hackathon tracks — format, rubric and sample briefs. These tracks
// are open-ended (no single correct output), so they're reviewed against a
// rubric instead of graded by test cases.
// ---------------------------------------------------------------------------

export const CHALLENGE_TRACKS = {
  'data-modeling': {
    format: 'Design challenge',
    pitch: 'Read a product brief, then design the data model behind it — entities, keys, relationships, and for analytics, the facts and dimensions at the right grain.',
    steps: [
      ['Read the brief', 'A product scenario with the questions the business needs answered.'],
      ['Model it', 'Define tables, columns, keys and relationships in the built-in schema editor.'],
      ['Validate', 'Automated checks run sample business questions against your model.'],
      ['Compare', 'See the reference model and the trade-offs it makes.'],
    ],
    deliverables: ['Table definitions with primary and foreign keys', 'Declared grain for every fact table', 'SCD strategy for each changing dimension', 'Short notes on trade-offs'],
    rubric: [['Correct grain & keys', 30], ['Answers every business question', 30], ['Handles change over time (SCDs)', 20], ['Simplicity & naming', 20]],
    briefs: [
      { title: 'Library Lending System', difficulty: 'Easy', tags: ['Normalization', 'One-to-Many'], text: 'Books, copies, members and loans — including holds and late fees.' },
      { title: 'Ride-Hailing Trips Mart', difficulty: 'Medium', tags: ['Star Schema', 'Fact Grain'], text: 'Model trips, drivers, riders and surge pricing for hourly city-level KPIs.' },
      { title: 'Subscription Billing with History', difficulty: 'Hard', tags: ['SCD Types', 'Bridge Tables'], text: 'Plans change, customers upgrade mid-cycle, and finance needs MRR as of any date.' },
    ],
  },
  'pipeline-hackathon': {
    format: 'Hackathon',
    pitch: 'Build a working end-to-end pipeline against a realistic brief: messy sources, a target model, and production constraints like late data and reruns.',
    steps: [
      ['Brief drops', 'Sources, target tables, SLAs and the constraints that make it hard.'],
      ['Build', 'Write the ingestion, transformations, quality checks and orchestration.'],
      ['Submit', 'Submit your code, a DAG / architecture diagram and a README of trade-offs.'],
      ['Review', 'Scored against the rubric; top submissions are published with feedback.'],
    ],
    deliverables: ['Pipeline code (Python / PySpark / SQL)', 'Orchestration definition (e.g. Airflow DAG)', 'Data-quality checks', 'README covering idempotency, backfills and failure handling'],
    rubric: [['Correct output', 30], ['Idempotency & reruns', 25], ['Data quality', 20], ['Design & orchestration', 15], ['Documentation', 10]],
    briefs: [
      { title: 'Daily Sales Ingestion', difficulty: 'Easy', tags: ['Batch Ingestion', 'Data Quality'], text: 'Land daily CSV drops from 40 stores, validate them and build a clean sales fact table.' },
      { title: 'CDC to Lakehouse', difficulty: 'Medium', tags: ['CDC', 'Idempotency'], text: 'Apply an insert/update/delete feed to bronze → silver → gold tables with safe reruns.' },
      { title: 'Late-Arriving Clickstream', difficulty: 'Hard', tags: ['Late Data', 'Backfills'], text: 'Hourly sessions from mobile events that arrive up to 48 hours late, with backfills.' },
    ],
  },
  'system-design-hackathon': {
    format: 'Hackathon',
    pitch: 'Architect a data platform for a scale scenario. There is no single right answer — you are judged on requirements, trade-offs and how the design behaves under failure.',
    steps: [
      ['Brief drops', 'Scale numbers, consumers, latency and freshness requirements, budget.'],
      ['Design', 'Draw the architecture and write up the components and data flow.'],
      ['Defend', 'Answer the follow-ups: failures, backfills, cost, growth to 10×.'],
      ['Review', 'Scored against the rubric with written feedback.'],
    ],
    deliverables: ['Architecture diagram', 'Component and data-flow write-up', 'Capacity and cost estimate', 'Failure modes and how the design handles them'],
    rubric: [['Requirements coverage', 25], ['Trade-off reasoning', 25], ['Scalability & reliability', 25], ['Cost awareness', 15], ['Clarity', 10]],
    briefs: [
      { title: 'Smart-Parking Occupancy', difficulty: 'Medium', tags: ['Streaming', 'Real-time Analytics'], text: '50,000 sensors reporting every 30 seconds; live availability plus monthly city reports.' },
      { title: 'Retail Lakehouse Migration', difficulty: 'Medium', tags: ['Lakehouse', 'Batch Platforms'], text: 'Move a nightly on-prem warehouse to a lakehouse without breaking 300 reports.' },
      { title: 'Global Payments Ledger', difficulty: 'Hard', tags: ['CDC Replication', 'Governance'], text: 'Exactly-once ledger analytics across regions, with PII controls and audit trails.' },
    ],
  },
};
