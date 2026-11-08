import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProgram, exerciseEmbedUrl, exerciseImage, exercises, references, WorkoutApiError } from '../server/lib/workoutapi/index.js';

afterEach(() => { vi.restoreAllMocks(); delete process.env.WORKOUTAPI_KEY; delete process.env.WEB_ORIGIN; });
describe('Workout API adapter', () => {
  it('creates one origin-restricted exercise embed and reuses its token', async () => {
    process.env.WORKOUTAPI_KEY = 'embed-test-key';
    process.env.WEB_ORIGIN = 'https://coach.example.com';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id: 'embed-1', name: 'Coach exercise details', allowedOrigins: ['https://coach.example.com'], createdAt: '', updatedAt: '', token: 'embed-test-token', embedUrl: 'https://api.workoutapi.com/embed/exercise/embed-test-token', iframeSnippet: '' }), { status: 201, headers: { 'content-type': 'application/json' } }));
    const [first, second] = await Promise.all([exerciseEmbedUrl('PRESS'), exerciseEmbedUrl('SQUAT')]);
    expect(new URL(first).searchParams.get('exerciseCode')).toBe('PRESS');
    expect(new URL(second).searchParams.get('exerciseCode')).toBe('SQUAT');
    expect(new URL(first).searchParams.get('autoplay')).toBe('true');
    expect(new URL(first).searchParams.get('controls')).toBe('true');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await (fetchMock.mock.calls[0][0] as Request).json()).toEqual({ name: 'Coach exercise details', allowedOrigins: ['https://coach.example.com'] });
  });
  it('fails explicitly when the server key is missing', async () => { await expect(exercises('press')).rejects.toMatchObject({ status: 503 }); });
  it('uses the official SDK contract and saves generated drafts', async () => {
    process.env.WORKOUTAPI_KEY = 'test-key';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes('/programs/generate')) return new Response(JSON.stringify({ programId: '11111111-1111-1111-1111-111111111111', days: [{ label: 'Day 1', exercises: [] }] }), { status: 200, headers: { 'content-type': 'application/json' } });
      if (url.includes('/save')) return new Response(JSON.stringify({ programId: '11111111-1111-1111-1111-111111111111' }), { status: 200, headers: { 'content-type': 'application/json' } });
      return new Response(JSON.stringify([{ id: '1', code: 'PRESS', name: 'Press' }]), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const input = { name: 'Plan', level: 'INTERMEDIATE' as const, goal: 'STRENGTH' as const, days: [{ label: 'Day 1', criteria: { exercisesCount: 3, sessionDurationMinutes: 45, muscles: ['CHEST'], categories: ['FREE_WEIGHT'], types: ['POLYARTICULAR'], requiredExercises: ['BARBELL_BENCH_PRESS'], excludedExercises: ['SQUAT'], autoPrescription: true, exercisePrescriptions: [{ exercise: 'BARBELL_BENCH_PRESS', nbSets: { min: 3, max: 5 }, weight: { value: 40 } }] } }] };
    const result = await createProgram(input);
    expect(result.programId).toBe('11111111-1111-1111-1111-111111111111');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await (fetchMock.mock.calls[0][0] as Request).json()).toEqual(input);
  });
  it('turns quota responses into actionable errors', async () => {
    process.env.WORKOUTAPI_KEY = 'test-key';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ message: 'limit' }), { status: 429, headers: { 'content-type': 'application/json' } }));
    await expect(exercises('press')).rejects.toBeInstanceOf(WorkoutApiError);
    await expect(exercises('press')).rejects.toMatchObject({ status: 429 });
  });
  it('loads muscle, category, and type choices for generation', async () => {
    process.env.WORKOUTAPI_KEY = 'test-key';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = input instanceof Request ? input.url : String(input);
      const code = url.endsWith('/types') ? 'POLYARTICULAR' : url.endsWith('/categories') ? 'FREE_WEIGHT' : 'CHEST';
      return new Response(JSON.stringify([{ id: '1', code, name: code }]), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const choices = await references();
    expect(choices.types?.[0]?.code).toBe('POLYARTICULAR');
    expect(choices.categories?.[0]?.code).toBe('FREE_WEIGHT');
    expect(choices.muscles?.[0]?.code).toBe('CHEST');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it('rejects unexpected data instead of storing an invalid program', async () => {
    process.env.WORKOUTAPI_KEY = 'test-key';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ days: [] }), { status: 200, headers: { 'content-type': 'application/json' } }));
    await expect(createProgram({ days: [{ criteria: { exercisesCount: 3 } }] })).rejects.toMatchObject({ status: 502 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('gives a specific message for an invalid key', async () => {
    process.env.WORKOUTAPI_KEY = 'bad-key';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 401, headers: { 'content-type': 'application/json' } }));
    await expect(exercises('press')).rejects.toMatchObject({ status: 401, message: expect.stringContaining('rejected the key') });
  });
  it('fetches exercise PNGs once per code for 24 hours, including concurrent requests', async () => {
    process.env.WORKOUTAPI_KEY = 'test-key';
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = input instanceof Request ? input.url : String(input);
      expect(url).toContain('/exercises/code/CACHE_TEST_PRESS/image?format=png');
      return new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), { status: 200, headers: { 'content-type': 'image/png' } });
    });
    const [first, concurrent] = await Promise.all([exerciseImage('CACHE_TEST_PRESS'), exerciseImage('CACHE_TEST_PRESS')]);
    expect(first.bytes).toEqual(concurrent.bytes);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await exerciseImage('CACHE_TEST_PRESS')).bytes).toEqual(first.bytes);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    clock.mockReturnValue(now + 24 * 60 * 60 * 1000 + 1);
    await exerciseImage('CACHE_TEST_PRESS');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('caches missing exercise images and preserves quota errors', async () => {
    process.env.WORKOUTAPI_KEY = 'test-key';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } }));
    expect((await exerciseImage('CACHE_TEST_MISSING')).bytes).toBeNull();
    expect((await exerciseImage('CACHE_TEST_MISSING')).bytes).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValue(new Response('{}', { status: 429, headers: { 'content-type': 'application/json' } }));
    await expect(exerciseImage('CACHE_TEST_LIMIT')).rejects.toMatchObject({ status: 429 });
  });
});
