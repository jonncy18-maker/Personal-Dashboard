# Personal Context — John

This file supplements the project-level CLAUDE.md. It's not about *this repo's* rules —
it's about *me* as the builder, so that when you review code, suggest features, or flag
gaps, you can weigh them against my actual goals, constraints, and taste — not just
generic best practice.

Use this when I ask you to "review this against what you know about me," audit a repo
for fit, or suggest what to add/refine next.

## Who I am, in this context

I'm a solo, non-coder "vibe coder." I don't write code myself — I direct AI (you) as my
engineering layer while I act as architect and product owner. My value-add is domain
expertise and product judgment, not implementation. When you review my repos, don't
assume I'll parse a deep technical explanation the same way a developer would — explain
*why it matters for the product*, not just *what the code does*.

I typically have multiple live projects going at once, built and maintained through
Claude Code. Don't assume any particular project name or purpose is permanent — ask or
check the repo itself for current context rather than relying on a fixed list.

## Working setup & constraints

- Primary interfaces: **Claude Code web**, **Claude Cowork web**, and **Claude chat
  web**.
- Devices: **Acer Chromebook Plus 714 Spin** as my main machine; **Lenovo Chromebook
  Flex 3i** (non-Plus) when I'm on the go or working from bed.
- Model preference: **Sonnet by default**. I escalate to **Opus** or **Fable** for more
  complicated/high-stakes work. Don't over-recommend top-tier model changes for routine
  stuff.
- Infra: **GitHub**, **Neon** (Postgres + Neon Auth), and **Vercel** are permanent parts
  of my stack. I use API keys managed through Vercel. Flag anything that would push a
  project toward unnecessary added infra or cost, since I actively try to keep my stack
  lean and consolidated.
- GitHub: `jonncy18-maker`.

## What I actually care about when you review a repo

1. **Product fit over code elegance.** I'd rather hear "this feature doesn't serve your
   actual use case" than "this function could be refactored." Flag scope creep or
   unused complexity before flagging style.
2. **Cost and infra discipline.** Anything that risks quietly adding new paid
   dependencies, unnecessary services, or infra outside my core stack (GitHub, Neon,
   Vercel) should be called out explicitly.
3. **Longevity over cleverness.** I think in terms of separation of concerns, clear
   roles, and building for the long haul — even tolerating some ambiguity now if it
   compounds well later. Don't over-optimize for short-term speed at the cost of a
   maintainable structure I can keep directing without you.
4. **Real usage over hypothetical usage.** My projects tend to be things I actually use
   day to day. Suggestions should bias toward "what would actually help John use this
   tomorrow" over speculative features nobody's asked for.

## Things worth knowing that might surface as relevant

- I'm a heavy comprehensible-input language learner myself (C1 Spanish, ~2,000+ input
  hours; building French at A2). If a repo touches language learning, pedagogy
  assumptions matter — I lean CI-method over traditional grammar-first design.
- I run NextGen Nurses, a nursing scholarship program for family in Cebu — where
  relevant, the domain expertise behind related projects comes from running this
  operationally for years, not from a generic market read.
- My day job is FP&A/OCFO consulting (CrossCountry Consulting) — separate enterprise
  Claude account, no client data should ever be assumed present here.

## How to use this file

When I ask for a repo review "against what you know about me":
1. Read this file plus the project's own CLAUDE.md.
2. Actually inspect the repo (structure, README, recent commits, TODOs).
3. Give me a short list of **specific, concrete suggestions** — things to add, refine,
   or reconsider — each tied to one of the priorities above, not generic advice.
4. Flag anything that seems like scope creep or unnecessary added infra/cost explicitly.
