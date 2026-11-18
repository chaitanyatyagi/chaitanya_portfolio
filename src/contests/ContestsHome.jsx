import { useEffect, useMemo, useRef, useState } from 'react';
import { PlatformLayout, Icon } from '../platform/Shell.jsx';
import { RequireAuth } from '../auth/AuthContext.jsx';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { LoadState } from '../learn/components.jsx';
import { POOL_LABEL, TRACK_LABEL } from './useContest.js';

// /contests — create a contest (solo or with friends), answer invitations,
// and see your running and finished contests (docs §12).
export default function ContestsHome() {
  return (
    <RequireAuth>
      <PlatformLayout title="Contests">
        <header className="pf-page-head">
          <div className="pf-wrap">
            <div className="pf-kicker">Contests</div>
            <h1>Race the clock</h1>
            <p>
              Pick tracks, difficulty, how many questions and how long. We draw random problems — unsolved ones first if you like —
              and start the clock. Play solo, or invite friends by username and race on a live scoreboard. Ranked like LeetCode:
              more points first, then the fastest finish, with 5 minutes added for each wrong submission.
            </p>
          </div>
        </header>
        <div className="pf-wrap pf-contests">
          <CreateContest />
          <MyContests />
        </div>
      </PlatformLayout>
    </RequireAuth>
  );
}

const DIFFS = ['Easy', 'Medium', 'Hard'];
const toggle = (set, v) => { const n = new Set(set); if (n.has(v)) n.delete(v); else n.add(v); return n; };

