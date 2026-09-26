'use client';

import { useEffect } from 'react';

const STORAGE_KEY = 'device-timezone-reported';

// Tells the server which timezone this device is in, so dates the server
// fills in (Health logs with no date, Claude over MCP) follow the device —
// see lib/device-time.js. Re-reported only when the zone changes, e.g. after
// landing somewhere new, or when this browser hasn't reported it yet.
export default function DeviceTimezone() {
  useEffect(() => {
    let tz;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!tz) return;
    let last = null;
    try {
      last = localStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage blocked — just report every load.
    }
    if (last === tz) return;
    fetch('/api/device-timezone', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ timeZone: tz }),
    })
      .then((res) => {
        if (!res.ok) return;
        try {
          localStorage.setItem(STORAGE_KEY, tz);
        } catch {
          // Fine — it'll just be reported again next load.
        }
      })
      .catch(() => {});
  }, []);

  return null;
}
