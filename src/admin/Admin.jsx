import { useEffect, useState } from 'react';
import { theme as t } from '../data.js';
import { S } from './ui.jsx';
import {
  GeneralEditor, HeroEditor, AboutEditor, ExperienceEditor,
  ProjectsEditor, KnowledgeEditor, CourseEditor, ChatbotEditor, SchedulerEditor,
} from './sections.jsx';

const TABS = [
  { id: 'general', label: 'General', C: GeneralEditor },
  { id: 'hero', label: 'Hero', C: HeroEditor },
  { id: 'about', label: 'About', C: AboutEditor },
  { id: 'experience', label: 'Experience', C: ExperienceEditor },
  { id: 'projects', label: 'Projects', C: ProjectsEditor },
  { id: 'knowledge', label: 'Knowledge', C: KnowledgeEditor },
  { id: 'course', label: 'Course', C: CourseEditor },
  { id: 'chatbot', label: 'Ask AI', C: ChatbotEditor },
  { id: 'scheduler', label: 'Scheduler', C: SchedulerEditor },
  { id: 'subscribers', label: 'Subscribers' },
  { id: 'bookings', label: 'Bookings' },
];

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
      const { token } = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ password }) });
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
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, background: t.ink, borderRadius: 9, fontFamily: t.fontDisplay, fontWeight: 700, color: t.bg, fontSize: 16 }}>C</span>
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
  const load = () => api('/api/admin/subscribers').then(setRows).catch(() => setRows([]));
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
            <button style={S.btnDanger} onClick={async () => { await api(`/api/admin/subscribers/${r._id}`, { method: 'DELETE' }); load(); }}>Delete</button>
          </span>
        </div>
      ))}
    </div>
  );
}

const STATUS_COLORS = { pending: '#b8860b', confirmed: '#1e7d3c', cancelled: '#c0392b' };

function Bookings() {
  const [rows, setRows] = useState(null);
  const load = () => api('/api/admin/bookings').then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  if (!rows) return <div style={{ color: t.faint }}>Loading…</div>;
  return (
    <div style={S.card}>
      <h3 style={S.sectionTitle}>1:1 call bookings ({rows.length})</h3>
      {rows.length === 0 && <div style={{ color: t.faint, fontSize: 14 }}>No bookings yet.</div>}
      {rows.map((r) => (
        <div key={r._id} style={{ padding: '14px 0', borderBottom: `1px solid ${t.line}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <strong style={{ fontSize: 15 }}>{r.name}</strong>
              <span style={{ color: t.faint, fontSize: 14 }}> · {r.email}</span>
              <div style={{ fontFamily: t.fontMono, fontSize: 12.5, color: t.muted, marginTop: 4 }}>
                {r.date} · {r.time} {r.duration && `· ${r.duration}`}
              </div>
              {r.topic && <div style={{ fontSize: 13.5, color: t.muted, marginTop: 4 }}>“{r.topic}”</div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <select
                value={r.status}
                onChange={async (e) => { await api(`/api/admin/bookings/${r._id}`, { method: 'PATCH', body: JSON.stringify({ status: e.target.value }) }); load(); }}
                style={{ ...S.input, width: 'auto', padding: '6px 8px', fontSize: 13, color: STATUS_COLORS[r.status] }}
              >
                <option value="pending">pending</option>
                <option value="confirmed">confirmed</option>
                <option value="cancelled">cancelled</option>
              </select>
              <button style={S.btnDanger} onClick={async () => { await api(`/api/admin/bookings/${r._id}`, { method: 'DELETE' }); load(); }}>Delete</button>
            </div>
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
    api('/api/auth/verify')
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
      await api('/api/admin/content', { method: 'PUT', body: JSON.stringify({ data: content }) });
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
      const { data } = await api('/api/admin/content/reset', { method: 'POST' });
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
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, background: t.ink, borderRadius: 8, fontFamily: t.fontDisplay, fontWeight: 700, color: t.bg, fontSize: 14 }}>C</span>
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
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 26 }}>
          {TABS.map((x) => (
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

        {tab === 'subscribers' ? (
          <Subscribers />
        ) : tab === 'bookings' ? (
          <Bookings />
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
