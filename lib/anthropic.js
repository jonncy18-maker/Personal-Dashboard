import Anthropic from '@anthropic-ai/sdk'

// Single shared client. Server-side only — never import into a client component.
// Model is pinned to Haiku: this app uses AI narrowly and cheaply (see CLAUDE.md
// Email + Travel sections). Do NOT reach for a larger model here.
export const MODEL = 'claude-haiku-4-5'

export function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}
