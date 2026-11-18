export default {
  id: 'merge-busy-intervals',
  track: 'python',
  title: 'Merge Busy Intervals',
  difficulty: 'Medium',
  topics: ['Intervals & Sessions', 'Sorting', 'Lists & Tuples'],
  patterns: ['Sort and sweep (merge intervals)'],
  domains: ['Scheduling'],
  companies: ['Meta'],
  sources: [{ company: 'Meta', label: 'DEV — Meta data engineering interview topics: merge overlapping ranges', url: 'https://dev.to/gowthampotureddi/meta-data-engineering-interview-questions-top-topics-problems-solutions-304g' }],
  summary: 'Collapse overlapping or touching time ranges into continuous busy blocks.',

  description: `A meeting room's bookings are \`[start, end]\` pairs in minutes since midnight (\`start <= end\`), in any order.

Merge them into continuous **busy blocks**: bookings that **overlap or touch** (one ends exactly when the next starts) become one block.

Return the blocks as \`[start, end]\` lists sorted by \`start\`.`,

  hints: [
    'Sort by start time first — then overlapping bookings are next to each other.',
    'Keep a "current block". If the next booking starts at or before the block\'s end, extend the end with max(); otherwise close the block.',
    'A booking can sit entirely inside another — max() handles that.',
  ],

  entry: 'merge_bookings',
  signature: 'merge_bookings(bookings: list[list[int]]) -> list[list[int]]',

  starter: `def merge_bookings(bookings: list[list[int]]) -> list[list[int]]:
    return bookings
`,

  solution: `def merge_bookings(bookings: list[list[int]]) -> list[list[int]]:
    merged = []
    for start, end in sorted(bookings):
        if merged and start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return merged
`,

  explanation: `**Sort, then sweep once.** After sorting by start, a booking either begins inside (or right at the end of) the current block — extend it with \`max(end)\` — or after it, which starts a new block.

\`max\` matters for nested bookings: \`[1, 10]\` followed by \`[2, 3]\` must keep 10 as the end.

**Complexity:** O(n log n) for the sort, O(n) for the sweep.`,

  tests: [
    { name: 'Example', args: [[[1, 3], [2, 6], [8, 10], [15, 18]]], expected: [[1, 6], [8, 10], [15, 18]] },
    { name: 'Touching bookings merge', args: [[[4, 5], [1, 4]]], expected: [[1, 5]] },
    { name: 'No bookings', hidden: true, args: [[]], expected: [] },
    { name: 'Nested and unsorted', hidden: true, args: [[[5, 7], [1, 10], [2, 3]]], expected: [[1, 10]] },
    { name: 'Gaps stay separate', hidden: true, args: [[[3, 4], [1, 2], [6, 6]]], expected: [[1, 2], [3, 4], [6, 6]] },
  ],
};
