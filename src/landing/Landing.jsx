import { useEffect, useState } from 'react';
import { PlatformLayout, Icon, useHashScroll } from '../platform/Shell.jsx';
import Reveal from '../components/Reveal.jsx';
import { useCatalog } from '../lib/useApi.js';
import { BRAND, ROLES, UPCOMING_TRACKS } from '../platform/catalog.js';
import './landing.css';

// ---------------------------------------------------------------------------
// Landing page — "Lineage" (docs §11.1). Product first: the hero is a live
// demo of one problem (type → run → submit → Accepted), followed by real
// catalog numbers, a problem-first walkthrough, the tracks table, how grading
// works, paths and contests, FAQ and one closing call to action.
// Motion only demonstrates the product and stops for prefers-reduced-motion.
// ---------------------------------------------------------------------------

const reducedMotion = () => typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function Landing() {
  useHashScroll();
  const { data } = useCatalog();
  const stats = data?.stats;
  const tracks = data?.tracks || [];

  return (
    <PlatformLayout>
      <Hero problems={stats?.problems} />
      <div className="pf-wrap"><Stats stats={stats} tracks={tracks} /></div>
      <Walkthrough />
      <Tracks tracks={tracks} />
      <Grading />
      <PathsAndContests />
      <Faq />
      <div className="pf-wrap"><CtaBand /></div>
    </PlatformLayout>
  );
}

// --- Hero ----------------------------------------------------------------------

// The demo query. Output and timings are illustrative; the points match the
// real base value for a Medium problem (docs §8.13).
const DEMO_CODE = `-- top 2 customers by revenue, per region
WITH ranked AS (
  SELECT region, customer_id,
         SUM(amount) AS revenue,
         DENSE_RANK() OVER (
           PARTITION BY region
           ORDER BY SUM(amount) DESC) AS rnk
  FROM orders
  GROUP BY region, customer_id
)
SELECT * FROM ranked WHERE rnk <= 2;`;
const DEMO_CASES = ['Example 1', 'Example 2', 'Ties on revenue', 'Region with one customer', 'Empty orders table', 'Hidden × 6'];
const KEYWORDS = /^(WITH|AS|SELECT|FROM|WHERE|GROUP|BY|ORDER|PARTITION|OVER|DESC)$/;
const FUNCS = /^(SUM|DENSE_RANK|MAX)$/;
const LOOP = 260; // ticks of 60 ms ≈ 15.6 s per loop

function highlightSql(line) {
  if (/^\s*--/.test(line)) return <span className="cm">{line}</span>;
  return line.split(/([A-Za-z_]+)/).map((w, i) => (
    KEYWORDS.test(w) ? <span key={i} className="kw">{w}</span>
      : FUNCS.test(w) ? <span key={i} className="fn">{w}</span>
        : w
  ));
}

