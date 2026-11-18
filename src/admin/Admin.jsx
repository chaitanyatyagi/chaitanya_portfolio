import { useEffect, useState } from 'react';
import { theme as t } from '../data.js';
import { S, Field } from './ui.jsx';
import Logo from '../components/Logo.jsx';
import {
  GeneralEditor, HeroEditor, AboutEditor, ExperienceEditor,
  ProjectsEditor, GuideEditor, ChatbotEditor, SchedulerEditor,
} from './sections.jsx';

// Tabs, grouped the same way the site is organized:
// page sections in page order, then the live data collections.
const TAB_GROUPS = [
  {
    label: 'Site content',
    tabs: [
      { id: 'general', label: 'General', C: GeneralEditor },
      { id: 'hero', label: 'Hero', C: HeroEditor },
      { id: 'about', label: 'About', C: AboutEditor },
      { id: 'experience', label: 'Experience', C: ExperienceEditor },
      { id: 'projects', label: 'Projects', C: ProjectsEditor },
      { id: 'guide', label: 'Guide & Blog copy', C: GuideEditor },
      { id: 'scheduler', label: 'Scheduler', C: SchedulerEditor },
      { id: 'chatbot', label: 'Ask AI', C: ChatbotEditor },
    ],
  },
  {
    label: 'Data',
    tabs: [
      { id: 'blogs', label: 'Blog posts' },
      { id: 'bookings', label: 'Bookings' },
      { id: 'subscribers', label: 'Subscribers' },
    ],
  },
];
const TABS = TAB_GROUPS.flatMap((g) => g.tabs);

const TOKEN_KEY = 'portfolio_admin_token';

async function api(path, opts = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.reload();
    throw new Error('Session expired');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
function Login({ onDone }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy || !password) return;
    setBusy(true);
    setError(null);
    try {
      const { token } = await api('/api/cms/auth/login', { method: 'POST', body: JSON.stringify({ password }) });
      localStorage.setItem(TOKEN_KEY, token);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bg, padding: 20 }}>
      <div style={{ width: 380, maxWidth: '100%', background: '#fff', border: `1px solid ${t.line}`, borderRadius: 16, padding: 32, animation: 'floatUp .4s ease both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 22 }}>
          <Logo />
          <span style={{ fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 17 }}>Admin Panel</span>
        </div>
        <label style={S.label}>Password</label>
        <input
          type="password"
          value={password}
          autoFocus
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          style={{ ...S.input, marginBottom: 14 }}
        />
        {error && <div style={{ color: '#c0392b', fontSize: 13, marginBottom: 12 }}>✗ {error}</div>}
        <button onClick={submit} disabled={busy} style={{ ...S.btnPrimary, width: '100%', opacity: busy ? 0.7 : 1 }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <a href="/" style={{ display: 'block', textAlign: 'center', marginTop: 16, fontSize: 13, color: t.faint }}>← Back to site</a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data viewers
// ---------------------------------------------------------------------------
function Subscribers() {
  const [rows, setRows] = useState(null);
  const load = () => api('/api/cms/admin/subscribers').then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  if (!rows) return <div style={{ color: t.faint }}>Loading…</div>;
  return (
    <div style={S.card}>
      <h3 style={S.sectionTitle}>Course subscribers ({rows.length})</h3>
      {rows.length === 0 && <div style={{ color: t.faint, fontSize: 14 }}>No subscribers yet.</div>}
      {rows.map((r) => (
        <div key={r._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: `1px solid ${t.line}`, gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14.5 }}>{r.email}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: t.fontMono, fontSize: 12, color: t.fainter }}>{new Date(r.createdAt).toLocaleDateString()}</span>
            <button style={S.btnDanger} onClick={async () => { await api(`/api/cms/admin/subscribers/${r._id}`, { method: 'DELETE' }); load(); }}>Delete</button>
          </span>
        </div>
      ))}
    </div>
  );
}

