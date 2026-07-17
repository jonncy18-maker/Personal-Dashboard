import { geocodePlaceResult } from './geocode';
import { num } from './db';

// Itinerary stop model (stored in trips.itinerary jsonb — no migration needed).
// A stop grew from {date,title,notes} to also carry an optional mappable
// location and its cached coordinates, plus an optional `leg` grouping label
// (e.g. "Taiwan", "Japan cruise") so a multi-part journey — a cruise's ports,
// or a Philippines→Taiwan→Japan trip — reads as segments in the detail view and
// groups on the world map. Old {date,title,notes}-only days stay valid: no
// location just means the stop isn't placed on the map.
//
// `geocoded_for` records the exact location string that produced the cached
// coords, so a stop is re-geocoded only when its location actually changes (and
// a location that genuinely doesn't resolve isn't retried every load — the same
// discipline lib/geocode + the trip-level backfill already use).

// Cap on how many *new* stop lookups one geocode pass performs. Nominatim asks
// for ~1 req/sec and Vercel functions have a wall-clock budget, so a long
// itinerary is filled across passes rather than in one blocking burst; the
// trip-map read backfills whatever a save left pending. Not silent: callers can
// see `pending` on the result.
const MAX_GEOCODES_PER_PASS = 12;

function normalizeStop(raw) {
  return {
    date: typeof raw?.date === 'string' ? raw.date : '',
    title: typeof raw?.title === 'string' ? raw.title : '',
    notes: typeof raw?.notes === 'string' ? raw.notes : '',
    location: typeof raw?.location === 'string' ? raw.location : '',
    leg: typeof raw?.leg === 'string' ? raw.leg : '',
    latitude: raw?.latitude ?? null,
    longitude: raw?.longitude ?? null,
    geocoded_for: typeof raw?.geocoded_for === 'string' ? raw.geocoded_for : '',
  };
}

export function normalizeItinerary(itinerary) {
  return Array.isArray(itinerary) ? itinerary.map(normalizeStop) : [];
}

// True when a stop names a location we haven't resolved for that exact string.
function needsGeocode(stop) {
  const loc = (stop.location || '').trim();
  return loc.length > 0 && stop.geocoded_for !== loc;
}

// Resolve coordinates for any stop whose location changed (or was never
// resolved), caching the result on the stop. Returns the (possibly new) array
// plus `changed` (whether anything was written) and `pending` (stops left
// un-geocoded because the per-pass cap was hit, or that hit a transient error).
// Never throws. A *definitive* no-match is stamped (via `geocoded_for`) so it
// isn't retried forever; a *transient* failure (network/429/5xx) is left
// unstamped so a later pass tries again — a rate-limit must not permanently
// unplace a real port.
export async function geocodeStops(itinerary) {
  const stops = normalizeItinerary(itinerary);
  let changed = false;
  let used = 0;
  let pending = 0;

  for (const stop of stops) {
    if (!needsGeocode(stop)) continue;
    if (used >= MAX_GEOCODES_PER_PASS) {
      pending += 1;
      continue;
    }
    used += 1;
    const loc = stop.location.trim();
    const { status, coords } = await geocodePlaceResult(loc);
    if (status === 'error') {
      // Transient — don't cache; leave for a later pass.
      pending += 1;
      continue;
    }
    stop.latitude = coords?.latitude ?? null;
    stop.longitude = coords?.longitude ?? null;
    stop.geocoded_for = loc; // definitive result (hit or real no-match)
    changed = true;
  }

  return { stops, changed, pending };
}

// The stops of a trip that actually have coordinates, shaped for the map.
export function mappableStops(itinerary) {
  return normalizeItinerary(itinerary)
    .filter((s) => s.latitude != null && s.longitude != null)
    .map((s) => ({
      title: s.title,
      location: s.location,
      leg: s.leg,
      date: s.date || '',
      latitude: num(s.latitude),
      longitude: num(s.longitude),
    }));
}
