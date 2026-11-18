import { useEffect, useRef, useState } from 'react';
import { BRAND } from './catalog.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useApi, useCatalog } from '../lib/useApi.js';
import './platform.css';

// ---------------------------------------------------------------------------
// Shared platform chrome — brand mark, nav, footer and icon set. Every new
// platform page (landing, learn, practice) renders inside <PlatformLayout>.
// ---------------------------------------------------------------------------

export const NAV_ITEMS = [
  { href: '/learn', label: 'Learn' },
  { href: '/practice', label: 'Practice' },
  { href: '/interview', label: 'Interview' },
  { href: '/contests', label: 'Contests', badge: 'contests' },
  { href: '/practice#hackathons', label: 'Hackathons' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/blog', label: 'Blog' },
];

// Brand mark: three table rows of shrinking length and a green "pass" dot.
export function BrandMark({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      <rect x="0.5" y="0.5" width="21" height="21" rx="5" fill="#121412" />
      <path d="M5 7h12M5 11h8M5 15h4" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="15.5" cy="15" r="1.8" fill="#5FD39A" />
    </svg>
  );
}

const ICON_PATHS = {
  sql: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" /></>,
  python: <><path d="M8 4h6a3 3 0 0 1 3 3v4H9a3 3 0 0 0-3 3v2H5a2 2 0 0 1-2-2V9a5 5 0 0 1 5-5z" /><path d="M16 20h-6a3 3 0 0 1-3-3v-4h8a3 3 0 0 0 3-3V8h1a2 2 0 0 1 2 2v5a5 5 0 0 1-5 5z" /></>,
  spark: <path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" />,
  model: <><rect x="3" y="3" width="7" height="6" rx="1.5" /><rect x="14" y="3" width="7" height="6" rx="1.5" /><rect x="8.5" y="15" width="7" height="6" rx="1.5" /><path d="M6.5 9v3h11V9M12 12v3" /></>,
  pipeline: <><circle cx="5" cy="12" r="2.5" /><circle cx="12" cy="6" r="2.5" /><circle cx="12" cy="18" r="2.5" /><circle cx="19" cy="12" r="2.5" /><path d="M7 11l3-3.5M7 13l3 3.5M14 7.5l3 3M14 16.5l3-3" /></>,
  system: <><rect x="3" y="4" width="18" height="6" rx="1.5" /><rect x="3" y="14" width="18" height="6" rx="1.5" /><path d="M7 7h.01M7 17h.01M11 7h6M11 17h6" /></>,
  pandas: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M3 14h18M9 4v16M15 4v16" /></>,
  terminal: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9l3 3-3 3M12 15h5" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  book: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 21V5M8 7h7" /></>,
  code: <path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />,
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H4a3 3 0 0 0 4 4M16 6h4a3 3 0 0 1-4 4M12 13v4M8 21h8M9 17h6" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  doc: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>,
  bulb: <><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" /></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3M15 8l2 2" /></>,
  play: <path d="M7 5l12 7-12 7z" />,
  upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v4h16v-4" /></>,
  chevron: <path d="M6 9l6 6 6-6" />,
  exit: <><path d="M14 4h6v16h-6" /><path d="M10 8l-4 4 4 4M6 12h10" /></>,
  flag: <><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></>,
};

export function Icon({ name, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[name] || ICON_PATHS.code}
    </svg>
  );
}

function UserMenu({ user, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const initials = user.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="pf-user" ref={ref}>
      <button className="pf-avatar" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Account menu">{initials}</button>
      {open && (
        <div className="pf-user-menu">
          <div className="pf-user-id"><b>{user.name}</b><span>{user.email}</span><span>★ {user.points ?? 0} points</span></div>
          <a href={`/u/${user.username}`}>My profile</a>
          <a href="/contests">My contests</a>
          <a href="/learn">My courses</a>
          <a href="/practice">My practice</a>
          {user.role === 'admin' && <a href="/docs/architecture">Architecture handbook</a>}
          <button onClick={onSignOut}>Sign out</button>
        </div>
      )}
    </div>
  );
}

