# Runbook: Google OAuth refresh token

Use this when Gmail or Calendar calls start failing with `invalid_grant`, or whenever the Google refresh token needs to be re-minted.

**Google refresh token — the 7-day trap, and how to re-mint (runbook).** Surfaced 2026-08-09: every Gmail/Calendar call was failing with `invalid_grant` and had been since ~2026-07-21. Cause: a Google Cloud OAuth app whose **publishing status is "Testing" issues refresh tokens that expire after 7 days** — by design, and Gmail/Calendar scopes are not in the exempt set (only `openid`/`userinfo.email`/`userinfo.profile` are). Symptom is deceptive: the scan reports nothing found and Calendar/Email render empty rather than erroring.

_Fix it once (publishing status), then re-mint:_

1. **Google Cloud Console → APIs & Services → OAuth consent screen** (newer console: **Google Auth Platform → Audience**) → publishing status **Testing → In production** (`PUBLISH APP`). Staying unverified is fine for this single-user app — it only means a "Google hasn't verified this app" interstitial at consent time. **Do this before minting**, or the new token inherits the same 7-day clock.
2. **APIs & Services → Credentials →** the OAuth client matching `GOOGLE_CLIENT_ID` → add `https://developers.google.com/oauthplayground` as an **Authorized redirect URI** (requires client type _Web application_).
3. **[OAuth Playground](https://developers.google.com/oauthplayground) →** gear icon → _Use your own OAuth credentials_ (paste client id + secret), access type **Offline**, **force consent prompt** on (without it Google returns no refresh token on a repeat authorization). Scopes — exactly the two this app uses, both read-only per §2:
   `https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly`
4. Authorize as John's account → _Exchange authorization code for tokens_ → copy the **refresh token**.

**The client secret is unrecoverable — keep a copy outside Vercel.** Google only displays a client secret at creation time, and every env var in this project is set **Sensitive** in Vercel (write-only, can't be read back). So the secret exists in neither place after the fact, and step 3 above has nothing to paste. Hit this 2026-08-09. **Store the client secret in a password manager at creation time** — Vercel is where the app reads it, not where you recover it. If it's already lost, the only route is a **new OAuth client** (Clients → Create client → _Web application_ → add the Playground redirect URI **before** creating), and then all three of `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` must be updated together — a refresh token is bound to the client that issued it, so an old id + new secret fails with `invalid_client`. Publishing status is project-level, so a new client inherits "In production" and its no-expiry behavior. 5. **Vercel → personal-dashboard → Settings → Environment Variables →** update `GOOGLE_REFRESH_TOKEN` for **both Production and Preview** (§4's gotcha), then **redeploy** — env changes do not apply to already-built deployments. 6. Verify: `/travel` → Scan Gmail must NOT say "Gmail access has expired"; `/calendar` shows events again.

_Other things that kill a production refresh token_ (all rarer): revoking the app in Google Account permissions; changing the Google password (revokes Gmail-scoped tokens on consumer accounts); six months unused (the weekly cron prevents this); or exceeding ~100 live refresh tokens for the same account+client, which silently invalidates the oldest — so don't re-run the mint flow more than necessary.

_(Other quirks: fill in as they surface.)_
