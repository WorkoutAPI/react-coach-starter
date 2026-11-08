import { createWorkoutApiClient, getExercises, searchExercises, filterExercises, getExerciseImageByCode, getMuscles, getCategories, getTypes, generateProgram, saveProgram, patchProgram, enableProgramShare, disableProgramShare, createExerciseEmbed, type ProgramGenerateRequest, type ProgramGenerateResponse, type ProgramGoal, type Exercise } from '@workoutapi/sdk';
import { z } from 'zod';

export class WorkoutApiError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}

function client() {
  const apiKey = process.env.WORKOUTAPI_KEY;
  if (!apiKey) throw new WorkoutApiError('WORKOUTAPI_KEY is missing. Add it to the server environment.', 503);
  return createWorkoutApiClient({ apiKey, baseUrl: process.env.WORKOUTAPI_BASE_URL || 'https://api.workoutapi.com', fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) });
}

function unwrap<T>(result: { data?: T; error?: unknown; response?: Response }): T {
  if (result.error !== undefined || result.data === undefined) {
    const status = result.response?.status || 502;
    const message = status === 401 ? 'Workout API rejected the key. Check WORKOUTAPI_KEY.' : status === 403 ? 'This Workout API operation is unavailable for the configured key.' : status === 429 ? 'Workout API quota reached. Try again later or review your plan.' : status >= 500 ? 'Workout API is temporarily unavailable.' : 'Workout API request failed.';
    throw new WorkoutApiError(message, status);
  }
  return result.data;
}

const headers = { 'Accept-Language': 'en-US' };
export const goals: { code: ProgramGoal; name: string }[] = [
  { code: 'HYPERTROPHY', name: 'Hypertrophy' },
  { code: 'STRENGTH', name: 'Strength' },
  { code: 'ENDURANCE', name: 'Endurance' },
  { code: 'WEIGHT_LOSS', name: 'Weight loss' }
];
let exerciseEmbed: { key: string; origin: string; token: string } | null = null;
let exerciseEmbedRequest: Promise<string> | null = null;

export async function exerciseEmbedUrl(code: string): Promise<string> {
  const key = process.env.WORKOUTAPI_KEY || '';
  const origin = new URL(process.env.WEB_ORIGIN || 'http://localhost:3000').origin;
  if (!key) throw new WorkoutApiError('WORKOUTAPI_KEY is missing. Add it to the server environment.', 503);
  if (!exerciseEmbed || exerciseEmbed.key !== key || exerciseEmbed.origin !== origin) {
    if (!exerciseEmbedRequest) {
      exerciseEmbedRequest = (async () => {
        const created = unwrap(await createExerciseEmbed({ client: client(), body: { name: 'Coach exercise details', allowedOrigins: [origin] } }));
        if (!z.string().min(1).safeParse(created.token).success) throw new WorkoutApiError('Workout API returned an invalid exercise embed token.');
        exerciseEmbed = { key, origin, token: created.token };
        return created.token;
      })().finally(() => { exerciseEmbedRequest = null; });
    }
    await exerciseEmbedRequest;
  }
  const url = new URL(`/embed/exercise/${encodeURIComponent(exerciseEmbed!.token)}`, process.env.WORKOUTAPI_BASE_URL || 'https://api.workoutapi.com');
  url.searchParams.set('exerciseCode', code);
  url.searchParams.set('autoplay', 'true');
  url.searchParams.set('controls', 'true');
  return url.toString();
}
const exerciseList = z.array(z.object({ id: z.string(), code: z.string(), name: z.string() }).passthrough());
function validateExercises(value: Exercise[]): Exercise[] { if (!exerciseList.safeParse(value).success) throw new WorkoutApiError('Workout API returned an unexpected exercise response.'); return value; }
const generatedProgram = z.object({ programId: z.string().min(1), days: z.array(z.object({ exercises: exerciseList.optional() }).passthrough()) }).passthrough();
let referenceCache: { expiresAt: number; value: { muscles: Awaited<ReturnType<typeof getMuscles>>['data']; categories: Awaited<ReturnType<typeof getCategories>>['data']; types: Awaited<ReturnType<typeof getTypes>>['data'] } } | null = null;
const IMAGE_TTL_MS = 24 * 60 * 60 * 1000;
const MISSING_IMAGE_TTL_MS = 60 * 60 * 1000;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_CACHE_BYTES = 64 * 1024 * 1024;
const MAX_CACHE_ENTRIES = 200;
type CachedImage = { bytes: Buffer | null; expiresAt: number };
const imageCache = new Map<string, CachedImage>();
const imageRequests = new Map<string, Promise<CachedImage>>();
let cachedImageBytes = 0;

