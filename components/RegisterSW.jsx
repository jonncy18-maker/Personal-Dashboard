'use client';

import { useEffect } from 'react';

// Registers the service worker so the dashboard is installable as a PWA and
// its shell works offline. Production only — a dev-mode SW just fights the
// Next dev server's HMR and caches stale bundles.
export default function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    const register = () =>
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    if (document.readyState === 'complete') register();
    else {
      window.addEventListener('load', register);
      return () => window.removeEventListener('load', register);
    }
  }, []);

  return null;
}
