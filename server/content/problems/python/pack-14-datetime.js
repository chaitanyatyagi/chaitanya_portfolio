// Python pack 14 — time, datetime and timedelta: parsing and formatting,
// date arithmetic, weekdays and ISO weeks, business days, month arithmetic,
// fixed UTC offsets, epoch seconds with the time module, and the
// date-window problems interviews love (consecutive days, alert windows,
// expiring holds).
import { python, md, code, ex, hid } from './define.js';
import { dev, ddp, ss, lds, tag } from './sources.js';

const DE = ['Data Engineer'];
const DE_DA = ['Data Engineer', 'Data Analyst'];

export default {
  problems: [
    python({
      id: 'booking-lead-time',
      title: 'Average Days Between Booking and Check-In',
      difficulty: 'Easy',
      topics: ['Datetime', 'Data Wrangling'],
      patterns: ['Date difference with timedelta'],
      domains: ['Travel'],
      ...tag(lds('Verizon', 'verizon', 'Subscription Duration in Days')),
      roles: DE_DA,
      summary: 'Compute the average lead time per host from booking and check-in dates.',
      description: md('Each booking is `[host_id, booked_on, check_in]` with ISO dates. Return `{host_id: average lead time in days}` rounded to 1, hosts sorted, ignoring bookings whose check-in is before the booking date.'),
      hints: ['`date.fromisoformat(s)`; subtracting dates gives a `timedelta` with `.days`.'],
      entry: 'lead_times',
      signature: 'lead_times(bookings: list[list[str]]) -> dict[str, float]',
      solution: code`from datetime import date

def lead_times(bookings: list[list[str]]) -> dict[str, float]:
    days = {}
    for host, booked, check_in in bookings:
        delta = (date.fromisoformat(check_in) - date.fromisoformat(booked)).days
        if delta >= 0:
            days.setdefault(host, []).append(delta)
    return {h: round(sum(v) / len(v), 1) for h, v in sorted(days.items())}
`,
      explanation: md('Date subtraction yields a `timedelta`; `.days` is the whole number of days. Filtering impossible rows (check-in before booking) before averaging keeps one bad record from skewing a host\'s metric.'),
      tests: [
        ex('Example', [['h1', '2024-01-01', '2024-01-11'], ['h1', '2024-02-01', '2024-02-03'], ['h2', '2024-03-10', '2024-03-10']]),
        ex('Impossible rows dropped', [['h', '2024-05-02', '2024-05-01']]),
        hid('Across a leap day', [['x', '2024-02-28', '2024-03-01']]),
        hid('Empty', []),
      ],
    }),

    python({
      id: 'signups-by-weekday',
      title: 'Signups by Day of the Week',
      difficulty: 'Easy',
      topics: ['Datetime', 'Hash Maps & Counting'],
      patterns: ['Bucket by weekday'],
      domains: ['Health & fitness'],
      ...tag(ss('Noom', 'Signup By Day')),
      roles: DE_DA,
      summary: 'Count signups per weekday name, Monday first, including days with zero.',
      description: md('Given ISO datetimes of signups, return `[[weekday name, count]]` for all seven days in order Monday → Sunday (zero counts included).'),
      hints: ['`datetime.fromisoformat(s).weekday()` is 0 for Monday; `calendar.day_name` gives the names.'],
      entry: 'by_weekday',
      signature: 'by_weekday(signups: list[str]) -> list[list]',
      solution: code`import calendar
from datetime import datetime

def by_weekday(signups: list[str]) -> list[list]:
    counts = [0] * 7
    for s in signups:
        counts[datetime.fromisoformat(s).weekday()] += 1
    return [[calendar.day_name[i], counts[i]] for i in range(7)]
`,
      explanation: md('Pre-sizing the buckets guarantees every weekday appears, even with zero signups — the Python equivalent of LEFT JOINing to a calendar. `weekday()` is Monday=0; `isoweekday()` is Monday=1.'),
      tests: [
        ex('Example', ['2024-07-01T09:00:00', '2024-07-02T10:00:00', '2024-07-08T23:59:00', '2024-07-07T00:00:00']),
        ex('No signups', []),
        hid('Dates without times', ['2024-12-25', '2024-12-25']),
        hid('A full week', ['2024-09-02', '2024-09-03', '2024-09-04', '2024-09-05', '2024-09-06', '2024-09-07', '2024-09-08']),
      ],
    }),

    python({
      id: 'consecutive-login-days',
      title: 'No Days Off: Users with a Login Streak',
      difficulty: 'Medium',
      topics: ['Datetime', 'Intervals & Sessions'],
      patterns: ['Gaps and islands on dates'],
      domains: ['Product analytics'],
      ...tag(ddp('Salesforce', 'No Days Off')),
      roles: DE_DA,
      summary: 'Find users who logged in on at least k consecutive calendar days.',
      description: md('Each activity is `[user, ISO datetime]` (users can log in many times a day). Return the sorted users who were active on at least `k` **consecutive calendar days**, together with their longest streak: `[[user, longest_streak]]`.'),
      hints: ['Reduce to a sorted set of dates per user, then walk them: a date exactly one day after the previous extends the streak.'],
      entry: 'streak_users',
      signature: 'streak_users(activity: list[list[str]], k: int) -> list[list]',
      solution: code`from datetime import datetime, timedelta

def streak_users(activity: list[list[str]], k: int) -> list[list]:
    days = {}
    for user, ts in activity:
        days.setdefault(user, set()).add(datetime.fromisoformat(ts).date())
    out = []
    for user in sorted(days):
        best = cur = 0
        prev = None
        for d in sorted(days[user]):
            cur = cur + 1 if prev is not None and d - prev == timedelta(days=1) else 1
            best = max(best, cur)
            prev = d
        if best >= k:
            out.append([user, best])
    return out
`,
      explanation: md('Deduplicating to calendar dates first is essential — two logins on one day must not count as two days. Comparing with `timedelta(days=1)` handles month and year boundaries correctly, which string tricks on `"YYYY-MM-DD"` don\'t.'),
      tests: [
        ex('Example', [['ana', '2024-01-30T08:00:00'], ['ana', '2024-01-31T22:00:00'], ['ana', '2024-02-01T07:00:00'], ['raj', '2024-01-01T00:00:00'], ['raj', '2024-01-03T00:00:00']], 3),
        ex('Same day twice is one day', [['li', '2024-05-01T01:00:00'], ['li', '2024-05-01T23:00:00']], 2),
        hid('Year boundary', [['zoe', '2023-12-31T12:00:00'], ['zoe', '2024-01-01T12:00:00']], 2),
        hid('k = 1 includes everyone active', [['a', '2024-01-01T00:00:00'], ['b', '2024-01-05T00:00:00']], 1),
      ],
    }),

    python({
      id: 'failed-login-alerts',
      title: 'Alert on Bursts of Failed Logins',
      difficulty: 'Medium',
      topics: ['Datetime', 'Two Pointers & Sliding Window', 'Hash Maps & Counting'],
      patterns: ['Time-window counting per key'],
      domains: ['Networking / Security'],
      ...tag(dev('Walmart', 'hash tables for time-window security alerts')),
      roles: DE,
      summary: 'Flag users with N failed logins inside any rolling window of M minutes.',
      description: md('Events are `[user, ISO datetime, "fail" | "ok"]`, not sorted. Return the sorted list of users who had at least `n` failures within any window of `minutes` minutes (inclusive: failures at 10:00 and 10:10 are within a 10-minute window).'),
      hints: ['Group failure times per user and sort them; then slide a window: the failures at positions `i` and `i + n - 1` must be ≤ `minutes` apart.'],
      entry: 'alert_users',
      signature: 'alert_users(events: list[list[str]], n: int, minutes: int) -> list[str]',
      solution: code`from datetime import datetime, timedelta

def alert_users(events: list[list[str]], n: int, minutes: int) -> list[str]:
    fails = {}
    for user, ts, result in events:
        if result == "fail":
            fails.setdefault(user, []).append(datetime.fromisoformat(ts))
    window = timedelta(minutes=minutes)
    flagged = []
    for user, times in fails.items():
        times.sort()
        if any(times[i + n - 1] - times[i] <= window for i in range(len(times) - n + 1)):
            flagged.append(user)
    return sorted(flagged)
`,
      explanation: md('After sorting, "n events within a window" is equivalent to "some run of n consecutive events spans at most the window" — an O(k log k) check per user instead of comparing every pair.'),
      tests: [
        ex('Example', [['u1', '2024-01-01T10:00:00', 'fail'], ['u1', '2024-01-01T10:04:00', 'fail'], ['u1', '2024-01-01T10:09:59', 'fail'], ['u2', '2024-01-01T10:00:00', 'fail'], ['u2', '2024-01-01T10:20:00', 'fail'], ['u2', '2024-01-01T10:21:00', 'ok']], 3, 10),
        ex('Successes don\'t count', [['x', '2024-01-01T00:00:00', 'ok'], ['x', '2024-01-01T00:00:01', 'ok']], 1, 5),
        hid('Inclusive boundary', [['b', '2024-01-01T10:10:00', 'fail'], ['b', '2024-01-01T10:00:00', 'fail']], 2, 10),
        hid('Just outside', [['c', '2024-01-01T10:00:00', 'fail'], ['c', '2024-01-01T10:10:01', 'fail']], 2, 10),
      ],
    }),

    python({
      id: 'business-days-count',
      title: 'Business Days Between Two Dates',
      difficulty: 'Medium',
      topics: ['Datetime'],
      patterns: ['Calendar arithmetic'],
      domains: ['Finance'],
      roles: DE_DA,
      summary: 'Count weekdays between two dates, excluding holidays, in O(1) per week.',
      description: md('Return the number of business days from `start` (inclusive) to `end` (exclusive): Monday–Friday that are not in `holidays` (ISO dates). If `end <= start`, return 0.'),
      hints: ['Whole weeks contribute 5 days each; only the remainder needs a day-by-day loop. Then subtract holidays in range that fall on weekdays.'],
      entry: 'business_days',
      signature: 'business_days(start: str, end: str, holidays: list[str]) -> int',
      solution: code`from datetime import date, timedelta

def business_days(start: str, end: str, holidays: list[str]) -> int:
    s, e = date.fromisoformat(start), date.fromisoformat(end)
    if e <= s:
        return 0
    total_days = (e - s).days
    weeks, rest = divmod(total_days, 7)
    count = weeks * 5
    for i in range(rest):
        if (s + timedelta(days=weeks * 7 + i)).weekday() < 5:
            count += 1
    hols = {date.fromisoformat(h) for h in holidays}
    count -= sum(1 for h in hols if s <= h < e and h.weekday() < 5)
    return count
`,
      explanation: md('Every 7 consecutive days contain exactly 5 weekdays, so only the leftover days need inspecting — O(1) instead of O(days). Holidays are subtracted only if they fall inside the range on a weekday (a holiday on Saturday was never counted). Deduplicating holidays with a set avoids double subtraction.'),
      tests: [
        ex('Example', '2024-07-01', '2024-07-15', ['2024-07-04']),
        ex('End before start', '2024-07-10', '2024-07-01', []),
        hid('Weekend only', '2024-07-06', '2024-07-08', []),
        hid('Holiday on a weekend is ignored', '2024-07-01', '2024-07-08', ['2024-07-06', '2024-07-06']),
        hid('Long range', '2024-01-01', '2025-01-01', []),
      ],
    }),

    python({
      id: 'humanize-duration',
      title: 'Format Job Durations from Seconds',
      difficulty: 'Easy',
      topics: ['Datetime', 'Strings'],
      patterns: ['timedelta / divmod'],
      domains: ['Platform / Ops'],
      roles: DE,
      summary: 'Render a number of seconds as "1d 2h 3m 4s", omitting zero units.',
      description: md('Format each non-negative number of seconds (int or float — round to the nearest second first) as days/hours/minutes/seconds, e.g. `93784` → `"1d 2h 3m 4s"`, skipping zero units; `0` → `"0s"`.'),
      hints: ['`divmod` repeatedly, or `timedelta(seconds=n)` for days and seconds.'],
      entry: 'humanize',
      signature: 'humanize(durations: list[float]) -> list[str]',
      solution: code`def humanize(durations: list[float]) -> list[str]:
    out = []
    for d in durations:
        s = round(d)
        days, s = divmod(s, 86400)
        hours, s = divmod(s, 3600)
        minutes, s = divmod(s, 60)
        parts = [f"{v}{u}" for v, u in ((days, "d"), (hours, "h"), (minutes, "m"), (s, "s")) if v]
        out.append(" ".join(parts) or "0s")
    return out
`,
      explanation: md('`divmod(n, unit)` returns the quotient and remainder in one step — the standard way to break a duration into units. (`str(timedelta(seconds=n))` gives `"1 day, 2:03:04"`, fine for logs but not this format.)'),
      tests: [
        ex('Example', [93784, 59.6, 3600]),
        ex('Zero', [0]),
        hid('Exactly one day', [86400]),
        hid('Minutes and seconds', [61, 3599]),
      ],
    }),

    python({
      id: 'parse-mixed-date-formats',
      title: 'Normalise Dates in Mixed Formats',
      difficulty: 'Medium',
      topics: ['Datetime', 'Error Handling', 'Data Wrangling'],
      patterns: ['Try formats in order'],
      domains: ['Data quality'],
      roles: DE,
      summary: 'Parse dates written several ways into ISO format, rejecting ambiguous and invalid ones.',
      description: md(
        'Normalise each string to `YYYY-MM-DD` by trying these formats in order: `%Y-%m-%d`, `%d/%m/%Y`, `%d-%b-%Y` (e.g. `05-Mar-2024`), `%B %d, %Y` (e.g. `March 5, 2024`), `%Y%m%d`. Strip spaces first. Return `None` for strings no format accepts (including impossible dates like `2024-02-30`).',
      ),
      hints: ['`datetime.strptime(s, fmt)` raises `ValueError` on a mismatch — loop over formats and `continue`.'],
      entry: 'normalise_dates',
      signature: 'normalise_dates(values: list[str]) -> list',
      solution: code`from datetime import datetime

FORMATS = ["%Y-%m-%d", "%d/%m/%Y", "%d-%b-%Y", "%B %d, %Y", "%Y%m%d"]

def normalise_dates(values: list[str]) -> list:
    out = []
    for v in values:
        text = v.strip()
        for fmt in FORMATS:
            try:
                out.append(datetime.strptime(text, fmt).date().isoformat())
                break
            except ValueError:
                continue
        else:
            out.append(None)
    return out
`,
      explanation: md('`strptime` validates as it parses, so impossible dates fail rather than roll over. The order of formats is a policy decision — `%d/%m/%Y` vs `%m/%d/%Y` is genuinely ambiguous for `03/04/2024`, so pick one per source and document it.'),
      tests: [
        ex('Example', ['2024-03-05', '05/03/2024', '05-Mar-2024', 'March 5, 2024', '20240305']),
        ex('Invalid values', ['2024-02-30', 'yesterday', '']),
        hid('Spaces trimmed', ['  2023-12-31 ']),
        hid('Leap day', ['29/02/2024', '29/02/2023']),
      ],
    }),

    python({
      id: 'utc-to-local-offsets',
      title: 'Convert UTC Timestamps to Store-Local Time',
      difficulty: 'Medium',
      topics: ['Datetime'],
      patterns: ['Fixed-offset time zones'],
      domains: ['Retail'],
      roles: DE,
      summary: 'Shift UTC events into each store\'s fixed offset and bucket them by local date.',
      description: md(
        'Events are `[store, UTC ISO datetime]`; `offsets` maps store → offset like `"+05:30"` or `"-04:00"`. Convert each event to the store\'s local time and return `{store: {local_date: count}}` (stores and dates sorted).',
      ),
      hints: ['Build `timezone(timedelta(hours=h, minutes=m))` with the sign applied to both parts.', 'Attach UTC with `.replace(tzinfo=timezone.utc)`, then `.astimezone(tz)`.'],
      entry: 'local_daily_counts',
      signature: 'local_daily_counts(events: list[list[str]], offsets: dict[str, str]) -> dict',
      solution: code`from datetime import datetime, timedelta, timezone

def _tz(offset):
    sign = -1 if offset.startswith("-") else 1
    hours, minutes = offset.lstrip("+-").split(":")
    return timezone(sign * timedelta(hours=int(hours), minutes=int(minutes)))

def local_daily_counts(events: list[list[str]], offsets: dict[str, str]) -> dict:
    out = {}
    for store, ts in events:
        local = datetime.fromisoformat(ts).replace(tzinfo=timezone.utc).astimezone(_tz(offsets[store]))
        day = local.date().isoformat()
        out.setdefault(store, {})
        out[store][day] = out[store].get(day, 0) + 1
    return {s: dict(sorted(out[s].items())) for s in sorted(out)}
`,
      explanation: md('Store "daily sales" must use the store\'s calendar day: an order at 20:00 UTC is already the next day in India. Applying the sign to the whole `timedelta` (not just the hours) gets `"-04:30"` right. Real zones with DST need `zoneinfo`; fixed offsets suffice here.'),
      tests: [
        ex('Example', [['blr', '2024-03-01T20:00:00'], ['blr', '2024-03-01T17:00:00'], ['nyc', '2024-03-02T02:00:00']], { blr: '+05:30', nyc: '-05:00' }),
        ex('UTC store', [['ldn', '2024-01-01T00:00:00']], { ldn: '+00:00' }),
        hid('Half-hour negative offset', [['stj', '2024-06-01T02:00:00']], { stj: '-03:30' }),
        hid('Same local day from different UTC days', [['tyo', '2024-01-01T16:00:00'], ['tyo', '2024-01-02T10:00:00']], { tyo: '+09:00' }),
      ],
    }),

    python({
      id: 'add-months-clamp',
      title: 'Add Months to a Date Without Overflow',
      difficulty: 'Medium',
      topics: ['Datetime', 'Math & Bits'],
      patterns: ['Month arithmetic with clamping'],
      domains: ['Subscriptions / SaaS'],
      roles: DE,
      summary: 'Compute subscription renewal dates: Jan 31 + 1 month is Feb 29 (or 28), not an error.',
      description: md('For each `[ISO date, months]` (months may be negative), return the date shifted by that many calendar months, clamping the day to the last day of the target month.'),
      hints: ['Work in a month index: `total = year * 12 + (month - 1) + months`, then `divmod(total, 12)`.', '`calendar.monthrange(y, m)[1]` is the number of days in the month.'],
      entry: 'add_months',
      signature: 'add_months(cases: list[list]) -> list[str]',
      solution: code`import calendar
from datetime import date

def add_months(cases: list[list]) -> list[str]:
    out = []
    for iso, months in cases:
        d = date.fromisoformat(iso)
        y, m0 = divmod(d.year * 12 + (d.month - 1) + months, 12)
        last = calendar.monthrange(y, m0 + 1)[1]
        out.append(date(y, m0 + 1, min(d.day, last)).isoformat())
    return out
`,
      explanation: md('`timedelta` has no "months" because months have different lengths. Converting to a month count makes year wrap-around (including negative months) one `divmod`, and clamping matches how billing systems handle the 29th–31st.'),
      tests: [
        ex('Example', [['2024-01-31', 1], ['2023-01-31', 1], ['2024-03-15', -3]]),
        ex('Zero months', [['2024-05-05', 0]]),
        hid('Across years', [['2024-11-30', 3], ['2024-02-29', 12]]),
        hid('Large negative', [['2024-03-31', -25]]),
      ],
    }),

    python({
      id: 'epoch-time-module',
      title: 'Epoch Seconds with the time Module',
      difficulty: 'Easy',
      topics: ['Datetime'],
      patterns: ['time.gmtime / strftime'],
      domains: ['Event pipelines'],
      roles: DE,
      summary: 'Convert epoch timestamps (seconds or milliseconds) to UTC strings with the time module.',
      description: md('Each value is an epoch timestamp in seconds **or** milliseconds (values above 10¹¹ are milliseconds). Return `[UTC string "YYYY-MM-DD HH:MM:SS", weekday name abbreviation]` for each, using `time.gmtime` and `time.strftime`.'),
      hints: ['`time.gmtime(seconds)` gives a `struct_time` in UTC; `time.strftime("%Y-%m-%d %H:%M:%S %a", st)`.'],
      entry: 'epoch_to_utc',
      signature: 'epoch_to_utc(values: list[float]) -> list[list[str]]',
      solution: code`import time

def epoch_to_utc(values: list[float]) -> list[list[str]]:
    out = []
    for v in values:
        seconds = v / 1000 if v > 1e11 else v
        st = time.gmtime(seconds)
        out.append([time.strftime("%Y-%m-%d %H:%M:%S", st), time.strftime("%a", st)])
    return out
`,
      explanation: md('`time.gmtime` interprets epoch seconds in UTC (`time.localtime` would use the machine\'s zone — a common source of off-by-hours bugs). Many APIs send milliseconds; a magnitude check is a pragmatic way to accept both.'),
      tests: [
        ex('Example', [0, 1700000000, 1700000000000]),
        ex('Fractional seconds', [86399.9]),
        hid('Leap year day', [1709164800]),
        hid('Milliseconds with a fraction', [1700000000123.0]),
      ],
    }),

    python({
      id: 'card-holds-expiry',
      title: 'What the Card Remembers: Expiring Holds',
      difficulty: 'Medium',
      topics: ['Datetime', 'Streaming & State'],
      patterns: ['Expiry by timestamp'],
      domains: ['Payments'],
      ...tag(ddp('Capital One', 'What the Card Remembers')),
      roles: DE,
      summary: 'Compute available credit at query times, given authorisation holds that expire.',
      description: md(
        'A card has `limit` credit. Each hold is `[hold_id, amount, placed_at, ttl_hours]` (ISO datetime); a hold reduces available credit from `placed_at` (inclusive) until `placed_at + ttl` (exclusive). `releases` lists `[hold_id, released_at]` for holds released early. For each query time, return the available credit rounded to 2.',
      ),
      hints: ['A hold is active at time `t` when `placed <= t < min(expiry, released_at)`.'],
      entry: 'available_credit',
      signature: 'available_credit(limit: float, holds: list[list], releases: list[list], queries: list[str]) -> list[float]',
      solution: code`from datetime import datetime, timedelta

def available_credit(limit: float, holds: list[list], releases: list[list], queries: list[str]) -> list[float]:
    released = {h: datetime.fromisoformat(t) for h, t in releases}
    windows = []
    for hold_id, amount, placed, ttl in holds:
        start = datetime.fromisoformat(placed)
        end = start + timedelta(hours=ttl)
        if hold_id in released:
            end = min(end, released[hold_id])
        windows.append((start, end, amount))
    out = []
    for q in queries:
        t = datetime.fromisoformat(q)
        out.append(round(limit - sum(a for s, e, a in windows if s <= t < e), 2))
    return out
`,
      explanation: md('Each hold becomes a half-open interval `[start, end)`; a release only ever shortens it. Half-open intervals make boundaries unambiguous: at the exact expiry instant the hold no longer counts. For many queries, sort the boundaries and sweep instead of scanning every hold.'),
      tests: [
        ex('Example', 1000, [['h1', 200, '2024-01-01T10:00:00', 24], ['h2', 50.5, '2024-01-01T12:00:00', 1]], [['h1', '2024-01-01T18:00:00']], ['2024-01-01T09:00:00', '2024-01-01T12:30:00', '2024-01-01T13:00:00', '2024-01-01T18:00:00']),
        ex('No holds', 500, [], [], ['2024-01-01T00:00:00']),
        hid('Expiry instant excluded', 100, [['h', 40, '2024-01-01T00:00:00', 2]], [], ['2024-01-01T01:59:59', '2024-01-01T02:00:00']),
        hid('Release after expiry changes nothing', 100, [['h', 10, '2024-01-01T00:00:00', 1]], [['h', '2024-01-02T00:00:00']], ['2024-01-01T00:30:00', '2024-01-01T01:30:00']),
      ],
    }),
  ],
};
