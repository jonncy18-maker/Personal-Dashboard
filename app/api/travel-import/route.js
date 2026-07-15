import { getDb } from '../../../lib/db';
import { getGmailClient } from '../../../lib/google';
import { extractSenderName, header } from '../../../lib/email-sender';
import { parseItineraryFromEmail } from '../../../lib/travel-import';
import { meaningfulWords } from '../../../lib/destination';

// Travel itinerary import (CLAUDE.md §7) — read-only Gmail, the same hard
// boundary as the Email domain (no write/modify/delete calls, ever). Two steps,
// deliberately split so the model only does the part that needs it:
//   GET  — a DETERMINISTIC Gmail search (operators only, no model) surfacing
//          candidate confirmation/itinerary emails for a trip. John picks one.
//   POST — Haiku runs on the ONE chosen email to extract a day-by-day preview.
// Nothing is saved here: the preview returns to the client for confirm/edit,
// and only the existing trip PATCH (app/api/trips/[id]) ever persists it.

const SEARCH_TERMS = [
  'itinerary',
  'confirmation',
  'reservation',
  'booking',
  'e-ticket',
  'boarding',
];

function buildQuery(destination) {
  const keywords = `(${SEARCH_TERMS.join(' OR ')})`;
  // Key off the destination's most specific real place-word — a full phrase is
  // often written differently in the email than on the trip. Generic trip-type
  // words are stripped first (so "Panama Cruise" → "Panama", "Alaska Cruise" →
  // "Alaska"); see lib/destination.js, shared with the Unsplash photo query.
  const destWord = meaningfulWords(destination).slice(-1)[0] || '';
  // Exclude promotional/social mail: a real booking confirmation is
  // transactional, but travel senders (esp. cruise lines) flood the inbox with
  // marketing that also matches "booking/confirmation/itinerary". Since Gmail
  // returns matches newest-first, that noise would otherwise bury an older
  // confirmation (e.g. a cruise booked months before sailing) below the result
  // cap. Leaning on Gmail's native categories here mirrors the Email domain.
  const filters = '-category:promotions -category:social';
  return destWord
    ? `${keywords} ${destWord} ${filters}`
    : `${keywords} ${filters}`;
}

export async function GET(request) {
  const gmail = getGmailClient();
  if (!gmail) {
    return Response.json({ configured: false, candidates: [] });
  }

  const tripId = new URL(request.url).searchParams.get('tripId');
  let destination = '';
  if (tripId) {
    const sql = getDb();
    const [trip] =
      await sql`SELECT destination FROM trips WHERE id = ${tripId}`;
    destination = trip?.destination || '';
  }

  try {
    const list = await gmail.users.messages.list({
      userId: 'me',
      q: buildQuery(destination),
      maxResults: 30,
    });

    const ids = list.data.messages || [];
    const details = await Promise.all(
      ids.map((m) =>
        gmail.users.messages.get({
          userId: 'me',
          id: m.id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        })
      )
    );

    const candidates = details.map((res) => {
      const headers = res.data.payload?.headers;
      return {
        id: res.data.id,
        from: extractSenderName(header(headers, 'From')),
        subject: header(headers, 'Subject') || '(no subject)',
        date: header(headers, 'Date'),
        snippet: res.data.snippet || '',
      };
    });

    return Response.json({ configured: true, destination, candidates });
  } catch {
    return Response.json(
      { configured: true, candidates: [], error: 'search failed' },
      { status: 502 }
    );
  }
}

export async function POST(request) {
  const gmail = getGmailClient();
  if (!gmail) {
    return Response.json({ error: 'gmail not configured' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const messageId = (body.messageId || '').trim();
  if (!messageId) {
    return Response.json({ error: 'messageId is required' }, { status: 400 });
  }

  let destination = '';
  if (body.tripId) {
    const sql = getDb();
    const [trip] =
      await sql`SELECT destination FROM trips WHERE id = ${body.tripId}`;
    destination = trip?.destination || '';
  }

  try {
    const res = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const subject = header(res.data.payload?.headers, 'Subject');
    const text = extractPlainText(res.data.payload);
    const pdfs = await fetchPdfAttachments(gmail, messageId, res.data.payload);

    const { days, configured } = await parseItineraryFromEmail({
      destination,
      subject,
      body: text,
      pdfs,
    });

    if (!configured) {
      return Response.json(
        { error: 'anthropic not configured' },
        { status: 400 }
      );
    }
    return Response.json({ days });
  } catch {
    return Response.json({ error: 'parse failed' }, { status: 502 });
  }
}

// Walk a Gmail message payload for readable text — prefer text/plain, fall back
// to a crude strip of text/html. Bounded so a huge marketing email can't blow
// the token budget.
function extractPlainText(payload, limit = 12000) {
  const plain = collectPart(payload, 'text/plain');
  const raw = plain || stripHtml(collectPart(payload, 'text/html'));
  return raw
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, limit);
}

function collectPart(part, mimeType) {
  if (!part) return '';
  if (part.mimeType === mimeType && part.body?.data) {
    return decodeBase64Url(part.body.data);
  }
  if (Array.isArray(part.parts)) {
    for (const child of part.parts) {
      const found = collectPart(child, mimeType);
      if (found) return found;
    }
  }
  return '';
}

function decodeBase64Url(data) {
  try {
    return Buffer.from(data, 'base64url').toString('utf8');
  } catch {
    return '';
  }
}

// Booking/itinerary PDFs (cruise vouchers, e-tickets) go straight to Haiku,
// which reads PDFs natively. Read-only: this only *gets* attachment bytes, never
// touches the mailbox. Bounded so a deck of brochures can't blow past the
// model's limits — a couple of reasonably-sized PDFs is plenty for an itinerary.
const MAX_PDFS = 3;
const MAX_PDF_BYTES = 8 * 1024 * 1024; // well under Haiku's 32MB request cap

async function fetchPdfAttachments(gmail, messageId, payload) {
  const refs = [];
  collectPdfRefs(payload, refs);

  const pdfs = [];
  for (const ref of refs.slice(0, MAX_PDFS)) {
    if (ref.size && ref.size > MAX_PDF_BYTES) continue;
    try {
      const att = await gmail.users.messages.attachments.get({
        userId: 'me',
        messageId,
        id: ref.attachmentId,
      });
      const data = att.data?.data;
      if (!data) continue;
      // Gmail returns base64url; Anthropic wants standard base64, no newlines.
      const b64 = Buffer.from(data, 'base64url').toString('base64');
      if (b64) pdfs.push(b64);
    } catch {
      // Skip an unreadable attachment rather than failing the whole import.
    }
  }
  return pdfs;
}

function collectPdfRefs(part, out) {
  if (!part) return;
  const isPdf =
    part.mimeType === 'application/pdf' || /\.pdf$/i.test(part.filename || '');
  if (isPdf && part.body?.attachmentId) {
    out.push({ attachmentId: part.body.attachmentId, size: part.body.size });
  }
  if (Array.isArray(part.parts)) {
    for (const child of part.parts) collectPdfRefs(child, out);
  }
}

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+/g, ' ');
}
