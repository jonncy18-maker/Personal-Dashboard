import { afterEach, expect, it, vi } from 'vitest';
vi.mock('./db', () => ({ getDb: vi.fn() }));
vi.mock('./ai-models', () => ({ completeText: vi.fn() }));
const m = await import('./project-recommendations');
afterEach(() => vi.unstubAllGlobals());
it('owns exactly the five selected project identities and icons', () => {
  expect(
    m.PROJECTS.map(({ id, iconLabel, icon }) => [id, iconLabel, icon])
  ).toEqual([
    ['nextgen-scholars', 'Scholar', 'graduation-cap'],
    ['nextgen-immersion', 'Listening', 'audio-lines'],
    ['ai-capital-planning', 'Forecast', 'chart-no-axes-combined'],
    ['agentic-loop', 'Loop', 'repeat-2'],
    ['ai-harness', 'Command', 'command'],
  ]);
  expect(new Set(m.PROJECTS.map((p) => p.repo)).size).toBe(5);
});
it('rejects unknown projects before database, network, or AI access', async () => {
  const { getDb } = await import('./db');
  getDb.mockClear();
  for (const action of [
    m.getRecommendations,
    m.refreshRecommendations,
    m.collectEvidence,
  ])
    await expect(action('https://github.com/evil/repo')).rejects.toThrow(
      'Unknown project'
    );
  expect(
    await m.saveFeedback({ project: 'evil', id: 'x', status: 'done' })
  ).toBe(false);
  expect(getDb).not.toHaveBeenCalled();
});
it('aggregate GET returns five cache-only cards and targeted GET rejects unknown selectors', async () => {
  const { getDb } = await import('./db');
  const sql = vi.fn(async () => []);
  getDb.mockReturnValue(sql);
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw Error('network forbidden');
    })
  );
  vi.stubEnv('PROJECT_WIDGET_TOKEN', 'test');
  const { GET } = await import('../app/api/projects/recommendations/route');
  const req = (query = '') =>
    new Request(`https://example.com/${query}`, {
      headers: { authorization: 'Bearer test' },
    });
  const result = await GET(req());
  expect((await result.json()).projects).toHaveLength(5);
  expect(sql).toHaveBeenCalledTimes(15);
  expect(fetch).not.toHaveBeenCalled();
  sql.mockClear();
  expect((await GET(req('?project=evil'))).status).toBe(400);
  expect(sql).not.toHaveBeenCalled();
  expect((await (await GET(req('?project=ai-harness'))).json()).repo).toBe(
    'jonncy18-maker/AI-harness'
  );
  vi.unstubAllEnvs();
});
it('extracts referenced phases generically within the roadmap budget', () => {
  const text = `## Next Up\nFinish Phase 47\n## History\n${'old '.repeat(8000)}\n## Phase 47 — Current\nRelevant next work\n## Phase 32\nObsolete assumption\n${'tail '.repeat(3000)}`;
  const excerpt = m.roadmapExcerpt(text);
  expect(excerpt).toContain('Relevant next work');
  expect(excerpt.length).toBeLessThanOrEqual(24000);
  expect(excerpt).toContain('Finish Phase 47');
});

