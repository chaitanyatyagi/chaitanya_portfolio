const lines = (...l) => `${l.join('\n')}\n`;

export default {
  id: 'latest-record-per-key',
  track: 'shell',
  title: 'Latest Record per Key',
  difficulty: 'Medium',
  topics: ['CSV Processing', 'Sorting & Counting', 'Pipes & Redirection'],
  patterns: ['Latest record per key', 'Multi-key sort then first-seen filter'],
  domains: ['Customer data / CDC'],
  companies: [],
  sources: [{ label: 'Common data-engineering task: deduplicate keeping the most recent version', url: 'https://dev.to/datadriven/the-6-python-data-engineering-interview-questions-you-will-actually-be-asked-in-2026-504j' }],
  summary: 'Keep only the newest version of each customer row in a CSV, header included.',

  description: `\`customers.csv\` is an export that contains **several versions** of some customers:

\`\`\`
id,email,updated_at
2,b@old.com,2024-05-01T10:00:00
\`\`\`

\`updated_at\` is an ISO-8601 timestamp; a customer never has two versions with the same \`updated_at\`.

Print the header, then **only the latest version** of each customer, ordered by \`id\` **numerically**.`,

  hints: [
    'Print the header separately: head -n 1.',
    'Sort the data lines by id (numeric) and then by updated_at descending: sort -t, -k1,1n -k3,3r.',
    'Now the newest version is the first line of each id: awk -F, \'!seen[$1]++\' keeps only first occurrences.',
  ],

  starter: `#!/usr/bin/env bash
# customers.csv is in the current directory.
sort -u customers.csv
`,

  solution: `head -n 1 customers.csv
tail -n +2 customers.csv \\
  | sort -t, -k1,1n -k3,3r \\
  | awk -F, '!seen[$1]++'
`,

  explanation: `**Sort so the winner comes first, then keep first occurrences.**

1. ISO-8601 timestamps sort correctly as text, so \`-k3,3r\` puts the newest version of each id first; \`-k1,1n\` groups ids in numeric order (10 after 9).
2. \`awk '!seen[$1]++'\` prints a line only the first time its id is seen — a streaming "latest record per key".
3. The header is printed on its own so it doesn't get sorted into the data.

This is the shell version of \`ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_at DESC) = 1\`.`,

  tests: [
    {
      name: 'Example',
      files: {
        'customers.csv': lines('id,email,updated_at', '2,b@old.com,2024-05-01T10:00:00', '1,a@x.com,2024-05-02T09:00:00', '2,b@new.com,2024-05-03T08:00:00', '3,c@x.com,2024-04-01T00:00:00'),
      },
      expected: 'id,email,updated_at\n1,a@x.com,2024-05-02T09:00:00\n2,b@new.com,2024-05-03T08:00:00\n3,c@x.com,2024-04-01T00:00:00\n',
    },
    {
      name: 'Numeric id order',
      files: { 'customers.csv': lines('id,email,updated_at', '10,j@x.com,2024-01-01T00:00:00', '9,i@x.com,2024-01-01T00:00:00', '9,i2@x.com,2024-01-02T00:00:00') },
      expected: 'id,email,updated_at\n9,i2@x.com,2024-01-02T00:00:00\n10,j@x.com,2024-01-01T00:00:00\n',
    },
    { name: 'Header only', hidden: true, files: { 'customers.csv': lines('id,email,updated_at') }, expected: 'id,email,updated_at\n' },
    {
      name: 'Newest version appears first in the file',
      hidden: true,
      files: { 'customers.csv': lines('id,email,updated_at', '5,e1@x.com,2024-02-01T23:00:00', '5,e2@x.com,2024-02-01T09:00:00') },
      expected: 'id,email,updated_at\n5,e1@x.com,2024-02-01T23:00:00\n',
    },
    {
      name: 'Many versions',
      hidden: true,
      files: {
        'customers.csv': lines('id,email,updated_at', '7,v1@x.com,2023-01-01T00:00:00', '7,v3@x.com,2023-03-01T00:00:00', '8,w@x.com,2023-01-01T00:00:00', '7,v2@x.com,2023-02-01T00:00:00'),
      },
      expected: 'id,email,updated_at\n7,v3@x.com,2023-03-01T00:00:00\n8,w@x.com,2023-01-01T00:00:00\n',
    },
  ],
};
