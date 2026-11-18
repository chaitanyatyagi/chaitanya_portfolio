import { useMemo, useState } from 'react';
import { PlatformLayout, Icon } from '../platform/Shell.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { useApi, useCatalog } from '../lib/useApi.js';
import { LoadState } from '../learn/components.jsx';
import { PracticeTabs, Difficulty, StatusIcon } from './ui.jsx';
import Dropdown from '../platform/Dropdown.jsx';

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const problemUrl = (track, p) => `/practice/${track.id}/${p.id}`;

function TrackHeader({ track, children }) {
  return (
    <header className="pf-page-head">
      <div className="pf-wrap">
        <nav className="pf-crumbs" aria-label="Breadcrumb">
          <a href="/practice">Practice</a><span>/</span><span>{track.title}</span>
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <div className="pf-icon"><Icon name={track.icon} /></div>
          <span className={`pf-badge ${track.status === 'live' ? 'pf-badge-live' : 'pf-badge-soon'}`}>
            {track.status === 'live' ? '● Live' : 'Coming soon'}
          </span>
        </div>
        <h1>{track.kind === 'editor' ? `${track.title} Practice` : track.title}</h1>
        <p>{track.blurb}</p>
        {children}
      </div>
    </header>
  );
}

// --- Coding tracks: topic sidebar + filterable problem list ---------------------

