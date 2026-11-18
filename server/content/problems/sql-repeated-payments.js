export default {
  id: 'repeated-payments',
  track: 'sql',
  title: 'Accidental Repeat Payments',
  difficulty: 'Hard',
  topics: ['Window Functions', 'Date & Time', 'Aggregation'],
  patterns: ['Previous row (LAG)', 'Duplicates within a time window'],
  domains: ['Payments / Fintech'],
  companies: ['Stripe'],
  sources: [
    { company: 'Stripe', label: 'DataLemur — Stripe "Repeated Payments"', url: 'https://datalemur.com/questions' },
    { company: 'Stripe', label: 'SparkPlayground — Stripe "Duplicate Ride Fares"', url: 'https://www.sparkplayground.com/pyspark-coding-interview-questions' },
  ],
  summary: 'Count payments that repeat the same merchant, card and amount within 10 minutes.',

  description: `A double-click on "Pay" can charge a card twice. A payment is a **repeat** when the **same merchant, card and amount** was paid **at most 10 minutes earlier** (by the previous payment with that same merchant, card and amount).

Return a single column \`repeated_payments\`: how many payments are repeats. In a chain at 10:00, 10:10 and 10:20, the last two are repeats.`,

  hints: [
    'Partition by merchant_id, card_id and amount; order by paid_at.',
    'LAG(paid_at) is the previous identical payment.',
    'paid_at - prev <= INTERVAL 10 MINUTE — and the very first payment has no previous one.',
  ],

  schema: [{ name: 'payments', columns: [['payment_id', 'INTEGER', 'Primary key'], ['merchant_id', 'INTEGER', 'Merchant'], ['card_id', 'INTEGER', 'Card'], ['amount', 'DOUBLE', 'Amount'], ['paid_at', 'TIMESTAMP', 'When']] }],
  outputColumns: ['repeated_payments'],

  starter: `-- Table: payments
SELECT COUNT(*) - COUNT(DISTINCT card_id) AS repeated_payments
FROM payments;
`,

  solution: `WITH ordered AS (
  SELECT
    paid_at,
    LAG(paid_at) OVER (PARTITION BY merchant_id, card_id, amount ORDER BY paid_at) AS prev_paid_at
  FROM payments
)
SELECT COUNT(*) AS repeated_payments
FROM ordered
WHERE prev_paid_at IS NOT NULL
  AND paid_at - prev_paid_at <= INTERVAL 10 MINUTE;
`,

  explanation: `**LAG over the "identity" of a payment.** Partitioning by (merchant, card, amount) puts identical payments together; \`LAG\` gives the previous one, and an interval comparison decides if it's a repeat.

A self-join (\`p2.paid_at BETWEEN p1.paid_at AND p1.paid_at + 10 min\`) also works but compares every pair inside a partition and can double-count chains; \`LAG\` looks at exactly one predecessor.`,

  tests: [
    {
      name: 'Example',
      ordered: true,
      tables: {
        payments: [
          [1, 101, 1, 100.0, '2024-09-25 12:00:00'], [2, 101, 1, 100.0, '2024-09-25 12:08:00'], [3, 101, 2, 100.0, '2024-09-25 12:09:00'],
          [4, 101, 1, 100.0, '2024-09-25 12:28:00'], [5, 102, 1, 100.0, '2024-09-25 12:09:00'],
        ],
      },
      expected: [[1]],
    },
    {
      name: 'A chain exactly 10 minutes apart',
      ordered: true,
      tables: { payments: [[1, 1, 1, 5.0, '2024-01-01 10:00:00'], [2, 1, 1, 5.0, '2024-01-01 10:10:00'], [3, 1, 1, 5.0, '2024-01-01 10:20:00']] },
      expected: [[2]],
    },
    { name: 'No payments', hidden: true, ordered: true, tables: { payments: [] }, expected: [[0]] },
    { name: 'Different amounts are different payments', hidden: true, ordered: true, tables: { payments: [[1, 1, 1, 5.0, '2024-01-01 10:00:00'], [2, 1, 1, 6.0, '2024-01-01 10:01:00']] }, expected: [[0]] },
    {
      name: 'One second over the window; unordered input',
      hidden: true,
      ordered: true,
      tables: { payments: [[1, 7, 7, 9.0, '2024-01-01 10:10:01'], [2, 7, 7, 9.0, '2024-01-01 10:00:00'], [3, 7, 7, 9.0, '2024-01-01 10:12:00']] },
      expected: [[1]],
    },
  ],
};
