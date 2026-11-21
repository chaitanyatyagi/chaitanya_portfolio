# DataDrill — Question Bank Research & Backlog

> Last updated: 2026-11-21 (Python packs 23–24, DSA track) · Companion to `docs/ARCHITECTURE.md` §8.12 (tags) and §13 (content pipeline).

This file records **what interviewers actually ask**, where that was reported, and which of those question *types* DataDrill already covers. Problems in DataDrill are **original** — new scenarios, data and wording written for this site. We never copy another site's statement, data or solution. A **company tag** is added only when a public source attributes that question type to the company, and the source URL is stored with the problem (`sources`), shown as the "Asked at" link, and enforced by `npm run verify:problems`.

## 1. Sources studied

| Source | What it gives | Used for |
|---|---|---|
| [DataLemur — SQL questions](https://datalemur.com/questions) | ~55 SQL questions, each attributed to a company (Meta, Amazon, Google, Uber, Twitter, Intuit, …) | SQL types + company tags |
| [SparkPlayground — PySpark coding questions](https://www.sparkplayground.com/pyspark-coding-interview-questions) | ~95 PySpark tasks, many attributed (Amazon, Walmart, Deloitte, Nielsen, VISA, Meta, Microsoft, Google, EPAM, PayPal, …) | PySpark types + company tags (also SQL/pandas equivalents) |
| [StrataScratch — pandas questions (part 2)](https://www.stratascratch.com/blog/python-pandas-interview-questions-for-data-science-part-2) | pandas questions attributed to Airbnb, Facebook, Amazon, Uber, Google, DoorDash, Salesforce | pandas types + company tags |
| [DEV — Meta data engineering interview topics](https://dev.to/gowthampotureddi/meta-data-engineering-interview-questions-top-topics-problems-solutions-304g) | Meta DE loop topics: aggregation, joins, windows, dates, set logic; Python hash maps, streaming & intervals | Python types + Meta tags |
| [DEV — 6 Python DE interview questions](https://dev.to/datadriven/the-6-python-data-engineering-interview-questions-you-will-actually-be-asked-in-2026-504j) | Streaming aggregation, dedup with tie-breaks, schema-tolerant parsing, sessions, backfills | Python types (no company attribution) |
| [Interview Query — DE SQL questions](https://www.interviewquery.com/p/data-engineer-sql-questions), [DataVidhya — 80 SQL DE questions](https://datavidhya.com/blog/sql-data-engineering-interview-questions/), [datadriven.io](https://datadriven.io/sql-interview-questions) | Frequency of topics (windows in >60% of SQL rounds, CTEs, dedup, anti-joins) | Prioritising which types to add first |
| [DataLemur — company blog pages](https://datalemur.com/blog/sql-interview-guide) (`datalemur.com/blog/<company>-sql-interview-questions`) | 8–11 real question types per company for ~40 companies (Netflix, Airbnb, Spotify, Salesforce, Adobe, Capital One, Amex, Mastercard, Goldman Sachs, Morgan Stanley, PayPal, Robinhood, Paytm, DoorDash, Instacart, eBay, Uber, Lyft, Microsoft, Tesla, NVIDIA, Intel, Dell, Cisco, HPE, Oracle, Shopify, Etsy, Twilio, Snowflake, Databricks, Pinterest, LinkedIn, Zomato, Ford, KPMG, EY, Discover, Progressive, Nasdaq, The Trade Desk…) | Company-attributed question types (packs 11–15) |
| [DEV — Walmart DE questions](https://dev.to/gowthampotureddi/walmart-data-engineering-interview-questions-mem), [GfG — Flipkart DE interview](https://www.geeksforgeeks.org/flipkart-interview-experience-for-data-engineer-1/), [Interview Query — Reddit DE guide](https://www.interviewquery.com/interview-guides/reddit-data-engineer) | Interview experiences / guides | Walmart SKU parsing, Reddit rolling retention; Flipkart (modelling + ETL, no specific queries published) |
| [gitgood — 50 Bash questions](https://gitgood.dev/blog/top-50-bash-shell-scripting-interview-questions-2026), [hyring — shell questions](https://hyring.com/jobseeker-toolkit/interview-questions/technical/shell-scripting), [Substack — 50 Bash questions](https://arvindverma021.substack.com/p/top-50-bash-scripting-interview-questions) | Log parsing, top-N IPs, awk group-bys, sort/uniq, CSV processing | Shell types (sources name no companies, so Shell has no company tags) |

| [DEV — 28 company DE guides](https://dev.to/gowthampotureddi) (Meta, Amazon, Uber, Airbnb, Microsoft, Google, Netflix, Databricks, Walmart, Stripe, Lyft, PayPal, Intuit, Cisco, Figma, Rivian, Bloomberg, Robinhood, Snowflake, Tesla, Roblox, Agoda, ByteDance, Atlassian, Oracle, Salesforce, Exodus Point, Techpath) | Each guide's "Python interview question on …" sections name the question type | Python types + company tags (`python/sources.js` → `dev()`) |
| [DataLemur — Python questions](https://datalemur.com/python-interview-questions) | ~50 algorithm questions, each with a company (Capital One, Microsoft, Amazon, Spotify, Google, Bloomberg, TikTok, Apple, Palantir, Tesla, Workday, Uber, Salesforce, Adobe, Walmart, Databricks, D.E. Shaw, AQR, Akuna Capital…) | `dlp()` |
| [datadriven.io — 415 Python DE questions](https://datadriven.io/python-interview-questions) | 20 worked questions, one per company (Meta, Netflix, Goldman Sachs, Nintendo, Visa, Notion, JPMorgan, LinkedIn, Salesforce, Coinbase, Capital One, Booking.com, Palantir, Lyft, DoorDash, Citadel, Amazon, Google, Uber, Airbnb) + concept frequencies (dicts 36 %, lists 48 %…) | `ddp()`; topic weighting |
| StrataScratch Python posts ([top 30](https://www.stratascratch.com/blog/top-30-python-interview-questions-and-answers), [data science](https://www.stratascratch.com/blog/python-data-science-interview-questions), [coding](https://www.stratascratch.com/blog/python-coding-interview-questions)) | Company-titled questions (Noom, Twitch, Google, DoorDash, Zillow, Lyft, Meta, Spotify, Box…) | `ss()` |
| [DataVidhya company guides](https://datavidhya.com/blog/microsoft-data-engineering-interview-guide/) | Sample Python round tasks (Microsoft: flatten nested `line_items` JSON) | `dv()` |
| GeeksforGeeks DE interview experiences (Paytm, EY, Amazon, Bajaj Finserv, Tiger Analytics, Deloitte, Accenture, Virtusa, Goldman Sachs, Morgan Stanley, Flipkart, LTIMindtree, Infosys, Sigmoid, Cognizant) | Concrete Python questions asked (anagrams, reverse words, git diff, running median, file handling, large CSVs, dummy ETL…) | `gfg()` |
| [Preplaced — JPMorgan DE interview](https://www.preplaced.in/blog/data-engineer-interview-experience-jp-morgan-chase) | Singleton class, decorators, replace characters in a list | `jpm()` |
| [Let's Data Science — company problem lists](https://letsdatascience.com/problems/companies) | Company-labelled Python problems (Target, Wayfair, Pinterest, Instacart, Shopify, Etsy, Snap, Verizon, FedEx, Reddit) | `lds()` — only where the type matches |
| GeeksforGeeks company-wise DSA lists — [Amazon](https://www.geeksforgeeks.org/amazon-sde-sheet-interview-questions-and-answers/), [Google](https://www.geeksforgeeks.org/google-sde-sheet-interview-questions-and-answers/), [Adobe](https://www.geeksforgeeks.org/interview-experiences/adobe-topics-interview-preparation/), [Goldman Sachs](https://www.geeksforgeeks.org/interview-experiences/goldman-sachs-topics-interview-preparation/), [Microsoft](https://www.geeksforgeeks.org/interview-experiences/microsoft-topics-interview-preparation/), [Flipkart](https://www.geeksforgeeks.org/interview-experiences/flipkart-topics-interview-preparation/), [Samsung](https://www.geeksforgeeks.org/interview-experiences/samsung-topics-interview-preparation/), [Walmart](https://www.geeksforgeeks.org/interview-prep/walmart-coding-interview-questions/) | Company-wise lists of coding-round questions by name | DSA company tags (`dsa/tags.js`): a problem is tagged only where its question type appears on that company's list |
| [Advanced Python playlist (181 videos)](https://www.youtube.com/playlist?list=PLI4OVrCFuY556CXnJal2pVbzhz0TOxwd_) | **Video titles only**, used as the syllabus checklist (see §2 "Python syllabus coverage") | Topic coverage of the Python track |

LinkedIn posts and Medium write-ups were also searched; several Medium articles (e.g. "Amazon PySpark questions", "Most asked Amazon DE questions 2025") returned 403 to our fetcher, so nothing from them is used as a source.

## 2. Coverage — what's in the bank (930 problems; SQL 178, Python 346, PySpark 119, DSA 277; 106 companies)

| Track | Problem (DataDrill, original) | Reported question type it covers | Company tags (source) |
|---|---|---|---|
| SQL | Daily Active Users | DAU / distinct count per day | — |
| SQL | Pages Nobody Liked | Anti-join, NOT IN + NULL trap | Meta (DataLemur "Page With No Likes") |
| SQL | Top Customers by Region | Top-N per group with ties | EPAM (SparkPlayground "Top Customers by Spend") |
| SQL | Each Rider's Third Ride | Nth event per user | Uber (DataLemur "User's Third Transaction") |
| SQL | Rolling Three-Day Average | Moving average | Twitter (X) (DataLemur "Tweets' Rolling Averages"; SparkPlayground) |
| SQL | Longest Login Streak | Gaps & islands, consecutive days | PayPal (SparkPlayground "Attendance Streaks"), Intuit (DataLemur "Consecutive Filing Years") |
| SQL | Month-over-Month Retention | Active-user retention | Meta (DataLemur "Active User Retention"; SparkPlayground "Gym Member Retention") |
| SQL | App Click-Through Rate | CTR with conditional counts | Meta (DataLemur "App Click-through Rate") |
| SQL | Histogram of Posts per User | Two-level aggregation | Twitter (X) (DataLemur "Histogram of Tweets") |
| SQL | Second-Highest Salary per Department | Nth highest distinct value | — (DataLemur lists it as "FAANG", not a company) |
| SQL | Odd and Even Readings per Day | Position within a day + conditional sums | Google (DataLemur "Odd and Even Measurements"; SparkPlayground "Smart Meter Readings") |
| SQL | Year-over-Year Spend Growth | Previous-period self-join, NULLIF | Wayfair (DataLemur "Y-on-Y Growth Rate") |
| SQL | Three-Day Shopping Sprees | Gaps & islands | Amazon (DataLemur "User Shopping Sprees") |
| SQL | Median from a Frequency Table | Expand frequencies, median | Google (DataLemur "Median Google Search Frequency") |
| SQL | Accidental Repeat Payments | LAG within a time window | Stripe (DataLemur "Repeated Payments") |
| SQL | Server Running Hours | Pair start/stop events with LEAD | Amazon (DataLemur "Server Utilization Time") |
| Python | Deduplicate Retried Events | Dedup with tie-breaks | — |
| Python | Top Event Types per User | Counting / top-N per user | Meta (DEV, hash maps & counting) |
| Python | Merge Busy Intervals | Merge intervals | Meta (DEV, streaming & intervals) |
| Python | Sessionize a Clickstream | Sessionization | Meta (DEV), Nielsen (SparkPlayground) |
| Python | Parse Orders, Quarantine Bad Rows | Schema-tolerant parsing | — (source names no company) |
| PySpark | Current Customer Snapshot | Latest record per key (CDC) | — |
| PySpark | Day-over-Day Price Change | LAG over a partition | Nielsen (SparkPlayground) |
| PySpark | Products Never Sold | left_anti join | Amazon (SparkPlayground "Unsold Products") |
| PySpark | Running Balance per User | Running total window | Amazon (SparkPlayground) |
| PySpark | Average Days Between Purchases | Gaps between consecutive events | Amazon (SparkPlayground "Customer Purchase Gaps") |
| pandas | Best-Equipped City | Parse delimited strings, top-1 with ties | Airbnb (StrataScratch "City With Most Amenities") |
| pandas | Revenue by Country | Filter → join → aggregate | — |
| pandas | Time to First Scroll | First event after another | Meta (StrataScratch "Time Between Two Events") |
| pandas | Three-Month Moving Revenue | Rolling average of monthly totals | Amazon (StrataScratch "Revenue Over Time") |
| pandas | Longest Winning Streak | Streaks (gaps & islands) | Amazon (StrataScratch "Player with the Longest Streak") |
| Shell | Top Error-Producing Clients | Top-N IPs from an access log | — |
| Shell | Unique Visitors per Day | Distinct IPs per day | — |
| Shell | Revenue by Category from a CSV | awk group-by sum | — |
| Shell | Slowest Endpoints | awk averages + top-N | — |
| Shell | Latest Record per Key | Dedup keeping newest version | — |

**Quality gate** (`npm run verify:problems`): all 36 pass the audit; every reference solution passes every test; no starter passes. Shell solutions are also checked against real `/bin/bash`.

### SQL packs (162 problems, `server/content/problems/sql/`)

| Pack | Problems | Patterns covered |
|---|---|---|
| 1 · Foundations | 10 | anti-join, COALESCE labels, top-1 per group, INTERSECT, market-basket self-join, employee↔manager self-join, normalise-then-dedupe, percent of total, N-in-a-row, zero groups with LEFT JOIN |
| 2 · Window functions | 10 | ROW_NUMBER vs RANK vs DENSE_RANK, resetting running totals, LAG gaps, NTILE quartiles, open/close with arg_min/arg_max, top-N with ties, RANGE calendar windows, group comparison, cumulative distinct users, LEAD repeat purchase |
| 3 · Strings, regex & lexicographic | 10 | regex validation, capture-group extraction (UTM), semantic version ordering, case-insensitive lexicographic min, anagram keys, palindromes, split + unnest, PII masking with back-references, longest common prefix via min/max, log-line parsing |
| 4 · Recursion & hierarchies | 9 | org levels, management paths, transitive closure (team size), bill-of-materials explosion, cyclic graph reachability, bounded cheapest route, date spine, category roll-ups with closure tables, number series |
| 5 · Pivot & dates | 8 | conditional-aggregation pivot, unpivot, EAV → columns, ISO weeks, business days with a calendar spine, interval overlap, sweep-line peak concurrency, UTC → local time |
| 6 · Analytics & statistics | 10 | strict funnels, cohort retention matrix, A/B test z-score, percentiles, z-score outliers, correlation (fan-out trap), last-touch attribution (as-of join), DAU/MAU, histograms, RFM segmentation |
| 7 · Data engineering | 10 | SCD Type 2, CDC MERGE, watermark + lookback incremental loads, reconciliation, data-quality profiling, orphaned FKs, survivorship dedup, skew detection, sessionization, idempotent partition overwrite |
| 8 · Original hard challenges | 8 | flood-fill connected components, FIFO cost of goods, Sudoku validator, interval packing, forward fill (IGNORE NULLS), seat islands, friend recommendations, greedy budget |
| 11 · Streaming, social, marketplaces | 12 | VIP watchers, monthly ratings with a minimum count, binge windows, vacant nights (range clipping), chart appearances, favourite artist, relational division (all albums / all skills), power creators, concurrent sessions, month-over-month ratios, the CTR/conversion funnel (23 companies) |
| 12 · Banks, cards, payments, trading | 12 | whale cardholders, quarterly spend, local-time bucketing, reciprocal payments, fraud-excluded volume, running sales, compound interest (recursive), volume change, top stock per month, top cities, issuance spread, launch month |
| 13 · Delivery, commerce, software, hardware | 16 | new-user 14-day window, courier stats, best item per store, MoM growth, top bid per listing, last view, cross-sell cohort, subscription length, tiered points, ticket resolution, charging day-over-day, unfinished parts, swapped orders, cuisine per city, latest jobs, weekly touch streak |
| 14 · Across industries | 24 | device split, mean/mode from counts, loss-making drugs, uncategorised calls, best/worst month, international calls, send vs open, second-day confirmation, zero-bucket histogram, 3-topping combinations, last-day basket, SKU parsing, seat tally, call-centre stats, distinct-event leaders, error codes, attendance pivot, keyword sentiment, rolling retention, experienced-driver ratings, mean/median/mode, second-ride delay, GPU temps, daily bids |
| 15 · Enterprise, banks, insurance, consulting | 10 | top-3 salaries, departments above company average, stale unfulfilled orders, first-week conversion, lapsed customers, quota attainment, repeated QC failures, inventory remaining (fan-out trap), top traders monthly, server usage |
| 9–10 · Case studies | 13 parts | RideShare marketplace (4), SaaS MRR (3), e-commerce returns (3), payments fraud (3) |

All outputs were generated by the reference solutions (`npm run problems:freeze`) and reviewed by hand; problems marked with a company carry their public source.

### Python packs (341 problems, `server/content/problems/python/`)

| Pack | Problems | What it covers |
|---|---|---|
| 1 · Strings | 22 | split/join, palindromes, anagrams, counting, IPv4 validation, Roman numerals, base conversion, number → words, enumerate, segment-wise path prefixes |
| 2 · Collections | 22 | two-sum family, set algebra, dict-as-GROUP-BY, inversion, missing number, longest consecutive, multi-key sorting, merge of sorted lists |
| 3 · Comprehensions | 10 | list/dict/set comprehensions, chained `for`, if-elif-else expressions, walrus, type semantics of operators |
| 4 · Functions & scope | 12 | `*args`/`**kwargs`, keyword-only, mutable defaults, multiple returns, functions as objects, nested functions, `global`, LEGB, `globals()`, `__name__ == "__main__"`, composition |
| 5 · Lambdas & higher-order | 12 | sort keys, filter, map (many iterables), reduce, `partial`, nested lambdas & late binding, function factories, `cmp_to_key`, IIFE |
| 6 · Recursion | 15 | factorial, primes, memoised Fibonacci, mutual recursion, nested JSON, subsets, permutations, Collatz, Pascal, trailing zeros, Hanoi, cycle-safe manager chains |
| 7 · Closures & decorators | 13 | `nonlocal`, memoize, timing + `wraps`, retry with backoff, stacking order, type enforcement, rate limiter, class decorators, decorator factories, LRU |
| 8 · Generators & iterators | 14 | iterator protocol, reusable iterables, batching, windows, infinite generators, pipelines, control-break streams, k-way merge, pagination, `send()`, `cycle`, `yield from`, `groupby`, laziness |
| 9 · OOP | 16 | classes, class vs instance variables, classmethod/staticmethod, properties, name mangling, isinstance, getattr/setattr, class attributes, nested classes, `__call__`, ABCs, singleton, transactional KV store, LRU, hit counter |
| 10 · Inheritance & magic methods | 14 | super chains, C3 MRO (implemented), cooperative diamonds, operator overloading, total_ordering, `__eq__`/`__hash__`, sequence protocol, `__str__` vs `__repr__`, singledispatch, mixins, `@`, context managers |
| 11 · Exceptions | 12 | specific excepts, try/except/else/finally flow, custom hierarchies, `raise … from`, hierarchy introspection, quarantine loaders, traceback reporting, EAFP, asserts, error budgets |
| 12 · Files & serialisation | 12 | JSON flatten/path/encode/decode hooks, pickle `__getstate__`, csv module, CSV → JSON Lines, schema-tolerant parsing, reconciling pulls, Enum constants, file modes, log aggregation |
| 13 · Regex | 11 | match/search/fullmatch, findall, named groups, lookaheads, `sub` with functions, SQL table extraction, arithmetic evaluator |
| 14 · Datetime | 11 | date diffs, weekdays, login streaks, alert windows, business days, durations, mixed formats, UTC offsets, month arithmetic, `time` module, expiring holds |
| 15 · Logging | 5 | logger setup without duplicates, level routing, ETL summaries, `logger.exception`, redaction filters |
| 16 · Concurrency | 11 | race conditions, Lock, RLock, semaphores, producer/consumer, lifecycle, Barrier, Timer, daemon threads, deadlock detection, GIL cost model |
| 17 · DB-API (sqlite3) | 8 | connect/execute/fetch, injection-safe parameters, commit/rollback, fetchmany, JSON inserts, upserts, `cursor.description`, dynamic filters |
| 18 · Memory & modules | 8 | shallow vs deep copy, deepcopy with memo, reference counting, cycle GC, `sys.path`, `__all__`, relative imports, pip specifiers |
| 19 · Arrays & search | 17 | sliding windows, prefix sums, Kadane, two pointers, top-k, binary search (bounds, k-th missing, interval lookup), autocomplete |
| 20 · Stacks, heaps & graphs | 18 | brackets, collisions, monotonic stacks, queues, streaming top-k, running median, platforms, meeting rooms, BFS, union-find, topological sort, trees, LCS diff, word search |
| 21 · DP, math & matrices | 15 | coin change, stock profit, edit distance, LIS, CIDR bit masks, bit flags, digit math, LCM, sparse matrices, spiral, rotation, Pearson, precision/recall, percentiles |
| 22 · Data engineering | 22 | snapshot diffs, stream joins, watermarks, idempotency, fee rollups, tiered pricing, checkpoints, SCD2, incremental loads, chunked aggregation, ETL, analytics over records |
| 23 · Advanced Python | 18 | `@contextmanager`, `ExitStack`, dataclasses (order, frozen, validation), namedtuple, ChainMap, Counter arithmetic, nested defaultdict, itertools toolbox & combinatorics, `cached_property`, descriptors, `__init_subclass__` registries, `__slots__`, `match`, runtime type checks, `__getattr__` proxies, Flag enums, Decimal rounding |
| 24 · Async, coordination & stdlib | 22 | generator event loop, `gather` vs `as_completed`, `threading.Event`, `Condition`, `Queue.task_done/join`, executor map ordering, generator `close`/`throw`, `ExceptionGroup`/`except*`, `str.translate`, format specs, configparser, argparse, statistics, seeded `random`, pathlib, struct, hashlib partitioning, zlib/base64, bisect, heap with updates, weakref caches, uuid5 |

Every expected value was produced by the reference solution (`npm run problems:freeze -- --show`) and reviewed.

#### Python syllabus coverage (playlist titles → packs)

| Playlist section (video titles) | Covered in |
|---|---|
| pip, PYTHONPATH, virtual environments, packages, `__init__.py`, `__all__` | Pack 18 (module search path, star imports, relative imports, requirements check) |
| enumerate, list/dict comprehensions, if-elif-else in comprehensions | Packs 1, 3 |
| Shallow vs deep copy, memory management, reference counting | Pack 18 |
| Functions: scope, local/global, return, function objects, nested functions, positional/keyword/default/mutable-default/variable-length arguments | Pack 4 |
| Lambda (sorted, nested, if-else), IIFE, first-class & higher-order functions, filter, map, reduce, partial | Pack 5 |
| Recursion (factorial, prime, direct/indirect, Fibonacci) | Pack 6 |
| Namespaces, nonlocal / LEGB, closures, decorators (multiple, examples, smart division), class decorators, globals(), `__main__` | Packs 4, 7 |
| OOP: classes, constructors, self, class members, built-in class functions/attributes, isinstance, instance/class/static methods, getters & setters, `@property`, `__call__`, abstraction, nested classes, storing objects in lists, destructors | Packs 9, 18 (object lifetime) |
| Inheritance (single, multi-level, hierarchical, multiple, hybrid), constructor overriding, super, MRO, encapsulation, polymorphism, operator & comparison overloading, method overloading, magic methods | Pack 10 |
| Exception handling: hierarchy, raise, user-defined exceptions, printing exception info, excepthook, best practices | Pack 11 |
| Pickling, JSON, constants | Pack 12 |
| Multithreading: threads, main thread, join, race conditions, Lock, RLock, Semaphore, exceptions, lifecycle, thread communication (Condition, Queue), daemon threads, Timer, Barrier | Packs 16, 24 (Event, Condition, Queue accounting, executors) |
| Context managers, dataclasses, descriptors, metaprogramming hooks, `match`, enums, async/coroutines, standard-library modules | Packs 23, 24 |
| Logging: levels, formatting, logger objects, exception details | Pack 15 |
| Iterators, generators (Fibonacci, chaining) | Pack 8 |
| Python ↔ MySQL (connect, cursor, execute, commit/rollback, fetchone/many/all, parameterised queries, inserting JSON) | Pack 17 (DB-API on sqlite3 — same API) |
| time, datetime, timedelta | Pack 14 |
| Regex (compile, search functions, character classes) | Pack 13 |
| Disadvantages of Python / why Python is slow, MVT vs MVC | Pack 16 (GIL cost model); MVT/MVC is a web-framework topic, not coded |

### PySpark packs (114 problems, `server/content/problems/pyspark/`)

| Pack | Problems | What it covers |
|---|---|---|
| 1 · DataFrame basics | 12 | select / cast with guarded parsing, fillna / dropna, derived columns, when chains, isin / like / between, date parts, delay buckets, unionByName, mapping-driven renames, withColumns |
| 2 · Aggregation | 15 | filter → group, aggregate-then-join, monthly / daily buckets, HAVING, countDistinct, ties at the top, pivots as conditional aggregation, subtotals by union, ordered collect_list, weighted mode, median, conditional rates |
| 3 · Joins | 12 | inner, left_anti, left_semi, full-outer reconciliation, self joins, undirected pairs, range joins, relational division, fan-out fix, top-N after join, set operations, multi-key joins |
| 4 · Windows & ranking | 13 | rank semantics, top-N per group, dense_rank with ties, partition averages, lag / lead, moving averages, cumulative share, ntile / percent_rank, min_by / max_by, Nth event, latest group |
| 5 · Quality & dedup | 12 | latest record per key, distinct counts, forward fill, null profiles, IQR outliers, loyalty scoring, rule checks, survivorship, schema drift, lookup mapping, surrogate keys, all-null rows |
| 6 · Dates & strings | 12 | word count, palindromes, PII masking, UTM extraction, keyword classification, date spans, monthly ratings, range-join watch time, multi-format dates, YoY growth, dayparts, formatted summaries |
| 7 · Complex types | 11 | from_json + explode, struct parsing, array functions, collect_set, dynamic struct flattening, maps, ordered paths, basket pairs, sequence + explode, higher-order functions, posexplode |
| 8 · Incremental & sessions | 12 | SCD2, SCD1 upsert, CDC replay, watermark loads, sessionization, session summaries, streaks, interval merging, start/stop pairing, retry detection, new vs returning, job stats |
| 9 · Analytics | 15 | ordered funnels, MoM retention, launch-month share, odd/even positions, elections, budgets, increasing sales, unpivot growth, distinct-event leaders, attendance, payroll, segmentation, budget greedy, KPIs, Spark SQL views |

**PySpark track companies (33):** Accenture, Alibaba, Amazon, Cargill, Deloitte, Docusign, EPAM, Flipkart, Google, HiLabs, IBM, Infosys, ITC Infotech, JPMorgan, Juniper Networks, LinkedIn, Meta, Microsoft, New York Times, Nielsen, PayPal, Robinhood, Stripe, Target, TCS, Tiger Analytics, TikTok, Twitter (X), Uber, VISA, Walmart, Wayfair, Workday — attributed through [SparkPlayground](https://www.sparkplayground.com/pyspark-coding-interview-questions) question types (and GeeksforGeeks for Flipkart's JSON machine-coding round).

### DSA track (277 problems, `server/content/problems/dsa/`)

A separate track for coding-round algorithms, graded on the Python engine. It covers every pattern of the common SDE-sheet syllabi; all statements, titles and data are original (well-known problems are reworded with new framing, inputs and return shapes).

| Pack | Problems | What it covers |
|---|---|---|
| 1 · Arrays & matrices | 24 | set-zero matrix, Pascal, next permutation, Kadane with bounds, Dutch flag, merge without extra space, duplicate via Floyd, repeat & missing, inversions, reverse pairs, matrix search (two kinds), majority n/2 and n/3, grid paths, fast power, longest consecutive, zero-sum span, XOR-k and sum-k counts, leaders, rotate, move zeros, product except self |
| 2 · Two pointers & windows | 17 | two/three/four sum, dedupe sorted, trapping rain water, container, k flips, longest unique substring, character replacement, minimum window, anagram windows, at-most-k and exactly-k distinct, binary sum goal, cards from ends, min length sum, isomorphic strings |
| 3 · Binary search & sorting | 20 | floor/ceil/insert, rotated search (with and without duplicates), rotation minimum, single element, peak, nth root, eating speed, bouquets, smallest divisor, ship capacity, book allocation, aggressive cows, k-th of two arrays, median of two arrays, row with most 1s, matrix median, merge sort, quickselect, counting sort |
| 4 · Strings | 17 | reverse words, longest palindromic substring, palindromic substring count, Roman both ways, atoi, common prefix, KMP, Z-function, Rabin–Karp, shortest palindrome, look-and-say, version compare, frequency sort, repeated string match, beauty sum, anagrams, nesting depth |
| 5 · Linked lists | 20 | reverse, middle, merge, remove nth from end, add numbers, plus one, cycle start & length, palindrome, k-group reversal, reverse between, intersection, rotate, sort, odd/even, delete duplicates, reorder, partition, swap pairs, delete middle, copy with random pointers |
| 6 · Recursion & backtracking | 17 | subset sums, unique subsets, combination sum I/II/III, permutations, k-th permutation, palindrome partitioning, N-Queens, Sudoku, m-colouring, rat in a maze, keypad, balanced parentheses, word search, expression operators |
| 7 · Greedy & intervals | 16 | activity selection, minimum platforms, job sequencing, fractional knapsack, canonical change, jump game I/II, gas station, candy, cookies, lemonade change, merge / insert intervals, erase overlaps, arrows, wildcard parentheses, SJF |
| 8 · Stacks, heaps & design | 23 | queue via stacks, stack via queue, min stack, bracket matching, RPN, infix → postfix, decode string, next greater (circular), previous smaller, daily temperatures, histogram, maximal rectangle, subarray minimum sum, remove k digits, celebrity, sliding window maximum, LRU, LFU, merge k lists, k closest, task scheduler, max-sum pairs, reorganise string |
| 9 · Binary trees | 22 | iterative traversals, Morris, level & zigzag order, height/balance, diameter, max path sum, same & mirror, boundary, vertical/top/bottom views, side views, max width, root-to-node path & LCA, nodes at distance k, burn time, complete-tree count, build from pre/in and post/in, serialise, flatten, invert, path sums, children-sum property |
| 10 · BSTs & tries | 18 | insert/delete, validate, k-th smallest/largest, BST LCA, floor/ceil/predecessor/successor, build from preorder, sorted array → BST, BST iterator two-sum, recover swapped nodes, largest BST subtree, merge two BSTs, trie, counting trie with erase, complete-prefix word, distinct substrings, max XOR, max XOR with limits |
| 11 · Graph traversal | 15 | BFS/DFS, provinces, islands, flood fill, rotting oranges, 0/1 matrix, surrounded regions, distinct islands, cycles (undirected, directed), bipartite, Kahn course order, safe states, alien dictionary, word ladder I/II |
| 12 · Shortest paths, MST & connectivity | 20 | DAG shortest path, unit-weight BFS, Dijkstra with path, binary maze, minimum effort, cheapest flights with k stops, count shortest routes, multiplications to reach target, Bellman–Ford, Floyd–Warshall threshold city, Prim, Kruskal, network repair, islands II, largest island, remove stones, Kosaraju SCC, bridges & articulation points |
| 13 · DP I | 17 | stairs, frog k-jumps, house robber I/II, ninja training, unique paths with obstacles, min path sum, triangle, falling path, cherry pickup, subset sum & partition, min subset difference, count subsets & target difference, 0/1 knapsack with reconstruction, coin change ways, unbounded knapsack & rod cutting, word break I/II, egg drop |
| 14 · DP II | 21 | LCS with reconstruction, longest common substring, LPS & min insertions, shortest supersequence, distinct subsequences, wildcard & regex matching, stocks (k trades, cooldown, fee), LIS in O(n log n), divisible subset, string chain, bitonic, number of LIS, matrix chain, cutting a stick, burst balloons, boolean parenthesisation, palindrome partitioning II, partition for max sum, count squares |
| 15 · Bits & number theory | 14 | single number I/II/III, counting bits, bit tricks, divide without operators, subsets by mask, XOR of ranges, bit flips & total Hamming distance, Gray code, reverse bits, extended Euclid, sieve with SPF factorisation, divisors, nCr mod p |

Linked-list and tree problems give learners a provided `ListNode` / `TreeNode` and build/serialise helpers; tests pass JSON and a `run(...)` driver converts it. **DSA track companies (8):** Adobe, Amazon, Flipkart, Goldman Sachs, Google, Microsoft, Samsung, Walmart — 206 of 277 problems tagged, each tag naming the matching question on that company's GeeksforGeeks list (`dsa/tags.js`). The remaining 71 are pattern drills not on those lists and stay untagged.

### Companies represented (106 across all tracks; 76 on Python, 33 on PySpark, 8 on DSA)

**SQL track companies (75):** Accenture, Adobe, Airbnb, Alibaba, Amazon, American Express, Bloomberg, Capital One, Cargill, Cisco, CVS Health, Databricks, Dell, Deloitte, Discover, Docusign, DoorDash, eBay, EPAM, Ernst & Young, Etsy, Ford, Goldman Sachs, Google, HiLabs, HPE, IBM, Infosys, Instacart, Intel, Intuit, JPMorgan, Juniper Networks, KPMG, LinkedIn, Lyft, Mastercard, McKinsey, Meta, Microsoft, Morgan Stanley, Nasdaq, Netflix, New York Times, Nielsen, NVIDIA, Oracle, PayPal, Paytm, Pinterest, Progressive, Reddit, Robinhood, Salesforce, Shopify, Snapchat, Snowflake, Spotify, Stripe, Target, TCS, Tesla, The Trade Desk, Tiger Analytics, TikTok, Twilio, Twitter (X), Uber, UnitedHealth, Verizon, VISA, Walmart, Wayfair, Workday, Zomato.

**Python track companies (76):** Accenture, Adobe, Agoda, Airbnb, Akuna Capital, Amazon, Apple, AQR, Atlassian, Bajaj Finserv, Bloomberg, Booking.com, Box, ByteDance, Capital One, Cisco, Citadel, Cognizant, Coinbase, D.E. Shaw, Databricks, Deloitte, DoorDash, Ernst & Young, Etsy, Exodus Point, FedEx, Figma, Flipkart, Goldman Sachs, Google, Infosys, Instacart, Intuit, JPMorgan, LinkedIn, LTIMindtree, Lyft, Meta, Microsoft, Morgan Stanley, Netflix, Nielsen, Nintendo, Noom, Notion, Oracle, Palantir, PayPal, Paytm, Pinterest, Reddit, Rivian, Robinhood, Roblox, Salesforce, Shopify, Sigmoid, Snapchat, Snowflake, Spotify, Stripe, Target, Techpath, Tesla, Tiger Analytics, TikTok, Twitch, Uber, Verizon, Virtusa, VISA, Walmart, Wayfair, Workday, Zillow.

Every tag links to the page that reports it (shown as "Asked at …" in the problem brief). A company appears on a problem only when its page reports that question *type*; the problem itself is written from scratch.

## 3. Backlog — reported question types not yet in the bank

Ordered roughly by how often they're reported. "Source" is where the attribution comes from; the problem must still be written from scratch.

| Track | Question type | Companies reported (source) |
|---|---|---|
| SQL | Reactivated users | Meta (DataLemur "Reactivated Users") |
| pandas | Pivot: max value per year | City of San Francisco (StrataScratch) |
| pandas | Avg earnings by weekday × hour | DoorDash (StrataScratch) |
| pandas | User growth rate month vs month | Salesforce (StrataScratch) |
| pandas | Year-over-year churn | Uber (StrataScratch) |
| Shell | jq over JSON logs; sed-based cleanup; exit-code handling scripts | (shell interview lists, no company) |

**Process to add one:** write an original scenario → add tests (≥1 visible, ≥2 hidden, including edge cases) → reference solution → tag with the track taxonomy, a pattern and a domain → add a company only with a source → `npm run verify:problems` → `npm run seed`.
