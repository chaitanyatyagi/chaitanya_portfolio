// Docs published on the website at /docs/:slug — synced from repo files into
// the `docs` table on every API boot (src/content/docs.js) and by `npm run seed`.
// access: 'admin' (architecture internals), 'learner' (any account) or 'public'.
export const DOCS = [
  { slug: 'architecture', title: 'Architecture & Design Handbook', file: 'docs/ARCHITECTURE.md', access: 'admin' },
];
