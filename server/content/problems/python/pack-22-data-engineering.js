// Python pack 22 — data-engineering tasks in plain Python, many of them
// company-reported question types: snapshot diffs, stream joins, watermarks,
// idempotent apply, fee rollups, tiered pricing, resumable checkpoints,
// badge-log mismatches, SCD type 2, incremental loads, chunked aggregation,
// and the analytics questions asked over lists of records.
import { python, md, code, ex, hid } from './define.js';
import { dev, ddp, ss, gfg, lds, tag } from './sources.js';

const DE = ['Data Engineer'];
const DE_DA = ['Data Engineer', 'Data Analyst'];

export default {
  problems: [
    python({
      id: 'nightly-snapshot-diff',
      title: 'What the Night Changed: Diff Two Snapshots',
      difficulty: 'Hard',
      topics: ['Data Wrangling', 'Dicts & Sets'],
      patterns: ['Snapshot diff / CDC'],
      domains: ['Data warehousing'],
      ...tag(ddp('Amazon', 'What the Night Changed')),
      roles: DE,
      summary: 'Compare yesterday\'s and today\'s dimension dumps and emit inserts, deletes and field-level updates.',
      description: md(
        'Both snapshots are lists of dicts with a primary key `id`. Return `{"inserted": [ids], "deleted": [ids], "updated": [[id, field, old, new], ...]}`: ids sorted; updates sorted by id then field, covering fields added, removed (new value `None`) or changed. Duplicate ids within one snapshot are an error — return `{"error": "duplicate id <id>"}` (first duplicate found, scanning old then new).',
      ),
      hints: ['Index each snapshot by id (detecting duplicates as you go); then use set algebra on the keys and compare the union of fields for common ids.'],
      entry: 'diff_snapshots',
      signature: 'diff_snapshots(old: list[dict], new: list[dict]) -> dict',
      solution: code`def _index(rows):
    out = {}
    for r in rows:
        if r["id"] in out:
            raise ValueError(r["id"])
        out[r["id"]] = r
    return out

def diff_snapshots(old: list[dict], new: list[dict]) -> dict:
    try:
        a, b = _index(old), _index(new)
    except ValueError as e:
        return {"error": f"duplicate id {e.args[0]}"}
    updated = []
    for key in sorted(a.keys() & b.keys()):
        for field in sorted((a[key].keys() | b[key].keys()) - {"id"}):
            before, after = a[key].get(field), b[key].get(field)
            if before != after:
                updated.append([key, field, before, after])
    return {"inserted": sorted(b.keys() - a.keys()), "deleted": sorted(a.keys() - b.keys()), "updated": updated}
`,
      explanation: md('This is change-data-capture when the source only gives full dumps. Keyed dicts make every lookup O(1); set operations find inserts and deletes; a union of field names catches added and dropped columns. Validating key uniqueness first prevents silently wrong diffs.'),
      tests: [
        ex('Example', [{ id: 1, name: 'a', tier: 'free' }, { id: 2, name: 'b' }], [{ id: 1, name: 'a', tier: 'pro' }, { id: 3, name: 'c' }]),
        ex('No changes', [{ id: 1, x: 1 }], [{ id: 1, x: 1 }]),
        hid('Field added and removed', [{ id: 5, a: 1 }], [{ id: 5, b: 2 }]),
        hid('Duplicate key', [{ id: 1 }, { id: 1 }], []),
      ],
    }),

    python({
      id: 'stream-joiner',
      title: 'The Stream Joiner: Join Two Sorted Streams in a Time Window',
      difficulty: 'Hard',
      topics: ['Streaming & State', 'Two Pointers & Sliding Window'],
      patterns: ['Interval join with two pointers'],
      domains: ['Ads / Marketing'],
      ...tag(ddp('Google', 'The Stream Joiner')),
      roles: DE,
      summary: 'Match each click to impressions of the same ad shown up to W seconds before it.',
      description: md('`impressions` and `clicks` are lists of `{"ts", "ad"}` sorted by `ts`. For each click, output `[click_ts, ad, impression_ts]` for every impression of the same ad with `click_ts - W <= impression_ts <= click_ts`, in click order then impression order. Use a sliding window over impressions instead of comparing every pair.'),
      hints: ['Keep a deque of impressions within the window; append impressions with `ts <= click_ts`, pop ones older than `click_ts - W`.'],
      entry: 'join_streams',
      signature: 'join_streams(impressions: list[dict], clicks: list[dict], window: int) -> list[list]',
      solution: code`from collections import deque

def join_streams(impressions: list[dict], clicks: list[dict], window: int) -> list[list]:
    buf, i, out = deque(), 0, []
    for c in clicks:
        while i < len(impressions) and impressions[i]["ts"] <= c["ts"]:
            buf.append(impressions[i])
            i += 1
        while buf and buf[0]["ts"] < c["ts"] - window:
            buf.popleft()
        out.extend([c["ts"], c["ad"], imp["ts"]] for imp in buf if imp["ad"] == c["ad"])
    return out
`,
      explanation: md('Because both streams are time-sorted, each impression enters and leaves the buffer once — the same idea as Flink/Spark interval joins with watermarks. Memory is bounded by how many impressions fit in one window.'),
      tests: [
        ex('Example', [{ ts: 1, ad: 'a' }, { ts: 3, ad: 'b' }, { ts: 6, ad: 'a' }], [{ ts: 7, ad: 'a' }, { ts: 9, ad: 'b' }], 5),
        ex('No clicks', [{ ts: 1, ad: 'a' }], [], 5),
        hid('Window boundary inclusive', [{ ts: 0, ad: 'x' }], [{ ts: 10, ad: 'x' }], 10),
        hid('Several matches', [{ ts: 1, ad: 'x' }, { ts: 2, ad: 'x' }, { ts: 2, ad: 'y' }], [{ ts: 3, ad: 'x' }], 3),
      ],
    }),

    python({
      id: 'event-time-watermark',
      title: 'Drop Late Events with a Watermark',
      difficulty: 'Medium',
      topics: ['Streaming & State', 'Hash Maps & Counting'],
      patterns: ['Event-time windows with watermark'],
      domains: ['Payments'],
      ...tag(dev('Stripe', 'streaming with event-time watermarks and late-record drop')),
      roles: DE,
      summary: 'Count events per 1-minute window by event time, dropping events later than the allowed lateness.',
      description: md('Events arrive in processing order as `[event_ts, key]` (seconds). The watermark is `max event_ts seen so far − lateness`. An event whose window (`event_ts // 60 * 60`) ends at or before the watermark (`window_start + 60 <= watermark`) is **late** and dropped. Return `[{window_start: count} sorted, dropped_count]`.'),
      hints: ['Judge each event against the watermark computed from the events **before** it, then advance the watermark with this event\'s timestamp.'],
      entry: 'windowed_counts',
      signature: 'windowed_counts(events: list[list], lateness: int) -> list',
      solution: code`def windowed_counts(events: list[list], lateness: int) -> list:
    counts, dropped, max_ts = {}, 0, None
    for ts, _key in events:
        window = ts // 60 * 60
        watermark = None if max_ts is None else max_ts - lateness
        if watermark is not None and window + 60 <= watermark:
            dropped += 1
        else:
            counts[window] = counts.get(window, 0) + 1
        max_ts = ts if max_ts is None else max(max_ts, ts)
    return [dict(sorted(counts.items())), dropped]
`,
      explanation: md('Event time says when something happened; processing order is when it arrived. A watermark is the stream\'s promise that older data is complete — windows behind it can be finalised, and stragglers are dropped (or sent to a side output). Lateness trades completeness for latency.'),
      tests: [
        ex('Example', [[10, 'a'], [70, 'b'], [65, 'c'], [200, 'd'], [30, 'e'], [130, 'f']], 30),
        ex('Generous lateness keeps everything', [[100, 'a'], [5, 'b']], 1000),
        hid('Empty', [], 10),
        hid('Exactly at the boundary', [[119, 'a'], [0, 'b']], 59),
      ],
    }),

    python({
      id: 'idempotent-event-apply',
      title: 'Apply Payment Events Exactly Once',
      difficulty: 'Medium',
      topics: ['Streaming & State', 'Dicts & Sets'],
      patterns: ['Idempotency keys'],
      domains: ['Payments'],
      ...tag(dev('Stripe', 'sets for idempotent event apply')),
      roles: DE,
      summary: 'Apply balance events that may be redelivered, using idempotency keys.',
      description: md('Events `[event_id, account, delta]` may be delivered more than once (at-least-once delivery). Apply each event_id once; a redelivery with a **different** payload is a conflict and is not applied. Return `[balances sorted by account, duplicates_ignored, conflicts]`.'),
      hints: ['Remember each applied event\'s payload by id; compare on redelivery.'],
      entry: 'apply_events',
      signature: 'apply_events(events: list[list]) -> list',
      solution: code`def apply_events(events: list[list]) -> list:
    seen, balances = {}, {}
    duplicates = conflicts = 0
    for event_id, account, delta in events:
        if event_id in seen:
            if seen[event_id] == (account, delta):
                duplicates += 1
            else:
                conflicts += 1
            continue
        seen[event_id] = (account, delta)
        balances[account] = balances.get(account, 0) + delta
    return [dict(sorted(balances.items())), duplicates, conflicts]
`,
      explanation: md('Exactly-once *effects* on top of at-least-once delivery come from idempotency keys. Flagging same-key-different-payload separately catches producer bugs that a plain "seen" set would hide. In production the seen-store is durable (a table with a unique key).'),
      tests: [
        ex('Example', [['e1', 'acct1', 100], ['e2', 'acct2', 50], ['e1', 'acct1', 100], ['e3', 'acct1', -30], ['e2', 'acct2', 999]]),
        ex('No duplicates', [['a', 'x', 1]]),
        hid('Empty', []),
        hid('Same payload many times', [['k', 'z', 5], ['k', 'z', 5], ['k', 'z', 5]]),
      ],
    }),

    python({
      id: 'fee-rollup',
      title: 'Transaction Fees per Merchant and Currency',
      difficulty: 'Easy',
      topics: ['Dicts & Sets', 'Data Wrangling'],
      patterns: ['Nested defaultdict rollup'],
      domains: ['Payments'],
      ...tag(dev('Stripe', 'hash tables for transaction-fee aggregation')),
      roles: DE_DA,
      summary: 'Compute fees (percentage + fixed) and roll them up per merchant and currency.',
      description: md('Each transaction is `[merchant, currency, amount]`; the fee is `amount * pct / 100 + fixed` for successful (amount > 0) transactions; refunds (amount ≤ 0) have no fee. Return `{merchant: {currency: total_fee}}` rounded to 2, keys sorted.'),
      hints: ['`defaultdict(lambda: defaultdict(float))`.'],
      entry: 'fees',
      signature: 'fees(txns: list[list], pct: float, fixed: float) -> dict',
      solution: code`from collections import defaultdict

def fees(txns: list[list], pct: float, fixed: float) -> dict:
    out = defaultdict(lambda: defaultdict(float))
    for merchant, currency, amount in txns:
        if amount > 0:
            out[merchant][currency] += amount * pct / 100 + fixed
    return {m: {c: round(v, 2) for c, v in sorted(out[m].items())} for m in sorted(out)}
`,
      explanation: md('A nested `defaultdict` is a two-level GROUP BY. Convert back to plain dicts before returning — defaultdicts silently create keys on read, which surprises callers.'),
      tests: [
        ex('Example', [['m1', 'USD', 100], ['m1', 'USD', 50], ['m1', 'EUR', 20], ['m2', 'USD', -10]], 2.9, 0.3),
        ex('No transactions', [], 1, 0),
        hid('Only refunds', [['m', 'INR', 0], ['m', 'INR', -5]], 2, 1),
        hid('Several merchants sorted', [['zeta', 'USD', 10], ['alpha', 'USD', 10]], 1, 0.5),
      ],
    }),

    python({
      id: 'tiered-shipping-cost',
      title: 'Tiered Shipping Cost',
      difficulty: 'Medium',
      topics: ['Sorting', 'Math & Bits'],
      patterns: ['Walk sorted tiers'],
      domains: ['Logistics'],
      ...tag(dev('Stripe', 'sorting and greedy for tiered pricing (tiered shipping cost)'), lds('Etsy', 'etsy', 'Tiered Order Discounts')),
      roles: DE,
      summary: 'Charge each weight band at its own rate, like tax brackets.',
      description: md('Tiers are `[up_to_kg, rate_per_kg]` in any order; the last tier has `up_to_kg = null` (no limit). Each kilogram is charged at the rate of the band it falls in (graduated, like income tax). Return the cost for each weight, rounded to 2.'),
      hints: ['Sort tiers by limit (null last), then charge `min(weight, limit) - previous_limit` at each band\'s rate.'],
      entry: 'shipping_costs',
      signature: 'shipping_costs(tiers: list[list], weights: list[float]) -> list[float]',
      solution: code`def shipping_costs(tiers: list[list], weights: list[float]) -> list[float]:
    bands = sorted(tiers, key=lambda t: float("inf") if t[0] is None else t[0])
    out = []
    for w in weights:
        cost, prev = 0.0, 0
        for limit, rate in bands:
            top = w if limit is None else min(w, limit)
            if top > prev:
                cost += (top - prev) * rate
            if limit is None or w <= limit:
                break
            prev = limit
        out.append(round(cost, 2))
    return out
`,
      explanation: md('Graduated pricing charges each slice at its own rate; the common bug is charging the whole weight at the top band\'s rate. Sorting tiers first makes the walk simple and tolerant of config order.'),
      tests: [
        ex('Example', [[5, 2.0], [null, 0.5], [20, 1.0]], [3, 12, 30]),
        ex('Single open band', [[null, 1.5]], [10]),
        hid('Exactly on a boundary', [[5, 2.0], [null, 1.0]], [5, 0]),
        hid('Unsorted tiers with fractions', [[null, 0.25], [10, 3.0], [2, 5.0]], [1.5, 11, 2]),
      ],
    }),

    python({
      id: 'resumable-etl-checkpoint',
      title: 'Resume an ETL Job from Its Checkpoint',
      difficulty: 'Medium',
      topics: ['Streaming & State', 'Error Handling'],
      patterns: ['Checkpoint + idempotent resume'],
      domains: ['Event pipelines'],
      ...tag(dev('Netflix', 'resumable ETL with checkpoint files and fault tolerance')),
      roles: DE,
      summary: 'Process files in order, checkpoint after each, and resume after a crash without double-loading.',
      description: md('`files` is the ordered list of input files with their row counts; `crash_after` lists files during which the job crashes **after loading but before checkpointing** on the first attempt only. The job loads a file, then writes the checkpoint (last completed file). On restart it resumes after the checkpoint, and a load is idempotent (reloading a file replaces its rows). Simulate runs until done and return `[runs, total_rows_in_target, files_loaded_more_than_once]`.'),
      hints: ['Track `target[file] = rows` (replacement keeps it idempotent) and how many times each file was loaded.'],
      entry: 'run_job',
      signature: 'run_job(files: list[list], crash_after: list[str]) -> list',
      solution: code`def run_job(files: list[list], crash_after: list[str]) -> list:
    checkpoint, target, loads, runs = -1, {}, {}, 0
    pending_crash = set(crash_after)
    while checkpoint < len(files) - 1:
        runs += 1
        for i in range(checkpoint + 1, len(files)):
            name, rows = files[i]
            target[name] = rows
            loads[name] = loads.get(name, 0) + 1
            if name in pending_crash:
                pending_crash.discard(name)
                break
            checkpoint = i
    reloaded = sorted(n for n, c in loads.items() if c > 1)
    return [runs, sum(target.values()), reloaded]
`,
      explanation: md('A crash between "write data" and "write checkpoint" means the last file is processed again on restart. Making the load idempotent (overwrite the file\'s partition instead of appending) turns at-least-once processing into exactly-once results — the target total stays correct.'),
      tests: [
        ex('Example', [['f1', 10], ['f2', 20], ['f3', 30]], ['f2']),
        ex('No crashes', [['a', 1], ['b', 2]], []),
        hid('Crash on the last file', [['a', 5]], ['a']),
        hid('Several crashes', [['a', 1], ['b', 2], ['c', 3]], ['a', 'c']),
      ],
    }),

    python({
      id: 'badge-log-mismatches',
      title: 'Badge Logs: Entries Without Exits',
      difficulty: 'Medium',
      topics: ['Hash Maps & Counting', 'Streaming & State'],
      patterns: ['Per-key state machine'],
      domains: ['Networking / Security'],
      ...tag(dev('Walmart', 'hash tables for access log mismatch detection')),
      roles: DE,
      summary: 'Find people who entered without exiting, or exited without entering.',
      description: md('Each record is `[name, "enter" | "exit"]` in time order; everyone starts outside. Return `[sorted names who exited without entering (at least once), sorted names still inside at the end]`.'),
      hints: ['Track a set of people inside.'],
      entry: 'mismatches',
      signature: 'mismatches(records: list[list[str]]) -> list[list[str]]',
      solution: code`def mismatches(records: list[list[str]]) -> list[list[str]]:
    inside, bad_exit = set(), set()
    for name, action in records:
        if action == "enter":
            inside.add(name)
        elif name in inside:
            inside.discard(name)
        else:
            bad_exit.add(name)
    return [sorted(bad_exit), sorted(inside)]
`,
      explanation: md('Each person is a tiny state machine (outside/inside). Entering twice is allowed here (tailgating doesn\'t change state); a stricter version would flag it too.'),
      tests: [
        ex('Example', [['ana', 'enter'], ['raj', 'exit'], ['ana', 'exit'], ['li', 'enter'], ['ana', 'exit']]),
        ex('Clean log', [['x', 'enter'], ['x', 'exit']]),
        hid('Empty', []),
        hid('Double entry, single exit', [['a', 'enter'], ['a', 'enter'], ['a', 'exit'], ['b', 'exit'], ['b', 'enter']]),
      ],
    }),

    python({
      id: 'trip-destination-counts',
      title: 'The Trip Aggregator: Distinct Destinations',
      difficulty: 'Easy',
      topics: ['Dicts & Sets', 'Data Wrangling'],
      patterns: ['Distinct count per key'],
      domains: ['Travel'],
      ...tag(ddp('Booking.com', 'The Trip Aggregator')),
      roles: DE_DA,
      summary: 'Count distinct cities per user so revisits don\'t inflate the dashboard.',
      description: md('Bookings are `[user, city]` (case-insensitive city names). Return `{user: distinct_city_count}` sorted by user.'),
      hints: ['A set per user.'],
      entry: 'distinct_destinations',
      signature: 'distinct_destinations(bookings: list[list[str]]) -> dict[str, int]',
      solution: code`def distinct_destinations(bookings: list[list[str]]) -> dict[str, int]:
    cities = {}
    for user, city in bookings:
        cities.setdefault(user, set()).add(city.strip().lower())
    return {u: len(cities[u]) for u in sorted(cities)}
`,
      explanation: md('`COUNT(DISTINCT city)` in Python is a set per key. Normalising case and spaces first is what fixes the "inflated" numbers.'),
      tests: [
        ex('Example', [['u1', 'Paris'], ['u1', 'paris '], ['u1', 'Rome'], ['u2', 'Oslo']]),
        ex('Empty', []),
        hid('Single user many visits', [['z', 'A'], ['z', 'a'], ['z', 'A']]),
        hid('Users sorted', [['b', 'X'], ['a', 'Y'], ['a', 'Z']]),
      ],
    }),

    python({
      id: 'bigram-continuations',
      title: 'Next-Word Suggestions from Bigrams',
      difficulty: 'Medium',
      topics: ['Hash Maps & Counting', 'Strings'],
      patterns: ['Bigram counting'],
      domains: ['Search & text'],
      ...tag(dev('Tesla', 'hash maps, bigrams and greedy continuations')),
      roles: DE,
      summary: 'Count word pairs in service notes and greedily continue a phrase.',
      description: md('Lowercase the text and split on whitespace. Count every adjacent word pair. Starting from `start`, repeatedly append the most frequent next word (alphabetical on ties) up to `n` more words, stopping early if a word has no successor. Return the phrase as a string.'),
      hints: ['`Counter(zip(words, words[1:]))`, then a dict word → Counter of next words.'],
      entry: 'continue_phrase',
      signature: 'continue_phrase(text: str, start: str, n: int) -> str',
      solution: code`from collections import Counter, defaultdict

def continue_phrase(text: str, start: str, n: int) -> str:
    words = text.lower().split()
    nxt = defaultdict(Counter)
    for a, b in zip(words, words[1:]):
        nxt[a][b] += 1
    phrase = [start.lower()]
    for _ in range(n):
        options = nxt.get(phrase[-1])
        if not options:
            break
        phrase.append(min(options, key=lambda w: (-options[w], w)))
    return " ".join(phrase)
`,
      explanation: md('A bigram model is a dict of Counters. Greedy continuation can loop (a → b → a …), which is why `n` caps it.'),
      tests: [
        ex('Example', 'replace brake pad replace brake fluid check brake pad', 'replace', 3),
        ex('Unknown start', 'a b c', 'z', 2),
        hid('Loops are capped', 'a b a b', 'a', 5),
        hid('Ties alphabetical, stops at dead end', 'go home go work', 'go', 4),
      ],
    }),

    python({
      id: 'restaurant-recommendations',
      title: 'Restaurant Recommendations from Friends',
      difficulty: 'Medium',
      topics: ['Dicts & Sets', 'Hash Maps & Counting'],
      patterns: ['Collaborative counting'],
      domains: ['Food delivery'],
      ...tag(dev('PayPal', 'restaurant recommendations')),
      roles: DE,
      summary: 'Recommend restaurants the user hasn\'t tried, ranked by how many friends liked them.',
      description: md('`friends` maps user → friends; `likes` maps user → restaurants they liked. For `user`, return up to `k` restaurants liked by their friends that the user hasn\'t liked, ranked by number of distinct friends liking it (desc), then name.'),
      hints: ['Count per restaurant with a Counter over friends\' like-sets.'],
      entry: 'recommend',
      signature: 'recommend(friends: dict, likes: dict, user: str, k: int) -> list[str]',
      solution: code`from collections import Counter

def recommend(friends: dict, likes: dict, user: str, k: int) -> list[str]:
    mine = set(likes.get(user, []))
    votes = Counter()
    for f in set(friends.get(user, [])) - {user}:
        votes.update(set(likes.get(f, [])) - mine)
    return [r for r, _ in sorted(votes.items(), key=lambda kv: (-kv[1], kv[0]))[:k]]
`,
      explanation: md('Deduplicating each friend\'s likes with a set counts "friends who liked it", not "likes"; subtracting the user\'s own likes removes what they already know.'),
      tests: [
        ex('Example', { ana: ['raj', 'li'], raj: ['ana'] }, { ana: ['dosa hut'], raj: ['taco bay', 'dosa hut'], li: ['taco bay', 'pho 1'] }, 'ana', 2),
        ex('No friends', {}, {}, 'zoe', 3),
        hid('Duplicate likes count once', { a: ['b'] }, { b: ['x', 'x'] }, 'a', 5),
        hid('Already liked is excluded and k limits', { u: ['f1', 'f2'] }, { u: ['a'], f1: ['a', 'b', 'c'], f2: ['c', 'd'] }, 'u', 1),
      ],
    }),

    python({
      id: 'scd-type-2-python',
      title: 'Slowly Changing Dimension Type 2 in Python',
      difficulty: 'Hard',
      topics: ['Data Wrangling', 'Datetime'],
      patterns: ['SCD Type 2'],
      domains: ['Data warehousing'],
      roles: DE,
      summary: 'Apply a daily customer extract to a history table: close changed rows, open new versions.',
      description: md(
        '`history` rows are `{"id", "city", "valid_from", "valid_to", "current"}` (`valid_to` is `null` for current rows). `extract` is today\'s full list of `{"id", "city"}`; `today` is an ISO date.',
        '',
        'For each id: unchanged → nothing; changed city → close the current row (`valid_to = today`, `current = false`) and add a new current row from today; new id → add a current row. Ids missing from the extract are left alone. Return the full history sorted by id then valid_from.',
      ),
      hints: ['Index current rows by id; compare only tracked attributes.'],
      entry: 'apply_scd2',
      signature: 'apply_scd2(history: list[dict], extract: list[dict], today: str) -> list[dict]',
      solution: code`def apply_scd2(history: list[dict], extract: list[dict], today: str) -> list[dict]:
    rows = [dict(r) for r in history]
    current = {r["id"]: r for r in rows if r["current"]}
    for rec in extract:
        cur = current.get(rec["id"])
        if cur is not None and cur["city"] == rec["city"]:
            continue
        if cur is not None:
            cur["valid_to"] = today
            cur["current"] = False
        rows.append({"id": rec["id"], "city": rec["city"], "valid_from": today, "valid_to": None, "current": True})
    return sorted(rows, key=lambda r: (r["id"], r["valid_from"]))
`,
      explanation: md('Type 2 keeps every version with a validity range, so facts can join to the attribute value that was true at the time. Copying the input rows first keeps the function pure; real pipelines do this with a MERGE.'),
      tests: [
        ex('Example', [{ id: 1, city: 'Pune', valid_from: '2024-01-01', valid_to: null, current: true }, { id: 2, city: 'Goa', valid_from: '2024-01-01', valid_to: null, current: true }], [{ id: 1, city: 'Mumbai' }, { id: 2, city: 'Goa' }, { id: 3, city: 'Delhi' }], '2024-06-01'),
        ex('Empty history', [], [{ id: 9, city: 'X' }], '2024-01-01'),
        hid('Second change keeps older history', [{ id: 1, city: 'A', valid_from: '2023-01-01', valid_to: '2024-01-01', current: false }, { id: 1, city: 'B', valid_from: '2024-01-01', valid_to: null, current: true }], [{ id: 1, city: 'C' }], '2024-07-01'),
        hid('Missing ids are left alone', [{ id: 4, city: 'K', valid_from: '2024-01-01', valid_to: null, current: true }], [], '2024-02-01'),
      ],
    }),

    python({
      id: 'watermark-incremental-load',
      title: 'Backfill-Safe Incremental Load',
      difficulty: 'Medium',
      topics: ['Data Wrangling', 'Streaming & State'],
      patterns: ['High-watermark + lookback + upsert'],
      domains: ['Data warehousing'],
      roles: DE,
      summary: 'Pull rows changed since the last watermark (minus a lookback) and upsert them idempotently.',
      description: md('`source` rows are `{"id", "updated_at" (int), "value"}`; `target` is a dict id → row; `watermark` is the last loaded `updated_at`. Load rows with `updated_at > watermark - lookback`, upserting by id only when the source row is newer than (or new to) the target. Return `[sorted target rows, new_watermark, rows_written]`; the new watermark is the max `updated_at` seen in target (or the old one).'),
      hints: ['The lookback re-reads a few late-committed rows; the "only if newer" upsert makes the re-read harmless.'],
      entry: 'incremental_load',
      signature: 'incremental_load(source: list[dict], target: dict, watermark: int, lookback: int) -> list',
      solution: code`def incremental_load(source: list[dict], target: dict, watermark: int, lookback: int) -> list:
    out = {k: dict(v) for k, v in target.items()}
    written = 0
    for row in source:
        if row["updated_at"] <= watermark - lookback:
            continue
        cur = out.get(str(row["id"]))
        if cur is None or row["updated_at"] > cur["updated_at"]:
            out[str(row["id"])] = dict(row)
            written += 1
    new_wm = max([watermark] + [r["updated_at"] for r in out.values()])
    return [sorted(out.values(), key=lambda r: r["id"]), new_wm, written]
`,
      explanation: md('Watermark-only loads miss rows committed late with older timestamps; a lookback window catches them, and an idempotent "newer wins" upsert means re-reading never duplicates or regresses data. Re-running the same load writes nothing.'),
      tests: [
        ex('Example', [{ id: 1, updated_at: 95, value: 'late' }, { id: 2, updated_at: 120, value: 'new' }, { id: 3, updated_at: 50, value: 'old' }], { '1': { id: 1, updated_at: 90, value: 'v1' } }, 100, 10),
        ex('Re-run writes nothing', [{ id: 1, updated_at: 100, value: 'x' }], { '1': { id: 1, updated_at: 100, value: 'x' } }, 100, 10),
        hid('Empty source', [], {}, 0, 5),
        hid('Older source row ignored', [{ id: 7, updated_at: 99, value: 'stale' }], { '7': { id: 7, updated_at: 105, value: 'fresh' } }, 100, 5),
      ],
    }),

    python({
      id: 'chunked-csv-aggregation',
      title: 'Aggregate a Large CSV in Chunks',
      difficulty: 'Medium',
      topics: ['Parsing (CSV / JSON)', 'Generators & Iterators', 'Hash Maps & Counting'],
      patterns: ['Chunked combine'],
      domains: ['E-commerce / Sales'],
      ...tag(gfg('Deloitte', 'how do you handle large CSV files in Python')),
      roles: DE,
      summary: 'Compute per-region totals and averages reading a CSV a few rows at a time.',
      description: md('Read CSV `text` (header `region,amount`) in chunks of `chunk_size` rows, computing a partial `{region: [sum, count]}` per chunk, then combine the partials. Return `[number_of_chunks, {region: [total, average]}]` (both rounded to 2, regions sorted). Never hold more than one chunk of rows.'),
      hints: ['Partial sums and counts combine exactly; averages don\'t — combine sums and counts, divide at the end.'],
      entry: 'aggregate',
      signature: 'aggregate(text: str, chunk_size: int) -> list',
      solution: code`import csv
import io
from itertools import islice

def aggregate(text: str, chunk_size: int) -> list:
    reader = csv.DictReader(io.StringIO(text))
    totals, chunks = {}, 0
    while True:
        rows = list(islice(reader, chunk_size))
        if not rows:
            break
        chunks += 1
        partial = {}
        for r in rows:
            s = partial.setdefault(r["region"], [0.0, 0])
            s[0] += float(r["amount"])
            s[1] += 1
        for region, (s, c) in partial.items():
            t = totals.setdefault(region, [0.0, 0])
            t[0] += s
            t[1] += c
    return [chunks, {k: [round(s, 2), round(s / c, 2)] for k, (s, c) in sorted(totals.items())}]
`,
      explanation: md('This is the map → combine → reduce shape behind pandas `chunksize`, Spark partial aggregation and MapReduce. Averages of averages are wrong when chunks differ in size; sums and counts are associative, so they combine safely.'),
      tests: [
        ex('Example', 'region,amount\nN,10\nS,5\nN,20\nS,7\nE,1\n', 2),
        ex('One chunk', 'region,amount\nX,1.5\n', 10),
        hid('Header only', 'region,amount\n', 3),
        hid('Uneven chunks', 'region,amount\nA,1\nA,2\nA,3\n', 2),
      ],
    }),

    python({
      id: 'dummy-etl-pipeline',
      title: 'Write a Small ETL Pipeline End to End',
      difficulty: 'Medium',
      topics: ['Data Wrangling', 'Parsing (CSV / JSON)', 'Functions & Lambdas'],
      patterns: ['Extract → transform → load functions'],
      domains: ['E-commerce / Sales'],
      ...tag(gfg('Morgan Stanley', 'pseudo code for a dummy ETL pipeline using Python data structures')),
      roles: DE,
      summary: 'Extract JSON orders, cleanse and transform them, and load a CSV report — as three small functions.',
      description: md(
        'Write `extract(text)` (JSON array → list of dicts), `transform(rows)` and `load(rows)`:',
        '',
        '- cleanse: drop rows without `order_id` or with a non-numeric `amount`; strip/upper-case `country`; dedupe by `order_id` keeping the first;',
        '- transform: add `amount_usd = round(amount * fx[currency], 2)` with `fx = {"USD": 1, "EUR": 1.1, "INR": 0.012}` (unknown currency → drop the row);',
        '- load: CSV text with header `order_id,country,amount_usd`, rows sorted by order_id.',
        '',
        '`run(text)` returns `load(transform(extract(text)))`.',
      ),
      hints: ['Keep each stage a pure function: easy to test, easy to swap the load target later.'],
      entry: 'run',
      signature: 'run(text: str) -> str',
      starter: code`import csv
import io
import json

FX = {"USD": 1, "EUR": 1.1, "INR": 0.012}

def extract(text):
    pass

def transform(rows):
    pass

def load(rows):
    pass


# The tests call run(); don't change it.
def run(text):
    return load(transform(extract(text)))
`,
      solution: code`import csv
import io
import json

FX = {"USD": 1, "EUR": 1.1, "INR": 0.012}

def extract(text):
    return json.loads(text)

def transform(rows):
    seen, out = set(), []
    for r in rows:
        oid = r.get("order_id")
        try:
            amount = float(r.get("amount"))
        except (TypeError, ValueError):
            continue
        rate = FX.get(r.get("currency"))
        if oid is None or oid in seen or rate is None:
            continue
        seen.add(oid)
        out.append({"order_id": oid, "country": str(r.get("country", "")).strip().upper(),
                    "amount_usd": round(amount * rate, 2)})
    return out

def load(rows):
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=["order_id", "country", "amount_usd"], lineterminator="\n")
    w.writeheader()
    w.writerows(sorted(rows, key=lambda r: r["order_id"]))
    return buf.getvalue()


def run(text):
    return load(transform(extract(text)))
`,
      explanation: md('Separating extract, transform and load keeps each step small and testable, and lets you rerun just one stage. `csv.DictWriter` handles quoting for you.'),
      tests: [
        ex('Example', '[{"order_id": 2, "country": " in ", "amount": "1000", "currency": "INR"}, {"order_id": 1, "country": "de", "amount": 10, "currency": "EUR"}, {"order_id": 1, "country": "fr", "amount": 5, "currency": "EUR"}, {"amount": 3, "currency": "USD"}, {"order_id": 3, "amount": "x", "currency": "USD"}]'),
        ex('Empty', '[]'),
        hid('Unknown currency dropped', '[{"order_id": 9, "country": "us", "amount": 1, "currency": "GBP"}]'),
        hid('Duplicates keep the first and sort by id', '[{"order_id": 5, "country": "us", "amount": 2, "currency": "USD"}, {"order_id": 4, "country": "de", "amount": "3.5", "currency": "EUR"}, {"order_id": 5, "country": "uk", "amount": 9, "currency": "USD"}]'),
      ],
    }),

    python({
      id: 'activity-rank',
      title: 'Rank Users by Emails Sent',
      difficulty: 'Easy',
      topics: ['Sorting', 'Hash Maps & Counting'],
      patterns: ['Count then rank'],
      domains: ['Product analytics'],
      ...tag(ss('Google', 'Activity Rank')),
      roles: DE_DA,
      summary: 'Count emails per sender and assign unique ranks, ties ordered alphabetically.',
      description: md('Each email is `[from_user, to_user]`. Return `[user, sent_count, rank]` for every sender, ranked by count descending with ties broken alphabetically — ranks are unique (1, 2, 3, …).'),
      hints: ['Sort by `(-count, user)` and `enumerate(..., start=1)`.'],
      entry: 'activity_rank',
      signature: 'activity_rank(emails: list[list[str]]) -> list[list]',
      solution: code`from collections import Counter

def activity_rank(emails: list[list[str]]) -> list[list]:
    counts = Counter(sender for sender, _ in emails)
    ordered = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    return [[u, n, i] for i, (u, n) in enumerate(ordered, start=1)]
`,
      explanation: md('This is `ROW_NUMBER() OVER (ORDER BY count DESC, user)` — unique ranks even on ties, because the tie-break is part of the order.'),
      tests: [
        ex('Example', [['a', 'b'], ['c', 'a'], ['a', 'c'], ['b', 'a'], ['c', 'b']]),
        ex('No emails', []),
        hid('All tied', [['z', 'x'], ['y', 'x']]),
        hid('Single sender', [['solo', 'x'], ['solo', 'y']]),
      ],
    }),

    python({
      id: 'highest-paid-titles',
      title: 'Titles of the Highest-Paid Workers',
      difficulty: 'Easy',
      topics: ['Dicts & Sets', 'Data Wrangling'],
      patterns: ['Max then filter (ties)'],
      domains: ['HR / People'],
      ...tag(ss('DoorDash', 'Workers With The Highest Salaries')),
      roles: DE_DA,
      summary: 'Join workers to titles and return every title held by a top earner, ties included.',
      description: md('`workers` is a list of `[worker_id, salary]`, `titles` a list of `[worker_id, title]` (a worker may have several titles). Return the sorted distinct titles of all workers earning the maximum salary.'),
      hints: ['Find the max, collect the ids that have it, then filter titles with a set lookup.'],
      entry: 'top_titles',
      signature: 'top_titles(workers: list[list], titles: list[list]) -> list[str]',
      solution: code`def top_titles(workers: list[list], titles: list[list]) -> list[str]:
    if not workers:
        return []
    top = max(s for _, s in workers)
    ids = {w for w, s in workers if s == top}
    return sorted({t for w, t in titles if w in ids})
`,
      explanation: md('"Highest" questions almost always need ties: compute the max, then keep everything equal to it — not `max(..., key=...)`, which returns one row.'),
      tests: [
        ex('Example', [[1, 100], [2, 300], [3, 300]], [[1, 'Analyst'], [2, 'Manager'], [3, 'Lead'], [3, 'Manager']]),
        ex('No workers', [], []),
        hid('Top earner without a title', [[1, 10]], [[2, 'X']]),
        hid('Duplicate titles collapse', [[1, 50], [2, 50]], [[1, 'Eng'], [2, 'Eng'], [2, 'Lead']]),
      ],
    }),

    python({
      id: 'viewers-turned-streamers',
      title: 'Viewers Turned Streamers',
      difficulty: 'Easy',
      topics: ['Dicts & Sets', 'Sorting'],
      patterns: ['First event per user'],
      domains: ['Streaming / Media'],
      ...tag(ss('Twitch', 'Viewers Turned Streamers')),
      roles: DE_DA,
      summary: 'Find users whose first session was as a viewer and who later streamed.',
      description: md('Sessions are `[user, start_ts, type]` with type `"viewer"` or `"streamer"`, in any order. Return `[[user, number_of_streamer_sessions]]` for users whose **first** session was a viewer session and who have at least one streamer session, sorted by count descending then user.'),
      hints: ['Sort by start time to find each user\'s first session.'],
      entry: 'converted_viewers',
      signature: 'converted_viewers(sessions: list[list]) -> list[list]',
      solution: code`def converted_viewers(sessions: list[list]) -> list[list]:
    first, streams = {}, {}
    for user, ts, kind in sorted(sessions, key=lambda s: (s[1], s[0])):
        first.setdefault(user, kind)
        if kind == "streamer":
            streams[user] = streams.get(user, 0) + 1
    out = [[u, n] for u, n in streams.items() if first[u] == "viewer"]
    return sorted(out, key=lambda r: (-r[1], r[0]))
`,
      explanation: md('"First event per user" = sort by time and keep the first with `setdefault`. The same pass counts streamer sessions.'),
      tests: [
        ex('Example', [['a', 1, 'viewer'], ['a', 5, 'streamer'], ['b', 2, 'streamer'], ['b', 3, 'viewer'], ['c', 4, 'viewer'], ['a', 9, 'streamer']]),
        ex('Nobody converted', [['x', 1, 'viewer']]),
        hid('Unsorted input', [['z', 10, 'streamer'], ['z', 1, 'viewer']]),
        hid('Ranking by streamer sessions', [['a', 1, 'viewer'], ['a', 2, 'streamer'], ['b', 1, 'viewer'], ['b', 2, 'streamer'], ['b', 3, 'streamer']]),
      ],
    }),

    python({
      id: 'cities-above-national-average',
      title: 'Cities with Above-Average Home Prices',
      difficulty: 'Easy',
      topics: ['Data Wrangling', 'Dicts & Sets'],
      patterns: ['Group mean vs overall mean'],
      domains: ['Real estate'],
      ...tag(ss('Zillow', 'Cities With The Most Expensive Homes', 'ds')),
      roles: DE_DA,
      summary: 'Compare each city\'s mean listing price to the national mean.',
      description: md('Listings are `[city, price]`. Return the sorted cities whose average price is strictly greater than the average over **all listings**.'),
      hints: ['National mean = total / count over every listing (not the mean of city means).'],
      entry: 'expensive_cities',
      signature: 'expensive_cities(listings: list[list]) -> list[str]',
      solution: code`def expensive_cities(listings: list[list]) -> list[str]:
    if not listings:
        return []
    overall = sum(p for _, p in listings) / len(listings)
    sums = {}
    for city, price in listings:
        s = sums.setdefault(city, [0, 0])
        s[0] += price
        s[1] += 1
    return sorted(c for c, (s, n) in sums.items() if s / n > overall)
`,
      explanation: md('The mean of city means weights a 1-listing town like a 1,000-listing city; the overall mean weights every listing equally — which is what "national average" means.'),
      tests: [
        ex('Example', [['A', 100], ['A', 300], ['B', 150], ['C', 500], ['B', 50]]),
        ex('Empty', []),
        hid('Weighting matters', [['big', 10], ['big', 10], ['big', 10], ['tiny', 25]]),
        hid('Nobody above when all equal', [['a', 5], ['b', 5]]),
      ],
    }),

    python({
      id: 'top-distance-riders',
      title: 'Riders Who Travelled the Farthest',
      difficulty: 'Easy',
      topics: ['Hash Maps & Counting', 'Sorting'],
      patterns: ['Sum then top-N with ties'],
      domains: ['Mobility / Ride-hailing'],
      ...tag(ss('Lyft', 'Distances Traveled', 'ds')),
      roles: DE_DA,
      summary: 'Total distance per rider and the top N, including anyone tied with the N-th.',
      description: md('Rides are `[rider, km]`. Return `[[rider, total_km]]` for the top `n` riders by total (rounded to 1), plus anyone tied with the n-th total, sorted by total descending then rider.'),
      hints: ['Find the n-th largest total, then keep every rider ≥ it.'],
      entry: 'top_riders',
      signature: 'top_riders(rides: list[list], n: int) -> list[list]',
      solution: code`def top_riders(rides: list[list], n: int) -> list[list]:
    totals = {}
    for rider, km in rides:
        totals[rider] = totals.get(rider, 0) + km
    ranked = sorted(((r, round(t, 1)) for r, t in totals.items()), key=lambda x: (-x[1], x[0]))
    if not ranked or n <= 0:
        return []
    cutoff = ranked[min(n, len(ranked)) - 1][1]
    return [[r, t] for r, t in ranked if t >= cutoff]
`,
      explanation: md('"Top N" with ties is `DENSE_RANK`-like behaviour on the cutoff: slicing `[:n]` would arbitrarily drop someone tied with the last place.'),
      tests: [
        ex('Example', [['a', 10.5], ['b', 3], ['a', 2], ['c', 12.5], ['d', 7]], 2),
        ex('Tie at the cutoff', [['x', 5], ['y', 5], ['z', 1]], 1),
        hid('n larger than riders', [['p', 1]], 5),
        hid('n = 0', [['a', 1]], 0),
      ],
    }),

    python({
      id: 'spam-share-by-day',
      title: 'Share of Spam Posts per Day',
      difficulty: 'Easy',
      topics: ['Hash Maps & Counting', 'Data Wrangling'],
      patterns: ['Conditional ratio per group'],
      domains: ['Social media'],
      ...tag(ss('Meta', 'Spam Posts', 'ds')),
      roles: DE_DA,
      summary: 'For each day, the percentage of viewed posts whose keywords mark them as spam.',
      description: md('Posts are `[post_date, keywords (comma-separated), viewed (bool)]`. Considering only viewed posts, return `[[date, spam_pct]]` sorted by date, where a post is spam if one of its keywords is exactly `"spam"` (case-insensitive, trimmed); pct rounded to 1.'),
      hints: ['Count viewed and spam per date; split keywords and compare a set.'],
      entry: 'spam_share',
      signature: 'spam_share(posts: list[list]) -> list[list]',
      solution: code`def spam_share(posts: list[list]) -> list[list]:
    stats = {}
    for day, keywords, viewed in posts:
        if not viewed:
            continue
        s = stats.setdefault(day, [0, 0])
        s[0] += 1
        if "spam" in {k.strip().lower() for k in keywords.split(",")}:
            s[1] += 1
    return [[d, round(100 * spam / total, 1)] for d, (total, spam) in sorted(stats.items())]
`,
      explanation: md('Matching whole keywords (not substrings) avoids flagging "antispam"; filtering to viewed posts before counting fixes the denominator.'),
      tests: [
        ex('Example', [['2024-01-01', 'spam, ads', true], ['2024-01-01', 'news', true], ['2024-01-01', 'spam', false], ['2024-01-02', 'antispam', true]]),
        ex('Nothing viewed', [['d', 'spam', false]]),
        hid('Case and spaces', [['d', ' SPAM ', true], ['d', 'x', true], ['d', 'y', true]]),
        hid('Several days sorted', [['2024-02-02', 'spam', true], ['2024-02-01', 'ok', true]]),
      ],
    }),

    python({
      id: 'days-at-number-one',
      title: 'Days at Number One',
      difficulty: 'Medium',
      topics: ['Hash Maps & Counting', 'Data Wrangling'],
      patterns: ['Top-1 per group, then count'],
      domains: ['Streaming / Media'],
      ...tag(ss('Spotify', 'Days At Number One', 'ds')),
      roles: DE_DA,
      summary: 'From daily chart positions, count how many days each track held the top spot.',
      description: md('Chart rows are `[date, position, track]` across many dates and charts (a track may appear several times per day in different regions). A track was number one on a date if it held position 1 in **any** row for that date (count each date once per track). Return `[[track, days]]` sorted by days descending then track.'),
      hints: ['A set of dates per track for rows with position 1.'],
      entry: 'days_at_top',
      signature: 'days_at_top(rows: list[list]) -> list[list]',
      solution: code`def days_at_top(rows: list[list]) -> list[list]:
    days = {}
    for date, position, track in rows:
        if position == 1:
            days.setdefault(track, set()).add(date)
    return sorted(([t, len(d)] for t, d in days.items()), key=lambda r: (-r[1], r[0]))
`,
      explanation: md('Several regional #1s on one day must count once — a set of dates per track handles it.'),
      tests: [
        ex('Example', [['d1', 1, 'A'], ['d1', 1, 'A'], ['d1', 2, 'B'], ['d2', 1, 'B'], ['d3', 1, 'A']]),
        ex('No number ones', [['d1', 3, 'X']]),
        hid('Two tracks at #1 the same day', [['d', 1, 'x'], ['d', 1, 'y']]),
        hid('Ranking ties by name', [['d1', 1, 'b'], ['d2', 1, 'a']]),
      ],
    }),

    python({
      id: 'score-range-difference',
      title: 'Largest Score Gap Between Students',
      difficulty: 'Easy',
      topics: ['Data Wrangling', 'Lists & Tuples'],
      patterns: ['Row total then range'],
      domains: ['Education'],
      ...tag(ss('Box', 'largest difference in total scores between students', 'coding')),
      roles: DE_DA,
      summary: 'Sum each student\'s assignments and return the difference between the best and worst totals.',
      description: md('Each row is `[student, a1, a2, a3]` (scores may be `null` → count as 0). Return the difference between the highest and lowest total; 0 for fewer than two students.'),
      hints: ['`sum(x or 0 for x in scores)`.'],
      entry: 'score_gap',
      signature: 'score_gap(rows: list[list]) -> int',
      solution: code`def score_gap(rows: list[list]) -> int:
    totals = [sum(x or 0 for x in row[1:]) for row in rows]
    return max(totals) - min(totals) if len(totals) >= 2 else 0
`,
      explanation: md('Treating missing scores as 0 is a business decision — say it out loud; the alternative is excluding students with missing assignments.'),
      tests: [
        ex('Example', [['ana', 90, 80, 70], ['raj', 50, null, 60], ['li', 95, 95, 95]]),
        ex('One student', [['x', 1, 2, 3]]),
        hid('All equal', [['a', 1, 1, 1], ['b', 3, 0, 0]]),
        hid('All missing scores', [['a', null, null, null], ['b', 1, 1, 1]]),
      ],
    }),
  ],
};
