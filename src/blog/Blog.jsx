import { useEffect, useState } from 'react';
import { marked } from 'marked';
import { theme as t } from '../data.js';
import Logo from '../components/Logo.jsx';
import { Kicker } from '../components/ui.jsx';

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

function slugFromPath() {
  const m = window.location.pathname.match(/^\/blog\/?([^/]*)/);
  return m && m[1] ? m[1] : null;
}

function TopBar() {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(250,248,244,.9)', backdropFilter: 'blur(14px)',
      borderBottom: `1px solid ${t.line}`,
      display: 'flex', alignItems: 'center', gap: 12, padding: '13px var(--px)',
    }}>
      <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: t.ink }}>
        <Logo size={30} radius={8} />
        <span style={{ fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 15 }}>Chaitanya Tyagi</span>
      </a>
      <span style={{ fontFamily: t.fontMono, fontSize: 11.5, color: t.fainter }}>/ blog</span>
      <a href="/" style={{ marginLeft: 'auto', textDecoration: 'none', fontSize: 13.5, color: t.inkSoft }}>
        ← Back to portfolio
      </a>
    </div>
  );
}

function TagChips({ tags }) {
  if (!tags?.length) return null;
  return (
    <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
      {tags.map((tag) => (
        <span key={tag} style={{ fontFamily: t.fontMono, fontSize: 10.5, color: t.accent, background: '#fff1ea', border: '1px solid #ffd9c7', padding: '3px 9px', borderRadius: 20 }}>
          {tag}
        </span>
      ))}
    </span>
  );
}

export default function Blog() {
  const [slug, setSlug] = useState(slugFromPath);
  const [posts, setPosts] = useState(null);
  const [post, setPost] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const onPop = () => setSlug(slugFromPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (slug) {
      setPost(null);
      setNotFound(false);
      fetch(`/api/blogs/${slug}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(setPost)
        .catch(() => setNotFound(true));
    } else {
      fetch('/api/blogs')
        .then((r) => (r.ok ? r.json() : []))
        .then(setPosts)
        .catch(() => setPosts([]));
    }
    window.scrollTo(0, 0);
  }, [slug]);

  useEffect(() => {
    document.title = post ? `${post.title} — Chaitanya Tyagi` : 'Blog — Chaitanya Tyagi';
  }, [post]);

  function open(nextSlug) {
    window.history.pushState({}, '', nextSlug ? `/blog/${nextSlug}` : '/blog');
    setSlug(nextSlug);
  }

  // ---- Single post view --------------------------------------------------
  if (slug) {
    return (
      <div style={{ minHeight: '100vh', background: t.bg, color: t.ink }}>
        <TopBar />
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '44px var(--px) 80px' }}>
          <button
            onClick={() => open(null)}
            style={{ fontFamily: t.fontMono, fontSize: 12, color: t.faint, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 26 }}
          >
            ← All posts
          </button>
          {notFound && (
            <div style={{ color: t.muted, fontSize: 15 }}>
              This post doesn't exist (or isn't published yet). <a href="/blog" style={{ color: t.accent }}>See all posts</a>.
            </div>
          )}
          {post && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                <span style={{ fontFamily: t.fontMono, fontSize: 12, color: t.fainter }}>{fmtDate(post.createdAt)}</span>
                <TagChips tags={post.tags} />
              </div>
              <h1 style={{ fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 'clamp(30px,4.5vw,42px)', letterSpacing: '-.02em', lineHeight: 1.12, margin: '0 0 26px' }}>
                {post.title}
              </h1>
              <article className="prose" dangerouslySetInnerHTML={{ __html: marked.parse(post.content || '') }} />
            </>
          )}
          {!post && !notFound && <div style={{ color: t.faint }}>Loading…</div>}
        </div>
      </div>
    );
  }

  // ---- List view ---------------------------------------------------------
  return (
    <div style={{ minHeight: '100vh', background: t.bg, color: t.ink }}>
      <TopBar />
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '52px var(--px) 80px' }}>
        <Kicker text="// blog" style={{ marginBottom: 14 }} />
        <h1 style={{ fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 38, letterSpacing: '-.02em', margin: '0 0 10px' }}>
          Field notes from the data trenches
        </h1>
        <p style={{ fontSize: 16, color: t.muted, margin: '0 0 42px', maxWidth: '56ch' }}>
          Writing about pipelines, patterns, and the lessons production teaches you.
        </p>

        {posts === null && <div style={{ color: t.faint }}>Loading…</div>}
        {posts?.length === 0 && (
          <div style={{ border: '1.5px dashed #d8d2c6', borderRadius: 14, padding: '26px 24px', textAlign: 'center', fontFamily: t.fontMono, fontSize: 13, color: t.faint }}>
            <span style={{ color: t.accent }}>+</span> First posts are being drafted — check back soon.
          </div>
        )}
        {posts?.map((p) => (
          <a
            key={p.slug}
            href={`/blog/${p.slug}`}
            onClick={(e) => { e.preventDefault(); open(p.slug); }}
            className="card-lift"
            style={{
              display: 'block', textDecoration: 'none', color: 'inherit',
              background: '#fff', border: `1px solid ${t.line}`, borderRadius: 14,
              padding: '22px 26px', marginBottom: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{ fontFamily: t.fontMono, fontSize: 11.5, color: t.fainter }}>{fmtDate(p.createdAt)}</span>
              <TagChips tags={p.tags} />
            </div>
            <div style={{ fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 20, letterSpacing: '-.01em', marginBottom: 6 }}>{p.title}</div>
            {p.excerpt && <div style={{ fontSize: 14.5, lineHeight: 1.6, color: t.muted }}>{p.excerpt}</div>}
            <div style={{ fontFamily: t.fontMono, fontSize: 12, color: t.accent, marginTop: 12 }}>Read post →</div>
          </a>
        ))}
      </div>
    </div>
  );
}
