-- 012_email_todos.sql — "To-do's" flagged from the Email module.
--
-- John flags an inbox email as a to-do from within /email. Gmail is read-only
-- by hard rule (CLAUDE.md §2/§7), so — exactly like email_hidden — the flag
-- lives here in our own DB and never touches the real mailbox (no star is
-- written back to Gmail).
--
-- We snapshot the email's subject/sender/snippet at flag time so the Home hero
-- can render the To-do's list straight from this table, with NO live Gmail
-- call on page load (same "never per page load" discipline as the trip photo,
-- hero image, and AI brief). The snapshot is intentionally frozen — a to-do is
-- a note-to-self, not a live mirror of the thread.
--
-- Dismissible: `done_at` stamps completion instead of deleting the row, so a
-- completed to-do can still be un-done. The hero shows only done_at IS NULL.

CREATE TABLE IF NOT EXISTS email_todos (
  gmail_message_id  text PRIMARY KEY,
  subject           text,
  sender            text,
  snippet           text,
  flagged_at        timestamptz NOT NULL DEFAULT now(),
  done_at           timestamptz
);
CREATE INDEX IF NOT EXISTS email_todos_open_idx
  ON email_todos (flagged_at DESC) WHERE done_at IS NULL;
