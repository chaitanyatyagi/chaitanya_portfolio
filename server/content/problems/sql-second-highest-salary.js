export default {
  id: 'second-highest-salary',
  track: 'sql',
  title: 'Second-Highest Salary per Department',
  difficulty: 'Medium',
  topics: ['Ranking', 'Window Functions', 'Subqueries'],
  patterns: ['Nth highest distinct value (DENSE_RANK)'],
  domains: ['HR / People analytics'],
  companies: ['Ernst & Young'],
  sources: [{ company: 'Ernst & Young', label: 'DataLemur — Ernst & Young SQL interview questions: 2nd largest salary', url: 'https://datalemur.com/blog/ernst-young-sql-interview-questions' }, { label: 'DataLemur — "Second Highest Salary" / "Top Three Salaries" (reported as FAANG)', url: 'https://datalemur.com/questions' }],
  summary: 'Find each department\'s second-highest distinct salary — ties and all.',

  description: `HR wants each department's **second-highest distinct salary** from \`employees\`.

- "Distinct" matters: if two people share the top salary, the second-highest is the next **lower** value.
- Departments with fewer than two distinct salaries are left out.

Return \`dept\`, \`second_highest\`, ordered by \`dept\`.`,

  hints: [
    'DENSE_RANK() gives equal salaries the same rank and doesn\'t skip numbers.',
    'Partition by dept, order by salary DESC, keep rank 2.',
    'Several people can share rank 2 — make the output one row per department.',
  ],

  schema: [{ name: 'employees', columns: [['emp_id', 'INTEGER', 'Primary key'], ['name', 'VARCHAR', 'Employee'], ['dept', 'VARCHAR', 'Department'], ['salary', 'INTEGER', 'Annual salary']] }],
  outputColumns: ['dept', 'second_highest'],

  starter: `-- Table: employees
SELECT dept, MAX(salary) AS second_highest
FROM employees
GROUP BY dept
ORDER BY dept;
`,

  solution: `WITH ranked AS (
  SELECT dept, salary,
         DENSE_RANK() OVER (PARTITION BY dept ORDER BY salary DESC) AS rk
  FROM employees
)
SELECT DISTINCT dept, salary AS second_highest
FROM ranked
WHERE rk = 2
ORDER BY dept;
`,

  explanation: `**DENSE_RANK, then pick rank 2.** \`DENSE_RANK\` ranks distinct values 1, 2, 3… with ties sharing a rank and no gaps, so rank 2 is exactly "the second-highest distinct salary". \`RANK\` would skip to 3 after a tie at the top; \`ROW_NUMBER\` would return a duplicate of the top salary.

\`DISTINCT\` collapses several employees earning that salary into one row per department. Departments with a single distinct salary have no rank-2 row, so they drop out naturally.`,

  tests: [
    {
      name: 'Example',
      ordered: true,
      tables: { employees: [[1, 'A', 'eng', 100], [2, 'B', 'eng', 90], [3, 'C', 'eng', 100], [4, 'D', 'ops', 50], [5, 'E', 'ops', 70], [6, 'F', 'hr', 60]] },
      expected: [['eng', 90], ['ops', 50]],
    },
    { name: 'Ties at both levels', ordered: true, tables: { employees: [[1, 'a', 'x', 10], [2, 'b', 'x', 10], [3, 'c', 'x', 5], [4, 'd', 'x', 5]] }, expected: [['x', 5]] },
    { name: 'Empty table', hidden: true, ordered: true, tables: { employees: [] }, expected: [] },
    { name: 'Everyone earns the same', hidden: true, ordered: true, tables: { employees: [[1, 'a', 'y', 7], [2, 'b', 'y', 7]] }, expected: [] },
    {
      name: 'Unordered input, several departments',
      hidden: true,
      ordered: true,
      tables: { employees: [[1, 'a', 'z', 3], [2, 'b', 'm', 9], [3, 'c', 'z', 1], [4, 'd', 'm', 8], [5, 'e', 'z', 2]] },
      expected: [['m', 8], ['z', 2]],
    },
  ],
};
