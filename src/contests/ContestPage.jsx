import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PlatformLayout, BrandMark, Icon } from '../platform/Shell.jsx';
import { RequireAuth } from '../auth/AuthContext.jsx';
import { api } from '../lib/api.js';
import { useApi, useCatalog } from '../lib/useApi.js';
import { LoadState } from '../learn/components.jsx';
import { Difficulty } from '../practice/ui.jsx';
import { ProblemView } from '../practice/ProblemWorkspace.jsx';
import { InvitePicker } from './ContestsHome.jsx';
import { useContest, useServerNow, fmtClock, TRACK_LABEL, POOL_LABEL } from './useContest.js';

// /contests/:code — one contest through its whole life (docs §12):
//   lobby  → players, invitations, invite link; host starts or cancels
//   live   → players: problem tabs + workspace + live standings; others: the board
//   ended  → final (or provisional, while grading catches up) standings
// Problems are lettered A, B, C… like a Codeforces round.
export const LETTERS = 'ABCDEFGH';
export default function ContestPage({ code }) {
  return (
    <RequireAuth>
      <ContestLoader code={code} />
    </RequireAuth>
  );
}

function ContestLoader({ code }) {
  const live = useContest(code);
  const wasPlaying = useRef(false);
  if (live.error?.status === 404) {
    return (
      <PlatformLayout title="Contest not found">
        <div className="pf-wrap pf-load-error">No contest with that link. <a className="pf-link-arrow" href="/contests">Your contests →</a></div>
      </PlatformLayout>
    );
  }
  if (!live.data) {
    return (
      <PlatformLayout title="Contest">
        <LoadState loading={live.loading} error={live.error} label="Loading contest…">{null}</LoadState>
      </PlatformLayout>
    );
  }
  const { contest, me } = live.data;
  if (contest.phase === 'live' && me?.state === 'joined') {
    wasPlaying.current = true;
    return <Arena live={live} />;
  }
  return <ContestInfo live={live} justEnded={wasPlaying.current && contest.phase === 'ended'} />;
}

// ---- lobby / spectator / results ------------------------------------------------------

