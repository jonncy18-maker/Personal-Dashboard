-- 006_hero_image.sql — Home time-of-day hero photo cache.
--
-- The Home hero shows a scenic photo matching the current time band (dawn /
-- day / golden / night — see lib/time-of-day.js). Fetched from Unsplash one
-- time per band per calendar day and cached here, so a page load never hits
-- the Unsplash API (same discipline as the trip photo and the AI brief). A
-- cache miss with no key / no result just leaves the hero on its gradient
-- fallback — never a broken image.

CREATE TABLE IF NOT EXISTS hero_image (
  band               text NOT NULL,
  day                date NOT NULL,
  image_url          text,
  image_attribution  text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (band, day)
);
