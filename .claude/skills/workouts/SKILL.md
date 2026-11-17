---
name: workouts
description: Health › Workouts rules — templates are the plan and sets are the record, unknowns stay unknown (details_complete, the three-valued per_side), the rule-based progression suggestion, goals and constraints kept as data, and the compact MCP read — use when working on `app/health/workouts/`, `lib/workouts.js`, `lib/workouts-data.js`, `app/api/workouts/`, or the Workouts entries in `lib/assistant.js`
---

## Health › Workouts

**Built 2026-11-16 (migration 043), reversing the 2026-09-16 "no training log" decision at John's request.** He now tracks progressive overload per set. The tab sits beside Food under `/health` (`app/health/layout.jsx` adds the tab row; each page keeps its own `PageBanner`).

**Templates are the plan; sets are the record.** A logged set points at an exercise and a session, never at a template row. Editing, reordering or deleting a template therefore cannot change history, and `workout_sessions.name` is copied from the template when the session starts. Keep it that way: never add a foreign key from `workout_sets` to `workout_template_exercises`.

**One row per set.** Two sets of one exercise may differ in weight (35 lb then 30 lb), so there is no "sets × reps" column anywhere in the record. `set_number` restarts per exercise per session; deleting a set renumbers the ones after it.

**Unknowns stay unknown.**

- `details_complete = false` means the workout happened but its exercises and sets were not captured. It counts as a training day and nothing else. Adding sets flips it to true.
- `per_side` is three-valued: `true` (weight and reps are per arm/leg), `false`, or `null` for not confirmed. Never infer it from the exercise name. `setVolume()` doubles only a confirmed `true`; an unconfirmed set counts once, the smaller claim.
- A set with no weight or no reps has no volume (not zero), and `summarizeSets()` reports `volumeComplete: false`. The page then says "at least".
- `duration_min` is only what John stated or what a live session measured. A past session's duration stays null.

**The progression suggestion is a rule, not a model call.** `suggestNext()` in `lib/workouts.js` reads the last completed session for the exercise and the template's target: every prescribed set at the top of the rep range → `increase`; otherwise `hold`; no rep range → `repeat`; no history → `start`. It judges the working weight (`workingWeight()`: the weight most sets used), so one heavier opening set does not set the bar. The page prints the last session's sets beside the verdict. The rule comes from John's own written plan; do not replace it with invented numbers such as a target weight.

**Goals and constraints are data.** `workout_profile` holds John's goals, equipment constraints and target session length as text he maintains. They are not in code because this repo is public and because both AI clients need the same wording. Recommendations in chat come from Claude or ChatGPT reading `get_workouts`; the app itself makes no AI call for workouts.

**MCP: catalog entries, not direct DB tools.** The 17 workout tools are ordinary `CATALOG` entries in `lib/assistant.js` calling `app/api/workouts/*` over same-origin fetch, so hard boundary 5 holds with no new exception. The in-app Assistant, `/api/mcp/app` (Claude) and `/api/chatgpt/mcp` (ChatGPT) all get them from that one list.

**`get_workouts` reads `/api/workouts?compact=1`.** A tool result is capped at 15,000 characters and the full overview passes that with a handful of sessions. `compactOverview()` writes sets as one line per exercise ("60x8, 60x8") and drops ids no tool takes. Set ids, needed only to correct a set, come from `list_workout_sessions` (default 5 sessions for the same reason). If you add fields to the overview, check the compact size.

**Exercises are archived, not deleted, once they have logged sets**, so history keeps a name. Either way the exercise leaves every template.

**Only one session can be in progress.** `POST /api/workouts/sessions` with `status: 'in_progress'` returns 409 with the open session's id.

**Seed data is not in the repo.** Exercises, templates, the schedule and logged sessions were entered through the API. Do not add a seed migration with personal training data.
