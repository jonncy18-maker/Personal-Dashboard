import { parseScheduleScreenshot } from '../../../lib/schedule-import';

const ALLOWED_MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

// Preview step only — nothing is saved here. John reviews/edits the
// candidate tasks and the existing /api/schedules POST (unchanged CRUD
// route) is the only thing that ever creates a row, one per confirmed task
// (same never-auto-save discipline as French's screenshot import). An
// AI/external route, so it fails soft rather than 500ing (CLAUDE.md §7).
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
    const result = await parseScheduleScreenshot(imageBase64, mediaType);
    return Response.json(result);
  } catch {
    return Response.json(
      { tasks: [], configured: true, error: 'parse failed' },
      { status: 502 }
    );
  }
}
