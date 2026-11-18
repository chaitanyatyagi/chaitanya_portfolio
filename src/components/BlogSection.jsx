import { useEffect, useState } from 'react';
import { theme as t } from '../data.js';
import { useContent } from '../ContentContext.jsx';
import Reveal from './Reveal.jsx';
import { SectionHeader } from './ui.jsx';

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// Home-page blog teaser: latest three published posts (managed via /admin),
// with a friendly placeholder while the first posts are being written.
export default function BlogSection() {
  const { blog } = useContent();
  const [posts, setPosts] = useState(null);

  useEffect(() => {
    fetch('/api/blogs')
      .then((r) => (r.ok ? r.json() : []))
      .then((all) => setPosts((all || []).slice(0, 3)))
      .catch(() => setPosts([]));
  }, []);

  return (
    <section id="blog" style={{ padding: '84px var(--px)', maxWidth: 1180, margin: '0 auto' }}>
      <Reveal>
        <SectionHeader
          kicker="// blog"
          no="06"
          heading={blog.heading}
          description={blog.description}
          right={posts?.length > 0 ? (
            <a href="/blog" className="btn-lift" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none',
              fontSize: 14, fontWeight: 500, color: t.ink, border: '1px solid #d8d2c6',
              padding: '11px 18px', borderRadius: 9, whiteSpace: 'nowrap',
            }}>
              All posts <span style={{ fontFamily: t.fontMono }}>→</span>
            </a>
          ) : null}
        />
      </Reveal>

      {posts?.length === 0 && (
        <Reveal>
          <div style={{ border: '1.5px dashed #d8d2c6', borderRadius: 14, padding: '24px 22px', textAlign: 'center', fontFamily: t.fontMono, fontSize: 12.5, color: t.faint }}>
            <span style={{ fontSize: 14, color: t.accent }}>+ </span>{blog.emptyText}
          </div>
        </Reveal>
      )}

      {posts?.length > 0 && (
        <div className="grid-collapse" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(posts.length, 3)},1fr)`, gap: 16 }}>
          {posts.map((p, i) => (
            <Reveal key={p.slug} delay={i * 90} style={{ height: '100%' }}>
              <a href={`/blog/${p.slug}`} className="card-lift" style={{
                display: 'flex', flexDirection: 'column', height: '100%', textDecoration: 'none', color: 'inherit',
                background: '#fff', border: `1px solid ${t.line}`, borderRadius: 16, padding: 24,
              }}>
                <div style={{ fontFamily: t.fontMono, fontSize: 11.5, color: t.fainter, marginBottom: 10 }}>{fmtDate(p.createdAt)}</div>
                <div style={{ fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 18.5, lineHeight: 1.25, letterSpacing: '-.01em', marginBottom: 8 }}>{p.title}</div>
                {p.excerpt && <div style={{ fontSize: 14, lineHeight: 1.6, color: t.muted, marginBottom: 14 }}>{p.excerpt}</div>}
                <div style={{ marginTop: 'auto', fontFamily: t.fontMono, fontSize: 12, color: t.accent }}>Read post →</div>
              </a>
            </Reveal>
          ))}
        </div>
      )}
    </section>
  );
}
