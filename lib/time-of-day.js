// Time-of-day bands for the Home hero. Shared by the client (which picks the
// band from the viewer's local clock) and the /api/hero-image route (which
// fetches + caches one photo per band per day). Ranges are John's local time,
// chosen 2026-07-16: Dawn 5–8, Day 8–17, Golden 17–20, Night 20–5.

export const TIME_BANDS = ['dawn', 'day', 'golden', 'night'];

export function timeBand(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 17) return 'day';
  if (h >= 17 && h < 20) return 'golden';
  return 'night';
}

// Looping hero video per band: short clips generated in Google Flow, then
// encoded here (1600 px, no audio) with a poster frame. Day's take barely
// changes over 8 s, so it's a 7 s loop with a 1 s crossfade seam; Dawn,
// Golden and Night change too much for a crossfade to hide, so they
// ping-pong (forward, then reversed) into a ~16 s loop.
// MP4 (H.264) first for Safari; WebM (VP9) for browsers built without H.264.
// A band with no entry keeps the cached Unsplash photo from /api/hero-image,
// so bands can switch to video one at a time as their clips are made.
//
// `focus` is the clip's vertical object-position. The wide desktop hero only
// shows a middle band of a 16:9 clip, and each take's horizon sits at a
// different height (Day ~56% of the frame, Golden ~61%, Dawn ~65%, Night
// ~70%); these put the horizon a little below the hero's middle so the
// lake's reflection survives the crop.
const clip = (band, focus) => ({
  mp4: `/hero/${band}.mp4`,
  webm: `/hero/${band}.webm`,
  poster: `/hero/${band}.jpg`,
  focus,
});
export const BAND_VIDEO = {
  dawn: clip('dawn', '73%'),
  day: clip('day', '57%'),
  golden: clip('golden', '72%'),
  night: clip('night', '82%'),
};

// Curated Unsplash search query per band — a real place/mood, so the photo
// matches the time of day (not a generic "nature" grab-bag).
export const BAND_QUERY = {
  dawn: 'sunrise mountains landscape',
  day: 'blue sky mountains landscape',
  golden: 'golden hour mountains landscape',
  night: 'starry night sky landscape',
};
