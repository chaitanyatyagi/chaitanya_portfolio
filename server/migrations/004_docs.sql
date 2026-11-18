-- Internal documentation served on the website (/docs/:slug). The markdown
-- file in the repo stays the source of truth (versioned with the code it
-- describes); it's synced here on every API boot and by `npm run seed`, and
-- the website reads it from this table like all other content.
CREATE TABLE docs (
  slug          text PRIMARY KEY,
  title         text NOT NULL,
  access        text NOT NULL DEFAULT 'admin' CHECK (access IN ('public', 'learner', 'admin')),
  body_md       text NOT NULL,
  content_hash  text NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
