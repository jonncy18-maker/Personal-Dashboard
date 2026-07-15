import { getDb, num, dateOnly } from '../../../lib/db';
import { fetchDestinationPhoto } from '../../../lib/unsplash';

function serialize(row) {
  return {
    ...row,
    budget: num(row.budget),
    start_date: dateOnly(row.start_date),
    end_date: dateOnly(row.end_date),
  };
}

export async function GET() {
  const sql = getDb();
  const rows = await sql`
    SELECT id, destination, start_date, end_date, status, notes, budget,
           itinerary, image_url, image_attribution, image_source,
           created_at, updated_at
    FROM trips
    ORDER BY start_date IS NULL, start_date ASC, created_at DESC
  `;
  return Response.json({ trips: rows.map(serialize) });
}

export async function POST(request) {
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

  const sql = getDb();
  const [row] = await sql`
    INSERT INTO trips (
      destination, start_date, end_date, status, notes, budget,
      image_url, image_attribution, image_source
    )
    VALUES (
      ${destination}, ${startDate}, ${endDate}, ${status}, ${notes}, ${budget},
      ${imageUrl}, ${imageAttribution}, ${imageSource}
    )
    RETURNING id, destination, start_date, end_date, status, notes, budget,
              itinerary, image_url, image_attribution, image_source,
              created_at, updated_at
  `;
  return Response.json({ trip: serialize(row) }, { status: 201 });
}
