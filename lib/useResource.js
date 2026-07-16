'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRefresh } from './refresh';

// Generic client data-fetch hook: one place for the fetch / res.ok / loading /
// error / cancel-on-unmount boilerplate every domain page used to hand-roll
// (with inconsistent `error` vs `loadError` naming). Returns the parsed JSON
// as `data`, plus `error`, `loading`, and a `reload()` for post-mutation
// refresh. A non-2xx response is treated as an error, so an error body never
// masquerades as real data. Also re-fetches when the app-wide refresh signal
// (the TopBar refresh button) fires.
export function useResource(
  url,
  { errorMessage = 'Could not load data.' } = {}
) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const { refreshKey } = useRefresh();

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError(errorMessage);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url, errorMessage, nonce, refreshKey]);

  return { data, error, loading, reload };
}
