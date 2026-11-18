import { PlatformLayout, Icon, useHashScroll } from '../platform/Shell.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { useApi, useCatalog } from '../lib/useApi.js';
import { PracticeTabs, Difficulty } from './ui.jsx';
import { ProgressBar, LoadState } from '../learn/components.jsx';

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

export default function PracticeHub() {
  const { user } = useAuth();
  const catalog = useCatalog();
  const summary = useApi(user ? '/practice/summary' : null);
  useHashScroll();

  const tracks = catalog.data?.tracks || [];
  const codingTracks = tracks.filter((t) => t.kind === 'editor');
  const designTracks = tracks.filter((t) => t.kind !== 'editor');
  const totals = Object.fromEntries(DIFFICULTIES.map((d) => [d, codingTracks.reduce((n, t) => n + (t.problems[d] || 0), 0)]));
  const s = summary.data;
  const resume = s?.resume;

  return (
    <PlatformLayout title="Practice">
      <header className="pf-page-head">
        <div className="pf-wrap">
          <div className="pf-kicker">Practice</div>
          <h1>Practice data engineering, hands-on.</h1>
          <p>Solve SQL, Python and PySpark problems in a real editor — run the examples instantly in your browser, then submit to be graded against hidden tests. Data modeling and hackathon challenges are on the way.</p>
          <div className="pf-head-stats">
            <span><b>{catalog.data?.stats.problems ?? '—'}</b> coding problems</span>
            {user ? (
              <>
                <span><b>{s?.solvedTotal ?? 0}</b> solved</span>
                {DIFFICULTIES.map((d) => <span key={d}>{d} <b>{s?.solved[d] ?? 0}/{totals[d]}</b></span>)}
              </>
            ) : (
              <span><a className="pf-link-arrow" href="/signup?next=/practice">Create a free account</a> to track what you solve</span>
            )}
          </div>
        </div>
      </header>
      <PracticeTabs active="overview" />

      <LoadState loading={catalog.loading} error={catalog.error} label="Loading tracks…">
        <div className="pf-wrap" style={{ paddingTop: 40 }}>
          {resume && (
            <a href={`/practice/${resume.track}/${resume.id}`} className="pf-resume">
              <span className="pf-meta">Continue where you left off</span>
              <b>{resume.title}</b>
              <Difficulty level={resume.difficulty} />
              <span className="pf-link-arrow" style={{ marginLeft: 'auto' }}>Resume →</span>
            </a>
          )}

          <section className="pf-block">
            <div style={{ marginBottom: 20 }}>
              <h2 className="pf-h2">Coding tracks</h2>
              <p className="pf-sub">In-browser editors with instant feedback on examples and server-graded submissions.</p>
            </div>
            <div className="pf-grid pf-grid-3">
              {codingTracks.map((t) => {
                const total = t.problems.total || 0;
                const done = s?.solvedByTrack?.[t.id] || 0;
                return (
                  <a key={t.id} href={`/practice/${t.id}`} className="pf-card" style={{ height: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div className="pf-icon"><Icon name={t.icon} /></div>
                      <span className="pf-badge pf-badge-live">● Live</span>
                    </div>
                    <h3>{t.title}</h3>
                    <p>{t.blurb}</p>
                    <div className="pf-card-foot" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
                      {user && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <ProgressBar pct={total ? Math.round((done / total) * 100) : 0} style={{ flex: 1 }} />
                          <span className="pf-meta">{done}/{total} solved</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="pf-meta">{total} problem{total === 1 ? '' : 's'} · {t.topics.length} topics</span>
                        <span className="pf-link-arrow">Practice →</span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </section>

          <section className="pf-block" id="hackathons" style={{ scrollMarginTop: 120 }}>
            <div style={{ marginBottom: 20 }}>
              <h2 className="pf-h2">Design & hackathons</h2>
              <p className="pf-sub">Open-ended challenges reviewed against a rubric — the part of the job test cases can't capture.</p>
            </div>
            <div className="pf-grid pf-grid-3">
              {designTracks.map((t) => (
                <a key={t.id} href={`/practice/${t.id}`} className="pf-card" style={{ height: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div className="pf-icon"><Icon name={t.icon} /></div>
                    <span className="pf-badge pf-badge-soon">Coming soon</span>
                  </div>
                  <h3>{t.title}</h3>
                  <p>{t.details?.pitch || t.blurb}</p>
                  <div className="pf-card-foot">
                    <span className="pf-meta">{t.details?.format} · {t.details?.briefs?.length || 0} sample briefs</span>
                    <span className="pf-link-arrow">Preview →</span>
                  </div>
                </a>
              ))}
            </div>
          </section>
        </div>
      </LoadState>
    </PlatformLayout>
  );
}
