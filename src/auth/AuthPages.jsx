import { useEffect, useState } from 'react';
import { PlatformLayout } from '../platform/Shell.jsx';
import { api } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';

// /login, /signup, /forgot-password, /reset-password

// Only same-site paths are allowed as post-login destinations (no open redirects).
function nextPath() {
  const next = new URLSearchParams(window.location.search).get('next') || '/learn';
  return next.startsWith('/') && !next.startsWith('//') ? next : '/learn';
}

function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="pf-auth">
      <div className="pf-auth-card">
        <h1>{title}</h1>
        {subtitle && <p className="pf-auth-sub">{subtitle}</p>}
        {children}
      </div>
      {footer && <div className="pf-auth-foot">{footer}</div>}
    </div>
  );
}

function Field({ label, error, ...input }) {
  return (
    <label className="pf-field">
      <span>{label}</span>
      <input className="pf-input" {...input} />
      {error && <span className="pf-field-error">{error}</span>}
    </label>
  );
}

function useForm(initial) {
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const bind = (name) => ({ name, value: values[name], onChange: (e) => setValues((v) => ({ ...v, [name]: e.target.value })) });
  const submit = (fn) => async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try { await fn(values); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return { values, bind, busy, error, submit };
}

function RedirectIfSignedIn() {
  const { user, status } = useAuth();
  useEffect(() => { if (status === 'ready' && user) window.location.replace(nextPath()); }, [user, status]);
  return null;
}

export function LoginPage() {
  const { signIn } = useAuth();
  const f = useForm({ email: '', password: '' });
  const next = nextPath();
  return (
    <PlatformLayout title="Sign in" footer={false}>
      <RedirectIfSignedIn />
      <AuthCard
        title="Welcome back"
        subtitle={next !== '/learn' ? 'Sign in to continue where you were.' : 'Sign in to your account.'}
        footer={<>New here? <a href={`/signup?next=${encodeURIComponent(next)}`}>Create an account</a></>}
      >
        <form onSubmit={f.submit(async (v) => { await signIn(v.email, v.password); window.location.replace(next); })} noValidate>
          <Field label="Email" type="email" autoComplete="email" required autoFocus {...f.bind('email')} />
          <Field label="Password" type="password" autoComplete="current-password" required {...f.bind('password')} />
          {f.error && <div className="pf-form-error">{f.error}</div>}
          <button className="pf-btn pf-btn-primary pf-auth-btn" disabled={f.busy}>{f.busy ? 'Signing in…' : 'Sign in'}</button>
          <a className="pf-auth-link" href="/forgot-password">Forgot your password?</a>
        </form>
      </AuthCard>
    </PlatformLayout>
  );
}

export function SignupPage() {
  const { signUp } = useAuth();
  const f = useForm({ name: '', email: '', password: '' });
  const next = nextPath();
  return (
    <PlatformLayout title="Create account" footer={false}>
      <RedirectIfSignedIn />
      <AuthCard
        title="Create your account"
        subtitle="Free — get every course and the practice editor."
        footer={<>Already have an account? <a href={`/login?next=${encodeURIComponent(next)}`}>Sign in</a></>}
      >
        <form onSubmit={f.submit(async (v) => { await signUp(v.name, v.email, v.password); window.location.replace(next); })} noValidate>
          <Field label="Name" autoComplete="name" required autoFocus {...f.bind('name')} />
          <Field label="Email" type="email" autoComplete="email" required {...f.bind('email')} />
          <Field label="Password" type="password" autoComplete="new-password" required minLength={8} {...f.bind('password')} />
          <p className="pf-auth-hint">At least 8 characters.</p>
          {f.error && <div className="pf-form-error">{f.error}</div>}
          <button className="pf-btn pf-btn-primary pf-auth-btn" disabled={f.busy}>{f.busy ? 'Creating…' : 'Create account'}</button>
        </form>
      </AuthCard>
    </PlatformLayout>
  );
}

export function ForgotPasswordPage() {
  const f = useForm({ email: '' });
  const [sent, setSent] = useState(null);
  return (
    <PlatformLayout title="Reset password" footer={false}>
      <AuthCard title="Reset your password" subtitle="We'll email you a link to choose a new one." footer={<a href="/login">Back to sign in</a>}>
        {sent ? (
          <div className="pf-form-ok">{sent}</div>
        ) : (
          <form onSubmit={f.submit(async (v) => { const r = await api('/auth/forgot-password', { method: 'POST', body: { email: v.email } }); setSent(r.message); })} noValidate>
            <Field label="Email" type="email" autoComplete="email" required autoFocus {...f.bind('email')} />
            {f.error && <div className="pf-form-error">{f.error}</div>}
            <button className="pf-btn pf-btn-primary pf-auth-btn" disabled={f.busy}>{f.busy ? 'Sending…' : 'Send reset link'}</button>
          </form>
        )}
      </AuthCard>
    </PlatformLayout>
  );
}

export function ResetPasswordPage() {
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const f = useForm({ password: '' });
  const [done, setDone] = useState(null);
  return (
    <PlatformLayout title="Choose a new password" footer={false}>
      <AuthCard title="Choose a new password" footer={<a href="/login">Back to sign in</a>}>
        {done ? (
          <>
            <div className="pf-form-ok">{done}</div>
            <a className="pf-btn pf-btn-primary pf-auth-btn" href="/login">Sign in</a>
          </>
        ) : (
          <form onSubmit={f.submit(async (v) => { const r = await api('/auth/reset-password', { method: 'POST', body: { token, password: v.password } }); setDone(r.message); })} noValidate>
            <Field label="New password" type="password" autoComplete="new-password" required minLength={8} autoFocus {...f.bind('password')} />
            {!token && <div className="pf-form-error">This page needs the link from your email.</div>}
            {f.error && <div className="pf-form-error">{f.error}</div>}
            <button className="pf-btn pf-btn-primary pf-auth-btn" disabled={f.busy || !token}>{f.busy ? 'Saving…' : 'Update password'}</button>
          </form>
        )}
      </AuthCard>
    </PlatformLayout>
  );
}
