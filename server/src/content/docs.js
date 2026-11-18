// ---------------------------------------------------------------------------
// Docs sync: repo markdown (server/content/docs.js manifest) → `docs` table.
// Runs on every API boot (cluster primary, after migrations) and in the seeder,
// so the website always shows the handbook that shipped with this code.
// Unchanged files are skipped (content hash), and a change NOTIFYs every API
// process to drop its cached copy.
// ---------------------------------------------------------------------------
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { REPO_DIR } from '../config.js';
import { query } from '../db.js';
import { contentCache } from '../lib/cache.js';
import { config } from '../config.js';
import { DOCS } from '../../content/docs.js';

export async function syncDocs(db = { query }) {
  let changed = 0;
  for (const d of DOCS) {
    const body = await fs.readFile(path.join(REPO_DIR, d.file), 'utf8');
    const hash = crypto.createHash('sha256').update(`${d.title}\n${d.access}\n${body}`).digest('hex');
    const r = await db.query(
      `INSERT INTO docs (slug, title, access, body_md, content_hash, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (slug) DO UPDATE SET title = $2, access = $3, body_md = $4, content_hash = $5, updated_at = now()
       WHERE docs.content_hash <> EXCLUDED.content_hash`,
      [d.slug, d.title, d.access, body, hash]);
    changed += r.rowCount;
  }
  if (changed) await db.query("SELECT pg_notify('content_changed', '')");
  return { docs: DOCS.length, changed };
}

export function getDoc(slug) {
  return contentCache.getOrLoad(`doc:${slug}`, config.contentCacheTtlMs, async () => {
    const { rows: [d] } = await query('SELECT slug, title, access, body_md, updated_at FROM docs WHERE slug = $1', [slug]);
    return d ? { slug: d.slug, title: d.title, access: d.access, body: d.body_md, updatedAt: d.updated_at } : null;
  });
}

export async function listDocs() {
  const { rows } = await query('SELECT slug, title, access, updated_at FROM docs ORDER BY title');
  return rows.map((d) => ({ slug: d.slug, title: d.title, access: d.access, updatedAt: d.updated_at }));
}
