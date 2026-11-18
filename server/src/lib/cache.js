// ---------------------------------------------------------------------------
// In-process TTL cache with single-flight loading.
//
// Content (catalog, courses, problem statements) is read on almost every
// request but changes only when an admin publishes. Serving it from memory
// takes the database out of the hot path entirely.
//
// Single-flight: if 100 requests miss the same key at the same moment, only
// ONE loader runs and the other 99 await its promise. Without this, a cache
// expiry under load sends a stampede of identical queries to Postgres.
//
// Invalidation: entries expire after their TTL, and every API process clears
// its cache when Postgres broadcasts NOTIFY content_changed (see contentEvents
// in app.js) — so an admin edit is visible everywhere within milliseconds.
// ---------------------------------------------------------------------------
export function createCache({ maxEntries = 1000 } = {}) {
  const store = new Map(); // key → { value, expiresAt }   (Map keeps insertion order → LRU)
  const inflight = new Map(); // key → Promise

  function get(key) {
    const hit = store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt < Date.now()) {
      store.delete(key);
      return undefined;
    }
    store.delete(key); // refresh LRU position
    store.set(key, hit);
    return hit.value;
  }

  function set(key, value, ttlMs) {
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
    while (store.size > maxEntries) store.delete(store.keys().next().value);
  }

  async function getOrLoad(key, ttlMs, loader) {
    const cached = get(key);
    if (cached !== undefined) return cached;
    if (inflight.has(key)) return inflight.get(key);
    const promise = (async () => {
      try {
        const value = await loader();
        set(key, value, ttlMs);
        return value;
      } finally {
        inflight.delete(key);
      }
    })();
    inflight.set(key, promise);
    return promise;
  }

  return {
    get,
    set,
    getOrLoad,
    clear: () => store.clear(),
    get size() { return store.size; },
  };
}

export const contentCache = createCache();
