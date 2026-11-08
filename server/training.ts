import { randomUUID } from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { demo, prisma, requireUser, type AuthedRequest } from './auth.js';
import { demoExercises, demoPrograms, demoTrainingSessions, demoUsers, type DemoTrainingSession } from './demo.js';
import * as workout from './lib/workoutapi/index.js';

const router = Router();
router.use(requireUser);
const route = (fn: (req: AuthedRequest, res: Response) => Promise<unknown> | unknown) => async (req: Request, res: Response, next: NextFunction) => { try { await fn(req as AuthedRequest, res); } catch (error) { next(error); } };
const id = z.string().min(1).max(100);
const code = z.string().min(2).max(100).regex(/^[A-Za-z0-9_-]+$/);
const startInput = z.strictObject({ programId: id, dayIndex: z.number().int().min(0).max(6) });
const setsInput = z.strictObject({ exerciseIndex: z.number().int().min(0).max(49), sets: z.array(z.strictObject({ reps: z.number().int().min(1).max(1000), weightKg: z.number().min(0).max(10000).nullable() })).max(30), skipped: z.boolean() });
const extraInput = z.strictObject({ code, name: z.string().trim().min(2).max(200) });
const MAX_DEMO_TRAINING_SESSIONS = 500;

type TrainingExercise = { code: string; name: string; targetSets: number | null; targetReps: string; restSeconds: number | null; sets: { reps: number; weightKg: number | null }[]; skipped: boolean; extra: boolean };
type TrainingContent = { programName: string; dayLabel: string; dayIndex: number; exercises: TrainingExercise[] };
const asContent = (value: unknown) => value as TrainingContent;
const prescription = (value?: { value?: number; min?: number; max?: number }) => value?.value ?? value?.min ?? value?.max;
const targetReps = (value?: { value?: number; min?: number; max?: number }) => value?.value ? String(value.value) : value?.min && value?.max ? `${value.min}–${value.max}` : value?.min ? String(value.min) : '';

async function accessibleSession(req: AuthedRequest, sessionId: string) {
  const session = demo ? demoTrainingSessions.find(item => item.id === sessionId) : await prisma.trainingSession.findUnique({ where: { id: sessionId } });
  if (!session) return null;
  if (req.user!.role === 'CLIENT') return session.clientId === req.user!.id ? session : null;
  const owned = demo ? demoUsers.some(client => client.id === session.clientId && client.coachId === req.user!.id) : await prisma.user.findFirst({ where: { id: session.clientId, coachId: req.user!.id, role: 'CLIENT' }, select: { id: true } });
  return owned ? session : null;
}

router.get('/', route(async (req, res) => {
  const clientId = typeof req.query.clientId === 'string' ? id.parse(req.query.clientId) : req.user!.id;
  if (req.user!.role === 'CLIENT' && clientId !== req.user!.id) return res.status(403).json({ error: 'Access denied.' });
  if (req.user!.role === 'COACH') {
    const owned = demo ? demoUsers.some(client => client.id === clientId && client.coachId === req.user!.id) : await prisma.user.findFirst({ where: { id: clientId, coachId: req.user!.id, role: 'CLIENT' }, select: { id: true } });
    if (!owned) return res.status(404).json({ error: 'Client not found.' });
  }
  const sessions = demo ? demoTrainingSessions.filter(item => item.clientId === clientId).sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 60) : await prisma.trainingSession.findMany({ where: { clientId }, orderBy: { startedAt: 'desc' }, take: 60 });
  res.json(sessions);
}));

