const lines = (...l) => `${l.join('\n')}\n`;

export default {
  id: 'category-totals',
  track: 'shell',
  title: 'Revenue by Category from a CSV',
  difficulty: 'Easy',
  topics: ['CSV Processing', 'Field Extraction (cut / awk)', 'Sorting & Counting'],
  patterns: ['Group-by sum with an awk array', 'Multi-key numeric sort'],
  domains: ['E-commerce / Sales'],
  companies: [],
  sources: [{ label: 'Common shell interview task: aggregate a CSV column with awk', url: 'https://hyring.com/jobseeker-toolkit/interview-questions/technical/shell-scripting' }],
  summary: 'Sum a CSV\'s amount column per category with awk, and rank the totals.',

  description: `\`sales.csv\` has a header line \`order_id,category,amount\` followed by one order per line. Amounts can be decimals and negative (refunds). Category names never contain commas.

Print \`category,total\` for every category, where \`total\` is the sum of its amounts with **exactly two decimals**. Order by total **descending** (numerically), then by category.`,

  hints: [
    'Skip the header: tail -n +2, or NR > 1 inside awk.',
    'awk -F, \'{ t[$2] += $3 } END { for (c in t) printf "%s,%.2f\\n", c, t[c] }\'',
    'sort -t, -k2,2nr -k1,1 sorts numerically on the second field, then by name.',
  ],

  starter: `#!/usr/bin/env bash
# sales.csv is in the current directory.
cut -d, -f2,3 sales.csv
`,

  solution: `awk -F, 'NR > 1 && NF { t[$2] += $3 } END { for (c in t) printf "%s,%.2f\\n", c, t[c] }' sales.csv \\
  | sort -t, -k2,2nr -k1,1
`,

  explanation: `**awk as a one-line group-by.** \`t[$2] += $3\` accumulates the amount per category in an associative array; the \`END\` block prints each total with \`printf "%.2f"\` (which also hides floating-point noise like 0.30000000000000004).

\`sort -t, -k2,2nr\` compares the second field as a **number**: without \`n\`, "9.00" would sort above "100.00" as text.`,

  tests: [
    {
      name: 'Example',
      files: { 'sales.csv': lines('order_id,category,amount', '1,books,12.50', '2,games,40', '3,books,7.5', '4,music,20') },
      expected: 'games,40.00\nbooks,20.00\nmusic,20.00\n',
    },
    {
      name: 'Refunds and decimals',
      files: { 'sales.csv': lines('order_id,category,amount', '1,toys,10', '2,toys,-10', '3,food,0.1', '4,food,0.2') },
      expected: 'food,0.30\ntoys,0.00\n',
    },
    { name: 'Header only', hidden: true, files: { 'sales.csv': lines('order_id,category,amount') }, expected: '' },
    {
      name: 'Numeric, not text, ordering',
      hidden: true,
      files: { 'sales.csv': lines('order_id,category,amount', '1,a,100', '2,b,9', '3,c,25') },
      expected: 'a,100.00\nc,25.00\nb,9.00\n',
    },
    {
      name: 'Category names with spaces',
      hidden: true,
      files: { 'sales.csv': lines('order_id,category,amount', '1,home garden,2.5', '2,home garden,2.5') },
      expected: 'home garden,5.00\n',
    },
  ],
};
