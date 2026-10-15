# Project recommendation feed (version 1)

This backend experiment is fixed to `jonncy18-maker/NextGen-Immersion`.
No UI, widget installation, GitHub App, deployment or provisioning is included.

Set `PROJECT_WIDGET_TOKEN` and `CRON_SECRET` independently in **Production and
Preview**. Both fail closed when unset. Keep tokens server-side; never put them
in public widget JavaScript. Existing optional `GITHUB_TOKEN` raises GitHub rate
limits. Existing AI provider configuration is reused: `project-recommendations`
uses pinned GPT-6 Luna when configured, otherwise pinned Haiku, with the existing
provider fallback. Public repository excerpts are sent to that configured AI.
No tools are provided to the model. Repository text is untrusted data.

```sh
curl "$APP_URL/api/projects/recommendations" -H "Authorization: Bearer $PROJECT_WIDGET_TOKEN"
curl -X POST "$APP_URL/api/projects/recommendations/refresh" -H "Authorization: Bearer $PROJECT_WIDGET_TOKEN"
curl "$APP_URL/api/projects/recommendations/refresh" -H "Authorization: Bearer $CRON_SECRET"
curl -X POST "$APP_URL/api/projects/recommendations/feedback" -H "Authorization: Bearer $PROJECT_WIDGET_TOKEN" -H 'Content-Type: application/json' -d '{"id":"CURRENT_RECOMMENDATION_ID","status":"done"}'
```

GET reads only Neon `app_flags`; it never calls GitHub or AI. Responses are
`no-store`. An absent cache is explicitly empty; snapshots become stale after
24 hours or after a failed refresh. A daily cron refresh is configured for 08:30 UTC. Refreshes have a
persistent atomic three-minute lease and a minimum 15-minute interval, including
failed attempts. A failure retains the last successful snapshot and exposes a
generic refresh error. No migration is required. Namespaced v1 keys contain the
snapshot, lease, feedback history and refresh error. There is no arbitrary-key API.

Evidence includes the current commit SHA, commit-pinned ROADMAP excerpts (Next Up,
beginning, Phase 32 when present and recent tail for long files), up to 20 recent
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

Feedback accepts only the current recommendation ID with `done`, `not_now` or
`wrong`. GET suppresses it immediately. Later prompts receive the latest 50 saved actions;
normalized exact action fingerprints are also rejected deterministically.
Semantic paraphrases rely on model judgment and can escape that exact check.
`not_now` snoozes for 24 hours; `done` and `wrong` persistently suppress future
repeats. There is no undo endpoint. GET also checks active feedback fingerprints
so feedback saved during a concurrent refresh still hides the repeated action. Feedback history grows over time.
No recommendation executes work or changes the source repository.
