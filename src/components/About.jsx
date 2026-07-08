import { theme as t } from '../data.js';
import { useContent } from '../ContentContext.jsx';
import Reveal from './Reveal.jsx';

const Fact = ({ k, a, b }) => (
  <div>
    <span style={{ fontFamily: t.fontMono, color: t.fainter, fontSize: 12 }}>{k}</span>
    <br />
    <strong style={{ fontWeight: 600 }}>{a}</strong>
    <br />
    <span style={{ color: t.faint }}>{b}</span>
  </div>
);

export default function About() {
  const { about } = useContent();

  return (
    <section id="about" style={{ background: t.bgAlt, borderTop: `1px solid ${t.line}`, borderBottom: `1px solid ${t.line}`, padding: '80px var(--px)' }}>
      <div className="grid-collapse" style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: 64, alignItems: 'start' }}>
        <Reveal>
          <div style={{ fontFamily: t.fontMono, fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: t.accent, marginBottom: 16 }}>// about</div>
          <h2 style={{ fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 34, lineHeight: 1.12, letterSpacing: '-.02em', margin: '0 0 20px' }}>
            {about.heading}
          </h2>
          {(about.paragraphs || []).map((p, i) => (
            <p key={i} style={{ fontSize: 16, lineHeight: 1.65, color: t.muted, margin: i === (about.paragraphs.length - 1) ? 0 : '0 0 16px' }}>
              {p}
            </p>
          ))}
          <div style={{ display: 'flex', gap: 26, marginTop: 28, fontSize: 14, flexWrap: 'wrap' }}>
            {(about.facts || []).map((f) => <Fact key={f.k} {...f} />)}
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div style={{ fontFamily: t.fontMono, fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: t.fainter, marginBottom: 18 }}>{about.stackLabel}</div>
          {(about.stackGroups || []).map((g) => (
            <div key={g.label} style={{ marginBottom: 22 }}>
              <div style={{ fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 14, color: t.ink, marginBottom: 11 }}>{g.label}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {g.items.map((item) => (
                  <span key={item} className="chip-lift" style={{ fontFamily: t.fontMono, fontSize: 12.5, color: '#4a453e', background: '#fff', border: `1px solid ${t.line}`, padding: '6px 12px', borderRadius: 7 }}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
