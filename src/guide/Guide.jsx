import { useEffect, useMemo, useState } from 'react';
import { marked } from 'marked';
import { theme as t } from '../data.js';
import Logo from '../components/Logo.jsx';
import { Kicker } from '../components/ui.jsx';
import { GUIDE_GROUPS, ALL_TOPICS, findTopic, topicSections, slugify } from './guideData.js';

// Give every markdown heading a stable id so the sidebar can deep-link to it.
marked.use({
  renderer: {
    heading(token) {
      const html = this.parser.parseInline(token.tokens);
      const id = slugify(token.text);
      return `<h${token.depth} id="${id}">${html}</h${token.depth}>`;
    },
  },
});

function slugFromPath() {
  const m = window.location.pathname.match(/^\/guide\/?([^/]*)/);
  return m && m[1] ? m[1] : null;
}

export default function Guide() {
  const [slug, setSlug] = useState(() => slugFromPath() || ALL_TOPICS[0].slug);
  const [menuOpen, setMenuOpen] = useState(false);

  const topic = findTopic(slug);
  const topicIndex = ALL_TOPICS.findIndex((x) => x.slug === topic.slug);
  const prev = ALL_TOPICS[topicIndex - 1];
  const next = ALL_TOPICS[topicIndex + 1];
  const sections = useMemo(() => topicSections(topic.md), [topic]);
  const html = useMemo(() => marked.parse(topic.md), [topic]);

  useEffect(() => {
    const onPop = () => setSlug(slugFromPath() || ALL_TOPICS[0].slug);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    document.title = `${topic.title} — DE Guide · Chaitanya Tyagi`;
  }, [topic]);

  function goTo(nextSlug) {
    window.history.pushState({}, '', `/guide/${nextSlug}`);
    setSlug(nextSlug);
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }

  const isActive = (x) => x.slug === topic.slug;

  const sidebar = (
    <>
      {GUIDE_GROUPS.map((group) => (
        <div key={group.id} style={{ marginBottom: 26 }}>
          <div style={{ fontFamily: t.fontMono, fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: t.fainter, marginBottom: 9 }}>
            {group.label}
          </div>
          {group.topics.map((x) => (
            <div key={x.slug}>
              <button
                onClick={() => goTo(x.slug)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                  fontFamily: t.fontBody, fontSize: 13.5, lineHeight: 1.4,
                  padding: '7px 11px', marginBottom: 1, borderRadius: 8, border: 'none',
                  background: isActive(x) ? '#fff1ea' : 'transparent',
                  color: isActive(x) ? t.accent : t.inkSoft,
                  fontWeight: isActive(x) ? 600 : 400,
                }}
              >
                {x.title}
              </button>
              {isActive(x) && sections.length > 0 && (
                <div style={{ margin: '2px 0 8px', borderLeft: `2px solid #ffd9c7`, marginLeft: 11 }}>
                  {sections.map((s) => (
                    <a
                      key={s.id}
                      href={`#${s.id}`}
                      onClick={() => setMenuOpen(false)}
                      style={{
                        display: 'block', textDecoration: 'none',
                        fontSize: 12.5, color: t.faint, padding: '4px 0 4px 12px', lineHeight: 1.35,
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.color = t.accent)}
                      onMouseOut={(e) => (e.currentTarget.style.color = t.faint)}
                    >
                      {s.title}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </>
  );

  return (
    <div style={{ minHeight: '100vh', background: t.bg, color: t.ink }}>
      {/* Top bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(250,248,244,.9)', backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${t.line}`,
        display: 'flex', alignItems: 'center', gap: 12, padding: '13px var(--px)',
      }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: t.ink }}>
          <Logo size={30} radius={8} />
          <span style={{ fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 15 }}>Chaitanya Tyagi</span>
        </a>
        <span style={{ fontFamily: t.fontMono, fontSize: 11.5, color: t.fainter }}>/ guide</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            className="guide-menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              display: 'none', fontFamily: t.fontMono, fontSize: 12, color: t.inkSoft,
              background: '#fff', border: `1px solid ${t.line}`, borderRadius: 8,
              padding: '7px 13px', cursor: 'pointer',
            }}
          >
            {menuOpen ? '✕ Close' : '☰ Topics'}
          </button>
          <a href="/" className="guide-back" style={{ textDecoration: 'none', fontSize: 13.5, color: t.inkSoft }}>
            ← Back to portfolio
          </a>
        </span>
      </div>

      {/* Mobile topic drawer */}
      {menuOpen && (
        <div className="guide-drawer" style={{
          position: 'sticky', top: 57, zIndex: 90, background: t.bg,
          borderBottom: `1px solid ${t.line}`, padding: '16px var(--px)',
          maxHeight: '70vh', overflowY: 'auto', animation: 'floatUp .2s ease both',
        }}>
          {sidebar}
        </div>
      )}

      <div className="guide-layout" style={{
        display: 'grid', gridTemplateColumns: '270px minmax(0,1fr)', gap: 44,
        maxWidth: 1240, margin: '0 auto', padding: '36px var(--px) 80px',
      }}>
        {/* Sidebar */}
        <aside className="guide-sidebar">
          <div style={{ position: 'sticky', top: 84, maxHeight: 'calc(100vh - 110px)', overflowY: 'auto', paddingRight: 6 }}>
            {sidebar}
          </div>
        </aside>

        {/* Main content */}
        <main style={{ minWidth: 0 }}>
          <Kicker text={topic.groupLabel} style={{ marginBottom: 10 }} />
          <article className="prose" dangerouslySetInnerHTML={{ __html: html }} />

          {/* Prev / next */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, marginTop: 52, paddingTop: 26, borderTop: `1px solid ${t.line}`, flexWrap: 'wrap' }}>
            {prev ? (
              <button onClick={() => goTo(prev.slug)} className="btn-lift" style={navBtnStyle}>
                <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.fainter }}>← PREVIOUS</span>
                <span style={{ fontWeight: 600, fontSize: 14.5 }}>{prev.title}</span>
              </button>
            ) : <span />}
            {next ? (
              <button onClick={() => goTo(next.slug)} className="btn-lift" style={{ ...navBtnStyle, textAlign: 'right', alignItems: 'flex-end' }}>
                <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.fainter }}>NEXT →</span>
                <span style={{ fontWeight: 600, fontSize: 14.5 }}>{next.title}</span>
              </button>
            ) : <span />}
          </div>
        </main>
      </div>
    </div>
  );
}

const navBtnStyle = {
  display: 'flex', flexDirection: 'column', gap: 5, cursor: 'pointer',
  background: '#fff', border: '1px solid #e6e1d7', borderRadius: 12,
  padding: '14px 18px', color: '#1a1714', fontFamily: 'inherit', maxWidth: 300,
};