function CreateContest() {
  const options = useApi('/contests/options');
  const [mode, setMode] = useState('solo');
  const [title, setTitle] = useState('');
  const [tracks, setTracks] = useState(() => new Set(['sql']));
  const [diffs, setDiffs] = useState(() => new Set(DIFFS));
  const [topics, setTopics] = useState(() => new Set());
  const [count, setCount] = useState(3);
  const [minutes, setMinutes] = useState(45);
  const [pool, setPool] = useState('both');
  const [invite, setInvite] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const all = options.data?.tracks || [];
  const limits = options.data?.limits;
  const chosen = all.filter((t) => tracks.has(t.id));
  // Upper bound shown in the form; the server checks topics exactly.
  const available = chosen.reduce((n, t) => n + [...diffs].reduce((m, d) => m + t.problems[d].total, 0), 0);
  const unsolvedAvail = chosen.reduce((n, t) => n + [...diffs].reduce((m, d) => m + t.problems[d].total - t.problems[d].solved, 0), 0);
  const maxCount = Math.max(1, Math.min(limits?.maxProblems ?? 8, available || 1));
  useEffect(() => { if (options.data && count > maxCount) setCount(maxCount); }, [options.data, count, maxCount]);
  // Drop topics that no longer belong to a chosen track.
  useEffect(() => {
    const allowed = new Set(chosen.flatMap((t) => t.topics.map((x) => x.name)));
    setTopics((s) => new Set([...s].filter((x) => allowed.has(x))));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks, options.data]);

  // A server error belongs to the request that caused it — clear it on any change.
  useEffect(() => { setError(null); }, [mode, tracks, diffs, topics, count, minutes, pool, invite]);
  // Say exactly why the form can't be submitted, before the server has to.
  const problem = !tracks.size ? 'Pick at least one track.'
    : !diffs.size ? 'Pick at least one difficulty.'
    : !available ? 'No problems match these tracks and difficulties — widen your selection.'
    : count > available ? `Only ${available} problem${available === 1 ? '' : 's'} match — lower the number of questions.`
    : mode === 'group' && invite.length > (limits?.maxPlayers ?? 10) - 1 ? 'Too many invitations.'
    : null;
  const submit = async (e) => {
    e.preventDefault();
    if (problem) { setError(problem); return; }
    setBusy(true);
    setError(null);
    try {
      const r = await api('/contests', {
        method: 'POST',
        body: {
          mode, title: title.trim() || undefined, tracks: [...tracks], difficulties: [...diffs], topics: [...topics],
          count, minutes, pool, invite: mode === 'group' ? invite : [],
        },
      });
      window.location.assign(`/contests/${r.contest.code}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <section className="pf-pcard pf-create">
      <h2 className="pf-ph2">Create a contest</h2>
      <LoadState loading={options.loading} error={options.error} label="Loading tracks…">
        <form onSubmit={submit}>
          <div className="pf-seg" role="radiogroup" aria-label="Who plays">
            {[['solo', 'Solo', 'Starts right away'], ['group', 'With friends', 'Invite people, start when ready']].map(([id, label, hint]) => (
              <button type="button" key={id} role="radio" aria-checked={mode === id} className={mode === id ? 'is-active' : ''} onClick={() => setMode(id)}>
                <b>{label}</b><span>{hint}</span>
              </button>
            ))}
          </div>

          <label className="pf-field"><span>Title <i className="pf-meta">optional</i></span>
            <input className="pf-input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80}
              placeholder={mode === 'solo' ? 'Solo contest' : 'e.g. Friday SQL sprint'} />
          </label>

          <div className="pf-field"><span>Tracks</span>
            <div className="pf-choice-row">
              {all.map((t) => (
                <button type="button" key={t.id} className={`pf-choice${tracks.has(t.id) ? ' is-on' : ''}`} aria-pressed={tracks.has(t.id)}
                  onClick={() => setTracks((s) => (s.has(t.id) && s.size === 1 ? s : toggle(s, t.id)))}>
                  <Icon name={t.icon} size={15} /> {t.title}
                  <i>{DIFFS.reduce((n, d) => n + t.problems[d].total, 0)}</i>
                </button>
              ))}
            </div>
          </div>

          <div className="pf-field"><span>Difficulty</span>
            <div className="pf-choice-row">
              {DIFFS.map((d) => {
                const n = chosen.reduce((m, t) => m + t.problems[d].total, 0);
                return (
                  <button type="button" key={d} className={`pf-choice pf-choice-${d.toLowerCase()}${diffs.has(d) ? ' is-on' : ''}`} aria-pressed={diffs.has(d)}
                    onClick={() => setDiffs((s) => (s.has(d) && s.size === 1 ? s : toggle(s, d)))}>
                    {d} <i>{n}</i>
                  </button>
                );
              })}
            </div>
          </div>

          <details className="pf-topics-pick">
            <summary>Topics <span className="pf-meta">{topics.size ? `${topics.size} selected` : 'any'}</span></summary>
            {chosen.map((t) => (
              <div key={t.id} className="pf-choice-row" style={{ marginTop: 10 }}>
                <span className="pf-side-label" style={{ width: '100%' }}>{t.title}</span>
                {t.topics.filter((x) => x.problems > 0).map((x) => (
                  <button type="button" key={x.name} className={`pf-choice pf-choice-sm${topics.has(x.name) ? ' is-on' : ''}`} aria-pressed={topics.has(x.name)}
                    onClick={() => setTopics((s) => toggle(s, x.name))}>
                    {x.name} <i>{x.problems}</i>
                  </button>
                ))}
              </div>
            ))}
          </details>

          <div className="pf-create-grid">
            <label className="pf-field"><span>Questions</span>
              <select className="pf-select" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {Array.from({ length: maxCount }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="pf-field"><span>Time</span>
              <select className="pf-select" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
                {[5, 10, 15, 20, 30, 45, 60, 90, 120, 180].map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`}</option>)}
              </select>
            </label>
            <label className="pf-field"><span>Problems</span>
              <select className="pf-select" value={pool} onChange={(e) => setPool(e.target.value)}>
                {[['both', 'Both'], ['unsolved', 'Unsolved only'], ['solved', 'Solved only']].map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
          </div>
          <p className="pf-meta pf-create-hint">
            Up to {available} problem{available === 1 ? '' : 's'} match{available === 1 ? 'es' : ''} these tracks and difficulties · {unsolvedAvail} unsolved by you
            {' '}· {POOL_LABEL[pool]}
            {mode === 'group' ? ' · "unsolved" is decided for everyone who has joined when the host starts' : ''}
          </p>

          {mode === 'group' && <InvitePicker value={invite} onChange={setInvite} max={(limits?.maxPlayers ?? 10) - 1} />}

          {(error || problem) && <div className="pf-form-error" role="alert">{error || problem}</div>}
          {pool === 'unsolved' && unsolvedAvail < count && unsolvedAvail < available && (
            <p className="pf-meta pf-create-hint">Only {unsolvedAvail} of these are unsolved by you — the rest will be filled with problems you've solved.</p>
          )}
          <button className="pf-btn pf-btn-primary" disabled={busy || Boolean(problem)}>
            {busy ? 'Creating…' : mode === 'solo' ? 'Start solo contest' : 'Create lobby'}
          </button>
        </form>
      </LoadState>
    </section>
  );
}

