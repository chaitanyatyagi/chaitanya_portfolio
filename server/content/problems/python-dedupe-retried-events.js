export default {
  id: 'dedupe-retried-events',
  track: 'python',
  title: 'Deduplicate Retried Events',
  difficulty: 'Easy',
  topics: ['Dicts & Sets', 'Sorting', 'Data Wrangling'],
  patterns: ['Latest record per key', 'Hash map lookup', 'Multi-key sort'],
  domains: ['Event streaming'],
  companies: [],
  sources: [],
  summary: 'Collapse at-least-once duplicates to the latest copy of each event.',

  description: `An ingestion service delivers events **at least once**: when a producer retries, the same \`event_id\` can arrive several times — sometimes with corrected fields.

Write \`dedupe_events(events)\` that takes a list of event dicts and returns the **deduplicated** list.

Each event has the keys \`event_id\`, \`user_id\`, \`event_type\` and \`ingested_at\` (a \`"YYYY-MM-DD HH:MM:SS"\` string).

- For each \`event_id\`, keep the copy with the **latest** \`ingested_at\`.
- If several copies share that latest \`ingested_at\`, keep the one that appears **first** in the input.
- Return the kept events sorted by \`ingested_at\` ascending, breaking ties by \`event_id\` ascending.
- An empty input returns an empty list.`,

  hints: [
    'A dict keyed by event_id lets you keep "the best copy so far" in a single pass.',
    'Only replace the stored copy when the new one is strictly later — that keeps the first copy on ties.',
    'Timestamps in this fixed format sort correctly as plain strings.',
    'sorted(..., key=lambda e: (e["ingested_at"], e["event_id"])) sorts by two fields at once.',
  ],

  entry: 'dedupe_events',
  signature: 'dedupe_events(events: list[dict]) -> list[dict]',

  starter: `def dedupe_events(events: list[dict]) -> list[dict]:
    """Keep the latest copy of each event_id, sorted by (ingested_at, event_id)."""
    # Write your solution here
    return events
`,

  solution: `def dedupe_events(events: list[dict]) -> list[dict]:
    latest = {}
    for event in events:
        current = latest.get(event["event_id"])
        # Strictly later wins, so the first copy is kept on ties.
        if current is None or event["ingested_at"] > current["ingested_at"]:
            latest[event["event_id"]] = event
    return sorted(latest.values(), key=lambda e: (e["ingested_at"], e["event_id"]))
`,

  explanation: `**Single pass with a dict, then one sort.**

- \`latest\` maps each \`event_id\` to the best copy seen so far. A copy replaces it only when its \`ingested_at\` is **strictly** greater, which naturally keeps the first copy when timestamps tie.
- ISO-like \`YYYY-MM-DD HH:MM:SS\` strings compare correctly lexicographically, so no datetime parsing is needed.
- Sorting by the tuple \`(ingested_at, event_id)\` handles the tie-break in one call.

**Complexity:** O(n) to deduplicate plus O(k log k) to sort the k unique events. This is the same "keep latest per key" logic you'd write as \`ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY ingested_at DESC)\` in SQL.`,

  tests: [
    {
      name: 'Example',
      args: [[
        { event_id: 'e1', user_id: 'u1', event_type: 'click', ingested_at: '2024-03-01 10:00:00' },
        { event_id: 'e2', user_id: 'u2', event_type: 'view', ingested_at: '2024-03-01 10:00:05' },
        { event_id: 'e1', user_id: 'u1', event_type: 'purchase', ingested_at: '2024-03-01 10:00:09' },
        { event_id: 'e3', user_id: 'u1', event_type: 'view', ingested_at: '2024-03-01 10:00:07' },
      ]],
      expected: [
        { event_id: 'e2', user_id: 'u2', event_type: 'view', ingested_at: '2024-03-01 10:00:05' },
        { event_id: 'e3', user_id: 'u1', event_type: 'view', ingested_at: '2024-03-01 10:00:07' },
        { event_id: 'e1', user_id: 'u1', event_type: 'purchase', ingested_at: '2024-03-01 10:00:09' },
      ],
    },
    {
      name: 'No duplicates, unsorted input',
      args: [[
        { event_id: 'e9', user_id: 'u4', event_type: 'view', ingested_at: '2024-03-02 12:00:00' },
        { event_id: 'e7', user_id: 'u5', event_type: 'click', ingested_at: '2024-03-02 11:00:00' },
      ]],
      expected: [
        { event_id: 'e7', user_id: 'u5', event_type: 'click', ingested_at: '2024-03-02 11:00:00' },
        { event_id: 'e9', user_id: 'u4', event_type: 'view', ingested_at: '2024-03-02 12:00:00' },
      ],
    },
    {
      name: 'Tie on ingested_at keeps the first copy',
      args: [[
        { event_id: 'a', user_id: 'u1', event_type: 'click', ingested_at: '2024-03-03 09:00:00' },
        { event_id: 'a', user_id: 'u1', event_type: 'view', ingested_at: '2024-03-03 09:00:00' },
        { event_id: 'b', user_id: 'u2', event_type: 'click', ingested_at: '2024-03-03 09:00:00' },
      ]],
      expected: [
        { event_id: 'a', user_id: 'u1', event_type: 'click', ingested_at: '2024-03-03 09:00:00' },
        { event_id: 'b', user_id: 'u2', event_type: 'click', ingested_at: '2024-03-03 09:00:00' },
      ],
    },
    {
      name: 'Empty input',
      hidden: true,
      args: [[]],
      expected: [],
    },
    {
      name: 'Many retries of one event',
      hidden: true,
      args: [[
        { event_id: 'e5', user_id: 'u9', event_type: 't1', ingested_at: '2024-03-04 09:00:00' },
        { event_id: 'e5', user_id: 'u9', event_type: 't2', ingested_at: '2024-03-04 09:30:00' },
        { event_id: 'e5', user_id: 'u9', event_type: 't3', ingested_at: '2024-03-04 09:15:00' },
        { event_id: 'e5', user_id: 'u9', event_type: 't4', ingested_at: '2024-03-04 09:30:00' },
      ]],
      expected: [
        { event_id: 'e5', user_id: 'u9', event_type: 't2', ingested_at: '2024-03-04 09:30:00' },
      ],
    },
    {
      name: 'Stale retry arrives late',
      hidden: true,
      args: [[
        { event_id: 'x1', user_id: 'u1', event_type: 'view', ingested_at: '2024-03-05 08:00:00' },
        { event_id: 'x2', user_id: 'u2', event_type: 'view', ingested_at: '2024-03-05 08:00:00' },
        { event_id: 'x1', user_id: 'u1', event_type: 'click', ingested_at: '2024-03-05 07:59:59' },
        { event_id: 'x3', user_id: 'u3', event_type: 'view', ingested_at: '2024-03-05 08:00:01' },
        { event_id: 'x2', user_id: 'u2', event_type: 'purchase', ingested_at: '2024-03-05 08:00:02' },
      ]],
      expected: [
        { event_id: 'x1', user_id: 'u1', event_type: 'view', ingested_at: '2024-03-05 08:00:00' },
        { event_id: 'x3', user_id: 'u3', event_type: 'view', ingested_at: '2024-03-05 08:00:01' },
        { event_id: 'x2', user_id: 'u2', event_type: 'purchase', ingested_at: '2024-03-05 08:00:02' },
      ],
    },
    {
      name: 'Same timestamp across different events',
      hidden: true,
      args: [[
        { event_id: 'c', user_id: 'u1', event_type: 'view', ingested_at: '2024-03-06 10:00:00' },
        { event_id: 'a', user_id: 'u2', event_type: 'view', ingested_at: '2024-03-06 10:00:00' },
        { event_id: 'b', user_id: 'u3', event_type: 'view', ingested_at: '2024-03-06 09:59:59' },
        { event_id: 'a', user_id: 'u2', event_type: 'click', ingested_at: '2024-03-06 10:00:00' },
      ]],
      expected: [
        { event_id: 'b', user_id: 'u3', event_type: 'view', ingested_at: '2024-03-06 09:59:59' },
        { event_id: 'a', user_id: 'u2', event_type: 'view', ingested_at: '2024-03-06 10:00:00' },
        { event_id: 'c', user_id: 'u1', event_type: 'view', ingested_at: '2024-03-06 10:00:00' },
      ],
    },
  ],
};
