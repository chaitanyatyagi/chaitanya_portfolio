import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Problem registry — seed source for `problems` + `problem_tests`.
// One file per problem (see any file here for the full shape). After adding
// or editing one: `npm run verify:problems` (reference solution must pass every
// test, starter must not) then `npm run seed`.
import dailyActiveUsers from './sql-daily-active-users.js';
import pagesNobodyLiked from './sql-pages-nobody-liked.js';
import topCustomersByRegion from './sql-top-customers-by-region.js';
import thirdRidePerRider from './sql-third-ride-per-rider.js';
import rollingThreeDayAverage from './sql-rolling-three-day-average.js';
import longestLoginStreak from './sql-longest-login-streak.js';
import monthOverMonthRetention from './sql-month-over-month-retention.js';
import clickThroughRate from './sql-click-through-rate.js';
import postsHistogram from './sql-posts-histogram.js';
import secondHighestSalary from './sql-second-highest-salary.js';
import oddEvenMeasurements from './sql-odd-even-measurements.js';
import yoyGrowth from './sql-yoy-growth.js';
import shoppingSprees from './sql-shopping-sprees.js';
import medianSearchFrequency from './sql-median-search-frequency.js';
import repeatedPayments from './sql-repeated-payments.js';
import serverRunningHours from './sql-server-running-hours.js';
import dedupeRetriedEvents from './python-dedupe-retried-events.js';
import topEventTypes from './python-top-event-types.js';
import mergeBusyIntervals from './python-merge-busy-intervals.js';
import sessionizeClickstream from './python-sessionize-clickstream.js';
import quarantineBadRecords from './python-quarantine-bad-records.js';
import currentCustomerSnapshot from './pyspark-current-customer-snapshot.js';
import dayOverDayChange from './pyspark-day-over-day-change.js';
import unsoldProducts from './pyspark-unsold-products.js';
import runningBalance from './pyspark-running-balance.js';
import purchaseGaps from './pyspark-purchase-gaps.js';
import bestEquippedCity from './pandas-best-equipped-city.js';
import revenueByCountry from './pandas-revenue-by-country.js';
import timeToFirstScroll from './pandas-time-to-first-scroll.js';
import movingRevenue from './pandas-moving-revenue.js';
import longestWinningStreak from './pandas-longest-winning-streak.js';
import topErrorClients from './shell-top-error-clients.js';
import uniqueVisitorsPerDay from './shell-unique-visitors-per-day.js';
import categoryTotals from './shell-category-totals.js';
import slowestEndpoints from './shell-slowest-endpoints.js';
import latestRecordPerKey from './shell-latest-record-per-key.js';

// Order within a track = order on the track page (roughly Easy → Hard).
const SINGLE_FILE = [
  dailyActiveUsers,
  pagesNobodyLiked,
  clickThroughRate,
  postsHistogram,
  topCustomersByRegion,
  thirdRidePerRider,
  rollingThreeDayAverage,
  secondHighestSalary,
  oddEvenMeasurements,
  yoyGrowth,
  shoppingSprees,
  longestLoginStreak,
  monthOverMonthRetention,
  medianSearchFrequency,
  repeatedPayments,
  serverRunningHours,
  dedupeRetriedEvents,
  topEventTypes,
  mergeBusyIntervals,
  sessionizeClickstream,
  quarantineBadRecords,
  currentCustomerSnapshot,
  dayOverDayChange,
  unsoldProducts,
  runningBalance,
  purchaseGaps,
  bestEquippedCity,
  revenueByCountry,
  timeToFirstScroll,
  movingRevenue,
  longestWinningStreak,
  topErrorClients,
  uniqueVisitorsPerDay,
  categoryTotals,
  slowestEndpoints,
  latestRecordPerKey,
];

// ---- SQL packs (content/problems/sql/pack-*.js, loaded automatically) -------------
// Each pack exports { problems: [sql({...}), …], caseStudies?: [...] }. Expected
// outputs are attached from sql/golden.json (see sql/define.js).
const here = path.dirname(fileURLToPath(import.meta.url));
const packDir = path.join(here, 'sql');
const golden = JSON.parse(readFileSync(path.join(packDir, 'golden.json'), 'utf8'));
const packs = [];
for (const f of readdirSync(packDir).filter((n) => /^pack-.+\.js$/.test(n)).sort()) {
  packs.push({ file: f, ...(await import(`./sql/${f}`)).default });
}

function withGolden(p) {
  const g = golden[p.id];
  return {
    ...p,
    outputColumns: p.outputColumns || g?.columns,
    tests: p.tests.map((t) => (t.expected === undefined && g?.tests?.[t.name] !== undefined ? { ...t, expected: g.tests[t.name] } : t)),
  };
}

export const RAW_PACK_PROBLEMS = packs.flatMap((pk) => pk.problems);
export const CASE_STUDIES = packs.flatMap((pk) => pk.caseStudies || []);
export const PROBLEMS = [...SINGLE_FILE, ...RAW_PACK_PROBLEMS.map(withGolden)];
