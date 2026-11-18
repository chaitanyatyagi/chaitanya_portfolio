import { Component, useCallback, useEffect, useRef, useState } from 'react';
import { PlatformLayout, Icon } from '../platform/Shell.jsx';
import { RequireAuth } from '../auth/AuthContext.jsx';
import { api } from '../lib/api.js';
import { useApi, useCatalog } from '../lib/useApi.js';
import { renderModuleHtml, LoadState } from '../learn/components.jsx';
import { buildPayload, verdictOf } from '../../shared/grader/payload.js';
import { pointsFor, ordinal } from '../../shared/grader/points.js';
import CodeEditor from './CodeEditor.jsx';
import { prepare, runTests, subscribe, runtimeLabel } from './runner/client.js';
import { loadDraft, saveDraft, clearDraft } from './store.js';
import { Difficulty, DataTable, ValueBlock } from './ui.jsx';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = IS_MAC ? '⌘' : 'Ctrl';
const md = (text) => ({ __html: renderModuleHtml(text) });
const codeHtml = (code, lang) => ({ __html: renderModuleHtml(`\`\`\`${lang}\n${code}\n\`\`\``) });

function timeAgo(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(ts).toLocaleDateString();
}

const verdictTone = (v) => (v === 'Accepted' || v === 'Examples Passed' ? 'good' : 'bad');

// Rows of `actual` that don't line up with `expected` (for red highlighting).
function mismatchedRows(actual, expected, ordered) {
  const key = (r) => JSON.stringify(r);
  if (ordered) return new Set(actual.map((r, i) => (key(r) !== key(expected[i] ?? null) ? i : -1)).filter((i) => i >= 0));
  const pool = expected.map(key);
  const bad = new Set();
  actual.forEach((r, i) => {
    const at = pool.indexOf(key(r));
    if (at === -1) bad.add(i); else pool.splice(at, 1);
  });
  return bad;
}

// Draggable split between two panes. `axis` 'x' → returns a % of the
// container width; 'y' → pixels from the container's bottom.
function useDrag(axis, onMove) {
  return useCallback((e) => {
    const container = e.currentTarget.parentElement;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    document.body.classList.add(axis === 'x' ? 'pf-dragging-x' : 'pf-dragging-y');
    const move = (ev) => {
      const box = container.getBoundingClientRect();
      onMove(axis === 'x' ? ((ev.clientX - box.left) / box.width) * 100 : box.bottom - ev.clientY, box);
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      document.body.classList.remove('pf-dragging-x', 'pf-dragging-y');
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
  }, [axis, onMove]);
}

// --- Inputs / outputs of one test case -----------------------------------------

const isTableTrack = (track) => track === 'sql' || track === 'pyspark' || track === 'pandas';

function TextBlock({ text, empty = '(empty)' }) {
  return <pre className="pf-value pf-textout">{text === '' || text == null ? <span className="pf-null">{empty}</span> : text}</pre>;
}

function CaseInput({ problem, test }) {
  if (problem.track === 'shell') {
    const files = Object.entries(test.files || {});
    return (
      <>
        {files.map(([name, text]) => (
          <div key={name} className="pf-io-block">
            <div className="pf-io-label">📄 {name}</div>
            <TextBlock text={text} empty="(empty file)" />
          </div>
        ))}
        {test.stdin != null && (<div className="pf-io-block"><div className="pf-io-label">stdin</div><TextBlock text={test.stdin} /></div>)}
      </>
    );
  }
  if (problem.track === 'python') {
    const names = problem.signature.match(/\(([^)]*)\)/)[1].split(',').map((s) => s.split(':')[0].trim()).filter(Boolean);
    return test.args.map((arg, i) => (
      <div key={i} className="pf-io-block">
        <div className="pf-io-label">{names[i] || `arg${i + 1}`} =</div>
        <ValueBlock value={arg} />
      </div>
    ));
  }
  return problem.schema.map((t) => (
    <div key={t.name} className="pf-io-block">
      <DataTable caption={t.name} columns={t.columns.map(([c]) => c)} rows={test.tables[t.name] || []} />
    </div>
  ));
}

function Expected({ problem, test }) {
  if (problem.track === 'shell') return <TextBlock text={test.expected} empty="(no output)" />;
  return problem.track === 'python'
    ? <ValueBlock value={test.expected} />
    : <DataTable columns={problem.outputColumns} rows={test.expected} />;
}

