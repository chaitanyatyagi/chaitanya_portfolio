// Heading ids for course content. Used by the server (to build each module's
// lesson list at seed time) and the browser (to give rendered headings the
// same ids), so a lesson link always lands on its heading.

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// Unique ids within one document: repeated headings get -1, -2, …
export function makeSlugger() {
  const seen = new Map();
  return (text) => {
    const base = slugify(text) || 'section';
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    return n ? `${base}-${n}` : base;
  };
}

// GitHub-style heading ids, used for docs so in-document links written for
// GitHub (e.g. #8-code-execution--grading) also work on the website: every
// space becomes "-" individually, so "A & B" → "a--b".
export function makeGithubSlugger() {
  const seen = new Map();
  return (text) => {
    const base = String(text).toLowerCase().trim()
      .replace(/<[^>]+>/g, '')
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .replace(/\s/g, '-') || 'section';
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    return n ? `${base}-${n}` : base;
  };
}
