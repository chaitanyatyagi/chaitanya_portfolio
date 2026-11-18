import { theme as t } from '../data.js';
import { useContent, Accent } from '../ContentContext.jsx';
import { Kicker } from './ui.jsx';

export default function Hero() {
  const { hero } = useContent();
  const pipeline = hero.pipeline || [];

  return (
    <header style={{ padding: '96px var(--px) 88px', maxWidth: 1180, margin: '0 auto' }}>
      <Kicker text={hero.kicker} tone="faint" style={{ marginBottom: 26, animation: 'floatUp .6s ease both' }} />
      <h1 style={{
        fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 'clamp(40px,6.4vw,78px)',
        lineHeight: 1.02, letterSpacing: '-.03em', margin: '0 0 26px', maxWidth: '16ch',
        animation: 'floatUp .6s ease .05s both',
      }}>
        <Accent text={hero.title} color={t.accent} />
      </h1>
      <p style={{
        fontSize: 19, lineHeight: 1.55, color: t.muted, maxWidth: '60ch',
        margin: '0 0 38px', animation: 'floatUp .6s ease .1s both',
      }}>
        {hero.intro}
      </p>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 64, animation: 'floatUp .6s ease .15s both' }}>
        <a href="#projects" className="btn-lift" style={{
          display: 'inline-flex', alignItems: 'center', gap: 9, textDecoration: 'none',
          fontSize: 15, fontWeight: 500, color: t.bg, background: t.ink, padding: '14px 24px', borderRadius: 10,
        }}>
          {hero.ctaPrimary} <span style={{ fontFamily: t.fontMono }}>→</span>
        </a>
        <a href="#connect" className="btn-lift" style={{
          display: 'inline-flex', alignItems: 'center', gap: 9, textDecoration: 'none',
          fontSize: 15, fontWeight: 500, color: t.ink, background: 'transparent',
          padding: '14px 24px', borderRadius: 10, border: '1px solid #d8d2c6',
        }}>
          {hero.ctaSecondary}
        </a>
      </div>

      {/* Pipeline motif */}
      <div style={{
        border: `1px solid ${t.line}`, borderRadius: 16, background: '#fff',
        padding: '26px 30px', animation: 'floatUp .6s ease .2s both', overflowX: 'auto',
      }}>
        <div style={{ fontFamily: t.fontMono, fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: t.fainter, marginBottom: 20 }}>
          {hero.pipelineLabel}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
          {pipeline.map((s, i) => (
            <div key={s.step} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 120 }}>
                <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.accent }}>{s.step}</span>
                <span style={{ fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 16 }}>{s.name}</span>
                <span style={{ fontSize: 12.5, color: t.faint }}>{s.tool}</span>
              </div>
              {i < pipeline.length - 1 && (
                <svg width="46" height="12" style={{ margin: '0 6px', flexShrink: 0 }}>
                  <line x1="0" y1="6" x2="46" y2="6" stroke="#d8d2c6" strokeWidth="1.5" strokeDasharray="4 4" style={{ animation: 'flowDash 1.2s linear infinite' }} />
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20, marginTop: 26, animation: 'floatUp .6s ease .25s both' }}>
        {(hero.stats || []).map((s) => (
          <div key={s.label} style={{ borderLeft: `2px solid ${t.accent}`, paddingLeft: 16 }}>
            <div style={{ fontFamily: t.fontDisplay, fontWeight: 700, fontSize: 32, letterSpacing: '-.02em' }}>{s.value}</div>
            <div style={{ fontSize: 13, color: t.faint, lineHeight: 1.35, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </header>
  );
}