function HeroDemo() {
  const [t, setT] = useState(() => (reducedMotion() ? LOOP - 1 : 0));
  useEffect(() => {
    if (reducedMotion()) return undefined;
    const id = setInterval(() => { if (!document.hidden) setT((n) => (n + 1) % LOOP); }, 60);
    return () => clearInterval(id);
  }, []);

  const typed = Math.min(DEMO_CODE.length, t * 3);
  const lines = DEMO_CODE.slice(0, typed).split('\n');
  const phase = typed < DEMO_CODE.length ? 'typing' : t < 150 ? 'run' : t < 175 ? 'grading' : 'done';
  const outLabel = { typing: 'waiting for run', run: 'examples 2 / 2', grading: 'submitted · queued', done: '11 / 11 passed' }[phase];

  return (
    <div className="ld-demo-wrap ld-in" style={{ animationDelay: '.3s' }}>
      <div className="ld-callout ld-callout-a" aria-hidden="true">
        <i style={{ background: 'var(--accent)' }} />autocomplete
        <span>from the problem schema</span>
        <svg width="150" height="30" style={{ left: 60, top: 40 }}><path d="M0 0 C 40 0, 60 24, 96 24" /></svg>
      </div>
      <div className="ld-callout ld-callout-b" aria-hidden="true">
        hidden tests<i style={{ background: 'var(--ink)' }} />
        <span>never sent to the browser</span>
        <svg width="120" height="30" style={{ right: 70, top: 40 }}><path d="M120 0 C 80 0, 60 24, 10 24" /></svg>
      </div>

      <div className="ld-demo" role="img" aria-label="Demo: a SQL query is written, run against the examples, submitted and accepted on hidden tests">
        <div className="ld-demo-bar">
          <span className="ld-demo-file"><i />query.sql</span>
          <span className="ld-demo-meta">practice / sql / top-customers-per-region · medium · 20 pts</span>
          <span className="ld-demo-actions" aria-hidden="true">
            <span className={`ld-demo-run${phase === 'typing' ? '' : ' is-on'}`}>Run</span>
            <span className={`ld-demo-submit${phase === 'grading' || phase === 'done' ? ' is-on' : ''}`}>Submit</span>
          </span>
        </div>
        <div className="ld-demo-body" aria-hidden="true">
          <pre className="ld-code">
            {lines.map((line, i) => (
              <div key={i}>
                <span className="ln">{i + 1}</span>{highlightSql(line)}
                {i === lines.length - 1 && phase === 'typing' && <span className="ld-caret" />}
              </div>
            ))}
          </pre>
          <div className="ld-out">
            <div className="ld-out-head"><span>output</span><span>{outLabel}</span></div>
            <div className="ld-out-body">
              {DEMO_CASES.map((name, i) => {
                const pass = phase === 'done' || ((phase === 'run' || phase === 'grading') && i < 2);
                const wait = phase === 'grading' && i >= 2;
                const state = pass ? 'passed' : wait ? 'grading…' : i < 2 ? '—' : 'on submit';
                return (
                  <div key={name} className={`ld-case${i < 2 || pass || wait ? ' is-live' : ''}`}>
                    <span>{name}</span><span className={pass ? 'is-pass' : ''}>{state}</span>
                  </div>
                );
              })}
              {phase === 'done' && <div className="ld-verdict"><b>Accepted</b><span className="ld-mono">+20 pts · 96 ms</span></div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero({ problems }) {
  return (
    <section className="ld-hero">
      <div className="pf-wrap">
        <a href="/contests" className="ld-pill ld-in"><b>new</b>Timed contests with friends are live</a>
        <h1 className="ld-h1 ld-in" style={{ animationDelay: '.06s' }}>
          Practice data engineering<br /><span className="pf-tone">like the job.</span>
        </h1>
        <p className="ld-sub ld-in" style={{ animationDelay: '.12s' }}>
          {problems ? `${problems} ` : ''}SQL, Python and PySpark problems on realistic tables. Run them in your browser,
          then get graded on hidden tests, the way production would judge your code.
        </p>
        <div className="ld-ctas ld-in" style={{ animationDelay: '.18s' }}>
          <a href="/practice" className="pf-btn pf-btn-primary pf-btn-lg">Solve your first problem</a>
          <a href="/learn" className="pf-btn pf-btn-ghost pf-btn-lg">Browse courses</a>
        </div>
        <p className="ld-note ld-mono ld-in" style={{ animationDelay: '.22s' }}>free to start · nothing to install</p>
        <HeroDemo />
      </div>
    </section>
  );
}

// --- Trust strip (all numbers from /api/catalog) ----------------------------------

function Stats({ stats, tracks }) {
  const v = (n) => (stats ? n : '—');
  const live = tracks.filter((t) => t.status === 'live');
  const items = [
    { value: v(stats?.problems), label: 'problems, every one with hidden tests' },
    { value: v(live.length), label: live.length ? `live tracks: ${live.map((t) => t.title).join(', ')}` : 'live tracks' },
    { value: v(stats?.lessons), label: `lessons across ${stats?.courses ?? '—'} courses` },
    { value: '0', label: 'things to install before your first run' },
  ];
  return (
    <div className="ld-stats">
      {items.map((s) => <div key={s.label}><b>{s.value}</b><span>{s.label}</span></div>)}
    </div>
  );
}

// --- Walkthrough (a real four-step sequence, so it is numbered) ----------------------

const STEPS = [
  ['Read the brief', 'A realistic task on business tables, with the schema and a worked example.'],
  ['Write the query', 'A real editor with autocomplete from the problem schema, in five languages.'],
  ['Run the examples', 'Instant feedback in your browser on the visible cases.'],
  ['Submit for a verdict', 'The server grades it on hidden tests. Accepted earns points once.'],
];

function StepPanel({ step }) {
  if (step === 0) return (
    <div className="ld-panel-body" key="0">
      <h3>Second highest salary</h3>
      <p>Return the second highest distinct salary from <code>employees</code> as <code>second_highest</code>. If there is none, return NULL.</p>
      <table className="ld-table">
        <thead><tr><th>id</th><th>salary</th></tr></thead>
        <tbody><tr><td>1</td><td>100</td></tr><tr><td>2</td><td>200</td></tr><tr><td>3</td><td>300</td></tr></tbody>
      </table>
    </div>
  );
  if (step === 1) return (
    <pre className="ld-panel-code ld-panel-body" key="1" style={{ padding: '24px 0' }}>
      <div><span className="ln">1</span><span className="kw">SELECT</span> <span className="fn">MAX</span>(salary) <span className="kw">AS</span> second_highest</div>
      <div><span className="ln">2</span><span className="kw">FROM</span> employees</div>
      <div><span className="ln">3</span><span className="kw">WHERE</span> salary &lt; (</div>
      <div><span className="ln">4</span>  <span className="kw">SELECT</span> <span className="fn">MAX</span>(salary) <span className="kw">FROM</span> employees</div>
      <div className="hl"><span className="ln">5</span>);</div>
      <div className="ld-schema">employees.<b>salary</b> · id · dept_id · hired_at</div>
    </pre>
  );
  if (step === 2) return (
    <div className="ld-panel-body" key="2">
      <div className="ld-mono" style={{ marginBottom: 14 }}>run · examples · in your browser · 41 ms</div>
      <div className="ld-result"><span>Example 1</span><span>passed · 200</span></div>
      <div className="ld-result"><span>Example 2, single row</span><span>passed · NULL</span></div>
      <p className="ld-quiet">Examples are for debugging. Ties, empty tables and the other edge cases only run when you submit.</p>
    </div>
  );
  return (
    <div className="ld-panel-body" key="3">
      <div className="ld-accepted"><b>Accepted</b><span className="ld-mono">11 / 11 tests · graded on the server · +10 pts</span></div>
      <div className="ld-ticks">{Array.from({ length: 11 }, (_, i) => <span key={i} />)}</div>
      <p className="ld-quiet">Points are awarded once, on your first accepted submission, and count towards your profile and the leaderboard.</p>
    </div>
  );
}

function Walkthrough() {
  const [step, setStep] = useState(0);
  const [held, setHeld] = useState(reducedMotion);
  useEffect(() => {
    if (held) return undefined;
    const id = setTimeout(() => setStep((s) => (s + 1) % STEPS.length), 4500);
    return () => clearTimeout(id);
  }, [step, held]);

  return (
    <section className="ld-sec" id="how">
      <div className="pf-wrap">
        <Reveal>
          <div className="ld-head">
            <h2 className="ld-h2">Tutorials teach syntax.<br /><span className="pf-tone">Work tests judgement.</span></h2>
            <p className="ld-lead">Every problem is a small, realistic task on business data. You only pass when your output is right for the cases you can see and the ones you cannot.</p>
          </div>
        </Reveal>
        <div className="ld-walk">
          <div className="ld-steps" role="tablist" aria-label="How a problem works">
            {STEPS.map(([title, text], i) => (
              <button key={title} role="tab" aria-selected={i === step} className={`ld-step${i === step ? ' is-on' : ''}`}
                onClick={() => { setStep(i); setHeld(true); }}>
                <span className="ld-step-n">0{i + 1}</span>
                <span className="ld-step-t">{title}</span>
                <span className="ld-step-d">{text}</span>
                {i === step && <span key={step} className={`ld-step-bar${held ? ' is-held' : ''}`} />}
              </button>
            ))}
          </div>
          <div className="ld-panel" role="tabpanel">
            <div className="ld-panel-head"><b>second-highest-salary</b><span>easy · 10 pts</span></div>
            <StepPanel step={step} />
          </div>
        </div>
      </div>
    </section>
  );
}

// --- Tracks table (from the catalog) ---------------------------------------------------

const RUNS_ON = {
  sql: 'DuckDB', python: 'Pyodide', dsa: 'Pyodide', pyspark: 'sqlframe', pandas: 'Pyodide', shell: 'sandboxed bash',
  'data-modeling': 'design review', 'pipeline-hackathon': 'hackathon', 'system-design-hackathon': 'hackathon',
};

function Tracks({ tracks }) {
  return (
    <section className="ld-sec" id="practice">
      <div className="pf-wrap">
        <Reveal>
          <div className="ld-head">
            <h2 className="ld-h2">The stack you will use at work.<br /><span className="pf-tone">Graded like it matters.</span></h2>
            <a href="/practice" className="pf-btn pf-btn-ghost pf-btn-sm">All tracks</a>
          </div>
        </Reveal>
        <div className="ld-tracks">
          <div className="ld-tracks-inner">
            <div className="ld-trow ld-trow-head"><span>track</span><span>problems</span><span>topics include</span><span>runs on</span><span className="ld-go">status</span></div>
            {tracks.map((t) => {
              const live = t.status === 'live';
              return (
                <a key={t.id} href={`/practice/${t.id}`} className={`ld-trow${live ? '' : ' is-soon'}`}>
                  <span className="ld-tname"><i><Icon name={t.icon} size={16} /></i>{t.title}</span>
                  <span className="ld-tcount">{live ? (t.problems?.total ?? '—') : '—'}</span>
                  <span className="ld-ttopics">{t.topics.slice(0, 3).join(', ').toLowerCase()}</span>
                  <span className="ld-truntime">{RUNS_ON[t.id] || (t.kind === 'editor' ? 'browser' : t.kind)}</span>
                  <span className="ld-go">{live ? 'open →' : 'in design'}</span>
                </a>
              );
            })}
          </div>
        </div>
        <p className="ld-mono" style={{ marginTop: 16 }}>coming next: {UPCOMING_TRACKS.join(', ').toLowerCase()}</p>
      </div>
    </section>
  );
}

// --- Grading + lineage band ---------------------------------------------------------------

const TOKENS = [
  ['sql/daily-active-users', 'pass', 18, -2], ['sql/second-highest-salary', 'fail', 46, -6],
  ['pyspark/sessionize-clicks', 'pass', 74, -10], ['pandas/best-equipped-city', 'pass', 102, -4],
  ['shell/latest-record-per-key', 'fail', 88, -12], ['python/dedupe-events', 'pass', 32, -8],
];

function Grading() {
  return (
    <section className="ld-sec" id="grading">
      <div className="pf-wrap">
        <Reveal>
          <div className="ld-grade">
            <div className="ld-grade-top">
              <div>
                <h2 className="ld-h3">Run in the browser.<br /><span className="pf-tone">Graded on the server.</span></h2>
                <p className="ld-lead">One grader decides every verdict, in practice and in contests. Hidden tests stay on the server, so passing means your code works, not that you saw the answers.</p>
              </div>
              <svg viewBox="0 0 520 220" role="img" aria-label="Your code runs visible examples in the browser and hidden tests on the server; both feed one verdict">
                <g fontFamily="Geist Mono, monospace" fontSize="11.5" fill="#3A3D39">
                  <rect x="4" y="84" width="112" height="48" rx="10" fill="#F4F5F2" stroke="#C6C8C0" /><text x="60" y="113" textAnchor="middle" fill="#121412">your code</text>
                  <rect x="196" y="16" width="140" height="48" rx="10" fill="#FFFFFF" stroke="#C6C8C0" /><text x="266" y="37" textAnchor="middle" fill="#121412">examples</text><text x="266" y="53" textAnchor="middle" fill="#6B6F69">browser · visible</text>
                  <rect x="196" y="156" width="140" height="48" rx="10" fill="#FFFFFF" stroke="#121412" /><text x="266" y="177" textAnchor="middle" fill="#121412">hidden tests</text><text x="266" y="193" textAnchor="middle" fill="#6B6F69">server · sealed</text>
                  <circle cx="462" cy="108" r="40" fill="#E3F1E8" stroke="#127A4C" /><text x="462" y="112" textAnchor="middle" fill="#127A4C">verdict</text>
                </g>
                <g fill="none" strokeWidth="1">
                  <path d="M116 100 C 160 100, 150 40, 196 40" stroke="#121412" />
                  <path d="M116 116 C 160 116, 150 180, 196 180" stroke="#121412" />
                  <path d="M336 40 C 380 40, 384 100, 422 104" stroke="#A3A69F" strokeDasharray="3 4" />
                  <path d="M336 180 C 380 180, 384 118, 422 114" stroke="#121412" />
                </g>
                <text x="376" y="62" fontFamily="Geist Mono, monospace" fontSize="10.5" fill="#6B6F69">run</text>
                <text x="370" y="166" fontFamily="Geist Mono, monospace" fontSize="10.5" fill="#121412">submit</text>
              </svg>
            </div>
            <div aria-hidden="true">
              <div className="ld-band-cols"><div>01 read</div><div>02 write</div><div>03 run</div><div>04 grade</div><div>05 accepted</div></div>
              <div className="ld-band">
                <div className="ld-band-grid"><div /><div /><div /><div /><div /></div>
                {TOKENS.map(([name, kind, top, delay]) => (
                  <span key={name} className={`ld-tok is-${kind}`} style={{ top, animationDelay: `${delay}s` }}>
                    <i style={{ animationDelay: `${delay}s` }} />{name}
                  </span>
                ))}
              </div>
            </div>
            <div className="ld-band-foot">Submissions moving through DataDrill. Illustration with sample data · hover to pause</div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// --- Paths + contests ----------------------------------------------------------------------

function PathsAndContests() {
  return (
    <section className="ld-sec" id="contests">
      <div className="pf-wrap ld-duo">
        <Reveal>
          <h2 className="ld-h3">Pick a role.<br /><span className="pf-tone">The order is worked out.</span></h2>
          <div className="ld-paths">
            {ROLES.map((r) => (
              <a key={r.id} href="/learn" className="ld-path">
                <b>{r.title}</b><span className="ld-mono">{r.level.toLowerCase()}</span>
                <span>{r.blurb}</span><span className="ld-go">View path</span>
              </a>
            ))}
          </div>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="ld-h3">Timed rounds.<br /><span className="pf-tone">With or without friends.</span></h2>
          <div className="ld-board" aria-label="Example contest scoreboard">
            <div className="ld-board-head"><span>friday sql sprint · 4 problems</span><span><i />23:41 left</span></div>
            <div className="ld-brow ld-brow-head"><span>#</span><span>player</span><span>A</span><span>B</span><span>C</span><span>D</span><span>pts</span></div>
            <div className="ld-brow is-me"><span>1</span><span className="who">you</span><span className="ld-ac">✓</span><span className="ld-ac">✓</span><span className="ld-ac">✓</span><span className="ld-na">·</span><span>70</span></div>
            <div className="ld-brow"><span>2</span><span className="who">a_friend</span><span className="ld-ac">✓</span><span className="ld-ac">✓</span><span className="ld-wa">✕2</span><span className="ld-ac">✓</span><span>50</span></div>
            <div className="ld-brow"><span>3</span><span className="who">another_friend</span><span className="ld-ac">✓</span><span className="ld-na">·</span><span className="ld-ac">✓</span><span className="ld-na">·</span><span>30</span></div>
          </div>
          <a href="/contests" className="pf-btn pf-btn-ghost pf-btn-sm ld-race-cta">Start a contest</a>
        </Reveal>
      </div>
    </section>
  );
}

// --- FAQ ------------------------------------------------------------------------------------

const FAQS = [
  ['Who is DataDrill for?', 'Aspiring and working data engineers, analytics engineers and data analysts. Courses start from fundamentals; problems go from easy to interview-hard.'],
  ['Do I need to install anything?', 'No. The editors run in your browser, so you can start solving immediately.'],
  ['How is my code graded?', 'Your output is compared with the expected result for every visible and hidden case. A problem is accepted only when all of them pass.'],
  ['Are company tags real?', 'A company tag only appears when there is a verifiable public interview report behind it.'],
  ['What is coming next?', `${UPCOMING_TRACKS.join(', ')} tracks, plus new problems every week.`],
];

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section className="ld-sec" id="faq">
      <div className="pf-wrap ld-faq">
        <h2 className="ld-h3">Questions<br /><span className="pf-tone">before you start.</span></h2>
        <div className="ld-faq-list">
          {FAQS.map(([q, a], i) => (
            <div key={q} className={`pf-faq-item${open === i ? ' is-open' : ''}`}>
              <button className="pf-faq-q" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
                <span>{q}</span><span aria-hidden="true">{open === i ? '−' : '+'}</span>
              </button>
              {open === i && <p className="pf-faq-a">{a}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// --- Final CTA ------------------------------------------------------------------------------

function CtaBand() {
  return (
    <Reveal>
      <div className="pf-cta-band ld-cta">
        <h2>Your first problem is<br /><span>one query away.</span></h2>
        <a href="/practice" className="pf-btn pf-btn-light pf-btn-lg">Start practising, free</a>
      </div>
      <p className="ld-mono" style={{ marginTop: 14 }}>{BRAND.description}</p>
    </Reveal>
  );
}
