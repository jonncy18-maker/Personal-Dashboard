import { getAnthropic, MODEL } from './anthropic';

// Tier 2 — Haiku evaluates a single email against John's plain-language rule
// for that sender (e.g. "hide shipping-delay notices but keep delivery
// confirmations"). Scoped to the semantic residual Gmail's own categories
// can't express; deliberately not applied to Tier 1's senders (CLAUDE.md §7).
// Defaults to keeping the email visible on any ambiguous or failed call —
// a wrongly-kept email is recoverable by re-reading the rule; a wrongly-hidden
// one is invisible.
export async function shouldHideByRule(ruleText, subject, snippet) {
  if (!process.env.ANTHROPIC_API_KEY) return false;

  try {
    const anthropic = getAnthropic();
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 5,
      system:
        'You filter email for a user based on their plain-language rule. Respond with exactly one word: HIDE or KEEP. When uncertain, respond KEEP.',
      messages: [
        {
          role: 'user',
          content: `Rule: "${ruleText}"\n\nEmail subject: "${subject}"\nEmail preview: "${snippet}"\n\nShould this email be hidden per the rule?`,
        },
      ],
    });

    const answer = res.content?.[0]?.text?.trim().toUpperCase() || '';
    console.error(
      `[email-tier2] rule="${ruleText}" subject="${subject}" raw="${res.content?.[0]?.text}" stopReason="${res.stop_reason}"`
    );
    return answer.startsWith('HIDE');
  } catch (err) {
    console.error(
      '[email-tier2] Haiku evaluation failed:',
      err?.message || err
    );
    return false;
  }
}
