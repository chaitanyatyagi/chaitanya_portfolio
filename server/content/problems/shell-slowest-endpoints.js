const lines = (...l) => `${l.join('\n')}\n`;

export default {
  id: 'slowest-endpoints',
  track: 'shell',
  title: 'Slowest Endpoints',
  difficulty: 'Medium',
  topics: ['Log Analysis', 'Field Extraction (cut / awk)', 'Sorting & Counting', 'Stream Editing (sed / tr)'],
  patterns: ['Group-by average with awk arrays', 'Top-N with sort | head'],
  domains: ['Web server logs'],
  companies: [],
  sources: [{ label: 'Common shell interview task: parse request logs and rank by latency', url: 'https://arvindverma021.substack.com/p/top-50-bash-scripting-interview-questions' }],
  summary: 'Average the latency per path over successful requests and print the top 3.',

  description: `\`requests.log\` has lines like:

\`\`\`
GET /api/users 200 123ms
\`\`\`

(method, path, status, latency with an \`ms\` suffix).

Considering only **successful** requests (status \`2xx\`), compute each path's **average latency** (all methods together). Print the **3 slowest** paths as \`path avg\`, with \`avg\` to one decimal, slowest first; ties by path.`,

  hints: [
    'In awk, $3 ~ /^2/ keeps 2xx statuses.',
    'Strip the suffix: ms = $4; sub(/ms$/, "", ms) — then it\'s a number.',
    'Keep a sum and a count per path, print sum/count with printf "%.1f", then sort -k2,2nr -k1,1 | head -n 3.',
  ],

  starter: `#!/usr/bin/env bash
# requests.log is in the current directory.
awk '{ print $2, $4 }' requests.log | head -n 3
`,

  solution: `awk '$3 ~ /^2/ { ms = $4; sub(/ms$/, "", ms); s[$2] += ms; n[$2]++ }
     END { for (p in s) printf "%s %.1f\\n", p, s[p] / n[p] }' requests.log \\
  | sort -k2,2nr -k1,1 \\
  | head -n 3
`,

  explanation: `**Filter, clean, aggregate, rank.**

1. \`$3 ~ /^2/\` keeps 2xx responses — errors and timeouts would distort the average.
2. \`sub(/ms$/, "", ms)\` strips the unit so the field can be added up.
3. Two arrays, sum and count, give the average per path in \`END\`.
4. \`sort -k2,2nr -k1,1 | head -n 3\` is the shell's top-N.

In production you'd usually want a percentile (p95) rather than a mean — a great follow-up to raise in the interview.`,

  tests: [
    {
      name: 'Example',
      files: {
        'requests.log': lines(
          'GET /api/users 200 120ms', 'GET /api/users 200 80ms', 'POST /api/orders 201 300ms', 'GET /api/orders 200 100ms',
          'GET /health 200 5ms', 'GET /api/search 500 9000ms', 'GET /api/search 200 250ms',
        ),
      },
      expected: '/api/search 250.0\n/api/orders 200.0\n/api/users 100.0\n',
    },
    { name: 'Ties by path', files: { 'requests.log': lines('GET /b 200 50ms', 'GET /a 200 50ms') }, expected: '/a 50.0\n/b 50.0\n' },
    { name: 'Only errors', hidden: true, files: { 'requests.log': lines('GET /x 503 10ms', 'GET /y 404 1ms') }, expected: '' },
    { name: 'Fractional averages', hidden: true, files: { 'requests.log': lines('GET /p 200 1ms', 'GET /p 204 2ms', 'GET /q 200 10ms') }, expected: '/q 10.0\n/p 1.5\n' },
    {
      name: 'Only the top three',
      hidden: true,
      files: { 'requests.log': lines('GET /d 200 1ms', 'GET /c 200 2ms', 'GET /a 200 4ms', 'GET /b 200 3ms') },
      expected: '/a 4.0\n/b 3.0\n/c 2.0\n',
    },
  ],
};
