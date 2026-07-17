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

// Core Nominatim lookup for an already-prepared query string. Returns a status
// so callers can tell a *definitive* no-match apart from a *transient* failure
// (network/429/5xx): 'ok' with coords, 'none' (a real place that resolved to
// nothing), or 'error' (retry later — never cache as a permanent no-match).
export async function geocodeQueryResult(query) {
  const q = (query || '').trim();
  if (!q) return { status: 'none', coords: null };

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
        q
      )}`,
      { headers: { 'User-Agent': NOMINATIM_UA, Accept: 'application/json' } }
    );
    if (!res.ok) return { status: 'error', coords: null };

    const data = await res.json();
    const hit = Array.isArray(data) ? data[0] : null;
    if (!hit) return { status: 'none', coords: null };

    const latitude = Number(hit.lat);
    const longitude = Number(hit.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return { status: 'none', coords: null };
    }
    return { status: 'ok', coords: { latitude, longitude } };
  } catch {
    return { status: 'error', coords: null };
  }
}

// Back-compatible helper: coords or null (collapses 'none'/'error' to null).
export async function geocodeQuery(query) {
  const { coords } = await geocodeQueryResult(query);
  return coords;
}

export async function geocodeDestination(destination) {
  // Query the real place, not generic trip words — "Panama Cruise" → "Panama".
  return geocodeQuery(cleanDestination(destination));
}

// Geocode a single itinerary stop's location, returning the full status. Unlike
// a trip destination, a stop's location is already a concrete port/city
// ("Cartagena", "Panama Canal"), so it's queried as-is — the generic-trip-word
// stripping that helps a destination ("Panama Cruise" → "Panama") would wrongly
// mangle a real place name like "Panama Canal" here.
export async function geocodePlaceResult(location) {
  return geocodeQueryResult(location);
}
