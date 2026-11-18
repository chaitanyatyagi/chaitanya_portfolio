import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, invalidate } from '../lib/api.js';

// ---------------------------------------------------------------------------
// Who is signed in. On load we ask /auth/me (the API client transparently
// refreshes an expired access token). The session itself lives in httpOnly
// cookies — this context only mirrors "who" for the UI.
// ---------------------------------------------------------------------------
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready'

  useEffect(() => {
    api('/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setStatus('ready'));
    const onSignedOut = () => setUser(null);
    window.addEventListener('dd:signed-out', onSignedOut);
    return () => window.removeEventListener('dd:signed-out', onSignedOut);
  }, []);

  const signIn = useCallback(async (email, password) => {
    const r = await api('/auth/login', { method: 'POST', body: { email, password } });
    invalidate();
    setUser(r.user);
    return r.user;
  }, []);

  const signUp = useCallback(async (name, email, password) => {
    const r = await api('/auth/signup', { method: 'POST', body: { name, email, password } });
    invalidate();
    setUser(r.user);
    return r.user;
  }, []);

  const signOut = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    invalidate();
    setUser(null);
    window.location.href = '/';
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, signIn, signUp, signOut, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

// Where to send someone who must sign in, so they come back afterwards.
export const loginUrl = (next = window.location.pathname + window.location.search + window.location.hash) =>
  `/login?next=${encodeURIComponent(next)}`;

// Gate for pages that need an account. Renders nothing while we find out.
export function RequireAuth({ children }) {
  const { user, status } = useAuth();
  useEffect(() => {
    if (status === 'ready' && !user) window.location.replace(loginUrl());
  }, [status, user]);
  if (status !== 'ready' || !user) {
    return <div className="pf-wrap pf-loading"><span className="pf-spinner" /> Checking your session…</div>;
  }
  return children;
}
