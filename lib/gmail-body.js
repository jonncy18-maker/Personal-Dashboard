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
  return (
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      // Zero-width/invisible entities carry no meaning but do split words —
      // Celebrity's reservation block renders the sail date as
      // "on &zwnj;December 20, 2026&zwnj;", which left in place is just noise
      // in front of the model. Drop them, then decode the numeric entities
      // marketing HTML is full of (&#8203;, &#39;, …).
      .replace(/&(?:zwnj|zwj|shy|lrm|rlm);/gi, '')
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => entityChar(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, dec) => entityChar(Number(dec)))
      .replace(/&quot;/gi, '"')
      .replace(/&(?:apos|#39);/gi, "'")
      .replace(/&(?:reg|copy|trade);/gi, ' ')
      .replace(/&(?:emsp|ensp|thinsp);/gi, ' ')
      .replace(/&(?:mdash|ndash);/gi, '-')
      .replace(/&(?:lsquo|rsquo);/gi, "'")
      .replace(/&(?:ldquo|rdquo);/gi, '"')
      .replace(/&hellip;/gi, '...')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&amp;/gi, '&')
      .replace(/[ \t]+/g, ' ')
  );
}

// Zero-width code points are dropped rather than emitted; everything else is
// decoded normally. Out-of-range values fall back to a space.
const ZERO_WIDTH = new Set([0x200b, 0x200c, 0x200d, 0xfeff, 0x00ad]);
function entityChar(code) {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return ' ';
  if (ZERO_WIDTH.has(code)) return '';
  try {
    return String.fromCodePoint(code);
  } catch {
    return ' ';
  }
}
