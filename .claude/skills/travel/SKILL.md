---
name: travel
description: Travel domain rules — Gmail itinerary import, destination photos, geocoded map pins, and the retired AI Brief — use when working on `app/travel/page.jsx`, `app/travel/[id]/`, `app/api/trips/`, `app/api/travel-import/`, `app/api/trip-map/`, `lib/travel-import.js`, or `lib/unsplash.js`
---

## Travel

**Travel's itinerary import is a distinct AI use — Haiku, and it stays.** Flow: (1) John triggers import on a trip, (2) Haiku searches Gmail (read-only, same boundary as Email) for a likely confirmation/itinerary email, (3) if confident, parse; if not, ask John to identify the right email, (4) show a **preview for John to confirm/edit before saving** — never auto-save parsed data. This genuinely needs extraction, unlike the email tiers — keep it on Haiku.

**Travel's destination photo is auto-fetched, with manual override — not AI-generated.** On trip create/edit, if `trips.image_source = 'auto'`, a server route queries Unsplash's search API with the cleaned destination and caches the result on the row (`image_url`, `image_attribution`). One call per trip change, never per page load. Never generate an image (DALL·E/etc.) for this — real destination photography is cheaper, faster, and not hallucinated. If John pastes/picks a specific photo, set `image_source = 'manual'` so a later auto-refresh never overwrites it. No result or API failure falls back to the domain's plain accent treatment — never a broken layout.

**Travel's map pins are geocoded, cached on the row — not fetched per load.** On trip create/edit, `lib/geocode.js` resolves the cleaned destination to `trips.latitude`/`longitude`. Same discipline as the photo: one lookup per trip change, cached on the row (`geocoded_at` stamps the attempt so a trip created before this feature backfills exactly once via `/api/trip-map`, never every load). A failed lookup just means no pin — the map skips that trip, never breaks. The world map itself is a static, precomputed SVG path (`components/world-land-path.js`, from public-domain Natural Earth 110m land) projected equirectangularly; **do not** add a paid map-tile provider.

**Travel's AI Brief was retired 2026-09-07 (John's call — "kind of useless").** It briefly existed as a deliberately-scoped Haiku use (`/api/travel-brief` via `lib/travel-brief.js`, a 2–4 sentence summary of upcoming trips grounded strictly in real trip fields, cached in `travel_brief` by signature). Removed during the Travel page's Overview redesign along with its route and lib module — nothing else in the app called it. The `travel_brief` table stays in `schema.sql` unused rather than dropped, per the immutable-migration convention (§6); a future migration could drop it if it's ever worth the churn. Travel's remaining AI use is itinerary import only (still Haiku, see below).

## See also

_Geocoding rules live in `.claude/skills/geocoding/SKILL.md`._
