import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const anthropicCreate = vi.fn();
vi.mock('./anthropic', () => ({
  MODEL: 'claude-haiku-4-5',
  getAnthropic: () => ({ messages: { create: anthropicCreate } }),
}));

const { providerFor, canRun, completeText, LUNA_MODEL } =
  await import('./ai-models.js');

const lunaReply = (text) => ({
  ok: true,
  json: async () => ({
    status: 'completed',
    output: [
      { type: 'reasoning', summary: [] },
      { type: 'message', content: [{ type: 'output_text', text }] },
    ],
  }),
});

describe('providerFor', () => {
  it('uses Luna for a registered task when the OpenAI key is set', () => {
    expect(providerFor('email-tier2', { OPENAI_API_KEY: 'k' })).toBe('luna');
    expect(providerFor('trip-detect', { OPENAI_API_KEY: 'k' })).toBe('luna');
  });

  it('stays on Anthropic without an OpenAI key', () => {
    expect(providerFor('email-tier2', {})).toBe('anthropic');
  });

  it('AI_FORCE_ANTHROPIC wins over the key', () => {
    const env = { OPENAI_API_KEY: 'k', AI_FORCE_ANTHROPIC: '1' };
    expect(providerFor('email-tier2', env)).toBe('anthropic');
  });

  it('never routes an unregistered task (vision/PDF jobs) to Luna', () => {
    expect(providerFor('french-progress', { OPENAI_API_KEY: 'k' })).toBe(
      'anthropic'
    );
  });
});

describe('canRun', () => {
  it('needs a key for whichever provider is selected', () => {
    expect(canRun('email-tier2', {})).toBe(false);
    expect(canRun('email-tier2', { ANTHROPIC_API_KEY: 'a' })).toBe(true);
    expect(canRun('email-tier2', { OPENAI_API_KEY: 'o' })).toBe(true);
  });
});

describe('completeText', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    anthropicCreate.mockReset();
    vi.stubGlobal('fetch', vi.fn());
    delete process.env.AI_FORCE_ANTHROPIC;
    process.env.ANTHROPIC_API_KEY = 'a';
    process.env.OPENAI_API_KEY = 'o';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...saved };
  });

  it('calls Luna with a stateless, headroomed request and returns its text', async () => {
    fetch.mockResolvedValue(lunaReply('KEEP'));
    const text = await completeText({
      task: 'email-tier2',
      system: 'sys',
      user: 'usr',
      maxTokens: 8,
    });
    expect(text).toBe('KEEP');
    expect(anthropicCreate).not.toHaveBeenCalled();
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/responses');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      model: LUNA_MODEL,
      instructions: 'sys',
      input: 'usr',
      store: false,
    });
    expect(body.max_output_tokens).toBeGreaterThan(8);
    expect(init.headers.authorization).toBe('Bearer o');
  });

  it('falls back to Haiku when Luna errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetch.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ error: { message: 'nope' } }),
    });
    anthropicCreate.mockResolvedValue({ content: [{ text: 'HIDE' }] });
    const text = await completeText({
      task: 'email-tier2',
      system: 's',
      user: 'u',
      maxTokens: 8,
    });
    expect(text).toBe('HIDE');
    expect(anthropicCreate).toHaveBeenCalledOnce();
  });

  it('falls back to Haiku when Luna truncates', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'incomplete',
        incomplete_details: { reason: 'max_output_tokens' },
        output: [],
      }),
    });
    anthropicCreate.mockResolvedValue({ content: [{ text: 'KEEP' }] });
    expect(
      await completeText({
        task: 'trip-detect',
        system: 's',
        user: 'u',
        maxTokens: 200,
      })
    ).toBe('KEEP');
  });

  it('throws when Luna fails and there is no Anthropic key', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    delete process.env.ANTHROPIC_API_KEY;
    fetch.mockRejectedValue(new Error('network down'));
    await expect(
      completeText({
        task: 'email-tier2',
        system: 's',
        user: 'u',
        maxTokens: 8,
      })
    ).rejects.toThrow('network down');
  });

  it('uses Haiku directly when AI_FORCE_ANTHROPIC is set', async () => {
    process.env.AI_FORCE_ANTHROPIC = '1';
    anthropicCreate.mockResolvedValue({ content: [{ text: 'KEEP' }] });
    await completeText({
      task: 'email-tier2',
      system: 's',
      user: 'u',
      maxTokens: 8,
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(anthropicCreate).toHaveBeenCalledOnce();
  });
});
