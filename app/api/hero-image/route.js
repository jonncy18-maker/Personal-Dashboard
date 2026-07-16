import { getDb } from '../../../lib/db';
import { fetchScenicPhoto } from '../../../lib/unsplash';
import { TIME_BANDS, BAND_QUERY } from '../../../lib/time-of-day';

// GET the Home hero photo for a time band (?band=dawn|day|golden|night). The
// client passes its locally-computed band; we cache one photo per band per
// calendar day in hero_image, so a page load never calls Unsplash unless this
// band hasn't been fetched yet today. Returns { image_url, image_attribution }
// — both null when there's no key / no result, and the hero falls back to its
// gradient. Nulls are not cached, so the hero starts working the moment a key
// exists without waiting for the next day.

function todayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function GET(request) {
  const band = new URL(request.url).searchParams.get('band');
  if (!TIME_BANDS.includes(band)) {
    return Response.json({ error: 'invalid band' }, { status: 400 });
  }

  const sql = getDb();
  const day = todayString();

  const [cached] = await sql`
    SELECT image_url, image_attribution
    FROM hero_image
    WHERE band = ${band} AND day = ${day}
  `;
  if (cached) {
    return Response.json({
      image_url: cached.image_url,
      image_attribution: cached.image_attribution,
    });
  }

  const photo = await fetchScenicPhoto(BAND_QUERY[band]);
  if (!photo || !photo.image_url) {
    return Response.json({ image_url: null, image_attribution: null });
  }

  // ON CONFLICT guards a concurrent fetch for the same band/day.
  await sql`
    INSERT INTO hero_image (band, day, image_url, image_attribution)
    VALUES (${band}, ${day}, ${photo.image_url}, ${photo.image_attribution})
    ON CONFLICT (band, day) DO NOTHING
  `;
  return Response.json(photo);
}
