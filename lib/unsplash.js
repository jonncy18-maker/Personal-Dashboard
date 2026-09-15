import { cleanDestination, meaningfulWords } from './destination';

async function searchUnsplashPhoto(query, key) {
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?per_page=1&query=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Client-ID ${key}` } }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const photo = data.results?.[0];
    if (!photo) return null;

    return {
      image_url: photo.urls?.regular || null,
      image_attribution: photo.user?.name
        ? `${photo.user.name} · Unsplash`
        : 'Unsplash',
    };
  } catch {
    return null;
  }
}

// Server-side only. One call per trip create/edit (never per page load) — see
// CLAUDE.md Travel: "auto-fetches a trip's destination photo." Never generates
// an image; a missing key or a failed search just means no photo, and the UI
// falls back to the plain domain-accent treatment (TripPhoto component).
export async function fetchDestinationPhoto(destination) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  // Query the real place, not generic trip words — "Panama Cruise" → "Panama"
  // returns Panama scenery instead of stock cruise-ship photos.
  const query = cleanDestination(destination);
  if (!key || !query) return null;

  const photo = await searchUnsplashPhoto(query, key);
  if (photo) return photo;

  // A small town's exact name can turn up zero Unsplash results (e.g.
  // "Morehead Kentucky") even though its state/region has plenty — fall
  // back to the last word (the broadest place-word, usually state/country)
  // rather than leaving the trip with no photo at all. Still a real photo
  // of a real place, just less specific; only tried when the exact query
  // found nothing.
  const words = meaningfulWords(destination);
  const broader = words[words.length - 1];
  if (words.length > 1 && broader.toLowerCase() !== query.toLowerCase()) {
    return await searchUnsplashPhoto(broader, key);
  }
  return null;
}

// Server-side only. Like fetchDestinationPhoto but for an already-curated query
// (no destination-word cleaning) — used by the Home time-of-day hero, one call
// per band per day (cached in hero_image), never per page load. Landscape
// orientation for a wide hero. Same "no key / no result = no photo, fall back
// to the gradient" contract.
export async function fetchScenicPhoto(query) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key || !query) return null;

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?per_page=1&orientation=landscape&query=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Client-ID ${key}` } }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const photo = data.results?.[0];
    if (!photo) return null;

    return {
      image_url: photo.urls?.regular || null,
      image_attribution: photo.user?.name
        ? `${photo.user.name} · Unsplash`
        : 'Unsplash',
    };
  } catch {
    return null;
  }
}
