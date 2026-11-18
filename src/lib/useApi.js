import { useCallback, useEffect, useRef, useState } from 'react';
import { api, cachedGet } from './api.js';

// Loads an API resource for a component: { data, error, loading, reload, setData }.
// `path` null → don't load (e.g. waiting for the user to be known).
// `cached` → share the response with other components (public data only).
export function useApi(path, { cached = false } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(path) });
  const latest = useRef(path);
  latest.current = path;

  const load = useCallback(() => {
    if (!path) { setState({ data: null, error: null, loading: false }); return undefined; }
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    (cached ? cachedGet(path) : api(path, { signal: controller.signal }))
      .then((data) => { if (latest.current === path) setState({ data, error: null, loading: false }); })
      .catch((error) => { if (error.name !== 'AbortError' && latest.current === path) setState({ data: null, error, loading: false }); });
    return () => controller.abort();
  }, [path, cached]);

  useEffect(() => load(), [load]);

  const setData = useCallback((update) => setState((s) => ({ ...s, data: typeof update === 'function' ? update(s.data) : update })), []);
  return { ...state, reload: load, setData };
}

// The public catalog (courses, tracks, stats) — used by nav, footer, landing,
// learn and practice pages; fetched once and shared.
export const useCatalog = () => useApi('/catalog', { cached: true });
