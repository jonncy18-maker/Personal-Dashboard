-- 008_project_category.sql — AI Projects: a manual category per project.
--
-- The auto-detected primary language ("JavaScript") is useless as a label when
-- every repo is JS, so the card's category line is set by hand instead. Stored
-- as free text (no CHECK) so the option list (Mission / Personal /
-- Infrastructure / Client / Learning) can change in the frontend without a
-- migration. Nullable — a project can be uncategorized.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS category text;