function ContestInfo({ live, justEnded = false }) {
  const { data, refresh, offset } = live;
  const { contest, me } = data;
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [invites, setInvites] = useState([]);
  const [copied, setCopied] = useState(false);
  const now = useServerNow(offset, contest.phase === 'live');

  const act = async (action, body) => {
    setBusy(action);
    setError(null);
    try {
      await api(`/contests/${contest.code}/${action}`, { method: 'POST', body });
      if (action === 'invite') setInvites([]);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };
  const link = `${window.location.origin}/contests/${contest.code}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };

  const joined = me?.state === 'joined';
  const mine = data.standings.find((r) => r.isMe);
  return (
    <PlatformLayout title={contest.title}>
      {justEnded && mine && <TimeUpOverlay mine={mine} players={data.standings.length} solo={contest.mode === 'solo'} problems={data.problems.length} />}
      <header className="pf-page-head pf-contest-head">
        <div className="pf-wrap">
          <nav className="pf-crumbs" aria-label="Breadcrumb"><a href="/contests">Contests</a><span>/</span><span>{contest.title}</span></nav>
          <div className="pf-contest-title">
            <h1>{contest.title}</h1>
            <PhaseBadge phase={contest.phase} />
          </div>
          <SettingsLine contest={contest} problems={data.problems.length} />
          {contest.phase === 'live' && (
            <p className="pf-contest-clock">Ends in <b>{fmtClock(new Date(contest.endsAt).getTime() - now)}</b>{!joined && ' · you are not playing in this contest'}</p>
          )}
          {contest.phase === 'ended' && (
            <p className="pf-meta" style={{ marginTop: 10 }}>
              Ended {new Date(contest.endsAt).toLocaleString()} · ran {fmtClock(new Date(contest.endsAt) - new Date(contest.startedAt))}
              {data.provisional && ' · provisional: some submissions are still being graded'}
            </p>
          )}
        </div>
      </header>

      <div className="pf-wrap pf-contest-body">
        {error && <div className="pf-form-error">{error}</div>}

        {contest.phase === 'cancelled' && <div className="pf-empty">The host cancelled this contest. <a className="pf-link-arrow" href="/contests">Create your own →</a></div>}

        {contest.phase === 'lobby' && <SpecCards contest={contest} />}

        {contest.phase === 'lobby' && (
          <div className="pf-lobby">
            <section className="pf-pcard">
              <h2 className="pf-ph2">Waiting room <span className="pf-meta">{data.standings.length}/{contest.maxPlayers} players</span></h2>
              <div className="pf-seats">
                {data.standings.map((p) => (
                  <a key={p.username} href={`/u/${p.username}`} className={`pf-seat${p.isMe ? ' is-me' : ''}`}>
                    <span className="pf-player-avatar">{initialsOf(p.name)}</span>
                    <b>{p.name}</b>
                    <i>@{p.username}</i>
                    <em>{p.isHost ? 'Host' : 'Ready'}</em>
                  </a>
                ))}
                {Array.from({ length: Math.max(0, Math.min(3, contest.maxPlayers - data.standings.length)) }, (_, i) => (
                  <div key={`empty-${i}`} className="pf-seat is-empty"><span className="pf-player-avatar">+</span><b>Open seat</b><i>share the link</i></div>
                ))}
              </div>
              {data.invited.length > 0 && (
                <>
                  <div className="pf-side-label" style={{ margin: '18px 0 8px' }}>Invited</div>
                  {data.invited.map((p) => (
                    <div key={p.username} className="pf-meta" style={{ padding: '4px 0' }}>@{p.username} — {p.state === 'declined' ? 'declined' : 'waiting'}</div>
                  ))}
                </>
              )}
            </section>

            <section className="pf-pcard">
              {contest.isHost ? (
                <>
                  <h2 className="pf-ph2">Invite friends</h2>
                  <p className="pf-meta" style={{ marginTop: 0 }}>Anyone signed in with this link can join until you start.</p>
                  <div className="pf-copy-link">
                    <code>{link}</code>
                    <button className="pf-btn pf-btn-ghost pf-btn-sm" onClick={copy}>{copied ? 'Copied ✓' : 'Copy link'}</button>
                  </div>
                  <InvitePicker value={invites} onChange={setInvites} max={contest.maxPlayers - 1} label="Or invite by username" />
                  <button className="pf-btn pf-btn-ghost pf-btn-sm" disabled={!invites.length || busy} onClick={() => act('invite', { usernames: invites })}>
                    {busy === 'invite' ? 'Inviting…' : `Send ${invites.length || ''} invitation${invites.length === 1 ? '' : 's'}`}
                  </button>
                  <div className="pf-lobby-actions">
                    <button className="pf-btn pf-btn-primary" disabled={Boolean(busy)} onClick={() => act('start')}>
                      {busy === 'start' ? 'Starting…' : `Start contest · ${contest.minutes} min`}
                    </button>
                    <button className="pf-btn pf-btn-ghost pf-btn-sm" disabled={Boolean(busy)} onClick={() => act('cancel')}>Cancel contest</button>
                  </div>
                  <p className="pf-meta">Problems are drawn when you press Start, so "unsolved" counts for everyone who has joined by then. Invitations nobody accepted close at the start.</p>
                </>
              ) : joined ? (
                <>
                  <h2 className="pf-ph2">You're in</h2>
                  <p className="pf-lobby-wait"><span className="pf-pulse" /> Waiting for @{contest.host.username} to start. You'll be taken into the arena the moment it begins — keep this tab open.</p>
                  <button className="pf-btn pf-btn-ghost pf-btn-sm" disabled={Boolean(busy)} onClick={() => act('leave')}>Leave</button>
                </>
              ) : (
                <>
                  <h2 className="pf-ph2">{me?.state === 'invited' ? `@${contest.host.username} invited you` : 'Join this contest'}</h2>
                  <p className="pf-meta" style={{ marginTop: 0 }}>{contest.minutes} minutes · {contest.settings.count} questions. Join now — you can't join after it starts.</p>
                  <div className="pf-lobby-actions">
                    <button className="pf-btn pf-btn-primary" disabled={Boolean(busy)} onClick={() => act('join')}>{busy === 'join' ? 'Joining…' : 'Join contest'}</button>
                    {me?.state === 'invited' && <button className="pf-btn pf-btn-ghost pf-btn-sm" disabled={Boolean(busy)} onClick={() => act('decline')}>Decline</button>}
                  </div>
                </>
              )}
            </section>
          </div>
        )}

        {(contest.phase === 'live' || contest.phase === 'ended') && (
          <>
            {contest.selectionNote && <p className="pf-meta">{contest.selectionNote}</p>}
            {contest.phase === 'ended' && mine && <ResultHero mine={mine} players={data.standings.length} problems={data.problems.length} solo={contest.mode === 'solo'} provisional={data.provisional} />}
            {contest.phase === 'ended' && contest.mode === 'group' && <Podium standings={data.standings} />}
            <Board data={data} />
            {contest.phase === 'ended' && data.problems[0]?.id && (
              <section className="pf-pcard" style={{ marginTop: 20 }}>
                <h2 className="pf-ph2">Problems</h2>
                {data.problems.map((p, i) => (
                  <a key={p.id} className="pf-contest-row" href={`/practice/${p.track}/${p.id}`}>
                    <div className="pf-prow-title"><b>{LETTERS[i]}. {p.title}</b><span>{TRACK_LABEL[p.track]} · {p.points} points · solutions and editorials open in practice</span></div>
                    <Difficulty level={p.difficulty} />
                  </a>
                ))}
              </section>
            )}
            {contest.phase === 'ended' && (
              <p style={{ marginTop: 20 }}><a className="pf-link-arrow" href="/contests">Start another contest →</a></p>
            )}
          </>
        )}
      </div>
    </PlatformLayout>
  );
}

function PhaseBadge({ phase }) {
  const label = { lobby: 'Lobby', live: '● Live', ended: 'Finished', cancelled: 'Cancelled' }[phase];
  return <span className={`pf-badge ${phase === 'live' ? 'pf-badge-live' : 'pf-badge-soon'}`}>{label}</span>;
}

function SettingsLine({ contest, problems }) {
  const s = contest.settings;
  return (
    <p className="pf-contest-settings">
      {contest.mode === 'solo' ? 'Solo' : `Hosted by @${contest.host.username}`} · {s.tracks.map((t) => TRACK_LABEL[t] || t).join(', ')}
      {' '}· {s.difficulties.join('/')} · {problems || s.count} question{(problems || s.count) === 1 ? '' : 's'} · {contest.minutes} min
      {' '}· {POOL_LABEL[s.pool]}{s.topics.length ? ` · topics: ${s.topics.join(', ')}` : ''}
    </p>
  );
}

const initialsOf = (name) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

function SpecCards({ contest }) {
  const s = contest.settings;
  const cards = [
    ['Questions', s.count],
    ['Duration', `${contest.minutes} min`],
    ['Tracks', s.tracks.map((t) => TRACK_LABEL[t] || t).join(' · ')],
    ['Difficulty', s.difficulties.join(' · ')],
    ['Problems', POOL_LABEL[s.pool]],
    ['Scoring', `points, then time · +${contest.penaltyMinutes} min per wrong`],
  ];
  return (
    <dl className="pf-spec-cards">
      {cards.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
    </dl>
  );
}

function ResultHero({ mine, players, problems, solo, provisional }) {
  return (
    <section className="pf-result-hero">
      <div className="pf-result-rank">
        <span>{solo ? 'Solo result' : 'Your rank'}</span>
        <b>{solo ? `${mine.solved}/${problems}` : mine.score > 0 ? `#${mine.rank}` : '—'}</b>
        {!solo && <i>of {players}</i>}
      </div>
      <dl>
        <div><dt>Score</dt><dd>{mine.score}</dd></div>
        <div><dt>Solved</dt><dd>{mine.solved} / {problems}</dd></div>
        <div><dt>Finish</dt><dd>{mine.solved ? fmtClock(mine.finishMs) : '—'}</dd></div>
        <div><dt>Wrong tries</dt><dd>{mine.wrong}</dd></div>
      </dl>
      {provisional && <p className="pf-meta">Provisional — some submissions are still being graded.</p>}
    </section>
  );
}

