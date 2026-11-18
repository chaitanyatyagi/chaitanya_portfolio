// Shell problems: `files` are placed in the script's working directory;
// `expected` is the exact stdout (trailing spaces / final newline ignored).
const LOG_EXAMPLE = `2024-03-01T10:00:01 192.168.1.10 GET /api/orders 200 120
2024-03-01T10:00:02 192.168.1.11 GET /api/users 500 340
2024-03-01T10:00:03 192.168.1.10 POST /api/orders 201 80
2024-03-01T10:00:04 192.168.1.12 GET /api/orders 500 900
2024-03-01T10:00:05 192.168.1.10 GET /api/users 200 45
2024-03-01T10:00:06 192.168.1.11 GET /api/orders 503 1200
`;

export default {
  id: 'top-error-clients',
  track: 'shell',
  title: 'Top Error-Producing Clients',
  difficulty: 'Easy',
  topics: ['Log Analysis', 'Field Extraction (cut / awk)', 'Sorting & Counting', 'Pipes & Redirection'],
  patterns: ['Filter → count → rank pipeline', 'Frequency count (sort | uniq -c)'],
  domains: ['Web server logs'],
  companies: [],
  sources: [],
  summary: 'Count 5xx responses per client IP from an access log and rank the worst offenders.',

  description: `An API gateway writes one line per request to \`access.log\` (in the current directory):

\`\`\`text
<timestamp> <client_ip> <method> <path> <status> <latency_ms>
\`\`\`

On-call needs to know **which clients are hitting server errors**. Write a shell script that prints, for every client IP that received at least one **server error** (status \`500\`–\`599\`), a line:

\`\`\`text
<client_ip>,<error_count>
\`\`\`

- Sort by \`error_count\` **descending**, then by \`client_ip\` ascending.
- Ignore blank lines and comment lines starting with \`#\`.
- Status codes outside 500–599 (e.g. \`499\` or \`600\`) are not server errors.
- If there are no server errors, print nothing.`,

  hints: [
    'awk splits on whitespace by default: the IP is $2 and the status is $5.',
    'Classic counting idiom: … | sort | uniq -c   (uniq only merges adjacent lines, so sort first).',
    'Sort on two keys: numeric descending on the count, then the IP: sort -k1,1nr -k2,2',
    'Reformat at the end with awk: awk \'{print $2 "," $1}\'',
  ],

  starter: `#!/usr/bin/env bash
# access.log is in the current directory.
# Press Ctrl/Cmd + ' to run the examples, Ctrl/Cmd + Enter to submit.

head -n 3 access.log
`,

  solution: `grep -v '^#' access.log \\
  | awk 'NF && $5 >= 500 && $5 <= 599 { print $2 }' \\
  | sort \\
  | uniq -c \\
  | sort -k1,1nr -k2,2 \\
  | awk '{ print $2 "," $1 }'
`,

  explanation: `**Filter → count → rank, as one pipeline.**

1. \`grep -v '^#'\` drops comment lines.
2. \`awk 'NF && $5 >= 500 && $5 <= 599 {print $2}'\` keeps non-blank lines (\`NF\` > 0) whose status is a 5xx and prints just the IP.
3. \`sort | uniq -c\` is the classic frequency count — \`uniq\` only collapses *adjacent* duplicates, which is why the \`sort\` must come first.
4. \`sort -k1,1nr -k2,2\` ranks by the count (numeric, descending), breaking ties by IP.
5. \`awk '{print $2 "," $1}'\` turns \`   2 192.168.1.11\` into \`192.168.1.11,2\`.

Everything streams, so this works on a multi-GB log with constant memory (apart from \`sort\`, which spills to disk). An awk-only alternative uses an associative array: \`awk '… {c[$2]++} END {for (ip in c) print ip "," c[ip]}' | sort -t, -k2,2nr -k1,1\`.`,

  tests: [
    {
      name: 'Example',
      files: { 'access.log': LOG_EXAMPLE },
      expected: '192.168.1.11,2\n192.168.1.12,1\n',
    },
    {
      name: 'Ties are broken by IP',
      files: {
        'access.log': `2024-03-02T09:00:00 10.0.0.9 GET /a 502 10
2024-03-02T09:00:01 10.0.0.2 GET /a 500 10
2024-03-02T09:00:02 10.0.0.9 GET /b 504 10
2024-03-02T09:00:03 10.0.0.2 GET /b 500 10
2024-03-02T09:00:04 10.0.0.5 GET /a 200 10
`,
      },
      expected: '10.0.0.2,2\n10.0.0.9,2\n',
    },
    {
      name: 'Comments and blank lines',
      files: {
        'access.log': `# gateway log rotated 2024-03-03
2024-03-03T00:00:01 172.16.0.4 GET /health 500 3

# deploy started
2024-03-03T00:00:05 172.16.0.4 GET /health 200 2
`,
      },
      expected: '172.16.0.4,1\n',
    },
    {
      name: 'No server errors',
      hidden: true,
      files: { 'access.log': '2024-03-04T00:00:01 10.1.1.1 GET / 200 5\n2024-03-04T00:00:02 10.1.1.2 GET / 404 5\n' },
      expected: '',
    },
    {
      name: 'Status boundaries (499, 599, 600)',
      hidden: true,
      files: {
        'access.log': `2024-03-05T00:00:01 10.2.0.1 GET / 499 5
2024-03-05T00:00:02 10.2.0.2 GET / 599 5
2024-03-05T00:00:03 10.2.0.3 GET / 600 5
2024-03-05T00:00:04 10.2.0.2 GET / 500 5
`,
      },
      expected: '10.2.0.2,2\n',
    },
    {
      name: 'Counts of 10+ sort numerically',
      hidden: true,
      files: {
        'access.log': [
          ...Array.from({ length: 10 }, (_, i) => `2024-03-06T00:00:${String(i).padStart(2, '0')} 10.3.0.1 GET /x 500 5`),
          ...Array.from({ length: 9 }, (_, i) => `2024-03-06T00:01:${String(i).padStart(2, '0')} 10.3.0.2 GET /x 502 5`),
          '2024-03-06T00:02:00 10.3.0.3 GET /x 503 5',
        ].join('\n') + '\n',
      },
      expected: '10.3.0.1,10\n10.3.0.2,9\n10.3.0.3,1\n',
    },
  ],
};
