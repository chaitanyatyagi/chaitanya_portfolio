import { useEffect, useMemo, useRef, useState } from 'react';
import { PlatformLayout, useHashScroll } from '../platform/Shell.jsx';
import { RequireAuth } from '../auth/AuthContext.jsx';
import { useApi } from '../lib/useApi.js';
import { courseUrl, moduleUrl } from './courseData.js';
import { setModuleCompleted, recordVisit, courseProgress } from './progress.js';
import { renderModuleHtml, ProgressBar, LoadState } from './components.jsx';

// Highlights the lesson currently being read in the sidebar.
function useActiveLesson(articleRef, lessons) {
  const [active, setActive] = useState(lessons[0]?.id || null);
  useEffect(() => {
    const root = articleRef.current;
    if (!root || !('IntersectionObserver' in window)) return;
    const headings = lessons.map((l) => root.querySelector(`#${CSS.escape(l.id)}`)).filter(Boolean);
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-90px 0px -65% 0px' }
    );
    headings.forEach((h) => io.observe(h));
    return () => io.disconnect();
  }, [articleRef, lessons]);
  return active;
}

// Lesson content is for signed-in learners: the outline and the body load in
// parallel, then the reader renders.
export default function ModuleReader({ courseId, slug }) {
  return (
    <RequireAuth>
      <ModuleLoader courseId={courseId} slug={slug} />
    </RequireAuth>
  );
}

function ModuleLoader({ courseId, slug }) {
  const outline = useApi(`/courses/${courseId}`);
  const body = useApi(`/courses/${courseId}/modules/${slug}`);
  const module = outline.data?.course.modules.find((m) => m.slug === slug);
  const missing = outline.error?.status === 404 || body.error?.status === 404 || (outline.data && !module);
  if (missing) {
    return (
      <PlatformLayout title="Module not found">
        <div className="pf-wrap pf-load-error">That module doesn't exist. <a className="pf-link-arrow" href={`/learn/${courseId}`}>Back to the course →</a></div>
      </PlatformLayout>
    );
  }
  return (
    <LoadState loading={outline.loading || body.loading} error={outline.error || body.error} label="Loading lesson…">
      {module && body.data && (
        <ModuleView
          course={outline.data.course}
          module={module}
          body={body.data.body}
          initialCompleted={outline.data.progress?.completed || []}
        />
      )}
    </LoadState>
  );
}

function ModuleView({ course, module, body, initialCompleted }) {
  const [completed, setCompletedSet] = useState(() => new Set(initialCompleted));
  const [saving, setSaving] = useState(false);
  const articleRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const html = useMemo(() => renderModuleHtml(body), [body]);
  const active = useActiveLesson(articleRef, module.lessons);

  const prev = course.modules[module.index - 1];
  const next = course.modules[module.index + 1];
  const done = completed.has(module.slug);
  const p = courseProgress(course, [...completed]);

  useEffect(() => { recordVisit(course.id, module.slug); }, [course.id, module.slug]);

  useHashScroll();

  async function setDone(value) {
    setSaving(true);
    try {
      await setModuleCompleted(module.slug, value);
      setCompletedSet((s) => { const n = new Set(s); if (value) n.add(module.slug); else n.delete(module.slug); return n; });
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function completeAndContinue() {
    if (await setDone(true)) window.location.href = next ? moduleUrl(course, next) : courseUrl(course);
  }

  const curriculum = (
    <div className="pf-reader-nav">
      {course.modules.map((m) => {
        const current = m.slug === module.slug;
        const isDone = completed.has(m.slug);
        return (
          <div key={m.slug} className={`pf-rn-mod${current ? ' is-current' : ''}`}>
            <a href={moduleUrl(course, m)} className="pf-rn-head">
              <span className={`pf-rn-dot${isDone ? ' is-done' : ''}`}>{isDone ? '✓' : m.index + 1}</span>
              <span>{m.title}</span>
            </a>
            {current && (
              <div className="pf-rn-lessons">
                {m.lessons.map((l) => (
                  <a
                    key={l.id}
                    href={`#${l.id}`}
                    className={active === l.id ? 'is-active' : ''}
                    onClick={() => setMenuOpen(false)}
                  >
                    {l.title}
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <PlatformLayout title={`${module.title} · ${course.title}`} footer={false}>
      <div className="pf-reader-bar">
        <div className="pf-reader-bar-inner">
          <nav className="pf-crumbs" aria-label="Breadcrumb" style={{ margin: 0, minWidth: 0 }}>
            <a href="/learn">Learn</a><span>/</span>
            <a href={courseUrl(course)} className="pf-ellipsis">{course.title}</a>
          </nav>
          <div className="pf-reader-progress">
            <span className="pf-meta">{p.done}/{p.total} modules</span>
            <ProgressBar pct={p.pct} style={{ width: 120 }} />
          </div>
          <button className="pf-btn pf-btn-ghost pf-btn-sm pf-reader-menu-btn" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? '× Close' : '≡ Curriculum'}
          </button>
        </div>
        {menuOpen && <div className="pf-reader-drawer">{curriculum}</div>}
      </div>

      <div className="pf-reader">
        <aside className="pf-reader-side">
          <div className="pf-reader-side-inner">
            <div className="pf-side-label" style={{ marginTop: 0 }}>Course content</div>
            {curriculum}
          </div>
        </aside>

        <main className="pf-reader-main">
          <div className="pf-reader-meta">
            <span>Module {module.index + 1} of {course.modules.length}</span>
            <span>·</span>
            <span>{module.lessons.length} lessons</span>
            <span>·</span>
            <span>{module.minutes} min read</span>
            {done && <span className="pf-badge pf-badge-live" style={{ marginLeft: 6 }}>✓ Completed</span>}
          </div>
          <h1 className="pf-reader-title">{module.title}</h1>

          <article ref={articleRef} className="pf-prose" dangerouslySetInnerHTML={{ __html: html }} />

          <div className="pf-reader-complete">
            <div>
              <b>{done ? 'Module completed' : 'Finished this module?'}</b>
              <span>{done ? 'Nice work — keep the momentum going.' : 'Mark it complete to track your progress.'}</span>
            </div>
            {done ? (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="pf-btn pf-btn-ghost pf-btn-sm" disabled={saving} onClick={() => setDone(false)}>Mark incomplete</button>
                {next && <a href={moduleUrl(course, next)} className="pf-btn pf-btn-primary pf-btn-sm">Next module →</a>}
              </div>
            ) : (
              <button className="pf-btn pf-btn-primary pf-btn-sm" disabled={saving} onClick={completeAndContinue}>
                {next ? 'Complete & continue →' : 'Complete course ✓'}
              </button>
            )}
          </div>

          <div className="pf-reader-pager">
            {prev ? (
              <a href={moduleUrl(course, prev)} className="pf-pager-card">
                <span>← Previous</span><b>{prev.title}</b>
              </a>
            ) : <span />}
            {next ? (
              <a href={moduleUrl(course, next)} className="pf-pager-card" style={{ textAlign: 'right' }}>
                <span>Next →</span><b>{next.title}</b>
              </a>
            ) : (
              <a href={courseUrl(course)} className="pf-pager-card" style={{ textAlign: 'right' }}>
                <span>Done →</span><b>Back to course overview</b>
              </a>
            )}
          </div>
        </main>
      </div>
    </PlatformLayout>
  );
}
