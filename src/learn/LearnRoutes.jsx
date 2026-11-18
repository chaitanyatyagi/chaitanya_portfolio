import LearnCatalog from './LearnCatalog.jsx';
import CourseDetail from './CourseDetail.jsx';
import ModuleReader from './ModuleReader.jsx';

// /learn                     → catalog                       (public)
// /learn/:course             → outline + your progress       (public)
// /learn/:course/:module     → lesson content                (signed in)
export default function LearnRoutes({ path }) {
  const [, , courseId, moduleSlug] = path.replace(/\/+$/, '').split('/');
  if (!courseId) return <LearnCatalog />;
  if (!moduleSlug) return <CourseDetail courseId={courseId} />;
  return <ModuleReader key={moduleSlug} courseId={courseId} slug={moduleSlug} />;
}