router.post('/', route(async (req, res) => {
  if (req.user!.role !== 'CLIENT') return res.status(403).json({ error: 'Client access required.' });
  const input = startInput.parse(req.body);
  const active = demo ? demoTrainingSessions.find(item => item.clientId === req.user!.id && item.status === 'IN_PROGRESS') : await prisma.trainingSession.findFirst({ where: { clientId: req.user!.id, status: 'IN_PROGRESS' } });
  if (active) return res.status(409).json({ error: 'Finish or discard your current session before starting another one.', sessionId: active.id });
  if (demo && demoTrainingSessions.length >= MAX_DEMO_TRAINING_SESSIONS) return res.status(429).json({ error: 'Demo training limit reached. Restart the demo server to reset temporary data.' });
  const program = demo ? demoPrograms.find(item => item.id === input.programId && item.clientId === req.user!.id && item.status === 'ASSIGNED') : await prisma.program.findFirst({ where: { id: input.programId, clientId: req.user!.id, status: 'ASSIGNED' } });
  if (!program) return res.status(404).json({ error: 'Assigned program not found.' });
  const day = (program.content as { days?: { label?: string; exercises?: { code?: string; name?: string; nbSets?: { value?: number; min?: number; max?: number }; nbReps?: { value?: number; min?: number; max?: number }; restSeconds?: { value?: number; min?: number; max?: number } }[] }[] }).days?.[input.dayIndex];
  if (!day?.exercises?.length || day.exercises.length > 50 || day.exercises.some(exercise => !exercise.code || !exercise.name)) return res.status(400).json({ error: 'This training day has no usable exercises.' });
  const content: TrainingContent = { programName: program.name, dayLabel: day.label || '', dayIndex: input.dayIndex, exercises: day.exercises.map(exercise => ({ code: exercise.code!, name: exercise.name!, targetSets: prescription(exercise.nbSets) ?? null, targetReps: targetReps(exercise.nbReps), restSeconds: prescription(exercise.restSeconds) ?? null, sets: [], skipped: false, extra: false })) };
  const now = new Date().toISOString();
  let session: DemoTrainingSession | Awaited<ReturnType<typeof prisma.trainingSession.create>>;
  if (demo) session = { id: randomUUID(), clientId: req.user!.id, programId: program.id, status: 'IN_PROGRESS', content, startedAt: now, completedAt: null, updatedAt: now };
  else {
    try { session = await prisma.trainingSession.create({ data: { clientId: req.user!.id, programId: program.id, content: content as unknown as Prisma.InputJsonValue } }); }
    catch (error) { if ((error as { code?: string }).code === 'P2002') return res.status(409).json({ error: 'Finish or discard your current session before starting another one.' }); throw error; }
  }
  if (demo) demoTrainingSessions.unshift(session as DemoTrainingSession);
  res.status(201).json(session);
}));

router.get('/:sessionId', route(async (req, res) => {
  const session = await accessibleSession(req, id.parse(req.params.sessionId));
  if (!session) return res.status(404).json({ error: 'Training session not found.' });
  res.json(session);
}));

router.get('/:sessionId/exercises/:exerciseIndex/embed', route(async (req, res) => {
  if (req.user!.role !== 'CLIENT') return res.status(403).json({ error: 'Client access required.' });
  const sessionId = id.parse(req.params.sessionId);
  const exerciseIndex = z.coerce.number().int().min(0).max(49).parse(req.params.exerciseIndex);
  const session = await accessibleSession(req, sessionId);
  if (!session || session.status !== 'IN_PROGRESS') return res.status(404).json({ error: 'Active training session not found.' });
  const exerciseCode = asContent(session.content).exercises[exerciseIndex]?.code;
  if (!exerciseCode || !code.safeParse(exerciseCode).success) return res.status(404).json({ error: 'Exercise not found in this session.' });
  if (demo) return res.status(404).json({ error: 'Exercise embeds are unavailable in demo mode.' });
  res.set('Cache-Control', 'no-store').json({ url: await workout.exerciseEmbedUrl(exerciseCode) });
}));

router.put('/:sessionId/exercise', route(async (req, res) => {
  if (req.user!.role !== 'CLIENT') return res.status(403).json({ error: 'Client access required.' });
  const input = setsInput.parse(req.body);
  const session = await accessibleSession(req, id.parse(req.params.sessionId));
  if (!session) return res.status(404).json({ error: 'Training session not found.' });
  if (session.status !== 'IN_PROGRESS') return res.status(409).json({ error: 'This session is already complete.' });
  const content = structuredClone(asContent(session.content));
  const exercise = content.exercises[input.exerciseIndex];
  if (!exercise) return res.status(404).json({ error: 'Exercise not found in this session.' });
  if (input.skipped && input.sets.length) return res.status(400).json({ error: 'A skipped exercise cannot have recorded sets.' });
  exercise.sets = input.sets;
  exercise.skipped = input.skipped;
  const updated = demo ? Object.assign(session, { content, updatedAt: new Date().toISOString() }) : await prisma.trainingSession.update({ where: { id: session.id }, data: { content: content as unknown as Prisma.InputJsonValue } });
  res.json(updated);
}));

