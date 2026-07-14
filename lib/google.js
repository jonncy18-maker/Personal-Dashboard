import { google } from 'googleapis';

// Server-side only. One OAuth client, read-only scopes, shared by Calendar
// (Language's next tutor call) and Gmail (Email + Travel import) — see
// CLAUDE.md §2/§7. Returns null when the app isn't configured yet so callers
// degrade gracefully instead of throwing.
export function getGoogleAuth() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } =
    process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    return null;
  }

  const auth = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  return auth;
}

export function getCalendarClient() {
  const auth = getGoogleAuth();
  return auth ? google.calendar({ version: 'v3', auth }) : null;
}

export function getGmailClient() {
  const auth = getGoogleAuth();
  return auth ? google.gmail({ version: 'v1', auth }) : null;
}
