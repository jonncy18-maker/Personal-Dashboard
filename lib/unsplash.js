import { cleanDestination } from './destination';

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
