-- Where each company tag comes from (docs §8.12): [{company?, label, url}].
-- A company tag is only published together with a public source naming it;
-- `npm run verify:problems` refuses a company tag without one.
ALTER TABLE problems ADD COLUMN sources jsonb NOT NULL DEFAULT '[]';
