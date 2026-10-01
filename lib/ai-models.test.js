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

describe('image and PDF parts', () => {
  const saved = { ...process.env };
  const parts = [
    { type: 'image', mediaType: 'image/png', data: 'IMG64' },
    { type: 'document', mediaType: 'application/pdf', data: 'PDF64' },
    { type: 'text', text: 'read it' },
  ];
  beforeEach(() => {
    anthropicCreate.mockReset();
    vi.stubGlobal('fetch', vi.fn());
    process.env.ANTHROPIC_API_KEY = 'a';
    process.env.OPENAI_API_KEY = 'o';
    delete process.env.AI_FORCE_ANTHROPIC;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...saved };
  });

  it('sends parts to Haiku as base64 image/document blocks, in order', async () => {
    anthropicCreate.mockResolvedValue({ content: [{ text: 'ok' }] });
    await completeText({
      task: 'french-progress',
      system: 's',
      user: parts,
      maxTokens: 10,
    });
    expect(anthropicCreate.mock.calls[0][0].messages[0].content).toEqual([
      {
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: 'IMG64' },
      },
      {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: 'PDF64',
        },
      },
      { type: 'text', text: 'read it' },
    ]);
  });

  it('sends parts to Luna as input_image / input_file / input_text data URIs', async () => {
    fetch.mockResolvedValue(lunaReply('{"ok":1}'));
    const text = await completeText({
      task: 'french-progress',
      provider: 'luna',
      system: 's',
      user: parts,
      maxTokens: 10,
    });
    expect(text).toBe('{"ok":1}');
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.input).toEqual([
      {
        role: 'user',
        content: [
          { type: 'input_image', image_url: 'data:image/png;base64,IMG64' },
          {
            type: 'input_file',
            filename: 'document.pdf',
            file_data: 'data:application/pdf;base64,PDF64',
          },
          { type: 'input_text', text: 'read it' },
        ],
      },
    ]);
  });

  it('keeps the image/PDF tasks on Haiku in production, even with the key and every task flipped', async () => {
    anthropicCreate.mockResolvedValue({ content: [{ text: 'ok' }] });
    for (const task of [
      'french-progress',
      'schedule-import',
      'travel-import',
    ]) {
      await completeText({ task, system: 's', user: parts, maxTokens: 10 });
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(anthropicCreate).toHaveBeenCalledTimes(3);
  });

  it('a forced Luna call never falls back to Haiku', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetch.mockRejectedValue(new Error('no image support'));
    await expect(
      completeText({
        task: 'french-progress',
        provider: 'luna',
        system: 's',
        user: parts,
        maxTokens: 10,
      })
    ).rejects.toThrow('no image support');
    expect(anthropicCreate).not.toHaveBeenCalled();
  });

  it('a forced Anthropic call never contacts Luna, even for a flipped task', async () => {
    anthropicCreate.mockResolvedValue({ content: [{ text: 'HIDE' }] });
    await completeText({
      task: 'email-tier2',
      provider: 'anthropic',
      system: 's',
      user: 'u',
      maxTokens: 8,
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(anthropicCreate).toHaveBeenCalledOnce();
  });
});
