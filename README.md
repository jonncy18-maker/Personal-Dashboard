# Personal Dashboard

A single home for John's personal planning: AI project status, travel, schedules, language learning progress, an idea backlog, and email triage.

## What this is

Six domains, one dashboard:

1. **AI Projects** — live deployment status (via Vercel API) for personal projects, plus a "Next Up" line parsed from each repo's `ROADMAP.md`
2. **Travel** — trip records + AI-assisted itinerary import from Gmail
3. **Schedules** — cross-domain "things to do by a date," optionally linked to a trip or project
4. **Language Learning** — mostly a placeholder; one live card shows the next Spanish tutor call (Google Calendar)
5. **Idea Board** — a running backlog of ideas ("someday/maybe," no due date)
6. **Email** — read-only Gmail triage with a two-tier hide-rule system

The home page (`/`) shows a status card per domain (7 routes, 6 domains); each links into that domain's full page.

## Stack

Next.js (App Router) · JavaScript · Vercel · Neon (Postgres) · Claude Haiku (narrow AI use) · Google (Calendar + Gmail, read-only)

Single-user, private — **no auth layer by design** (see `CLAUDE.md`). See `CLAUDE.md` for architecture, environment variables, and build conventions; `ARCHITECTURE.md` for the system map; and `STACK_BLUEPRINT.md` for the canonical stack reference this project was scaffolded from.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL, ANTHROPIC_API_KEY, VERCEL_API_TOKEN,
                             # GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN, NEXT_PUBLIC_APP_URL
npm run dev
```

Database: run `neon/schema.sql` once against a fresh Neon project.

## Deployment

Deployed on Vercel via its native Git integration (no CI workflow). All environment variables must be set for **both Production and Preview** — see `CLAUDE.md` → Environment Variables for the gotcha this causes if skipped.

## Status

Greenfield — scoped July 2026. AI Projects is the most built-out domain; Travel, Schedules, and Language Learning start minimal and grow as real usage clarifies what each needs.
