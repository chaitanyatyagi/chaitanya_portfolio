// ---------------------------------------------------------------------------
// Express backend for the portfolio.
//   • MongoDB (Atlas) stores all site content — editable via /admin
//   • Public APIs: content, course subscriptions, 1:1 call bookings
//   • Admin APIs: JWT-protected content editing + subscriber/booking management
//   • /api/chat proxies the AI assistant to the Anthropic Claude API
//
//   1.  Set DATABASE, ADMIN_PASSWORD, JWT_SECRET (and ANTHROPIC_API_KEY) in .env
//   2.  npm install
//   3.  npm run server          (or `npm start` at repo root for server + Vite)
// ---------------------------------------------------------------------------

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Load server/.env regardless of where the process was started from.
dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '.env') });

import { SiteContent, Subscriber, Booking } from './models.js';
import { defaultContent } from './defaultContent.js';

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-env';

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// --------------------------------------------------------------------------
// Database
// --------------------------------------------------------------------------
let dbReady = false;

async function connectDb() {
  const uri = process.env.DATABASE;
  if (!uri) {
    console.warn('⚠️  DATABASE is not set — content APIs will serve defaults only.');
    return;
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    dbReady = true;
    console.log('✅ Connected to MongoDB');
    const existing = await SiteContent.findOne({ key: 'main' }).lean();
    if (!existing) {
      await SiteContent.create({ key: 'main', data: defaultContent });
      console.log('🌱 Seeded site content with defaults');
    }
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
  }
}
connectDb();

// Section-level merge so newly added sections/keys in code still appear even
// if the stored document predates them.
function mergeWithDefaults(data) {
  const merged = { ...defaultContent };
  for (const [section, value] of Object.entries(data || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value) && merged[section]) {
      merged[section] = { ...merged[section], ...value };
    } else {
      merged[section] = value;
    }
  }
  return merged;
}

// --------------------------------------------------------------------------
// Auth
// --------------------------------------------------------------------------
function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin') throw new Error('bad role');
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

app.post('/api/auth/login', (req, res) => {
  const { password } = req.body || {};
  if (!process.env.ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'ADMIN_PASSWORD is not configured on the server.' });
  }
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Wrong password' });
  }
  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

app.get('/api/auth/verify', requireAdmin, (_req, res) => res.json({ ok: true }));

// --------------------------------------------------------------------------
// Public: content
// --------------------------------------------------------------------------
app.get('/api/health', (_req, res) => res.json({ ok: true, db: dbReady }));

app.get('/api/content', async (_req, res) => {
  try {
    if (!dbReady) return res.json(defaultContent);
    const doc = await SiteContent.findOne({ key: 'main' }).lean();
    res.json(mergeWithDefaults(doc?.data));
  } catch (err) {
    console.error(err);
    res.json(defaultContent);
  }
});

// --------------------------------------------------------------------------
// Public: course "notify me" subscriptions
// --------------------------------------------------------------------------
app.post('/api/subscribe', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (!dbReady) return res.status(503).json({ error: 'Database unavailable — try again later.' });
  try {
    await Subscriber.updateOne({ email }, { $setOnInsert: { email } }, { upsert: true });
    res.json({ ok: true, message: "You're on the list! I'll email you when the course launches." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save your email — try again.' });
  }
});

// --------------------------------------------------------------------------
// Public: 1:1 call bookings
// --------------------------------------------------------------------------

// Booked slots for a month: /api/booked?month=YYYY-MM → { "YYYY-MM-DD": ["09:00 AM", …] }
app.get('/api/booked', async (req, res) => {
  const month = String(req.query.month || '');
  if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'month=YYYY-MM required' });
  if (!dbReady) return res.json({});
  try {
    const bookings = await Booking.find({
      date: { $regex: `^${month}` },
      status: { $ne: 'cancelled' },
    }).select('date time').lean();
    const map = {};
    for (const b of bookings) (map[b.date] ||= []).push(b.time);
    res.json(map);
  } catch (err) {
    console.error(err);
    res.json({});
  }
});

