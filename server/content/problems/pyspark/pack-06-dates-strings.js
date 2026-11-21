// PySpark pack 6 — dates, strings and regex: datediff / months_between,
// date_trunc, parsing several formats, active-period overlap, word counts with
// split + explode, palindromes, PII masking with regexp_replace, URL parameter
// extraction, keyword classification without UDFs, and year-over-year growth.
import { pyspark, md, code } from './define.js';
import { sp } from '../sql/define.js';
import { tag } from '../python/sources.js';

const DE = ['Data Engineer'];
const DE_DA = ['Data Engineer', 'Data Analyst'];

export default {
  problems: [
    pyspark({
      id: 'spark-word-count', title: 'Word Count with DataFrames', difficulty: 'Medium',
      topics: ['Strings & Regex', 'Aggregation'], patterns: ['split → explode → count'], domains: ['Search & text'], roles: DE,
      ...tag(sp('Google', 'Word Count Program (Part 2)')),
      summary: 'Clean text lines, split them into words and count each word — the classic Spark exercise.',
      description: md('Lowercase each line, replace every character that isn\'t a letter, digit or space with a space, split on whitespace, drop empty tokens, and return `word`, `count` for words appearing at least twice.'),
      hints: ['`F.regexp_replace(F.lower("line"), "[^a-z0-9 ]", " ")`, then `F.explode(F.split(clean, "\\\\s+"))`.'],
      schema: { lines: 'line_no INTEGER Line number, line VARCHAR Text' },
      solution: code`def solve(spark, lines):
    clean = F.regexp_replace(F.lower("line"), "[^a-z0-9 ]", " ")
    words = lines.select(F.explode(F.split(F.trim(clean), r"\s+")).alias("word")).filter(F.col("word") != "")
    return words.groupBy("word").agg(F.count("*").alias("count")).filter(F.col("count") >= 2)
`,
      explanation: '`explode` turns an array into rows — after that, word count is an ordinary `groupBy`. Normalising before splitting keeps "Spark," and "spark" as one word. (The RDD version is `flatMap` + `reduceByKey`; DataFrames get the optimiser for free.)',
      tests: [
        { name: 'Example', tables: { lines: [[1, 'Spark is fast. Spark is fun!'], [2, 'Is it? Yes, spark.']] } },
        { name: 'Nothing repeats', hidden: true, tables: { lines: [[1, 'one two three']] } },
        { name: 'Punctuation and spacing', hidden: true, tables: { lines: [[1, '  data--data   DATA '], [2, '']] } },
      ],
    }),

    pyspark({
      id: 'spark-palindrome-words', title: 'Find Palindromic Words', difficulty: 'Medium',
      topics: ['Strings & Regex', 'Complex Types (Arrays / Structs)'], patterns: ['explode + reverse'], domains: ['Search & text'], roles: DE_DA,
      ...tag(sp('HiLabs', 'Palindrome Words')),
      summary: 'List the distinct palindromic words (3+ letters) in each document.',
      description: md('For each document, split `body` into words (letters only, lowercased), and return `doc_id`, `word` for each distinct word of at least 3 letters that reads the same backwards.'),
      hints: ['`F.reverse(col)` reverses a string; `F.length` filters short words.'],
      schema: { docs: 'doc_id INTEGER Document, body VARCHAR Text' },
      solution: code`def solve(spark, docs):
    words = docs.select("doc_id", F.explode(F.split(F.lower(F.regexp_replace("body", "[^A-Za-z]+", " ")), " ")).alias("word"))
    return (words.filter((F.length("word") >= 3) & (F.col("word") == F.reverse("word")))
            .select("doc_id", "word").distinct())
`,
      explanation: 'Replacing every non-letter run with one space before splitting gives clean tokens. `distinct` after the filter removes repeats within a document.',
      tests: [
        { name: 'Example', tables: { docs: [[1, 'Level up, racecar! Wow: a radar at noon.'], [2, 'Nothing here']] } },
        { name: 'Two-letter words ignored', hidden: true, tables: { docs: [[3, 'aa bb ccc']] } },
        { name: 'Repeats collapse', hidden: true, tables: { docs: [[4, 'kayak KAYAK Kayak']] } },
      ],
    }),

    pyspark({
      id: 'spark-mask-pii', title: 'Anonymise Posts and Extract Email Domains', difficulty: 'Medium',
      topics: ['Strings & Regex'], patterns: ['regexp_replace / regexp_extract'], domains: ['Privacy / PII'], roles: DE,
      summary: 'Mask emails and phone numbers in free text and keep only the email domain for analytics.',
      description: md('Return `post_id`, `masked` (every email replaced by `"[email]"`, every 10-digit phone number by `"[phone]"`) and `email_domain` (lowercased domain of the first email in the text, or null).'),
      hints: ['`F.regexp_extract(col, pattern, 1)` returns `""` when there is no match — turn that into null with `F.when(x != "", x)`.'],
      schema: { posts: 'post_id INTEGER Post, body VARCHAR Text' },
      solution: code`EMAIL = r"[\w.+-]+@([\w-]+\.[\w.-]+)"
PHONE = r"\b\d{10}\b"

def solve(spark, posts):
    masked = F.regexp_replace(F.regexp_replace("body", EMAIL, "[email]"), PHONE, "[phone]")
    domain = F.lower(F.regexp_extract("body", EMAIL, 1))
    return posts.select("post_id", masked.alias("masked"), F.when(domain != "", domain).alias("email_domain"))
`,
      explanation: 'Masking at ingestion keeps raw PII out of downstream tables, while the extracted domain still supports analytics (e.g. "share of corporate emails"). `regexp_extract` returns an empty string on no match, unlike Python\'s `None`.',
      tests: [
        { name: 'Example', tables: { posts: [[1, 'Mail ana@Corp.com or call 9876543210'], [2, 'no contact info']] } },
        { name: 'Two emails', hidden: true, tables: { posts: [[3, 'x@a.io and y@b.io']] } },
        { name: 'Nine digits is not a phone', hidden: true, tables: { posts: [[4, 'id 123456789']] } },
      ],
    }),

    pyspark({
      id: 'spark-utm-params', title: 'Extract UTM Parameters from Landing URLs', difficulty: 'Medium',
      topics: ['Strings & Regex', 'Aggregation'], patterns: ['Regex capture groups'], domains: ['Marketing / CRM'], roles: DE_DA,
      summary: 'Pull utm_source and utm_campaign out of URLs and count sessions per source.',
      description: md('Extract `utm_source` and `utm_campaign` query parameters (case-insensitive values, lowercased) from `landing_url`; missing parameters are `"(none)"`. Return `utm_source`, `utm_campaign`, `sessions`.'),
      hints: ['`F.regexp_extract(url, r"[?&]utm_source=([^&#]+)", 1)`.'],
      schema: { sessions: 'session_id INTEGER Session, landing_url VARCHAR URL' },
      solution: code`def param(name):
    v = F.lower(F.regexp_extract("landing_url", rf"[?&]{name}=([^&#]+)", 1))
    return F.when(v != "", v).otherwise("(none)")

def solve(spark, sessions):
    return (sessions.select(param("utm_source").alias("utm_source"), param("utm_campaign").alias("utm_campaign"))
            .groupBy("utm_source", "utm_campaign").agg(F.count("*").alias("sessions")))
`,
      explanation: 'Anchoring on `[?&]` avoids matching a parameter whose name merely ends in `utm_source`; stopping at `&` or `#` handles the rest of the URL. A small Python helper that returns a Column keeps repeated expressions readable.',
      tests: [
        { name: 'Example', tables: { sessions: [[1, 'https://x.io/?utm_source=Google&utm_campaign=Spring'], [2, 'https://x.io/p?a=1&utm_source=google&utm_campaign=spring#top'], [3, 'https://x.io/']] } },
        { name: 'Only a source', hidden: true, tables: { sessions: [[1, 'https://x.io/?utm_source=news']] } },
        { name: 'Look-alike parameter', hidden: true, tables: { sessions: [[1, 'https://x.io/?xutm_source=fake&utm_source=real']] } },
      ],
    }),

    pyspark({
      id: 'spark-review-sentiment', title: 'Classify Reviews by Keywords (No UDF)', difficulty: 'Hard',
      topics: ['Strings & Regex', 'Column Expressions', 'Aggregation'], patterns: ['Keyword rules with rlike'], domains: ['Retail'], roles: DE_DA,
      ...tag(sp('Target', 'Analyze Review Sentiment')),
      summary: 'Label reviews positive / negative / neutral with built-in functions instead of a Python UDF, then summarise per product.',
      description: md(
        'A review is `negative` if it contains any of *bad, broken, terrible, refund* (whole words, case-insensitive), else `positive` if it contains *great, love, excellent*, else `neutral`. Return per `product_id`: `reviews`, `positive`, `negative`, `neutral`.',
        '',
        'In Spark a Python UDF works but serialises every row to Python; built-in `rlike` stays in the JVM (and UDFs aren\'t available in this sandbox).',
      ),
      hints: ['Whole-word, case-insensitive regex: `(?i)\\b(bad|broken|terrible|refund)\\b`.'],
      schema: { reviews: 'review_id INTEGER Review, product_id INTEGER Product, text VARCHAR Review text' },
      solution: code`NEG = r"(?i)\b(bad|broken|terrible|refund)\b"
POS = r"(?i)\b(great|love|excellent)\b"

def solve(spark, reviews):
    label = F.when(F.col("text").rlike(NEG), "negative").when(F.col("text").rlike(POS), "positive").otherwise("neutral")
    df = reviews.withColumn("label", label)
    count = lambda l: F.sum(F.when(F.col("label") == l, 1).otherwise(0)).alias(l)
    return df.groupBy("product_id").agg(F.count("*").alias("reviews"), count("positive"), count("negative"), count("neutral"))
`,
      explanation: 'Negative keywords are checked first so "great but broken" counts as negative — rule order is a product decision. Word boundaries stop "badge" from matching "bad".',
      tests: [
        { name: 'Example', tables: { reviews: [[1, 7, 'Great product, love it'], [2, 7, 'Arrived broken, want a refund'], [3, 7, 'It is ok'], [4, 8, 'Excellent!']] } },
        { name: 'Mixed review is negative', hidden: true, tables: { reviews: [[1, 9, 'great but BAD battery']] } },
        { name: 'Substring is not a word', hidden: true, tables: { reviews: [[1, 10, 'nice badge'], [2, 10, 'lovely colour']] } },
      ],
    }),

    pyspark({
      id: 'spark-workout-span', title: 'Days Between First and Last Workout', difficulty: 'Easy',
      topics: ['Date & Time', 'Aggregation'], patterns: ['datediff of min and max'], domains: ['Health & fitness'], roles: DE_DA,
      ...tag(sp('Meta', 'Workout Span')),
      summary: 'For each member, the number of days between their first and last 2024 workout.',
      description: md('Considering workouts in 2024 only, return `member_id`, `first_day`, `last_day`, `span_days` (`datediff(last, first)`) for members with at least two workout days.'),
      hints: ['`F.min`, `F.max` of the date, then `F.datediff`.'],
      schema: { workouts: 'member_id INTEGER Member, workout_ts TIMESTAMP When' },
      solution: code`def solve(spark, workouts):
    days = workouts.select("member_id", F.to_date("workout_ts").alias("day")).filter(F.year("day") == 2024)
    return (days.groupBy("member_id")
            .agg(F.min("day").alias("first_day"), F.max("day").alias("last_day"), F.countDistinct("day").alias("n"))
            .filter(F.col("n") >= 2)
            .select("member_id", "first_day", "last_day", F.datediff("last_day", "first_day").alias("span_days")))
`,
      explanation: '`datediff(end, start)` counts whole days (end first!). Filtering on distinct days excludes members who only trained on a single day, even several times.',
      tests: [
        { name: 'Example', tables: { workouts: [[1, '2024-01-03 07:00:00'], [1, '2024-03-01 07:00:00'], [1, '2023-12-31 07:00:00'], [2, '2024-05-05 07:00:00'], [2, '2024-05-05 19:00:00']] } },
        { name: 'Leap year span', hidden: true, tables: { workouts: [[3, '2024-02-28 00:00:00'], [3, '2024-03-01 00:00:00']] } },
        { name: 'Whole year', hidden: true, tables: { workouts: [[4, '2024-01-01 00:00:00'], [4, '2024-12-31 23:59:59']] } },
      ],
    }),

    pyspark({
      id: 'spark-monthly-hotel-ratings', title: 'Monthly Average Ratings per Hotel', difficulty: 'Easy',
      topics: ['Date & Time', 'Aggregation', 'Data Quality'], patterns: ['Filter invalid values then group by month'], domains: ['Travel'], roles: DE_DA,
      ...tag(sp('Amazon', 'Monthly Hotel Ratings')),
      summary: 'Average 1–5 star ratings by hotel and month, ignoring invalid star values.',
      description: md('Ratings outside 1–5 (or null) are invalid and ignored. Return `hotel_id`, `month` (`yyyy-MM` string), `avg_stars` (rounded to 2), `ratings`.'),
      hints: ['`F.date_format("reviewed_on", "yyyy-MM")` for the month label.'],
      schema: { ratings: 'rating_id INTEGER Rating, hotel_id INTEGER Hotel, reviewed_on DATE Date, stars INTEGER Stars' },
      solution: code`def solve(spark, ratings):
    valid = ratings.filter(F.col("stars").between(1, 5))
    return (valid.groupBy("hotel_id", F.date_format("reviewed_on", "yyyy-MM").alias("month"))
            .agg(F.round(F.avg("stars"), 2).alias("avg_stars"), F.count("*").alias("ratings")))
`,
      explanation: 'Range-checking before aggregating is a basic data-quality gate; a single 0-star or 50-star typo would otherwise skew a small month.',
      tests: [
        { name: 'Example', tables: { ratings: [[1, 1, '2024-01-05', 5], [2, 1, '2024-01-20', 4], [3, 1, '2024-01-21', 0], [4, 1, '2024-02-01', 3], [5, 2, '2024-01-01', null]] } },
        { name: 'Only invalid', hidden: true, tables: { ratings: [[1, 3, '2024-01-01', 6]] } },
        { name: 'Rounding', hidden: true, tables: { ratings: [[1, 4, '2024-06-01', 5], [2, 4, '2024-06-02', 4], [3, 4, '2024-06-03', 4]] } },
      ],
    }),

    pyspark({
      id: 'spark-active-watch-time', title: 'Watch Time Within Active Subscriptions', difficulty: 'Hard',
      topics: ['Joins', 'Date & Time'], patterns: ['Join with a between condition'], domains: ['Streaming / Media'], roles: DE_DA,
      summary: 'Credit viewing minutes only when they happened during one of the user\'s active subscription periods.',
      description: md('Return `user_id` and `active_minutes` — total minutes from `views` whose `view_date` falls within any subscription period of that user (`start_date` to `end_date` inclusive; null end = still active). Users with no qualifying views are omitted. Periods don\'t overlap.'),
      hints: ['Join on user and `view_date` between start and `coalesce(end_date, view_date)`.'],
      schema: { subscriptions: 'user_id INTEGER User, start_date DATE Start, end_date DATE End', views: 'view_id INTEGER View, user_id INTEGER User, view_date DATE Date, minutes INTEGER Minutes' },
      solution: code`def solve(spark, subscriptions, views):
    s, v = subscriptions.alias("s"), views.alias("v")
    cond = ((F.col("s.user_id") == F.col("v.user_id"))
            & (F.col("v.view_date") >= F.col("s.start_date"))
            & (F.col("v.view_date") <= F.coalesce(F.col("s.end_date"), F.col("v.view_date"))))
    return (v.join(s, cond)
            .groupBy(F.col("v.user_id").alias("user_id"))
            .agg(F.sum("v.minutes").alias("active_minutes")))
`,
      explanation: 'A range join attributes each event to the period containing it; because periods don\'t overlap, each view matches at most once. `coalesce(end, view_date)` turns an open-ended period into "up to now".',
      tests: [
        { name: 'Example', tables: { subscriptions: [[1, '2024-01-01', '2024-01-31'], [1, '2024-03-01', null], [2, '2024-02-01', '2024-02-10']], views: [[1, 1, '2024-01-15', 30], [2, 1, '2024-02-15', 99], [3, 1, '2024-03-02', 20], [4, 2, '2024-02-10', 5], [5, 2, '2024-02-11', 50]] } },
        { name: 'No subscriptions', hidden: true, tables: { subscriptions: [], views: [[1, 1, '2024-01-01', 10]] } },
        { name: 'Boundaries inclusive', hidden: true, tables: { subscriptions: [[3, '2024-05-01', '2024-05-02']], views: [[1, 3, '2024-05-01', 1], [2, 3, '2024-05-02', 2], [3, 3, '2024-05-03', 4]] } },
      ],
    }),

    pyspark({
      id: 'spark-parse-mixed-dates', title: 'Parse Dates Written in Several Formats', difficulty: 'Medium',
      topics: ['Date & Time', 'Data Quality'], patterns: ['coalesce over guarded parses'], domains: ['Data quality'], roles: DE,
      summary: 'Normalise ISO, day-first and compact date strings into one date column.',
      description: md('`raw_date` is `yyyy-MM-dd`, `dd/MM/yyyy` or `yyyyMMdd`. Return `id`, `raw_date`, `parsed` (a date, null if no format applies). Match the shape with a regex first, then parse with `to_date(col, format)`, combining the alternatives with `coalesce`.'),
      hints: ['`F.when(F.col("raw_date").rlike(r"^\\d{2}/\\d{2}/\\d{4}$"), F.to_date("raw_date", "dd/MM/yyyy"))` — one branch per format, inside `F.coalesce(...)`.'],
      schema: { events: 'id INTEGER Id, raw_date VARCHAR Date text' },
      solution: code`FORMATS = [
    (r"^\d{4}-\d{2}-\d{2}$", "yyyy-MM-dd"),
    (r"^\d{2}/\d{2}/\d{4}$", "dd/MM/yyyy"),
    (r"^\d{8}$", "yyyyMMdd"),
]

def solve(spark, events):
    raw = F.trim("raw_date")
    parsed = F.coalesce(*[F.when(raw.rlike(rx), F.to_date(raw, fmt)) for rx, fmt in FORMATS])
    return events.select("id", "raw_date", parsed.alias("parsed"))
`,
      explanation: 'Guarding each parse with the format\'s shape makes intent explicit and prevents a lenient parser from misreading one format as another. `coalesce` takes the first non-null alternative.',
      tests: [
        { name: 'Example', tables: { events: [[1, '2024-03-05'], [2, '05/03/2024'], [3, '20240305'], [4, 'March 5']] } },
        { name: 'Spaces', hidden: true, tables: { events: [[5, ' 2023-12-31 ']] } },
        { name: 'Null input', hidden: true, tables: { events: [[6, null], [7, '01/01/2000']] } },
      ],
    }),

    pyspark({
      id: 'spark-yoy-growth', title: 'Year-over-Year GDP Growth', difficulty: 'Hard',
      topics: ['Window Functions', 'Column Expressions'], patterns: ['lag + growth classification'], domains: ['Economics'], roles: DE_DA,
      ...tag(sp('Wayfair', 'Compute Annual GDP Growth Rate')),
      summary: 'Compute each country\'s YoY growth rate and classify it.',
      description: md('Return `country`, `year`, `gdp`, `growth_pct` ((gdp − previous year\'s gdp) / previous × 100, rounded to 2) and `trend`: `"growth"` (> 0), `"decline"` (< 0), `"flat"` (= 0), `"n/a"` when there is no previous **consecutive** year.'),
      hints: ['Use `lag` on both `gdp` and `year`; only compute growth when the previous year equals `year - 1`.'],
      schema: { gdp: 'country VARCHAR Country, year INTEGER Year, gdp DOUBLE GDP (bn)' },
      solution: code`def solve(spark, gdp):
    w = Window.partitionBy("country").orderBy("year")
    df = gdp.withColumn("prev", F.lag("gdp").over(w)).withColumn("prev_year", F.lag("year").over(w))
    consecutive = F.col("prev_year") == F.col("year") - 1
    growth = F.when(consecutive, F.round((F.col("gdp") - F.col("prev")) / F.col("prev") * 100, 2))
    trend = (F.when(F.col("growth_pct").isNull(), "n/a")
              .when(F.col("growth_pct") > 0, "growth").when(F.col("growth_pct") < 0, "decline").otherwise("flat"))
    return df.withColumn("growth_pct", growth).withColumn("trend", trend).select("country", "year", "gdp", "growth_pct", "trend")
`,
      explanation: 'With missing years, the previous row is not the previous year — checking the lagged year avoids computing "growth" over a two-year gap.',
      tests: [
        { name: 'Example', tables: { gdp: [['IN', 2021, 3150.0], ['IN', 2022, 3390.0], ['IN', 2023, 3550.0], ['XY', 2021, 100.0], ['XY', 2022, 90.0]] } },
        { name: 'Gap in the years', hidden: true, tables: { gdp: [['ZZ', 2019, 10.0], ['ZZ', 2021, 12.0], ['ZZ', 2022, 12.0]] } },
        { name: 'Single year', hidden: true, tables: { gdp: [['AA', 2020, 1.0]] } },
      ],
    }),

    pyspark({
      id: 'spark-business-hours', title: 'Orders by Hour Band and Weekday', difficulty: 'Easy',
      topics: ['Date & Time', 'Aggregation'], patterns: ['Bucket timestamps'], domains: ['Food delivery'], roles: DE_DA,
      summary: 'Bucket order timestamps into dayparts and weekday/weekend and count orders.',
      description: md('Daypart from the hour: `breakfast` 6–10, `lunch` 11–15, `dinner` 17–22, otherwise `other`. Day type: `weekend` (Sat/Sun) or `weekday`. Return `day_type`, `daypart`, `orders`.'),
      hints: ['`F.hour(ts)` and `F.dayofweek(ts).isin(1, 7)`.'],
      schema: { orders: 'order_id INTEGER Order, placed_at TIMESTAMP Placed' },
      solution: code`def solve(spark, orders):
    h = F.hour("placed_at")
    daypart = (F.when(h.between(6, 10), "breakfast").when(h.between(11, 15), "lunch")
                .when(h.between(17, 22), "dinner").otherwise("other"))
    day_type = F.when(F.dayofweek("placed_at").isin(1, 7), "weekend").otherwise("weekday")
    return orders.groupBy(day_type.alias("day_type"), daypart.alias("daypart")).agg(F.count("*").alias("orders"))
`,
      explanation: 'Grouping by derived expressions avoids materialising helper columns. Note 16:00 falls into `other` — bucket boundaries are part of the spec.',
      tests: [
        { name: 'Example', tables: { orders: [[1, '2024-06-03 08:30:00'], [2, '2024-06-03 12:00:00'], [3, '2024-06-08 19:45:00'], [4, '2024-06-09 16:10:00'], [5, '2024-06-04 23:30:00']] } },
        { name: 'Boundaries', hidden: true, tables: { orders: [[1, '2024-06-05 10:59:00'], [2, '2024-06-05 11:00:00'], [3, '2024-06-05 22:59:00']] } },
        { name: 'Sunday breakfast', hidden: true, tables: { orders: [[1, '2024-06-09 07:00:00']] } },
      ],
    }),

    pyspark({
      id: 'spark-top-players-summary', title: 'Top Players Summary Line', difficulty: 'Hard',
      topics: ['Strings & Regex', 'Joins', 'Aggregation'], patterns: ['Aggregate, rank, format strings'], domains: ['Sports'], roles: DE_DA,
      ...tag(sp('ITC Infotech', 'Top Players Summary')),
      summary: 'Join players to match stats and build a formatted summary for each team\'s top scorer.',
      description: md('For each team, find the player with the most total `runs` (ties by name). Return `team` and `summary` formatted as `"<NAME IN CAPS> (<runs> runs, avg <avg>)"` where avg = runs / matches played, rounded to 1.'),
      hints: ['Aggregate per player, rank per team, then `F.concat` (or `format_string`) the pieces — cast numbers to string.'],
      schema: { players: 'player_id INTEGER Player, name VARCHAR Name, team VARCHAR Team', innings: 'player_id INTEGER Player, match_id INTEGER Match, runs INTEGER Runs' },
      solution: code`def solve(spark, players, innings):
    stats = innings.groupBy("player_id").agg(F.sum("runs").alias("runs"), F.countDistinct("match_id").alias("matches"))
    j = players.join(stats, "player_id")
    w = Window.partitionBy("team").orderBy(F.desc("runs"), "name")
    top = j.withColumn("rn", F.row_number().over(w)).filter("rn = 1")
    avg = F.round(F.col("runs") / F.col("matches"), 1)
    summary = F.concat(F.upper("name"), F.lit(" ("), F.col("runs").cast("string"), F.lit(" runs, avg "), avg.cast("string"), F.lit(")"))
    return top.select("team", summary.alias("summary"))
`,
      explanation: 'Do the numbers first (aggregate, rank), format last. `concat` needs strings, so cast numbers explicitly; any null piece makes the whole `concat` null (use `concat_ws` if you want nulls skipped).',
      tests: [
        { name: 'Example', tables: { players: [[1, 'Virat', 'IND'], [2, 'Rohit', 'IND'], [3, 'Joe', 'ENG']], innings: [[1, 10, 50], [1, 11, 70], [2, 10, 100], [3, 12, 33]] } },
        { name: 'Tie by name', hidden: true, tables: { players: [[1, 'Zed', 'X'], [2, 'Abe', 'X']], innings: [[1, 1, 10], [2, 1, 10]] } },
        { name: 'Average rounding', hidden: true, tables: { players: [[1, 'Kim', 'K']], innings: [[1, 1, 10], [1, 2, 10], [1, 3, 11]] } },
      ],
    }),
  ],
};
