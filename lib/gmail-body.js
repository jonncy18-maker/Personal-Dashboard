// Walk a Gmail message payload for readable text — prefer text/plain, fall back
// to a crude strip of text/html. Bounded so a huge marketing email can't blow
// the token budget. Shared by the itinerary import (app/api/travel-import) and
// the weekly trip scan (app/api/trip-scan).

export function extractPlainText(payload, limit = 12000) {
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
