import { getAnthropic, MODEL } from './anthropic';

// French hours-log screenshot import — the app's fourth distinct AI use
// (CLAUDE.md §7). Dreaming French has no public API: third-party tools only
// work by riding a logged-in browser session, not a stable server-to-server
// credential, so there's no fit for this app's server-side route pattern. A
// screenshot of the progress page is the only practical input, and reading
// numbers off an arbitrary chart image is genuine extraction — the same
// reasoning that keeps Travel's itinerary import on Haiku rather than a
// deterministic parser. Never auto-saved: the caller
// (app/api/french-progress/save) only persists what John confirms in the
// preview, since a vision read of a bar chart is inherently approximate.

export async function parseProgressScreenshot(imageBase64, mediaType) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      totalHours: null,
      asOfDate: '',
      dailyEntries: [],
      configured: false,
    };
  }

  const anthropic = getAnthropic();
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1000,
    system:
      'You read a screenshot of a Dreaming French (or similar comprehensible-input ' +
      'tracker) progress page. Respond with ONLY JSON — no prose, no code fences — ' +
      'shaped {"totalHours": number|null, "asOfDate": "YYYY-MM-DD"|"", "dailyEntries": ' +
      '[{"date":"YYYY-MM-DD","hours":number}]}. "totalHours" is the all-time cumulative ' +
      'hours figure if one is visible (a big headline number), else null. "asOfDate" is ' +
      'the date that total was current as of, if shown, else "". "dailyEntries" is only ' +
      'the individual days you can actually read a value for (a labeled bar, a table row, ' +
      'a tooltip) — never estimate or guess a bar height you cannot read a number for. If ' +
      'nothing is legible, return empty/null for every field. Never invent a number.',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: 'Extract the progress data from this screenshot.',
          },
        ],
      },
    ],
  });

  const text = res.content?.[0]?.text?.trim() || '';
  return { ...safeParseProgress(text), configured: true };
}

// Haiku is instructed to return bare JSON, but defensively tolerate prose or
// code fences around the object so a stray wrapper never drops the import.
function safeParseProgress(text) {
  let raw = text;
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  if (fence) raw = fence[1].trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    return { totalHours: null, asOfDate: '', dailyEntries: [] };
  }

  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    const dailyEntries = Array.isArray(parsed.dailyEntries)
      ? parsed.dailyEntries
          .filter(
            (d) =>
              d && typeof d.date === 'string' && typeof d.hours === 'number'
          )
          .map((d) => ({ date: d.date, hours: d.hours }))
      : [];
    return {
      totalHours:
        typeof parsed.totalHours === 'number' ? parsed.totalHours : null,
      asOfDate: typeof parsed.asOfDate === 'string' ? parsed.asOfDate : '',
      dailyEntries,
    };
  } catch {
    return { totalHours: null, asOfDate: '', dailyEntries: [] };
  }
}
