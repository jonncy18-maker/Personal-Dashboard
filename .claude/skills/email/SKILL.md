---
name: email
description: Email domain rules — Tier 1 sender rules, Gmail-native categories, the Tier 2 Haiku semantic residual, and the one-time onboarding scan — use when working on `app/email/page.jsx`, `app/api/email-rules/`, `app/api/email-onboarding/`, `app/api/gmail/`, or `lib/email-tier2.js`
---

## Email

**Gmail access is read-only, full stop.** No code path may call a Gmail write/archive/delete/modify endpoint. "Hiding" an email only sets a local flag (`email_hidden`) — the real mailbox is never touched. Hard boundary, not a revisitable default.

**Email is AI-minimal — most of it needs no model:**

- _Tier 1 (sender rules):_ triggered by the "X" button. **No AI.** The sender/domain is parsed directly from the email header into a deterministic rule (e.g. hide `dominos.com`). Filtering is then a plain DB lookup.
- _Gmail-native categories do the fuzzy work for free:_ Gmail already computes `category:promotions/social/updates`. Lean on those + search operators (e.g. `from:bank category:promotions`) before reaching for a model.
- _Tier 2 (content rules):_ Haiku is used **only for the semantic residual** Gmail categories can't express (e.g. "hide shipping-delay notices but keep delivery confirmations"). John types a plain-language rule; Haiku evaluates future emails from that sender against it. Small ongoing per-email cost — deliberately scoped to the residual, not applied to Tier 1's senders.
- _Onboarding scan is not AI either:_ on first visit to `/email`, group recent senders by frequency (a `GROUP BY`, no model) and propose likely Tier 1 candidates for one-pass approve/reject. **One-time** — track completion in `app_flags`; never re-run on every load.
