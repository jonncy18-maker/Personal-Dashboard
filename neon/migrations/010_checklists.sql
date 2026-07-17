-- 010_checklists.sql — Travel prep checklists (CLAUDE.md Travel domain).
--
-- Reusable packing/prep templates, applied per trip. Two tables:
--   checklist_templates — the master lists John maintains (Philippines/Cruise,
--     Business Travel, Vacation Travel). `items` is an ordered jsonb array of
--     {text, section} — `section` groups items under a header (Toiletries,
--     Tech, Docs, …), the same flat-with-group-label shape as itinerary legs.
--   trip_checklists — a template APPLIED to a trip. Its items are COPIED at
--     apply time into {text, section, done}, so editing a template later never
--     disturbs a past trip's checked state. A trip may hold more than one
--     (e.g. a trip that's both Business and Vacation).
--
-- These hold John's personal packing content, so rows are seeded directly into
-- the database, never committed here — this migration only creates the shape.

CREATE TABLE IF NOT EXISTS checklist_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  items       jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{text, section}]
  position    integer NOT NULL DEFAULT 0,         -- manual sort order
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS checklist_templates_set_updated_at ON checklist_templates;
CREATE TRIGGER checklist_templates_set_updated_at
  BEFORE UPDATE ON checklist_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS trip_checklists (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id      uuid NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  template_id  uuid REFERENCES checklist_templates (id) ON DELETE SET NULL,
  title        text NOT NULL,                     -- snapshot of the template name
  items        jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{text, section, done}]
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trip_checklists_trip_id_idx ON trip_checklists (trip_id);
DROP TRIGGER IF EXISTS trip_checklists_set_updated_at ON trip_checklists;
CREATE TRIGGER trip_checklists_set_updated_at
  BEFORE UPDATE ON trip_checklists FOR EACH ROW EXECUTE FUNCTION set_updated_at();
