import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from './auth/AuthContext.jsx';
import './index.css';

// Tiny path-based routing (no router dependency). Each area is its own
// chunk, so the landing page doesn't download the editor or course reader.
//   /                       landing                            (public)
//   /learn[/…]              catalog → course → lesson          (lessons need sign-in)
//   /practice[/…]           hub → track → problem workspace    (workspace needs sign-in)
//   /login /signup /forgot-password /reset-password
//   /u/:username, /profile  public profile (own profile)   /leaderboard
//   /contests[/:code]       create / join / play contests       (sign-in)
//   /interview, /interview/case/:id   interview prep: case studies + tagged questions
//   /docs/:slug             internal docs, e.g. /docs/architecture (admins)
//   /guide/:slug            legacy links → redirected into /learn
//   /blog[/slug]            blog            /admin → legacy CMS admin
const Landing = lazy(() => import('./landing/Landing.jsx'));
const LearnRoutes = lazy(() => import('./learn/LearnRoutes.jsx'));
const PracticeRoutes = lazy(() => import('./practice/PracticeRoutes.jsx'));
const AuthPages = () => import('./auth/AuthPages.jsx');
const LoginPage = lazy(() => AuthPages().then((m) => ({ default: m.LoginPage })));
const SignupPage = lazy(() => AuthPages().then((m) => ({ default: m.SignupPage })));
const ForgotPasswordPage = lazy(() => AuthPages().then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => AuthPages().then((m) => ({ default: m.ResetPasswordPage })));
const DocsPage = lazy(() => import('./docs/DocsPage.jsx'));
const ProfilePage = lazy(() => import('./profile/ProfilePage.jsx'));
const Leaderboard = lazy(() => import('./profile/Leaderboard.jsx'));
const InterviewHome = lazy(() => import('./interview/InterviewHome.jsx'));
const CaseStudyPage = lazy(() => import('./interview/CaseStudyPage.jsx'));
const ContestsHome = lazy(() => import('./contests/ContestsHome.jsx'));
const ContestPage = lazy(() => import('./contests/ContestPage.jsx'));
const Admin = lazy(() => import('./admin/Admin.jsx'));
const Blog = lazy(() => import('./blog/Blog.jsx'));

const path = window.location.pathname;

// Old guide links: ask the API which course the module belongs to.
if (path.startsWith('/guide')) {
  const slug = path.split('/')[2] || '';
  fetch(`/api/modules/${encodeURIComponent(slug)}/locate`)
    .then((r) => (r.ok ? r.json() : null))
    .then((m) => window.location.replace(m ? `/learn/${m.courseId}/${m.slug}${window.location.hash}` : '/learn'))
    .catch(() => window.location.replace('/learn'));
}

const page = path.startsWith('/guide') ? null
  : path.startsWith('/admin') ? <Admin />
  : path.startsWith('/learn') ? <LearnRoutes path={path} />
  : path.startsWith('/practice') ? <PracticeRoutes path={path} />
  : path.startsWith('/docs') ? <DocsPage path={path} />
  : path.startsWith('/u/') || path === '/profile' ? <ProfilePage path={path} />
  : path.startsWith('/leaderboard') ? <Leaderboard />
  : /^\/contests\/[^/]+/.test(path) ? <ContestPage code={path.split('/')[2].toLowerCase()} />
  : path.startsWith('/contests') ? <ContestsHome />
  : /^\/interview\/case\/[^/]+/.test(path) ? <CaseStudyPage id={decodeURIComponent(path.split('/')[3])} />
  : path.startsWith('/interview') ? <InterviewHome />
  : path.startsWith('/login') ? <LoginPage />
  : path.startsWith('/signup') ? <SignupPage />
  : path.startsWith('/forgot-password') ? <ForgotPasswordPage />
  : path.startsWith('/reset-password') ? <ResetPasswordPage />
  : path.startsWith('/blog') ? <Blog />
  : <Landing />;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <Suspense fallback={null}>{page}</Suspense>
    </AuthProvider>
  </React.StrictMode>
);
