-- Interview prep (docs §8.14): problems can be flagged as interview questions,
-- carry the data roles they suit, and belong to a multi-part case study.
ALTER TABLE problems
  ADD COLUMN interview       boolean NOT NULL DEFAULT false,
  ADD COLUMN roles           text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN case_study_id   text,
  ADD COLUMN case_study_part int;

CREATE TABLE case_studies (
  id          text PRIMARY KEY,
  track_id    text NOT NULL REFERENCES tracks(id),
  position    int  NOT NULL,
  title       text NOT NULL,
  summary     text NOT NULL,
  brief_md    text NOT NULL,          -- the shared story and dataset
  roles       text[] NOT NULL DEFAULT '{}',
  companies   text[] NOT NULL DEFAULT '{}',
  published   boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE problems ADD CONSTRAINT problems_case_study_fk FOREIGN KEY (case_study_id) REFERENCES case_studies(id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX problems_case_study_idx ON problems (case_study_id, case_study_part) WHERE case_study_id IS NOT NULL;
CREATE INDEX problems_interview_idx ON problems (track_id) WHERE interview;