app.post('/api/bookings', async (req, res) => {
  const { name, email, date, time, duration, topic } = req.body || {};
  const cleanName = String(name || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanName) return res.status(400).json({ error: 'Please enter your name.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) {
    return res.status(400).json({ error: 'Please pick a date.' });
  }
  if (!time) return res.status(400).json({ error: 'Please pick a time slot.' });
  if (!dbReady) return res.status(503).json({ error: 'Database unavailable — try again later.' });

  try {
    const taken = await Booking.findOne({ date, time, status: { $ne: 'cancelled' } }).lean();
    if (taken) return res.status(409).json({ error: 'That slot was just booked — pick another.' });
    await Booking.create({
      name: cleanName,
      email: cleanEmail,
      date,
      time,
      duration: String(duration || ''),
      topic: String(topic || '').slice(0, 500),
    });
    res.json({ ok: true, message: `Booked! ${date} at ${time} — you'll get a confirmation email soon.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save the booking — try again.' });
  }
});

// --------------------------------------------------------------------------
// Admin (JWT protected)
// --------------------------------------------------------------------------
app.put('/api/admin/content', requireAdmin, async (req, res) => {
  const { data } = req.body || {};
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ error: 'data object is required' });
  }
  if (!dbReady) return res.status(503).json({ error: 'Database unavailable.' });
  try {
    await SiteContent.updateOne({ key: 'main' }, { $set: { data } }, { upsert: true });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save content' });
  }
});

app.post('/api/admin/content/reset', requireAdmin, async (_req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database unavailable.' });
  try {
    await SiteContent.updateOne({ key: 'main' }, { $set: { data: defaultContent } }, { upsert: true });
    res.json({ ok: true, data: defaultContent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reset content' });
  }
});

app.get('/api/admin/subscribers', requireAdmin, async (_req, res) => {
  if (!dbReady) return res.json([]);
  res.json(await Subscriber.find().sort({ createdAt: -1 }).lean());
});

app.delete('/api/admin/subscribers/:id', requireAdmin, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database unavailable.' });
  await Subscriber.deleteOne({ _id: req.params.id });
  res.json({ ok: true });
});

app.get('/api/admin/bookings', requireAdmin, async (_req, res) => {
  if (!dbReady) return res.json([]);
  res.json(await Booking.find().sort({ date: -1, time: 1 }).lean());
});

app.patch('/api/admin/bookings/:id', requireAdmin, async (req, res) => {
  const { status } = req.body || {};
  if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  if (!dbReady) return res.status(503).json({ error: 'Database unavailable.' });
  await Booking.updateOne({ _id: req.params.id }, { $set: { status } });
  res.json({ ok: true });
});

app.delete('/api/admin/bookings/:id', requireAdmin, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database unavailable.' });
  await Booking.deleteOne({ _id: req.params.id });
  res.json({ ok: true });
});

// --------------------------------------------------------------------------
// AI chatbot (proxies to Anthropic — key stays on the server)
// --------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are the personal data engineering assistant for Chaitanya Tyagi, a data engineer with 2+ years at Accenture (client: American Express) working on GCP pipeline migration (Cornerstone to LUMI), PySpark data quality frameworks, Airflow/Cloud Composer orchestration, BigQuery, and Pub/Sub-driven real-time automation. Answer questions about data engineering concisely and practically, in 2-4 short paragraphs max. Favor concrete patterns and real trade-offs. If asked about Chaitanya specifically, speak to his GCP, PySpark, BigQuery, Airflow, ETL migration, and data-quality expertise. Keep a friendly, expert tone.`;

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages[] is required' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured on the server.' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 700,
        system: SYSTEM_PROMPT,
        messages: messages.map((m) => ({ role: m.role, content: String(m.content) })),
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('Anthropic API error:', response.status, detail);
      return res.status(502).json({ error: 'Upstream model error' });
    }

    const data = await response.json();
    const reply = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    res.json({ reply: reply || '…' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Portfolio API running on http://localhost:${PORT}`);
});