const STATUS_COLORS = { pending: '#b8860b', confirmed: '#1e7d3c', cancelled: '#c0392b' };
const STATUS_BG = { pending: '#fdf6e3', confirmed: '#eaf7ee', cancelled: '#fdeeea' };

function Bookings() {
  const [data, setData] = useState(null); // { mailConfigured, bookings }
  const [action, setAction] = useState(null); // { id, status: 'confirmed'|'cancelled' }
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null); // { msg, ok }

  const load = () =>
    api('/api/cms/admin/bookings')
      .then((d) => setData(Array.isArray(d) ? { mailConfigured: false, bookings: d } : d))
      .catch(() => setData({ mailConfigured: false, bookings: [] }));
  useEffect(() => { load(); }, []);

  function showNote(msg, ok = true) {
    setNote({ msg, ok });
    setTimeout(() => setNote(null), 5000);
  }

  async function submitAction() {
    if (busy || !action) return;
    setBusy(true);
    try {
      const res = await api(`/api/cms/admin/bookings/${action.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: action.status, comment }),
      });
      const verb = action.status === 'confirmed' ? 'approved' : 'rejected';
      if (res.emailed) showNote(`Booking ${verb} — email sent to the visitor.`);
      else showNote(`Booking ${verb} — but no email was sent (${res.emailError || 'SMTP not configured'}).`, false);
      setAction(null);
      setComment('');
      load();
    } catch (err) {
      showNote(err.message, false);
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <div style={{ color: t.faint }}>Loading…</div>;
  const rows = data.bookings || [];

  return (
    <div style={S.card}>
      <h3 style={S.sectionTitle}>1:1 call bookings ({rows.length})</h3>

      {!data.mailConfigured && (
        <div style={{ fontSize: 13, lineHeight: 1.55, color: '#8a6d1a', background: '#fdf6e3', border: '1px solid #f0e0b0', borderRadius: 9, padding: '10px 14px', marginBottom: 16 }}>
          ⚠ Email sending is not set up — add <code>SMTP_USER</code> and <code>SMTP_PASS</code> (a Gmail App Password)
          to <code>server/.env</code>. Approve/reject will still work, but visitors won't be notified.
        </div>
      )}
      {note && (
        <div style={{ fontSize: 13.5, color: note.ok ? '#1e7d3c' : '#c0392b', background: note.ok ? '#eaf7ee' : '#fdeeea', border: `1px solid ${note.ok ? '#bfe3cb' : '#f3c4b8'}`, borderRadius: 9, padding: '10px 14px', marginBottom: 16, animation: 'floatUp .25s ease both' }}>
          {note.ok ? '✓ ' : '✗ '}{note.msg}
        </div>
      )}

      {rows.length === 0 && <div style={{ color: t.faint, fontSize: 14 }}>No bookings yet.</div>}
      {rows.map((r) => (
        <div key={r._id} style={{ padding: '14px 0', borderBottom: `1px solid ${t.line}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <strong style={{ fontSize: 15 }}>{r.name}</strong>
              <span style={{ color: t.faint, fontSize: 14 }}> · {r.email}</span>
              <span style={{
                marginLeft: 10, fontFamily: t.fontMono, fontSize: 11, padding: '3px 10px', borderRadius: 20,
                color: STATUS_COLORS[r.status], background: STATUS_BG[r.status],
              }}>
                {r.status}{r.notifiedAt ? ' · emailed' : ''}
              </span>
              <div style={{ fontFamily: t.fontMono, fontSize: 12.5, color: t.muted, marginTop: 4 }}>
                {r.date} · {r.time} {r.duration && `· ${r.duration}`}
              </div>
              {r.topic && <div style={{ fontSize: 13.5, color: t.muted, marginTop: 4 }}>“{r.topic}”</div>}
              {r.adminComment && <div style={{ fontSize: 13, color: t.fainter, marginTop: 4 }}>Your note: “{r.adminComment}”</div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
              {r.status !== 'confirmed' && (
                <button
                  style={{ ...S.btn, color: '#1e7d3c', borderColor: '#bfe3cb' }}
                  onClick={() => { setAction({ id: r._id, status: 'confirmed' }); setComment(''); }}
                >✓ Approve</button>
              )}
              {r.status !== 'cancelled' && (
                <button
                  style={{ ...S.btn, color: '#c0392b', borderColor: '#f3c4b8' }}
                  onClick={() => { setAction({ id: r._id, status: 'cancelled' }); setComment(''); }}
                >✗ Reject</button>
              )}
              <button
                style={S.btnDanger}
                onClick={async () => {
                  if (!window.confirm(`Delete the booking from ${r.name}? This cannot be undone.`)) return;
                  await api(`/api/cms/admin/bookings/${r._id}`, { method: 'DELETE' });
                  load();
                }}
              >Delete</button>
            </div>
          </div>

          {action && action.id === r._id && (
            <div style={{ marginTop: 12, background: t.bg, border: `1px solid ${t.line}`, borderRadius: 11, padding: 16, animation: 'floatUp .25s ease both' }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8, color: action.status === 'confirmed' ? '#1e7d3c' : '#c0392b' }}>
                {action.status === 'confirmed' ? 'Approve this booking' : 'Reject this booking'}
                <span style={{ fontWeight: 400, color: t.faint }}> — {r.name} will get a default email at {r.email}</span>
              </div>
              <textarea
                value={comment}
                rows={2}
                autoFocus
                placeholder="Optional note to include in the email (e.g. a meeting link, or why the slot doesn't work)"
                onChange={(e) => setComment(e.target.value)}
                style={{ ...S.input, resize: 'vertical', lineHeight: 1.55, marginBottom: 10 }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  disabled={busy}
                  onClick={submitAction}
                  style={{ ...S.btnPrimary, background: action.status === 'confirmed' ? '#1e7d3c' : '#c0392b', opacity: busy ? 0.7 : 1 }}
                >
                  {busy ? 'Sending…' : action.status === 'confirmed' ? 'Approve & send email' : 'Reject & send email'}
                </button>
                <button style={S.btn} disabled={busy} onClick={() => { setAction(null); setComment(''); }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Blog posts manager — create / edit / publish / delete
// ---------------------------------------------------------------------------
const EMPTY_POST = { title: '', slug: '', excerpt: '', content: '', tags: [], published: false };

const slugifyTitle = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');

function BlogsManager() {
  const [rows, setRows] = useState(null);
  const [editing, setEditing] = useState(null); // { _id? , ...post }
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);

  const load = () => api('/api/cms/admin/blogs').then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  function showNote(msg, ok = true) {
    setNote({ msg, ok });
    setTimeout(() => setNote(null), 4000);
  }

  async function save() {
    if (busy || !editing) return;
    setBusy(true);
    try {
      const isNew = !editing._id;
      await api(isNew ? '/api/cms/admin/blogs' : `/api/cms/admin/blogs/${editing._id}`, {
        method: isNew ? 'POST' : 'PUT',
        body: JSON.stringify(editing),
      });
      showNote(isNew ? 'Post created.' : 'Post saved.');
      setEditing(null);
      load();
    } catch (err) {
      showNote(err.message, false);
    } finally {
      setBusy(false);
    }
  }

  async function togglePublish(post) {
    try {
      await api(`/api/cms/admin/blogs/${post._id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...post, published: !post.published }),
      });
      showNote(post.published ? 'Post unpublished.' : 'Post published — it is live now.');
      load();
    } catch (err) {
      showNote(err.message, false);
    }
  }

  if (!rows) return <div style={{ color: t.faint }}>Loading…</div>;

  // ---- Editor view ----
  if (editing) {
    const set = (patch) => setEditing((prev) => ({ ...prev, ...patch }));
    return (
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ ...S.sectionTitle, margin: 0 }}>{editing._id ? 'Edit post' : 'New post'}</h3>
          <button style={S.btn} onClick={() => setEditing(null)}>← Back to list</button>
        </div>
        {note && <div style={{ fontSize: 13.5, color: note.ok ? '#1e7d3c' : '#c0392b', marginBottom: 12 }}>{note.ok ? '✓ ' : '✗ '}{note.msg}</div>}
        <Field label="Title" value={editing.title}
          onChange={(v) => set({ title: v, ...(slugTouched ? {} : { slug: slugifyTitle(v) }) })} />
        <Field label="Slug (URL: /blog/<slug>)" value={editing.slug}
          onChange={(v) => { setSlugTouched(true); set({ slug: slugifyTitle(v) }); }} />
        <Field label="Excerpt — short summary shown on cards" textarea rows={2}
          value={editing.excerpt} onChange={(v) => set({ excerpt: v })} />
        <Field label="Tags (comma-separated)" value={(editing.tags || []).join(', ')}
          onChange={(v) => set({ tags: v.split(',').map((x) => x.trim()).filter(Boolean) })} />
        <Field label="Content — markdown (## headings, ```code blocks```, tables, lists…)" textarea rows={18}
          value={editing.content} onChange={(v) => set({ content: v })} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button
            style={{ ...S.btnPrimary, opacity: busy ? 0.7 : 1 }}
            disabled={busy}
            onClick={save}
          >
            {busy ? 'Saving…' : editing._id ? 'Save post' : 'Create post'}
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: t.inkSoft, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!!editing.published}
              onChange={(e) => set({ published: e.target.checked })}
            />
            Published (visible on the site)
          </label>
        </div>
      </div>
    );
  }

  // ---- List view ----
  return (
    <div style={S.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <h3 style={{ ...S.sectionTitle, margin: 0 }}>Blog posts ({rows.length})</h3>
        <button style={S.btnPrimary} onClick={() => { setEditing({ ...EMPTY_POST }); setSlugTouched(false); }}>
          + New post
        </button>
      </div>
      {note && <div style={{ fontSize: 13.5, color: note.ok ? '#1e7d3c' : '#c0392b', marginBottom: 12 }}>{note.ok ? '✓ ' : '✗ '}{note.msg}</div>}
      {rows.length === 0 && (
        <div style={{ color: t.faint, fontSize: 14 }}>
          No posts yet. Click “+ New post” — drafts stay hidden until you tick “Published”.
        </div>
      )}
      {rows.map((r) => (
        <div key={r._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '13px 0', borderBottom: `1px solid ${t.line}`, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <strong style={{ fontSize: 15 }}>{r.title}</strong>
            <span style={{
              marginLeft: 10, fontFamily: t.fontMono, fontSize: 11, padding: '3px 10px', borderRadius: 20,
              color: r.published ? '#1e7d3c' : '#b8860b',
              background: r.published ? '#eaf7ee' : '#fdf6e3',
            }}>
              {r.published ? 'published' : 'draft'}
            </span>
            <div style={{ fontFamily: t.fontMono, fontSize: 12, color: t.fainter, marginTop: 4 }}>
              /blog/{r.slug} · {new Date(r.createdAt).toLocaleDateString()}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={S.btn} onClick={() => { setEditing(r); setSlugTouched(true); }}>Edit</button>
            <button style={S.btn} onClick={() => togglePublish(r)}>{r.published ? 'Unpublish' : 'Publish'}</button>
            <button
              style={S.btnDanger}
              onClick={async () => {
                if (!window.confirm(`Delete “${r.title}”? This cannot be undone.`)) return;
                await api(`/api/cms/admin/blogs/${r._id}`, { method: 'DELETE' });
                load();
              }}
            >Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main admin shell
// ---------------------------------------------------------------------------
export default function Admin() {
  const [authed, setAuthed] = useState(!!localStorage.getItem(TOKEN_KEY));
  const [content, setContent] = useState(null);
  const [tab, setTab] = useState('general');
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authed) return;
    // Verify the stored token still works, then load content.
    api('/api/cms/auth/verify')
      .then(() => fetch('/api/content').then((r) => r.json()).then(setContent))
      .catch(() => {});
  }, [authed]);

  function setSection(section, patch) {
    setContent((prev) => ({ ...prev, [section]: { ...prev[section], ...patch } }));
    setDirty(true);
  }

  function showToast(msg, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      await api('/api/cms/admin/content', { method: 'PUT', body: JSON.stringify({ data: content }) });
      setDirty(false);
      showToast('Saved — the site is updated.');
    } catch (err) {
      showToast(err.message, false);
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!window.confirm('Reset ALL content to the original defaults? This overwrites every edit.')) return;
    try {
      const { data } = await api('/api/cms/admin/content/reset', { method: 'POST' });
      setContent(data);
      setDirty(false);
      showToast('Content reset to defaults.');
    } catch (err) {
      showToast(err.message, false);
    }
  }

  if (!authed) return <Login onDone={() => setAuthed(true)} />;

  const activeTab = TABS.find((x) => x.id === tab);

  return (
    <div style={{ minHeight: '100vh', background: t.bg }}>
      {/* Top bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', gap: 14,
        justifyContent: 'space-between', padding: '14px var(--px)',
        background: 'rgba(250,248,244,.9)', backdropFilter: 'blur(14px)', borderBottom: `1px solid ${t.line}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <Logo size={30} radius={8} />
          <span style={{ fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 15 }}>Portfolio Admin</span>
          {dirty && <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.accent }}>● unsaved changes</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <a href="/" target="_blank" rel="noreferrer" style={{ ...S.btn, textDecoration: 'none' }}>View site ↗</a>
          <button style={S.btn} onClick={reset}>Reset defaults</button>
          <button style={S.btn} onClick={() => { localStorage.removeItem(TOKEN_KEY); setAuthed(false); }}>Sign out</button>
          <button
            style={{ ...S.btnPrimary, background: dirty ? t.accent : t.ink, opacity: saving ? 0.7 : 1 }}
            onClick={save}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px var(--px) 80px' }}>
        {/* Tabs, grouped */}
        <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 26 }}>
          {TAB_GROUPS.map((group) => (
            <div key={group.label}>
              <div style={{ fontFamily: t.fontMono, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: t.fainter, marginBottom: 8 }}>
                {group.label}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {group.tabs.map((x) => (
                  <button
                    key={x.id}
                    onClick={() => setTab(x.id)}
                    style={{
                      fontFamily: t.fontBody, fontSize: 13.5, fontWeight: 500, padding: '8px 15px',
                      borderRadius: 20, cursor: 'pointer',
                      background: tab === x.id ? t.ink : '#fff',
                      color: tab === x.id ? t.bg : t.muted,
                      border: `1px solid ${tab === x.id ? t.ink : t.line}`,
                    }}
                  >
                    {x.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {tab === 'subscribers' ? (
          <Subscribers />
        ) : tab === 'bookings' ? (
          <Bookings />
        ) : tab === 'blogs' ? (
          <BlogsManager />
        ) : !content ? (
          <div style={{ color: t.faint }}>Loading content…</div>
        ) : (
          <activeTab.C content={content} setSection={setSection} />
        )}
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: toast.ok ? t.ink : '#c0392b', color: t.bg, fontSize: 14, fontWeight: 500,
          padding: '12px 22px', borderRadius: 10, boxShadow: '0 12px 30px -12px rgba(0,0,0,.4)',
          animation: 'floatUp .3s ease both', zIndex: 100, maxWidth: '90vw',
        }}>
          {toast.ok ? '✓ ' : '✗ '}{toast.msg}
        </div>
      )}
    </div>
  );
}
