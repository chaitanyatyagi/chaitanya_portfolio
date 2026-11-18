import { PlatformLayout } from '../platform/Shell.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { useApi } from '../lib/useApi.js';
import { LoadState } from '../learn/components.jsx';

// /leaderboard — top learners by points (ties share a rank). GET /api/leaderboard
export default function Leaderboard() {
  const { user } = useAuth();
  const { data, loading, error } = useApi('/leaderboard');
  const leaders = data?.leaders || [];
  return (
    <PlatformLayout title="Leaderboard">
      <header className="pf-page-head">
        <div className="pf-wrap">
          <div className="pf-kicker">Leaderboard</div>
          <h1>Top learners</h1>
          <p>Ranked by points. Points are earned on the first Accepted submission of each problem: full on the first try, half on the second, a quarter on the third.</p>
        </div>
      </header>
      <LoadState loading={loading} error={error} label="Loading leaderboard…">
        <div className="pf-wrap" style={{ paddingTop: 32 }}>
          {leaders.length ? (
            <div className="pf-ptable pf-board">
              <div className="pf-prow pf-prow-head"><span>Rank</span><span>Learner</span><span>Solved</span><span>Points</span></div>
              {leaders.map((l) => (
                <a key={l.username} href={`/u/${l.username}`} className={`pf-prow${user?.username === l.username ? ' is-me' : ''}`}>
                  <span className={`pf-rank-no${l.rank <= 3 ? ` is-top${l.rank}` : ''}`}>#{l.rank}</span>
                  <span className="pf-prow-title"><b>{l.name}</b><span>@{l.username}</span></span>
                  <span className="pf-meta">{l.solved}</span>
                  <span><b>{l.points.toLocaleString()}</b></span>
                </a>
              ))}
            </div>
          ) : (
            <div className="pf-empty">No one has earned points yet — <a className="pf-link-arrow" href="/practice">be the first →</a></div>
          )}
        </div>
      </LoadState>
    </PlatformLayout>
  );
}
