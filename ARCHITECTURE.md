# Personal Dashboard — Architecture

_Last updated: 2026-07-13 · Greenfield scaffold. This is a living stub: the settled boundaries below are real; wherever it says "Build fills in," the actual paths/behavior get written during implementation._

---

## What This App Does

A private, single-user planning hub for John. One home page shows a status card per domain; each card links into that domain's full page. Six domains across seven routes: AI Projects, Travel, Schedules, Language Learning, Idea Board, Email. Plus a `/calendar` view — a read-only month view of Google Calendar, a cross-cutting surface rather than a new data domain (it owns no table). Email additionally feeds the Home hero's "To-do's" block: emails John flags become to-do's stored locally in `email_todos` (Gmail stays read-only — no star is written back).

No public access, no multi-user model — **no auth layer** (see `CLAUDE.md` §7).

## System Overview

```
┌───────────────────────────────────────────────────────────────┐
│                  Vercel Hosting — Next.js (App Router)          │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  BROWSER — React (App Router pages, one per domain)        │ │
│  │  Calls OWN same-origin app/api/* handlers — never a        │ │
│  │  third-party API directly.                                 │ │
│  └───────────────────────────┬──────────────────────────────┘ │
│                              │                                 │
│  ┌───────────────────────────▼──────────────────────────────┐ │
│  │  app/api/* route handlers — SECRETS LIVE HERE ONLY         │ │
│  │  vercel · github · calendar · gmail · email-rules ·        │ │
│  │  email-onboarding · travel-import (live) · schedules      │ │
│  └──┬────────┬────────┬────────┬────────┬───────────────────┘ │
└─────┼────────┼────────┼────────┼────────┼──────────────────────┘
      │        │        │        │        │
 ┌────▼───┐ ┌──▼────┐ ┌─▼─────┐ ┌▼──────┐ ┌▼──────────┐
 │  Neon  │ │Vercel │ │GitHub │ │Google │ │ Anthropic │
 │Postgres│ │ API   │ │(public│ │Cal +  │ │ Haiku     │
 │        │ │(RO)   │ │ RO)   │ │Gmail  │ │ (narrow)  │
 └────────┘ └───────┘ └───────┘ │(RO)   │ └───────────┘
                                └───────┘
```

All external calls are **read-only** except writes to this app's own Neon DB.

## Domain → Route → Data Source Map

| Domain      | Route          | Data sources                                                           | AI?                          |
| ----------- | -------------- | ---------------------------------------------------------------------- | ---------------------------- |
| Home        | `/`            | Neon (summary counts per domain)                                       | No                           |
| AI Projects | `/ai-projects` | Vercel API (deploy status) + GitHub (`## Next Up`) + Neon (`projects`) | No                           |
| Travel      | `/travel`      | Neon (`trips`) + Gmail (itinerary import)                              | Haiku — import parse only    |
| Schedules   | `/schedules`   | Neon (`schedules`)                                                     | No                           |
| Calendar    | `/calendar`    | Google Calendar (read-only month window)                               | No                           |
| Language    | `/language`    | Google Calendar (next tutor call) + Gmail (italki booking scan)        | No                           |
| Idea Board  | `/ideas`       | Neon (`ideas`)                                                         | No                           |
| Email       | `/email`       | Gmail (read-only) + Neon (`email_rules`, `email_hidden`, `email_todos`, `app_flags`) | Haiku — Tier 2 residual only |

## Secret Isolation Boundary

Every secret-bearing call lives in a server-side `app/api/*` route handler. The browser holds no keys and never contacts Vercel, GitHub, Google, or Anthropic directly. No secret env var carries a `NEXT_PUBLIC_` prefix. See `CLAUDE.md` §2.

## Data Model

Current tables live in `neon/schema.sql` (canonical). Settled domains have tables; Language Learning intentionally has none yet. Migration convention in `CLAUDE.md` §6.

## The Three AI Patterns (kept distinct)

1. **Email Tier 1** — no AI. Deterministic sender-rule from the email header.
2. **Email Tier 2** — Haiku, _only_ for the semantic residual Gmail's native categories can't express. Ongoing small per-email cost.
3. **Travel import** — Haiku, one-shot extraction-and-confirm from a Gmail itinerary email. Always previewed before save.

_(Build fills in: exact request/response shapes, error/fallback handling, and any caching of Vercel/GitHub responses.)_
