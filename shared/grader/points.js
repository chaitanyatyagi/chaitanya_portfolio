// ---------------------------------------------------------------------------
// Scoring rules — used by the grader (to award) and the browser (to preview
// "your next Accepted is worth N"), so both always agree. docs §8.13.
//
// Points are awarded once per problem, for the FIRST Accepted submission:
//   base points by difficulty   Easy 10 · Medium 20 · Hard 40
//   × attempt multiplier        1st try 100% · 2nd 50% · 3rd 25% · 4th+ 0%
//   viewed the solution before solving → 0
// An "attempt" is any graded submission (Wrong Answer, Runtime Error, Time
// Limit Exceeded, Accepted …) — except our own Internal Errors.
// ---------------------------------------------------------------------------
export const ATTEMPT_MULTIPLIERS = [1, 0.5, 0.25]; // index = attempt - 1; beyond → 0

export function pointsFor(basePoints, attemptNo, { revealedBeforeSolve = false } = {}) {
  if (revealedBeforeSolve) return 0;
  const m = ATTEMPT_MULTIPLIERS[attemptNo - 1] ?? 0;
  return Math.round(basePoints * m);
}

export const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4) % 4] || 'th'}`;
