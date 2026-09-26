import { getDb } from './db';
import { todayYMD } from './health';

// "Today" follows the device John is using, not the server's clock (Codex
// audit F08, John's call 2026-09-26). Vercel functions run in UTC, so an
// evening log from an Eastern phone used to land on tomorrow whenever a date
// was omitted — most often through Claude over MCP, where no browser is in
// the loop to send one.
//
// The browser reports its IANA timezone (components/DeviceTimezone.jsx →
// /api/device-timezone) and it's kept in app_flags, so a server-side default
// uses the zone of the device John most recently opened the app on. That's
// the right zone for MCP callers too: they have no device of their own, and
// John travelling means "home" isn't fixed. Never recorded → the server's
// own clock, the behavior before this existed.

const FLAG_KEY = 'device_timezone';

export function isValidTimeZone(tz) {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// A failed read degrades to "unknown" (the server clock) rather than failing
// the log or MCP handshake that only wanted a default date.
export async function getDeviceTimeZone(sql) {
  try {
    const db = sql || getDb();
    const [row] = await db`SELECT value FROM app_flags WHERE key = ${FLAG_KEY}`;
    const tz = row?.value?.tz;
    return isValidTimeZone(tz) ? tz : null;
  } catch (err) {
    console.error('[device-time] could not read device timezone:', err);
    return null;
  }
}

export async function setDeviceTimeZone(tz, sql = getDb()) {
  await sql`
    INSERT INTO app_flags (key, value)
    VALUES (${FLAG_KEY}, ${JSON.stringify({ tz, updated_at: new Date().toISOString() })}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
}

// Today's date (YYYY-MM-DD) on John's device. `timeZone` wins when the
// caller has one from the requesting device itself (the in-app Assistant
// sends it); otherwise the last reported device zone.
export async function deviceToday({ timeZone, sql } = {}) {
  const tz = isValidTimeZone(timeZone)
    ? timeZone
    : await getDeviceTimeZone(sql);
  return todayYMD(new Date(), tz || undefined);
}