// The brief's header: a spec strip (difficulty, points, acceptance, solvers)
// and the tag dimensions. Company chips link to the public report behind them.
function ProblemTags({ problem, state, solved }) {
  const s = problem.stats;
  const sourceFor = (company) => (problem.sources || []).find((x) => x.company === company);
  return (
    <div className="pf-ws-meta">
      <dl className="pf-spec">
        <div><dt>Level</dt><dd><Difficulty level={problem.difficulty} /></dd></div>
        <div><dt>Points</dt><dd>{problem.points}{solved && <i> · +{state.points} earned</i>}</dd></div>
        <div><dt>Acceptance</dt><dd>{s?.acceptance != null ? `${s.acceptance}%` : '—'}</dd></div>
        <div><dt>Solved by</dt><dd>{s?.solvers ?? 0}</dd></div>
      </dl>
      {solved && <div className="pf-solved-flag">✓ You solved this</div>}
      {problem.companies?.length > 0 && (
        <div className="pf-tagrow">
          <span className="pf-tagrow-label">Asked at</span>
          {problem.companies.map((c) => {
            const src = sourceFor(c);
            return src
              ? <a key={c} className="pf-chip pf-chip-company" href={src.url} target="_blank" rel="noreferrer" title={`Reported: ${src.label}`}>{c} ↗</a>
              : <span key={c} className="pf-chip pf-chip-company">{c}</span>;
          })}
        </div>
      )}
      <TagRow label="Skills" items={problem.topics} />
      <TagRow label="Patterns" items={problem.patterns} kind="pattern" />
      <TagRow label="Domain" items={problem.domains} kind="domain" />
      <TagRow label="Roles" items={problem.roles} />
    </div>
  );
}

function TagRow({ label, items, kind = '' }) {
  if (!items?.length) return null;
  return (
    <div className="pf-tagrow">
      <span className="pf-tagrow-label">{label}</span>
      {items.map((t) => <span key={t} className={`pf-chip${kind ? ` pf-chip-${kind}` : ''}`}>{t}</span>)}
    </div>
  );
}

// What the next Accepted would earn (shared/grader/points.js — same rule as the grader).
function PointsCallout({ problem, state }) {
  if (state.status === 'solved') {
    return <div className="pf-points-note is-done">You earned <b>{state.points}</b> of {problem.points} points for this problem.</div>;
  }
  const next = state.attempts + 1;
  const worth = pointsFor(problem.points, next, { revealedBeforeSolve: state.revealed });
  return (
    <div className="pf-points-note">
      {state.revealed
        ? <>You viewed the solution, so solving this now earns <b>0 points</b>.</>
        : <>Your {ordinal(next)} attempt is worth <b>{worth}</b> point{worth === 1 ? '' : 's'} if Accepted <span className="pf-meta">· 1st 100% · 2nd 50% · 3rd 25% · then 0</span></>}
    </div>
  );
}

// Case-study context: which part this is, links to the neighbours, and the
// shared brief (story + dataset) one click away.
function CaseStudyBanner({ problem, inContest }) {
  const { data } = useApi(`/case-studies/${problem.caseStudy.id}`);
  const cs = data?.caseStudy;
  if (!cs) return null;
  const i = cs.parts.findIndex((p) => p.id === problem.id);
  const prev = cs.parts[i - 1];
  const next = cs.parts[i + 1];
  const href = (p) => `/practice/${cs.track}/${p.id}`;
  return (
    <div className="pf-case-banner">
      <div className="pf-case-banner-top">
        <span className="pf-badge pf-badge-live">Case study</span>
        {inContest ? <b>{cs.title}</b> : <a href={`/interview/case/${cs.id}`}><b>{cs.title}</b></a>}
        <span className="pf-meta">Part {problem.caseStudy.part} of {cs.parts.length}</span>
        {!inContest && (
          <span className="pf-case-nav">
            {prev && <a href={href(prev)}>← Part {prev.part}</a>}
            {next && <a href={href(next)}>Part {next.part} →</a>}
          </span>
        )}
      </div>
      <details>
        <summary>The brief and dataset</summary>
        <div className="pf-prose pf-prose-sm" dangerouslySetInnerHTML={md(cs.brief)} />
      </details>
    </div>
  );
}

// --- Left panel ---------------------------------------------------------------

