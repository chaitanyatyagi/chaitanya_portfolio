import { useState } from 'react';
import { theme as t } from '../data.js';
import { useContent } from '../ContentContext.jsx';
import Reveal from './Reveal.jsx';
import { GUIDE_GROUPS, GUIDE_STATS } from '../guide/guideData.js';
import { SectionHeader } from './ui.jsx';

// Home-page highlight for the full /guide — design patterns, Airflow, SQL,
// interview prep — merged from the old Knowledge Base + Course sections.
// The topic cards derive automatically from the guide registry.
export default function GuideSection() {
  const { guide } = useContent();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const groups = GUIDE_GROUPS.filter((g) => g.id !== 'start');

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
    <section id="guide" style={{ background: t.bgAlt, borderTop: `1px solid ${t.line}`, borderBottom: `1px solid ${t.line}`, padding: '84px var(--px)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <Reveal>
          <SectionHeader
            kicker="// the guide"
            no="04"
            heading={guide.heading}
            description={guide.description}
            right={(
              <a
                href="/guide"
                className="btn-lift"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 9, textDecoration: 'none',
                  fontSize: 15, fontWeight: 500, color: t.bg, background: t.ink,
                  padding: '13px 22px', borderRadius: 10, whiteSpace: 'nowrap',
                }}
              >
                {guide.ctaLabel} <span style={{ fontFamily: t.fontMono }}>→</span>
              </a>
            )}
          />
        </Reveal>

        {/* Group highlight cards — derived from the guide registry */}
        <div className="grid-collapse" style={{ display: 'grid', gridTemplateColumns: `repeat(${groups.length},1fr)`, gap: 16 }}>
          {groups.map((g, i) => (
            <Reveal key={g.id} delay={i * 90}>
              <a href="/guide" className="card-lift" style={{
                display: 'flex', flexDirection: 'column', height: '100%', textDecoration: 'none', color: 'inherit',
                background: '#fff', border: `1px solid ${t.line}`, borderRadius: 16, padding: 26,
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontFamily: t.fontDisplay, fontWeight: 700, fontSize: 30, color: '#ede7db', lineHeight: 1 }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.fainter }}>
                    {g.topics.length} chapters
                  </span>
                </div>
                <div style={{ fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 18.5, letterSpacing: '-.01em', margin: '14px 0 10px' }}>
                  {g.label}
                </div>
                <div style={{ fontSize: 13.5, lineHeight: 1.65, color: t.faint, marginBottom: 16 }}>
                  {g.topics.slice(0, 4).map((x) => x.title).join(' · ')}
                  {g.topics.length > 4 ? ' · …' : ''}
                </div>
                <div style={{ marginTop: 'auto', fontFamily: t.fontMono, fontSize: 12, color: t.accent }}>
                  Start reading →
                </div>
              </a>
            </Reveal>
          ))}
        </div>

        {/* Growing-content strip + stats */}
        <Reveal delay={150}>
          <div style={{
            marginTop: 16, border: '1.5px dashed #d8d2c6', borderRadius: 14, padding: '16px 22px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap', textAlign: 'center',
          }}>
            <span style={{ fontFamily: t.fontMono, fontSize: 14, color: t.accent }}>+</span>
            <span style={{ fontFamily: t.fontMono, fontSize: 12.5, color: t.faint }}>
              {GUIDE_STATS.topics} chapters · {GUIDE_STATS.sections}+ topics live — {guide.moreText}
            </span>
          </div>
        </Reveal>

        {/* Course notify strip */}
        <Reveal delay={200}>
          <div className="grid-collapse" style={{
            marginTop: 34, background: '#fff', border: `1px solid ${t.line}`, borderRadius: 16, padding: '26px 30px',
            display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24, alignItems: 'center',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                <span style={{ fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 18 }}>{guide.notifyHeading}</span>
                <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.faint, background: t.bg, border: `1px solid ${t.line}`, padding: '3px 10px', borderRadius: 20 }}>◷ Coming soon</span>
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.6, color: t.muted }}>{guide.notifyText}</div>
            </div>
            <div>
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
    </section>
  );
}
