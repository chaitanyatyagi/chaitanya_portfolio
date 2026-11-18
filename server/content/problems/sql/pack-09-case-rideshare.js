// Case study — RideShare marketplace (4 parts, increasing difficulty).
import { sql, md } from './define.js';

const CS = 'rideshare-marketplace';
const ROLES = ['Data Analyst', 'Data Scientist', 'Data Engineer', 'Analytics Engineer'];
const SOURCES = [{ company: 'Uber', label: 'DataLemur — Uber questions (ride / transaction analytics)', url: 'https://datalemur.com/questions' }];
const schema = {
  drivers: 'driver_id INTEGER Primary key, name VARCHAR Driver, city VARCHAR Home city, joined_on DATE Joined',
  trips: 'trip_id INTEGER Primary key, rider_id INTEGER Rider, driver_id INTEGER Driver (NULL if never accepted), city VARCHAR City, requested_at TIMESTAMP Requested, status VARCHAR completed / rider_cancelled / driver_cancelled, fare DOUBLE Fare (0 unless completed), distance_km DOUBLE Distance',
};
const DRIVERS = [[1, 'Arjun', 'Pune', '2023-05-01'], [2, 'Bela', 'Pune', '2023-08-10'], [3, 'Chirag', 'Delhi', '2023-02-02'], [4, 'Dia', 'Delhi', '2024-01-05'], [5, 'Eshan', 'Delhi', '2024-01-20']];
const TRIPS = [
  [1, 101, 1, 'Pune', '2024-01-01 08:10:00', 'completed', 220.0, 8.2], [2, 102, 2, 'Pune', '2024-01-01 09:00:00', 'completed', 150.0, 5.1],
  [3, 101, 1, 'Pune', '2024-01-03 18:30:00', 'rider_cancelled', 0.0, 0.0], [4, 103, 3, 'Delhi', '2024-01-02 10:00:00', 'completed', 310.0, 12.0],
  [5, 104, null, 'Delhi', '2024-01-02 11:00:00', 'driver_cancelled', 0.0, 0.0], [6, 103, 4, 'Delhi', '2024-01-09 09:15:00', 'completed', 180.0, 6.0],
  [7, 105, 3, 'Delhi', '2024-01-10 19:00:00', 'completed', 260.0, 9.5], [8, 101, 2, 'Pune', '2024-01-12 08:00:00', 'completed', 205.0, 7.7],
  [9, 106, 1, 'Pune', '2024-01-15 22:00:00', 'driver_cancelled', 0.0, 0.0], [10, 102, 1, 'Pune', '2024-01-16 07:45:00', 'completed', 130.0, 4.4],
  [11, 104, 5, 'Delhi', '2024-01-22 13:00:00', 'completed', 400.0, 15.0], [12, 107, 4, 'Delhi', '2024-01-23 17:20:00', 'rider_cancelled', 0.0, 0.0],
  [13, 103, 3, 'Delhi', '2024-02-05 09:00:00', 'completed', 300.0, 11.0], [14, 108, 2, 'Pune', '2024-02-10 12:00:00', 'completed', 175.0, 6.3],
  [15, 101, 1, 'Pune', '2024-02-20 08:20:00', 'completed', 210.0, 8.0], [16, 105, 5, 'Delhi', '2024-02-25 21:00:00', 'completed', 280.0, 10.1],
];

