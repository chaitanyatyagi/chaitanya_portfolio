// Case studies — SaaS subscriptions, e-commerce returns, payments fraud.
import { sql, md } from './define.js';

const ALL = ['Data Analyst', 'Data Scientist', 'Data Engineer', 'Analytics Engineer'];

// ---- SaaS subscriptions (MRR) ---------------------------------------------------------
const SAAS = 'saas-subscriptions';
const saasSchema = {
  customers: 'customer_id INTEGER Primary key, segment VARCHAR smb / mid / enterprise',
  subscriptions: 'sub_id INTEGER Primary key, customer_id INTEGER Customer, plan VARCHAR basic / pro / max, mrr DOUBLE Monthly recurring revenue, started_on DATE First day, ended_on DATE Last day (NULL = active)',
};
const CUST = [[1, 'smb'], [2, 'smb'], [3, 'mid'], [4, 'enterprise'], [5, 'mid'], [6, 'smb']];
const SUBS = [
  [1, 1, 'basic', 50.0, '2024-01-10', '2024-03-15'], [2, 1, 'pro', 120.0, '2024-03-16', null], [3, 2, 'basic', 50.0, '2024-01-05', '2024-02-20'],
  [4, 3, 'pro', 120.0, '2024-02-01', null], [5, 4, 'max', 900.0, '2024-01-01', null], [6, 5, 'pro', 120.0, '2024-04-03', '2024-05-31'],
  [7, 6, 'basic', 50.0, '2024-05-15', null], [8, 4, 'pro', 120.0, '2024-03-01', '2024-04-30'],
];

// ---- E-commerce orders & returns -------------------------------------------------------
const SHOP = 'ecommerce-returns';
const shopSchema = {
  products: 'product_id INTEGER Primary key, category VARCHAR Category, price DOUBLE List price',
  order_items: 'order_id INTEGER Order, customer_id INTEGER Customer, product_id INTEGER Product, qty INTEGER Units, ordered_on DATE Day',
  returns: 'order_id INTEGER Order, product_id INTEGER Product, qty INTEGER Units returned, returned_on DATE Day',
};
const PRODUCTS = [[1, 'shoes', 80.0], [2, 'shoes', 120.0], [3, 'books', 15.0], [4, 'books', 25.0], [5, 'electronics', 300.0]];
const ITEMS = [
  [100, 1, 1, 1, '2024-03-01'], [100, 1, 3, 2, '2024-03-01'], [101, 2, 2, 1, '2024-03-02'], [102, 3, 5, 1, '2024-03-02'], [103, 1, 4, 3, '2024-03-05'],
  [104, 4, 1, 2, '2024-03-06'], [105, 5, 3, 1, '2024-03-07'], [106, 2, 5, 1, '2024-03-08'], [107, 6, 2, 1, '2024-03-09'], [108, 7, 4, 1, '2024-03-10'],
];
const RETURNS = [[101, 2, 1, '2024-03-10'], [104, 1, 1, '2024-03-12'], [102, 5, 1, '2024-03-15'], [103, 4, 1, '2024-03-20']];

// ---- Payments fraud ------------------------------------------------------------------------
const PAY = 'payments-fraud';
const paySchema = {
  accounts: 'account_id INTEGER Primary key, home_country VARCHAR ISO country',
  card_txns: 'txn_id INTEGER Primary key, account_id INTEGER Account, amount DOUBLE Amount (refunds negative), txn_ts TIMESTAMP When, country VARCHAR Where the card was used, merchant VARCHAR Merchant',
};
const ACCOUNTS = [[1, 'IN'], [2, 'IN'], [3, 'US'], [4, 'GB']];
const CARD = [
  [1, 1, 500.0, '2024-06-01 09:00:00', 'IN', 'grocer'], [2, 1, 20.0, '2024-06-01 09:02:00', 'IN', 'cafe'], [3, 1, 25.0, '2024-06-01 09:05:00', 'IN', 'cafe'],
  [4, 1, 30.0, '2024-06-01 09:09:00', 'IN', 'cafe'], [5, 1, -20.0, '2024-06-02 10:00:00', 'IN', 'cafe'], [6, 2, 1200.0, '2024-06-01 10:00:00', 'IN', 'airline'],
  [7, 2, 80.0, '2024-06-01 11:30:00', 'AE', 'duty-free'], [8, 3, 60.0, '2024-06-01 12:00:00', 'US', 'diner'], [9, 3, 700.0, '2024-06-01 15:00:00', 'US', 'electronics'],
  [10, 4, 15.0, '2024-06-01 08:00:00', 'GB', 'cafe'], [11, 4, 900.0, '2024-06-01 09:30:00', 'BR', 'jeweller'], [12, 4, 950.0, '2024-06-01 09:35:00', 'BR', 'jeweller'],
];

