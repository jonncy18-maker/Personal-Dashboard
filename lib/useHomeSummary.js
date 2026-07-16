'use client';

import { useEffect, useState } from 'react';

// Sidebar, TopBar, and the Home page all mount together and each need the
// same aggregated data — cache the in-flight/most-recent fetch at module
// scope so three consumers on one page load cost one network round trip,
// not three.
let cachedPromise = null;

function fetchSummary() {
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

  useEffect(() => {
    let cancelled = false;
    fetchSummary()
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load dashboard summary.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { summary, error };
}