function mockStore() {
  const state = new Map();
  const sql = vi.fn(async (strings, ...values) => {
    const query = strings.join('');
    const key = values[0];
    if (query.includes('SELECT value'))
      return state.has(key) ? [{ value: state.get(key) }] : [];
    if (query.includes("app_flags.value->>'until'")) {
      const old = state.get(key);
      if (old && (old.until > Date.now() || old.next > Date.now())) return [];
      state.set(key, JSON.parse(values[1]));
      return [{ key }];
    }
    if (query.includes('jsonb_build_object')) {
      const snapshot = state.get(values[4]);
      if (snapshot?.recommendation?.id !== values[5]) return [];
      const entry = JSON.parse(values[1]);
      state.set(key, {
        current: entry,
        history: [...(state.get(key)?.history || []), entry],
      });
      return [{ key }];
    }
    if (query.startsWith('UPDATE')) {
      if (state.get(key)?.token === values[1]) state.get(key).until = 0;
      return [];
    }
    if (query.startsWith('INSERT')) state.set(key, JSON.parse(values[1]));
    return [];
  });
  return { state, sql };
}
function mockEvidence(failedRepo) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      if (failedRepo && url.includes(`/${failedRepo}/`))
        return new Response('', { status: 503 });
      if (url.endsWith('/commits?per_page=1'))
        return Response.json([{ sha: 'a'.repeat(40) }]);
      if (url.includes('/contents/'))
        return new Response('## Next Up\nImplement current plan');
      if (url.includes('/check-runs')) return Response.json({ check_runs: [] });
      return Response.json([]);
    })
  );
}
const suggestion = JSON.stringify({
  title: 'Implement',
  action: 'Implement current plan',
  reason: 'Planned work remains',
  source_ids: ['roadmap'],
});
it('isolates five leases, cooldowns, evidence URLs, prompts, and partial failures', async () => {
  const { getDb } = await import('./db');
  const { completeText } = await import('./ai-models');
  const { state, sql } = mockStore();
  getDb.mockReturnValue(sql);
  completeText.mockReset().mockResolvedValue(suggestion);
  mockEvidence('AI-harness');
  const result = await m.refreshAllRecommendations();
  expect(result.status).toBe('partial_failure');
  expect(result.projects.map((project) => project.status)).toEqual([
    'refreshed',
    'refreshed',
    'refreshed',
    'refreshed',
    'failed',
  ]);
  expect(
    [...state.keys()].filter((key) => key.endsWith(':snapshot'))
  ).toHaveLength(4);
  expect(
    [...state.keys()].filter((key) => key.endsWith(':lease'))
  ).toHaveLength(5);
  for (const project of m.PROJECTS.slice(0, 4)) {
    const snapshot = state.get(
      `project-recommendations:v1:${project.repo}:snapshot`
    );
    expect(snapshot.repo).toBe(project.repo);
    expect(snapshot.sources[0].url).toContain(`${project.repo}/blob/`);
    expect(
      completeText.mock.calls.some(
        ([args]) => JSON.parse(args.user).evidence.repo === project.repo
      )
    ).toBe(true);
  }
  const before = completeText.mock.calls.length;
  expect((await m.refreshAllRecommendations()).status).toBe('skipped');
  expect(completeText.mock.calls.length).toBe(before);
  expect(
    state.get(`project-recommendations:v1:${m.REPO}:lease`).next
  ).toBeGreaterThan(Date.now());
});
it('writes feedback only in the chosen repository and preserves legacy Immersion keys', async () => {
  const { getDb } = await import('./db');
  const { completeText } = await import('./ai-models');
  const { state, sql } = mockStore();
  getDb.mockReturnValue(sql);
  completeText.mockReset().mockResolvedValue(suggestion);
  mockEvidence();
  await m.refreshAllRecommendations();
  const before = await m.getRecommendations('ai-harness');
  const immersion = await m.getRecommendations();
  expect(
    await m.saveFeedback({
      project: 'ai-harness',
      id: immersion.recommendation.id,
      status: 'done',
    })
  ).toBe(false);
  expect(
    await m.saveFeedback({
      project: 'ai-harness',
      id: before.recommendation.id,
      status: 'done',
    })
  ).toBe(true);
  expect((await m.getRecommendations('ai-harness')).recommendation).toBeNull();
  expect((await m.getRecommendations()).recommendation).not.toBeNull();
  expect(
    await m.saveFeedback({ id: immersion.recommendation.id, status: 'not_now' })
  ).toBe(true);
  expect(state.has(`project-recommendations:v1:${m.REPO}:feedback`)).toBe(true);
  for (const project of [null, '', 'unknown'])
    expect(await m.saveFeedback({ project, id: 'x', status: 'done' })).toBe(
      false
    );
});
it('refresh routes validate selectors before side effects and report partial/all failures', async () => {
  const { getDb } = await import('./db');
  const { completeText } = await import('./ai-models');
  const { POST } =
    await import('../app/api/projects/recommendations/refresh/route');
  vi.stubEnv('PROJECT_WIDGET_TOKEN', 'test');
  const request = (query = '') =>
    new Request(`https://example.com/${query}`, {
      method: 'POST',
      headers: { authorization: 'Bearer test' },
    });
  getDb.mockClear();
  for (const query of [
    '?project=',
    '?project=evil',
    '?repo=evil',
    '?project=ai-harness&project=ai-harness',
  ])
    expect((await POST(request(query))).status).toBe(400);
  expect(getDb).not.toHaveBeenCalled();
  getDb.mockReturnValue(mockStore().sql);
  completeText.mockReset().mockResolvedValue(suggestion);
  mockEvidence('AI-harness');
  expect((await POST(request())).status).toBe(207);
  getDb.mockReturnValue(mockStore().sql);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('', { status: 503 }))
  );
  expect((await POST(request())).status).toBe(502);
  getDb.mockReturnValue(mockStore().sql);
  mockEvidence();
  const single = await POST(request('?project=ai-harness'));
  expect(single.status).toBe(200);
  expect((await single.json()).status).toBe('refreshed');
  expect(fetch.mock.calls.every(([url]) => url.includes('/AI-harness/'))).toBe(
    true
  );
  vi.unstubAllEnvs();
});

it('preserves the recent roadmap tail when many headings reference the same phase', () => {
  const text = [
    '## Next Up\nFinish Phase 47',
    `## History\n${'history '.repeat(4000)}`,
    ...Array.from(
      { length: 12 },
      (_, index) =>
        `## Phase 47 checkpoint ${index}\n${'checkpoint '.repeat(400)}`
    ),
    `## Latest\n${'recent '.repeat(1500)}END_OF_RECENT_TAIL`,
  ].join('\n');
  const excerpt = m.roadmapExcerpt(text);
  expect(excerpt.length).toBeLessThanOrEqual(24000);
  expect(excerpt).toContain('END_OF_RECENT_TAIL');
});
