import { getDb, num } from '../../../../lib/db';
import { fetchDestinationPhoto } from '../../../../lib/unsplash';

function serialize(row) {
  return { ...row, budget: num(row.budget) };
}

export async function GET(request, { params }) {
  const { id } = await params;
  const sql = getDb();
  const [row] = await sql`
    SELECT id, destination, start_date, end_date, status, notes, budget,
           itinerary, image_url, image_attribution, image_source,
           created_at, updated_at
    FROM trips WHERE id = ${id}
  `;
  if (!row) {
    return Response.json({ error: 'not found' }, { status: 404 });
  }
  return Response.json({ trip: serialize(row) });
}

export async function PATCH(request, { params }) {
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
    body.status === 'past' || body.status === 'upcoming'
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
    imageSource === 'auto' &&
    (destination !== existing.destination || existing.image_source !== 'auto')
  ) {
    const photo = await fetchDestinationPhoto(destination);
    if (photo) {
      imageUrl = photo.image_url;
      imageAttribution = photo.image_attribution;
    }
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
      image_source = ${imageSource}
    WHERE id = ${id}
    RETURNING id, destination, start_date, end_date, status, notes, budget,
              itinerary, image_url, image_attribution, image_source,
              created_at, updated_at
  `;
  return Response.json({ trip: serialize(row) });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const sql = getDb();
  await sql`DELETE FROM trips WHERE id = ${id}`;
  return new Response(null, { status: 204 });
}
