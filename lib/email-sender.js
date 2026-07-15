// Deterministic sender parsing from a raw Gmail `From` header — no AI.
// Shared by the read-only inbox proxy (app/api/gmail) and the first-run
// onboarding scan (app/api/email-onboarding). Tier 1 rules key off the domain
// this returns (CLAUDE.md §7: sender parsed directly from the header, never a
// model).

export function extractSenderDomain(fromHeader) {
  const match = /<([^>]+)>/.exec(fromHeader || '') || [
    null,
    (fromHeader || '').trim(),
  ];
  const email = (match[1] || '').toLowerCase();
  const at = email.lastIndexOf('@');
  return at === -1 ? null : email.slice(at + 1);
}

export function extractSenderName(fromHeader) {
  const match = /^([^<]+)</.exec(fromHeader || '');
  return match ? match[1].trim().replace(/^"|"$/g, '') : fromHeader || '';
}

export function header(headers, name) {
  return headers?.find((h) => h.name === name)?.value || '';
}
