import { canRun, completeText } from './ai-models';

// Tier 2 — a small model (Haiku, or Luna when OPENAI_API_KEY is set; see lib/ai-models.js)
// evaluates a single email against John's plain-language rule
// for that sender (e.g. "hide shipping-delay notices but keep delivery
// confirmations"). Scoped to the semantic residual Gmail's own categories
// can't express; deliberately not applied to Tier 1's senders (CLAUDE.md §7).
// Defaults to keeping the email visible on any ambiguous or failed call —
// a wrongly-kept email is recoverable by re-reading the rule; a wrongly-hidden
// one is invisible.
export async function shouldHideByRule(ruleText, sender, subject, snippet) {
  if (!canRun('email-tier2')) return false;

  try {
    const text = await completeText({
      task: 'email-tier2',
      maxTokens: 8,
      system:
        'You filter email for a user based on their plain-language rule about a specific sender. Respond with exactly one word: HIDE or KEEP. When uncertain, respond KEEP.',
      user: `Rule for sender "${sender}": "${ruleText}"\n\nEmail subject: "${subject}"\nEmail preview: "${snippet}"\n\nShould this email be hidden per the rule?`,
    });

    return text.toUpperCase().startsWith('HIDE');
  } catch (err) {
    console.error('[email-tier2] evaluation failed:', err?.message || err);
    return false;
  }
}
