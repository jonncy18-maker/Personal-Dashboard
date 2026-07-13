-- Personal Dashboard — Migration 002 (trip images)
--
-- Supports Travel's auto-fetch + manual-override destination photo (see
-- CLAUDE.md Travel section). image_source distinguishes an auto-fetched photo
-- from a manually chosen one so a later auto re-fetch never clobbers an
-- override. Attribution is required by Unsplash's API terms.

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS image_attribution text,
  ADD COLUMN IF NOT EXISTS image_source text NOT NULL DEFAULT 'auto'
    CHECK (image_source IN ('auto', 'manual'));
