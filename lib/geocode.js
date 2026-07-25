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

// Reverse-geocode already-cached coords to a country for the Travel Stats
// "Countries" tile. The destination is free text ("Denver", "Cebu") with no
// country in it, but every trip already stores lat/long for the map — so we
// resolve the country from those, one lookup per trip (never per page load),
// same discipline as the forward geocode. Returns a status so a caller can tell
// a definitive no-country (open ocean mid-cruise) apart from a transient failure
// to retry: 'ok' with { country, countryCode }, 'none', or 'error'.
export async function reverseGeocodeCountry(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { status: 'none', country: null, countryCode: null };
  }

  try {
    // zoom=3 keeps the response at country granularity — we don't need the
    // street-level address, just the country the coords fall in.
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&zoom=3&addressdetails=1&lat=${encodeURIComponent(
        lat
      )}&lon=${encodeURIComponent(lon)}`,
      { headers: { 'User-Agent': NOMINATIM_UA, Accept: 'application/json' } }
    );
    if (!res.ok) return { status: 'error', country: null, countryCode: null };

    const data = await res.json();
    const country = data?.address?.country || null;
    const countryCode = data?.address?.country_code
      ? String(data.address.country_code).toUpperCase()
      : null;
    if (!country) return { status: 'none', country: null, countryCode: null };
    return { status: 'ok', country, countryCode };
  } catch {
    return { status: 'error', country: null, countryCode: null };
  }
}

// Geocode a single itinerary stop's location, returning the full status. Unlike
// a trip destination, a stop's location is already a concrete port/city
// ("Cartagena", "Panama Canal"), so it's queried as-is — the generic-trip-word
// stripping that helps a destination ("Panama Cruise" → "Panama") would wrongly
// mangle a real place name like "Panama Canal" here.
export async function geocodePlaceResult(location) {
  return geocodeQueryResult(location);
}
