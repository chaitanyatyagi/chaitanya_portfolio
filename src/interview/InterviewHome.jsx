import { useMemo, useState } from 'react';
import { PlatformLayout, Icon } from '../platform/Shell.jsx';
import { useApi } from '../lib/useApi.js';
import { LoadState } from '../learn/components.jsx';
import { Difficulty, StatusIcon } from '../practice/ui.jsx';

// /interview — interview prep (docs §8.14): multi-part case studies and
// interview-tagged questions, filterable by data role. Lists are public;
// solving needs sign-in (the workspace handles that).
const TRACK_LABEL = { sql: 'SQL', python: 'Python', pyspark: 'PySpark', pandas: 'pandas', shell: 'Shell' };
const DIFFS = ['All', 'Easy', 'Medium', 'Hard'];

export default function InterviewHome() {
  const { data, loading, error } = useApi('/interview');
  const [role, setRole] = useState('All');
  const [diff, setDiff] = useState('All');
  const [pattern, setPattern] = useState('All');
  const [q, setQ] = useState('');

  const byRole = (x) => role === 'All' || x.roles?.includes(role);
  const cases = (data?.caseStudies || []).filter(byRole);
  const problems = (data?.problems || []).filter(byRole);
  const allPatterns = useMemo(() => [...new Set((data?.problems || []).flatMap((p) => p.patterns))].sort(), [data]);
  const shown = problems.filter((p) => (diff === 'All' || p.difficulty === diff)
    && (pattern === 'All' || p.patterns.includes(pattern))
    && (!q || `${p.title} ${p.summary} ${p.patterns.join(' ')} ${p.companies.join(' ')}`.toLowerCase().includes(q.toLowerCase())));
  const solved = (data?.problems || []).filter((p) => p.status === 'solved').length;

  return (
    <PlatformLayout title="Interview prep">
      <header className="pf-page-head">
        <div className="pf-wrap">
          <div className="pf-kicker">Interview prep</div>
          <h1>Practice the way interviews are run</h1>
          <p>
            Case studies give you one realistic dataset and a sequence of questions that build on each other and get harder — the format of
            online assessments and onsite SQL rounds. Interview questions are tagged by the data role they suit and, where public reports
            exist, by the companies known to ask them.
          </p>
          {data && <p className="pf-meta" style={{ marginTop: 12 }}>{data.caseStudies.length} case studies · {(data.problems || []).length} interview questions · {solved} solved</p>}
        </div>
      </header>
      <LoadState loading={loading} error={error} label="Loading interview prep…">
        {data && (
          <div className="pf-wrap pf-interview">
            <div className="pf-role-row" role="group" aria-label="Role">
              {['All', ...data.roles].map((r) => (
                <button key={r} className={`pf-choice${role === r ? ' is-on' : ''}`} aria-pressed={role === r} onClick={() => setRole(r)}>{r === 'All' ? 'All roles' : r}</button>
              ))}
            </div>

            <h2 className="pf-section-title"><Icon name="target" size={18} /> Case studies</h2>
            <div className="pf-case-grid">
              {cases.map((c) => {
                const done = c.parts.filter((p) => p.status === 'solved').length;
                return (
                  <a key={c.id} href={`/interview/case/${c.id}`} className="pf-case-card">
                    <div className="pf-case-top"><span className="pf-badge pf-badge-live">{TRACK_LABEL[c.track]}</span><span className="pf-meta">{c.parts.length} parts · {done}/{c.parts.length} solved</span></div>
                    <h3>{c.title}</h3>
                    <p>{c.summary}</p>
                    <div className="pf-ladder" aria-label="Difficulty of each part">
                      {c.parts.map((p) => <span key={p.id} className={`pf-ladder-step is-${p.difficulty.toLowerCase()}${p.status === 'solved' ? ' is-done' : ''}`} title={`Part ${p.part} · ${p.difficulty} · ${p.title}`}>{p.part}</span>)}
                    </div>
                    <div className="pf-case-foot">{c.roles.slice(0, 3).join(' · ')}{c.companies.length > 0 && <span> · asked at {c.companies.join(', ')}</span>}</div>
                  </a>
                );
              })}
              {!cases.length && <div className="pf-empty">No case studies for this role yet.</div>}
            </div>

            <h2 className="pf-section-title"><Icon name="code" size={18} /> Interview questions</h2>
            <div className="pf-filters">
              <input className="pf-input" type="search" placeholder="Search questions, patterns, companies…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
              <div className="pf-filter-group" role="group" aria-label="Difficulty">
                {DIFFS.map((d) => <button key={d} className={`pf-pill${diff === d ? ' is-active' : ''}`} onClick={() => setDiff(d)}>{d}</button>)}
              </div>
              <select className="pf-select" value={pattern} onChange={(e) => setPattern(e.target.value)} aria-label="Pattern">
                <option value="All">Any pattern</option>
                {allPatterns.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <p className="pf-meta" style={{ margin: '14px 0 10px' }}>{shown.length} of {problems.length} questions</p>
            <div className="pf-ptable">
              {shown.map((p) => (
                <a key={p.id} href={`/practice/${p.track}/${p.id}`} className="pf-prow pf-irow">
                  <StatusIcon status={p.status} />
                  <span className="pf-prow-title">
                    <b>{p.title}</b>
                    <span>{p.summary}</span>
                    {p.companies.length > 0 && <span className="pf-row-companies">Asked at {p.companies.join(' · ')}</span>}
                  </span>
                  <span className="pf-prow-topics pf-hide-sm">
                    <span className="pf-chip">{TRACK_LABEL[p.track]}</span>
                    {p.patterns[0] && <span className="pf-chip pf-chip-pattern">{p.patterns[0]}</span>}
                  </span>
                  <span className="pf-meta pf-hide-sm">{p.roles.map((r) => r.replace('Data ', '').replace('Analytics Engineer', 'AE')).join(' · ')}</span>
                  <span className="pf-prow-diff"><Difficulty level={p.difficulty} /><span className="pf-meta">{p.points} pts</span></span>
                </a>
              ))}
              {!shown.length && <div className="pf-empty">No questions match these filters.</div>}
            </div>
          </div>
        )}
      </LoadState>
    </PlatformLayout>
  );
}
