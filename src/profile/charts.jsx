import { useMemo, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Profile charts (hand-built SVG, no chart library):
//   ActivityCalendar  GitHub-style year heatmap — sequential one-hue ramp
//   PointsChart       cumulative points (Codeforces rating-graph analogue)
//   SolvedRing        headline "solved / total" ring
// Every chart has a hover tooltip and a text/table alternative.
// ---------------------------------------------------------------------------

const DAY = 86_400_000;
const parseDay = (s) => new Date(`${s}T00:00:00Z`);
const fmtDay = (d) => d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Sequential ramp on the dark surface: empty → bright (validated monotonic,
// each step ≥ 1.5× contrast over the previous one — see docs §11).
const LEVELS = ['var(--heat-0)', 'var(--heat-1)', 'var(--heat-2)', 'var(--heat-3)', 'var(--heat-4)'];
const levelFor = (n, max) => (n <= 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((n / Math.max(max, 1)) * 4))));

function useTooltip() {
  const [tip, setTip] = useState(null);
  const ref = useRef(null);
  const show = (e, text) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, text });
  };
  return { ref, tip, show, hide: () => setTip(null) };
}

const Tooltip = ({ tip }) => (tip ? <div className="pf-tooltip" style={{ left: tip.x, top: tip.y }}>{tip.text}</div> : null);

export function ActivityCalendar({ days, today }) {
  const t = useTooltip();
  const { weeks, months, max } = useMemo(() => {
    const counts = new Map(days.map((d) => [d.date, d.count]));
    const end = parseDay(today);
    const start = new Date(end.getTime() - 364 * DAY);
    start.setUTCDate(start.getUTCDate() - start.getUTCDay()); // back to Sunday
    const cols = [];
    const monthLabels = [];
    for (let w = 0, d = new Date(start); d <= end; w++) {
      const col = [];
      for (let i = 0; i < 7; i++, d = new Date(d.getTime() + DAY)) {
        const key = d.toISOString().slice(0, 10);
        col.push(d > end ? null : { key, date: new Date(d), count: counts.get(key) || 0 });
        if (d.getUTCDate() === 1 && d <= end) monthLabels.push({ w, label: MONTHS[d.getUTCMonth()] });
      }
      cols.push(col);
    }
    return { weeks: cols, months: monthLabels, max: Math.max(0, ...days.map((d) => d.count)) };
  }, [days, today]);

  const CELL = 11;
  const GAP = 3;
  const LEFT = 26;
  const TOP = 16;
  const width = LEFT + weeks.length * (CELL + GAP);
  const height = TOP + 7 * (CELL + GAP);

  return (
    <div className="pf-chart" ref={t.ref} onMouseLeave={t.hide}>
      <div className="pf-cal-scroll">
        <svg viewBox={`0 0 ${width} ${height}`} className="pf-cal-svg" role="img" aria-label={`Submission activity over the past year: ${days.reduce((n, d) => n + d.count, 0)} submissions`}>
          {months.map((m) => (
            <text key={`${m.w}-${m.label}`} x={LEFT + m.w * (CELL + GAP)} y={10} className="pf-axis-text">{m.label}</text>
          ))}
          {['Mon', 'Wed', 'Fri'].map((label, i) => (
            <text key={label} x={0} y={TOP + (1 + i * 2) * (CELL + GAP) + CELL - 2} className="pf-axis-text">{label}</text>
          ))}
          {weeks.map((col, w) => col.map((cell, d) => cell && (
            <rect
              key={cell.key}
              x={LEFT + w * (CELL + GAP)} y={TOP + d * (CELL + GAP)}
              width={CELL} height={CELL} rx={2.5}
              fill={LEVELS[levelFor(cell.count, max)]}
              onMouseMove={(e) => t.show(e, `${cell.count ? `${cell.count} submission${cell.count === 1 ? '' : 's'}` : 'No submissions'} on ${fmtDay(cell.date)}`)}
            />
          )))}
        </svg>
      </div>
      <div className="pf-cal-legend" aria-hidden="true">
        <span>Less</span>
        {LEVELS.map((c) => <i key={c} style={{ background: c }} />)}
        <span>More</span>
      </div>
      <Tooltip tip={t.tip} />
    </div>
  );
}

