import { useState } from 'react';
import { PlatformLayout, Icon } from '../platform/Shell.jsx';
import { useAuth, loginUrl } from '../auth/AuthContext.jsx';
import { useApi, useCatalog } from '../lib/useApi.js';
import { moduleUrl, formatDuration } from './courseData.js';
import { courseProgress, resumeModule } from './progress.js';
import { CourseCard, ProgressBar, LoadState } from './components.jsx';

// Public course page: outline for everyone; progress + "Continue" when signed
// in; lesson links send visitors to sign in first.
export default function CourseDetail({ courseId }) {
  const { user } = useAuth();
  const { data, loading, error } = useApi(`/courses/${courseId}`);
  const catalog = useCatalog();
  const [open, setOpen] = useState(null);

  if (error?.status === 404) {
    return (
      <PlatformLayout title="Course not found">
        <div className="pf-wrap pf-load-error">That course doesn't exist. <a className="pf-link-arrow" href="/learn">Browse courses →</a></div>
      </PlatformLayout>
    );
  }

  return (
    <PlatformLayout title={data?.course.title || 'Course'}>
      <LoadState loading={loading} error={error} label="Loading course…">
        {data && <CourseBody course={data.course} progress={data.progress} user={user} catalog={catalog.data} open={open} setOpen={setOpen} />}
      </LoadState>
    </PlatformLayout>
  );
}

function CourseBody({ course, progress, user, catalog, open: openState, setOpen }) {
  const open = openState || new Set([course.modules[0]?.slug]);
  const completed = new Set(progress?.completed || []);
  const p = courseProgress(course, progress?.completed);
  const resume = resumeModule(course, progress);
  const started = p.done > 0 || Boolean(progress?.lastVisited);
  const allOpen = open.size === course.modules.length;
  const practice = (catalog?.tracks || []).filter((t) => course.practice.includes(t.id));
  const others = (catalog?.courses || []).filter((c) => c.id !== course.id);
  const go = (url) => (user ? url : loginUrl(url));

  const toggle = (slug) => {
    const next = new Set(open);
    if (next.has(slug)) next.delete(slug); else next.add(slug);
    setOpen(next);
  };

  return (
    <>
      <header className="pf-page-head">
        <div className="pf-wrap">
          <nav className="pf-crumbs" aria-label="Breadcrumb">
            <a href="/learn">Learn</a><span>/</span><span>{course.title}</span>
          </nav>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <span className={`pf-badge pf-level-${course.level.toLowerCase()}`}>{course.level}</span>
            {course.tags.map((t) => <span key={t} className="pf-chip">{t}</span>)}
          </div>
          <h1>{course.title}</h1>
          <p>{course.description}</p>
          <div className="pf-head-stats">
            <span><b>{course.modules.length}</b> modules</span>
            <span><b>{course.lessons}</b> lessons</span>
            <span><b>{formatDuration(course.minutes)}</b> reading</span>
            <span>Reading + code examples</span>
          </div>
        </div>
      </header>

      <div className="pf-wrap pf-course-layout">
        <div style={{ minWidth: 0 }}>
          <section className="pf-block">
            <h2>What you'll learn</h2>
            <div className="pf-outcomes">
              {course.outcomes.map((o) => (
                <div key={o} className="pf-outcome"><span className="pf-check">✓</span><span>{o}</span></div>
              ))}
            </div>
          </section>

          <section className="pf-block">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <h2>Curriculum</h2>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <span className="pf-meta">{course.modules.length} modules · {course.lessons} lessons · {formatDuration(course.minutes)}</span>
                <button className="pf-text-btn" onClick={() => setOpen(allOpen ? new Set() : new Set(course.modules.map((m) => m.slug)))}>
                  {allOpen ? 'Collapse all' : 'Expand all'}
                </button>
              </div>
            </div>
            <div className="pf-curriculum">
              {course.modules.map((m) => {
                const isOpen = open.has(m.slug);
                const done = completed.has(m.slug);
                return (
                  <div key={m.slug} className={`pf-mod${isOpen ? ' is-open' : ''}`}>
                    <button className="pf-mod-head" onClick={() => toggle(m.slug)} aria-expanded={isOpen}>
                      <span className={`pf-mod-no${done ? ' is-done' : ''}`}>{done ? '✓' : String(m.index + 1).padStart(2, '0')}</span>
                      <span className="pf-mod-title">
                        <b>{m.title}</b>
                        <span>{m.lessons.length} lessons · {m.minutes} min</span>
                      </span>
                      <span className="pf-mod-chev">{isOpen ? '−' : '+'}</span>
                    </button>
                    {isOpen && (
                      <div className="pf-mod-body">
                        {m.summary && <p className="pf-mod-summary">{m.summary}</p>}
                        <ol className="pf-lessons">
                          {m.lessons.map((l) => (
                            <li key={l.id}>
                              <a href={go(moduleUrl(course, m, l.id))}>
                                <Icon name="book" size={15} /> <span>{l.title}</span>
                              </a>
                            </li>
                          ))}
                        </ol>
                        <a href={go(moduleUrl(course, m))} className="pf-link-arrow">{user ? 'Open module →' : 'Sign in to start →'}</a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="pf-block">
            <h2>Prerequisites</h2>
            <ul className="pf-plain-list">
              {course.prerequisites.map((x) => <li key={x}>{x}</li>)}
            </ul>
          </section>
        </div>

        <aside>
          <div className="pf-side-card">
            {user && started && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="pf-meta">Your progress</span>
                  <span className="pf-meta" style={{ color: 'var(--accent)' }}>{p.done} / {p.total} modules</span>
                </div>
                <ProgressBar pct={p.pct} />
              </div>
            )}
            <a href={go(moduleUrl(course, resume))} className="pf-btn pf-btn-primary" style={{ justifyContent: 'center' }}>
              {!user ? 'Sign in to start learning →'
                : p.done === p.total ? 'Review course →'
                  : started ? `Continue: Module ${resume.index + 1} →` : 'Start learning →'}
            </a>
            {!user && <p className="pf-side-note">Free account · progress saved across devices</p>}
            <div className="pf-side-list">
              <div><span>Modules</span><b>{course.modules.length}</b></div>
              <div><span>Lessons</span><b>{course.lessons}</b></div>
              <div><span>Reading time</span><b>{formatDuration(course.minutes)}</b></div>
              <div><span>Level</span><b>{course.level}</b></div>
            </div>
            {practice.length > 0 && (
              <>
                <div className="pf-side-label">Practice what you learn</div>
                {practice.map((t) => (
                  <a key={t.id} href={`/practice/${t.id}`} className="pf-side-track">
                    <span className="pf-icon" style={{ width: 34, height: 34 }}><Icon name={t.icon} size={17} /></span>
                    <span><b>{t.title}</b><span>{t.status === 'live' ? 'Practice problems' : 'Coming soon'}</span></span>
                  </a>
                ))}
              </>
            )}
          </div>
        </aside>
      </div>

      {others.length > 0 && (
        <section className="pf-wrap" style={{ marginTop: 72 }}>
          <h2 style={{ fontSize: 26, fontWeight: 600, marginBottom: 20 }}>More courses</h2>
          <div className="pf-grid pf-grid-3">
            {others.slice(0, 3).map((c) => (
              <CourseCard key={c.id} course={c} step={catalog.courses.indexOf(c) + 1} />
            ))}
          </div>
          <div style={{ marginTop: 20 }}><a href="/learn" className="pf-link-arrow">All courses →</a></div>
        </section>
      )}
    </>
  );
}
