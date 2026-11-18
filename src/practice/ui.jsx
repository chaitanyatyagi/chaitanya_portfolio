import { Icon } from '../platform/Shell.jsx';
import { useCatalog } from '../lib/useApi.js';

// Track tabs shared by the hub and every track page (tracks from /api/catalog).
export function PracticeTabs({ active }) {
  const { data } = useCatalog();
  const tracks = data?.tracks || [];
  return (
    <div className="pf-tabs-bar">
      <div className="pf-wrap">
        <nav className="pf-tabs" aria-label="Practice tracks">
          <a href="/practice" className={`pf-tab${active === 'overview' ? ' is-active' : ''}`}>Overview</a>
          {tracks.map((t) => (
            <a key={t.id} href={`/practice/${t.id}`} className={`pf-tab${active === t.id ? ' is-active' : ''}`}>
              <Icon name={t.icon} size={15} />
              {t.short}
              {t.status !== 'live' && <span className="pf-tab-soon">soon</span>}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}

export function Difficulty({ level }) {
  return <span className={`pf-diff pf-diff-${level.toLowerCase()}`}>{level}</span>;
}

export function StatusIcon({ status }) {
  if (status === 'solved') return <span className="pf-status is-solved" title="Solved">✓</span>;
  if (status === 'attempted') return <span className="pf-status is-attempted" title="Attempted">◐</span>;
  return <span className="pf-status" aria-hidden="true" />;
}

const cellText = (v) => (v === null || v === undefined ? null : typeof v === 'object' ? JSON.stringify(v) : String(v));

// Result-set table. `mark` (optional) is a Set of row indexes to flag red.
export function DataTable({ columns, rows, mark, total, caption }) {
  return (
    <div className="pf-dtable-wrap">
      {caption && <div className="pf-dtable-caption">{caption}</div>}
      <div className="pf-dtable-scroll">
        <table className="pf-dtable">
          <thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={columns.length} className="pf-dtable-empty">(no rows)</td></tr>
            ) : rows.map((r, i) => (
              <tr key={i} className={mark?.has(i) ? 'is-bad' : ''}>
                {r.map((v, j) => {
                  const text = cellText(v);
                  return <td key={j}>{text === null ? <span className="pf-null">NULL</span> : text}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > rows.length && <div className="pf-dtable-more">Showing {rows.length} of {total} rows</div>}
    </div>
  );
}

// Python values render as pretty JSON (Python's own repr would differ for
// True/None, so we label it as JSON-style).
export function ValueBlock({ value }) {
  return <pre className="pf-value">{JSON.stringify(value, null, 2)}</pre>;
}
