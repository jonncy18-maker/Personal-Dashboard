import { header } from './email-sender';
import { extractPlainText } from './gmail-body';
import { parseItineraryFromEmail } from './travel-import';

// Fetch one Gmail message (read-only) and parse its itinerary into
// {date,title,notes}[] via Haiku — the shared core of both the manual "Import
// from Gmail" flow (app/api/travel-import) and the auto-import that runs when a
// suggested trip is approved (app/api/trip-suggestions/[id]). Booking/itinerary
// PDFs are handed to Haiku natively; the mailbox is never modified.

const MAX_PDFS = 3;
const MAX_PDF_BYTES = 8 * 1024 * 1024; // well under Haiku's 32MB request cap

export async function parseItineraryForMessage(gmail, messageId, destination) {
  const res = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });
  const subject = header(res.data.payload?.headers, 'Subject');
  const body = extractPlainText(res.data.payload);
  const pdfs = await fetchPdfAttachments(gmail, messageId, res.data.payload);

  return parseItineraryFromEmail({ destination, subject, body, pdfs });
}

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
