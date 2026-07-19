-- French hours-log (screenshot-based Haiku import, CLAUDE.md §7) + a per-
-- language freeform note (Spanish's "maintenance mode" line — no metric,
-- since Spanish immersion is ambient/daily and not something John logs
-- hours for). See ROADMAP 2026-07-19.

CREATE TABLE IF NOT EXISTS french_hours_daily (
  log_date    date PRIMARY KEY,
  hours       numeric NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS french_hours_daily_set_updated_at ON french_hours_daily;
CREATE TRIGGER french_hours_daily_set_updated_at
  BEFORE UPDATE ON french_hours_daily FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Singleton cache of the headline "as of" total — Dreaming French's own
-- cumulative total, kept separate from french_hours_daily's SUM() because a
-- screenshot rarely shows full history, so summing the daily log would
-- understate real progress. Populated by the same screenshot import that
-- populates the daily rows (see app/api/french-progress/save).
CREATE TABLE IF NOT EXISTS french_hours_summary (
  id          smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  total_hours numeric NOT NULL,
  as_of_date  date NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS french_hours_summary_set_updated_at ON french_hours_summary;
CREATE TRIGGER french_hours_summary_set_updated_at
  BEFORE UPDATE ON french_hours_summary FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Freeform per-language note — Spanish's editable "maintenance mode" line
-- (phone/podcasts/music/tutor calls: already-ambient immersion with no
-- hours metric to log). Generic enough to hold a French note too, though
-- French doesn't need one today.
CREATE TABLE IF NOT EXISTS language_notes (
  language    text PRIMARY KEY CHECK (language IN ('spanish', 'french')),
  note        text NOT NULL DEFAULT '',
  updated_at  timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS language_notes_set_updated_at ON language_notes;
CREATE TRIGGER language_notes_set_updated_at
  BEFORE UPDATE ON language_notes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
