import { theme as t } from '../data.js';
import { useContent } from '../ContentContext.jsx';
import Reveal from './Reveal.jsx';

export default function Projects() {
  const { projects } = useContent();

  return (
    <section id="projects" style={{ background: t.ink, color: t.bg, padding: '84px var(--px)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <Reveal>
          <div style={{ fontFamily: t.fontMono, fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: t.accent, marginBottom: 16 }}>// featured projects</div>
          <h2 style={{ fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 34, letterSpacing: '-.02em', margin: '0 0 12px' }}>
            {projects.heading}
          </h2>
          <p style={{ fontSize: 16, color: '#a9a296', margin: '0 0 44px', maxWidth: '56ch' }}>
            {projects.description}
          </p>
        </Reveal>
        <div className="grid-collapse" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {(projects.items || []).map((p, i) => (
            <Reveal key={p.name} delay={(i % 2) * 100} style={{ height: '100%' }}>
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="project-card"
                style={{
                  textDecoration: 'none', color: 'inherit', height: '100%',
                  display: 'flex', flexDirection: 'column',
                  background: t.darkPanel, border: `1px solid ${t.darkLine}`, borderRadius: 16,
                  padding: 28, transition: 'border-color .2s, transform .2s, box-shadow .2s',
                }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = t.accent; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 18px 40px -24px rgba(255,107,53,.35)'; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = t.darkLine; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                    <span style={{ fontFamily: t.fontMono, fontSize: 12, color: '#57514a' }}>{String(i + 1).padStart(2, '0')}</span>
                    <span style={{ fontFamily: t.fontMono, fontSize: 11, letterSpacing: '.1em', color: t.accent, border: '1px solid #4a3a2e', padding: '4px 10px', borderRadius: 20 }}>{p.kind}</span>
                  </span>
                  <span style={{ fontFamily: t.fontMono, fontSize: 13, color: '#6b655c' }}>↗</span>
                </div>
                <h3 style={{ fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 21, lineHeight: 1.2, margin: '0 0 12px' }}>{p.name}</h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.6, color: '#a9a296', margin: '0 0 20px' }}>{p.desc}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 'auto' }}>
                  {(p.tech || []).map((tech) => (
                    <span key={tech} style={{ fontFamily: t.fontMono, fontSize: 11.5, color: '#c9c2b6', background: '#2c2721', border: '1px solid #3a342c', padding: '4px 10px', borderRadius: 6 }}>
                      {tech}
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20, paddingTop: 16, borderTop: `1px solid ${t.darkLine}` }}>
                  <span className="project-link" style={{ fontFamily: t.fontMono, fontSize: 12, color: '#8a8377', transition: 'color .2s' }}>
                    View on GitHub →
                  </span>
                </div>
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
