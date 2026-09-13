import { dateOnly } from './db';
import { meaningfulWords } from './destination';

// Shared between the weekly trip-scan (app/api/trip-scan, 30-day lookback)
// and the one-time historical import (app/api/trip-history-scan) — same
// search vocabulary, same "is this candidate already accounted for" dedupe,
// so the two scans can never disagree about what counts as a trip email.

// High-precision travel PHRASES, not bare words — see app/api/trip-scan for
// the full rationale (a bare-word query matched every order receipt and bank
// alert and truncated real older confirmations under the candidate cap).
export const SEARCH_TERMS = [
  '"booking confirmation"',
  '"flight confirmation"',
  '"trip confirmation"',
  '"travel confirmation"',
  '"reservation confirmation"',
  '"hotel confirmation"',
  '"cruise confirmation"',
  '"e-ticket"',
  '"boarding pass"',
  '"your itinerary"',
  '"travel itinerary"',
  '"flight itinerary"',
  'itinerary',
];

// Travel brands whose booking-bearing mail arrives through their MARKETING
// stream (category:promotions), which the primary query excludes — see
// app/api/trip-scan for the Celebrity Beyond case that surfaced this.
export const TRAVEL_SENDER_DOMAINS = [
  'celebritycruises.com',
  'royalcaribbean.com',
  'royalcaribbeanmarketing.com',
  'princess.com',
  'hollandamerica.com',
  'ncl.com',
  'carnival.com',
  'virginvoyages.com',
  'vikingcruises.com',
  'expediacruises.com',
  'delta.com',
  'aa.com',
  'united.com',
  'southwest.com',
  'flybreeze.com',
  'marriott.com',
  'hilton.com',
  'booking.com',
  'expedia.com',
  'airbnb.com',
];

export const MIN_CONFIDENCE = 0.6;
// The reservation block sits well into these marketing emails (measured at
// char 10,233 of 13,509 in a real Celebrity sale email) — widen past the
// shared default so it isn't clipped.
export const BODY_LIMIT = 20000;
export const DETECT_CONCURRENCY = 4;

function keywordGroup() {
  return `(${SEARCH_TERMS.join(' OR ')})`;
}

export function primaryQuery(afterStamp) {
  return `${keywordGroup()} after:${afterStamp} -category:promotions -category:social`;
}

export function travelSenderQuery(domain, afterStamp) {
  return `${keywordGroup()} after:${afterStamp} from:${domain}`;
}

export function dateStamp(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

// A dead/revoked GOOGLE_REFRESH_TOKEN fails every query identically — told
// apart from "this one query errored" so a scan never reports a confident
// "no new trips" over a run that never reached Gmail.
export function isAuthFailure(err) {
  const message = String(err?.message || '');
  const status = err?.response?.status ?? err?.code;
  return (
    message.includes('invalid_grant') ||
    message.includes('invalid_client') ||
    message.includes('unauthorized_client') ||
    status === 401 ||
    status === 403
  );
}

export async function mapWithConcurrency(items, limit, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    out.push(...(await Promise.all(batch.map(fn))));
  }
  return out;
}

// Skip a candidate if something already known plainly covers it: dates
// overlap AND the destinations share a real place-word. `known` is real
// trips plus every prior suggestion (pending, approved, or dismissed) plus
// anything created earlier in this same run — see app/api/trip-scan for why
// suggestions must be included (one booking is echoed by dozens of marketing
// emails, each a distinct Gmail id).
export function matchesKnownTrip(cand, known) {
  const candWords = new Set(
    meaningfulWords(cand.destination).map((w) => w.toLowerCase())
  );
  return known.some((t) => {
    const shareWord = meaningfulWords(t.destination).some((w) =>
      candWords.has(w.toLowerCase())
    );
    if (!shareWord) return false;
    if (!cand.start_date || !t.start_date) return true;
    const cs = dateOnly(cand.start_date);
    const ce = dateOnly(cand.end_date || cand.start_date);
    const ts = dateOnly(t.start_date);
    const te = dateOnly(t.end_date || t.start_date);
    return cs <= te && ts <= ce; // range overlap
  });
}
