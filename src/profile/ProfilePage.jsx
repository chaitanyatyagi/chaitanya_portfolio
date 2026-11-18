import { useEffect, useMemo, useState } from 'react';
import { PlatformLayout, Icon } from '../platform/Shell.jsx';
import { useAuth, RequireAuth } from '../auth/AuthContext.jsx';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { LoadState, ProgressBar } from '../learn/components.jsx';
import { Difficulty } from '../practice/ui.jsx';
import { ActivityCalendar, PointsChart, SolvedRing } from './charts.jsx';
import { fmtClock } from '../contests/useContest.js';

// ---------------------------------------------------------------------------
// /u/:username — public profile (LeetCode / Codeforces / GitHub inspired).
// /profile     — redirects to your own.
// Data: GET /api/users/:username/profile?tz=<browser zone>
// ---------------------------------------------------------------------------

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const TRACK_ICONS = { sql: 'sql', python: 'python', pyspark: 'spark', pandas: 'pandas', shell: 'terminal' };
const ago = (iso) => {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 30 * 86400) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString();
};
const initials = (name) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

function EditProfile({ user, onSaved, onCancel }) {
  const [form, setForm] = useState({ name: user.name, username: user.username, headline: user.headline || '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api('/auth/me', { method: 'PATCH', body: form });
      onSaved(r.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const bind = (k) => ({ value: form[k], onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) });
  return (
    <form className="pf-edit" onSubmit={save}>
      <label className="pf-field"><span>Name</span><input className="pf-input" {...bind('name')} maxLength={80} /></label>
      <label className="pf-field"><span>Username</span><input className="pf-input" {...bind('username')} maxLength={24} /></label>
      <label className="pf-field"><span>Headline</span><input className="pf-input" {...bind('headline')} maxLength={80} placeholder="e.g. Data Engineer at Acme" /></label>
      {error && <div className="pf-form-error">{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="pf-btn pf-btn-primary pf-btn-sm" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" className="pf-btn pf-btn-ghost pf-btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function IdentityCard({ data, onUserChange }) {
  const { user, stats } = data;
  const [editing, setEditing] = useState(false);
  return (
    <section className="pf-pcard">
      <div className="pf-pavatar">{initials(user.name)}</div>
      {editing ? (
        <EditProfile
          user={user}
          onCancel={() => setEditing(false)}
          onSaved={(u) => { setEditing(false); onUserChange(u); }}
        />
      ) : (
        <>
          <h1 className="pf-pname">{user.name}</h1>
          <div className="pf-meta">@{user.username}</div>
          {user.headline && <p className="pf-pheadline">{user.headline}</p>}
          <div className="pf-prank">
            <div><span className="pf-meta">Rank</span><b>{stats.rank ? `#${stats.rank.toLocaleString()}` : 'Unranked'}</b></div>
            <div><span className="pf-meta">Points</span><b>{stats.points.toLocaleString()}</b></div>
          </div>
          <div className="pf-meta" style={{ marginTop: 12 }}>Joined {new Date(user.joinedAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</div>
          {user.isMe && <button className="pf-btn pf-btn-ghost pf-btn-sm" style={{ marginTop: 14, width: '100%', justifyContent: 'center' }} onClick={() => setEditing(true)}>Edit profile</button>}
        </>
      )}
    </section>
  );
}

function Badges({ badges }) {
  const earned = badges.filter((b) => b.earned);
  return (
    <section className="pf-pcard">
      <h2 className="pf-ph2">Badges <span className="pf-meta">{earned.length}/{badges.length}</span></h2>
      <div className="pf-badges">
        {badges.map((b) => (
          <div key={b.id} className={`pf-badge-item${b.earned ? ' is-earned' : ''}`} title={`${b.name} — ${b.description}${b.earned ? '' : ' (locked)'}`}>
            <span className="pf-badge-icon" aria-hidden="true">{b.earned ? '★' : '☆'}</span>
            <span><b>{b.name}</b><span>{b.description}</span></span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Skills({ skills }) {
  const byTrack = useMemo(() => {
    const m = {};
    for (const s of skills.topics) (m[s.track] ||= []).push(s);
    return m;
  }, [skills]);
  return (
    <section className="pf-pcard">
      <h2 className="pf-ph2">Skills</h2>
      {!skills.topics.length && <p className="pf-meta">Skills appear as you solve problems.</p>}
      {Object.entries(byTrack).map(([track, list]) => (
        <div key={track} className="pf-skill-group">
          <div className="pf-side-label" style={{ margin: '12px 0 6px' }}>{track}</div>
          {list.map((s) => <span key={s.name} className="pf-chip">{s.name} <b>×{s.count}</b></span>)}
        </div>
      ))}
      {skills.patterns.length > 0 && (
        <div className="pf-skill-group">
          <div className="pf-side-label" style={{ margin: '12px 0 6px' }}>Patterns</div>
          {skills.patterns.map((p) => <span key={p.name} className="pf-chip pf-chip-pattern">{p.name} <b>×{p.count}</b></span>)}
        </div>
      )}
    </section>
  );
}

function StatTiles({ stats, calendar }) {
  const tiles = [
    ['Points', stats.points.toLocaleString()],
    ['Global rank', stats.rank ? `#${stats.rank.toLocaleString()}` : '—', stats.rank ? `of ${stats.totalUsers.toLocaleString()} learners` : 'solve a problem to rank'],
    ['Acceptance', stats.acceptance != null ? `${stats.acceptance}%` : '—', `${stats.accepted}/${stats.submissions} submissions`],
    ['First-try solves', stats.firstTry],
    ['Current streak', `${calendar.currentStreak} day${calendar.currentStreak === 1 ? '' : 's'}`],
    ['Longest streak', `${calendar.maxStreak} day${calendar.maxStreak === 1 ? '' : 's'}`],
  ];
  return (
    <div className="pf-tiles">
      {tiles.map(([label, value, sub]) => (
        <div key={label} className="pf-tile"><span>{label}</span><b>{value}</b>{sub && <small>{sub}</small>}</div>
      ))}
    </div>
  );
}

function SolvedCard({ stats }) {
  return (
    <section className="pf-pcard pf-solved">
      <SolvedRing solved={stats.solved.total} total={stats.available.total} />
      <div className="pf-solved-bars">
        {['Easy', 'Medium', 'Hard'].map((d) => (
          <div key={d} className="pf-solved-row">
            <div className="pf-solved-head"><Difficulty level={d} /><span className="pf-meta"><b>{stats.solved[d]}</b> / {stats.available[d]}</span></div>
            <div className={`pf-progress pf-progress-${d.toLowerCase()}`}><span style={{ width: `${stats.available[d] ? (stats.solved[d] / stats.available[d]) * 100 : 0}%` }} /></div>
          </div>
        ))}
        <div className="pf-meta">{stats.attempting} attempting</div>
      </div>
    </section>
  );
}

function TrackCard({ byTrack }) {
  return (
    <section className="pf-pcard">
      <h2 className="pf-ph2">Tracks</h2>
      <div className="pf-trackbars">
        {byTrack.map((t) => (
          <a key={t.id} href={`/practice/${t.id}`} className="pf-trackbar">
            <span className="pf-trackbar-name"><Icon name={TRACK_ICONS[t.id] || 'code'} size={15} /> {t.title}</span>
            <ProgressBar pct={t.total ? (t.solved / t.total) * 100 : 0} style={{ flex: 1 }} />
            <span className="pf-meta">{t.solved}/{t.total} · {t.points} pts</span>
          </a>
        ))}
      </div>
    </section>
  );
}

function Activity({ data }) {
  const [tab, setTab] = useState('accepted');
  const { recentAccepted, recentSubmissions, user } = data;
  return (
    <section className="pf-pcard">
      <div className="pf-ws-tabs pf-ptabs">
        <button className={tab === 'accepted' ? 'is-active' : ''} onClick={() => setTab('accepted')}>Recent solves</button>
        {user.isMe && <button className={tab === 'all' ? 'is-active' : ''} onClick={() => setTab('all')}>My submissions</button>}
      </div>
      {tab === 'accepted' ? (
        recentAccepted.length ? (
          <ul className="pf-activity">
            {recentAccepted.map((r) => (
              <li key={r.problemId}>
                <a href={`/practice/${r.track}/${r.problemId}`}><b>{r.title}</b></a>
                <span className="pf-chip">{r.track}</span>
                <Difficulty level={r.difficulty} />
                <span className="pf-meta">+{r.points} pts · {ago(r.at)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="pf-meta" style={{ padding: '12px 0' }}>No solved problems yet.</p>
      ) : (
        <ul className="pf-activity">
          {recentSubmissions.map((s) => (
            <li key={s.id}>
              <a href={`/practice/${s.track}/${s.problemId}`}><b>{s.title}</b></a>
              <span className={`pf-verdict-text is-${s.verdict === 'Accepted' ? 'good' : s.verdict ? 'bad' : 'pending'}`}>{s.verdict || (s.status === 'queued' ? 'Queued' : 'Grading…')}</span>
              <span className="pf-meta">{s.total != null ? `${s.passed}/${s.total}` : ''}{s.attempt ? ` · try ${s.attempt}` : ''}{s.points ? ` · +${s.points}` : ''} · {ago(s.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Learning({ learning }) {
  return (
    <section className="pf-pcard">
      <h2 className="pf-ph2">Learning <span className="pf-meta">{learning.modulesCompleted} modules completed</span></h2>
      <div className="pf-trackbars">
        {learning.courses.map((c) => (
          <a key={c.id} href={`/learn/${c.id}`} className="pf-trackbar">
            <span className="pf-trackbar-name">{c.title}</span>
            <ProgressBar pct={c.total ? (c.done / c.total) * 100 : 0} style={{ flex: 1 }} />
            <span className="pf-meta">{c.done}/{c.total}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

// Contest record — separate from practice points (docs §12.4).
function Contests({ contests }) {
  return (
    <section className="pf-pcard">
      <h2 className="pf-ph2"><span>Contests</span><a className="pf-link-arrow" href="/contests">Contests →</a></h2>
      <div className="pf-contest-stats">
        <div><span className="pf-meta">Played</span><b>{contests.played}</b></div>
        <div><span className="pf-meta">Contest score</span><b>{contests.score.toLocaleString()}</b></div>
        <div><span className="pf-meta">Wins</span><b>{contests.wins}</b></div>
        <div><span className="pf-meta">Best rank</span><b>{contests.bestRank ? `#${contests.bestRank}` : '—'}</b></div>
      </div>
      {!contests.recent.length && <p className="pf-meta">Finished contests appear here with their rank and score.</p>}
      {contests.recent.map((c) => (
        <a key={c.code} href={`/contests/${c.code}`} className="pf-contest-row">
          <div className="pf-prow-title">
            <b>{c.title}</b>
            <span>{c.mode === 'solo' ? 'Solo' : `${c.players} players`} · {new Date(c.endedAt).toLocaleDateString()} · {c.solved}/{c.problems} solved{c.solved ? ` · finish ${fmtClock(c.finishMs)}` : ''}</span>
          </div>
          <div className="pf-contest-row-right">
            <span className="pf-meta">{c.score} pts</span>
            <b className="pf-contest-rank">{c.mode === 'solo' ? 'Solo' : `#${c.rank} / ${c.players}`}</b>
          </div>
        </a>
      ))}
    </section>
  );
}

function ProfileView({ username }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const { setUser } = useAuth();
  useEffect(() => {
    api(`/users/${encodeURIComponent(username)}/profile?tz=${encodeURIComponent(TZ)}`).then(setData).catch(setError);
  }, [username]);

  if (error?.status === 404) {
    return <PlatformLayout title="Profile"><div className="pf-wrap pf-load-error">No learner with the username “{username}”. <a className="pf-link-arrow" href="/leaderboard">Leaderboard →</a></div></PlatformLayout>;
  }
  const onUserChange = (u) => {
    setUser(u);
    if (u.username !== data.user.username) window.history.replaceState({}, '', `/u/${u.username}`);
    setData((d) => ({ ...d, user: { ...d.user, name: u.name, username: u.username, headline: u.headline } }));
  };

  return (
    <PlatformLayout title={data ? `${data.user.name} (@${data.user.username})` : 'Profile'}>
      <LoadState loading={!data && !error} error={error} label="Loading profile…">
        {data && (
          <div className="pf-wrap pf-profile">
            <aside className="pf-profile-side">
              <IdentityCard data={data} onUserChange={onUserChange} />
              <Badges badges={data.badges} />
              <Skills skills={data.skills} />
            </aside>
            <main className="pf-profile-main">
              <StatTiles stats={data.stats} calendar={data.calendar} />
              <div className="pf-profile-row">
                <SolvedCard stats={data.stats} />
                <TrackCard byTrack={data.byTrack} />
              </div>
              <section className="pf-pcard">
                <h2 className="pf-ph2">
                  <span><b>{data.calendar.total}</b> submissions in the past year</span>
                  <span className="pf-meta">Active days {data.calendar.activeDays} · Max streak {data.calendar.maxStreak} · {data.calendar.timezone}</span>
                </h2>
                <ActivityCalendar days={data.calendar.days} today={data.calendar.today} />
              </section>
              <section className="pf-pcard">
                <h2 className="pf-ph2"><span>Points over time</span><span className="pf-meta">{data.stats.points} total</span></h2>
                <PointsChart timeline={data.pointsTimeline} today={data.calendar.today} />
              </section>
              <Contests contests={data.contests} />
              <Activity data={data} />
              <Learning learning={data.learning} />
            </main>
          </div>
        )}
      </LoadState>
    </PlatformLayout>
  );
}

function OwnProfileRedirect() {
  const { user } = useAuth();
  useEffect(() => { if (user) window.location.replace(`/u/${user.username}`); }, [user]);
  return null;
}

export default function ProfilePage({ path }) {
  const parts = path.replace(/\/+$/, '').split('/');
  if (parts[1] === 'profile') return <RequireAuth><OwnProfileRedirect /></RequireAuth>;
  return <ProfileView key={parts[2]} username={decodeURIComponent(parts[2] || '')} />;
}
