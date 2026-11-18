import PracticeHub from './PracticeHub.jsx';
import TrackPage from './TrackPage.jsx';
import ProblemWorkspace from './ProblemWorkspace.jsx';

// /practice                   → hub (all tracks)                    (public)
// /practice/:track            → problem list / challenge preview    (public)
// /practice/:track/:problem   → editor workspace                    (signed in)
export default function PracticeRoutes({ path }) {
  const [, , trackId, problemId] = path.replace(/\/+$/, '').split('/');
  if (!trackId) return <PracticeHub />;
  if (!problemId) return <TrackPage trackId={trackId} />;
  return <ProblemWorkspace key={problemId} trackId={trackId} problemId={problemId} />;
}
