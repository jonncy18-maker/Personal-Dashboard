import { geocodeQueryResult } from './geocode';

// Server-side only. Resolves a point-to-point trip (Mileage's trip log and
// the "usual trips" route popup) to a real driving-distance mileage —
// geocode both ends via the same Google Geocoding API lookup Travel already
// uses, then ask the public OSRM demo routing server for the driving
// distance between them. Routing itself stays free/keyless (no Google
// Directions/Distance Matrix call) — only geocoding moved to Google. A
// failed lookup at any step just means no computed distance; the caller
// lets John enter miles by hand rather than blocking the save.
//
// `placesByLabel` (optional) is a Map of lowercased label -> mileage_places
// row. A label like "Home" or "Gym" isn't a real geocodable place, so a
// saved favorite's cached lat/lng is used directly when the query matches
// one — the whole reason mileage_places (migration 020) exists.

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';
const METERS_PER_MILE = 1609.344;

// Loads saved favorite places (mileage_places, migration 020) keyed by
// lowercased label, for resolveLocation() to check before geocoding a bare
// label like "Home" or "Gym".
export async function loadPlacesByLabel(sql) {
  const rows = await sql`SELECT label, lat, lng FROM mileage_places`;
  const map = new Map();
  for (const row of rows) {
    map.set(row.label.trim().toLowerCase(), row);
  }
  return map;
}

async function resolveLocation(query, placesByLabel) {
  const key = (query || '').trim().toLowerCase();
  const place = placesByLabel?.get(key);
  if (place && place.lat != null && place.lng != null) {
    return {
      status: 'ok',
      coords: { latitude: Number(place.lat), longitude: Number(place.lng) },
    };
  }
  return geocodeQueryResult(query);
}

export async function fetchDrivingDistanceMiles(
  originQuery,
  destinationQuery,
  placesByLabel
) {
  const [origin, destination] = await Promise.all([
    resolveLocation(originQuery, placesByLabel),
    resolveLocation(destinationQuery, placesByLabel),
  ]);

  if (origin.status !== 'ok' || destination.status !== 'ok') {
    return {
      status:
        origin.status === 'error' || destination.status === 'error'
          ? 'error'
          : 'none',
      miles: null,
      origin: origin.coords,
      destination: destination.coords,
    };
  }

  try {
    const coordsPath =
      `${origin.coords.longitude},${origin.coords.latitude};` +
      `${destination.coords.longitude},${destination.coords.latitude}`;
    const res = await fetch(`${OSRM_BASE}/${coordsPath}?overview=false`);
    if (!res.ok) {
      return {
        status: 'error',
        miles: null,
        origin: origin.coords,
        destination: destination.coords,
      };
    }
    const data = await res.json();
    const meters = data?.routes?.[0]?.distance;
    if (!Number.isFinite(meters)) {
      return {
        status: 'none',
        miles: null,
        origin: origin.coords,
        destination: destination.coords,
      };
    }
    return {
      status: 'ok',
      miles: meters / METERS_PER_MILE,
      origin: origin.coords,
      destination: destination.coords,
    };
  } catch {
    return {
      status: 'error',
      miles: null,
      origin: origin.coords,
      destination: destination.coords,
    };
  }
}