function Podium({ standings }) {
  const top = standings.filter((r) => r.score > 0 && r.rank <= 3).slice(0, 3);
  if (!top.length) return null;
  const order = [top[1], top[0], top[2]].filter(Boolean); // 2nd · 1st · 3rd
  return (
    <div className="pf-podium" aria-label="Top three">
      {order.map((r) => (
        <a key={r.username} href={`/u/${r.username}`} className={`pf-podium-step is-${r.rank}`}>
          <span className="pf-player-avatar">{initialsOf(r.name)}</span>
          <b>{r.name}</b>
          <i>{r.score} pts · {fmtClock(r.finishMs)}</i>
          <span className="pf-podium-block">#{r.rank}</span>
        </a>
      ))}
    </div>
  );
}

function TimeUpOverlay({ mine, players, solo, problems }) {
  const [open, setOpen] = useState(true);
  useEffect(() => { const t = setTimeout(() => setOpen(false), 4500); return () => clearTimeout(t); }, []);
  if (!open) return null;
  return (
    <div className="pf-overlay" role="dialog" aria-label="Contest over" onClick={() => setOpen(false)}>
      <div className="pf-overlay-card">
        <Icon name="flag" size={28} />
        <h2>Time's up</h2>
        <p>{solo ? `You solved ${mine.solved} of ${problems}.` : mine.score > 0 ? `You finished #${mine.rank} of ${players} with ${mine.score} points.` : 'No solves this time — the editorials are open now.'}</p>
        <button className="pf-btn pf-btn-primary pf-btn-sm">See results</button>
      </div>
    </div>
  );
}

