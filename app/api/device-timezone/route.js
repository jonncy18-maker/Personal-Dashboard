import { route, jsonError } from '../../../lib/route';
import {
  getDeviceTimeZone,
  isValidTimeZone,
  setDeviceTimeZone,
} from '../../../lib/device-time';

// The browser reports its IANA timezone here so server-side "today"
// defaults follow John's device, not the server's UTC clock — see
// lib/device-time.js.

export const GET = route(async () => {
  return Response.json({ timeZone: await getDeviceTimeZone() });
});

export const POST = route(async (request) => {
  const body = await request.json().catch(() => null);
  const tz = body?.timeZone;
  if (!isValidTimeZone(tz)) return jsonError('Invalid timeZone', 400);
  await setDeviceTimeZone(tz);
  return Response.json({ timeZone: tz });
});
