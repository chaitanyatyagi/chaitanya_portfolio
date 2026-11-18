import { useState } from 'react';
import { PlatformLayout, Icon, useHashScroll } from '../platform/Shell.jsx';
import Reveal from '../components/Reveal.jsx';
import { CourseCard } from '../learn/components.jsx';
import { useCatalog } from '../lib/useApi.js';
import { BRAND, ROLES, UPCOMING_TRACKS } from '../platform/catalog.js';
import './landing.css';

// ---------------------------------------------------------------------------
// Landing page — "Data Arcade" (docs §11.1). Positions the platform for data
// engineers, analytics engineers and analysts: learn → practice → build →
// interview. The one memorable moment is the hero console: Run prints the
// query result as a ticket and stamps it Accepted.
// ---------------------------------------------------------------------------

export default function Landing() {
  useHashScroll();

  return (
    <PlatformLayout>
      <Hero />
      <Marquee />
      <div className="pf-wrap"><Scoreboard /></div>
      <Players />
      <Cartridges />
      <LevelMap />
      <CoursesPreview />
      <RaceAndQuest />
      <Faq />
      <CtaBand />
    </PlatformLayout>
  );
}

// --- Hero ------------------------------------------------------------------

// Sample problems for the hero console. Output rows are illustrative; points
// follow the real base values (Easy 10 / Medium 20 / Hard 40, docs §8.13).
const SAMPLES = {
  sql: {
    file: 'top_customers.sql',
    points: 20,
    code: `-- Top 2 customers by revenue in each region
WITH ranked AS (
  SELECT region, customer_id,
         SUM(amount) AS revenue,
         DENSE_RANK() OVER (
           PARTITION BY region
           ORDER BY SUM(amount) DESC) AS rnk
  FROM orders
  GROUP BY region, customer_id
)
SELECT * FROM ranked WHERE rnk <= 2;`,
    cols: ['region', 'customer_id', 'revenue', 'rnk'],
    rows: [['APAC', 'c_118', '48,210', '1'], ['APAC', 'c_042', '41,775', '2'], ['EMEA', 'c_301', '52,980', '1'], ['EMEA', 'c_077', '39,400', '2']],
  },
  python: {
    file: 'dedupe_events.py',
    points: 10,
    code: `# Keep the latest event per user_id
def dedupe(events):
    latest = {}
    for e in events:
        uid = e["user_id"]
        if uid not in latest or e["ts"] > latest[uid]["ts"]:
            latest[uid] = e
    return sorted(latest.values(),
                  key=lambda e: e["user_id"])`,
    cols: ['user_id', 'event', 'ts'],
    rows: [['u_01', 'checkout', '09:41:07'], ['u_02', 'login', '09:38:52'], ['u_03', 'add_to_cart', '09:40:19']],
  },
  pyspark: {
    file: 'daily_revenue.py',
    points: 20,
    code: `# Daily revenue with a 7-day rolling average
from pyspark.sql import functions as F, Window

w = Window.orderBy("day").rowsBetween(-6, 0)
result = (orders
    .groupBy(F.to_date("ts").alias("day"))
    .agg(F.sum("amount").alias("revenue"))
    .withColumn("avg_7d", F.avg("revenue").over(w)))`,
    cols: ['day', 'revenue', 'avg_7d'],
    rows: [['2026-11-16', '18,420', '17,905'], ['2026-11-17', '19,110', '18,032'], ['2026-11-18', '17,860', '18,101']],
  },
};