function CodingTrack({ track, courses }) {
  const { user } = useAuth();
  const list = useApi(`/problems?track=${track.id}`);
  const problems = useMemo(() => list.data?.problems || [], [list.data]);
  const [topic, setTopic] = useState('All');
  const [difficulty, setDifficulty] = useState('All');
  const [status, setStatus] = useState('All');
  const [query, setQuery] = useState('');
  const [pattern, setPattern] = useState('All');
  const [company, setCompany] = useState('All');
  const [role, setRole] = useState('All');
  const [interviewOnly, setInterviewOnly] = useState(false);
  const course = courses.find((c) => c.id === track.course);
  const allPatterns = useMemo(() => [...new Set(problems.flatMap((p) => p.patterns || []))].sort(), [problems]);
  const allRoles = useMemo(() => [...new Set(problems.flatMap((p) => p.roles || []))].sort(), [problems]);
  const allCompanies = useMemo(() => [...new Set(problems.flatMap((p) => p.companies || []))].sort(), [problems]);

  const counts = useMemo(() => Object.fromEntries(
    track.topics.map((t) => [t, problems.filter((p) => p.topics.includes(t)).length])
  ), [track, problems]);

  const filtered = problems.filter((p) => {
    const s = p.status;
    const q = query.trim().toLowerCase();
    return (topic === 'All' || p.topics.includes(topic))
      && (difficulty === 'All' || p.difficulty === difficulty)
      && (pattern === 'All' || (p.patterns || []).includes(pattern))
      && (company === 'All' || (p.companies || []).includes(company))
      && (role === 'All' || (p.roles || []).includes(role))
      && (!interviewOnly || p.interview || p.caseStudy)
      && (status === 'All' || (status === 'Solved' ? s === 'solved' : status === 'Attempted' ? s === 'attempted' : s === 'todo'))
      && (!q || `${p.title} ${p.summary} ${p.topics.join(' ')} ${(p.patterns || []).join(' ')} ${(p.domains || []).join(' ')} ${(p.companies || []).join(' ')}`.toLowerCase().includes(q));
  });
  const solved = problems.filter((p) => p.status === 'solved').length;
  const filtersOn = topic !== 'All' || difficulty !== 'All' || status !== 'All' || pattern !== 'All'
    || company !== 'All' || role !== 'All' || interviewOnly || query.trim() !== '';
  const clearFilters = () => {
    setTopic('All'); setDifficulty('All'); setStatus('All'); setPattern('All');
    setCompany('All'); setRole('All'); setInterviewOnly(false); setQuery('');
  };

  return (
    <>
      <TrackHeader track={track}>
        <div className="pf-head-stats">
          <span><b>{problems.length}</b> problems</span>
          <span><b>{solved}</b> solved</span>
          {DIFFICULTIES.map((d) => <span key={d}>{d} <b>{problems.filter((p) => p.difficulty === d).length}</b></span>)}
          <span><b>{track.topics.length}</b> topics</span>
        </div>
      </TrackHeader>
      <PracticeTabs active={track.id} />

      <div className="pf-wrap pf-track-layout">
        <aside className="pf-topic-side">
          <div className="pf-side-label" style={{ marginTop: 0 }}>Topics</div>
          <div className="pf-topic-list">
            <button className={`pf-topic${topic === 'All' ? ' is-active' : ''}`} onClick={() => setTopic('All')}>
              <span>All topics</span><span className="pf-topic-count">{problems.length}</span>
            </button>
            {track.topics.map((t) => (
              <button
                key={t}
                className={`pf-topic${topic === t ? ' is-active' : ''}${counts[t] ? '' : ' is-empty'}`}
                onClick={() => setTopic(t)}
              >
                <span>{t}</span><span className="pf-topic-count">{counts[t]}</span>
              </button>
            ))}
          </div>
          {course && (
            <a href={`/learn/${course.id}`} className="pf-side-course">
              <span className="pf-meta">Learn first</span>
              <b>{course.title}</b>
              <span className="pf-link-arrow">Open course →</span>
            </a>
          )}
        </aside>

        <div style={{ minWidth: 0 }}>
          <div className="pf-toolbar">
            <label className="pf-search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
              <input type="search" placeholder={`Search ${problems.length || ''} problems by title, skill, pattern or company`} value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search problems" />
            </label>
            <div className="pf-toolbar-row">
              <div className="pf-seg-tabs" role="group" aria-label="Difficulty">
                {['All', ...DIFFICULTIES].map((d) => (
                  <button key={d} className={difficulty === d ? 'is-active' : ''} aria-pressed={difficulty === d} onClick={() => setDifficulty(d)}>
                    {d !== 'All' && <i className={`pf-dot-${d.toLowerCase()}`} aria-hidden="true" />}{d}
                  </button>
                ))}
              </div>
              <span className="pf-toolbar-sep" aria-hidden="true" />
              <div className="pf-topic-mobile">
                <Dropdown label="Topic" value={topic} onChange={setTopic} allLabel="All"
                  options={[{ value: 'All', label: 'All topics', count: problems.length }, ...track.topics.map((t) => ({ value: t, label: t, count: counts[t] }))]} />
              </div>
              {allRoles.length > 0 && (
                <Dropdown label="Role" value={role} onChange={setRole}
                  options={[{ value: 'All', label: 'Any role' }, ...allRoles.map((r) => ({ value: r, label: r }))]} />
              )}
              {allCompanies.length > 0 && (
                <Dropdown label="Company" value={company} onChange={setCompany}
                  options={[{ value: 'All', label: 'Any company' }, ...allCompanies.map((c) => ({ value: c, label: c }))]} />
              )}
              {allPatterns.length > 0 && (
                <Dropdown label="Pattern" value={pattern} onChange={setPattern}
                  options={[{ value: 'All', label: 'Any pattern' }, ...allPatterns.map((p) => ({ value: p, label: p }))]} />
              )}
              <Dropdown label="Status" value={status} onChange={setStatus} align="right"
                options={['All', 'Todo', 'Attempted', 'Solved'].map((x) => ({ value: x, label: x === 'All' ? 'Any status' : x }))} />
              <button className={`pf-switch${interviewOnly ? ' is-on' : ''}`} role="switch" aria-checked={interviewOnly} onClick={() => setInterviewOnly((v) => !v)}>
                <i aria-hidden="true" />Interview only
              </button>
            </div>
          </div>

          <div className="pf-results-row">
            <span>{filtered.length} of {problems.length} problems{topic !== 'All' ? ` · ${topic}` : ''}</span>
            {filtersOn && <button className="pf-text-btn" onClick={clearFilters}>Clear filters</button>}
          </div>

          {list.loading ? (
            <div className="pf-loading"><span className="pf-spinner" /> Loading problems…</div>
          ) : filtered.length ? (
            <div className="pf-ptable" role="table">
              <div className="pf-prow pf-prow-head" role="row">
                <span>Status</span><span>Title</span><span className="pf-hide-sm">Skills · pattern</span><span className="pf-hide-sm">Acceptance</span><span>Difficulty</span>
              </div>
              {filtered.map((p) => (
                <a key={p.id} href={user ? problemUrl(track, p) : `/login?next=${encodeURIComponent(problemUrl(track, p))}`} className="pf-prow" role="row">
                  <StatusIcon status={p.status} />
                  <span className="pf-prow-title">
                    <b>{p.title}{p.caseStudy && <i className="pf-case-chip">case study · part {p.caseStudy.part}</i>}{!p.caseStudy && p.interview && <i className="pf-case-chip is-interview">interview</i>}</b>
                    <span>{p.summary}</span>
                    {p.companies?.length > 0 && <span className="pf-row-companies">Asked at {p.companies.join(', ')}</span>}
                  </span>
                  <span className="pf-prow-topics pf-hide-sm">
                    <span className="pf-prow-skills">{p.topics.slice(0, 2).join(' · ')}</span>
                    {p.patterns?.[0] && <span className="pf-prow-pattern">{p.patterns[0]}</span>}
                  </span>
                  <span className="pf-meta pf-hide-sm">{p.stats?.acceptance != null ? `${p.stats.acceptance}%` : '—'}</span>
                  <span className="pf-prow-diff"><Difficulty level={p.difficulty} /><span className="pf-meta">{p.points} pts</span></span>
                </a>
              ))}
            </div>
          ) : (
            <div className="pf-empty">
              {topic !== 'All' && counts[topic] === 0
                ? <>No <b>{topic}</b> problems yet — new problems are added every week.</>
                : 'No problems match those filters.'}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// --- Design & hackathon tracks: format, rubric and sample briefs -----------

function ChallengeTrack({ track }) {
  const c = track.details;
  return (
    <>
      <TrackHeader track={track}>
        <div className="pf-head-stats">
          <span><b>{c.format}</b></span>
          <span><b>{track.topics.length}</b> topics</span>
          <span><b>{c.briefs.length}</b> sample briefs</span>
        </div>
      </TrackHeader>
      <PracticeTabs active={track.id} />

      <div className="pf-wrap" style={{ paddingTop: 40 }}>
        <div className="pf-soon-banner">
          <b>Launching soon.</b> Here's how {track.title.toLowerCase()} challenges will work — and the kind of briefs you'll get.
        </div>

        <section className="pf-block">
          <h2 className="pf-h2">How it works</h2>
          <p className="pf-sub" style={{ marginBottom: 20 }}>{c.pitch}</p>
          <div className="pf-grid pf-grid-4">
            {c.steps.map(([title, text], i) => (
              <div key={title} className="pf-card">
                <span className="pf-step-no">0{i + 1}</span>
                <div className="pf-step-line" />
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="pf-block">
          <h2 className="pf-h2">Sample briefs</h2>
          <div className="pf-grid pf-grid-3" style={{ marginTop: 20 }}>
            {c.briefs.map((b) => (
              <div key={b.title} className="pf-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Difficulty level={b.difficulty} />
                  <span className="pf-meta">🔒 Preview</span>
                </div>
                <h3>{b.title}</h3>
                <p>{b.text}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 16 }}>
                  {b.tags.map((t) => <span key={t} className="pf-chip">{t}</span>)}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="pf-grid pf-grid-2 pf-block">
          <section className="pf-card">
            <h3 style={{ marginTop: 0 }}>What you submit</h3>
            <ul className="pf-plain-list">{c.deliverables.map((d) => <li key={d}>{d}</li>)}</ul>
          </section>
          <section className="pf-card">
            <h3 style={{ marginTop: 0 }}>How it's judged</h3>
            <div className="pf-rubric">
              {c.rubric.map(([label, weight]) => (
                <div key={label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
                    <span>{label}</span><span className="pf-meta">{weight}%</span>
                  </div>
                  <div className="pf-progress"><span style={{ width: `${weight * 2.5}%` }} /></div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="pf-block">
          <h2 className="pf-h2">Topics covered</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            {track.topics.map((t) => <span key={t} className="pf-chip">{t}</span>)}
          </div>
        </section>
      </div>
    </>
  );
}

export default function TrackPage({ trackId }) {
  const catalog = useCatalog();
  const track = catalog.data?.tracks.find((t) => t.id === trackId);
  if (catalog.data && !track) {
    return (
      <PlatformLayout title="Track not found">
        <div className="pf-wrap pf-load-error">That practice track doesn't exist. <a className="pf-link-arrow" href="/practice">All tracks →</a></div>
      </PlatformLayout>
    );
  }
  return (
    <PlatformLayout title={track?.title || 'Practice'}>
      <LoadState loading={catalog.loading} error={catalog.error} label="Loading track…">
        {track && (track.kind === 'editor'
          ? <CodingTrack track={track} courses={catalog.data.courses} />
          : <ChallengeTrack track={track} />)}
      </LoadState>
    </PlatformLayout>
  );
}