export default {
  caseStudies: [{
    id: CS, track: 'sql', title: 'RideShare Marketplace', roles: ROLES, companies: ['Uber'],
    summary: 'A two-sided ride-hailing marketplace in two cities: revenue, cancellations, driver performance and rider retention — four questions, each harder than the last.',
    brief: md(
      'You\'ve joined the analytics team of **RideShare**, a ride-hailing app live in **Pune** and **Delhi**. The interviewer gives you two tables and asks a sequence of questions, each building on the previous one — the format of a typical data OA or onsite SQL round.',
      '',
      '**`drivers`** — one row per driver (`driver_id`, `name`, home `city`, `joined_on`).',
      '',
      '**`trips`** — one row per ride *request*: `rider_id`, `driver_id` (NULL if no driver ever accepted), `city`, `requested_at`, `status` (`completed`, `rider_cancelled`, `driver_cancelled`), `fare` (0 unless completed) and `distance_km`.',
      '',
      'Things interviewers listen for in this case: separating requests from completed trips, being explicit about who cancelled, weekly windows that start on Monday, ties in rankings, and defining retention precisely before writing SQL.',
    ),
  }],
  problems: [
    sql({
      id: 'rideshare-1-city-revenue', title: 'RideShare 1 · Revenue by City', difficulty: 'Easy', caseStudy: { id: CS, part: 1 },
      topics: ['Case Studies', 'Aggregation', 'Conditional Logic'], patterns: ['Requests vs completed: conditional aggregation'], domains: ['Ride-hailing'], interview: true, roles: ROLES, companies: ['Uber'], sources: SOURCES,
      summary: 'Requests, completed trips, revenue and average fare per city.',
      description: md('For each `city` return `requests` (all rows), `completed_trips`, `revenue` (sum of fares of completed trips) and `avg_fare` (over completed trips, rounded to 2). Order by `revenue` descending.'),
      hints: ['COUNT(*) counts requests; COUNT(*) FILTER (WHERE status = \'completed\') counts trips.', 'AVG(fare) FILTER (WHERE status = \'completed\') — cancelled rows have fare 0 and would drag the average down.'],
      schema,
      solution: `SELECT city, COUNT(*) AS requests,\n  COUNT(*) FILTER (WHERE status = 'completed') AS completed_trips,\n  COALESCE(SUM(fare) FILTER (WHERE status = 'completed'), 0) AS revenue,\n  ROUND(AVG(fare) FILTER (WHERE status = 'completed'), 2) AS avg_fare\nFROM trips\nGROUP BY city\nORDER BY revenue DESC;\n`,
      explanation: 'The trap is averaging fare over all requests: cancelled requests carry fare 0 and pull the average down. Filtered aggregates compute both denominators in one pass.',
      tests: [
        { name: 'Example', tables: { drivers: DRIVERS, trips: TRIPS } },
        { name: 'Only cancellations in a city', hidden: true, tables: { drivers: DRIVERS, trips: [[1, 1, 1, 'Pune', '2024-01-01 08:00:00', 'completed', 100.0, 3.0], [2, 2, null, 'Goa', '2024-01-01 09:00:00', 'rider_cancelled', 0.0, 0.0]] } },
        { name: 'Single city', hidden: true, tables: { drivers: DRIVERS, trips: TRIPS.filter((t) => t[3] === 'Delhi') } },
      ],
    }),
    sql({
      id: 'rideshare-2-cancellations', title: 'RideShare 2 · Who Cancels?', difficulty: 'Medium', caseStudy: { id: CS, part: 2 },
      topics: ['Case Studies', 'Aggregation', 'Conditional Logic', 'Date & Time'], patterns: ['Rates with explicit denominators', 'Breakdown by actor'], domains: ['Ride-hailing'], interview: true, roles: ROLES, companies: ['Uber'], sources: SOURCES,
      summary: 'Cancellation rate per city and month, split into rider- and driver-cancelled.',
      description: md('For each `city` and `month` (`YYYY-MM` of `requested_at`) return `requests`, `cancel_rate_pct` (all cancellations ÷ requests), `rider_cancel_pct` and `driver_cancel_pct` (each ÷ requests), all ×100 rounded to 1. Order by `city`, `month`.'),
      hints: ['The two cancellation shares should add up to the total — a quick sanity check.'],
      schema,
      solution: `SELECT city, strftime(requested_at, '%Y-%m') AS month, COUNT(*) AS requests,\n  ROUND(100.0 * COUNT(*) FILTER (WHERE status <> 'completed') / COUNT(*), 1) AS cancel_rate_pct,\n  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'rider_cancelled') / COUNT(*), 1) AS rider_cancel_pct,\n  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'driver_cancelled') / COUNT(*), 1) AS driver_cancel_pct\nFROM trips\nGROUP BY city, month\nORDER BY city, month;\n`,
      explanation: 'State the denominator (requests) and keep it the same for every share so they add up. In the interview, mention that a driver-side NULL driver_id (never accepted) is still a driver-side failure.',
      tests: [
        { name: 'Example', tables: { drivers: DRIVERS, trips: TRIPS } },
        { name: 'No cancellations', hidden: true, tables: { drivers: DRIVERS, trips: TRIPS.filter((t) => t[5] === 'completed') } },
        { name: 'All cancelled', hidden: true, tables: { drivers: DRIVERS, trips: [[1, 1, null, 'Pune', '2024-03-01 08:00:00', 'driver_cancelled', 0.0, 0.0], [2, 1, 1, 'Pune', '2024-03-02 08:00:00', 'rider_cancelled', 0.0, 0.0]] } },
      ],
    }),
    sql({
      id: 'rideshare-3-top-driver-weekly', title: 'RideShare 3 · Top Driver per City per Week', difficulty: 'Hard', caseStudy: { id: CS, part: 3 },
      topics: ['Case Studies', 'Ranking', 'Window Functions', 'Date & Time', 'Joins'], patterns: ['Top-1 per group with ties', 'Weekly buckets (Monday start)'], domains: ['Ride-hailing'], interview: true, roles: ROLES, companies: ['Uber'], sources: SOURCES,
      summary: 'For every city and week, the driver(s) with the highest completed-trip earnings.',
      description: md('Using **completed** trips, compute each driver\'s earnings per `city` and `week_start` (Monday). Return the top earner(s) per city and week — ties all included — as `city`, `week_start`, `driver`, `earnings`, `trips`. Order by `city`, `week_start`, `driver`.'),
      hints: ['date_trunc(\'week\', requested_at) gives Monday.', 'RANK() = 1 keeps ties; join drivers for names.'],
      schema,
      solution: `WITH w AS (\n  SELECT t.city, CAST(date_trunc('week', t.requested_at) AS DATE) AS week_start, d.name AS driver,\n         SUM(t.fare) AS earnings, COUNT(*) AS trips\n  FROM trips t JOIN drivers d USING (driver_id)\n  WHERE t.status = 'completed'\n  GROUP BY 1, 2, 3\n)\nSELECT city, week_start, driver, earnings, trips\nFROM w\nQUALIFY RANK() OVER (PARTITION BY city, week_start ORDER BY earnings DESC) = 1\nORDER BY city, week_start, driver;\n`,
      explanation: 'Aggregate to (city, week, driver), then rank within (city, week). RANK keeps ties, which an interviewer will ask about; ROW_NUMBER would silently drop a co-winner.',
      tests: [
        { name: 'Example', tables: { drivers: DRIVERS, trips: TRIPS } },
        { name: 'Tie for top earner', hidden: true, tables: { drivers: DRIVERS, trips: [[1, 1, 1, 'Pune', '2024-04-01 08:00:00', 'completed', 100.0, 3.0], [2, 2, 2, 'Pune', '2024-04-03 08:00:00', 'completed', 100.0, 3.0], [3, 3, 2, 'Pune', '2024-04-08 08:00:00', 'rider_cancelled', 0.0, 0.0]] } },
        { name: 'Sunday belongs to the previous week', hidden: true, tables: { drivers: DRIVERS, trips: [[1, 1, 3, 'Delhi', '2024-04-07 23:00:00', 'completed', 50.0, 2.0], [2, 2, 4, 'Delhi', '2024-04-08 00:30:00', 'completed', 60.0, 2.0]] } },
      ],
    }),
    sql({
      id: 'rideshare-4-rider-retention', title: 'RideShare 4 · 30-Day Rider Retention by Cohort', difficulty: 'Hard', caseStudy: { id: CS, part: 4 },
      topics: ['Case Studies', 'Funnels & Retention', 'Window Functions', 'Date & Time'], patterns: ['First event per user', 'Retention within N days of the first event', 'Cohort by first month'], domains: ['Ride-hailing'], interview: true, roles: ROLES, companies: ['Uber'], sources: SOURCES,
      summary: 'Of riders whose first completed trip was in a month, how many took another within 30 days?',
      description: md('A rider\'s **cohort** is the month (`YYYY-MM`) of their **first completed** trip. They are **retained** if they complete **another** trip within 30 days after it (> first trip time, ≤ first trip + 30 days).', '', 'Return `cohort`, `riders`, `retained`, `retention_pct` (rounded to 1), ordered by `cohort`.'),
      hints: ['Number each rider\'s completed trips with ROW_NUMBER; trip 1 is the first.', 'Retained ⇔ trip 2 exists and is within 30 days of trip 1 (trip 2 is the earliest repeat).'],
      schema,
      solution: `WITH c AS (\n  SELECT rider_id, requested_at, ROW_NUMBER() OVER (PARTITION BY rider_id ORDER BY requested_at, trip_id) AS n\n  FROM trips WHERE status = 'completed'\n),\nfirst_second AS (\n  SELECT rider_id,\n    MAX(requested_at) FILTER (WHERE n = 1) AS first_at,\n    MAX(requested_at) FILTER (WHERE n = 2) AS second_at\n  FROM c GROUP BY rider_id\n)\nSELECT strftime(first_at, '%Y-%m') AS cohort, COUNT(*) AS riders,\n  COUNT(*) FILTER (WHERE second_at <= first_at + INTERVAL 30 DAY) AS retained,\n  ROUND(100.0 * COUNT(*) FILTER (WHERE second_at <= first_at + INTERVAL 30 DAY) / COUNT(*), 1) AS retention_pct\nFROM first_second\nGROUP BY cohort\nORDER BY cohort;\n`,
      explanation: 'Define the metric before the SQL: cohort = first completed trip, success = the next completed trip within 30 days. Because trips are numbered, "another trip within 30 days" reduces to checking trip 2. Cancelled requests never count — a common slip in this question.',
      tests: [
        { name: 'Example', tables: { drivers: DRIVERS, trips: TRIPS } },
        { name: 'Exactly 30 days counts', hidden: true, tables: { drivers: DRIVERS, trips: [[1, 1, 1, 'Pune', '2024-05-01 10:00:00', 'completed', 10.0, 1.0], [2, 1, 1, 'Pune', '2024-05-31 10:00:00', 'completed', 10.0, 1.0], [3, 2, 1, 'Pune', '2024-05-02 10:00:00', 'completed', 10.0, 1.0], [4, 2, 1, 'Pune', '2024-06-01 10:00:01', 'completed', 10.0, 1.0]] } },
        { name: 'Cancelled first request doesn\'t start a cohort', hidden: true, tables: { drivers: DRIVERS, trips: [[1, 9, null, 'Delhi', '2024-06-28 10:00:00', 'driver_cancelled', 0.0, 0.0], [2, 9, 3, 'Delhi', '2024-07-02 10:00:00', 'completed', 10.0, 1.0], [3, 9, 3, 'Delhi', '2024-07-03 10:00:00', 'completed', 10.0, 1.0]] } },
      ],
    }),
  ],
};
