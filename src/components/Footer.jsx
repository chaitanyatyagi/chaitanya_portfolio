import { theme as t } from '../data.js';
import { useContent } from '../ContentContext.jsx';

export default function Footer() {
  const { footer, links, nav } = useContent();

  return (
    <footer style={{ padding: '72px var(--px) 40px', maxWidth: 1180, margin: '0 auto' }}>
      <div className="grid-collapse" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 40, paddingBottom: 40, borderBottom: `1px solid ${t.line}` }}>
        <div>
          <h3 style={{ fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 26, letterSpacing: '-.02em', margin: '0 0 12px', maxWidth: '16ch' }}>
            {footer.headline}
          </h3>
          <a href={`mailto:${links.email}`} style={{ fontSize: 16, color: t.accent, textDecoration: 'none' }}>{links.email}</a>
          <div style={{ fontFamily: t.fontMono, fontSize: 13, color: t.faint, marginTop: 8 }}>{links.phone} · {links.location}</div>
        </div>
        <div>
          <div style={{ fontFamily: t.fontMono, fontSize: 11, letterSpacing: '.1em', color: t.fainter, marginBottom: 14 }}>LINKS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14.5 }}>
            <a href={links.github} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: t.inkSoft }}>GitHub ↗</a>
            <a href={links.linkedin} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: t.inkSoft }}>LinkedIn ↗</a>
            <a href={links.resume} download style={{ textDecoration: 'none', color: t.inkSoft }}>Résumé ↓</a>
          </div>
        </div>
        <div>
          <div style={{ fontFamily: t.fontMono, fontSize: 11, letterSpacing: '.1em', color: t.fainter, marginBottom: 14 }}>NAVIGATE</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14.5 }}>
            {(nav.items || []).map((item) => (
              <a key={item.href} href={item.href} style={{ textDecoration: 'none', color: t.inkSoft }}>{item.label}</a>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 24, fontFamily: t.fontMono, fontSize: 12, color: t.fainter, flexWrap: 'wrap', gap: 10 }}>
        <span>{footer.copyright}</span>
        <span>{footer.tagline}</span>
      </div>
    </footer>
  );
}
