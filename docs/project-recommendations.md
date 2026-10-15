# Project recommendation feed (version 1)

This backend feed is fixed to exactly five server-owned projects. It never scans
or imports arbitrary repositories. All repositories belong to `jonncy18-maker`.

| Project slug          | Repository          | Icon label / icon                   |
| --------------------- | ------------------- | ----------------------------------- |
| `nextgen-scholars`    | NextGen-Scholars    | Scholar / `graduation-cap`          |
| `nextgen-immersion`   | NextGen-Immersion   | Listening / `audio-lines`           |
| `ai-capital-planning` | AI-Capital-Planning | Forecast / `chart-no-axes-combined` |
| `agentic-loop`        | Agentic-Loop        | Loop / `repeat-2`                   |
| `ai-harness`          | AI-harness          | Command / `command`                 |

No UI, widget installation, GitHub App, deployment or provisioning is included.

Set `PROJECT_WIDGET_TOKEN` and `CRON_SECRET` independently in **Production and
Preview**. Both fail closed when unset. Keep tokens server-side; never put them
in public widget JavaScript. Existing optional `GITHUB_TOKEN` raises GitHub rate
limits and must have read access to each selected private repository (fine-grained
Contents, Issues, Pull requests and Checks read permissions). Unauthenticated
GitHub access only reads public repositories. Refresh normally makes six bounded
GitHub requests per project, up to 30 for all five, plus one AI call per project
(provider fallback may add a call). GET spends no GitHub or AI budget. Existing AI provider configuration is reused: `project-recommendations`
uses pinned GPT-6 Luna when configured, otherwise pinned Haiku, with the existing
provider fallback. Public repository excerpts are sent to that configured AI.
No tools are provided to the model. Repository text is untrusted data.

```sh
curl "$APP_URL/api/projects/recommendations" -H "Authorization: Bearer $PROJECT_WIDGET_TOKEN"
curl -X POST "$APP_URL/api/projects/recommendations/refresh" -H "Authorization: Bearer $PROJECT_WIDGET_TOKEN"
curl "$APP_URL/api/projects/recommendations/refresh" -H "Authorization: Bearer $CRON_SECRET"
curl -X POST "$APP_URL/api/projects/recommendations/feedback" -H "Authorization: Bearer $PROJECT_WIDGET_TOKEN" -H 'Content-Type: application/json' -d '{"project":"nextgen-immersion","id":"CURRENT_RECOMMENDATION_ID","status":"done"}'
```

GET reads only Neon `app_flags`; it never calls GitHub or AI. Responses are
`no-store`. An absent cache is explicitly empty; snapshots become stale after
24 hours or after a failed refresh. A daily cron refresh is configured for 08:30 UTC. Refreshes have a
persistent atomic 15-minute lease and a minimum 15-minute interval, including
failed attempts. A failure retains the last successful snapshot and exposes a
generic refresh error. No migration is required. Namespaced v1 keys contain the
snapshot, lease, feedback history and refresh error. There is no arbitrary-key API.

Evidence includes the current commit SHA, commit-pinned ROADMAP excerpts (Next Up,
beginning, up to three phase sections referenced by Next Up when available,
and recent tail for long files; maximum 24,000 characters), up to 20 recent
open and 20 recently closed issue API entries, 20 PRs of all states and 20 checks
for that commit. Issue API entries include PRs, so actual issue coverage can be
lower. Each response is limited to 512 KB and timed out after ten seconds.
Required evidence failures prevent generation. A missing ROADMAP is explicitly
warned; other roadmap errors fail refresh. Each source preserves checked time,
commit and source dates. Issue/PR lists are observed at refresh time and are not
an atomic snapshot pinned to that commit. This bounded review is **not exhaustive
history or confirmed ground truth**. A stale plan or completed action outside the
window can still produce an incorrect suggestion. Model output is labeled
`ai_generated`, validated against server-owned source IDs and URLs, and has no
fabricated priority, urgency, time estimate or progress score.

Feedback accepts an optional allowlisted `project` slug and only the current recommendation ID with `done`, `not_now` or
`wrong`. GET suppresses it immediately. Later prompts receive the latest 50 saved actions;
normalized exact action fingerprints are also rejected deterministically.
Semantic paraphrases rely on model judgment and can escape that exact check.
`not_now` snoozes for 24 hours; `done` and `wrong` persistently suppress future
repeats. There is no undo endpoint. GET also checks active feedback fingerprints
so feedback saved during a concurrent refresh still hides the repeated action. Feedback history grows over time.
No recommendation executes work or changes the source repository.

GET without a selector returns `{ version: 1, projects: [...] }` in the fixed
allowlist order. Each card includes stable `id`, project `name`, `repo`, `icon`,
`iconLabel`, `status`, `snapshot`, `recommendation`, `feedback`, `stale` and
`refresh_error`. Individual cache read failure gives an `unavailable` card.
`?project=ai-harness` returns one card. Unknown, empty, duplicate selectors and
unknown query parameters return 400 before DB/network/AI work. Service helpers
called without a project still default to Immersion for compatibility; the GET
route intentionally now defaults to the five-card aggregate.

Refresh with no selector uses the existing daily cron to refresh all five, with
at most five concurrent projects. Each has its own atomic lease, cooldown,
snapshot, error and feedback keys; one failed project cannot discard another's
success. The aggregate response includes project metadata and per-project
`refreshed`, `skipped` or `failed` status: HTTP 200 for success/skips, 207 for
partial failure, and 502 if all five fail. `?project=<slug>` refreshes only that
project (200 on success/skip, 502 on failure). Cron GET uses `CRON_SECRET`; manual
POST uses `PROJECT_WIDGET_TOKEN`; neither token substitutes for the other.
No additional cron, secret activation or deployment is included.

Feedback JSON allows exactly `id`, `status` and optional `project`; missing
`project` defaults to Immersion for old clients. Explicit null/empty/unknown
projects are rejected. Current-ID validation, atomic writes, suppression history,
24-hour snooze and fingerprint checks are isolated by repository. Equal advice
in another repository is independently reviewable. Immersion retains its exact
`project-recommendations:v1:jonncy18-maker/NextGen-Immersion:*` keys, keeping
existing cached snapshots and feedback readable. Advice remains one validated
suggestion per repository with no invented ranking across projects.
