// ---------------------------------------------------------------------------
// Legacy portfolio CMS (MongoDB): site content, blog, 1:1 bookings, "notify me"
// subscribers and the AI chat proxy — the features that predate the platform.
//
// Kept as an isolated router: it has its own database (MongoDB Atlas) and its
// own password-based admin login (/api/cms/auth/login), so an Atlas outage or
// a CMS bug can't affect learners. Public paths are unchanged; admin + auth
// moved under /api/cms/ so they don't collide with the platform's user auth.
// ---------------------------------------------------------------------------
import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { config } from '../src/config.js';
import { logger } from '../src/logger.js';
import { SiteContent, Subscriber, Booking, Blog } from './models.js';
import { defaultContent } from './defaultContent.js';
import { sendBookingEmail, mailConfigured } from '../mailer.js';

export const legacyRouter = express.Router();
const router = legacyRouter;
const JWT_SECRET = config.auth.jwtSecret;

// --------------------------------------------------------------------------
// Database
// --------------------------------------------------------------------------
let dbReady = false;

export async function connectMongo() {
  const uri = config.mongoUrl;
  if (!uri) {
    logger.warn('MONGO_URL is not set — legacy CMS routes serve defaults only.');
    return;
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    dbReady = true;
    logger.info('connected to MongoDB (legacy CMS)');
    const existing = await SiteContent.findOne({ key: 'main' }).lean();
    if (!existing) {
      await SiteContent.create({ key: 'main', data: defaultContent });
      logger.info('seeded legacy site content');
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'MongoDB connection failed — legacy CMS routes degraded');
  }
}

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
    if (payload.role !== 'cms-admin') throw new Error('bad role');
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

router.post('/api/cms/auth/login', (req, res) => {
  const { password } = req.body || {};
  if (!process.env.ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'ADMIN_PASSWORD is not configured on the server.' });
  }
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Wrong password' });
  }
  const token = jwt.sign({ role: 'cms-admin' }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

router.get('/api/cms/auth/verify', requireAdmin, (_req, res) => res.json({ ok: true }));

// --------------------------------------------------------------------------
// Public: content
// --------------------------------------------------------------------------

router.get('/api/content', async (_req, res) => {
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
router.post('/api/subscribe', async (req, res) => {
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
router.get('/api/booked', async (req, res) => {
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

router.post('/api/bookings', async (req, res) => {
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
// Public: blog
// --------------------------------------------------------------------------
router.get('/api/blogs', async (_req, res) => {
  if (!dbReady) return res.json([]);
  try {
    res.json(
      await Blog.find({ published: true })
        .select('title slug excerpt tags createdAt updatedAt')
        .sort({ createdAt: -1 })
        .lean()
    );
  } catch (err) {
    console.error(err);
    res.json([]);
  }
});

router.get('/api/blogs/:slug', async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database unavailable.' });
  try {
    const post = await Blog.findOne({ slug: req.params.slug, published: true }).lean();
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --------------------------------------------------------------------------
// Admin (JWT protected)
// --------------------------------------------------------------------------
router.put('/api/cms/admin/content', requireAdmin, async (req, res) => {
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

router.post('/api/cms/admin/content/reset', requireAdmin, async (_req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database unavailable.' });
  try {
    await SiteContent.updateOne({ key: 'main' }, { $set: { data: defaultContent } }, { upsert: true });
    res.json({ ok: true, data: defaultContent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reset content' });
  }
});

router.get('/api/cms/admin/subscribers', requireAdmin, async (_req, res) => {
  if (!dbReady) return res.json([]);
  res.json(await Subscriber.find().sort({ createdAt: -1 }).lean());
});

router.delete('/api/cms/admin/subscribers/:id', requireAdmin, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database unavailable.' });
  await Subscriber.deleteOne({ _id: req.params.id });
  res.json({ ok: true });
});

router.get('/api/cms/admin/bookings', requireAdmin, async (_req, res) => {
  if (!dbReady) return res.json([]);
  res.json({
    mailConfigured: mailConfigured(),
    bookings: await Booking.find().sort({ date: -1, time: 1 }).lean(),
  });
});

// Approve / reject a booking. Confirming or cancelling emails the visitor a
// default notification (with the optional admin comment included).
router.patch('/api/cms/admin/bookings/:id', requireAdmin, async (req, res) => {
  const { status } = req.body || {};
  const comment = String(req.body?.comment || '').trim().slice(0, 1000);
  if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  if (!dbReady) return res.status(503).json({ error: 'Database unavailable.' });

  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    booking.status = status;
    booking.adminComment = comment;

    let emailed = false;
    let emailError = null;
    if (status === 'confirmed' || status === 'cancelled') {
      const result = await sendBookingEmail(booking, status, comment);
      emailed = result.sent;
      emailError = result.error || null;
      if (emailed) booking.notifiedAt = new Date();
    }
    await booking.save();

    res.json({ ok: true, emailed, emailError });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update the booking' });
  }
});

router.delete('/api/cms/admin/bookings/:id', requireAdmin, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database unavailable.' });
  await Booking.deleteOne({ _id: req.params.id });
  res.json({ ok: true });
});

// --------------------------------------------------------------------------
// Admin: blog management
// --------------------------------------------------------------------------
function cleanBlogInput(body) {
  const title = String(body?.title || '').trim();
  const slug = String(body?.slug || title)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return {
    title,
    slug,
    excerpt: String(body?.excerpt || '').trim().slice(0, 500),
    content: String(body?.content || ''),
    tags: Array.isArray(body?.tags) ? body.tags.map((x) => String(x).trim()).filter(Boolean) : [],
    published: !!body?.published,
  };
}

router.get('/api/cms/admin/blogs', requireAdmin, async (_req, res) => {
  if (!dbReady) return res.json([]);
  res.json(await Blog.find().sort({ createdAt: -1 }).lean());
});

router.post('/api/cms/admin/blogs', requireAdmin, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database unavailable.' });
  const data = cleanBlogInput(req.body);
  if (!data.title || !data.slug) return res.status(400).json({ error: 'Title is required.' });
  try {
    const post = await Blog.create(data);
    res.json(post);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'That slug already exists.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to create the post' });
  }
});

router.put('/api/cms/admin/blogs/:id', requireAdmin, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database unavailable.' });
  const data = cleanBlogInput(req.body);
  if (!data.title || !data.slug) return res.status(400).json({ error: 'Title is required.' });
  try {
    const post = await Blog.findByIdAndUpdate(req.params.id, { $set: data }, { new: true });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json(post);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'That slug already exists.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to update the post' });
  }
});

router.delete('/api/cms/admin/blogs/:id', requireAdmin, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database unavailable.' });
  await Blog.deleteOne({ _id: req.params.id });
  res.json({ ok: true });
});

// --------------------------------------------------------------------------
// AI chatbot (proxies to Anthropic — key stays on the server)
// --------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are the personal data engineering assistant for Chaitanya Tyagi, a data engineer with 2+ years at Accenture (client: American Express) working on GCP pipeline migration (Cornerstone to LUMI), PySpark data quality frameworks, Airflow/Cloud Composer orchestration, BigQuery, and Pub/Sub-driven real-time automation. Answer questions about data engineering concisely and practically, in 2-4 short paragraphs max. Favor concrete patterns and real trade-offs. If asked about Chaitanya specifically, speak to his GCP, PySpark, BigQuery, Airflow, ETL migration, and data-quality expertise. Keep a friendly, expert tone.`;

router.post('/api/chat', async (req, res) => {
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
