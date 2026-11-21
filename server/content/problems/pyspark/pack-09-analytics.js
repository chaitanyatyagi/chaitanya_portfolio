// PySpark pack 9 — analytics questions reported by companies: ordered
// funnels, month-over-month retention, launch-month shares, odd/even
// positions, election seat tallies, budget audits, strictly increasing yearly
// sales, unpivot + growth, top users by distinct events, attendance reports,
// payroll, segmentation, a budget knapsack with running sums, KPI dashboards
// and Spark SQL over temp views.
import { pyspark, md, code } from './define.js';
import { sp } from '../sql/define.js';
import { tag } from '../python/sources.js';

const DE = ['Data Engineer'];
const DE_DA = ['Data Engineer', 'Data Analyst'];

export default {
  problems: [
    pyspark({
      id: 'spark-signup-funnel', title: 'Ordered Signup Funnel Conversion', difficulty: 'Hard',
      topics: ['Funnels & Retention', 'Aggregation'], patterns: ['First time per step + ordered check'], domains: ['Product analytics'], roles: DE_DA,
      ...tag(sp('TikTok', 'Signup Funnel Conversion')),
      ordered: true,
      summary: 'Count users reaching each funnel step in order and the conversion from the previous step.',
      description: md('Steps in order: `visit → signup → verify → first_post`. A user reaches a step only if they reached the previous step **earlier** (by first occurrence time). Return `step`, `users`, `conversion_pct` (users / previous step users × 100, rounded to 1; null for the first step), ordered by funnel position.'),
      hints: ['Per user, `min(ts)` per step via conditional `F.min(F.when(step == s, ts))`; a user reaches step k when every earlier first-time is non-null and strictly increasing.'],
      schema: { events: 'user_id INTEGER User, step VARCHAR Step name, ts TIMESTAMP When' },
      solution: code`STEPS = ["visit", "signup", "verify", "first_post"]

def solve(spark, events):
    firsts = events.groupBy("user_id").agg(*[F.min(F.when(F.col("step") == s, F.col("ts"))).alias(s) for s in STEPS])
    reached, cond = [], F.col(STEPS[0]).isNotNull()
    for i, s in enumerate(STEPS):
        if i > 0:
            cond = cond & F.col(s).isNotNull() & (F.col(s) > F.col(STEPS[i - 1]))
        reached.append(F.sum(F.when(cond, 1).otherwise(0)).alias(s))
    counts = firsts.agg(*reached).collect()[0]
    rows, prev = [], None
    for i, s in enumerate(STEPS):
        n = counts[s]
        rows.append((i + 1, s, n, None if prev is None else (round(100.0 * n / prev, 1) if prev else 0.0)))
        prev = n
    return spark.createDataFrame(rows, "pos int, step string, users int, conversion_pct double").orderBy("pos").drop("pos")
`,
      explanation: 'A strict funnel needs both "did the step" and "after the previous step" — counting each step independently overstates conversion. Building the cumulative condition step by step expresses the ordering once; the small result is reshaped on the driver.',
      tests: [
        { name: 'Example', tables: { events: [[1, 'visit', '2024-01-01 10:00:00'], [1, 'signup', '2024-01-01 10:05:00'], [1, 'verify', '2024-01-01 10:10:00'], [2, 'visit', '2024-01-01 09:00:00'], [2, 'signup', '2024-01-01 09:01:00'], [3, 'signup', '2024-01-01 08:00:00'], [3, 'visit', '2024-01-01 08:30:00'], [1, 'first_post', '2024-01-02 00:00:00']] } },
        { name: 'Only visits', hidden: true, tables: { events: [[1, 'visit', '2024-01-01 00:00:00'], [2, 'visit', '2024-01-01 00:00:00']] } },
        { name: 'Out-of-order steps do not count', hidden: true, tables: { events: [[4, 'visit', '2024-01-01 00:00:00'], [4, 'verify', '2024-01-01 00:01:00'], [4, 'signup', '2024-01-01 00:02:00']] } },
      ],
    }),

    pyspark({
      id: 'spark-mom-retention', title: 'Month-over-Month Member Retention', difficulty: 'Medium',
      topics: ['Funnels & Retention', 'Joins', 'Date & Time'], patterns: ['Self join on month + 1'], domains: ['Health & fitness'], roles: DE_DA,
      ...tag(sp('Meta', 'Gym Member Retention')),
      summary: 'Share of each month\'s active members who were also active the following month.',
      description: md('Return `month` (first day), `active`, `retained` (also active in the next calendar month) and `retention_pct` (rounded to 1). A month with no following-month data still appears (retained 0). Gaps between months are not consecutive.'),
      hints: ['Distinct (member, month); self-join on member and `next.month == add_months(cur.month, 1)` as a left join.'],
      schema: { visits: 'member_id INTEGER Member, visit_date DATE Date' },
      solution: code`def solve(spark, visits):
    m = visits.select("member_id", F.trunc("visit_date", "month").alias("month")).distinct()
    cur, nxt = m.alias("c"), m.alias("n")
    j = cur.join(nxt, (F.col("c.member_id") == F.col("n.member_id")) & (F.col("n.month") == F.add_months(F.col("c.month"), 1)), "left")
    agg = j.groupBy(F.col("c.month").alias("month")).agg(
        F.count("*").alias("active"), F.count(F.col("n.member_id")).alias("retained"))
    return agg.withColumn("retention_pct", F.round(100.0 * F.col("retained") / F.col("active"), 1))
`,
      explanation: '`add_months(month, 1)` defines "the next month" exactly, so a member who skipped a month isn\'t counted as retained. `count(col)` on the right side of a left join counts only matches.',
      tests: [
        { name: 'Example', tables: { visits: [[1, '2024-01-05'], [1, '2024-02-03'], [2, '2024-01-10'], [2, '2024-03-01'], [3, '2024-02-20'], [3, '2024-03-02']] } },
        { name: 'Single month', hidden: true, tables: { visits: [[1, '2024-05-01'], [2, '2024-05-02']] } },
        { name: 'Year boundary', hidden: true, tables: { visits: [[1, '2023-12-31'], [1, '2024-01-01']] } },
      ],
    }),

    pyspark({
      id: 'spark-launch-month-sales', title: 'Sales in Each Game\'s Launch Month', difficulty: 'Medium',
      topics: ['Window Functions', 'Date & Time', 'Aggregation'], patterns: ['First period per key + share of total'], domains: ['Gaming'], roles: DE_DA,
      ...tag(sp('JPMorgan', 'Game Launch Month Sales')),
      summary: 'Units sold in each game\'s first month across platforms and that month\'s share of the game\'s lifetime sales.',
      description: md('Return `game`, `launch_month` (first month with any sales), `launch_units` (across all platforms), `lifetime_units` and `launch_share_pct` (rounded to 1).'),
      hints: ['Monthly totals per game, then `min(month)` and `sum(units)` over a per-game window.'],
      schema: { sales: 'game VARCHAR Game, platform VARCHAR Platform, sale_date DATE Date, units INTEGER Units' },
      solution: code`def solve(spark, sales):
    monthly = sales.groupBy("game", F.trunc("sale_date", "month").alias("month")).agg(F.sum("units").alias("units"))
    w = Window.partitionBy("game")
    m = monthly.withColumn("launch_month", F.min("month").over(w)).withColumn("lifetime_units", F.sum("units").over(w))
    launch = m.filter(F.col("month") == F.col("launch_month"))
    return launch.select("game", "launch_month", F.col("units").alias("launch_units"), "lifetime_units",
                         F.round(100.0 * F.col("units") / F.col("lifetime_units"), 1).alias("launch_share_pct"))
`,
      explanation: 'Partition-level windows attach both the launch month and the lifetime total to every month row, so the launch row carries everything needed for the share.',
      tests: [
        { name: 'Example', tables: { sales: [['Quest', 'pc', '2024-01-10', 100], ['Quest', 'ps', '2024-01-20', 50], ['Quest', 'pc', '2024-02-05', 50], ['Race', 'xbox', '2024-03-01', 10]] } },
        { name: 'Single month game', hidden: true, tables: { sales: [['Solo', 'pc', '2024-06-01', 7]] } },
        { name: 'Unsorted dates', hidden: true, tables: { sales: [['G', 'pc', '2024-05-01', 1], ['G', 'pc', '2024-04-30', 3]] } },
      ],
    }),

    pyspark({
      id: 'spark-odd-even-readings', title: 'Odd- and Even-Positioned Meter Readings', difficulty: 'Medium',
      topics: ['Window Functions', 'Aggregation'], patterns: ['Position within a day + conditional sums'], domains: ['Utilities / Energy'], roles: DE_DA,
      ...tag(sp('Google', 'Smart Meter Readings')),
      summary: 'Sum the 1st, 3rd, 5th… and 2nd, 4th… readings of each meter per day.',
      description: md('Number each meter\'s readings within a calendar day by time (1, 2, 3…). Return `meter_id`, `day`, `odd_sum`, `even_sum` (rounded to 2).'),
      hints: ['`row_number()` over (meter, `to_date(ts)`) ordered by ts, then `% 2` with conditional sums.'],
      schema: { readings: 'meter_id INTEGER Meter, ts TIMESTAMP When, kwh DOUBLE Reading' },
      solution: code`def solve(spark, readings):
    r = readings.withColumn("day", F.to_date("ts"))
    r = r.withColumn("n", F.row_number().over(Window.partitionBy("meter_id", "day").orderBy("ts")))
    return r.groupBy("meter_id", "day").agg(
        F.round(F.sum(F.when(F.col("n") % 2 == 1, F.col("kwh")).otherwise(0.0)), 2).alias("odd_sum"),
        F.round(F.sum(F.when(F.col("n") % 2 == 0, F.col("kwh")).otherwise(0.0)), 2).alias("even_sum"))
`,
      explanation: 'Position is not stored, so it has to be derived with `row_number` in the right partition (per meter **and** day) before odd/even sums make sense.',
      tests: [
        { name: 'Example', tables: { readings: [[1, '2024-01-01 01:00:00', 1.5], [1, '2024-01-01 02:00:00', 2.0], [1, '2024-01-01 03:00:00', 0.5], [1, '2024-01-02 01:00:00', 4.0], [2, '2024-01-01 05:00:00', 3.0]] } },
        { name: 'Unsorted timestamps', hidden: true, tables: { readings: [[3, '2024-01-01 09:00:00', 9.0], [3, '2024-01-01 08:00:00', 8.0]] } },
        { name: 'Even count', hidden: true, tables: { readings: [[4, '2024-01-01 00:00:00', 1.0], [4, '2024-01-01 00:01:00', 1.0], [4, '2024-01-01 00:02:00', 1.0], [4, '2024-01-01 00:03:00', 1.0]] } },
      ],
    }),

    pyspark({
      id: 'spark-election-seats', title: 'Seats Won by Each Party', difficulty: 'Hard',
      topics: ['Ranking & Top-N', 'Aggregation', 'Joins'], patterns: ['Winner per group, then count'], domains: ['Public sector'], roles: DE_DA,
      ...tag(sp('Docusign', 'Tallying Election Results')),
      summary: 'Find each constituency\'s winner and count seats per party; ties produce no winner.',
      description: md('Votes are per (constituency, candidate). A candidate wins a constituency with strictly the most votes (a tie at the top means no seat is awarded). Join to `candidates` for the party. Return `party`, `seats` for parties with at least one seat.'),
      hints: ['`rank()` per constituency by votes desc, plus a count of rank-1 rows to detect ties.'],
      schema: { votes: 'constituency VARCHAR Seat, candidate_id INTEGER Candidate, votes INTEGER Votes', candidates: 'candidate_id INTEGER Candidate, party VARCHAR Party' },
      solution: code`def solve(spark, votes, candidates):
    w = Window.partitionBy("constituency").orderBy(F.desc("votes"))
    ranked = votes.withColumn("rk", F.rank().over(w))
    top = ranked.filter("rk = 1").withColumn("leaders", F.count("*").over(Window.partitionBy("constituency")))
    winners = top.filter(F.col("leaders") == 1)
    return winners.join(candidates, "candidate_id").groupBy("party").agg(F.count("*").alias("seats"))
`,
      explanation: '`rank` gives every tied leader rank 1; counting the rank-1 rows per constituency tells whether the result is decisive. Only then are winners joined to parties and counted.',
      tests: [
        { name: 'Example', tables: { votes: [['north', 1, 500], ['north', 2, 300], ['south', 3, 200], ['south', 4, 250], ['east', 5, 100], ['east', 6, 100]], candidates: [[1, 'Blue'], [2, 'Red'], [3, 'Blue'], [4, 'Red'], [5, 'Green'], [6, 'Blue']] } },
        { name: 'All seats to one party', hidden: true, tables: { votes: [['a', 1, 2], ['b', 2, 3]], candidates: [[1, 'X'], [2, 'X']] } },
        { name: 'Every seat tied', hidden: true, tables: { votes: [['c', 1, 5], ['c', 2, 5]], candidates: [[1, 'P'], [2, 'Q']] } },
      ],
    }),

    pyspark({
      id: 'spark-budget-utilization', title: 'Department Salary vs Budget, with Top Earner', difficulty: 'Hard',
      topics: ['Aggregation', 'Joins', 'Window Functions'], patterns: ['Aggregate + top-1 per group + join'], domains: ['HR / People'], roles: DE_DA,
      ...tag(sp('Twitter (X)', 'Department Budget Utilization')),
      summary: 'Compare each department\'s salary cost with its budget and name its top earner.',
      description: md('Return `dept`, `salary_cost`, `budget`, `utilization_pct` (cost / budget × 100, rounded to 1), `over_budget` (bool) and `top_earner` (name of the highest-paid employee; ties by name). Departments with no employees have cost 0 and a null top earner.'),
      hints: ['Two aggregates (cost; top earner via `row_number`), both left-joined to budgets.'],
      schema: { employees: 'emp_id INTEGER Id, name VARCHAR Name, dept VARCHAR Department, salary DOUBLE Salary', budgets: 'dept VARCHAR Department, budget DOUBLE Budget' },
      solution: code`def solve(spark, employees, budgets):
    cost = employees.groupBy("dept").agg(F.sum("salary").alias("cost"))
    w = Window.partitionBy("dept").orderBy(F.desc("salary"), "name")
    top = employees.withColumn("rn", F.row_number().over(w)).filter("rn = 1").select("dept", F.col("name").alias("top_earner"))
    j = (budgets.join(cost, "dept", "left").join(top, "dept", "left")
         .withColumn("salary_cost", F.coalesce(F.col("cost"), F.lit(0.0))))
    return j.select("dept", "salary_cost", "budget",
                    F.round(100.0 * F.col("salary_cost") / F.col("budget"), 1).alias("utilization_pct"),
                    (F.col("salary_cost") > F.col("budget")).alias("over_budget"), "top_earner")
`,
      explanation: 'Driving from the budgets table keeps empty departments. Computing the top earner separately (rather than joining employees to budgets first) keeps every join one-to-one.',
      tests: [
        { name: 'Example', tables: { employees: [[1, 'ana', 'eng', 120.0], [2, 'raj', 'eng', 100.0], [3, 'li', 'ops', 90.0]], budgets: [['eng', 200.0], ['ops', 100.0], ['hr', 50.0]] } },
        { name: 'Tie for top earner', hidden: true, tables: { employees: [[1, 'zed', 'bi', 10.0], [2, 'amy', 'bi', 10.0]], budgets: [['bi', 30.0]] } },
        { name: 'Exactly on budget', hidden: true, tables: { employees: [[1, 'x', 'a', 50.0]], budgets: [['a', 50.0]] } },
      ],
    }),

    pyspark({
      id: 'spark-increasing-yearly-sales', title: 'Products Whose Sales Rose Every Year', difficulty: 'Hard',
      topics: ['Window Functions', 'Aggregation'], patterns: ['All consecutive differences positive'], domains: ['Retail'], roles: DE_DA,
      ...tag(sp('Deloitte', 'Products with Increasing Sales')),
      summary: 'Find products with strictly increasing revenue in every consecutive year they sold.',
      description: md('Aggregate revenue per product per year. Return `product` for products with at least two years of sales whose revenue strictly increased year over year, with no missing years in between.'),
      hints: ['`lag` revenue and year per product; a product qualifies when every row with a previous year has `year = prev_year + 1` and `revenue > prev_revenue`.'],
      schema: { sales: 'product VARCHAR Product, sale_date DATE Date, revenue DOUBLE Revenue' },
      solution: code`def solve(spark, sales):
    yearly = sales.groupBy("product", F.year("sale_date").alias("year")).agg(F.sum("revenue").alias("rev"))
    w = Window.partitionBy("product").orderBy("year")
    y = yearly.withColumn("prev_rev", F.lag("rev").over(w)).withColumn("prev_year", F.lag("year").over(w))
    bad = F.col("prev_year").isNotNull() & ((F.col("year") != F.col("prev_year") + 1) | (F.col("rev") <= F.col("prev_rev")))
    return (y.groupBy("product").agg(F.count("*").alias("years"), F.sum(F.when(bad, 1).otherwise(0)).alias("bad"))
            .filter((F.col("years") >= 2) & (F.col("bad") == 0)).select("product"))
`,
      explanation: '"For every year" becomes "no year breaks the rule": count the violations and keep products with zero. A gap year counts as a violation, which is the strict reading of "every year".',
      tests: [
        { name: 'Example', tables: { sales: [['a', '2021-05-01', 10.0], ['a', '2022-05-01', 12.0], ['a', '2023-05-01', 15.0], ['b', '2021-01-01', 10.0], ['b', '2022-01-01', 9.0], ['c', '2021-01-01', 1.0], ['c', '2023-01-01', 5.0], ['d', '2022-01-01', 3.0]] } },
        { name: 'Flat year fails', hidden: true, tables: { sales: [['e', '2020-01-01', 5.0], ['e', '2021-01-01', 5.0]] } },
        { name: 'Several sales per year', hidden: true, tables: { sales: [['f', '2020-01-01', 1.0], ['f', '2020-06-01', 1.0], ['f', '2021-01-01', 3.0]] } },
      ],
    }),

    pyspark({
      id: 'spark-unpivot-quarters', title: 'Unpivot Quarterly Sales and Compute Growth', difficulty: 'Hard',
      topics: ['Pivoting', 'Window Functions'], patterns: ['unpivot (melt) + lag'], domains: ['Retail'], roles: DE_DA,
      ...tag(sp('Wayfair', 'Quarterly Sales Growth Unpivot')),
      summary: 'Turn wide q1..q4 columns into rows and compute quarter-over-quarter growth.',
      description: md('Each row has `region, q1, q2, q3, q4`. Unpivot to `region, quarter, sales` and add `growth_pct` vs the previous quarter in the same region (rounded to 1; null for q1 or when the previous quarter is 0 or null).'),
      hints: ['`df.unpivot(["region"], ["q1", "q2", "q3", "q4"], "quarter", "sales")`; quarter names sort correctly as strings.'],
      schema: { wide: 'region VARCHAR Region, q1 DOUBLE Q1, q2 DOUBLE Q2, q3 DOUBLE Q3, q4 DOUBLE Q4' },
      solution: code`def solve(spark, wide):
    long = wide.unpivot(["region"], ["q1", "q2", "q3", "q4"], "quarter", "sales")
    prev = F.lag("sales").over(Window.partitionBy("region").orderBy("quarter"))
    growth = F.when(prev.isNotNull() & (prev != 0), F.round((F.col("sales") - prev) / prev * 100, 1))
    return long.withColumn("growth_pct", growth)
`,
      explanation: 'Wide tables are easy to read but hard to compute over; unpivoting makes "previous quarter" an ordinary `lag`. (`unpivot`/`melt` arrived in Spark 3.4; before that, `stack()` in `selectExpr`.)',
      tests: [
        { name: 'Example', tables: { wide: [['north', 100.0, 120.0, 90.0, 99.0], ['south', 0.0, 10.0, 20.0, null]] } },
        { name: 'Flat sales', hidden: true, tables: { wide: [['east', 5.0, 5.0, 5.0, 5.0]] } },
        { name: 'Two regions', hidden: true, tables: { wide: [['a', 1.0, 2.0, 4.0, 8.0], ['b', 8.0, 4.0, 2.0, 1.0]] } },
      ],
    }),

    pyspark({
      id: 'spark-top-users-distinct-events', title: 'Top Users by Distinct Event Types per Day', difficulty: 'Medium',
      topics: ['Ranking & Top-N', 'Aggregation'], patterns: ['countDistinct then dense_rank per day'], domains: ['Product analytics'], roles: DE_DA,
      ...tag(sp('Cargill', 'Top Users by Event Types')),
      summary: 'For each day, the users with the three highest counts of distinct event types (ties included).',
      description: md('Return `day`, `user_id`, `event_types`, `rnk` for users whose `dense_rank` by distinct event types that day is ≤ 3.'),
      hints: ['`countDistinct("event")` per (day, user), then `dense_rank` partitioned by day.'],
      schema: { events: 'user_id INTEGER User, event VARCHAR Event, ts TIMESTAMP When' },
      solution: code`def solve(spark, events):
    per_user = events.groupBy(F.to_date("ts").alias("day"), "user_id").agg(F.countDistinct("event").alias("event_types"))
    w = Window.partitionBy("day").orderBy(F.desc("event_types"))
    return per_user.withColumn("rnk", F.dense_rank().over(w)).filter(F.col("rnk") <= 3)
`,
      explanation: 'Distinct counts measure breadth of engagement rather than volume. Ranking within each day keeps days independent.',
      tests: [
        { name: 'Example', tables: { events: [[1, 'view', '2024-01-01 01:00:00'], [1, 'click', '2024-01-01 02:00:00'], [1, 'view', '2024-01-01 03:00:00'], [2, 'view', '2024-01-01 01:00:00'], [3, 'buy', '2024-01-01 01:00:00'], [3, 'view', '2024-01-01 01:00:00'], [3, 'click', '2024-01-01 01:00:00'], [4, 'share', '2024-01-01 01:00:00'], [5, 'view', '2024-01-02 01:00:00']] } },
        { name: 'All tied', hidden: true, tables: { events: [[1, 'a', '2024-02-01 00:00:00'], [2, 'a', '2024-02-01 00:00:00']] } },
        { name: 'Single user', hidden: true, tables: { events: [[9, 'a', '2024-03-01 00:00:00'], [9, 'b', '2024-03-01 00:00:00']] } },
      ],
    }),

    pyspark({
      id: 'spark-exam-attendance', title: 'Exam Attendance Report', difficulty: 'Medium',
      topics: ['Joins', 'Aggregation'], patterns: ['Registered vs attended with left join'], domains: ['Education'], roles: DE_DA,
      ...tag(sp('HiLabs', 'Exam Attendance Report')),
      summary: 'Per exam: registered students, how many attended, and the attendance rate.',
      description: md('Return `exam_id`, `subject`, `registered`, `attended` (registered students with an attendance record for that exam) and `attendance_pct` (rounded to 1). Attendance records for unregistered students are ignored.'),
      hints: ['Left join registrations to attendance on both keys; `count` of the right-side key counts attendees.'],
      schema: { exams: 'exam_id INTEGER Exam, subject VARCHAR Subject', registrations: 'exam_id INTEGER Exam, student_id INTEGER Student', attendance: 'exam_id INTEGER Exam, student_id INTEGER Student' },
      solution: code`def solve(spark, exams, registrations, attendance):
    a = attendance.distinct().withColumn("present", F.lit(1))
    r = registrations.join(a, ["exam_id", "student_id"], "left")
    stats = r.groupBy("exam_id").agg(F.count("*").alias("registered"), F.count("present").alias("attended"))
    return (exams.join(stats, "exam_id")
            .withColumn("attendance_pct", F.round(100.0 * F.col("attended") / F.col("registered"), 1)))
`,
      explanation: 'Starting from registrations defines the denominator; the left join plus `count(col)` counts only matched attendees, and `distinct` stops double check-ins inflating attendance.',
      tests: [
        { name: 'Example', tables: { exams: [[1, 'math'], [2, 'art']], registrations: [[1, 10], [1, 11], [1, 12], [2, 10]], attendance: [[1, 10], [1, 12], [1, 99], [2, 10], [2, 10]] } },
        { name: 'Nobody attended', hidden: true, tables: { exams: [[3, 'bio']], registrations: [[3, 1]], attendance: [] } },
        { name: 'Full attendance', hidden: true, tables: { exams: [[4, 'cs']], registrations: [[4, 1], [4, 2]], attendance: [[4, 1], [4, 2]] } },
      ],
    }),

    pyspark({
      id: 'spark-running-payroll', title: 'Monthly Payroll with Overtime and Bonuses', difficulty: 'Medium',
      topics: ['Joins', 'Column Expressions', 'Aggregation'], patterns: ['Conditional arithmetic after a join'], domains: ['HR / People'], roles: DE_DA,
      summary: 'Compute each employee\'s pay from hours (overtime at 1.5×) and bonuses.',
      description: md('Base pay = hours up to 160 at the hourly rate, plus hours above 160 at 1.5× the rate. Add the sum of the employee\'s bonuses for the month (0 if none). Return `emp_id`, `name`, `base_pay`, `bonus`, `total_pay` (all rounded to 2).'),
      hints: ['`F.least("hours", F.lit(160))` and `F.greatest(F.col("hours") - 160, F.lit(0))`.'],
      schema: { employees: 'emp_id INTEGER Id, name VARCHAR Name, hourly_rate DOUBLE Rate', timesheets: 'emp_id INTEGER Id, hours DOUBLE Hours this month', bonuses: 'emp_id INTEGER Id, amount DOUBLE Bonus' },
      solution: code`def solve(spark, employees, timesheets, bonuses):
    b = bonuses.groupBy("emp_id").agg(F.sum("amount").alias("bonus_sum"))
    j = (employees.join(timesheets, "emp_id").join(b, "emp_id", "left")
         .withColumn("bonus", F.coalesce(F.col("bonus_sum"), F.lit(0.0))))
    base = (F.least("hours", F.lit(160.0)) * F.col("hourly_rate")
            + F.greatest(F.col("hours") - 160, F.lit(0.0)) * F.col("hourly_rate") * 1.5)
    return (j.withColumn("base_pay", F.round(base, 2))
            .select("emp_id", "name", "base_pay", F.round("bonus", 2).alias("bonus"),
                    F.round(F.col("base_pay") + F.col("bonus"), 2).alias("total_pay")))
`,
      explanation: '`least`/`greatest` split hours into regular and overtime without branching. Aggregating bonuses before the join prevents several bonuses from duplicating the timesheet row.',
      tests: [
        { name: 'Example', tables: { employees: [[1, 'ana', 20.0], [2, 'raj', 10.0]], timesheets: [[1, 170.0], [2, 100.0]], bonuses: [[1, 50.0], [1, 25.0]] } },
        { name: 'Exactly 160 hours', hidden: true, tables: { employees: [[3, 'li', 15.0]], timesheets: [[3, 160.0]], bonuses: [] } },
        { name: 'Fractional overtime', hidden: true, tables: { employees: [[4, 'zoe', 9.99]], timesheets: [[4, 160.5]], bonuses: [[4, 0.01]] } },
      ],
    }),

    pyspark({
      id: 'spark-sales-segmentation', title: 'Segment Trips and Average Fare per Segment', difficulty: 'Medium',
      topics: ['Column Expressions', 'Aggregation', 'Filtering'], patterns: ['Bucket then aggregate'], domains: ['Mobility / Ride-hailing'], roles: DE_DA,
      ...tag(sp('Uber', 'Sales Segmentation')),
      summary: 'Bucket completed trips by distance and report count and average fare per bucket.',
      description: md('Using completed trips only: `short` (< 5 km), `medium` (5–15 km), `long` (> 15 km). Return `segment`, `trips`, `avg_fare` (rounded to 2), `fare_per_km` (total fare / total km, rounded to 2).'),
      hints: ['Bucket with `when`, then aggregate; the ratio of sums is not the average of ratios.'],
      schema: { trips: 'trip_id INTEGER Trip, km DOUBLE Distance, fare DOUBLE Fare, status VARCHAR completed · cancelled' },
      solution: code`def solve(spark, trips):
    seg = F.when(F.col("km") < 5, "short").when(F.col("km") <= 15, "medium").otherwise("long")
    done = trips.filter(F.col("status") == "completed").withColumn("segment", seg)
    return done.groupBy("segment").agg(
        F.count("*").alias("trips"),
        F.round(F.avg("fare"), 2).alias("avg_fare"),
        F.round(F.sum("fare") / F.sum("km"), 2).alias("fare_per_km"))
`,
      explanation: 'Total fare / total km weights long trips properly; averaging per-trip ratios would let one tiny trip with a minimum fare dominate.',
      tests: [
        { name: 'Example', tables: { trips: [[1, 2.0, 5.0, 'completed'], [2, 4.0, 7.0, 'completed'], [3, 10.0, 15.0, 'completed'], [4, 20.0, 30.0, 'completed'], [5, 3.0, 5.0, 'cancelled']] } },
        { name: 'Boundaries', hidden: true, tables: { trips: [[1, 5.0, 10.0, 'completed'], [2, 15.0, 20.0, 'completed'], [3, 15.1, 20.0, 'completed']] } },
        { name: 'Only cancellations', hidden: true, tables: { trips: [[1, 1.0, 1.0, 'cancelled']] } },
      ],
    }),

    pyspark({
      id: 'spark-items-within-budget', title: 'Maximum Items Within a Budget', difficulty: 'Hard',
      topics: ['Window Functions', 'Aggregation'], patterns: ['Greedy by price with a running sum'], domains: ['E-commerce / Sales'], roles: DE,
      ...tag(sp('EPAM', 'Maximize Items Within Budget')),
      summary: 'For each shopper, buy as many distinct items as possible without exceeding their budget.',
      description: md('Each shopper has a budget and a wishlist of items with prices. Buying the cheapest items first maximises the count. Return `shopper_id`, `items_bought`, `spent` (rounded to 2) — 0 and 0 if they can afford nothing.'),
      hints: ['Running sum of prices ordered ascending per shopper; keep rows where the running sum ≤ budget; aggregate. Left-join from shoppers.'],
      schema: { shoppers: 'shopper_id INTEGER Shopper, budget DOUBLE Budget', wishlist: 'shopper_id INTEGER Shopper, item VARCHAR Item, price DOUBLE Price' },
      solution: code`def solve(spark, shoppers, wishlist):
    w = Window.partitionBy("shopper_id").orderBy("price", "item").rowsBetween(Window.unboundedPreceding, Window.currentRow)
    running = wishlist.join(shoppers, "shopper_id").withColumn("cum", F.sum("price").over(w))
    bought = running.filter(F.col("cum") <= F.col("budget")).groupBy("shopper_id").agg(
        F.count("*").alias("n"), F.sum("price").alias("s"))
    j = shoppers.join(bought, "shopper_id", "left")
    return j.select("shopper_id", F.coalesce(F.col("n"), F.lit(0)).alias("items_bought"),
                    F.round(F.coalesce(F.col("s"), F.lit(0.0)), 2).alias("spent"))
`,
      explanation: 'Maximising the **number** of items under a budget is solved greedily — cheapest first — so a running sum over sorted prices is exact (maximising value would need knapsack DP). The prefix condition `cum <= budget` selects exactly the affordable prefix.',
      tests: [
        { name: 'Example', tables: { shoppers: [[1, 10.0], [2, 1.0]], wishlist: [[1, 'a', 4.0], [1, 'b', 2.0], [1, 'c', 5.0], [1, 'd', 3.5], [2, 'e', 5.0]] } },
        { name: 'Exact budget', hidden: true, tables: { shoppers: [[3, 6.0]], wishlist: [[3, 'x', 3.0], [3, 'y', 3.0], [3, 'z', 0.5]] } },
        { name: 'Empty wishlist', hidden: true, tables: { shoppers: [[4, 100.0]], wishlist: [] } },
      ],
    }),

    pyspark({
      id: 'spark-ecommerce-kpis', title: 'E-Commerce KPI Summary', difficulty: 'Medium',
      topics: ['Aggregation', 'Joins'], patterns: ['Several KPIs in one aggregation'], domains: ['E-commerce / Sales'], roles: DE_DA,
      summary: 'Orders, revenue, AOV, items per order and the top category, per country.',
      description: md('Join orders to order lines and products. Per `country`: `orders` (distinct), `revenue` (Σ qty × price, rounded to 2), `aov` (revenue / orders, rounded to 2), `items_per_order` (Σ qty / orders, rounded to 2) and `top_category` (highest revenue; ties alphabetical).'),
      hints: ['One aggregation for the scalar KPIs; a separate per (country, category) revenue ranked with `row_number` for the top category; join them.'],
      schema: { orders: 'order_id INTEGER Order, country VARCHAR Country', lines: 'order_id INTEGER Order, product_id INTEGER Product, qty INTEGER Quantity', products: 'product_id INTEGER Product, category VARCHAR Category, price DOUBLE Price' },
      solution: code`def solve(spark, orders, lines, products):
    j = lines.join(products, "product_id").join(orders, "order_id").withColumn("rev", F.col("qty") * F.col("price"))
    kpi = j.groupBy("country").agg(F.countDistinct("order_id").alias("orders"), F.sum("rev").alias("r"), F.sum("qty").alias("q"))
    cat = j.groupBy("country", "category").agg(F.sum("rev").alias("cr"))
    top = (cat.withColumn("rn", F.row_number().over(Window.partitionBy("country").orderBy(F.desc("cr"), "category")))
           .filter("rn = 1").select("country", F.col("category").alias("top_category")))
    return kpi.join(top, "country").select(
        "country", "orders", F.round("r", 2).alias("revenue"),
        F.round(F.col("r") / F.col("orders"), 2).alias("aov"),
        F.round(F.col("q") / F.col("orders"), 2).alias("items_per_order"), "top_category")
`,
      explanation: 'Counting **distinct** orders after joining to lines is essential — `count(*)` would count lines. Computing the top category separately and joining keeps each aggregate at its own grain.',
      tests: [
        { name: 'Example', tables: { orders: [[1, 'IN'], [2, 'IN'], [3, 'US']], lines: [[1, 10, 2], [1, 11, 1], [2, 10, 1], [3, 12, 4]], products: [[10, 'books', 5.0], [11, 'toys', 12.0], [12, 'toys', 2.5]] } },
        { name: 'Category tie', hidden: true, tables: { orders: [[1, 'DE']], lines: [[1, 1, 1], [1, 2, 1]], products: [[1, 'b', 3.0], [2, 'a', 3.0]] } },
        { name: 'Single order', hidden: true, tables: { orders: [[9, 'FR']], lines: [[9, 5, 3]], products: [[5, 'food', 1.1]] } },
      ],
    }),

    pyspark({
      id: 'spark-sql-temp-view', title: 'Mix Spark SQL and DataFrames via a Temp View', difficulty: 'Medium',
      topics: ['Spark SQL', 'Window Functions'], patterns: ['createOrReplaceTempView + spark.sql'], domains: ['E-commerce / Sales'], roles: DE_DA,
      summary: 'Register DataFrames as views and answer the question with a SQL query run through spark.sql.',
      description: md('Register `orders` as the view `orders`, then use `spark.sql` to return, per customer, `customer_id`, `orders`, `total` (rounded to 2) and `first_order` for customers with at least 2 orders. The result is a normal DataFrame.'),
      hints: ['`orders.createOrReplaceTempView("orders")`, then `spark.sql("SELECT … FROM orders GROUP BY … HAVING …")`.'],
      schema: { orders: 'order_id INTEGER Order, customer_id INTEGER Customer, amount DOUBLE Amount, order_date DATE Date' },
      solution: code`def solve(spark, orders):
    orders.createOrReplaceTempView("orders")
    return spark.sql("""
        SELECT customer_id,
               COUNT(*) AS orders,
               ROUND(SUM(amount), 2) AS total,
               MIN(order_date) AS first_order
        FROM orders
        GROUP BY customer_id
        HAVING COUNT(*) >= 2
    """)
`,
      explanation: 'Spark SQL and the DataFrame API compile to the same plan, so you can use whichever reads better per step. Temp views are session-scoped names for DataFrames — nothing is written anywhere.',
      tests: [
        { name: 'Example', tables: { orders: [[1, 7, 10.0, '2024-01-05'], [2, 7, 2.5, '2024-01-01'], [3, 8, 3.0, '2024-02-01']] } },
        { name: 'Nobody repeats', hidden: true, tables: { orders: [[1, 1, 1.0, '2024-01-01']] } },
        { name: 'Rounding', hidden: true, tables: { orders: [[1, 2, 0.1, '2024-01-01'], [2, 2, 0.2, '2024-01-02']] } },
      ],
    }),
  ],
};