// ---- standings ---------------------------------------------------------------------------

export function Board({ data, compact = false }) {
  const { problems, standings, contest } = data;
  if (!standings.length) return <div className="pf-empty">No players.</div>;
  return (
    <div className={`pf-board-wrap${compact ? ' is-compact' : ''}`}>
      <table className="pf-board">
        <thead>
          <tr>
            <th>Rank</th><th className="pf-board-name">Player</th><th>Score</th><th title={`Last accepted submission + ${contest.penaltyMinutes} min per wrong submission on solved problems`}>Finish</th>
            {problems.map((p, i) => <th key={p.position} title={p.title || ''}>{LETTERS[i]}<i>{p.points}</i></th>)}
          </tr>
        </thead>
        <tbody>
          {standings.map((r) => (
            <tr key={r.username} className={r.isMe ? 'is-me' : ''}>
              <td className={`pf-rank-no${r.rank <= 3 && r.score > 0 ? ` is-top${r.rank}` : ''}`}>{r.score > 0 ? `#${r.rank}` : '—'}</td>
              <td className="pf-board-name"><a href={`/u/${r.username}`}><b>{r.name}</b><span>@{r.username}</span></a></td>
              <td><b>{r.score}</b></td>
              <td className="pf-mono">{r.solved ? fmtClock(r.finishMs) : '—'}</td>
              {r.cells.map((c, i) => (
                <td key={i} className={`pf-cell${c.solvedMs != null ? ' is-ac' : c.wrong ? ' is-wa' : ''}`}>
                  {c.solvedMs != null
                    ? <>{fmtClock(c.solvedMs)}{c.wrong > 0 && <i>(+{c.wrong})</i>}</>
                    : c.wrong > 0 ? <>−{c.wrong}</> : null}
                  {c.pending > 0 && <span className="pf-cell-pending" title="Being graded">…</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="pf-meta pf-board-legend">
        Ranked by score, then finish time. Green: solved at mm:ss after the start, (+n) wrong submissions before it, each adding {contest.penaltyMinutes} min. Red −n: wrong submissions, not solved yet. … being graded.
      </p>
    </div>
  );
}

// ---- live: the arena -------------------------------------------------------------------------

function Arena({ live }) {
  const { data, refresh, offset } = live;
  const { contest, problems, standings } = data;
  const [tab, setTab] = useState(() => {
    try { return sessionStorage.getItem(`dd-contest-tab:${contest.code}`) || problems[0]?.id; } catch { return problems[0]?.id; }
  });
  const pick = (t) => { setTab(t); try { sessionStorage.setItem(`dd-contest-tab:${contest.code}`, t); } catch { /* storage blocked */ } };
  const mine = standings.find((r) => r.isMe);
  const current = problems.find((p) => p.id === tab);

  // Toasts: who just solved what (diff of consecutive standings), time warnings.
  const [toasts, setToasts] = useState([]);
  const push = useCallback((tone, text) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((ts) => [...ts.slice(-3), { id, tone, text }]);
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 6000);
  }, []);
  const prev = useRef(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = standings;
    if (!before) return;
    for (const r of standings) {
      const old = before.find((b) => b.username === r.username);
      if (!old) continue;
      r.cells.forEach((c, i) => {
        if (c.solvedMs == null || old.cells[i]?.solvedMs != null) return;
        if (r.isMe) push('me', `You solved ${LETTERS[i]} · +${problems[i].points} · now #${r.rank} of ${standings.length}`);
        else push('other', `${r.name} solved ${LETTERS[i]} at ${fmtClock(c.solvedMs)}`);
      });
    }
  }, [standings, problems, push]);
  useEffect(() => {
    const end = new Date(contest.endsAt).getTime();
    const timers = [[5 * 60_000, '5 minutes left'], [60_000, '1 minute left — submit what you have']].map(([before, text]) => {
      const ms = end - before - (Date.now() + offset);
      return ms > 0 ? setTimeout(() => push('warn', text), ms) : null;
    });
    return () => timers.forEach((t) => t && clearTimeout(t));
  }, [contest.endsAt, offset, push]);

  // 3-2-1 when you enter a contest that has only just started.
  // (The initializer must stay side-effect free — StrictMode runs it twice —
  // so the "seen" flag is written in an effect.)
  const [intro, setIntro] = useState(() => {
    try { if (sessionStorage.getItem(`dd-contest-intro:${contest.code}`)) return 0; } catch { return 0; }
    return Date.now() + offset - new Date(contest.startedAt).getTime() < 60_000 ? 4 : 0;
  });
  useEffect(() => {
    try { sessionStorage.setItem(`dd-contest-intro:${contest.code}`, '1'); } catch { /* storage blocked */ }
  }, [contest.code]);
  useEffect(() => {
    if (!intro) return undefined;
    const t = setTimeout(() => setIntro((n) => n - 1), 800);
    return () => clearTimeout(t);
  }, [intro]);

  const bar = (
    <ArenaBar contest={contest} problems={problems} mine={mine} tab={current ? tab : 'board'} onPick={pick}
      offset={offset} rank={mine?.score > 0 ? mine.rank : null} players={standings.length} offline={live.offline} />
  );
  const extras = (
    <div className="pf-tokens">
      <div className="pf-toasts" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`pf-toast is-${t.tone}`}>{t.text}</div>)}
      </div>
      {intro > 0 && (
        <div className="pf-overlay pf-countdown" aria-live="assertive">
          <div>
            <span className="pf-meta">{contest.title} · {problems.length} problems · {contest.minutes} min</span>
            <b key={intro}>{intro > 1 ? intro - 1 : 'Go!'}</b>
          </div>
        </div>
      )}
    </div>
  );

  if (!current) {
    return (
      <PlatformLayout title={`Standings · ${contest.title}`} footer={false} nav={false}>
        <div className="pf-ws pf-ws-focus">
          {bar}
          <div className="pf-arena-board">
            {contest.selectionNote && <p className="pf-meta">{contest.selectionNote}</p>}
            <Board data={data} />
            {contest.isHost && <EndEarly code={contest.code} onDone={refresh} solo={contest.mode === 'solo'} />}
          </div>
        </div>
        {extras}
      </PlatformLayout>
    );
  }
  return (
    <>
      <ArenaProblem key={current.id} contest={contest} problem={current} index={problems.indexOf(current)} bar={bar} onSubmitted={refresh} />
      {extras}
    </>
  );
}

function ArenaProblem({ contest, problem, index, bar, onSubmitted }) {
  const { data, error, loading, setData } = useApi(`/problems/${problem.id}`);
  const catalog = useCatalog();
  const ctx = useMemo(() => ({
    id: contest.id, code: contest.code, title: contest.title, points: problem.points,
    penaltyMinutes: contest.penaltyMinutes, ended: false, bar, onSubmitted,
  }), [contest, problem.points, bar, onSubmitted]);
  if (!data) {
    return (
      <PlatformLayout title={`${LETTERS[index]} · ${contest.title}`} footer={false} nav={false}>
        <div className="pf-ws pf-ws-focus">{bar}<LoadState loading={loading || catalog.loading} error={error || catalog.error} label="Loading problem…">{null}</LoadState></div>
      </PlatformLayout>
    );
  }
  return <ProblemView data={data} setData={setData} track={catalog.data?.tracks.find((t) => t.id === problem.track) || { title: '' }} contest={ctx} />;
}

function ArenaBar({ contest, problems, mine, tab, onPick, offset, rank, players, offline }) {
  const now = useServerNow(offset);
  const start = new Date(contest.startedAt).getTime();
  const end = new Date(contest.endsAt).getTime();
  const left = end - now;
  const elapsed = Math.min(1, Math.max(0, (now - start) / Math.max(1, end - start)));
  const tone = left <= 60_000 ? 'is-critical' : left <= 5 * 60_000 ? 'is-low' : left <= 10 * 60_000 ? 'is-warn' : '';
  return (
    <header className={`pf-arena-top ${tone}`}>
      <a href="/contests" className="pf-arena-exit" title="Leave the arena — the contest keeps running"><BrandMark size={26} /></a>
      <div className="pf-arena-name">
        {offline
          ? <span className="pf-arena-live is-offline" title="Can't reach the server — retrying. Your code is kept on this device.">● Reconnecting…</span>
          : <span className="pf-arena-live">● Live</span>}
        <b title={contest.title}>{contest.title}</b>
      </div>
      <nav className="pf-arena-probs" role="tablist" aria-label="Problems">
        {problems.map((p, i) => {
          const cell = mine?.cells[i];
          const state = cell?.solvedMs != null ? 'is-ac' : cell?.pending ? 'is-pending' : cell?.wrong ? 'is-wa' : '';
          return (
            <button key={p.id} role="tab" aria-selected={tab === p.id} className={`pf-arena-prob ${state}${tab === p.id ? ' is-active' : ''}`}
              onClick={() => onPick(p.id)} title={`${p.title} · ${p.difficulty} · ${p.points} pts`}>
              <span className="pf-arena-letter">{state === 'is-ac' ? '✓' : LETTERS[i]}</span>
              <span className="pf-arena-pts">{p.points}</span>
            </button>
          );
        })}
        <button role="tab" aria-selected={tab === 'board'} className={`pf-arena-prob pf-arena-board-btn${tab === 'board' ? ' is-active' : ''}`} onClick={() => onPick('board')}>
          <Icon name="trophy" size={15} /> <span className="pf-hide-sm">Standings</span>
        </button>
      </nav>
      <div className="pf-arena-me" title="Your rank and score">
        <b>{rank ? `#${rank}` : '—'}</b><span>of {players}</span><span className="pf-arena-score">{mine?.score ?? 0} pts</span>
      </div>
      <div className="pf-arena-timer" role="timer" aria-label="Time left">
        <b>{left > 0 ? fmtClock(left) : "Time's up"}</b>
        <span>left</span>
      </div>
      <div className="pf-arena-progress" aria-hidden="true"><i style={{ width: `${elapsed * 100}%` }} /></div>
    </header>
  );
}

function EndEarly({ code, onDone, solo }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const end = async () => {
    setBusy(true);
    setError(null);
    try { await api(`/contests/${code}/end`, { method: 'POST' }); await onDone(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <div style={{ marginTop: 20 }}>
      {confirm ? (
        <span className="pf-confirm">
          {solo ? 'Finish now? Your result is final.' : 'End the contest for everyone now?'}
          <button className="pf-text-btn" disabled={busy} onClick={end}>{busy ? 'Ending…' : 'End contest'}</button>
          <button className="pf-text-btn" style={{ color: 'var(--muted)' }} onClick={() => setConfirm(false)}>Cancel</button>
        </span>
      ) : (
        <button className="pf-btn pf-btn-ghost pf-btn-sm" onClick={() => setConfirm(true)}>{solo ? 'Finish early' : 'End contest now'}</button>
      )}
      {error && <div className="pf-form-error" style={{ marginTop: 10 }}>{error}</div>}
    </div>
  );
}