function DescriptionTab({ problem, solved, state, contest, onOpenHints }) {
  const examples = problem.examples;
  return (
    <div className="pf-ws-doc">
      <div className="pf-brief-kicker">{runtimeLabel(problem.track)}{problem.interview && <span className="pf-interview-tag">Interview</span>}</div>
      {problem.caseStudy && <CaseStudyBanner problem={problem} inContest={Boolean(contest)} />}
      <h1 className="pf-ws-title">{problem.title}</h1>
      <ProblemTags problem={problem} state={state} solved={!contest && solved} />
      {contest ? (
        <div className="pf-points-note">
          Worth <b>{contest.points}</b> contest points. Each wrong submission adds <b>{contest.penaltyMinutes} minutes</b> to your finish time once you solve it.
        </div>
      ) : state.liveContest ? (
        <div className="pf-points-note">This problem is part of a contest you're playing — <a className="pf-link-arrow" href={`/contests/${state.liveContest}`}>submit it there →</a></div>
      ) : (
        <PointsCallout problem={problem} state={state} />
      )}

      <div className="pf-prose pf-prose-sm" dangerouslySetInnerHTML={md(problem.description)} />

      {problem.signature && (
        <>
          <h3 className="pf-ws-h3">Function signature</h3>
          <div className="pf-prose pf-prose-sm" dangerouslySetInnerHTML={codeHtml(problem.signature, 'python')} />
        </>
      )}

      {problem.schema && (
        <>
          <h3 className="pf-ws-h3">{problem.track === 'sql' ? 'Tables' : 'Input DataFrames'}</h3>
          {problem.schema.map((t) => (
            <div key={t.name} className="pf-io-block">
              <DataTable caption={t.name} columns={['column', 'type', 'description']} rows={t.columns} />
            </div>
          ))}
        </>
      )}

      {examples.map((t, i) => (
        <div key={t.name} className="pf-example">
          <h3 className="pf-ws-h3">Example {i + 1} <span className="pf-meta">· {t.name}</span></h3>
          <div className="pf-io-label">Input</div>
          <CaseInput problem={problem} test={t} />
          <div className="pf-io-label">Expected output</div>
          <Expected problem={problem} test={t} />
        </div>
      ))}

      {contest ? (
        <div className="pf-stuck is-static"><Icon name="bulb" size={16} /> Hints are off during a contest — they open again in practice afterwards.</div>
      ) : problem.hints.length > 0 && (
        <button className="pf-stuck" onClick={onOpenHints}>
          <Icon name="bulb" size={16} /> Stuck? {problem.hints.length} hint{problem.hints.length === 1 ? '' : 's'}, revealed one at a time
        </button>
      )}

      <div className="pf-runtime-note">
        <b>Run</b> checks the {examples.length} examples instantly in your browser; <b>Submit</b> is graded on our servers
        against those plus {problem.hiddenCount} hidden test{problem.hiddenCount === 1 ? '' : 's'}. Both use <b>{runtimeLabel(problem.track)}</b>.
        {problem.track === 'pyspark' && ' Most of pyspark.sql (DataFrame, functions, Window) is supported; RDDs and the Spark UI are not.'}
        {problem.track === 'sql' && ' DuckDB speaks a PostgreSQL-style dialect, including QUALIFY.'}
        {problem.track === 'shell' && ' Your script runs in a sandboxed bash with the input files in the current directory: grep, awk, sed, sort, uniq, cut, tr, jq and friends work; there is no network and no real processes.'}
        {problem.track === 'pandas' && ' Return a DataFrame — the index is ignored, columns are compared by name and order.'}
      </div>
    </div>
  );
}

// Hints open one at a time, in order — each is a bigger nudge than the last.
function HintsTab({ problem }) {
  const [shown, setShown] = useState(0);
  return (
    <div className="pf-ws-doc">
      <p className="pf-meta" style={{ marginTop: 0 }}>Each hint is a bigger nudge than the last. Hints don't affect your points.</p>
      <ol className="pf-hint-steps">
        {problem.hints.map((h, i) => (
          <li key={i} className={i < shown ? 'is-open' : ''}>
            <span className="pf-hint-no">{i + 1}</span>
            {i < shown ? <p>{h}</p> : <p className="pf-hint-locked">Hidden</p>}
          </li>
        ))}
      </ol>
      {shown < problem.hints.length && (
        <button className="pf-btn pf-btn-ghost pf-btn-sm" onClick={() => setShown((n) => n + 1)}>
          <Icon name="bulb" size={15} /> Show hint {shown + 1}
        </button>
      )}
    </div>
  );
}

// The solution is only sent by the server once you've solved the problem or
// chosen to reveal it (POST /problems/:id/reveal records that choice).
function SolutionTab({ problem, solution, onReveal, onUse }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  if (!solution) {
    return (
      <div className="pf-ws-doc">
        <div className="pf-locked">
          <b>Solution locked</b>
          <p>Get an Accepted submission to unlock the reference solution and explanation — or reveal it now if you're stuck.</p>
          <p className="pf-reveal-warn">Revealing before you solve sets the points for this problem to <b>0</b>.</p>
          <button
            className="pf-btn pf-btn-ghost pf-btn-sm"
            disabled={busy}
            onClick={async () => { setBusy(true); setError(null); try { await onReveal(); } catch (e) { setError(e.message); } finally { setBusy(false); } }}
          >
            {busy ? 'Revealing…' : 'Reveal solution'}
          </button>
          {error && <div className="pf-form-error" style={{ marginTop: 12 }}>{error}</div>}
        </div>
      </div>
    );
  }
  const lang = problem.track === 'sql' ? 'sql' : problem.track === 'shell' ? 'bash' : 'python';
  return (
    <div className="pf-ws-doc">
      <h2 className="pf-ws-title" style={{ fontSize: 22 }}>Approach</h2>
      <div className="pf-prose pf-prose-sm" dangerouslySetInnerHTML={md(solution.explanation)} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 0 10px' }}>
        <h3 className="pf-ws-h3" style={{ margin: 0 }}>Reference solution</h3>
        <button className="pf-text-btn" onClick={() => onUse(solution.solution)}>Copy to editor</button>
      </div>
      <div className="pf-prose pf-prose-sm" dangerouslySetInnerHTML={codeHtml(solution.solution.trimEnd(), lang)} />
    </div>
  );
}

