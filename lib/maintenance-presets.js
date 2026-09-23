// Seed lists for the Maintenance tab, keyed by the vehicle profile's model
// (mileage_settings.vehicle_model). Seeding is always an explicit click and
// is idempotent — an item whose name already exists is skipped, never
// duplicated or silently overwritten.
//
// PROVENANCE IS THE POINT OF THIS FILE. Every entry carries the `source` it
// will be stored with, and the rule is absolute: `official` means the value
// was read off the manufacturer's published schedule, `starter` means it is
// an unverified default that the UI labels as such until John confirms it.
// Nothing here may be upgraded to `official` on the strength of a model's
// recollection — only from an observed source.

// Model 3 — transcribed from the Tesla Model 3 Owner's Manual "Service
// Intervals" section, supplied by John as a screenshot on 2026-09-13. Read
// off the page, not recalled.
//
// Two things the source itself forced into the data model:
//
//  1. "Brake fluid health check every  years" — the source states NO number.
//     It is stored with a null interval and rendered as "interval not stated
//     in source". Do not fill this in from memory; it is not a missing
//     transcription, it is what the page says.
//
//  2. Tire rotation and the caliper service both carry triggers the app
//     cannot compute — tread depth, and whether roads are salted where the
//     car is driven. Those go in `condition_note` and are shown as stated
//     conditions, never converted into a due date.
//
// Re-verified 2026-09-23 against a second screenshot from John, this time
// with the page's URL in the address bar (Model 3, 2024+ manual): every
// interval and condition below still matches, word for word, including the
// blank brake-fluid number. MODEL_3_SOURCE_URL is that observed URL. It was
// left null until then because inventing a plausible one would have been
// the same fabrication this file exists to prevent. Tesla's CDN blocks
// server-side fetches (403 from Akamai, from the sandbox and from Vercel
// alike), so re-verifying means John screenshotting this page again.
const MODEL_3_SOURCE_URL =
  'https://www.tesla.com/ownersmanual/model3/en_us/GUID-E95DAAD9-646E-4249-9930-B109ED7B1D91.html';

const MODEL_3 = [
  {
    name: 'Rotate tires',
    interval_miles: 6250,
    interval_months: null,
    condition_note:
      'Or if tread depth difference is 2/32 in (1.5 mm) or greater, whichever comes first.',
    active: true,
    source: 'official',
    source_url: MODEL_3_SOURCE_URL,
  },
  {
    name: 'Cabin air filter replacement',
    interval_miles: null,
    interval_months: 24,
    condition_note: null,
    active: true,
    source: 'official',
    source_url: MODEL_3_SOURCE_URL,
  },
  {
    name: 'Wiper blade replacement',
    interval_miles: null,
    interval_months: 12,
    condition_note: null,
    active: true,
    source: 'official',
    source_url: MODEL_3_SOURCE_URL,
  },
  {
    // Seeded INACTIVE: the source scopes this to salted-winter-road areas,
    // and the app has no basis for knowing where the car is driven.
    // Inferring John's climate would be a fabricated premise; a toggle he
    // flips once is honest and durable.
    name: 'Clean and lubricate brake calipers',
    interval_miles: 12500,
    interval_months: 12,
    condition_note:
      'Only applies in an area where roads are salted during winter. Enable this item if that is where the car is driven.',
    active: false,
    source: 'official',
    source_url: MODEL_3_SOURCE_URL,
  },
  {
    // The source states no interval (see the file header). Stored null so
    // the row renders "interval not stated in source — set it" instead of a
    // guessed number.
    name: 'Brake fluid health check',
    interval_miles: null,
    interval_months: null,
    condition_note:
      'Source states no interval. Replace if necessary. Heavy brake usage — towing, mountain descents, performance driving, especially in hot and humid environments — may require more frequent checks.',
    active: true,
    source: 'official',
    source_url: MODEL_3_SOURCE_URL,
  },
];

const PRESETS = { 'model 3': MODEL_3 };

// Normalizes "Model 3", "model3", " MODEL 3 " to one key. Returns [] for an
// unknown or unset model — the tab then shows an empty state inviting a
// manual add, never another model's schedule.
export function presetsForModel(model) {
  if (!model) return [];
  const key = String(model).trim().toLowerCase().replace(/\s+/g, ' ');
  const list = PRESETS[key] || PRESETS[key.replace(/^tesla /, '')] || [];
  return list.map((entry, i) => ({ ...entry, sort_order: i }));
}

export function hasPresetsForModel(model) {
  return presetsForModel(model).length > 0;
}
