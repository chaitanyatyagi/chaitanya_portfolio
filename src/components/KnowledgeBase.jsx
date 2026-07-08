import { theme as t } from '../data.js';
import { useContent } from '../ContentContext.jsx';
import Reveal from './Reveal.jsx';

export default function KnowledgeBase() {
  const { knowledge } = useContent();

  return (
    <section id="knowledge" style={{ padding: '84px var(--px)', maxWidth: 1180, margin: '0 auto' }}>
      <Reveal>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20, marginBottom: 44 }}>
          <div>
            <div style={{ fontFamily: t.fontMono, fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: t.accent, marginBottom: 16 }}>// knowledge base</div>
            <h2 style={{ fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 34, letterSpacing: '-.02em', margin: '0 0 12px' }}>
              {knowledge.heading}
            </h2>
            <p style={{ fontSize: 16, color: t.muted, margin: 0, maxWidth: '58ch' }}>
              {knowledge.description}
            </p>
          </div>
          <a
            href={knowledge.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-lift"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', fontSize: 14, fontWeight: 500, color: t.ink, border: '1px solid #d8d2c6', padding: '11px 18px', borderRadius: 9, whiteSpace: 'nowrap' }}
          >
            {knowledge.githubLabel} <span style={{ fontFamily: t.fontMono }}>→</span>
          </a>
        </div>
      </Reveal>
      <div className="chapters-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 16 }}>
        {(knowledge.chapters || []).map((c, i) => (
          <Reveal key={c.num} delay={Math.min(i * 80, 320)}>
            <div className="card-lift" style={{ background: '#fff', border: `1px solid ${t.line}`, borderRadius: 14, padding: 22, display: 'flex', flexDirection: 'column', minHeight: 210, height: '100%' }}>
              <div style={{ fontFamily: t.fontDisplay, fontWeight: 700, fontSize: 30, color: '#ede7db', lineHeight: 1 }}>{c.num}</div>
              <div style={{ fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 16, lineHeight: 1.25, margin: '14px 0 10px' }}>{c.title}</div>
              <div style={{ fontSize: 13, color: t.faint, lineHeight: 1.5, marginTop: 'auto' }}>{c.patterns}</div>
            </div>
          </Reveal>
        ))}
      </div>
      {knowledge.moreText && (
        <Reveal delay={200}>
          <div style={{
            marginTop: 16, border: '1.5px dashed #d8d2c6', borderRadius: 14, padding: '18px 22px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap', textAlign: 'center',
          }}>
            <span style={{ fontFamily: t.fontMono, fontSize: 14, color: t.accent }}>+</span>
            <span style={{ fontFamily: t.fontMono, fontSize: 12.5, color: t.faint }}>{knowledge.moreText}</span>
          </div>
        </Reveal>
      )}
    </section>
  );
}
