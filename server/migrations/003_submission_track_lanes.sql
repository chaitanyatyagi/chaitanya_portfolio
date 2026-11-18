-- Per-track grading lanes ("bulkheads"): each track has its own grader
-- concurrency, so a burst of slow PySpark jobs can't starve fast SQL ones.
-- Storing the track on the submission lets each lane claim its own jobs with
-- a single index scan (no join to problems).
ALTER TABLE submissions ADD COLUMN track text;
UPDATE submissions s SET track = p.track_id FROM problems p WHERE p.id = s.problem_id;
ALTER TABLE submissions ALTER COLUMN track SET NOT NULL;
DROP INDEX IF EXISTS submissions_queue_idx;
CREATE INDEX submissions_queue_idx ON submissions (track, created_at) WHERE status = 'queued';
