export default {
  id: 'time-to-first-scroll',
  track: 'pandas',
  title: 'Time to First Scroll',
  difficulty: 'Medium',
  topics: ['Datetime', 'GroupBy & Aggregation', 'Merge & Join', 'Selection & Filtering'],
  patterns: ['First event after another event', 'Filter → join → aggregate'],
  domains: ['Product analytics'],
  companies: ['Meta'],
  sources: [{ company: 'Meta', label: 'StrataScratch — Facebook "Time Between Two Events"', url: 'https://www.stratascratch.com/blog/python-pandas-interview-questions-for-data-science-part-2' }],
  summary: 'Measure how long each user takes to scroll after their first page load.',

  description: `\`events\` logs app actions: \`page_load\`, \`scroll\`, \`click\`, ….

For each user, take their **first** \`page_load\`, then their first \`scroll\` **at or after** it. Return the gap in whole seconds as \`seconds_to_scroll\`.

Users without a page load, or without a scroll after it, are left out. Return \`user_id\`, \`seconds_to_scroll\`, ordered by \`seconds_to_scroll\`, then \`user_id\`.`,

  hints: [
    'First page load per user: filter, then groupby("user_id")["ts"].min().',
    'Merge scrolls with those first loads and keep scrolls with ts >= first_load.',
    '(scroll_ts - load_ts).dt.total_seconds() — then astype(int).',
  ],

  entry: 'solve',
  signature: 'solve(events: pd.DataFrame) -> pd.DataFrame',
  schema: [{ name: 'events', columns: [['user_id', 'INTEGER', 'User'], ['ts', 'TIMESTAMP', 'When'], ['action', 'VARCHAR', "'page_load' · 'scroll' · 'click' …"]] }],
  outputColumns: ['user_id', 'seconds_to_scroll'],

  starter: `import pandas as pd


def solve(events: pd.DataFrame) -> pd.DataFrame:
    return events[["user_id"]].assign(seconds_to_scroll=0)
`,

  solution: `import pandas as pd


def solve(events: pd.DataFrame) -> pd.DataFrame:
    loads = (events[events["action"] == "page_load"]
             .groupby("user_id", as_index=False)["ts"].min()
             .rename(columns={"ts": "load_ts"}))
    scrolls = events.loc[events["action"] == "scroll", ["user_id", "ts"]]
    after = scrolls.merge(loads, on="user_id")
    after = after[after["ts"] >= after["load_ts"]]
    first = after.groupby("user_id", as_index=False).agg(load_ts=("load_ts", "first"), scroll_ts=("ts", "min"))
    first["seconds_to_scroll"] = (first["scroll_ts"] - first["load_ts"]).dt.total_seconds().astype(int)
    return (first[["user_id", "seconds_to_scroll"]]
            .sort_values(["seconds_to_scroll", "user_id"])
            .reset_index(drop=True))
`,

  explanation: `**Anchor, join, filter, take the first.**

1. The anchor is each user's earliest \`page_load\`.
2. Joining scrolls to the anchor and keeping \`ts >= load_ts\` throws away scrolls that happened before the page loaded (e.g. from an earlier session).
3. The earliest remaining scroll per user gives the gap; \`.dt.total_seconds()\` converts the \`Timedelta\`.

**Complexity:** O(n log n) for the group-bys.`,

  tests: [
    {
      name: 'Example',
      ordered: true,
      tables: {
        events: [
          [1, '2024-05-01 10:00:00', 'page_load'], [1, '2024-05-01 10:00:07', 'scroll'], [1, '2024-05-01 10:00:20', 'scroll'],
          [2, '2024-05-01 11:00:00', 'page_load'], [2, '2024-05-01 11:00:03', 'scroll'], [3, '2024-05-01 12:00:00', 'page_load'],
        ],
      },
      expected: [[2, 3], [1, 7]],
    },
    {
      name: 'A scroll before the first load is ignored',
      ordered: true,
      tables: { events: [[4, '2024-05-02 09:00:00', 'scroll'], [4, '2024-05-02 09:01:00', 'page_load'], [4, '2024-05-02 09:01:30', 'click'], [4, '2024-05-02 09:02:00', 'scroll']] },
      expected: [[4, 60]],
    },
    {
      name: 'Only the first page load anchors; ties by user_id',
      hidden: true,
      ordered: true,
      tables: {
        events: [
          [6, '2024-05-03 08:00:10', 'page_load'], [6, '2024-05-03 08:00:00', 'page_load'], [6, '2024-05-03 08:00:15', 'scroll'],
          [5, '2024-05-03 07:00:00', 'page_load'], [5, '2024-05-03 07:00:15', 'scroll'],
        ],
      },
      expected: [[5, 15], [6, 15]],
    },
    { name: 'Scroll at the same instant', hidden: true, ordered: true, tables: { events: [[9, '2024-05-04 10:00:00', 'page_load'], [9, '2024-05-04 10:00:00', 'scroll']] }, expected: [[9, 0]] },
    { name: 'Nobody scrolls', hidden: true, ordered: true, tables: { events: [[1, '2024-05-04 10:00:00', 'page_load']] }, expected: [] },
  ],
};
