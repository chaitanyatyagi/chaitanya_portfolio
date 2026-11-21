// PySpark pack 8 — SCD and incremental loads, sessionization, and gaps &
// islands: SCD Type 2, SCD Type 1 upserts, CDC replay with deletes, watermark
// loads, session ids from inactivity gaps, attendance streaks, merging
// overlapping intervals, pairing start/stop events, retry detection, new vs
// returning users, and job-run statistics.
import { pyspark, md, code } from './define.js';
import { sp } from '../sql/define.js';
import { tag } from '../python/sources.js';

const DE = ['Data Engineer'];
const DE_DA = ['Data Engineer', 'Data Analyst'];

export default {
  problems: [
    pyspark({
      id: 'spark-scd2-history', title: 'Track Employee History (SCD Type 2)', difficulty: 'Hard',
      topics: ['SCD & Incremental Loads', 'Joins', 'Set Operations'], patterns: ['SCD Type 2 merge'], domains: ['HR / People'], roles: DE,
      ...tag(sp('Deloitte', 'Track Employee History')),
      summary: 'Apply today\'s extract to a type-2 history table: close changed rows and open new versions.',
      description: md(
        '`history` rows: `emp_id, dept, valid_from, valid_to, is_current` (`valid_to` null for current rows). `snapshot` is today\'s full extract `emp_id, dept`; `load_date` is the single row of the `run` table.',
        '',
        'Return the new full history: unchanged rows as they were; for an employee whose `dept` changed, the current row gets `valid_to = load_date, is_current = false` and a new current row starts at `load_date`; brand-new employees get a current row. Employees missing from the snapshot are left as they are.',
      ),
      hints: ['Split the work: (1) closed history rows (not current) pass through; (2) current rows joined to the snapshot decide "unchanged / changed"; (3) new ids via `left_anti`. Union the pieces with `unionByName`.'],
      schema: {
        history: 'emp_id INTEGER Employee, dept VARCHAR Department, valid_from DATE From, valid_to DATE To, is_current BOOLEAN Current',
        snapshot: 'emp_id INTEGER Employee, dept VARCHAR Department',
        run: 'load_date DATE Load date',
      },
      solution: code`def solve(spark, history, snapshot, run):
    load_date = run.collect()[0]["load_date"]
    closed = history.filter(~F.col("is_current"))
    cur = history.filter(F.col("is_current"))
    j = cur.alias("h").join(snapshot.alias("s"), F.col("h.emp_id") == F.col("s.emp_id"), "left")
    unchanged = j.filter(F.col("s.dept").isNull() | (F.col("s.dept") == F.col("h.dept"))).select("h.*")
    changed = j.filter(F.col("s.dept").isNotNull() & (F.col("s.dept") != F.col("h.dept")))
    expired = changed.select(F.col("h.emp_id").alias("emp_id"), F.col("h.dept").alias("dept"), F.col("h.valid_from").alias("valid_from"),
                             F.lit(load_date).cast("date").alias("valid_to"), F.lit(False).alias("is_current"))
    opened = changed.select(F.col("s.emp_id").alias("emp_id"), F.col("s.dept").alias("dept"), F.lit(load_date).cast("date").alias("valid_from"),
                            F.lit(None).cast("date").alias("valid_to"), F.lit(True).alias("is_current"))
    new = (snapshot.join(cur, "emp_id", "left_anti")
           .select("emp_id", "dept", F.lit(load_date).cast("date").alias("valid_from"),
                   F.lit(None).cast("date").alias("valid_to"), F.lit(True).alias("is_current")))
    cols = ["emp_id", "dept", "valid_from", "valid_to", "is_current"]
    return closed.select(*cols).unionByName(unchanged.select(*cols)).unionByName(expired).unionByName(opened).unionByName(new)
`,
      explanation: 'Type 2 keeps every version with a validity range so facts can join to the value true at the time. Decomposing the merge into pass-through, expire, open and insert sets keeps each piece simple; on Delta Lake the same logic is one `MERGE` with a staged union.',
      tests: [
        { name: 'Example', tables: { history: [[1, 'eng', '2023-01-01', null, true], [2, 'ops', '2023-01-01', null, true], [3, 'hr', '2022-01-01', '2023-01-01', false], [3, 'bi', '2023-01-01', null, true]], snapshot: [[1, 'eng'], [2, 'sales'], [4, 'eng']], run: [['2024-06-01']] } },
        { name: 'Nothing changed', hidden: true, tables: { history: [[1, 'a', '2024-01-01', null, true]], snapshot: [[1, 'a']], run: [['2024-02-01']] } },
        { name: 'First load', hidden: true, tables: { history: [], snapshot: [[5, 'x'], [6, 'y']], run: [['2024-01-01']] } },
      ],
    }),

    pyspark({
      id: 'spark-scd1-upsert', title: 'Upsert a Product Catalog (SCD Type 1)', difficulty: 'Medium',
      topics: ['SCD & Incremental Loads', 'Joins'], patterns: ['Upsert via full outer join'], domains: ['E-commerce / Sales'], roles: DE,
      ...tag(sp('Microsoft', 'Product Catalog Upsert')),
      summary: 'Merge a supplier feed into the catalog: overwrite changed products, insert new ones, keep the rest.',
      description: md('Return the merged catalog `sku, name, price, updated`: for skus in the feed take the feed\'s name and price (`updated = true` if either changed, also true for new skus); otherwise keep the catalog row with `updated = false`.'),
      hints: ['A full outer join on sku; `coalesce(feed, catalog)` per column; compare old and new values to set `updated` (use `eqNullSafe` for nullable columns).'],
      schema: { catalog: 'sku VARCHAR SKU, name VARCHAR Name, price DOUBLE Price', feed: 'sku VARCHAR SKU, name VARCHAR Name, price DOUBLE Price' },
      solution: code`def solve(spark, catalog, feed):
    c, f = catalog.alias("c"), feed.alias("f")
    j = c.join(f, F.col("c.sku") == F.col("f.sku"), "full_outer")
    in_feed = F.col("f.sku").isNotNull()
    changed = in_feed & ~(F.col("c.name").eqNullSafe(F.col("f.name")) & F.col("c.price").eqNullSafe(F.col("f.price")))
    return j.select(
        F.coalesce("f.sku", "c.sku").alias("sku"),
        F.when(in_feed, F.col("f.name")).otherwise(F.col("c.name")).alias("name"),
        F.when(in_feed, F.col("f.price")).otherwise(F.col("c.price")).alias("price"),
        changed.alias("updated"),
    )
`,
      explanation: 'Type 1 overwrites in place (no history). `eqNullSafe` (`<=>`) treats two nulls as equal, so an unchanged null field isn\'t reported as a change.',
      tests: [
        { name: 'Example', tables: { catalog: [['A', 'Tea', 2.0], ['B', 'Cake', 5.0], ['C', 'Bun', 1.0]], feed: [['B', 'Cake', 5.5], ['C', 'Bun', 1.0], ['D', 'Jam', 3.0]] } },
        { name: 'Empty feed', hidden: true, tables: { catalog: [['A', 'x', 1.0]], feed: [] } },
        { name: 'Null price unchanged', hidden: true, tables: { catalog: [['Z', 'z', null]], feed: [['Z', 'z', null]] } },
      ],
    }),

    pyspark({
      id: 'spark-cdc-replay', title: 'Replay a CDC Log into a Current Snapshot', difficulty: 'Medium',
      topics: ['SCD & Incremental Loads', 'Window Functions', 'Deduplication'], patterns: ['Latest op per key, drop deletes'], domains: ['Database replication'], roles: DE,
      summary: 'Apply insert / update / delete events in order and return the current state of each key.',
      description: md('Each CDC event is `[lsn, op, id, name, balance]` with op `I`, `U` or `D`. Return the current rows `id, name, balance` — the last event per id by `lsn`, excluding ids whose last event is a delete.'),
      hints: ['`row_number` by `lsn` desc per id, keep the first, then drop `op == "D"`.'],
      schema: { cdc: 'lsn INTEGER Log sequence, op VARCHAR I · U · D, id INTEGER Key, name VARCHAR Name, balance DOUBLE Balance' },
      solution: code`def solve(spark, cdc):
    w = Window.partitionBy("id").orderBy(F.desc("lsn"))
    last = cdc.withColumn("rn", F.row_number().over(w)).filter("rn = 1")
    return last.filter(F.col("op") != "D").select("id", "name", "balance")
`,
      explanation: 'A change log can be compacted to the latest event per key; the snapshot is that event\'s values unless it was a delete. Ordering by the log sequence number (not wall-clock time) is what makes replay exact.',
      tests: [
        { name: 'Example', tables: { cdc: [[1, 'I', 10, 'ana', 5.0], [2, 'U', 10, 'ana', 7.5], [3, 'I', 11, 'raj', 1.0], [4, 'D', 11, null, null], [5, 'I', 12, 'li', 0.0]] } },
        { name: 'Re-insert after delete', hidden: true, tables: { cdc: [[1, 'I', 1, 'a', 1.0], [2, 'D', 1, null, null], [3, 'I', 1, 'a2', 2.0]] } },
        { name: 'Out-of-order arrival', hidden: true, tables: { cdc: [[9, 'U', 2, 'new', 9.0], [3, 'I', 2, 'old', 1.0]] } },
      ],
    }),

    pyspark({
      id: 'spark-watermark-incremental', title: 'Incremental Load Above a Watermark', difficulty: 'Medium',
      topics: ['SCD & Incremental Loads', 'Filtering', 'Joins'], patterns: ['High-watermark + lookback + dedupe'], domains: ['Data warehousing'], roles: DE,
      summary: 'Select only new source rows since the last load (with a lookback for late commits) that aren\'t already in the target.',
      description: md('`state` holds the last loaded `watermark` (a timestamp). Return source rows with `updated_at > watermark − 1 hour` that are not already present in `target` with the same `id` and `updated_at`, plus a column `new_watermark` (the max `updated_at` among the returned rows, or the old watermark if none).'),
      hints: ['Collect the watermark, filter with `F.expr("interval 1 hour")` subtracted, `left_anti` against target on (id, updated_at).'],
      schema: { source: 'id INTEGER Id, updated_at TIMESTAMP Updated, value VARCHAR Value', target: 'id INTEGER Id, updated_at TIMESTAMP Updated', state: 'watermark TIMESTAMP Last loaded' },
      solution: code`def solve(spark, source, target, state):
    wm = state.collect()[0]["watermark"]
    lower = F.lit(wm).cast("timestamp") - F.expr("interval 1 hour")
    fresh = source.filter(F.col("updated_at") > lower).join(target, ["id", "updated_at"], "left_anti")
    new_wm = fresh.agg(F.max("updated_at").alias("m")).collect()[0]["m"] or wm
    return fresh.withColumn("new_watermark", F.lit(new_wm).cast("timestamp"))
`,
      explanation: 'The lookback re-reads rows committed late with older timestamps; the anti join against what is already loaded makes the re-read harmless, so the load is idempotent. Only advance the watermark to data you actually loaded.',
      tests: [
        { name: 'Example', tables: { source: [[1, '2024-01-01 09:30:00', 'late'], [2, '2024-01-01 11:00:00', 'new'], [3, '2024-01-01 07:00:00', 'old'], [4, '2024-01-01 09:50:00', 'loaded']], target: [[4, '2024-01-01 09:50:00']], state: [['2024-01-01 10:00:00']] } },
        { name: 'Nothing new', hidden: true, tables: { source: [[1, '2024-01-01 00:00:00', 'x']], target: [], state: [['2024-02-01 00:00:00']] } },
        { name: 'Re-run loads nothing twice', hidden: true, tables: { source: [[5, '2024-03-01 12:00:00', 'y']], target: [[5, '2024-03-01 12:00:00']], state: [['2024-03-01 12:00:00']] } },
      ],
    }),

    pyspark({
      id: 'spark-sessionize', title: 'Sessionize a Clickstream', difficulty: 'Hard',
      topics: ['Sessionization', 'Window Functions'], patterns: ['Gap flag + running sum'], domains: ['Web analytics'], roles: DE,
      ...tag(sp('Nielsen', 'Sessionize Clickstream Data')),
      summary: 'Assign session numbers: a new session starts after 30 minutes of inactivity.',
      description: md('Per user in `ts` order, a new session starts at the first event or when the gap since the previous event exceeds 30 minutes. Return `user_id`, `ts`, `page`, `session_no` (1, 2, … per user) and `visit_no` (position within the session).'),
      hints: ['Flag = 1 when `lag(ts)` is null or the gap in seconds > 1800; `session_no = sum(flag)` over a running frame; `visit_no = row_number()` over (user, session).'],
      schema: { clicks: 'user_id INTEGER User, ts TIMESTAMP When, page VARCHAR Page' },
      solution: code`def solve(spark, clicks):
    w = Window.partitionBy("user_id").orderBy("ts")
    running = w.rowsBetween(Window.unboundedPreceding, Window.currentRow)
    gap = F.unix_timestamp("ts") - F.unix_timestamp(F.lag("ts").over(w))
    flagged = clicks.withColumn("new", F.when(gap.isNull() | (gap > 1800), 1).otherwise(0))
    sessions = flagged.withColumn("session_no", F.sum("new").over(running))
    visit = F.row_number().over(Window.partitionBy("user_id", "session_no").orderBy("ts"))
    return sessions.withColumn("visit_no", visit).select("user_id", "ts", "page", "session_no", "visit_no")
`,
      explanation: 'Sessionization is gaps-and-islands on time: mark where a session starts, then a running sum of the marks numbers the sessions. Exactly 30 minutes apart stays in the same session here — the boundary is part of the definition.',
      tests: [
        { name: 'Example', tables: { clicks: [[1, '2024-01-01 10:00:00', 'home'], [1, '2024-01-01 10:20:00', 'cart'], [1, '2024-01-01 11:00:00', 'home'], [1, '2024-01-01 11:05:00', 'pay'], [2, '2024-01-01 10:00:00', 'home']] } },
        { name: 'Exactly 30 minutes', hidden: true, tables: { clicks: [[3, '2024-01-01 10:00:00', 'a'], [3, '2024-01-01 10:30:00', 'b'], [3, '2024-01-01 11:00:01', 'c']] } },
        { name: 'Unsorted input', hidden: true, tables: { clicks: [[4, '2024-01-01 12:00:00', 'x'], [4, '2024-01-01 09:00:00', 'y']] } },
      ],
    }),

    pyspark({
      id: 'spark-session-summary', title: 'Session Start, End and Event Counts', difficulty: 'Hard',
      topics: ['Sessionization', 'Window Functions', 'Aggregation'], patterns: ['Sessionize then aggregate'], domains: ['Web analytics'], roles: DE_DA,
      ...tag(sp('Nielsen', 'User Sessionization with Time')),
      summary: 'Summarise each user session: start, end, duration and number of events.',
      description: md('Sessions break after more than 20 minutes of inactivity. Return `user_id`, `session_no`, `start_ts`, `end_ts`, `events`, `duration_min` (end − start in minutes, rounded to 1).'),
      hints: ['Sessionize with a gap flag and running sum, then group by (user, session).'],
      schema: { events: 'user_id INTEGER User, ts TIMESTAMP When, event VARCHAR Event' },
      solution: code`def solve(spark, events):
    w = Window.partitionBy("user_id").orderBy("ts")
    gap = F.unix_timestamp("ts") - F.unix_timestamp(F.lag("ts").over(w))
    s = (events.withColumn("new", F.when(gap.isNull() | (gap > 1200), 1).otherwise(0))
         .withColumn("session_no", F.sum("new").over(w.rowsBetween(Window.unboundedPreceding, Window.currentRow))))
    agg = s.groupBy("user_id", "session_no").agg(F.min("ts").alias("start_ts"), F.max("ts").alias("end_ts"), F.count("*").alias("events"))
    return agg.withColumn("duration_min", F.round((F.unix_timestamp("end_ts") - F.unix_timestamp("start_ts")) / 60, 1))
`,
      explanation: 'Once events carry a session number, every session metric is an ordinary aggregation. A one-event session has a duration of 0 — decide whether to report it that way or attribute a default dwell time.',
      tests: [
        { name: 'Example', tables: { events: [[1, '2024-01-01 10:00:00', 'view'], [1, '2024-01-01 10:10:00', 'click'], [1, '2024-01-01 11:00:00', 'view'], [2, '2024-01-01 09:00:00', 'view']] } },
        { name: 'Long single session', hidden: true, tables: { events: [[3, '2024-01-01 00:00:00', 'a'], [3, '2024-01-01 00:15:00', 'b'], [3, '2024-01-01 00:30:00', 'c']] } },
        { name: 'Many short sessions', hidden: true, tables: { events: [[4, '2024-01-01 00:00:00', 'a'], [4, '2024-01-01 01:00:00', 'b'], [4, '2024-01-01 02:00:00', 'c']] } },
      ],
    }),

    pyspark({
      id: 'spark-attendance-streaks', title: 'Longest Consecutive Attendance Streak', difficulty: 'Hard',
      topics: ['Gaps & Islands', 'Window Functions', 'Date & Time'], patterns: ['date − row_number islands'], domains: ['HR / People'], roles: DE_DA,
      ...tag(sp('PayPal', 'Employee Attendance Streaks')),
      summary: 'Each employee\'s longest run of consecutive present days.',
      description: md('Using days with `status = "present"` (deduplicated), return `emp_id`, `longest_streak`, `streak_start`, `streak_end` for each employee\'s longest run of consecutive calendar days (earliest run on ties).'),
      hints: ['For consecutive days, `date_sub(day, row_number)` is constant — group by it.'],
      schema: { attendance: 'emp_id INTEGER Employee, day DATE Day, status VARCHAR Status' },
      solution: code`def solve(spark, attendance):
    days = attendance.filter(F.col("status") == "present").select("emp_id", "day").distinct()
    rn = F.row_number().over(Window.partitionBy("emp_id").orderBy("day"))
    islands = days.withColumn("grp", F.date_sub("day", rn))
    runs = islands.groupBy("emp_id", "grp").agg(F.count("*").alias("longest_streak"), F.min("day").alias("streak_start"), F.max("day").alias("streak_end"))
    best = Window.partitionBy("emp_id").orderBy(F.desc("longest_streak"), "streak_start")
    return runs.withColumn("r", F.row_number().over(best)).filter("r = 1").select("emp_id", "longest_streak", "streak_start", "streak_end")
`,
      explanation: 'Subtracting an increasing row number from consecutive dates gives the same value for the whole run — the classic islands key. Deduplicating days first keeps double check-ins from breaking the arithmetic.',
      tests: [
        { name: 'Example', tables: { attendance: [[1, '2024-01-01', 'present'], [1, '2024-01-02', 'present'], [1, '2024-01-03', 'present'], [1, '2024-01-05', 'present'], [1, '2024-01-04', 'absent'], [2, '2024-01-01', 'present']] } },
        { name: 'Tie keeps the earliest run', hidden: true, tables: { attendance: [[3, '2024-02-01', 'present'], [3, '2024-02-02', 'present'], [3, '2024-02-10', 'present'], [3, '2024-02-11', 'present']] } },
        { name: 'Duplicate check-ins', hidden: true, tables: { attendance: [[4, '2024-03-01', 'present'], [4, '2024-03-01', 'present'], [4, '2024-03-02', 'present']] } },
      ],
    }),

    pyspark({
      id: 'spark-merge-bookings', title: 'Merge Overlapping Room Bookings', difficulty: 'Hard',
      topics: ['Gaps & Islands', 'Window Functions'], patterns: ['Running max end + new-block flag'], domains: ['Scheduling'], roles: DE,
      summary: 'Collapse overlapping or touching bookings into continuous busy blocks per room.',
      description: md('Bookings `[room, start_ts, end_ts]` may overlap. Merge overlapping or touching ones per room and return `room`, `block_start`, `block_end`, `bookings` (how many were merged).'),
      hints: ['Sort by start; the running **max** of previous ends tells whether the current booking starts a new block (`start > prev_max_end`).', 'Running sum of the new-block flag numbers the blocks.'],
      schema: { bookings: 'booking_id INTEGER Booking, room VARCHAR Room, start_ts TIMESTAMP Start, end_ts TIMESTAMP End' },
      solution: code`def solve(spark, bookings):
    w = Window.partitionBy("room").orderBy("start_ts", "end_ts")
    prev_max = F.max("end_ts").over(w.rowsBetween(Window.unboundedPreceding, -1))
    flagged = bookings.withColumn("new", F.when(prev_max.isNull() | (F.col("start_ts") > prev_max), 1).otherwise(0))
    blocks = flagged.withColumn("block", F.sum("new").over(w.rowsBetween(Window.unboundedPreceding, Window.currentRow)))
    return blocks.groupBy("room", "block").agg(
        F.min("start_ts").alias("block_start"), F.max("end_ts").alias("block_end"), F.count("*").alias("bookings")
    ).drop("block")
`,
      explanation: 'Comparing with the previous row\'s end isn\'t enough when a long booking contains several short ones; the running maximum of all earlier ends is. This is interval merging expressed with windows.',
      tests: [
        { name: 'Example', tables: { bookings: [[1, 'A', '2024-01-01 09:00:00', '2024-01-01 10:00:00'], [2, 'A', '2024-01-01 09:30:00', '2024-01-01 11:00:00'], [3, 'A', '2024-01-01 11:00:00', '2024-01-01 11:30:00'], [4, 'A', '2024-01-01 13:00:00', '2024-01-01 14:00:00'], [5, 'B', '2024-01-01 09:00:00', '2024-01-01 09:15:00']] } },
        { name: 'Nested booking', hidden: true, tables: { bookings: [[1, 'C', '2024-01-01 08:00:00', '2024-01-01 18:00:00'], [2, 'C', '2024-01-01 09:00:00', '2024-01-01 10:00:00'], [3, 'C', '2024-01-01 17:00:00', '2024-01-01 19:00:00']] } },
        { name: 'No overlaps', hidden: true, tables: { bookings: [[1, 'D', '2024-01-01 08:00:00', '2024-01-01 09:00:00'], [2, 'D', '2024-01-01 09:01:00', '2024-01-01 10:00:00']] } },
      ],
    }),

    pyspark({
      id: 'spark-charging-sessions', title: 'Pair Start/Stop Events into Charging Sessions', difficulty: 'Hard',
      topics: ['Window Functions', 'Sessionization'], patterns: ['Pair events with lead'], domains: ['IoT / Telemetry'], roles: DE,
      ...tag(sp('Amazon', 'EV Charger Utilization')),
      summary: 'Match each start with the next stop per charger and total charging hours.',
      description: md('Events are `[charger_id, ts, event]` with event `start` or `stop`. A session is a `start` immediately followed (per charger, in time order) by a `stop`; unmatched events are ignored. Return `charger_id`, `sessions`, `hours` (total, rounded to 2).'),
      hints: ['`lead("event")` and `lead("ts")`; keep `start` rows whose next event is `stop`.'],
      schema: { charger_events: 'charger_id INTEGER Charger, ts TIMESTAMP When, event VARCHAR start · stop' },
      solution: code`def solve(spark, charger_events):
    w = Window.partitionBy("charger_id").orderBy("ts")
    e = charger_events.withColumn("next_event", F.lead("event").over(w)).withColumn("next_ts", F.lead("ts").over(w))
    s = e.filter((F.col("event") == "start") & (F.col("next_event") == "stop"))
    hours = (F.unix_timestamp("next_ts") - F.unix_timestamp("ts")) / 3600
    return s.groupBy("charger_id").agg(F.count("*").alias("sessions"), F.round(F.sum(hours), 2).alias("hours"))
`,
      explanation: 'Pairing events by looking one row ahead is robust to duplicates and missing events: a start followed by another start simply doesn\'t pair. Device logs are rarely clean, so the "ignore unmatched" rule belongs in the spec.',
      tests: [
        { name: 'Example', tables: { charger_events: [[1, '2024-01-01 08:00:00', 'start'], [1, '2024-01-01 09:30:00', 'stop'], [1, '2024-01-01 12:00:00', 'start'], [1, '2024-01-01 12:45:00', 'stop'], [2, '2024-01-01 10:00:00', 'start']] } },
        { name: 'Double start', hidden: true, tables: { charger_events: [[3, '2024-01-01 00:00:00', 'start'], [3, '2024-01-01 01:00:00', 'start'], [3, '2024-01-01 02:00:00', 'stop']] } },
        { name: 'Stop without start', hidden: true, tables: { charger_events: [[4, '2024-01-01 00:00:00', 'stop'], [4, '2024-01-01 01:00:00', 'start'], [4, '2024-01-01 01:30:00', 'stop']] } },
      ],
    }),

    pyspark({
      id: 'spark-duplicate-fares', title: 'Flag Retried Fare Charges', difficulty: 'Medium',
      topics: ['Window Functions', 'Deduplication'], patterns: ['lag within a time window'], domains: ['Payments'], roles: DE,
      ...tag(sp('Stripe', 'Duplicate Ride Fares')),
      summary: 'A charge repeated for the same rider and amount within 10 minutes is a retry; total the refunds.',
      description: md('Per rider and amount, a charge within 10 minutes (≤ 600 s) of the previous identical charge is a duplicate. Return `rider_id`, `duplicates`, `refund` (sum of duplicate amounts, rounded to 2) for riders with at least one duplicate.'),
      hints: ['Partition by (rider, amount), order by time, compare with `lag(ts)`.', 'A window expression can\'t go straight into `filter` — add it as a column first.'],
      schema: { charges: 'charge_id INTEGER Charge, rider_id INTEGER Rider, amount DOUBLE Amount, charged_at TIMESTAMP When' },
      solution: code`def solve(spark, charges):
    w = Window.partitionBy("rider_id", "amount").orderBy("charged_at")
    gap = F.unix_timestamp("charged_at") - F.unix_timestamp(F.lag("charged_at").over(w))
    dupes = charges.withColumn("gap", gap).filter(F.col("gap") <= 600)
    return dupes.groupBy("rider_id").agg(F.count("*").alias("duplicates"), F.round(F.sum("amount"), 2).alias("refund"))
`,
      explanation: 'Partitioning by the identity of a charge (rider + amount) and checking the time since the previous identical charge catches retries without self-joins. Each retry is measured against the one just before it, so a burst of three counts two duplicates.',
      tests: [
        { name: 'Example', tables: { charges: [[1, 7, 12.5, '2024-01-01 10:00:00'], [2, 7, 12.5, '2024-01-01 10:05:00'], [3, 7, 12.5, '2024-01-01 10:30:00'], [4, 7, 8.0, '2024-01-01 10:06:00'], [5, 8, 3.0, '2024-01-01 10:00:00']] } },
        { name: 'Burst of three', hidden: true, tables: { charges: [[1, 9, 5.0, '2024-01-01 00:00:00'], [2, 9, 5.0, '2024-01-01 00:01:00'], [3, 9, 5.0, '2024-01-01 00:02:00']] } },
        { name: 'Exactly ten minutes counts', hidden: true, tables: { charges: [[1, 1, 1.0, '2024-01-01 00:00:00'], [2, 1, 1.0, '2024-01-01 00:10:00']] } },
      ],
    }),

    pyspark({
      id: 'spark-new-vs-returning', title: 'Daily New vs Returning Users', difficulty: 'Medium',
      topics: ['Window Functions', 'Aggregation', 'Funnels & Retention'], patterns: ['First-seen date per user'], domains: ['Product analytics'], roles: DE_DA,
      ...tag(sp('IBM', 'Daily New vs Returning Users')),
      ordered: true,
      summary: 'Split each day\'s active users into new and returning, with a running total of users acquired.',
      description: md('A user is **new** on the day of their first activity, **returning** on later active days. Return `day`, `new_users`, `returning_users`, `cumulative_users` (running total of new users), ordered by day.'),
      hints: ['`F.min("day").over(Window.partitionBy("user_id"))` gives each user\'s first day; dedupe (user, day) first.'],
      schema: { activity: 'user_id INTEGER User, active_at TIMESTAMP When' },
      solution: code`def solve(spark, activity):
    days = activity.select("user_id", F.to_date("active_at").alias("day")).distinct()
    first = days.withColumn("first_day", F.min("day").over(Window.partitionBy("user_id")))
    daily = first.groupBy("day").agg(
        F.sum(F.when(F.col("day") == F.col("first_day"), 1).otherwise(0)).alias("new_users"),
        F.sum(F.when(F.col("day") > F.col("first_day"), 1).otherwise(0)).alias("returning_users"))
    running = Window.orderBy("day").rowsBetween(Window.unboundedPreceding, Window.currentRow)
    return daily.withColumn("cumulative_users", F.sum("new_users").over(running)).orderBy("day")
`,
      explanation: 'Attaching each user\'s first-seen date with a window turns "new vs returning" into a simple comparison. Deduplicating to (user, day) first means several sessions in a day count once.',
      tests: [
        { name: 'Example', tables: { activity: [[1, '2024-01-01 09:00:00'], [1, '2024-01-01 18:00:00'], [2, '2024-01-01 10:00:00'], [1, '2024-01-02 09:00:00'], [3, '2024-01-02 09:00:00'], [2, '2024-01-04 09:00:00']] } },
        { name: 'One user', hidden: true, tables: { activity: [[9, '2024-02-01 00:00:00'], [9, '2024-02-05 00:00:00']] } },
        { name: 'All new on one day', hidden: true, tables: { activity: [[1, '2024-03-01 00:00:00'], [2, '2024-03-01 00:00:00']] } },
      ],
    }),

    pyspark({
      id: 'spark-etl-job-stats', title: 'ETL Job Run Statistics', difficulty: 'Hard',
      topics: ['Window Functions', 'Aggregation', 'Joins'], patterns: ['Latest status + failure counts'], domains: ['Platform / Ops'], roles: DE,
      ...tag(sp('Amazon', 'ETL Job Statistics')),
      summary: 'Per job: last run date, latest status, failure count and failure streak at the end.',
      description: md('Return per job (from `jobs`, including jobs never run): `job_name`, `last_run` (latest `run_ts`, null if never), `latest_status`, `failures` (total failed runs), `consecutive_failures` (number of failures since the most recent success, counting from the latest run backwards; all failures if there was never a success).'),
      hints: ['`max_by(status, run_ts)` for the latest status; consecutive failures = failed runs after the last success time.'],
      schema: { jobs: 'job_id INTEGER Job, job_name VARCHAR Name', runs: 'run_id INTEGER Run, job_id INTEGER Job, run_ts TIMESTAMP When, status VARCHAR success · failed' },
      solution: code`def solve(spark, jobs, runs):
    last_ok = runs.filter(F.col("status") == "success").groupBy("job_id").agg(F.max("run_ts").alias("last_ok"))
    r = runs.join(last_ok, "job_id", "left")
    after_ok = (F.col("status") == "failed") & (F.col("last_ok").isNull() | (F.col("run_ts") > F.col("last_ok")))
    stats = r.groupBy("job_id").agg(
        F.max("run_ts").alias("last_run"),
        F.max_by("status", "run_ts").alias("latest_status"),
        F.sum(F.when(F.col("status") == "failed", 1).otherwise(0)).alias("failures"),
        F.sum(F.when(after_ok, 1).otherwise(0)).alias("consecutive_failures"),
    )
    joined = jobs.join(stats, "job_id", "left")
    return joined.select("job_name", "last_run", "latest_status",
                         F.coalesce(F.col("failures"), F.lit(0)).alias("failures"),
                         F.coalesce(F.col("consecutive_failures"), F.lit(0)).alias("consecutive_failures"))
`,
      explanation: '"Failures since the last success" is the alerting metric that matters (one flaky run vs a broken job). Left-joining from the job catalogue keeps jobs that never ran visible — they are often the real problem.',
      tests: [
        { name: 'Example', tables: { jobs: [[1, 'ingest'], [2, 'dq'], [3, 'export']], runs: [[1, 1, '2024-01-01 01:00:00', 'success'], [2, 1, '2024-01-02 01:00:00', 'failed'], [3, 1, '2024-01-03 01:00:00', 'failed'], [4, 2, '2024-01-01 02:00:00', 'failed'], [5, 2, '2024-01-02 02:00:00', 'success']] } },
        { name: 'Never succeeded', hidden: true, tables: { jobs: [[1, 'x']], runs: [[1, 1, '2024-01-01 00:00:00', 'failed'], [2, 1, '2024-01-02 00:00:00', 'failed']] } },
        { name: 'All successful', hidden: true, tables: { jobs: [[1, 'y']], runs: [[1, 1, '2024-01-01 00:00:00', 'success']] } },
      ],
    }),
  ],
};
