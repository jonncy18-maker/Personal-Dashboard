'use client';

import { useEffect, useState } from 'react';
import { useRefresh } from './refresh';

// Sidebar, TopBar, and the Home page all mount together and each need the
// same aggregated data — cache the in-flight/most-recent fetch at module
// scope so three consumers on one page load cost one network round trip,
// not three.
let cachedPromise = null;
// The refresh key this cache was built for. A newer key (from the TopBar
// refresh button) invalidates it exactly once — the first consumer to see the
// new key clears the cache, the rest reuse the fresh in-flight fetch.
let cachedKey = 0;

function fetchSummary(refreshKey) {
  if (refreshKey > cachedKey) {
    cachedPromise = null;
    cachedKey = refreshKey;
  }
  if (!cachedPromise) {
    cachedPromise = fetch('/api/home-summary')
      .then((res) => {
        // A non-2xx body is an error payload, not summary data — reject so
        // the error branch shows instead of rendering cards off `{ error }`.
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .catch((err) => {
        cachedPromise = null; // allow a retry on the next mount
        throw err;
      });
  }
  return cachedPromise;
}

export function useHomeSummary() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const { refreshKey, settle } = useRefresh();

  useEffect(() => {
    let cancelled = false;
    fetchSummary(refreshKey)
      .then((data) => {
        if (!cancelled) {
          setSummary(data);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Could not load dashboard summary.');
      })
      .finally(() => {
        // Clear the refresh spinner once the (re)fetch resolves.
        if (refreshKey > 0) settle();
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, settle]);

  return { summary, error };
}
