// ---------------------------------------------------------------------------
// /api/docs — internal documentation (source: repo markdown, served from the
// `docs` table). Access is per doc: the architecture handbook is admin-only
// because it details sandbox internals and limits that help an attacker.
//   GET /api/docs          docs you can read
//   GET /api/docs/:slug    one doc (markdown)
// ---------------------------------------------------------------------------
import express from 'express';
import { handle, notFound, unauthenticated, forbidden } from '../lib/errors.js';
import { getDoc, listDocs } from '../content/docs.js';

export const docsRouter = express.Router();

function canRead(user, access) {
  if (access === 'public') return true;
  if (!user) return false;
  return access === 'learner' || user.role === 'admin';
}

docsRouter.get('/', handle(async (req, res) => {
  res.json({ docs: (await listDocs()).filter((d) => canRead(req.user, d.access)) });
}));

docsRouter.get('/:slug', handle(async (req, res) => {
  const doc = await getDoc(req.params.slug);
  if (!doc) throw notFound('Doc not found.');
  if (!canRead(req.user, doc.access)) throw req.user ? forbidden('This document is available to admins only.') : unauthenticated();
  res.json({ doc });
}));
