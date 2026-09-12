---
name: geocoding
description: Geocoding rules — the Google Geocoding API (not Nominatim), shared by Travel and Mileage — use when working on `lib/geocode.js`, `lib/route-distance.js`, `app/api/trip-map/`, or `app/api/mileage/geocode-suggest/`
---

## Geocoding

**Geocoding runs on the Google Geocoding API, not the free Nominatim it started on (switched 2026-08-26).** `lib/geocode.js` is the one module every geocode/reverse-geocode call in the app goes through (Travel's trip map + country stats, Mileage's places/trip-journal/usual-legs) — the switch is transparent to every caller since the function signatures and `'ok'/'none'/'error'` status contract didn't change. Root cause: Nominatim's community-maintained OSM data has real coverage gaps for rural residential addresses (confirmed via runtime logs — a real address came back "no matches" while nearby indexed businesses resolved fine), which broke Mileage's Favorite places in practice. John's call: Google's free monthly credit comfortably covers this app's single-user volume, so the reliability trade is worth it. Requires `GOOGLE_MAPS_API_KEY` (§2); a missing/invalid key fails soft to `'error'`, same as any other transient failure — never a crash. **Scope note:** this supersedes the "deliberately not Google Maps" language on the Mileage bullets below for _geocoding specifically_ — OSRM driving-distance routing, the static world-map SVG, and the "no paid map-tile provider" rule are all unchanged and still free/keyless.
