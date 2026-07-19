import { parseProgressScreenshot } from '../../../../lib/french-progress';

const ALLOWED_MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

// Preview step only — nothing is saved here. John reviews/edits the result
// and only app/api/french-progress/save ever writes to the DB (same
// never-auto-save discipline as Travel's itinerary import). An AI/external
// route, so it fails soft rather than 500ing (CLAUDE.md §7 error convention).
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { imageBase64, mediaType } = body;

  if (!imageBase64 || !ALLOWED_MEDIA_TYPES.includes(mediaType)) {
    return Response.json(
      { error: 'a png/jpeg/webp imageBase64 is required', configured: true },
      { status: 400 }
    );
  }

  try {
    const result = await parseProgressScreenshot(imageBase64, mediaType);
    return Response.json(result);
  } catch {
    return Response.json(
      {
        totalHours: null,
        asOfDate: '',
        dailyEntries: [],
        configured: true,
        error: 'parse failed',
      },
      { status: 502 }
    );
  }
}