// Username chips + type-ahead (GET /api/users/search).
export function InvitePicker({ value, onChange, max = 9, label = 'Invite by username' }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const timer = useRef(null);
  useEffect(() => {
    clearTimeout(timer.current);
    const term = q.trim().toLowerCase();
    if (!term) { setResults([]); return undefined; }
    timer.current = setTimeout(() => {
      api(`/users/search?q=${encodeURIComponent(term)}`).then((r) => setResults(r.users)).catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(timer.current);
  }, [q]);
  const add = (username) => {
    const u = username.trim().toLowerCase().replace(/^@/, '');
    if (u && !value.includes(u) && value.length < max) onChange([...value, u]);
    setQ('');
    setResults([]);
  };
  return (
    <div className="pf-field">
      <span>{label} <i className="pf-meta">{value.length}/{max}</i></span>
      <div className="pf-invite">
        {value.map((u) => (
          <span key={u} className="pf-chip pf-chip-user">@{u}<button type="button" aria-label={`Remove ${u}`} onClick={() => onChange(value.filter((x) => x !== u))}>×</button></span>
        ))}
        <input className="pf-invite-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="@username"
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); if (q.trim()) add(results[0]?.username || q); } }} />
      </div>
      {results.length > 0 && (
        <div className="pf-suggest" role="listbox">
          {results.filter((r) => !value.includes(r.username)).map((r) => (
            <button type="button" key={r.username} role="option" aria-selected="false" onClick={() => add(r.username)}><b>@{r.username}</b> <span>{r.name}</span></button>
          ))}
        </div>
      )}
    </div>
  );
}

function MyContests() {
  const mine = useApi('/contests');
  const [busy, setBusy] = useState(null);
  const [flash, setFlash] = useState(null);
  const act = async (code, action) => {
    setBusy(code);
    setFlash(null);
    try {
      await api(`/contests/${code}/${action}`, { method: 'POST' });
      if (action === 'join') window.location.assign(`/contests/${code}`);
      else mine.reload();
    } catch (err) {
      setFlash(err.message);
      mine.reload();
    } finally {
      setBusy(null);
    }
  };

  const d = mine.data;
  return (
    <div className="pf-contest-lists">
      <LoadState loading={mine.loading && !d} error={mine.error} label="Loading your contests…">
        {flash && <div className="pf-form-error">{flash}</div>}
        {d?.invitations.length > 0 && (
          <section className="pf-pcard">
            <h2 className="pf-ph2">Invitations <span className="pf-badge pf-badge-live">{d.invitations.length}</span></h2>
            {d.invitations.map((c) => (
              <div key={c.code} className="pf-contest-row">
                <div className="pf-prow-title"><b>{c.title}</b><span>from @{c.host.username} · {c.problems} questions · {c.minutes} min · {c.players} joined</span></div>
                <div className="pf-row-actions">
                  <button className="pf-btn pf-btn-primary pf-btn-sm" disabled={busy === c.code} onClick={() => act(c.code, 'join')}>Join</button>
                  <button className="pf-btn pf-btn-ghost pf-btn-sm" disabled={busy === c.code} onClick={() => act(c.code, 'decline')}>Decline</button>
                </div>
              </div>
            ))}
          </section>
        )}
        <section className="pf-pcard">
          <h2 className="pf-ph2">Active</h2>
          {!d?.active.length && <p className="pf-meta">No running contests or lobbies.</p>}
          {d?.active.map((c) => <ContestRow key={c.code} c={c} />)}
        </section>
        <section className="pf-pcard">
          <h2 className="pf-ph2">Past contests</h2>
          {!d?.past.length && <p className="pf-meta">Finished contests and your rank in each appear here.</p>}
          {d?.past.map((c) => <ContestRow key={c.code} c={c} />)}
        </section>
      </LoadState>
    </div>
  );
}

function ContestRow({ c }) {
  const tracks = useMemo(() => c.settings.tracks.map((t) => TRACK_LABEL[t] || t).join(', '), [c.settings.tracks]);
  return (
    <a href={`/contests/${c.code}`} className="pf-contest-row">
      <div className="pf-prow-title">
        <b>{c.title}</b>
        <span>{c.mode === 'solo' ? 'Solo' : `${c.players} players · host @${c.host.username}`} · {tracks} · {c.problems} questions · {c.minutes} min</span>
      </div>
      <div className="pf-contest-row-right">
        {c.phase === 'lobby' && <span className="pf-badge pf-badge-soon">Lobby</span>}
        {c.phase === 'live' && <span className="pf-badge pf-badge-live">● Live</span>}
        {c.phase === 'ended' && (
          <>
            <span className="pf-meta">{c.solved}/{c.problems} solved · {c.score} pts</span>
            <b className="pf-contest-rank">{c.mode === 'solo' ? 'Solo' : `#${c.rank} / ${c.players}`}</b>
          </>
        )}
      </div>
    </a>
  );
}
