// ---------------------------------------------------------------------------
// Pushes server/defaultContent.js into MongoDB, overwriting the live content
// document. Run with: npm run sync-content (from server/).
// WARNING: this replaces any edits made through the /admin panel — the current
// DB document is printed first so it can be recovered if needed.
// ---------------------------------------------------------------------------
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { defaultContent } from './defaultContent.js';
import { SiteContent } from './models.js';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '.env') });

if (!process.env.DATABASE) {
  console.error('DATABASE is not set in server/.env');
  process.exit(1);
}

await mongoose.connect(process.env.DATABASE, { serverSelectionTimeoutMS: 8000 });

const existing = await SiteContent.findOne({ key: 'main' }).lean();
if (existing) {
  console.log('--- previous document (backup) ---');
  console.log(JSON.stringify(existing.data));
  console.log('----------------------------------');
}

await SiteContent.updateOne({ key: 'main' }, { $set: { data: defaultContent } }, { upsert: true });
console.log('✓ Synced defaultContent.js → MongoDB (sitecontents / key: main)');

await mongoose.disconnect();