const KEYWORDS = /\b(WITH|AS|SELECT|FROM|WHERE|GROUP|BY|ORDER|PARTITION|OVER|DESC|def|for|in|if|not|or|return|from|import|lambda)\b/g;
const FUNCS = /\b(SUM|DENSE_RANK|sorted|values|groupBy|agg|withColumn|alias|avg|sum|to_date|orderBy|rowsBetween|over|dedupe)\b(?=\s*\()/g;

// Minimal highlighter — good enough for a static marketing snippet.
function highlight(line) {
  const comment = line.match(/^(\s*)(--|#)(.*)$/);
  if (comment) return <span className="cm">{line}</span>;
  const parts = line.split(/("[^"]*")/g);
  return parts.map((part, i) => {
    if (i % 2 === 1) return <span key={i} className="str">{part}</span>;
    const html = part
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(FUNCS, '<span class="fn">$1</span>')
      .replace(KEYWORDS, '<span class="kw">$1</span>');
    return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
  });
}

function Console() {
  const [lang, setLang] = useState('sql');
  const [run, setRun] = useState(0); // bumps on every Run so the ticket re-animates
  const sample = SAMPLES[lang];
  const pick = (key) => { setLang(key); setRun(0); };

  return (
    <div className="ld-console-wrap">
      <span className="ld-sticker ld-sticker-a" aria-hidden="true">hidden tests included</span>
      <span className="ld-sticker ld-sticker-b" aria-hidden="true">0 installs</span>

      <div className="ld-console">
        <div className="ld-console-tabs" role="tablist" aria-label="Sample problems">
          {Object.keys(SAMPLES).map((key) => (
            <button key={key} role="tab" aria-selected={key === lang}
              className={`ld-console-tab${key === lang ? ' is-active' : ''}`} onClick={() => pick(key)}>
              {SAMPLES[key].file}
            </button>
          ))}
        </div>
        <pre className="ld-code">
          {sample.code.split('\n').map((line, i) => (
            <div key={i}><span className="ln">{i + 1}</span>{highlight(line)}</div>
          ))}
        </pre>
        <div className="ld-console-foot">
          <span className="ld-console-status" aria-live="polite">
            {run ? '4 / 4 tests passed · 182 ms' : 'Press Run to grade it'}
          </span>
          <button className="pf-btn pf-btn-run" onClick={() => setRun((n) => n + 1)}>
            <Icon name="play" size={14} /> {run ? 'Run again' : 'Run'}
          </button>
        </div>
      </div>

      {run > 0 && (
        <div className="ld-ticket" key={`${lang}-${run}`}>
          <div className="ld-ticket-scroll">
            <table>
              <thead><tr>{sample.cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>{sample.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{v}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <div className="ld-stamp">Accepted · +{sample.points} pts</div>
        </div>
      )}
    </div>
  );
}

function Hero() {
  return (
    <section className="ld-hero">
      <div className="pf-wrap ld-hero-grid">
        <div>
          <div className="ld-roles">
            {ROLES.map((r) => <span key={r.id} className="ld-role-chip">{r.title}</span>)}
          </div>
          <h1 className="ld-h1">{BRAND.tagline}</h1>
          <p className="ld-sub">
            Solve SQL, Python and PySpark problems against real test cases, climb the leaderboard and race
            friends in timed contests. Structured courses fill the gaps between.
          </p>
          <div className="ld-ctas">
            <a href="/practice" className="pf-btn pf-btn-primary pf-btn-lg">Solve your first problem</a>
            <a href="/learn" className="pf-btn pf-btn-ghost pf-btn-lg">Explore courses</a>
          </div>
          <p className="ld-note">Free to start. Runs in your browser. Nothing to install.</p>
        </div>
        <Console />
      </div>
    </section>
  );
}

// --- Stack marquee -----------------------------------------------------------

const STACK = ['SQL', 'Python', 'PySpark', 'pandas', 'Shell', 'Airflow', 'Kafka', 'dbt', 'BigQuery', 'Snowflake', 'Delta Lake'];

function Marquee() {
  // Two identical runs so the CSS loop (translateX -50%) is seamless; the
  // second run is hidden from screen readers.
  const run = (copy) => STACK.map((s) => (
    <span key={`${copy}-${s}`} aria-hidden={copy ? true : undefined}>{s}<span aria-hidden="true" style={{ marginLeft: 40 }}>✶</span></span>
  ));
  return (
    <div className="ld-marquee" aria-label="Built around the real stack">
      <div className="ld-marquee-track">{run(0)}{run(1)}</div>
    </div>
  );
}

// --- Scoreboard (all derived from real catalog data) --------------------------

function Scoreboard() {
  const stats = useCatalog().data?.stats;
  const v = (n, suffix = '') => (stats ? `${n}${suffix}` : '—');
  const items = [
    { value: v(stats?.courses), label: 'Structured courses' },
    { value: v(stats?.modules), label: 'Course modules' },
    { value: v(stats?.lessons, '+'), label: 'Lessons and deep-dives' },
    { value: v(stats?.tracks), label: 'Practice tracks' },
  ];
  return (
    <Reveal>
      <div className="ld-score">
        {items.map((s) => <div key={s.label}><b>{s.value}</b><span>{s.label}</span></div>)}
      </div>
    </Reveal>
  );
}

// --- Character select (roles) --------------------------------------------------

const ROLE_COLORS = ['var(--periwinkle)', 'var(--rose)', 'var(--sun)'];

function Players() {
  const [picked, setPicked] = useState(ROLES[0].id);
  return (
    <section className="ld-sec" id="paths">
      <div className="pf-wrap">
        <Reveal>
          <div className="ld-head">
            <div>
              <h2 className="ld-h2">Pick your player.</h2>
              <p className="ld-lead">Each path orders the courses and practice that matter for that job, so you always know what to learn next.</p>
            </div>
          </div>
        </Reveal>
        <div className="ld-players">
          {ROLES.map((r, i) => {
            const on = r.id === picked;
            return (
              <Reveal key={r.id} delay={i * 80} style={{ height: '100%', display: 'flex' }}>
                <div className={`ld-player${on ? ' is-picked' : ''}`} style={{ flex: 1 }} onClick={() => setPicked(r.id)}>
                  <button type="button" className="ld-player-top" aria-pressed={on}
                    style={{ background: ROLE_COLORS[i % ROLE_COLORS.length] }} onClick={() => setPicked(r.id)}>
                    <span>
                      <span className="ld-player-level">{r.level}</span>
                      <span className="ld-player-name">{r.title}</span>
                    </span>
                    {on && <span className="ld-ready">P1 READY</span>}
                  </button>
                  <div className="ld-player-body">
                    <p>{r.blurb}</p>
                    <div className="ld-skills">{r.skills.map((s) => <span key={s} className="pf-chip">{s}</span>)}</div>
                    <a href="/learn" className={`pf-btn pf-btn-sm ld-player-go${on ? ' pf-btn-primary' : ''}`}>
                      {on ? 'Start this path' : 'View path'}
                    </a>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// --- Cartridges (practice tracks) ------------------------------------------------

const CART_COLORS = ['var(--lime)', 'var(--periwinkle)', 'var(--rose)', 'var(--sun)'];

function Cartridges() {
  const tracks = useCatalog().data?.tracks || [];
  return (
    <section className="ld-sec" id="practice">
      <div className="pf-wrap">
        <Reveal>
          <div className="ld-head">
            <div>
              <h2 className="ld-h2">Solve it the way you'll ship it.</h2>
              <p className="ld-lead">Write code in a real editor, run it against hidden test cases and get a verdict in seconds. Your first Accepted on each problem earns points.</p>
            </div>
            <a href="/practice" className="pf-btn pf-btn-ghost">All practice tracks</a>
          </div>
        </Reveal>
        <div className="ld-carts">
          {tracks.map((t, i) => {
            const live = t.status === 'live';
            return (
              <Reveal key={t.id} delay={(i % 4) * 70} style={{ height: '100%', display: 'flex' }}>
                <a href={`/practice/${t.id}`} className={`ld-cart${live ? '' : ' is-soon'}`} style={{ flex: 1 }}>
                  <div className="ld-cart-top">
                    <span className="ld-cart-icon" style={{ background: live ? CART_COLORS[i % CART_COLORS.length] : 'var(--surface)' }}>
                      <Icon name={t.icon} size={24} />
                    </span>
                    <span className={`pf-badge ${live ? 'pf-badge-live' : 'pf-badge-soon'}`}>{live ? 'Live' : 'Soon'}</span>
                  </div>
                  <div className="ld-cart-title">{t.title}</div>
                  <p>{t.blurb}</p>
                  <span className="ld-cart-go">{live ? 'Practice now' : 'Preview the format'}</span>
                </a>
              </Reveal>
            );
          })}
        </div>
        <Reveal delay={100}>
          <div className="ld-next">
            <span>More tracks on the way:</span>
            {UPCOMING_TRACKS.map((name) => <span key={name} className="pf-chip">{name}</span>)}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// --- Level map (how it works — a real sequence, so it is numbered) -------------------

const LEVELS = [
  { title: 'Learn in the right order', text: 'Structured courses take you from fundamentals to internals, one module at a time.', color: 'var(--lime)' },
  { title: 'Practice every skill', text: 'Each concept maps to coding problems you solve in-browser against test cases.', color: 'var(--sun)' },
  { title: 'Build real systems', text: 'Hackathons ask you to design pipelines and platforms end to end, with trade-offs.', color: 'var(--pink)' },
  { title: 'Walk in interview-ready', text: 'Company-style problems and system design rounds mean you have seen it before.', color: 'var(--periwinkle)' },
];

function LevelMap() {
  return (
    <section className="ld-sec">
      <div className="pf-wrap">
        <Reveal>
          <div className="ld-map">
            <h2 className="ld-h2">From “where do I start?” to interview-ready.</h2>
            <p className="ld-lead">Four levels. Each one unlocks the next.</p>
            <ol className="ld-levels">
              {LEVELS.map((l, i) => (
                <li key={l.title}>
                  <span className="ld-level-no" style={{ background: l.color }}>{i + 1}</span>
                  <h3>{l.title}</h3>
                  <p>{l.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// --- Courses preview ---------------------------------------------------------------

function CoursesPreview() {
  const courses = useCatalog().data?.courses || [];
  if (!courses.length) return null;
  return (
    <section className="ld-sec" id="learn">
      <div className="pf-wrap">
        <Reveal>
          <div className="ld-head">
            <div>
              <h2 className="ld-h2">Courses that go past the tutorial.</h2>
              <p className="ld-lead">Concepts, diagrams, real code and the trade-offs interviewers actually probe.</p>
            </div>
            <a href="/learn" className="pf-btn pf-btn-ghost">Browse all courses</a>
          </div>
        </Reveal>
        <div className="pf-grid pf-grid-4 pf-course-grid-4">
          {courses.map((c, i) => (
            <Reveal key={c.id} delay={i * 70} style={{ height: '100%' }}>
              <CourseCard course={c} step={i + 1} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// --- Contests + hackathon brief ----------------------------------------------------------

function RaceAndQuest() {
  return (
    <section className="ld-sec" id="hackathons">
      <div className="pf-wrap ld-duo">
        <Reveal style={{ display: 'flex' }}>
          <div className="ld-panel ld-race" style={{ flex: 1 }}>
            <h2>Race your friends.</h2>
            <p>Timed rounds of randomly drawn problems. Go solo, or invite friends by username or link and watch the scoreboard move live.</p>
            <div className="ld-board" aria-label="Example contest scoreboard">
              <div className="ld-board-head"><span>Friday SQL sprint</span><b>23:41 left</b></div>
              <div className="ld-board-row is-me"><span>1</span><span>you</span><span>3 / 4</span><span>70</span></div>
              <div className="ld-board-row"><span>2</span><span>a_friend</span><span>3 / 4</span><span>50</span></div>
              <div className="ld-board-row"><span>3</span><span>another_friend</span><span>2 / 4</span><span>30</span></div>
            </div>
            <a href="/contests" className="pf-btn pf-btn-lg" style={{ background: 'var(--ink)', color: '#fff' }}>Start a contest</a>
          </div>
        </Reveal>
        <Reveal delay={80} style={{ display: 'flex' }}>
          <div className="ld-panel ld-quest" style={{ flex: 1 }}>
            <span className="ld-quest-tag">Hackathon brief · coming soon</span>
            <h2>Design the pipeline. Defend the trade-offs.</h2>
            <dl className="ld-brief">
              <dt>Scenario</dt><dd>2M ride events an hour from mobile apps</dd>
              <dt>Deliver</dt><dd>Bronze, silver and gold layers with hourly KPIs</dd>
              <dt>Constraints</dt><dd>Late data up to 2h, idempotent reruns</dd>
              <dt>Judged on</dt><dd>Correctness, scalability, cost</dd>
            </dl>
            <a href="/practice#hackathons" className="pf-btn">See hackathons</a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// --- FAQ -------------------------------------------------------------------------------

const FAQS = [
  ['Who is this platform for?', 'Aspiring and working data engineers, analytics engineers and data analysts. Courses start from fundamentals; practice problems range from easy to interview-hard.'],
  ['Do I need to install anything?', 'No. The SQL, Python and PySpark editors run in your browser, so you can start solving immediately.'],
  ['How are coding problems graded?', 'Your output is compared against expected results for visible sample cases and hidden test cases. A problem is accepted only when every case passes.'],
  ['How do contests work?', 'Start a timed round of randomly drawn problems on your own or with friends. Standings update live as people submit.'],
  ['Which tracks are coming next?', `We are adding ${UPCOMING_TRACKS.join(', ')}, plus more courses and problems every week.`],
];

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section className="ld-sec" id="faq">
      <div className="pf-wrap ld-faq">
        <Reveal><h2 className="ld-h2">Questions, answered.</h2></Reveal>
        {FAQS.map(([q, a], i) => (
          <div key={q} className={`pf-faq-item${open === i ? ' is-open' : ''}`}>
            <button className="pf-faq-q" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
              <span>{q}</span><span aria-hidden="true">{open === i ? '−' : '+'}</span>
            </button>
            {open === i && <p className="pf-faq-a">{a}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

// --- CTA band --------------------------------------------------------------------------

function CtaBand() {
  return (
    <section>
      <div className="pf-wrap">
        <Reveal>
          <div className="pf-cta-band ld-cta">
            <span className="ld-cta-tag ld-cta-tag-a" aria-hidden="true">SELECT * FROM you;</span>
            <span className="ld-cta-tag ld-cta-tag-b" aria-hidden="true">first solve earns points</span>
            <h2>Your first problem is one click away.</h2>
            <p>{BRAND.description}</p>
            <div className="ld-ctas">
              <a href="/practice" className="pf-btn pf-btn-run pf-btn-lg">Start practicing</a>
              <a href="/learn" className="pf-btn pf-btn-ghost pf-btn-lg">Explore courses</a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
