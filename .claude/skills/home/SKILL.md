---
name: home
description: Home dashboard rules — the cached time-of-day hero photo, the unattributed daily quote, and no fabricated Home metrics — use when working on `app/page.jsx`, `components/HomeHero.jsx`, `lib/time-of-day.js`, `lib/quotes.js`, or `app/api/hero-image/route.js`
---

## Home

**Home's hero photo changes with the time of day — cached, never per-load, and honest.** The Home hero shows a scenic Unsplash photo matching the viewer's local time band (Dawn 5–8 / Day 8–17 / Golden 17–20 / Night 20–5 — `lib/time-of-day.js`). The client picks the band from its own clock and calls `/api/hero-image?band=…`, which caches one photo per band per calendar day in `hero_image` — so a page load never hits Unsplash unless that band hasn't been fetched yet today (same discipline as the trip photo). No key / no result falls back to a per-band CSS gradient — never a broken image. The greeting uses `timeOfDayGreeting`; the quote is a generic, **unattributed** line from `lib/quotes.js` rotating once a day (John's call — no personal byline). Do **not** add fabricated Home metrics (a "daily focus %", per-card progress rings, weather) — they have no data source, the same reason the Language "weekly goal" ring was deleted; a Home stat must come from real data or not appear.
