-- 007_project_meta.sql — AI Projects: a light manual layer GitHub can't know.
--
-- The redesigned AI Projects view leans on real GitHub/Vercel data (description,
-- language, topics, last commit, open issues, deploy status, and progress from
-- a repo's open milestone). Two things have no source outside John's own head,
-- so they live here as a small manual layer he maintains per project:
--   • status  — lifecycle, drives the tabs + the top counts.
--   • featured — which project gets the featured panel (at most one).

ALTER TABLE projects ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('planning', 'active', 'needs_attention', 'on_hold', 'blocked', 'completed'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;