function cacheImage(code: string, image: CachedImage) {
  const previous = imageCache.get(code);
  if (previous) cachedImageBytes -= previous.bytes?.length || 0;
  imageCache.delete(code);
  while (imageCache.size >= MAX_CACHE_ENTRIES || cachedImageBytes + (image.bytes?.length || 0) > MAX_CACHE_BYTES) {
    const oldest = imageCache.keys().next().value;
    if (!oldest) break;
    cachedImageBytes -= imageCache.get(oldest)?.bytes?.length || 0;
    imageCache.delete(oldest);
  }
  imageCache.set(code, image);
  cachedImageBytes += image.bytes?.length || 0;
}

export async function exerciseImage(code: string): Promise<CachedImage> {
  const key = code.toUpperCase();
  const cached = imageCache.get(key);
  if (cached) {
    if (cached.expiresAt > Date.now()) {
      imageCache.delete(key);
      imageCache.set(key, cached);
      return cached;
    }
    imageCache.delete(key);
    cachedImageBytes -= cached.bytes?.length || 0;
  }
  const pending = imageRequests.get(key);
  if (pending) return pending;
  const request = (async () => {
    try {
      const blob = unwrap(await getExerciseImageByCode({ client: client(), path: { code: key }, query: { format: 'png' }, parseAs: 'blob' }));
      if (!(blob instanceof Blob) || blob.type !== 'image/png' || blob.size === 0 || blob.size > MAX_IMAGE_BYTES) throw new WorkoutApiError('Workout API returned an invalid exercise image.');
      const image = { bytes: Buffer.from(await blob.arrayBuffer()), expiresAt: Date.now() + IMAGE_TTL_MS };
      cacheImage(key, image);
      return image;
    } catch (error) {
      if (error instanceof WorkoutApiError && error.status === 404) {
        const missing = { bytes: null, expiresAt: Date.now() + MISSING_IMAGE_TTL_MS };
        cacheImage(key, missing);
        return missing;
      }
      if (error instanceof WorkoutApiError) throw error;
      throw new WorkoutApiError('Workout API exercise image is temporarily unavailable.');
    } finally {
      imageRequests.delete(key);
    }
  })();
  imageRequests.set(key, request);
  return request;
}

export async function exercises(query?: string, muscle?: string): Promise<Exercise[]> {
  const api = client();
  if (muscle) { const filtered = validateExercises(unwrap(await filterExercises({ client: api, body: { muscles: [muscle] }, headers }))); return query ? filtered.filter(exercise => exercise.name.toLowerCase().includes(query.toLowerCase())) : filtered; }
  if (query) return validateExercises(unwrap(await searchExercises({ client: api, query: { q: query }, headers })));
  return validateExercises(unwrap(await getExercises({ client: api, headers })));
}
export async function references() {
  if (referenceCache && referenceCache.expiresAt > Date.now()) return referenceCache.value;
  const api = client();
  const [muscles, categories, types] = await Promise.all([getMuscles({ client: api, headers }), getCategories({ client: api, headers }), getTypes({ client: api, headers })]);
  const value = { muscles: unwrap(muscles), categories: unwrap(categories), types: unwrap(types) };
  referenceCache = { value, expiresAt: Date.now() + 10 * 60000 };
  return value;
}
export async function createProgram(body: ProgramGenerateRequest): Promise<ProgramGenerateResponse> {
  const api = client();
  const generated = unwrap(await generateProgram({ client: api, body, headers }));
  if (!generatedProgram.safeParse(generated).success) throw new WorkoutApiError('Workout API returned an unexpected program response.');
  unwrap(await saveProgram({ client: api, path: { id: generated.programId }, body: { name: body.name, description: body.description } }));
  return generated;
}
export async function updateProgram(apiProgramId: string, body: { name?: string; description?: string; days?: ProgramGenerateResponse['days'] }) {
  return unwrap(await patchProgram({ client: client(), path: { id: apiProgramId }, body }));
}
export async function shareProgram(apiProgramId: string) {
  const shared = unwrap(await enableProgramShare({ client: client(), path: { id: apiProgramId }, body: {} }));
  if (!z.url().safeParse(shared.url).success) throw new WorkoutApiError('Workout API returned an invalid share link.');
  return shared;
}
export async function unshareProgram(apiProgramId: string) {
  return unwrap(await disableProgramShare({ client: client(), path: { id: apiProgramId } }));
}
