---
name: schedules
description: Schedules rules — the AI screenshot import (Haiku), server-clock relative dates, and its never-auto-save preview — use when working on `app/schedules/page.jsx`, `lib/schedule-import.js`, `app/api/schedule-import/`, or `app/api/schedules/`
---

## Schedules

**Schedules' AI screenshot import is the app's fifth distinct AI use — Haiku, narrowly scoped.** `lib/schedule-import.js` (via `/api/schedule-import`) reads a screenshot of _anything_ with an actionable item in it (a text message, a to-do app, a note, an email snippet) and returns candidate `{title, due_date, notes}` tasks — unlike French's import (one known source, one fixed shape), the source here is arbitrary, so a single screenshot may yield zero, one, or several tasks. Relative dates ("tomorrow", "next Friday") are resolved against the **server's** clock, passed into the prompt — never the client's, and never invented if no date is stated or inferable. Same **never-auto-save** discipline as every other AI import in this app: John reviews/edits/removes each candidate in a popup (`ImportPreviewPopup` in `app/schedules/page.jsx`), and only the existing `/api/schedules` POST — unchanged, one call per confirmed task — ever creates a row. No new persistence path exists just for this.
