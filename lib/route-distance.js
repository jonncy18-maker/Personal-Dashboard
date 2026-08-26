import { geocodeQueryResult } from './geocode';

// Server-side only. Resolves a point-to-point trip (Mileage's trip log) to a
// real driving-distance mileage — geocode both ends via the same Nominatim
// lookup Travel already uses, then ask the public OSRM demo routing server
// for the driving distance between them. No API key, no paid tile provider —
// same "free, keyless" discipline as lib/geocode.js. A failed lookup at any
// step just means no computed distance; the caller lets John enter miles by
// hand rather than blocking the save.

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';
const METERS_PER_MILE = 1609.344;

export async function fetchDrivingDistanceMiles(originQuery, destinationQuery) {
  const [origin, destination] = await Promise.all([
    geocodeQueryResult(originQuery),
    geocodeQueryResult(destinationQuery),
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
