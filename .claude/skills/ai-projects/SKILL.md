---
name: ai-projects
description: AI Projects rules — GitHub vs Vercel separation, no auto-detection on Add Project, and the thin manual layer with no fabricated metrics — use when working on `app/ai-projects/page.jsx`, `app/api/projects/`, `lib/projects.js`, `lib/github.js`, or `lib/vercel.js`
---

## AI Projects

**Don't conflate GitHub and Vercel in AI Projects.** Vercel sources deploy status + live URL. GitHub sources the "Next Up" line, parsed from a standardized `## Next Up` section at the top of that repo's `ROADMAP.md`. Two separate API calls, two purposes — don't merge them into one data-model field or one fetch. _(Cross-repo dependency: this `## Next Up` convention does not yet exist in any sibling repo — see §10.)_

**"Add Project" has no auto-detection — deliberately rejected.** Two explicit fields (GitHub URL required, Vercel URL optional). Do not scan Vercel projects to match a pasted GitHub URL.

**AI Projects is mostly GitHub/Vercel-derived, with a thin manual layer — and no fabricated metrics.** The redesigned view (`/api/projects/overview` aggregates it server-side via `lib/github.js` + `lib/vercel.js`) shows real data: repo description, language + **topics** (the tech chip/badges), **last commit** + relative time, open issues, deploy status (a live dot on each row), a **real Recent Activity feed** (commits + deploys merged), and **progress from a repo's open GitHub milestone** (closed ÷ total issues — shown only where a milestone exists; no milestone = no bar, honestly). The things GitHub can't know live in `projects` as a small manual layer: **`status`** (lifecycle — drives the tabs + the top counts) and **`featured`** (at most one; the featured panel) from migration 007, and **`category`** (a manual label like Mission/Client — the auto language is useless when every repo is JS; free text, migration 008) — all edited in the row's hover popover. Do **not** invent a "progress %", "daily focus", or "↑ N% this week" trend for a project — same rule as everywhere else: a metric comes from real data (GitHub/Vercel/milestone) or a field John maintains, never a hardcoded number.
