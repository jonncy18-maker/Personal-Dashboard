import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const anthropicCreate = vi.fn();
vi.mock('./anthropic', () => ({
  MODEL: 'claude-haiku-4-5',
  getAnthropic: () => ({ messages: { create: anthropicCreate } }),
}));

const { parseProgressScreenshot } = await import('./french-progress.js');
const { parseScheduleScreenshot } = await import('./schedule-import.js');
const { parseItineraryFromEmail } = await import('./travel-import.js');

const lunaReply = (text) => ({
  ok: true,
  json: async () => ({
    status: 'completed',
    output: [{ type: 'message', content: [{ type: 'output_text', text }] }],
  }),
});
const haikuReply = (text) => ({ content: [{ text }] });

describe('image and PDF imports on Luna', () => {
  const saved = { ...process.env };
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

  it('French: reads the screenshot through Luna and parses the result', async () => {
    fetch.mockResolvedValue(
      lunaReply(
        '{"totalHours": 42.5, "asOfDate": "2026-09-30", "dailyEntries": [{"date":"2026-09-29","hours":1.5}]}'
      )
    );
    const out = await parseProgressScreenshot('IMG', 'image/png');
    expect(out).toEqual({
      totalHours: 42.5,
      asOfDate: '2026-09-30',
      dailyEntries: [{ date: '2026-09-29', hours: 1.5 }],
      configured: true,
    });
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.input[0].content[0]).toEqual({
      type: 'input_image',
      image_url: 'data:image/png;base64,IMG',
    });
    expect(anthropicCreate).not.toHaveBeenCalled();
  });

  it('Schedules: falls back to Haiku when Luna errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetch.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad',
      json: async () => ({ error: { message: 'bad input' } }),
    });
    anthropicCreate.mockResolvedValue(
      haikuReply('{"tasks":[{"title":"Grab milk","due_date":"","notes":""}]}')
    );
    const out = await parseScheduleScreenshot('IMG', 'image/jpeg');
    expect(out.tasks).toEqual([
      { title: 'Grab milk', due_date: '', notes: '' },
    ]);
    expect(anthropicCreate).toHaveBeenCalledOnce();
  });

  it('Travel: sends the PDF to Luna as a file and parses the days', async () => {
    fetch.mockResolvedValue(
      lunaReply(
        '[{"date":"2026-07-04","title":"Seattle embark","location":"Seattle, USA","leg":"","notes":""}]'
      )
    );
    const out = await parseItineraryFromEmail({
      destination: 'Alaska',
      subject: 'Your cruise',
      body: 'Sail July 4',
      pdfs: ['PDF64'],
    });
    expect(out.days).toHaveLength(1);
    expect(out.days[0].location).toBe('Seattle, USA');
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.input[0].content[0]).toEqual({
      type: 'input_file',
      filename: 'document.pdf',
      file_data: 'data:application/pdf;base64,PDF64',
    });
  });

  it('runs on Luna alone when there is no Anthropic key', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    fetch.mockResolvedValue(lunaReply('{"tasks":[]}'));
    const out = await parseScheduleScreenshot('IMG', 'image/png');
    expect(out).toEqual({ tasks: [], configured: true });
  });

  it('is unconfigured only when neither key exists', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    expect(await parseScheduleScreenshot('IMG', 'image/png')).toEqual({
      tasks: [],
      configured: false,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('with AI_FORCE_ANTHROPIC set, never contacts Luna', async () => {
    process.env.AI_FORCE_ANTHROPIC = '1';
    anthropicCreate.mockResolvedValue(haikuReply('{"tasks":[]}'));
    await parseScheduleScreenshot('IMG', 'image/png');
    expect(fetch).not.toHaveBeenCalled();
    expect(anthropicCreate).toHaveBeenCalledOnce();
  });
});
