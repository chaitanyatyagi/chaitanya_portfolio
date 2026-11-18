import { useMemo, useState } from 'react';
import { PlatformLayout } from '../platform/Shell.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { useApi, useCatalog } from '../lib/useApi.js';
import { LEVELS, courseUrl, formatDuration } from './courseData.js';
import { CourseCard, LoadState } from './components.jsx';

// Courses we plan to publish — shown so learners can see where the catalog
// is heading. Move an entry into the guide registry to make it live.
const ROADMAP = ['SQL Fundamentals', 'Python for Data Engineering', 'Data Modeling', 'Data Warehousing', 'Kafka & Streaming', 'dbt', 'Cloud Data Engineering'];

export default function LearnCatalog() {
  const { user } = useAuth();
  const catalog = useCatalog();
  const progress = useApi(user ? '/progress' : null);
  const COURSES = useMemo(() => catalog.data?.courses || [], [catalog.data]);
  const ALL_TAGS = useMemo(() => [...new Set(COURSES.flatMap((c) => c.tags))], [COURSES]);
  const completedIn = (id) => progress.data?.completed?.[id]?.length || 0;
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState('All');
  const [tag, setTag] = useState('All');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return COURSES.filter((c) =>
      (level === 'All' || c.level === level) &&
      (tag === 'All' || c.tags.includes(tag)) &&
      (!q || [c.title, c.description, ...c.tags].join(' ').toLowerCase().includes(q))
    );
  }, [COURSES, query, level, tag]);

  const filtersOn = query || level !== 'All' || tag !== 'All';
  const totals = catalog.data?.stats || { modules: 0, lessons: 0, minutes: 0 };

  return (
    <PlatformLayout title="Courses">
      <header className="pf-page-head">
        <div className="pf-wrap">
          <div className="pf-kicker">Learn · Data Engineering</div>
          <h1>Data Engineering Courses</h1>
          <p>Structured, in-depth courses — concepts, diagrams, real code and the trade-offs that matter. Follow the recommended order or jump to what you need.</p>
          <div className="pf-head-stats">
            <span><b>{COURSES.length}</b> courses</span>
            <span><b>{totals.modules}</b> modules</span>
            <span><b>{totals.lessons}</b> lessons</span>
            <span><b>{formatDuration(totals.minutes)}</b> of reading</span>
          </div>
        </div>
      </header>

      <LoadState loading={catalog.loading} error={catalog.error} label="Loading courses…">
      <div className="pf-wrap">
        {/* Recommended path */}
        <section className="pf-path">
          <div className="pf-path-label">Recommended order</div>
          <div className="pf-path-steps">
            {COURSES.map((c, i) => (
              <a key={c.id} href={courseUrl(c)} className="pf-path-step">
                <span className="pf-path-no">{i + 1}</span>
                <span>{c.title}</span>
              </a>
            ))}
          </div>
        </section>

        {/* Filters */}
        <div className="pf-filters">
          <input
            className="pf-input"
            type="search"
            placeholder="Search courses, modules, topics…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search courses"
          />
          <div className="pf-filter-group" role="group" aria-label="Level">
            {['All', ...LEVELS].map((l) => (
              <button key={l} className={`pf-pill${level === l ? ' is-active' : ''}`} onClick={() => setLevel(l)}>
                {l === 'All' ? 'All levels' : l}
              </button>
            ))}
          </div>
          <select className="pf-select" value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Technology">
            <option value="All">All technologies</option>
            {ALL_TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="pf-results-row">
          <span>{filtered.length} of {COURSES.length} courses</span>
          {filtersOn && (
            <button className="pf-text-btn" onClick={() => { setQuery(''); setLevel('All'); setTag('All'); }}>
              Clear all filters
            </button>
          )}
        </div>

        {filtered.length ? (
          <div className="pf-grid pf-grid-3">
            {filtered.map((c) => (
              <CourseCard key={c.id} course={c} completed={completedIn(c.id)} step={COURSES.indexOf(c) + 1} />
            ))}
          </div>
        ) : (
          <div className="pf-empty">No courses match those filters.</div>
        )}

        {/* Roadmap */}
        <section className="pf-roadmap">
          <div>
            <h3>On the roadmap</h3>
            <p>New courses are added continuously. Coming up next:</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ROADMAP.map((name) => <span key={name} className="pf-chip">{name}</span>)}
          </div>
        </section>
      </div>
      </LoadState>
    </PlatformLayout>
  );
}
