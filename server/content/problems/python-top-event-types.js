const e = (user, type) => ({ user, type });

export default {
  id: 'top-event-types',
  track: 'python',
  title: 'Top Event Types per User',
  difficulty: 'Easy',
  topics: ['Dicts & Sets', 'Sorting', 'Comprehensions'],
  patterns: ['Frequency count (Counter)', 'Top-N per group'],
  domains: ['Event streaming'],
  companies: ['Meta'],
  sources: [{ company: 'Meta', label: 'DEV — Meta data engineering interview topics: hash maps & counting', url: 'https://dev.to/gowthampotureddi/meta-data-engineering-interview-questions-top-topics-problems-solutions-304g' }],
  summary: 'Count events per user and keep each user\'s N most frequent types.',

  description: `Given events \`{"user": str, "type": str}\`, return a dict mapping each user to their **\`n\` most frequent event types**, most frequent first.

Ties in frequency are broken **alphabetically**. If a user has fewer than \`n\` types, return all of them.`,

  hints: [
    'A dict of Counters: counts[user][type] += 1.',
    'Sort each user\'s (type, count) pairs by (-count, type).',
    'Slice the first n.',
  ],

  entry: 'top_event_types',
  signature: 'top_event_types(events: list[dict], n: int) -> dict[str, list[str]]',

  starter: `def top_event_types(events: list[dict], n: int) -> dict[str, list[str]]:
    return {}
`,

  solution: `from collections import Counter, defaultdict


def top_event_types(events: list[dict], n: int) -> dict[str, list[str]]:
    counts = defaultdict(Counter)
    for e in events:
        counts[e["user"]][e["type"]] += 1
    return {
        user: [t for t, _ in sorted(c.items(), key=lambda kv: (-kv[1], kv[0]))[:n]]
        for user, c in counts.items()
    }
`,

  explanation: `**Count, then sort with a composite key.** \`Counter\` per user does the counting in one pass. Sorting by \`(-count, type)\` puts the most frequent first and breaks ties alphabetically — negating the count avoids \`reverse=True\`, which would also reverse the alphabetical tie-break.

\`Counter.most_common(n)\` is tempting but breaks ties by insertion order, not alphabetically.

**Complexity:** O(n) to count plus O(k log k) per user for k distinct types.`,

  tests: [
    {
      name: 'Example',
      args: [[e('u1', 'click'), e('u1', 'purchase'), e('u2', 'view'), e('u1', 'click'), e('u1', 'view'), e('u1', 'purchase'), e('u1', 'click')], 2],
      expected: { u1: ['click', 'purchase'], u2: ['view'] },
    },
    { name: 'Ties are alphabetical', args: [[e('u1', 'b'), e('u1', 'a'), e('u1', 'c'), e('u1', 'b'), e('u1', 'a')], 2], expected: { u1: ['a', 'b'] } },
    { name: 'No events', hidden: true, args: [[], 3], expected: {} },
    { name: 'n larger than the number of types', hidden: true, args: [[e('z', 'x'), e('z', 'y'), e('z', 'y')], 5], expected: { z: ['y', 'x'] } },
    { name: 'Insertion order must not decide ties', hidden: true, args: [[e('q', 'zeta'), e('q', 'alpha')], 1], expected: { q: ['alpha'] } },
  ],
};
