// Observation-only probe for the official-source maintenance sync (the
// deferred "PR 2" in the car skill). The dev sandbox's egress policy blocks
// tesla.com, so no parser can be written against real output from there —
// this route runs the fetch from Vercel's network instead and reports what
// actually came back: status, final URL, content type, candidate links and a
// text excerpt around "interval". Nothing is parsed into intervals, nothing
// is written to the database, and no AI is called.
//
// The start URL is fixed in code and only same-host links are followed — the
// route takes no URL input, so it can't
// be pointed at anything else. Read-only GET, fails soft per URL (an external
// source must never throw the route), same as the other external-source
// routes (CLAUDE.md §8).

const INDEX_URL = 'https://www.tesla.com/ownersmanual/model3/en_us/';
const ALLOWED_HOST = 'www.tesla.com';
// How many maintenance-looking links found on the index to follow. Only
// same-host links are followed, so the fixed-URL guarantee above holds.
const FOLLOW_LIMIT = 4;

// A plain server fetch with no UA is the most likely thing a bot wall
// rejects; a descriptive UA keeps the probe honest about what it is.
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (compatible; PersonalDashboard/1.0; maintenance-source-probe)',
  Accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

function textOf(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

async function probe(url) {
  const out = { url };
  try {
    const res = await fetch(url, {
      headers: HEADERS,
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    out.status = res.status;
    out.finalUrl = res.url;
    out.contentType = res.headers.get('content-type');
    out.server = res.headers.get('server');
    if ((out.contentType || '').includes('pdf')) {
      out.bytes = (await res.arrayBuffer()).byteLength;
      return out;
    }
    const html = await res.text();
    out.bytes = html.length;
    out.title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]
      ?.trim()
      .slice(0, 200);
    // Links whose text or href mentions maintenance/service/intervals — the
    // page the real sync needs is one of these, by observation not guess.
    const links = [];
    const re = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(html)) && links.length < 40) {
      const label = textOf(m[2]).slice(0, 120);
      if (/maint|service|interval|tire|filter|brake/i.test(label + m[1])) {
        links.push({ href: new URL(m[1], res.url).href, label });
      }
    }
    out.candidateLinks = links;
    const text = textOf(html);
    const at = text.search(/interval/i);
    out.intervalExcerpt =
      at < 0 ? null : text.slice(Math.max(0, at - 400), at + 2600);
    out.head = text.slice(0, 600);
  } catch (err) {
    out.error = String(err?.message || err);
  }
  return out;
}

export async function GET() {
  const index = await probe(INDEX_URL);
  const results = [index];
  const seen = new Set([INDEX_URL]);
  const follow = (index.candidateLinks || [])
    .map((l) => l.href.split('#')[0])
    .filter((href) => {
      try {
        return new URL(href).host === ALLOWED_HOST && !seen.has(href);
      } catch {
        return false;
      }
    })
    .filter((href) => (seen.has(href) ? false : seen.add(href)))
    .slice(0, FOLLOW_LIMIT);
  for (const href of follow) results.push(await probe(href));
  return Response.json({ probedAt: new Date().toISOString(), results });
}
