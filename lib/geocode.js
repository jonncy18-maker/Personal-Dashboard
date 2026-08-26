import { cleanDestination } from './destination';

// Server-side only. Resolves a trip destination to lat/long for the Trip Map,
// one lookup per trip create/edit (never per page load) — the same discipline
// CLAUDE.md applies to the Unsplash photo. A missing/blocked/failed lookup
// just means no pin — the map skips that trip, never breaks.
//
// Uses the Google Geocoding API (switched from OpenStreetMap Nominatim
// 2026-08-26 — John's call, after Nominatim's sparse rural-address coverage
// caused real Mileage favorite-place failures). Google's free monthly credit
// comfortably covers a single-user app's volume; see CLAUDE.md §2/§7.
// Requires `GOOGLE_MAPS_API_KEY` (server-only). A missing key fails soft to
// 'error', same as any other transient failure — never a crash.

const GEOCODE_BASE = 'https://maps.googleapis.com/maps/api/geocode/json';

function apiKey() {
  return process.env.GOOGLE_MAPS_API_KEY || '';
}

// Core Google Geocoding API lookup for an already-prepared query string.
// Returns a status so callers can tell a *definitive* no-match apart from a
// *transient* failure (network/quota/bad key): 'ok' with coords, 'none' (a
// real place that resolved to nothing), or 'error' (retry later — never
// cache as a permanent no-match).
export async function geocodeQueryResult(query) {
  const q = (query || '').trim();
  if (!q) return { status: 'none', coords: null };
  if (!apiKey()) return { status: 'error', coords: null };

  try {
    const res = await fetch(
      `${GEOCODE_BASE}?address=${encodeURIComponent(q)}&key=${apiKey()}`
    );
    if (!res.ok) return { status: 'error', coords: null };

    const data = await res.json();
    if (data.status === 'ZERO_RESULTS') return { status: 'none', coords: null };
    if (data.status !== 'OK') {
      console.error(
        `geocodeQueryResult: Google returned ${data.status} for %o`,
        q
      );
      return { status: 'error', coords: null };
    }

    const loc = data.results?.[0]?.geometry?.location;
    const latitude = Number(loc?.lat);
    const longitude = Number(loc?.lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return { status: 'none', coords: null };
    }
    return { status: 'ok', coords: { latitude, longitude } };
  } catch (err) {
    console.error(
      `geocodeQueryResult: request failed for %o — %s`,
      q,
      err.message
    );
    return { status: 'error', coords: null };
  }
}

// Address-autocomplete suggestions (Mileage's "Favorite places" popup) — the
// same Geocoding API endpoint as geocodeQueryResult. Google returns one
// result for a clean, unambiguous address and several when the query is
// ambiguous, so this is a smaller pick-list than a dedicated autocomplete
// API would give, but every suggestion carries validated coords, so picking
// one skips a second geocode at save time. Fails soft to an empty list —
// same discipline as every other geocode call in this app.
export async function searchPlaces(query, limit = 5) {
  const q = (query || '').trim();
  if (q.length < 3) return [];
  if (!apiKey()) return [];

  try {
    const res = await fetch(
      `${GEOCODE_BASE}?address=${encodeURIComponent(q)}&key=${apiKey()}`
    );
    if (!res.ok) {
      // A fail-soft empty list looks identical to "no match" from the
      // client's side — log the real cause so it shows up in Vercel runtime
      // logs instead of vanishing silently.
      console.error(
        `searchPlaces: Google returned HTTP ${res.status} for %o`,
        q
      );
      return [];
    }

    const data = await res.json();
    if (data.status === 'ZERO_RESULTS') {
      console.warn(`searchPlaces: Google found no matches for %o`, q);
      return [];
    }
    if (data.status !== 'OK' || !Array.isArray(data.results)) {
      console.error(`searchPlaces: Google returned ${data.status} for %o`, q);
      return [];
    }

    return data.results
      .slice(0, limit)
      .map((hit) => ({
        displayName: hit.formatted_address,
        latitude: Number(hit.geometry?.location?.lat),
        longitude: Number(hit.geometry?.location?.lng),
      }))
      .filter(
        (p) =>
          p.displayName &&
          Number.isFinite(p.latitude) &&
          Number.isFinite(p.longitude)
      );
  } catch (err) {
    console.error(`searchPlaces: request failed for %o — %s`, q, err.message);
    return [];
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
  if (!apiKey()) return { status: 'error', country: null, countryCode: null };

  try {
    // result_type=country keeps the response at country granularity — we
    // don't need the street-level address, just the country the coords fall in.
    const res = await fetch(
      `${GEOCODE_BASE}?latlng=${encodeURIComponent(lat)},${encodeURIComponent(
        lon
      )}&result_type=country&key=${apiKey()}`
    );
    if (!res.ok) return { status: 'error', country: null, countryCode: null };

    const data = await res.json();
    if (data.status === 'ZERO_RESULTS') {
      return { status: 'none', country: null, countryCode: null };
    }
    if (data.status !== 'OK') {
      console.error(`reverseGeocodeCountry: Google returned ${data.status}`);
      return { status: 'error', country: null, countryCode: null };
    }

    const component = data.results?.[0]?.address_components?.find((c) =>
      c.types?.includes('country')
    );
    const country = component?.long_name || null;
    const countryCode = component?.short_name
      ? String(component.short_name).toUpperCase()
      : null;
    if (!country) return { status: 'none', country: null, countryCode: null };
    return { status: 'ok', country, countryCode };
  } catch (err) {
    console.error(`reverseGeocodeCountry: request failed — ${err.message}`);
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
