// ---------------------------------------------------------------------------
// API client. Every call to the backend goes through api().
//
//   * Auth is cookie-based (httpOnly), so there's no token handling here —
//     the browser attaches cookies automatically.
//   * Every request carries the X-Requested-With header the server's CSRF
//     guard requires.
//   * When the 15-minute access token expires, the server answers 401; we
//     call /auth/refresh ONCE (concurrent 401s share the same refresh) and
//     retry the original request. If refresh fails, the session is over and
//     we broadcast 'dd:signed-out' so the UI can show the sign-in state.
//   * Public GETs are memoized briefly so pages that need the same catalog
//     (nav, footer, page body) make one request, not three.
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message || `Request failed (${status})`);
    this.status = status;
    this.code = body?.error?.code;
    this.details = body?.error?.details;
  }
}

let refreshing = null;
export function refreshSession() {
  refreshing ||= fetch('/api/auth/refresh', { method: 'POST', headers: { 'X-Requested-With': 'datadrill' } })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => { setTimeout(() => { refreshing = null; }, 0); });
  return refreshing;
}

export async function api(path, { method = 'GET', body, retry = true, signal } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      signal,
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'datadrill', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, { error: { code: 'network', message: "Can't reach the server — check your connection." } });
  }

  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    if (await refreshSession()) return api(path, { method, body, retry: false, signal });
    window.dispatchEvent(new Event('dd:signed-out'));
  }

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON error page */ }
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

// Short-lived memo for public GETs (catalog, course outlines, problem lists).
const memo = new Map();
export function cachedGet(path, ttlMs = 30_000) {
  const hit = memo.get(path);
  if (hit && hit.expires > Date.now()) return hit.promise;
  const promise = api(path).catch((err) => { memo.delete(path); throw err; });
  memo.set(path, { promise, expires: Date.now() + ttlMs });
  return promise;
}
export const invalidate = (prefix = '') => {
  for (const key of memo.keys()) if (key.startsWith(prefix)) memo.delete(key);
};