export default {
  caseStudies: [
    {
      id: SAAS, track: 'sql', title: 'SaaS Subscriptions & MRR', roles: ['Data Analyst', 'Analytics Engineer', 'Data Scientist'], companies: [],
      summary: 'Monthly recurring revenue for a B2B SaaS product: point-in-time MRR, a monthly MRR series, and the MRR bridge (new vs churned) — three questions, increasingly hard.',
      brief: md(
        '**CloudDesk** sells three plans (`basic`, `pro`, `max`) to customers in three segments. Finance wants SaaS metrics.',
        '',
        '**`customers`** — `customer_id`, `segment`.',
        '',
        '**`subscriptions`** — one row per subscription: `plan`, `mrr`, `started_on` and `ended_on` (last active day, NULL while active). An upgrade ends one subscription and starts another.',
        '',
        'A subscription is **active on day D** when `started_on <= D` and (`ended_on` IS NULL or `ended_on >= D`). Interviewers check that you apply this definition consistently, use month-end snapshots, and reconcile the MRR bridge.',
      ),
    },
    {
      id: SHOP, track: 'sql', title: 'E-commerce Orders & Returns', roles: ['Data Analyst', 'Data Scientist', 'Analytics Engineer'], companies: ['Amazon'],
      summary: 'Gross sales, return rates and customer concentration for an online store — three questions from simple aggregation to a Pareto analysis.',
      brief: md(
        '**ShopNow** sells shoes, books and electronics. You have:',
        '',
        '**`products`** — `product_id`, `category`, list `price`.',
        '',
        '**`order_items`** — one row per product in an order: `order_id`, `customer_id`, `product_id`, `qty`, `ordered_on`.',
        '',
        '**`returns`** — returned units per (`order_id`, `product_id`).',
        '',
        'Revenue = qty × list price. Watch the grain: returns must be matched on **both** order and product, and aggregated before joining to avoid fan-out.',
      ),
    },
    {
      id: PAY, track: 'sql', title: 'Card Payments & Fraud Signals', roles: ['Data Engineer', 'Data Scientist', 'Data Analyst'], companies: ['Stripe', 'VISA'],
      summary: 'Balances, velocity checks and impossible-travel detection on card transactions — three fraud-analytics questions of rising difficulty.',
      brief: md(
        'You work on the risk team of **PayFlow**, a card issuer.',
        '',
        '**`accounts`** — `account_id`, `home_country`.',
        '',
        '**`card_txns`** — `amount` (refunds are negative), `txn_ts`, the `country` where the card was used, and `merchant`.',
        '',
        'Fraud rules are about **time windows between a transaction and its neighbours** — expect LAG/LEAD, self-joins on time ranges, and careful handling of boundaries ("within 10 minutes" — inclusive?). Say your assumptions out loud.',
      ),
    },
  ],
  problems: [
    sql({
      id: 'saas-1-mrr-snapshot', title: 'SaaS 1 · MRR on a Given Day', difficulty: 'Easy', caseStudy: { id: SAAS, part: 1 },
      topics: ['Case Studies', 'Aggregation', 'Joins', 'NULL Handling'], patterns: ['Point-in-time "active on day D" filter'], domains: ['SaaS / Subscriptions'], interview: true, roles: ['Data Analyst', 'Analytics Engineer', 'Data Scientist'],
      summary: 'Active subscriptions and MRR by segment on 31 March 2024.',
      description: md('Return `segment`, `active_subscriptions` and `mrr` for subscriptions active on **2024-03-31**, ordered by `mrr` descending, then `segment`.'),
      hints: ['started_on <= D AND (ended_on IS NULL OR ended_on >= D).'],
      schema: saasSchema,
      solution: `SELECT c.segment, COUNT(*) AS active_subscriptions, SUM(s.mrr) AS mrr\nFROM subscriptions s JOIN customers c USING (customer_id)\nWHERE s.started_on <= DATE '2024-03-31' AND (s.ended_on IS NULL OR s.ended_on >= DATE '2024-03-31')\nGROUP BY c.segment\nORDER BY mrr DESC, c.segment;\n`,
      explanation: 'Point-in-time questions hinge on the active definition. ended_on IS NULL means still active; forgetting the NULL branch drops every live subscription.',
      tests: [
        { name: 'Example', tables: { customers: CUST, subscriptions: SUBS } },
        { name: 'Ends exactly on the day', hidden: true, tables: { customers: CUST, subscriptions: [[1, 1, 'basic', 10.0, '2024-01-01', '2024-03-31'], [2, 2, 'basic', 20.0, '2024-04-01', null]] } },
        { name: 'Everything still active', hidden: true, tables: { customers: CUST, subscriptions: [[1, 3, 'pro', 5.0, '2023-01-01', null], [2, 5, 'pro', 7.0, '2024-03-31', null]] } },
      ],
    }),
    sql({
      id: 'saas-2-mrr-series', title: 'SaaS 2 · Month-End MRR Series', difficulty: 'Medium', caseStudy: { id: SAAS, part: 2 },
      topics: ['Case Studies', 'Date & Time', 'Joins', 'Aggregation'], patterns: ['Calendar spine × active-range join', 'Month-end snapshots'], domains: ['SaaS / Subscriptions'], interview: true, roles: ['Data Analyst', 'Analytics Engineer', 'Data Scientist'],
      summary: 'MRR at every month end from January to June 2024, including months with zero.',
      description: md('For each month end from **2024-01-31 to 2024-06-30**, return `month` (`YYYY-MM`), `customers` (distinct customers with an active subscription that day) and `mrr`, ordered by `month`. Months with nothing active show 0.'),
      hints: ['Build the six month-end dates (generate_series by month, then last_day()).', 'LEFT JOIN subscriptions active on each date; COALESCE sums to 0.'],
      schema: saasSchema,
      solution: `WITH months AS (\n  SELECT last_day(m::DATE) AS d FROM generate_series(DATE '2024-01-01', DATE '2024-06-01', INTERVAL 1 MONTH) AS g(m)\n)\nSELECT strftime(m.d, '%Y-%m') AS month, COUNT(DISTINCT s.customer_id) AS customers, COALESCE(SUM(s.mrr), 0) AS mrr\nFROM months m\nLEFT JOIN subscriptions s ON s.started_on <= m.d AND (s.ended_on IS NULL OR s.ended_on >= m.d)\nGROUP BY m.d\nORDER BY month;\n`,
      explanation: 'A spine of snapshot dates joined to validity ranges turns intervals into a time series. Snapshotting at month end (not "any time in the month") is the standard MRR convention — say so.',
      tests: [
        { name: 'Example', tables: { customers: CUST, subscriptions: SUBS } },
        { name: 'Nothing active', hidden: true, tables: { customers: CUST, subscriptions: [[1, 1, 'basic', 10.0, '2024-07-01', null]] } },
        { name: 'Mid-month churn misses the snapshot', hidden: true, tables: { customers: CUST, subscriptions: [[1, 2, 'pro', 30.0, '2024-02-10', '2024-04-15']] } },
      ],
    }),
    sql({
      id: 'saas-3-mrr-bridge', title: 'SaaS 3 · The MRR Bridge', difficulty: 'Hard', caseStudy: { id: SAAS, part: 3 },
      topics: ['Case Studies', 'Window Functions', 'Joins', 'Aggregation'], patterns: ['Period-over-period per entity (customer-level MRR change)', 'Classify movements: new / expansion / contraction / churn'], domains: ['SaaS / Subscriptions'], interview: true, roles: ['Data Analyst', 'Analytics Engineer', 'Data Scientist'],
      summary: 'Decompose each month\'s MRR change into new, expansion, contraction and churn.',
      description: md('Using month-end MRR **per customer** (Feb–Jun 2024, compared with the previous month end), classify each customer\'s change:', '', '- `new`: previous MRR 0, current > 0;', '- `churn`: previous > 0, current 0 (amount is negative);', '- `expansion` / `contraction`: both > 0 and current is higher / lower.', '', 'Return `month`, `new_mrr`, `expansion_mrr`, `contraction_mrr`, `churned_mrr` (negative) and `net_change`, ordered by `month`. `net_change` must equal the change in total MRR.'),
      hints: ['Build customer × month-end MRR (0 when inactive) for Jan–Jun, then LAG per customer.', 'Sum the deltas into four buckets with FILTER.'],
      schema: saasSchema,
      solution: `WITH months AS (\n  SELECT last_day(m::DATE) AS d FROM generate_series(DATE '2024-01-01', DATE '2024-06-01', INTERVAL 1 MONTH) AS g(m)\n),\ncm AS (\n  SELECT c.customer_id, m.d, COALESCE(SUM(s.mrr), 0) AS mrr\n  FROM customers c CROSS JOIN months m\n  LEFT JOIN subscriptions s ON s.customer_id = c.customer_id AND s.started_on <= m.d AND (s.ended_on IS NULL OR s.ended_on >= m.d)\n  GROUP BY c.customer_id, m.d\n),\nd AS (SELECT customer_id, d, mrr, LAG(mrr) OVER (PARTITION BY customer_id ORDER BY d) AS prev FROM cm)\nSELECT strftime(d, '%Y-%m') AS month,\n  COALESCE(SUM(mrr) FILTER (WHERE prev = 0 AND mrr > 0), 0) AS new_mrr,\n  COALESCE(SUM(mrr - prev) FILTER (WHERE prev > 0 AND mrr > prev), 0) AS expansion_mrr,\n  COALESCE(SUM(mrr - prev) FILTER (WHERE prev > 0 AND mrr > 0 AND mrr < prev), 0) AS contraction_mrr,\n  COALESCE(SUM(mrr - prev) FILTER (WHERE prev > 0 AND mrr = 0), 0) AS churned_mrr,\n  SUM(mrr - prev) AS net_change\nFROM d WHERE prev IS NOT NULL\nGROUP BY d\nORDER BY month;\n`,
      explanation: 'The MRR bridge works at customer grain: compute each customer\'s MRR at both month ends (0 when inactive — the CROSS JOIN guarantees a row), take the delta, and classify it. The four buckets must sum to net change; that reconciliation is what interviewers check.',
      tests: [
        { name: 'Example', tables: { customers: CUST, subscriptions: SUBS } },
        { name: 'Upgrade is expansion, not new + churn', hidden: true, tables: { customers: [[1, 'smb']], subscriptions: [[1, 1, 'basic', 50.0, '2024-01-01', '2024-02-15'], [2, 1, 'pro', 120.0, '2024-02-16', null]] } },
        { name: 'Reactivation counts as new', hidden: true, tables: { customers: [[2, 'mid']], subscriptions: [[1, 2, 'pro', 100.0, '2024-01-01', '2024-02-10'], [2, 2, 'pro', 100.0, '2024-04-01', null]] } },
      ],
    }),
    sql({
      id: 'shop-1-gross-sales', title: 'ShopNow 1 · Gross Sales by Category', difficulty: 'Easy', caseStudy: { id: SHOP, part: 1 },
      topics: ['Case Studies', 'Joins', 'Aggregation'], patterns: ['Join facts to a dimension, then aggregate'], domains: ['E-commerce / Sales'], interview: true, roles: ['Data Analyst', 'Data Scientist', 'Analytics Engineer'],
      summary: 'Units, orders and gross revenue per category.',
      description: md('Return `category`, `orders` (distinct orders containing the category), `units` and `gross_revenue` (qty × price), ordered by `gross_revenue` descending.'),
      hints: ['An order can contain two products of the same category — count orders with COUNT(DISTINCT order_id).'],
      schema: shopSchema,
      solution: `SELECT p.category, COUNT(DISTINCT i.order_id) AS orders, SUM(i.qty) AS units, SUM(i.qty * p.price) AS gross_revenue\nFROM order_items i JOIN products p USING (product_id)\nGROUP BY p.category\nORDER BY gross_revenue DESC;\n`,
      explanation: 'Join the item facts to the product dimension for category and price, then aggregate. COUNT(DISTINCT order_id) counts orders, not lines.',
      tests: [
        { name: 'Example', tables: { products: PRODUCTS, order_items: ITEMS, returns: RETURNS } },
        { name: 'Two lines of one category in one order', hidden: true, tables: { products: PRODUCTS, order_items: [[1, 1, 3, 1, '2024-01-01'], [1, 1, 4, 1, '2024-01-01']], returns: [] } },
        { name: 'Single item', hidden: true, tables: { products: PRODUCTS, order_items: [[9, 9, 5, 2, '2024-01-01']], returns: [] } },
      ],
    }),
    sql({
      id: 'shop-2-return-rates', title: 'ShopNow 2 · Return Rate by Category', difficulty: 'Medium', caseStudy: { id: SHOP, part: 2 },
      topics: ['Case Studies', 'Joins', 'Aggregation', 'NULL Handling'], patterns: ['Aggregate before joining (avoid fan-out)', 'Rates by units and by value'], domains: ['E-commerce / Sales'], interview: true, roles: ['Data Analyst', 'Data Scientist', 'Analytics Engineer'],
      summary: 'Units returned ÷ units sold, and refunded value ÷ gross value, per category.',
      description: md('For each category return `units_sold`, `units_returned`, `unit_return_pct` and `value_return_pct` (returned value ÷ gross value; value = qty × price), percentages rounded to 1. Order by `unit_return_pct` descending, then `category`.'),
      hints: ['Join returns on order_id AND product_id.', 'Sum returns per (order, product) first if there could be several return rows.'],
      schema: shopSchema,
      solution: `WITH r AS (SELECT order_id, product_id, SUM(qty) AS rqty FROM returns GROUP BY 1, 2)\nSELECT p.category, SUM(i.qty) AS units_sold, COALESCE(SUM(r.rqty), 0) AS units_returned,\n  ROUND(100.0 * COALESCE(SUM(r.rqty), 0) / SUM(i.qty), 1) AS unit_return_pct,\n  ROUND(100.0 * COALESCE(SUM(r.rqty * p.price), 0) / SUM(i.qty * p.price), 1) AS value_return_pct\nFROM order_items i\nJOIN products p USING (product_id)\nLEFT JOIN r ON r.order_id = i.order_id AND r.product_id = i.product_id\nGROUP BY p.category\nORDER BY unit_return_pct DESC, p.category;\n`,
      explanation: 'Returns join at (order, product) grain. Aggregating returns to that grain first prevents duplicate return rows from multiplying sales. Unit and value return rates can differ a lot — expensive returns hurt more.',
      tests: [
        { name: 'Example', tables: { products: PRODUCTS, order_items: ITEMS, returns: RETURNS } },
        { name: 'Split returns don\'t double sales', hidden: true, tables: { products: PRODUCTS, order_items: [[1, 1, 1, 4, '2024-01-01']], returns: [[1, 1, 1, '2024-01-05'], [1, 1, 1, '2024-01-06']] } },
        { name: 'No returns', hidden: true, tables: { products: PRODUCTS, order_items: [[1, 1, 3, 2, '2024-01-01'], [2, 2, 5, 1, '2024-01-01']], returns: [] } },
      ],
    }),
    sql({
      id: 'shop-3-pareto-customers', title: 'ShopNow 3 · Pareto: Revenue from Top Customers', difficulty: 'Hard', caseStudy: { id: SHOP, part: 3 },
      topics: ['Case Studies', 'Window Functions', 'Running Totals', 'Joins'], patterns: ['Net revenue per customer', 'Cumulative share (Pareto curve)'], domains: ['E-commerce / Sales'], interview: true, roles: ['Data Analyst', 'Data Scientist', 'Analytics Engineer'],
      summary: 'Rank customers by net revenue and find how few account for 80% of it.',
      description: md('Net revenue per customer = gross − returned value. Rank customers by net revenue (descending, ties by `customer_id`) and return `customer_id`, `net_revenue`, `cumulative_pct` (running share of total net revenue, rounded to 1) and `in_top_80` — TRUE for customers needed to reach 80% (a customer is included if the share **before** them is still below 80%). Order by rank.'),
      hints: ['Running SUM over the ranked customers ÷ total.', 'in_top_80: the previous cumulative share (running sum minus own revenue) < 80.'],
      schema: shopSchema,
      solution: `WITH r AS (SELECT order_id, product_id, SUM(qty) AS rqty FROM returns GROUP BY 1, 2),\nnet AS (\n  SELECT i.customer_id, SUM((i.qty - COALESCE(r.rqty, 0)) * p.price) AS net_revenue\n  FROM order_items i JOIN products p USING (product_id)\n  LEFT JOIN r ON r.order_id = i.order_id AND r.product_id = i.product_id\n  GROUP BY i.customer_id\n),\nc AS (\n  SELECT customer_id, net_revenue,\n    SUM(net_revenue) OVER (ORDER BY net_revenue DESC, customer_id ROWS UNBOUNDED PRECEDING) AS running,\n    SUM(net_revenue) OVER () AS total\n  FROM net\n)\nSELECT customer_id, net_revenue, ROUND(100.0 * running / total, 1) AS cumulative_pct,\n  100.0 * (running - net_revenue) / total < 80 AS in_top_80\nFROM c\nORDER BY net_revenue DESC, customer_id;\n`,
      explanation: 'A Pareto analysis is a running share over a ranked list. "Needed to reach 80%" is judged on the share *before* each customer, so the customer who crosses the line is included. Netting returns first matters: a big spender who returns everything shouldn\'t top the list.',
      tests: [
        { name: 'Example', tables: { products: PRODUCTS, order_items: ITEMS, returns: RETURNS } },
        { name: 'One customer', hidden: true, tables: { products: PRODUCTS, order_items: [[1, 7, 3, 1, '2024-01-01']], returns: [] } },
        { name: 'Equal customers', hidden: true, tables: { products: PRODUCTS, order_items: [[1, 2, 3, 1, '2024-01-01'], [2, 1, 3, 1, '2024-01-01'], [3, 3, 3, 1, '2024-01-01'], [4, 4, 3, 1, '2024-01-01'], [5, 5, 3, 1, '2024-01-01']], returns: [] } },
      ],
    }),
    sql({
      id: 'pay-1-balances', title: 'PayFlow 1 · Account Balances', difficulty: 'Easy', caseStudy: { id: PAY, part: 1 },
      topics: ['Case Studies', 'Aggregation', 'Conditional Logic', 'Joins'], patterns: ['Signed sums', 'Include zero-activity entities (LEFT JOIN)'], domains: ['Payments / Fintech'], interview: true, roles: ['Data Engineer', 'Data Scientist', 'Data Analyst'],
      summary: 'Spend, refunds and net per account — including accounts with no activity.',
      description: md('For every account return `account_id`, `txns`, `spend` (sum of positive amounts), `refunds` (sum of negative amounts, as a positive number) and `net` (= spend − refunds). Accounts without transactions show zeros. Order by `net` descending, then `account_id`.'),
      hints: ['SUM(amount) FILTER (WHERE amount > 0) and -SUM(amount) FILTER (WHERE amount < 0).', 'Start from accounts and LEFT JOIN.'],
      schema: paySchema,
      solution: `SELECT a.account_id, COUNT(t.txn_id) AS txns,\n  COALESCE(SUM(t.amount) FILTER (WHERE t.amount > 0), 0) AS spend,\n  COALESCE(-SUM(t.amount) FILTER (WHERE t.amount < 0), 0) AS refunds,\n  COALESCE(SUM(t.amount), 0) AS net\nFROM accounts a LEFT JOIN card_txns t USING (account_id)\nGROUP BY a.account_id\nORDER BY net DESC, a.account_id;\n`,
      explanation: 'Split a signed column with filtered sums; COALESCE turns NULL aggregates (no rows) into zeros, and starting FROM accounts keeps inactive accounts in the report.',
      tests: [
        { name: 'Example', tables: { accounts: ACCOUNTS, card_txns: CARD } },
        { name: 'Inactive accounts', hidden: true, tables: { accounts: [[1, 'IN'], [2, 'US']], card_txns: [] } },
        { name: 'Refund larger than spend', hidden: true, tables: { accounts: [[5, 'IN']], card_txns: [[1, 5, 10.0, '2024-01-01 00:00:00', 'IN', 'm'], [2, 5, -15.0, '2024-01-02 00:00:00', 'IN', 'm']] } },
      ],
    }),
    sql({
      id: 'pay-2-velocity', title: 'PayFlow 2 · Velocity Rule', difficulty: 'Medium', caseStudy: { id: PAY, part: 2 },
      topics: ['Case Studies', 'Window Functions', 'Date & Time'], patterns: ['N events within a sliding time window (LAG by N−1)'], domains: ['Payments / Fintech'], interview: true, roles: ['Data Engineer', 'Data Scientist', 'Data Analyst'], companies: ['Stripe'], sources: [{ company: 'Stripe', label: 'DataLemur — Stripe "Repeated Payments"', url: 'https://datalemur.com/questions' }],
      summary: 'Flag accounts with 3 or more purchases inside any 10-minute window.',
      description: md('Consider purchases only (amount > 0). An account trips the **velocity rule** when **3 purchases** fall within **10 minutes** (inclusive) of each other. Return `account_id`, `first_alert_at` (the time of the 3rd purchase the first time it happens), ordered by `account_id`.'),
      hints: ['For each purchase, LAG(txn_ts, 2) is the purchase two before it.', 'If txn_ts − that ≤ 10 minutes, three purchases fit in the window.'],
      schema: paySchema,
      solution: `WITH p AS (\n  SELECT account_id, txn_ts, LAG(txn_ts, 2) OVER (PARTITION BY account_id ORDER BY txn_ts, txn_id) AS two_before\n  FROM card_txns WHERE amount > 0\n)\nSELECT account_id, MIN(txn_ts) AS first_alert_at\nFROM p WHERE two_before IS NOT NULL AND txn_ts - two_before <= INTERVAL 10 MINUTE\nGROUP BY account_id\nORDER BY account_id;\n`,
      explanation: '"N events within T" reduces to comparing each event with the event N−1 before it: if that gap is ≤ T, the N events fit. It is O(n log n) instead of a quadratic self-join.',
      tests: [
        { name: 'Example', tables: { accounts: ACCOUNTS, card_txns: CARD } },
        { name: 'Refunds don\'t count', hidden: true, tables: { accounts: ACCOUNTS, card_txns: [[1, 1, 5.0, '2024-01-01 10:00:00', 'IN', 'a'], [2, 1, -5.0, '2024-01-01 10:01:00', 'IN', 'a'], [3, 1, 5.0, '2024-01-01 10:02:00', 'IN', 'a']] } },
        { name: 'Exactly 10 minutes', hidden: true, tables: { accounts: ACCOUNTS, card_txns: [[1, 2, 5.0, '2024-01-01 10:00:00', 'IN', 'a'], [2, 2, 5.0, '2024-01-01 10:05:00', 'IN', 'a'], [3, 2, 5.0, '2024-01-01 10:10:00', 'IN', 'a'], [4, 3, 5.0, '2024-01-01 10:00:00', 'US', 'a'], [5, 3, 5.0, '2024-01-01 10:05:00', 'US', 'a'], [6, 3, 5.0, '2024-01-01 10:10:01', 'US', 'a']] } },
      ],
    }),
    sql({
      id: 'pay-3-impossible-travel', title: 'PayFlow 3 · Impossible Travel', difficulty: 'Hard', caseStudy: { id: PAY, part: 3 },
      topics: ['Case Studies', 'Window Functions', 'Date & Time', 'Joins', 'Conditional Logic'], patterns: ['Consecutive-event comparison (LAG)', 'Combine several risk signals into a score'], domains: ['Payments / Fintech'], interview: true, roles: ['Data Engineer', 'Data Scientist', 'Data Analyst'], companies: ['VISA'], sources: [{ company: 'VISA', label: 'SparkPlayground — VISA risk / trip-data questions', url: 'https://www.sparkplayground.com/pyspark-coding-interview-questions' }],
      summary: 'Flag purchases in a different country less than 2 hours after the previous one, and score the risk.',
      description: md('For each purchase (amount > 0), compare it with the account\'s **previous purchase**. Flag it when the countries differ and the gap is **under 2 hours**. Score each flagged purchase:', '', '- 1 point for the impossible-travel signal;', '- +1 if the purchase country is not the account\'s `home_country`;', '- +1 if `amount` > 3 × the account\'s average purchase amount (over all its purchases).', '', 'Return `txn_id`, `account_id`, `from_country`, `to_country`, `minutes_apart`, `risk_score`, ordered by `risk_score` descending, then `txn_id`.'),
      hints: ['LAG(country) and LAG(txn_ts) over the account\'s purchases.', 'AVG(amount) OVER (PARTITION BY account_id) for the spend signal; join accounts for home_country.'],
      schema: paySchema,
      solution: `WITH p AS (\n  SELECT t.*, a.home_country,\n    LAG(country) OVER w AS prev_country, LAG(txn_ts) OVER w AS prev_ts,\n    AVG(amount) OVER (PARTITION BY t.account_id) AS avg_amount\n  FROM card_txns t JOIN accounts a USING (account_id)\n  WHERE t.amount > 0\n  WINDOW w AS (PARTITION BY t.account_id ORDER BY txn_ts, txn_id)\n)\nSELECT txn_id, account_id, prev_country AS from_country, country AS to_country,\n  date_diff('minute', prev_ts, txn_ts) AS minutes_apart,\n  1 + (country <> home_country)::INT + (amount > 3 * avg_amount)::INT AS risk_score\nFROM p\nWHERE prev_country IS NOT NULL AND country <> prev_country AND txn_ts - prev_ts < INTERVAL 2 HOUR\nORDER BY risk_score DESC, txn_id;\n`,
      explanation: 'Compare each purchase with its predecessor (LAG) to find physically implausible country changes, then add independent signals as 0/1 terms. In the interview, discuss false positives (online merchants, VPNs) and why the average should exclude the transaction being scored in production.',
      tests: [
        { name: 'Example', tables: { accounts: ACCOUNTS, card_txns: CARD } },
        { name: 'Two hours is plausible', hidden: true, tables: { accounts: ACCOUNTS, card_txns: [[1, 1, 10.0, '2024-01-01 10:00:00', 'IN', 'a'], [2, 1, 10.0, '2024-01-01 12:00:00', 'AE', 'b'], [3, 1, 10.0, '2024-01-01 13:59:00', 'IN', 'c']] } },
        { name: 'Back home quickly', hidden: true, tables: { accounts: ACCOUNTS, card_txns: [[1, 3, 10.0, '2024-01-01 10:00:00', 'MX', 'a'], [2, 3, 10.0, '2024-01-01 10:30:00', 'US', 'b']] } },
      ],
    }),
  ],
};
