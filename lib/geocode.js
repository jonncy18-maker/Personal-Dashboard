import { cleanDestination } from './destination';

// Server-side only. Resolves a trip destination to lat/long for the Trip Map,
// one lookup per trip create/edit (never per page load) — the same discipline
// CLAUDE.md applies to the Unsplash photo. Uses OpenStreetMap Nominatim, which
// needs no API key but asks for a descriptive User-Agent identifying the app.
// A missing/blocked/failed lookup just means no pin — the map skips that trip,
// never breaks.
//
// Nominatim usage policy: <= 1 request/second and a valid UA. This app geocodes
// at most a handful of trips on change, well under that ceiling.

const NOMINATIM_UA =
  'PersonalDashboard/1.0 (single-user personal travel dashboard)';

export async function geocodeDestination(destination) {
  // Query the real place, not generic trip words — "Panama Cruise" → "Panama".
  const query = cleanDestination(destination);
  if (!query) return null;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
        query
      )}`,
      { headers: { 'User-Agent': NOMINATIM_UA, Accept: 'application/json' } }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const hit = Array.isArray(data) ? data[0] : null;
    if (!hit) return null;

    const latitude = Number(hit.lat);
    const longitude = Number(hit.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    return { latitude, longitude };
  } catch {
    return null;
  }
}
