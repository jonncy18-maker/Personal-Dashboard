// The AI Projects lifecycle statuses — the manual layer (migration 007) the
// redesigned view leans on for its tabs and counts. Shared so the two API
// routes, the AI Projects page, and the Home status-dot row can't drift out
// of sync. Plain data, safe to import from client or server.
export const PROJECT_STATUS_META = {
  planning: { label: 'Planning', color: 'var(--accent)' },
  active: { label: 'Active', color: 'var(--good)' },
  needs_attention: { label: 'Needs attention', color: 'var(--warn)' },
  on_hold: { label: 'On hold', color: 'var(--ink-faint)' },
  blocked: { label: 'Blocked', color: 'var(--critical)' },
  completed: { label: 'Completed', color: '#a789f2' },
};

export const PROJECT_STATUSES = Object.keys(PROJECT_STATUS_META);
