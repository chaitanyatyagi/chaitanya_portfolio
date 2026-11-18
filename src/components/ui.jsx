import { theme as t } from '../data.js';

// ---------------------------------------------------------------------------
// Shared section primitives — the site-wide "data pipeline" design language.
// Every section header is a pipeline node: pulsing dot → label → animated
// dashed flow line → stage number. Sections read as stages of one pipeline.
// ---------------------------------------------------------------------------

// Animated dashed connector — same motif as the hero pipeline card.
export function FlowDash({ width = 46, dark = false }) {
  return (
    <svg width={width} height="12" style={{ flexShrink: 0 }} aria-hidden="true">
      <line
        x1="0" y1="6" x2={width} y2="6"
        stroke={dark ? '#4a3a2e' : '#d8d2c6'} strokeWidth="1.5" strokeDasharray="4 4"
        style={{ animation: 'flowDash 1.2s linear infinite' }}
      />
    </svg>
  );
}

// Pipeline-node kicker: ● // label ┈┈┈ 02
// tone 'accent' (section labels) or 'faint' (hero). `no` adds the flow line +
// stage number; `after` renders trailing extras (e.g. a status badge).
export function Kicker({ text, no, dark = false, center = false, tone = 'accent', after, style }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: center ? 'center' : 'flex-start',
      gap: 10, marginBottom: 16, flexWrap: 'wrap', ...style,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.accent, animation: 'pulseDot 2s ease-in-out infinite', flexShrink: 0 }} />
      <span style={{ fontFamily: t.fontMono, fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: tone === 'accent' ? t.accent : t.faint }}>
        {text}
      </span>
      {no && (
        <>
          <FlowDash dark={dark} />
          <span style={{ fontFamily: t.fontMono, fontSize: 11, letterSpacing: '.1em', color: dark ? '#6b655c' : t.fainter }}>{no}</span>
        </>
      )}
      {after}
    </div>
  );
}

// Standard section header: kicker + h2 + optional description, one spacing
// scale everywhere. `right` docks an element (CTA) at the header's edge;
// `center` centers the whole block; `dark` adapts colors for dark sections.
export function SectionHeader({ kicker, no, heading, description, dark = false, center = false, right = null, gap = 40, after }) {
  const block = (
    <div style={center ? { textAlign: 'center' } : undefined}>
      <Kicker text={kicker} no={no} dark={dark} center={center} after={after} />
      <h2 style={{
        fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 34, lineHeight: 1.12,
        letterSpacing: '-.02em', margin: description ? '0 0 12px' : 0, maxWidth: center ? undefined : '24ch',
      }}>
        {heading}
      </h2>
      {description && (
        <p style={{
          fontSize: 16, lineHeight: 1.6, color: dark ? '#a9a296' : t.muted,
          margin: center ? '0 auto' : 0, maxWidth: '58ch',
        }}>
          {description}
        </p>
      )}
    </div>
  );

  if (right) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20, marginBottom: gap }}>
        {block}
        {right}
      </div>
    );
  }
  return <div style={{ marginBottom: gap }}>{block}</div>;
}
