'use client';

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';

// A single app-wide "refresh" signal. The TopBar refresh button calls
// refresh(); every data hook that subscribes (useHomeSummary, useResource)
// re-fetches when refreshKey changes. `refreshing` drives the button's spinner
// and is cleared when a consumer calls settle() (the always-mounted
// home-summary hook does), with a safety timeout so it can never spin forever.
const RefreshContext = createContext({
  refreshKey: 0,
  refreshing: false,
  refresh: () => {},
  settle: () => {},
});

export function RefreshProvider({ children }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef(null);

  const settle = useCallback(() => {
    setRefreshing(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    if (timerRef.current) clearTimeout(timerRef.current);
    // Never leave the spinner stuck if nothing settles it.
    timerRef.current = setTimeout(() => setRefreshing(false), 5000);
  }, []);

  return (
    <RefreshContext.Provider
      value={{ refreshKey, refreshing, refresh, settle }}
    >
      {children}
    </RefreshContext.Provider>
  );
}

export const useRefresh = () => useContext(RefreshContext);
