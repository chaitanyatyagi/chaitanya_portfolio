-- Acceptance stats as counters, maintained by the grader in the verdict
-- transaction (docs §9.5). Replaces a GROUP BY over the whole submissions
-- table that every API process ran every minute — fine at thousands of rows,
-- a full scan per process per minute at millions.
CREATE TABLE problem_stats (
  problem_id  text PRIMARY KEY REFERENCES problems(id) ON DELETE CASCADE,
  submissions bigint NOT NULL DEFAULT 0,   -- graded (status done, not Internal Error)
  accepted    bigint NOT NULL DEFAULT 0,
  solvers     bigint NOT NULL DEFAULT 0    -- distinct users with an Accepted
);

INSERT INTO problem_stats (problem_id, submissions, accepted, solvers)
SELECT s.problem_id,
       count(*),
       count(*) FILTER (WHERE s.verdict = 'Accepted'),
       count(DISTINCT s.user_id) FILTER (WHERE s.verdict = 'Accepted')
FROM submissions s JOIN problems p ON p.id = s.problem_id
WHERE s.status = 'done' AND coalesce(s.verdict, '') <> 'Internal Error'
GROUP BY s.problem_id;
