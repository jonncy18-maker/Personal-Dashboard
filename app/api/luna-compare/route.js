import { parseProgressScreenshot } from '../../../lib/french-progress';
import { parseScheduleScreenshot } from '../../../lib/schedule-import';
import { parseItineraryFromEmail } from '../../../lib/travel-import';

// TEMPORARY — delete this route and public/luna-compare.html once John has
// compared real files (ROADMAP.md, "Luna image/PDF comparison").
//
// Runs ONE uploaded file through the real importer twice, once on Haiku and
// once on Luna (forced, no fallback), and returns both readings side by side.
// Read-only: it calls the same parse functions the import routes call and
// never writes anything. It is open like every other route in this app (no
// auth by design), so it is only as exposed as the existing import routes.
export const maxDuration = 60;

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

async function timed(fn) {
  const t0 = Date.now();
  try {
    return { ok: true, result: await fn(), ms: Date.now() - t0 };
  } catch (err) {
    return {
      ok: false,
      error: String(err?.message || err),
      ms: Date.now() - t0,
    };
  }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { kind, mediaType, data, destination, subject, text } = body;

  let run;
  if (kind === 'french' || kind === 'schedule') {
    if (!data || !IMAGE_TYPES.includes(mediaType)) {
      return Response.json(
        { error: 'a png/jpeg/webp image is required' },
        { status: 400 }
      );
    }
    const parse =
      kind === 'french' ? parseProgressScreenshot : parseScheduleScreenshot;
    run = (provider) => parse(data, mediaType, { provider });
  } else if (kind === 'travel') {
    if (!data && !text) {
      return Response.json(
        { error: 'a PDF and/or the email text is required' },
        { status: 400 }
      );
    }
    run = (provider) =>
      parseItineraryFromEmail({
        destination,
        subject,
        body: text,
        pdfs: data ? [data] : [],
        provider,
      });
  } else {
    return Response.json({ error: 'unknown kind' }, { status: 400 });
  }

  const [haiku, luna] = await Promise.all([
    timed(() => run('anthropic')),
    process.env.OPENAI_API_KEY
      ? timed(() => run('luna'))
      : {
          ok: false,
          error: 'OPENAI_API_KEY is not set in this environment.',
          ms: 0,
        },
  ]);

  return Response.json({ kind, haiku, luna });
}
