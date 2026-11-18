const ev = (user, ts) => ({ user, ts });
const s = (user, session, start, end, events) => ({ user, session, start, end, events });

export default {
  id: 'sessionize-clickstream',
  track: 'python',
  title: 'Sessionize a Clickstream',
  difficulty: 'Medium',
  topics: ['Intervals & Sessions', 'Datetime', 'Sorting', 'Dicts & Sets'],
  patterns: ['Sessionization (inactivity gap)', 'Group then sweep'],
  domains: ['Web analytics'],
  companies: ['Meta', 'Nielsen'],
  sources: [
    { company: 'Meta', label: 'DEV — Meta data engineering interview topics: streaming & intervals', url: 'https://dev.to/gowthampotureddi/meta-data-engineering-interview-questions-top-topics-problems-solutions-304g' },
    { company: 'Nielsen', label: 'SparkPlayground — Nielsen "Sessionize Clickstream Data"', url: 'https://www.sparkplayground.com/pyspark-coding-interview-questions' },
  ],
  summary: 'Split each user\'s events into sessions wherever the gap exceeds a timeout.',

  description: `You get raw clickstream events \`{"user": str, "ts": "YYYY-MM-DD HH:MM:SS"}\` in **no particular order**.

A user's **session** ends when the gap to their next event is **greater than** \`gap_minutes\` (a gap of exactly \`gap_minutes\` stays in the same session).

Return one dict per session:

\`\`\`python
{"user": "a", "session": 1, "start": "2024-05-01 10:00:00", "end": "2024-05-01 10:20:00", "events": 2}
\`\`\`

\`session\` numbers each user's sessions from 1 in time order. Sort the result by \`user\`, then \`session\`.`,

  hints: [
    'Group events by user, then sort each user\'s timestamps.',
    'datetime.strptime(ts, "%Y-%m-%d %H:%M:%S") — and compare differences with timedelta(minutes=gap_minutes).',
    'Walk the sorted times: start a new session when the gap is too big, otherwise extend the current one.',
  ],

  entry: 'sessionize',
  signature: 'sessionize(events: list[dict], gap_minutes: int) -> list[dict]',

  starter: `def sessionize(events: list[dict], gap_minutes: int) -> list[dict]:
    return []
`,

  solution: `from collections import defaultdict
from datetime import datetime, timedelta

FMT = "%Y-%m-%d %H:%M:%S"


def sessionize(events: list[dict], gap_minutes: int) -> list[dict]:
    by_user = defaultdict(list)
    for e in events:
        by_user[e["user"]].append(datetime.strptime(e["ts"], FMT))

    gap = timedelta(minutes=gap_minutes)
    out = []
    for user in sorted(by_user):
        times = sorted(by_user[user])
        start = prev = times[0]
        count, n = 1, 1
        for t in times[1:]:
            if t - prev > gap:
                out.append({"user": user, "session": n, "start": start.strftime(FMT), "end": prev.strftime(FMT), "events": count})
                n, start, count = n + 1, t, 0
            count += 1
            prev = t
        out.append({"user": user, "session": n, "start": start.strftime(FMT), "end": prev.strftime(FMT), "events": count})
    return out
`,

  explanation: `**Group, sort, sweep.** Bucket timestamps per user, sort them, then walk once: whenever the gap to the previous event exceeds the timeout, close the current session and open a new one.

Parsing to \`datetime\` (rather than comparing strings) makes the gap arithmetic correct across hours, midnight and month ends. The same logic in SQL is \`LAG\` + a running \`SUM\` of "new session" flags; in Spark it's the same window trick.

**Complexity:** O(n log n) for the per-user sorts.`,

  tests: [
    {
      name: 'Example',
      args: [[ev('a', '2024-05-01 10:00:00'), ev('b', '2024-05-01 09:00:00'), ev('a', '2024-05-01 10:20:00'), ev('a', '2024-05-01 11:00:00')], 30],
      expected: [s('a', 1, '2024-05-01 10:00:00', '2024-05-01 10:20:00', 2), s('a', 2, '2024-05-01 11:00:00', '2024-05-01 11:00:00', 1), s('b', 1, '2024-05-01 09:00:00', '2024-05-01 09:00:00', 1)],
    },
    {
      name: 'A gap of exactly the timeout stays in the session',
      args: [[ev('a', '2024-05-01 10:30:00'), ev('a', '2024-05-01 10:00:00')], 30],
      expected: [s('a', 1, '2024-05-01 10:00:00', '2024-05-01 10:30:00', 2)],
    },
    { name: 'No events', hidden: true, args: [[], 30], expected: [] },
    {
      name: 'Short timeout',
      hidden: true,
      args: [[ev('x', '2024-05-01 00:12:00'), ev('x', '2024-05-01 00:00:00'), ev('x', '2024-05-01 00:11:00'), ev('x', '2024-05-01 00:05:00')], 5],
      expected: [s('x', 1, '2024-05-01 00:00:00', '2024-05-01 00:05:00', 2), s('x', 2, '2024-05-01 00:11:00', '2024-05-01 00:12:00', 2)],
    },
    {
      name: 'Across midnight',
      hidden: true,
      args: [[ev('y', '2024-05-01 23:50:00'), ev('y', '2024-05-02 00:10:00')], 30],
      expected: [s('y', 1, '2024-05-01 23:50:00', '2024-05-02 00:10:00', 2)],
    },
  ],
};
