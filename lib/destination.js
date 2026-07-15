// Shared destination-word cleaning. A trip named "Panama Cruise" should search
// for the real place ("Panama"), not the generic trip-type word ("Cruise") —
// which would return every cruise-ship photo (or every cruise email). Used by
// both the Unsplash photo query (lib/unsplash.js) and the Gmail itinerary-import
// search anchor (app/api/travel-import), so the two can't drift.

export const GENERIC_DEST_WORDS = new Set([
  'cruise',
  'trip',
  'vacation',
  'holiday',
  'tour',
  'getaway',
  'trek',
  'expedition',
  'the',
  'and',
]);

// The destination's real place-words, generic trip-type words stripped.
// Falls back to the raw words if stripping would leave nothing (e.g. a trip
// literally named "Cruise").
export function meaningfulWords(destination) {
  const words = (destination || '').split(/[,\s]+/).filter(Boolean);
  const kept = words.filter((w) => !GENERIC_DEST_WORDS.has(w.toLowerCase()));
  return kept.length ? kept : words;
}

// A cleaned query string for a photo search — all place-words, generic words
// dropped (e.g. "Panama Cruise" → "Panama", "Juneau, Alaska" → "Juneau Alaska").
export function cleanDestination(destination) {
  return meaningfulWords(destination).join(' ');
}
