import { getDb } from '../../../lib/db';
import { route } from '../../../lib/route';
import { serializeTrip } from '../../../lib/trips';
import { fetchDestinationPhoto } from '../../../lib/unsplash';
import { geocodeDestination } from '../../../lib/geocode';

export const GET = route(async () => {
  const sql = getDb();
  const rows = await sql`
    SELECT id, destination, start_date, end_date, status, notes, budget,
           itinerary, image_url, image_attribution, image_source,
           latitude, longitude, created_at, updated_at
    FROM trips
    ORDER BY start_date IS NULL, start_date ASC, created_at DESC
  `;
  return Response.json({ trips: rows.map(serializeTrip) });
});

export const POST = route(async (request) => {
  const body = await request.json();
  const destination = (body.destination || '').trim();
  if (!destination) {
    return Response.json({ error: 'destination is required' }, { status: 400 });
  }

  const status = body.status === 'past' ? 'past' : 'upcoming';
  const startDate = body.start_date || null;
  const endDate = body.end_date || null;
  const notes = body.notes || null;
  const budget = body.budget === '' || body.budget == null ? null : body.budget;
  const imageSource = body.image_source === 'manual' ? 'manual' : 'auto';

  let imageUrl = imageSource === 'manual' ? body.image_url || null : null;
  let imageAttribution =
    imageSource === 'manual' ? body.image_attribution || null : null;

  if (imageSource === 'auto') {
    const photo = await fetchDestinationPhoto(destination);
    if (photo) {
      imageUrl = photo.image_url;
      imageAttribution = photo.image_attribution;
    }
  }

  // Geocode the destination for the Trip Map — one lookup per trip change, same
  // rule as the photo. A failure just leaves the pin off the map.
  const coords = await geocodeDestination(destination);

  const sql = getDb();
  const [row] = await sql`
    INSERT INTO trips (
      destination, start_date, end_date, status, notes, budget,
      image_url, image_attribution, image_source,
      latitude, longitude, geocoded_at
    )
    VALUES (
      ${destination}, ${startDate}, ${endDate}, ${status}, ${notes}, ${budget},
      ${imageUrl}, ${imageAttribution}, ${imageSource},
      ${coords?.latitude ?? null}, ${coords?.longitude ?? null}, now()
    )
    RETURNING id, destination, start_date, end_date, status, notes, budget,
              itinerary, image_url, image_attribution, image_source,
              latitude, longitude, created_at, updated_at
  `;
  return Response.json({ trip: serializeTrip(row) }, { status: 201 });
});
