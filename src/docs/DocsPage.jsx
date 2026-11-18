import { useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import { PlatformLayout, useHashScroll } from '../platform/Shell.jsx';
import { RequireAuth } from '../auth/AuthContext.jsx';
import { useApi } from '../lib/useApi.js';
import { renderModuleHtml, LoadState } from '../learn/components.jsx';
import { makeGithubSlugger } from '../../shared/content/slug.js';

// ---------------------------------------------------------------------------
// /docs/:slug — internal documentation reader (the architecture handbook).
// Content comes from GET /api/docs/:slug (server enforces access: admin-only
// for the handbook). Left: table of contents built from the ## / ### headings
// with scroll-spy; right: the rendered markdown. Heading ids are GitHub-style
// so the handbook's own "#section" links work here too.
// ---------------------------------------------------------------------------

const plain = (s) => s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*_`]/g, '').trim();

function tocFor(md) {
  const slug = makeGithubSlugger();
  const toc = [];
  for (const t of marked.lexer(md)) {
    if (t.type !== 'heading') continue;
    const id = slug(t.text);
    if (t.depth === 2 || t.depth === 3) toc.push({ id, depth: t.depth, title: plain(t.text) });
  }
  return toc;
}

function useActiveHeading(rootRef, toc) {
  const [active, setActive] = useState(toc[0]?.id);
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver((entries) => {
      const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (top) setActive(top.target.id);
    }, { rootMargin: '-80px 0px -70% 0px' });
    toc.forEach((h) => { const el = root.querySelector(`#${CSS.escape(h.id)}`); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [rootRef, toc]);
  return active;
}

function DocView({ doc }) {
  const articleRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const html = useMemo(() => renderModuleHtml(doc.body, { slugger: makeGithubSlugger }), [doc.body]);
  const toc = useMemo(() => tocFor(doc.body), [doc.body]);
  const active = useActiveHeading(articleRef, toc);
  const activeSection = useMemo(() => {
    const i = toc.findIndex((h) => h.id === active);
    for (let j = i; j >= 0; j--) if (toc[j].depth === 2) return toc[j].id;
    return null;
  }, [toc, active]);
  useHashScroll();

  // Keep the active TOC entry visible while scrolling a long sidebar.
  useEffect(() => {
    document.querySelector('.pf-docs-toc a.is-active')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const q = filter.trim().toLowerCase();
  const visible = toc.filter((h) => (q ? h.title.toLowerCase().includes(q) : h.depth === 2 || activeSection === h.id || isChildOf(toc, h, activeSection)));

  const nav = (
    <nav className="pf-docs-toc" aria-label="Contents">
      <input className="pf-input" type="search" placeholder="Filter sections…" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter sections" />
      {visible.map((h) => (
        <a
          key={h.id}
          href={`#${h.id}`}
          className={`is-d${h.depth}${active === h.id ? ' is-active' : ''}`}
          onClick={() => setMenuOpen(false)}
        >
          {h.title}
        </a>
      ))}
      {!visible.length && <span className="pf-meta">No matching sections.</span>}
    </nav>
  );

  return (
    <PlatformLayout title={doc.title} footer={false}>
      <div className="pf-reader-bar">
        <div className="pf-reader-bar-inner">
          <nav className="pf-crumbs" aria-label="Breadcrumb" style={{ margin: 0, minWidth: 0 }}>
            <span>Docs</span><span>/</span><span className="pf-ellipsis">{doc.title}</span>
          </nav>
          <span className="pf-meta pf-hide-sm">
            {doc.access === 'admin' ? '🔒 Admins only · ' : ''}Updated {new Date(doc.updatedAt).toLocaleDateString()}
          </span>
          <button className="pf-btn pf-btn-ghost pf-btn-sm pf-reader-menu-btn" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? '× Close' : '≡ Contents'}
          </button>
        </div>
        {menuOpen && <div className="pf-reader-drawer">{nav}</div>}
      </div>
      <div className="pf-reader pf-docs">
        <aside className="pf-reader-side">
          <div className="pf-reader-side-inner">
            <div className="pf-side-label" style={{ marginTop: 0 }}>Contents</div>
            {nav}
          </div>
        </aside>
        <main className="pf-reader-main pf-docs-main">
          <h1 className="pf-reader-title">{doc.title}</h1>
          <article ref={articleRef} className="pf-prose pf-docs-prose" dangerouslySetInnerHTML={{ __html: html }} />
          <button className="pf-btn pf-btn-ghost pf-btn-sm" style={{ marginTop: 40 }} onClick={() => window.scrollTo({ top: 0 })}>↑ Back to top</button>
        </main>
      </div>
    </PlatformLayout>
  );
}

// ### headings sit under the nearest preceding ## heading.
function isChildOf(toc, h, sectionId) {
  if (h.depth !== 3 || !sectionId) return false;
  const i = toc.indexOf(h);
  for (let j = i - 1; j >= 0; j--) if (toc[j].depth === 2) return toc[j].id === sectionId;
  return false;
}

function DocLoader({ slug }) {
  const { data, error, loading } = useApi(`/docs/${slug}`);
  if (error?.status === 403 || error?.status === 404) {
    return (
      <PlatformLayout title="Docs">
        <div className="pf-wrap pf-load-error">
          {error.status === 403 ? 'This document is available to admins only.' : "That document doesn't exist."}
          {' '}<a className="pf-link-arrow" href="/">Home →</a>
        </div>
      </PlatformLayout>
    );
  }
  return (
    <LoadState loading={loading} error={error} label="Loading document…">
      {data && <DocView doc={data.doc} />}
    </LoadState>
  );
}

export default function DocsPage({ path }) {
  const slug = path.replace(/\/+$/, '').split('/')[2] || 'architecture';
  return (
    <RequireAuth>
      <DocLoader slug={slug} />
    </RequireAuth>
  );
}
