// ---------------------------------------------------------------------------
// Compact authoring for Python problem packs (docs §13.2).
//
//   python({ id, title, difficulty, topics, patterns, domains, roles, interview,
//            companies, sources, summary, description, hints, explanation,
//            entry, signature, solution, starter?,
//            tests: [ex('Example', arg1, arg2), hid('Edge case', arg1, arg2)] })
//
// Like SQL packs, expected values are NOT hand-typed: `npm run problems:freeze`
// calls the reference solution on every test's args and stores the returned
// value (normalised exactly as the grader compares it) in python/golden.json.
// Review the frozen values with `-- --show`; re-freeze after changing args or
// the solution.
//
// starter: defaults to `def <signature>:` with an empty body. Problems where
// the learner writes a class or generator give their own starter, which also
// holds the small driver function the tests call (`entry`).
// ---------------------------------------------------------------------------
export { md, ROLES } from '../sql/define.js';

// Reference solutions and starters are Python source: String.raw keeps every
// backslash ("\n", "\d") exactly as written.
export const code = String.raw;

// Test cases: ex() is shown to the learner (Run), hid() only runs on Submit.
export const ex = (name, ...args) => ({ name, args });
export const hid = (name, ...args) => ({ name, hidden: true, args });

export function python(p) {
  const companies = p.companies || [];
  return {
    track: 'python',
    companies,
    sources: [],
    roles: ['Data Engineer'],
    interview: companies.length > 0,
    ...p,
    starter: p.starter || `def ${p.signature}:\n    # Write your solution here\n    pass\n`,
    golden: true, // expected values come from golden.json
  };
}
