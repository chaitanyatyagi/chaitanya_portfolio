import { useState } from 'react';
import { theme as t } from '../data.js';
import { useContent } from '../ContentContext.jsx';

export default function Nav() {
  const { meta, nav, links } = useContent();
  const [open, setOpen] = useState(false);

  return (
    <nav
      style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(250,248,244,.82)', backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${t.line}`,
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px var(--px)',
      }}>
        <a href="#top" style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 34, height: 34, background: t.ink, borderRadius: 9,
            fontFamily: t.fontDisplay, fontWeight: 700, color: t.bg, fontSize: 16,
          }}>{meta.logoLetter}</span>
          <span style={{ fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 16, letterSpacing: '-.01em' }}>
            {meta.siteName}
          </span>
        </a>

        <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
          <div className="nav-links" style={{ display: 'flex', gap: 28, fontSize: 14, color: '#4a453e' }}>
            {nav.items.map((item) => (
              <a
                key={item.href}
                href={item.href}
                style={{ textDecoration: 'none', transition: 'color .2s' }}
                onMouseOver={(e) => (e.currentTarget.style.color = t.accent)}
                onMouseOut={(e) => (e.currentTarget.style.color = '#4a453e')}
              >
                {item.label}
              </a>
            ))}
          </div>
          <a
            href={links.resume}
            download
            className="nav-resume"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, textDecoration: 'none',
              fontSize: 13.5, fontWeight: 500, color: t.bg, background: t.ink,
              padding: '9px 16px', borderRadius: 8,
            }}
          >
            <span style={{ fontFamily: t.fontMono, fontSize: 11 }}>↓</span> {nav.resumeLabel}
          </a>
          <button
            className="nav-burger"
            aria-label="Menu"
            onClick={() => setOpen(!open)}
            style={{
              display: 'none', flexDirection: 'column', justifyContent: 'center', gap: 5,
              width: 38, height: 38, background: 'transparent',
              border: `1px solid ${t.line}`, borderRadius: 9, cursor: 'pointer', padding: 9,
            }}
          >
            <span style={{ height: 2, background: t.ink, borderRadius: 2, transition: 'transform .25s', transform: open ? 'translateY(3.5px) rotate(45deg)' : 'none' }} />
            <span style={{ height: 2, background: t.ink, borderRadius: 2, transition: 'transform .25s', transform: open ? 'translateY(-3.5px) rotate(-45deg)' : 'none' }} />
          </button>
        </div>
      </div>

      {open && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 4, padding: '6px var(--px) 18px',
          borderTop: `1px solid ${t.line}`, animation: 'floatUp .25s ease both',
        }}>
          {nav.items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              style={{ textDecoration: 'none', color: t.inkSoft, fontSize: 15, padding: '11px 4px', borderBottom: `1px solid ${t.line}` }}
            >
              {item.label}
            </a>
          ))}
          <a
            href={links.resume}
            download
            onClick={() => setOpen(false)}
            style={{ textDecoration: 'none', color: t.accent, fontSize: 15, padding: '11px 4px', fontWeight: 500 }}
          >
            ↓ {nav.resumeLabel}
          </a>
        </div>
      )}
    </nav>
  );
}
