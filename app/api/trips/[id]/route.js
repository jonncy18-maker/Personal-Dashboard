import { getDb } from '../../../../lib/db';
import { route } from '../../../../lib/route';
import { serializeTrip } from '../../../../lib/trips';
import { fetchDestinationPhoto } from '../../../../lib/unsplash';
import { geocodeDestination } from '../../../../lib/geocode';

export const GET = route(async (request, { params }) => {
  const { id } = await params;
  const sql = getDb();
  const [row] = await sql`
    SELECT id, destination, start_date, end_date, status, notes, budget,
           itinerary, image_url, image_attribution, image_source,
           latitude, longitude, created_at, updated_at
    FROM trips WHERE id = ${id}
  `;
  if (!row) {
    return Response.json({ error: 'not found' }, { status: 404 });
  }
  return Response.json({ trip: serializeTrip(row) });
});

export const PATCH = route(async (request, { params }) => {
  const { id } = await params;
  const body = await request.json();
  const sql = getDb();

  const [existing] = await sql`SELECT * FROM trips WHERE id = ${id}`;
  if (!existing) {
    return Response.json({ error: 'not found' }, { status: 404 });
  }

  const destination = (body.destination ?? existing.destination).trim();
  if (!destination) {
    return Response.json({ error: 'destination is required' }, { status: 400 });
  }
  const status =
    body.status === 'past' ||
    body.status === 'upcoming' ||
    body.status === 'wishlist'
      ? body.status
      : existing.status;
  const startDate =
    body.start_date !== undefined
      ? body.start_date || null
      : existing.start_date;
  const endDate =
    body.end_date !== undefined ? body.end_date || null : existing.end_date;
  const notes = body.notes !== undefined ? body.notes || null : existing.notes;
  const budget =
    body.budget !== undefined
      ? body.budget === '' || body.budget == null
        ? null
        : body.budget
      : existing.budget;
  const itinerary =
    body.itinerary !== undefined
      ? JSON.stringify(body.itinerary)
      : existing.itinerary;
  const imageSource =
    body.image_source === 'manual' || body.image_source === 'auto'
      ? body.image_source
      : existing.image_source;

  let imageUrl = existing.image_url;
  let imageAttribution = existing.image_attribution;

  if (imageSource === 'manual') {
    if (body.image_url !== undefined) imageUrl = body.image_url || null;
    if (body.image_attribution !== undefined)
      imageAttribution = body.image_attribution || null;
  } else if (
    // Re-fetch on a destination change, a switch back to auto, or — the case
    // that matters for a trip created before UNSPLASH_ACCESS_KEY was set —
    // when auto mode has simply never produced a photo yet.
    imageSource === 'auto' &&
    (destination !== existing.destination ||
      existing.image_source !== 'auto' ||
      !existing.image_url)
  ) {
    const photo = await fetchDestinationPhoto(destination);
    if (photo) {
      imageUrl = photo.image_url;
      imageAttribution = photo.image_attribution;
    }
  }

  // Re-geocode when the destination changes, or backfill if coords were never
  // resolved (a trip created before this feature existed). Editing anything
  // else (notes, budget) reuses the stored coords — no needless lookup.
  let latitude = existing.latitude;
  let longitude = existing.longitude;
  let geocodedAt = existing.geocoded_at;
  if (destination !== existing.destination || existing.latitude == null) {
    const coords = await geocodeDestination(destination);
    latitude = coords?.latitude ?? null;
    longitude = coords?.longitude ?? null;
    geocodedAt = new Date();
  }

  const [row] = await sql`
    UPDATE trips SET
      destination = ${destination},
      start_date = ${startDate},
      end_date = ${endDate},
      status = ${status},
      notes = ${notes},
      budget = ${budget},
      itinerary = ${itinerary},
      image_url = ${imageUrl},
      image_attribution = ${imageAttribution},
      image_source = ${imageSource},
      latitude = ${latitude},
      longitude = ${longitude},
      geocoded_at = ${geocodedAt}
    WHERE id = ${id}
    RETURNING id, destination, start_date, end_date, status, notes, budget,
              itinerary, image_url, image_attribution, image_source,
              latitude, longitude, created_at, updated_at
  `;
  return Response.json({ trip: serializeTrip(row) });
});

export const DELETE = route(async (request, { params }) => {
  const { id } = await params;
  const sql = getDb();
  await sql`DELETE FROM trips WHERE id = ${id}`;
  return new Response(null, { status: 204 });
});