function PlatformNav() {
  const [open, setOpen] = useState(false);
  const { user, status, signOut } = useAuth();
  const path = window.location.pathname;
  const isActive = (href) => href !== '/' && !href.includes('#') && path.startsWith(href);
  // Pending contest invitations / a running contest → a dot on "Contests".
  const inbox = useApi(user ? '/contests/inbox' : null);
  const badge = { contests: inbox.data ? inbox.data.invitations + inbox.data.live : 0 };
  const badgeTitle = inbox.data ? [inbox.data.invitations && `${inbox.data.invitations} invitation(s)`, inbox.data.live && 'a contest is running'].filter(Boolean).join(', ') : '';

  return (
    <nav className="pf-nav">
      <div className="pf-wrap pf-nav-inner">
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <a href="/" className="pf-brand"><BrandMark /> {BRAND.name}</a>
          <div className="pf-nav-links">
            {NAV_ITEMS.map((item) => (
              <a key={item.href} href={item.href} className={`pf-nav-link${isActive(item.href) ? ' is-active' : ''}`}>
                {item.label}
                {item.badge && badge[item.badge] > 0 && <span className="pf-nav-badge" title={badgeTitle}>{badge[item.badge]}</span>}
              </a>
            ))}
          </div>
        </div>
        <div className="pf-nav-right">
          {status === 'ready' && (user ? <UserMenu user={user} onSignOut={signOut} /> : (
            <>
              <a href={`/login?next=${encodeURIComponent(path)}`} className="pf-nav-link pf-hide-sm">Sign in</a>
              <a href="/signup" className="pf-btn pf-btn-primary pf-btn-sm pf-hide-sm">Start practising</a>
            </>
          ))}
          <button className="pf-burger" aria-label="Menu" onClick={() => setOpen(!open)}>{open ? '×' : '≡'}</button>
        </div>
      </div>
      {open && (
        <div className="pf-mobile-menu">
          {NAV_ITEMS.map((item) => (
            <a key={item.href} href={item.href} onClick={() => setOpen(false)}>{item.label}</a>
          ))}
          {user
            ? <button className="pf-mobile-signout" onClick={signOut}>Sign out ({user.name})</button>
            : <a href="/login" style={{ color: 'var(--accent)', borderBottom: 'none' }}>Sign in →</a>}
        </div>
      )}
    </nav>
  );
}

function PlatformFooter() {
  const { data } = useCatalog();
  const courses = data?.courses || [];
  const tracks = data?.tracks || [];
  return (
    <footer className="pf-footer">
      <div className="pf-wrap">
        <div className="pf-footer-grid">
          <div>
            <a href="/" className="pf-brand" style={{ marginBottom: 14 }}><BrandMark /> {BRAND.name}</a>
            <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.65, maxWidth: '36ch', margin: '14px 0 0' }}>
              {BRAND.description}
            </p>
          </div>
          <div>
            <h5>Learn</h5>
            <div className="pf-footer-col">
              {courses.map((c) => <a key={c.id} href={`/learn/${c.id}`}>{c.title}</a>)}
            </div>
          </div>
          <div>
            <h5>Practice</h5>
            <div className="pf-footer-col">
              {tracks.filter((p) => p.kind !== 'hackathon').map((p) => <a key={p.id} href={`/practice/${p.id}`}>{p.title}</a>)}
            </div>
          </div>
          <div>
            <h5>Hackathons</h5>
            <div className="pf-footer-col">
              {tracks.filter((p) => p.kind === 'hackathon').map((p) => <a key={p.id} href={`/practice/${p.id}`}>{p.title}</a>)}
            </div>
          </div>
          <div>
            <h5>Resources</h5>
            <div className="pf-footer-col">
              <a href="/blog">Blog</a>
              <a href="/#faq">FAQ</a>
            </div>
          </div>
        </div>
        <div className="pf-footer-bottom">
          <span>© {new Date().getFullYear()} {BRAND.name}. All rights reserved.</span>
          <span>{BRAND.tagline}</span>
        </div>
      </div>
    </footer>
  );
}

// Content renders after load, so the browser's own #anchor jump misses it.
// Jump instantly (smooth scrolling gets interrupted while the page settles);
// targets use scroll-margin-top to clear the sticky bars.
// Also handles in-page #links (hashchange), which don't remount the page.
export function useHashScroll() {
  useEffect(() => {
    let frame;
    const jump = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const el = id && document.getElementById(id);
      if (el) frame = requestAnimationFrame(() => el.scrollIntoView({ behavior: 'instant' }));
    };
    jump();
    window.addEventListener('hashchange', jump);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('hashchange', jump); };
  }, []);
}

// nav={false}: focus mode (the contest arena brings its own top bar).
export function PlatformLayout({ title, footer = true, nav = true, children }) {
  useEffect(() => {
    document.body.classList.add('pf-body');
    return () => document.body.classList.remove('pf-body');
  }, []);
  useEffect(() => {
    document.title = title ? `${title} · ${BRAND.name}` : `${BRAND.name} — ${BRAND.tagline}`;
  }, [title]);

  return (
    <div className="pf">
      {nav && <PlatformNav />}
      <main>{children}</main>
      {footer && <PlatformFooter />}
    </div>
  );
}
