import { useState } from 'react';
import { theme as t } from '../data.js';
import { useContent } from '../ContentContext.jsx';
import Reveal from './Reveal.jsx';

export default function Course() {
  const { course } = useContent();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null); // { ok, message }
  const [busy, setBusy] = useState(false);

  async function subscribe() {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      setStatus({ ok: true, message: data.message });
      setEmail('');
    } catch (err) {
      setStatus({ ok: false, message: err.message || 'Something went wrong — try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="course" style={{ background: t.bgAlt, borderTop: `1px solid ${t.line}`, borderBottom: `1px solid ${t.line}`, padding: '84px var(--px)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <Reveal>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: t.fontMono, fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: t.accent }}>// course</span>
            {course.badge && (
              <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.faint, background: '#fff', border: `1px solid ${t.line}`, padding: '4px 10px', borderRadius: 20 }}>{course.badge}</span>
            )}
          </div>
          <h2 style={{ fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 34, letterSpacing: '-.02em', margin: '0 0 12px', maxWidth: '20ch' }}>
            {course.heading}
          </h2>
          <p style={{ fontSize: 16, color: t.muted, margin: '0 0 40px', maxWidth: '60ch' }}>
            {course.description}
          </p>
        </Reveal>
        <div className="grid-collapse" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
          <Reveal>
            <div style={{ background: '#fff', border: `1px solid ${t.line}`, borderRadius: 16, padding: 30, height: '100%' }}>
              <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.fainter, marginBottom: 18 }}>MODULES</div>
              {(course.modules || []).map((m) => (
                <div key={m.no} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0', borderBottom: '1px solid #eee7db' }}>
                  <span style={{ fontFamily: t.fontMono, fontSize: 12, color: t.accent, width: 28 }}>{m.no}</span>
                  <span style={{ fontSize: 15, color: t.inkSoft, flex: 1 }}>{m.title}</span>
                  <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.fainter }}>{m.meta}</span>
                </div>
              ))}
              {course.moreText && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 16px', marginTop: 14, border: '1.5px dashed #d8d2c6', borderRadius: 11 }}>
                  <span style={{ fontFamily: t.fontMono, fontSize: 14, color: t.accent }}>+</span>
                  <span style={{ fontFamily: t.fontMono, fontSize: 12, color: t.faint, lineHeight: 1.5 }}>{course.moreText}</span>
                </div>
              )}
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div style={{ background: '#fff', border: `1px solid ${t.line}`, borderRadius: 16, padding: 30, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.fainter, marginBottom: 14 }}>Q&amp;A PREVIEW</div>
              <div style={{ background: t.bg, border: `1px solid ${t.line}`, borderRadius: 11, padding: 16, marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{course.qaQuestion}</div>
                <div style={{ fontSize: 13.5, color: '#6b665e', lineHeight: 1.55 }}>{course.qaAnswer}</div>
              </div>
              <div style={{ fontSize: 13, color: t.fainter, textAlign: 'center', padding: '6px 0' }}>{course.qaMore}</div>
              <div style={{ marginTop: 'auto', paddingTop: 18 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    type="email"
                    placeholder="you@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') subscribe(); }}
                    style={{ flex: 1, minWidth: 0, fontFamily: t.fontBody, fontSize: 14, padding: '12px 14px', border: '1px solid #d8d2c6', borderRadius: 9, background: t.bg, color: t.ink, outline: 'none' }}
                  />
                  <button
                    onClick={subscribe}
                    disabled={busy}
                    className="btn-lift"
                    style={{ fontFamily: t.fontBody, fontSize: 14, fontWeight: 500, color: t.bg, background: t.ink, border: 'none', padding: '12px 18px', borderRadius: 9, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}
                  >
                    {busy ? 'Saving…' : 'Notify me'}
                  </button>
                </div>
                {status && (
                  <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.5, color: status.ok ? '#1e7d3c' : '#c0392b', animation: 'floatUp .3s ease both' }}>
                    {status.ok ? '✓ ' : '✗ '}{status.message}
                  </div>
                )}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
