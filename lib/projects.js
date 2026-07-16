// The AI Projects lifecycle statuses — the manual layer (migration 007) the
// redesigned view leans on for its tabs and counts. Shared so the two API
// routes and the page can't drift out of sync. Plain data, safe to import
// from client or server.
export const PROJECT_STATUSES = [
  'planning',
  'active',
  'needs_attention',
  'on_hold',
  'blocked',
  'completed',
];