function SubmissionsTab({ list, onLoad }) {
  if (list.loading) return <div className="pf-ws-doc pf-loading"><span className="pf-spinner" /> Loading…</div>;
  if (list.error) return <div className="pf-ws-doc pf-load-error">{list.error.message}</div>;
  const submissions = list.data?.submissions || [];
  if (!submissions.length) {
    return <div className="pf-ws-doc"><div className="pf-empty">No submissions yet. Press <b>Submit</b> to run all test cases, including hidden ones.</div></div>;
  }
  return (
    <div className="pf-ws-doc">
      <div className="pf-subs">
        {submissions.map((s) => (
          <div key={s.id} className="pf-sub-row">
            <span className={`pf-verdict-text is-${s.verdict ? verdictTone(s.verdict) : 'pending'}`}>{s.verdict || (s.status === 'queued' ? 'Queued' : 'Grading…')}</span>
            <span className="pf-meta">{s.total != null ? `${s.passed}/${s.total} tests` : '—'}{s.attemptNo ? ` · ${ordinal(s.attemptNo)} try` : ''}{s.pointsAwarded > 0 ? ` · +${s.pointsAwarded} pts` : ''}</span>
            <span className="pf-meta">{timeAgo(new Date(s.createdAt).getTime())}</span>
            <button className="pf-text-btn" onClick={() => onLoad(s.code)}>Load code</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Console ------------------------------------------------------------------

function TestcasesPane({ problem }) {
  const examples = problem.examples;
  const [idx, setIdx] = useState(0);
  const test = examples[idx];
  return (
    <>
      <div className="pf-case-pills">
        {examples.map((t, i) => (
          <button key={t.name} className={`pf-case-pill${i === idx ? ' is-active' : ''}`} onClick={() => setIdx(i)}>Case {i + 1}</button>
        ))}
        <span className="pf-meta" style={{ marginLeft: 'auto' }}>
          + {problem.hiddenCount} hidden on Submit
        </span>
      </div>
      <div className="pf-meta" style={{ marginBottom: 8 }}>{test.name}</div>
      <div className="pf-io-label">Input</div>
      <CaseInput problem={problem} test={test} />
      <div className="pf-io-label">Expected output</div>
      <Expected problem={problem} test={test} />
    </>
  );
}

function ResultPane({ problem, run, busy, runtime, pending, contest }) {
  const [picked, setPicked] = useState(null);
  useEffect(() => setPicked(null), [run]);

  if (busy) {
    const submitText = !pending ? 'Submitting…'
      : pending.status === 'queued' ? `Queued for grading${pending.queuePosition ? ` — position ${pending.queuePosition}` : ''}…`
        : 'Grading on the server against all tests…';
    return (
      <div className="pf-console-wait">
        <span className="pf-spinner" />
        {busy === 'submit' ? submitText : runtime.phase === 'loading' ? runtime.text : 'Running examples…'}
      </div>
    );
  }
  if (!run) {
    return <div className="pf-console-wait">Press <b>Run</b> ({MOD} ') to test the examples, or <b>Submit</b> ({MOD} ↵) for every test case.</div>;
  }
  if (run.error) {
    return (
      <div>
        <div className="pf-verdict is-bad">{run.timeout ? 'Time Limit Exceeded' : run.mode === 'submit' ? 'Submission not graded' : 'Run failed'}</div>
        <pre className="pf-trace">{run.error}</pre>
      </div>
    );
  }

  const { results, verdict } = run;
  const passed = results.filter((r) => r.status === 'passed').length;
  const totalMs = results.reduce((n, r) => n + (r.ms || 0), 0);
  const firstBad = results.findIndex((r) => r.status !== 'passed');
  const idx = picked ?? (firstBad === -1 ? 0 : firstBad);
  const r = results[idx];
  // Visible results line up with the examples by name; hidden ones carry no data.
  const test = r.hidden ? null : problem.examples.find((t) => t.name === r.name);
  const isTable = isTableTrack(problem.track);
  let visibleNo = 0;
  const labels = results.map((res) => (res.hidden ? res.name.replace('Hidden test', 'Hidden') : res.name === 'All tests' ? 'All tests' : `Case ${++visibleNo}`));

  return (
    <>
      <div className="pf-verdict-row">
        <span className={`pf-verdict is-${verdictTone(verdict)}`}>{verdict}</span>
        <span className="pf-meta">{passed} / {results.length} test cases passed · {totalMs.toFixed(0)} ms</span>
      </div>
      {verdict === 'Examples Passed' && <div className="pf-tip">All examples pass. Submit to grade against the hidden test cases too.</div>}
      {run.mode === 'submit' && (
        <div className="pf-meta" style={{ marginBottom: 10 }}>
          Graded on the server · {problem.hiddenCount} hidden tests included
          {run.attemptNo ? ` · ${ordinal(run.attemptNo)} attempt` : ''}
          {contest && <span> · counted in the contest standings</span>}
          {verdict === 'Accepted' && contest ? (run.pointsAwarded > 0 ? <span className="pf-points-earned"> · +{run.pointsAwarded} practice points</span> : null)
            : verdict === 'Accepted' && (run.pointsAwarded > 0
            ? <span className="pf-points-earned"> · +{run.pointsAwarded} points</span>
            : <span> · no points (already solved, solution viewed, or 4th+ attempt)</span>)}
        </div>
      )}

      <div className="pf-case-pills">
        {results.map((res, i) => (
          <button key={res.name} className={`pf-case-pill is-${res.status}${i === idx ? ' is-active' : ''}`} onClick={() => setPicked(i)}>
            {res.status === 'passed' ? '✓' : '✗'} {labels[i]}
          </button>
        ))}
      </div>

      <div className="pf-meta" style={{ marginBottom: 8 }}>{r.name}{r.hidden ? ' · hidden test' : ''}</div>
      {r.message && <div className={`pf-result-msg is-${r.status}`}>{r.message}</div>}
      {r.traceback && r.traceback !== r.message && <pre className="pf-trace">{r.traceback}</pre>}

      {r.hidden ? (
        <div className="pf-tip">Hidden test cases don't reveal their input — re-read the edge cases in the problem statement.</div>
      ) : !test ? null : (
        <>
          {r.actual !== undefined && (
            <>
              <div className="pf-io-label">Your output</div>
              {isTable
                ? <DataTable columns={r.actual.columns} rows={r.actual.rows} total={r.actual.total}
                    mark={r.status === 'failed' ? mismatchedRows(r.actual.rows, test.expected, test.ordered) : undefined} />
                : problem.track === 'shell' ? <TextBlock text={r.actual} empty="(no output)" /> : <ValueBlock value={r.actual} />}
            </>
          )}
          <div className="pf-io-label">Expected output</div>
          <Expected problem={problem} test={test} />
          <details className="pf-input-details">
            <summary>Show input</summary>
            <CaseInput problem={problem} test={test} />
          </details>
        </>
      )}

      {r.stdout && (
        <>
          <div className="pf-io-label">Stdout</div>
          <pre className="pf-stdout">{r.stdout}</pre>
        </>
      )}
    </>
  );
}

// Keeps a rendering bug in one panel from blanking the whole workspace.
class PanelBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  render() {
    if (this.state.error) return <pre className="pf-trace">This panel failed to render: {String(this.state.error.message || this.state.error)}</pre>;
    return this.props.children;
  }
}

// --- Workspace ----------------------------------------------------------------

const SUBMIT_POLL_MS = [500, 500, 750, 1000, 1000, 1500, 2000]; // backoff while waiting for the grader
const SUBMIT_TIMEOUT_MS = 120_000;
const DRAFT_SAVE_MS = 1500;

export default function ProblemWorkspace({ trackId, problemId }) {
  return (
    <RequireAuth>
      <ProblemLoader trackId={trackId} problemId={problemId} />
    </RequireAuth>
  );
}

function ProblemLoader({ trackId, problemId }) {
  const { data, error, loading, setData } = useApi(`/problems/${problemId}`);
  const catalog = useCatalog();
  if (error?.status === 404 || (data && data.problem.track !== trackId)) {
    return (
      <PlatformLayout title="Problem not found">
        <div className="pf-wrap pf-load-error">That problem doesn't exist. <a className="pf-link-arrow" href={`/practice/${trackId}`}>Back to the problem list →</a></div>
      </PlatformLayout>
    );
  }
  return (
    <LoadState loading={loading || catalog.loading} error={error || catalog.error} label="Loading problem…">
      {data && catalog.data && (
        <ProblemView
          data={data}
          setData={setData}
          track={catalog.data.tracks.find((t) => t.id === data.problem.track)}
        />
      )}
    </LoadState>
  );
}

// `contest` (optional) turns this into a contest workspace (docs §12.6):
//   {id, code, title, points, penaltyMinutes, ended, bar, onSubmitted}
// — no solution tab, a separate local-only draft (your practice draft is left
// alone), submissions carry the contestId, and `bar` replaces the breadcrumbs.
export function ProblemView({ data, setData, track, contest = null }) {
  const { problem, state, solution } = data;
  const solved = state.status === 'solved';
  const submissionsList = useApi(contest
    ? `/contests/${contest.code}/submissions?problem=${encodeURIComponent(problem.id)}`
    : `/problems/${problem.id}/submissions`);
  const draftKey = contest ? `contest:${contest.id}:${problem.id}` : problem.id;

  // Most recent wins: this device's unsaved copy, then the server draft, then the starter.
  const [code, setCode] = useState(() => loadDraft(draftKey) ?? (contest ? problem.starter : state.draft ?? problem.starter));
  const [leftTab, setLeftTab] = useState('description');
  const [consoleTab, setConsoleTab] = useState('cases');
  const [dockOpen, setDockOpen] = useState(true);
  const [run, setRun] = useState(null);
  const [busy, setBusy] = useState(null);
  const [pending, setPending] = useState(null);
  const [runtime, setRuntime] = useState({ phase: 'idle', text: '' });
  const [confirmReset, setConfirmReset] = useState(false);
  const [leftPct, setLeftPct] = useState(42);
  const [consoleH, setConsoleH] = useState(300);
  const busyRef = useRef(false);
  const codeRef = useRef(code);
  codeRef.current = code;

  useEffect(() => subscribe(setRuntime), []);
  // Warm the in-browser runtime (for Run) as soon as the problem opens.
  useEffect(() => { prepare(problem.track).catch(() => {}); }, [problem.track]);

  // Server draft sync: debounced while typing, flushed when the tab closes.
  const saveTimer = useRef(null);
  const lastSaved = useRef(state.draft ?? problem.starter);
  const flushDraft = useCallback((keepalive = false) => {
    clearTimeout(saveTimer.current);
    if (contest) return; // contest code stays on this device
    const current = codeRef.current;
    if (current === lastSaved.current) return;
    lastSaved.current = current;
    if (keepalive) {
      fetch(`/api/problems/${problem.id}/draft`, {
        method: 'PUT', keepalive: true, credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'datadrill' },
        body: JSON.stringify({ code: current }),
      }).catch(() => {});
    } else {
      api(`/problems/${problem.id}/draft`, { method: 'PUT', body: { code: current } }).catch(() => { lastSaved.current = null; });
    }
  }, [problem.id, contest]);
  useEffect(() => {
    const onHide = () => flushDraft(true);
    window.addEventListener('pagehide', onHide);
    return () => { window.removeEventListener('pagehide', onHide); clearTimeout(saveTimer.current); };
  }, [flushDraft]);

  const onChange = useCallback((next) => {
    setCode(next);
    saveDraft(draftKey, next);
    clearTimeout(saveTimer.current);
    if (!contest) saveTimer.current = setTimeout(() => flushDraft(), DRAFT_SAVE_MS);
  }, [draftKey, contest, flushDraft]);

  const replaceCode = (next) => onChange(next);

  const reveal = async () => {
    const r = await api(`/problems/${problem.id}/reveal`, { method: 'POST' });
    setData((d) => ({ ...d, solution: r.solution, state: { ...d.state, solutionUnlocked: true, revealed: d.state.status !== 'solved' || d.state.revealed } }));
  };

  // Run: visible examples, in the browser (zero server cost, instant).
  const runExamples = async () => {
    const results = await runTests(buildPayload(problem, problem.examples, codeRef.current));
    setRun({ mode: 'run', results, verdict: verdictOf(results, 'run') });
  };

  // Submit: graded on the server against every test. The clientToken makes a
  // retried POST (flaky network) return the same submission, never a duplicate.
  const submit = async () => {
    const clientToken = crypto.randomUUID();
    const body = { problemId: problem.id, code: codeRef.current, clientToken, ...(contest ? { contestId: contest.id } : {}) };
    let created;
    for (let attempt = 0; ; attempt++) {
      try {
        created = (await api('/submissions', { method: 'POST', body })).submission;
        break;
      } catch (err) {
        if (err.status !== 0 || attempt >= 2) throw err;     // retry only network failures
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
    flushDraft();
    setPending(created);
    const started = Date.now();
    let s = created;
    for (let i = 0; s.status === 'queued' || s.status === 'running'; i++) {
      if (Date.now() - started > SUBMIT_TIMEOUT_MS) throw new Error('Grading is taking unusually long — check the Submissions tab in a minute.');
      await new Promise((r) => setTimeout(r, SUBMIT_POLL_MS[Math.min(i, SUBMIT_POLL_MS.length - 1)]));
      try {
        s = (await api(`/submissions/${created.id}`)).submission;
        setPending(s);
      } catch (err) {
        if (err.status && err.status !== 503) throw err;       // keep polling through blips
      }
    }
    if (s.status === 'failed') throw new Error('We couldn\'t grade this submission because of a server problem. Please submit again.');
    setRun({ mode: 'submit', results: s.results, verdict: s.verdict, attemptNo: s.attemptNo, pointsAwarded: s.pointsAwarded });
    submissionsList.reload();
    if (contest) contest.onSubmitted?.();
    // Refresh status, attempts, points (and the solution, once solved).
    else api(`/problems/${problem.id}`).then((fresh) => setData(fresh)).catch(() => {});
  };

  const execute = useCallback(async (mode) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(mode);
    setPending(null);
    setConsoleTab('result');
    setDockOpen(true);
    try {
      await (mode === 'submit' ? submit() : runExamples());
    } catch (err) {
      setRun({ mode, error: err.message, timeout: Boolean(err.timeout) });
    } finally {
      busyRef.current = false;
      setBusy(null);
      setPending(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem, contest]);

  const dragX = useDrag('x', useCallback((pct) => setLeftPct(Math.min(70, Math.max(25, pct))), []));
  const dragY = useDrag('y', useCallback((px, box) => setConsoleH(Math.min(box.height - 160, Math.max(110, px - 52))), []));

  const runtimeDot = { idle: 'is-idle', loading: 'is-loading', ready: 'is-ready', running: 'is-loading', error: 'is-error' }[runtime.phase];
  const submissionCount = submissionsList.data?.submissions.length || 0;
  const problemHref = (id) => `/practice/${problem.track}/${id}`;

  const fileName = { sql: 'query.sql', python: 'solution.py', pyspark: 'job.py', pandas: 'analysis.py', shell: 'script.sh' }[problem.track];
  const panels = [
    ['description', 'Brief', 'doc'],
    ...(contest ? [] : [['hints', 'Hints', 'bulb', problem.hints.length]]),
    ['submissions', 'Attempts', 'history', submissionCount],
    ...(contest ? [] : [['solution', 'Solution', 'key']]),
  ];
  const panelTitle = { description: 'Brief', hints: 'Hints', submissions: contest ? 'Your attempts in this contest' : 'Your attempts', solution: 'Reference solution' }[leftTab];
  const saveState = contest ? 'Draft kept on this device' : 'Draft autosaved';

  return (
    <PlatformLayout title={`${problem.title} · ${contest ? contest.title : track.title}`} footer={false} nav={!contest}>
      <div className={`pf-ws pf-wb${contest ? ' pf-ws-focus' : ''}`}>
        {contest ? contest.bar : (
          <div className="pf-ws-bar">
            <nav className="pf-crumbs" aria-label="Breadcrumb" style={{ margin: 0, minWidth: 0 }}>
              <a href="/practice">Practice</a><span>/</span>
              <a href={`/practice/${track.id}`}>{track.title}</a><span>/</span>
              <span className="pf-ellipsis">{problem.title}</span>
            </nav>
            <span className="pf-ws-nav">
              <a href={problem.prev ? problemHref(problem.prev) : undefined} aria-disabled={!problem.prev} title="Previous problem">‹</a>
              <span className="pf-meta">{problem.position}/{problem.total}</span>
              <a href={problem.next ? problemHref(problem.next) : undefined} aria-disabled={!problem.next} title="Next problem">›</a>
            </span>
          </div>
        )}

        <div className="pf-ws-main" style={{ '--left': `${leftPct}%` }}>
          <section className="pf-ws-left pf-wb-left">
            <nav className="pf-wb-rail" aria-label="Problem panels">
              {panels.map(([id, label, icon, count]) => (
                <button key={id} className={leftTab === id ? 'is-active' : ''} aria-pressed={leftTab === id} onClick={() => setLeftTab(id)} title={label}>
                  <Icon name={icon} size={18} />
                  <span>{label}</span>
                  {count > 0 && <i>{count}</i>}
                </button>
              ))}
            </nav>
            <div className="pf-wb-panel">
              <div className="pf-wb-panel-head">{panelTitle}</div>
              <div className="pf-ws-scroll">
                <PanelBoundary resetKey={leftTab}>
                  {leftTab === 'description' && <DescriptionTab problem={problem} solved={solved} state={state} contest={contest} onOpenHints={() => setLeftTab('hints')} />}
                  {leftTab === 'hints' && !contest && <HintsTab problem={problem} />}
                  {leftTab === 'solution' && !contest && <SolutionTab problem={problem} solution={solution} onReveal={reveal} onUse={replaceCode} />}
                  {leftTab === 'submissions' && <SubmissionsTab list={submissionsList} onLoad={replaceCode} />}
                </PanelBoundary>
              </div>
            </div>
          </section>

          <div className="pf-ws-gutter-x" onPointerDown={dragX} role="separator" aria-orientation="vertical" aria-label="Resize panels" />

          <section className="pf-ws-right" style={{ '--console': dockOpen ? `${consoleH}px` : '40px' }}>
            <div className="pf-wb-toolbar">
              <span className="pf-wb-file"><span className={`pf-wb-file-dot is-${problem.track}`} />{fileName}</span>
              <span className={`pf-runtime ${runtimeDot} pf-hide-sm`} title={runtime.text}>
                <span className="pf-runtime-dot" />{runtime.text || runtimeLabel(problem.track)}
              </span>
              <span className="pf-wb-toolbar-right">
                {confirmReset ? (
                  <span className="pf-confirm">
                    Reset to starter?
                    <button className="pf-text-btn" onClick={() => { clearDraft(draftKey); replaceCode(problem.starter); setConfirmReset(false); }}>Reset</button>
                    <button className="pf-text-btn" style={{ color: 'var(--muted)' }} onClick={() => setConfirmReset(false)}>Cancel</button>
                  </span>
                ) : (
                  <button className="pf-wb-icon-btn" title="Reset to starter code" onClick={() => setConfirmReset(true)}>↺</button>
                )}
                <button className="pf-wb-run" disabled={Boolean(busy)} onClick={() => execute('run')} title={`Run the examples (${MOD} ')`}>
                  <Icon name="play" size={14} />{busy === 'run' ? 'Running…' : 'Run'}
                </button>
                <button className="pf-wb-submit" disabled={Boolean(busy) || Boolean(contest?.ended)} onClick={() => execute('submit')} title={`Grade against every test (${MOD} ↵)`}>
                  <Icon name="upload" size={14} />{contest?.ended ? 'Contest over' : busy === 'submit' ? (pending?.status === 'running' ? 'Grading…' : 'Submitting…') : 'Submit'}
                </button>
              </span>
            </div>
            <div className="pf-ws-editor">
              <CodeEditor
                value={code}
                track={problem.track}
                schema={problem.schema}
                onChange={onChange}
                onRun={() => execute('run')}
                onSubmit={() => { if (!contest?.ended) execute('submit'); }}
              />
            </div>

            {dockOpen && <div className="pf-ws-gutter-y" onPointerDown={dragY} role="separator" aria-orientation="horizontal" aria-label="Resize output" />}

            <div className={`pf-ws-console pf-wb-dock${dockOpen ? '' : ' is-collapsed'}`}>
              <div className="pf-wb-dock-head">
                <span className="pf-wb-dock-title">Output</span>
                <div className="pf-wb-seg" role="tablist">
                  <button role="tab" aria-selected={consoleTab === 'cases'} className={consoleTab === 'cases' ? 'is-active' : ''} onClick={() => { setConsoleTab('cases'); setDockOpen(true); }}>Examples</button>
                  <button role="tab" aria-selected={consoleTab === 'result'} className={consoleTab === 'result' ? 'is-active' : ''} onClick={() => { setConsoleTab('result'); setDockOpen(true); }}>
                    Results{run?.verdict && <span className={`pf-dot is-${verdictTone(run.verdict)}`} />}
                  </button>
                </div>
                {run?.verdict && <span className={`pf-wb-verdict is-${verdictTone(run.verdict)}`}>{run.verdict}</span>}
                <button className="pf-wb-icon-btn pf-wb-collapse" aria-expanded={dockOpen} title={dockOpen ? 'Collapse output' : 'Expand output'} onClick={() => setDockOpen((o) => !o)}>
                  <span style={{ display: 'inline-flex', transform: dockOpen ? 'none' : 'rotate(180deg)' }}><Icon name="chevron" size={16} /></span>
                </button>
              </div>
              {dockOpen && (
                <div className="pf-ws-console-body">
                  <PanelBoundary resetKey={`${consoleTab}:${run?.results ? run.results.length : ''}:${busy}`}>
                    {consoleTab === 'cases'
                      ? <TestcasesPane problem={problem} />
                      : <ResultPane problem={problem} run={run} busy={busy} runtime={runtime} pending={pending} contest={contest} />}
                  </PanelBoundary>
                </div>
              )}
            </div>

            <footer className="pf-wb-status">
              <span className={`pf-runtime ${runtimeDot}`}><span className="pf-runtime-dot" />{runtime.phase === 'ready' ? 'Runtime ready' : runtime.text || 'Runtime idle'}</span>
              <span className="pf-hide-sm">{saveState}</span>
              <span className="pf-wb-status-keys pf-hide-sm">{MOD} ' run · {MOD} ↵ submit · Tab indents · {MOD}F search</span>
            </footer>
          </section>
        </div>
      </div>
    </PlatformLayout>
  );
}
