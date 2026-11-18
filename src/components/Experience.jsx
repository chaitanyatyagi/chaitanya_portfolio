import { theme as t } from '../data.js';
import { useContent } from '../ContentContext.jsx';
import Reveal from './Reveal.jsx';
import { SectionHeader } from './ui.jsx';

// Timeline of self-contained job cards. Each card: header (company/role/period),
// optional summary + badge, a 2-col grid of tagged highlights, and a stack row.
// Scales cleanly as new jobs are added — newest job goes first in the list.
export default function Experience() {
  const { experience } = useContent();
  const jobs = experience.jobs || [];

  return (
    <section id="work" style={{ padding: '84px var(--px)', maxWidth: 1180, margin: '0 auto' }}>
      <Reveal>
        <SectionHeader kicker="// experience" no="02" heading={experience.heading} gap={44} />
      </Reveal>

      {jobs.map((job, ji) => (
        <div key={ji} className="xp-row" style={{ display: 'grid', gridTemplateColumns: '44px 1fr', gap: 0 }}>
          {/* Timeline rail */}
          <div className="xp-rail" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 34 }}>
            <span style={{
              width: 11, height: 11, borderRadius: '50%', background: t.accent, flexShrink: 0,
              boxShadow: '0 0 0 4px #ffe3d6',
            }} />
            {ji < jobs.length - 1 && (
              <span style={{ width: 2, flex: 1, marginTop: 10, background: 'repeating-linear-gradient(180deg, #d8d2c6 0 4px, transparent 4px 8px)' }} />
            )}
          </div>

          <Reveal style={{ paddingBottom: ji < jobs.length - 1 ? 28 : 0 }}>
            <div className="card-lift" style={{ background: '#fff', border: `1px solid ${t.line}`, borderRadius: 18, padding: '30px 32px' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: t.fontDisplay, fontWeight: 700, fontSize: 23, letterSpacing: '-.01em' }}>{job.company}</span>
                    {job.badge && (
                      <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.accent, background: '#fff1ea', border: '1px solid #ffd9c7', padding: '4px 11px', borderRadius: 20 }}>
                        {job.badge}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 15, color: t.inkSoft, marginTop: 6, fontWeight: 500 }}>
                    {job.role}
                    {job.client && <span style={{ color: t.faint, fontWeight: 400 }}> · {job.client}</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: t.fontMono, fontSize: 12, color: t.inkSoft, background: t.bg, border: `1px solid ${t.line}`, padding: '6px 12px', borderRadius: 8, whiteSpace: 'nowrap' }}>
                    {job.period}
                  </div>
                  <div style={{ fontFamily: t.fontMono, fontSize: 11.5, color: t.fainter, marginTop: 7 }}>{job.location}</div>
                </div>
              </div>

              {/* Summary */}
              {job.summary && (
                <p style={{ fontSize: 15.5, lineHeight: 1.6, color: t.muted, margin: '18px 0 0', maxWidth: '72ch' }}>
                  {job.summary}
                </p>
              )}

              {/* Highlights */}
              {(job.bullets || []).length > 0 && (
                <div className="xp-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 22 }}>
                  {job.bullets.map((b, i) => (
                    <div key={i} style={{ background: t.bg, border: `1px solid ${t.line}`, borderRadius: 12, padding: '15px 17px' }}>
                      <div style={{ fontFamily: t.fontMono, fontSize: 10.5, letterSpacing: '.12em', color: t.accent, marginBottom: 7 }}>{b.tag}</div>
                      <div style={{ fontSize: 14, lineHeight: 1.6, color: t.inkSoft }}>{b.text}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Stack */}
              {(job.stack || []).length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 22, paddingTop: 18, borderTop: `1px solid ${t.line}` }}>
                  <span style={{ fontFamily: t.fontMono, fontSize: 10.5, letterSpacing: '.12em', color: t.fainter, marginRight: 4 }}>STACK</span>
                  {job.stack.map((s) => (
                    <span key={s} className="chip-lift" style={{ fontFamily: t.fontMono, fontSize: 11.5, color: t.muted, background: t.bg, border: `1px solid ${t.line}`, padding: '4px 11px', borderRadius: 20 }}>
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Reveal>
        </div>
      ))}
    </section>
  );
}
