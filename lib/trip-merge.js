// Trip merging — pure functions, no DB access, shared by every place trips
// are counted or listed (mirrors lib/pto.js / lib/mileage.js's shape). The
// problem this solves: a single real trip (e.g. a Dec 31 departure through
// Singapore, Cebu, and Taiwan, plus a not-yet-booked JFK leg) can land in
// `trips` as several separate rows — one per booking confirmation the Gmail
// scan or a manual add picked up. Left alone, each row counts its own PTO
// days, its own "upcoming trip", its own Travel Stats nights — silently
// double- (or triple-, quadruple-) counting one real trip.
//
// The fix is row-level, not a rewrite of the itinerary editor's existing
// per-day "Leg" grouping (that's a label on days *within* one trip's
// itinerary — unrelated to this). A leg row here keeps its own id, itinerary,
// notes, and budget; `merged_into_id` just says "this row's dates/PTO are
// accounted for under that other trip instead of on its own." Merging never
// deletes or rewrites a leg's own data — unmerging (nulling merged_into_id)
// always restores it to a fully standalone trip exactly as it was.
//
// A merge is one level deep by design: a leg cannot itself have legs
// (validated at merge time in app/api/trips/merge). Chained/nested merges
// would make "is this trip counted" require walking a chain instead of one
// lookup — not worth it for what is, in practice, always a flat group of
// bookings for one journey.

function isLeg(trip) {
  return trip.merged_into_id != null;
}

// Earliest start / latest end across a root trip and its legs, skipping any
// leg with no dates yet (an unbooked leg — e.g. the JFK flight not yet
// purchased — never narrows or breaks the range; it just doesn't extend it
// until it has dates). Returns the root's own dates unchanged when there are
// no legs, so collapsing a trip with no merges is always a no-op.
export function mergedDateRange(root, legs) {
  let start = root.start_date || null;
  let end = root.end_date || null;
  for (const leg of legs) {
    if (leg.start_date && (!start || leg.start_date < start))
      start = leg.start_date;
    if (leg.end_date && (!end || leg.end_date > end)) end = leg.end_date;
  }
  return { start_date: start, end_date: end };
}

// Collapses a flat trip list into one row per real trip: every leg
// (merged_into_id set) is folded into its parent and dropped from the
// returned list, and the parent's start_date/end_date are widened to the
// merged range so every existing consumer (PTO math, Travel Stats, the Home
// trip count, the /travel list) keeps working against a flat array of
// "trips" with no change to its own logic — it just never sees the
// double-counted legs. Each returned root gets `legs` (the raw leg rows, for
// UI display) and `is_merged` (legs.length > 0). A leg whose parent has since
// been deleted (merged_into_id nulled by ON DELETE SET NULL) is simply not a
// leg anymore and passes through as its own root — no orphaning possible.
export function collapseMergedTrips(trips) {
  const list = trips || [];
  const legsByParent = new Map();
  for (const t of list) {
    if (!isLeg(t)) continue;
    if (!legsByParent.has(t.merged_into_id))
      legsByParent.set(t.merged_into_id, []);
    legsByParent.get(t.merged_into_id).push(t);
  }
  return list
    .filter((t) => !isLeg(t))
    .map((root) => {
      const legs = legsByParent.get(root.id) || [];
      if (legs.length === 0) return { ...root, legs: [], is_merged: false };
      const range = mergedDateRange(root, legs);
      return { ...root, ...range, legs, is_merged: true };
    });
}

const DAY_MS = 24 * 60 * 60 * 1000;
function toDays(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`).getTime() / DAY_MS;
}

// Gap in days between two [start,end] ranges — 0 or negative means they
// overlap. Used to suggest "this is probably the same trip" candidates,
// never to merge automatically (John always confirms — same discipline as
// every other AI/heuristic suggestion in this app).
function rangeGapDays(aStart, aEnd, bStart, bEnd) {
  const as = toDays(aStart);
  const ae = toDays(aEnd || aStart);
  const bs = toDays(bStart);
  const be = toDays(bEnd || bStart);
  if (ae < bs) return bs - ae;
  if (be < as) return as - be;
  return 0; // overlapping
}

// Candidate existing trips a new/incoming trip (subject: {destination,
// start_date, end_date}, id optional to exclude itself) might actually be
// part of. Only dated, non-leg, non-wishlist trips are eligible parents — a
// leg can't itself gain legs, and "wishlist" has no firm dates to compare
// against. `withinDays` (default 5) is deliberately tight: this is meant to
// catch "connecting flight into a cruise that starts the next day," not
// loosely group unrelated trips a couple weeks apart. Sorted closest-gap
// first; the caller decides how many to show.
export function findMergeCandidates(subject, trips, { withinDays = 5 } = {}) {
  if (!subject.start_date) return [];
  const end = subject.end_date || subject.start_date;
  return (trips || [])
    .filter((t) => t.id !== subject.id)
    .filter((t) => !isLeg(t))
    .filter((t) => t.status !== 'wishlist')
    .filter((t) => t.start_date)
    .map((t) => ({
      trip: t,
      gapDays: rangeGapDays(
        subject.start_date,
        end,
        t.start_date,
        t.end_date || t.start_date
      ),
    }))
    .filter((c) => c.gapDays <= withinDays)
    .sort((a, b) => a.gapDays - b.gapDays)
    .map((c) => ({
      id: c.trip.id,
      destination: c.trip.destination,
      start_date: c.trip.start_date,
      end_date: c.trip.end_date,
      gapDays: c.gapDays,
    }));
}