export function PointsChart({ timeline, today }) {
  const t = useTooltip();
  const [hover, setHover] = useState(null);
  const W = 640;
  const H = 200;
  const PAD = { l: 40, r: 16, t: 14, b: 26 };

  const model = useMemo(() => {
    if (!timeline.length) return null;
    const last = Math.max(parseDay(today).getTime(), parseDay(timeline.at(-1).date).getTime());
    // At least a 30-day window, so a brand-new profile's solves aren't squashed against the edge.
    const first = Math.min(parseDay(timeline[0].date).getTime() - DAY, last - 30 * DAY);
    const maxY = Math.max(10, ...timeline.map((p) => p.cumulative));
    const niceMax = Math.ceil(maxY / 10 ** Math.floor(Math.log10(maxY)) * 2) / 2 * 10 ** Math.floor(Math.log10(maxY));
    const x = (ms) => PAD.l + ((ms - first) / Math.max(last - first, DAY)) * (W - PAD.l - PAD.r);
    const y = (v) => H - PAD.b - (v / niceMax) * (H - PAD.t - PAD.b);
    // Step line: points only change when a problem is solved.
    const pts = [{ ms: first, v: 0 }];
    for (const p of timeline) pts.push({ ms: parseDay(p.date).getTime(), v: p.cumulative, p });
    pts.push({ ms: last, v: timeline.at(-1).cumulative });
    let d = `M${x(pts[0].ms)},${y(0)}`;
    for (let i = 1; i < pts.length; i++) d += ` H${x(pts[i].ms)} V${y(pts[i].v)}`;
    const ticks = [0, niceMax / 2, niceMax].map((v) => Math.round(v));
    return { pts, d, x, y, ticks, first, last };
  }, [timeline, today]);

  if (!model) return <div className="pf-empty-chart">Solve a problem to start your points history.</div>;
  const solves = model.pts.filter((p) => p.p);

  const onMove = (e) => {
    const svg = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - svg.left) / svg.width) * W;
    let best = solves[0];
    for (const s of solves) if (Math.abs(model.x(s.ms) - px) < Math.abs(model.x(best.ms) - px)) best = s;
    setHover(best);
    t.show(e, `${fmtDay(new Date(best.ms))} — ${best.p.problem}: +${best.p.points} → ${best.v} pts`);
  };

  return (
    <div className="pf-chart" ref={t.ref}>
      <svg viewBox={`0 0 ${W} ${H}`} className="pf-line-chart" role="img"
        aria-label={`Points over time, from 0 to ${timeline.at(-1).cumulative}`}
        onMouseMove={onMove} onMouseLeave={() => { setHover(null); t.hide(); }}>
        {model.ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={model.y(v)} y2={model.y(v)} className="pf-grid-line" />
            <text x={PAD.l - 8} y={model.y(v) + 4} textAnchor="end" className="pf-axis-text">{v.toLocaleString()}</text>
          </g>
        ))}
        <text x={PAD.l} y={H - 6} className="pf-axis-text">{fmtDay(new Date(model.first)).replace(/^\w+, /, '')}</text>
        <text x={W - PAD.r} y={H - 6} textAnchor="end" className="pf-axis-text">Today</text>
        <path d={`${model.d} V${model.y(0)} H${model.x(model.first)} Z`} className="pf-area" />
        <path d={model.d} className="pf-line" />
        {hover && <line x1={model.x(hover.ms)} x2={model.x(hover.ms)} y1={PAD.t} y2={H - PAD.b} className="pf-crosshair" />}
        {solves.map((s) => (
          <circle key={s.ms + s.p.problemId} cx={model.x(s.ms)} cy={model.y(s.v)} r={hover === s ? 6 : 4} className="pf-dot" />
        ))}
        <text x={model.x(model.pts.at(-1).ms) - 8} y={model.y(model.pts.at(-1).v) + (model.y(model.pts.at(-1).v) < PAD.t + 18 ? 18 : -10)} textAnchor="end" className="pf-end-label">
          {model.pts.at(-1).v} pts
        </text>
      </svg>
      <Tooltip tip={t.tip} />
      <details className="pf-chart-table">
        <summary>Show as table</summary>
        <table>
          <thead><tr><th>Date</th><th>Problem</th><th>Points</th><th>Total</th></tr></thead>
          <tbody>{timeline.map((p) => <tr key={p.problemId}><td>{p.date}</td><td>{p.problem}</td><td>+{p.points}</td><td>{p.cumulative}</td></tr>)}</tbody>
        </table>
      </details>
    </div>
  );
}

export function SolvedRing({ solved, total }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const frac = total ? solved / total : 0;
  return (
    <svg width="132" height="132" viewBox="0 0 132 132" role="img" aria-label={`${solved} of ${total} problems solved`}>
      <circle cx="66" cy="66" r={R} className="pf-ring-track" />
      <circle cx="66" cy="66" r={R} className="pf-ring-fill" strokeDasharray={`${C * frac} ${C}`} transform="rotate(-90 66 66)" />
      <text x="66" y="64" textAnchor="middle" className="pf-ring-value">{solved}</text>
      <text x="66" y="84" textAnchor="middle" className="pf-ring-label">/ {total} solved</text>
    </svg>
  );
}
