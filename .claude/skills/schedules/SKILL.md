---
name: schedules
description: Schedules rules — the AI screenshot import (Haiku), server-clock relative dates, and its never-auto-save preview — use when working on `app/schedules/page.jsx`, `lib/schedule-import.js`, `app/api/schedule-import/`, or `app/api/schedules/`
---

## Schedules

**Schedules' AI screenshot import is the app's fifth distinct AI use — Haiku, narrowly scoped.** `lib/schedule-import.js` (via `/api/schedule-import`) reads a screenshot of _anything_ with an actionable item in it (a text message, a to-do app, a note, an email snippet) and returns candidate `{title, due_date, notes}` tasks — unlike French's import (one known source, one fixed shape), the source here is arbitrary, so a single screenshot may yield zero, one, or several tasks. Relative dates ("tomorrow", "next Friday") are resolved against the **server's** clock, passed into the prompt — never the client's, and never invented if no date is stated or inferable. Same **never-auto-save** discipline as every other AI import in this app: John reviews/edits/removes each candidate in a popup (`ImportPreviewPopup` in `app/schedules/page.jsx`), and only the existing `/api/schedules` POST — unchanged, one call per confirmed task — ever creates a row. No new persistence path exists just for this.

**The page groups by time, and finished work steps back.** Open tasks are grouped Overdue / This week / Later (or by linked trip/project — a per-browser view choice), done tasks collapse into "Completed", and a page with nothing open says **All clear** rather than showing a wall of struck-through rows. Delete is deferred behind an Undo toast (the DELETE fires after the window or on unmount; a failed DELETE restores the row) — keep that, don't return to a one-click permanent delete. "Done <date>" is read from `updated_at` (there's no `completed_at`); show it as a date only, and add a real column before building anything that needs completion times to be exact.