router.post('/:sessionId/exercises', route(async (req, res) => {
  if (req.user!.role !== 'CLIENT') return res.status(403).json({ error: 'Client access required.' });
  const input = extraInput.parse(req.body);
  const session = await accessibleSession(req, id.parse(req.params.sessionId));
  if (!session) return res.status(404).json({ error: 'Training session not found.' });
  if (session.status !== 'IN_PROGRESS') return res.status(409).json({ error: 'This session is already complete.' });
  const content = structuredClone(asContent(session.content));
  if (content.exercises.length >= 50) return res.status(400).json({ error: 'This session has reached its exercise limit.' });
  const found = demo ? demoExercises.find(exercise => exercise.code === input.code && exercise.name === input.name) : (await workout.exercises(input.name)).find(exercise => exercise.code === input.code && exercise.name === input.name);
  if (!found) return res.status(400).json({ error: 'Choose an exercise from the library.' });
  content.exercises.push({ code: found.code, name: found.name, targetSets: null, targetReps: '', restSeconds: null, sets: [], skipped: false, extra: true });
  const updated = demo ? Object.assign(session, { content, updatedAt: new Date().toISOString() }) : await prisma.trainingSession.update({ where: { id: session.id }, data: { content: content as unknown as Prisma.InputJsonValue } });
  res.status(201).json(updated);
}));

router.delete('/:sessionId/exercises/:exerciseIndex', route(async (req, res) => {
  if (req.user!.role !== 'CLIENT') return res.status(403).json({ error: 'Client access required.' });
  const index = z.coerce.number().int().min(0).max(49).parse(req.params.exerciseIndex);
  const session = await accessibleSession(req, id.parse(req.params.sessionId));
  if (!session) return res.status(404).json({ error: 'Training session not found.' });
  if (session.status !== 'IN_PROGRESS') return res.status(409).json({ error: 'This session is already complete.' });
  const content = structuredClone(asContent(session.content));
  const exercise = content.exercises[index];
  if (!exercise?.extra || exercise.sets.length) return res.status(400).json({ error: 'Only an added exercise without sets can be removed.' });
  content.exercises.splice(index, 1);
  const updated = demo ? Object.assign(session, { content, updatedAt: new Date().toISOString() }) : await prisma.trainingSession.update({ where: { id: session.id }, data: { content: content as unknown as Prisma.InputJsonValue } });
  res.json(updated);
}));

router.post('/:sessionId/finish', route(async (req, res) => {
  if (req.user!.role !== 'CLIENT') return res.status(403).json({ error: 'Client access required.' });
  const session = await accessibleSession(req, id.parse(req.params.sessionId));
  if (!session) return res.status(404).json({ error: 'Training session not found.' });
  if (session.status !== 'IN_PROGRESS') return res.status(409).json({ error: 'This session is already complete.' });
  if (!asContent(session.content).exercises.some(exercise => exercise.sets.length)) return res.status(400).json({ error: 'Record at least one set before finishing.' });
  const now = new Date();
  const updated = demo
    ? { ...session, status: 'COMPLETED' as const, completedAt: now.toISOString(), updatedAt: now.toISOString() }
    : await prisma.trainingSession.update({ where: { id: session.id }, data: { status: 'COMPLETED', completedAt: now } });
  if (demo) demoTrainingSessions.splice(demoTrainingSessions.findIndex(item => item.id === session.id), 1);
  res.json(updated);
}));

router.delete('/:sessionId', route(async (req, res) => {
  if (req.user!.role !== 'CLIENT') return res.status(403).json({ error: 'Client access required.' });
  const session = await accessibleSession(req, id.parse(req.params.sessionId));
  if (!session) return res.status(404).json({ error: 'Training session not found.' });
  if (session.status !== 'IN_PROGRESS') return res.status(409).json({ error: 'Completed sessions cannot be discarded.' });
  if (demo) demoTrainingSessions.splice(demoTrainingSessions.findIndex(item => item.id === session.id), 1);
  else await prisma.trainingSession.delete({ where: { id: session.id } });
  res.json({ ok: true });
}));

export { router as trainingRouter };
