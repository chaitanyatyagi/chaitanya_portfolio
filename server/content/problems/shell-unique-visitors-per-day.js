const lines = (...l) => `${l.join('\n')}\n`;

export default {
  id: 'unique-visitors-per-day',
  track: 'shell',
  title: 'Unique Visitors per Day',
  difficulty: 'Easy',
  topics: ['Field Extraction (cut / awk)', 'Sorting & Counting', 'Log Analysis', 'Pipes & Redirection'],
  patterns: ['Distinct count per group', 'Deduplicate with sort -u'],
  domains: ['Web server logs'],
  companies: [],
  sources: [{ label: 'Common shell interview task: distinct client IPs from an access log', url: 'https://gitgood.dev/blog/top-50-bash-shell-scripting-interview-questions-2026' }],
  summary: 'Count distinct client IPs per day from an access log.',

  description: `\`access.log\` has one request per line:

\`\`\`
2024-05-01T10:00:01 203.0.113.5 GET /home 200
\`\`\`

(timestamp, client IP, method, path, status — space-separated). Blank lines may appear and must be ignored.

Print one line per day, \`date,unique_ips\`, where \`unique_ips\` is the number of **distinct** client IPs that made at least one request that day. Order by date.`,

  hints: [
    'awk can split the timestamp: split($1, t, "T") puts the date in t[1].',
    'Emit "date ip" pairs, then sort -u removes repeats of the same IP on the same day.',
    'Now count lines per date — uniq -c, or an awk array.',
  ],

  starter: `#!/usr/bin/env bash
# access.log is in the current directory.
cut -d' ' -f1 access.log | sort | uniq -c
`,

  solution: `awk 'NF { split($1, t, "T"); print t[1], $2 }' access.log \\
  | sort -u \\
  | awk '{ n[$1]++ } END { for (d in n) print d "," n[d] }' \\
  | sort
`,

  explanation: `**Project → dedupe → count.**

1. \`awk 'NF {…}'\` skips blank lines and prints just \`date ip\`.
2. \`sort -u\` keeps each (date, IP) pair once — that's the "distinct" part.
3. An awk associative array counts pairs per date; \`for (d in n)\` iterates in no particular order, so a final \`sort\` orders the dates (ISO dates sort correctly as text).

The SQL equivalent is \`COUNT(DISTINCT ip) … GROUP BY date\`.`,

  tests: [
    {
      name: 'Example',
      files: {
        'access.log': lines(
          '2024-05-01T10:00:01 203.0.113.5 GET /home 200',
          '2024-05-01T10:05:00 203.0.113.5 GET /cart 200',
          '2024-05-01T11:00:00 198.51.100.7 GET /home 200',
          '2024-05-02T09:00:00 203.0.113.5 GET /home 200',
        ),
      },
      expected: '2024-05-01,2\n2024-05-02,1\n',
    },
    {
      name: 'Blank lines and unordered days',
      files: {
        'access.log': lines(
          '2024-06-03T08:00:00 10.0.0.1 GET / 200',
          '',
          '2024-06-01T08:00:00 10.0.0.1 GET / 200',
          '2024-06-01T09:00:00 10.0.0.2 GET / 404',
          '2024-06-03T23:59:59 10.0.0.3 GET / 200',
        ),
      },
      expected: '2024-06-01,2\n2024-06-03,2\n',
    },
    { name: 'Single request', hidden: true, files: { 'access.log': lines('2024-07-01T00:00:00 1.2.3.4 GET / 200') }, expected: '2024-07-01,1\n' },
    { name: 'Empty log', hidden: true, files: { 'access.log': '' }, expected: '' },
    {
      name: 'Same IP all day long',
      hidden: true,
      files: { 'access.log': lines('2024-08-01T01:00:00 9.9.9.9 GET /a 200', '2024-08-01T02:00:00 9.9.9.9 GET /b 200', '2024-08-01T03:00:00 9.9.9.9 GET /c 500') },
      expected: '2024-08-01,1\n',
    },
  ],
};
