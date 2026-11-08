import 'dotenv/config';
import express, { type ErrorRequestHandler } from 'express';
import cookieParser from 'cookie-parser';
import { randomBytes, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma, demo, hash, passwordHash, verifyPassword, publicUser, createSession, session, requireUser, requireCoach, type AuthedRequest } from './auth.js';
import { demoUsers, demoPrograms, demoLogs, demoMessages, demoInvites, demoExercises, demoGenerate, demoTrainingSessions } from './demo.js';
import * as workout from './lib/workoutapi/index.js';
import { generation } from './generation.js';
import { passwordResetEmail } from './email/templates/password-reset.js';
import { invitationEmail } from './email/templates/invitation.js';
import { sendEmail, smtpConfigured } from './email/send.js';
import { startEmailWorker } from './email/notifications/worker.js';
import { outgoingEmailLocale } from './email/i18n/index.js';
import { brand } from '../src/config/brand.js';
import { trainingRouter } from './training.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
const authAttempts = new Map<string, { count: number; reset: number }>();
app.use('/api/auth', (req, res, next) => {
  if (demo || req.method !== 'POST') return next();
  const key = req.ip || 'unknown'; const now = Date.now(); const record = authAttempts.get(key);
  const current = !record || record.reset < now ? { count: 0, reset: now + 15 * 60000 } : record;
  current.count += 1; authAttempts.set(key, current);
  if (current.count > 20) { res.status(429).json({ error: 'Too many authentication attempts. Try again later.' }); return; }
  next();
});
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.headers.origin && req.headers.origin !== (process.env.WEB_ORIGIN || 'http://localhost:3000')) { res.status(403).json({ error: 'Invalid request origin.' }); return; }
  next();
});
app.use(session);
app.use('/api/training-sessions', trainingRouter);
const route = (fn: (req: AuthedRequest, res: express.Response) => Promise<unknown> | unknown) => async (req: AuthedRequest, res: express.Response, next: express.NextFunction) => { try { await fn(req, res); } catch (error) { next(error); } };
const parse = <T extends z.ZodType>(schema: T, input: unknown): z.infer<T> => schema.parse(input);
const id = z.string().min(1).max(100);
const profile = z.object({ name: z.string().trim().min(2).max(100), goal: z.string().max(500).nullable().optional(), notes: z.string().max(2000).nullable().optional() });
const ownProfile = profile.extend({ weightUnit: z.enum(['KG', 'LB']).optional(), notifyMessages: z.boolean().optional(), notifyPrograms: z.boolean().optional() });
const credentials = z.object({ email: z.email().transform(s => s.toLowerCase()), password: z.string().min(10).max(200) });
const inviteInput = z.object({ name: z.string().trim().min(2).max(100), email: z.email().transform(s => s.toLowerCase()), goal: z.string().max(500).optional() });
const logInput = z.object({ programId: id, exerciseCode: id, sets: z.number().int().min(1).max(30), reps: z.number().int().min(1).max(1000), weightKg: z.number().min(0).max(10000).nullable().optional(), notes: z.string().max(2000).nullable().optional(), performedOn: z.iso.date().refine(value => value <= new Date(Date.now() + 86400000).toISOString().slice(0, 10)).optional() });

app.get('/api/health', route(async (_req, res) => { if (!demo) await prisma.$queryRaw`SELECT 1`; res.json({ ok: true, mode: demo ? 'demo' : 'live', workoutConfigured: !demo && !!process.env.WORKOUTAPI_KEY }); }));
app.get('/api/bootstrap', route(async (req, res) => { res.json({ mode: demo ? 'demo' : 'live', user: req.user || null, workoutConfigured: !demo && !!process.env.WORKOUTAPI_KEY }); }));
app.post('/api/auth/demo-login', route(async (req, res) => { if (!demo) return res.status(404).json({ error: 'Demo mode is disabled.' }); const role = parse(z.enum(['COACH', 'CLIENT']), req.body.role); const user = demoUsers.find(u => u.role === role)!; await createSession(res, user.id); res.json({ user: publicUser(user) }); }));
app.post('/api/auth/register', route(async (req, res) => { if (demo) return res.status(400).json({ error: 'Use demo sign in in demo mode.' }); const input = parse(credentials.extend({ name: z.string().trim().min(2).max(100) }), req.body); const user = await prisma.user.create({ data: { email: input.email, name: input.name, passwordHash: passwordHash(input.password), role: 'COACH' } }); await createSession(res, user.id); res.status(201).json({ user: publicUser(user) }); }));
app.post('/api/auth/login', route(async (req, res) => { if (demo) return res.status(400).json({ error: 'Use demo sign in in demo mode.' }); const input = parse(credentials, req.body); const user = await prisma.user.findUnique({ where: { email: input.email } }); if (!user?.passwordHash || !verifyPassword(input.password, user.passwordHash)) return res.status(401).json({ error: 'Invalid email or password.' }); await createSession(res, user.id); res.json({ user: publicUser(user) }); }));
app.post('/api/auth/forgot-password', route(async (req, res) => {
  if (demo) return res.status(400).json({ error: 'Password recovery is unavailable in demo mode.' });
  const { email } = parse(z.object({ email: z.email().transform(s => s.toLowerCase()) }), req.body);
  const missingSmtp = (['SMTP_HOST', 'SMTP_FROM'] as const).filter(key => !process.env[key]);
  if (missingSmtp.length) {
    console.error('Password recovery email configuration missing:', missingSmtp.join(', '));
    return res.status(503).json({ error: 'Password recovery email is not configured. Contact the application operator.' });
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const token = randomBytes(32).toString('base64url');
    await prisma.passwordReset.create({ data: { userId: user.id, tokenHash: hash(token), expiresAt: new Date(Date.now() + 3600000) } });
    const resetUrl = `${process.env.WEB_ORIGIN || 'http://localhost:3000'}/?reset=${encodeURIComponent(token)}`;
    let message: Awaited<ReturnType<typeof passwordResetEmail>>;
    try {
      message = await passwordResetEmail(resetUrl, outgoingEmailLocale(user.emailLocale));
    } catch (error) {
      console.error('Password recovery email rendering failed', error instanceof Error ? error.name : typeof error);
      return res.status(500).json({ error: 'Password recovery email could not be prepared. Try again later.' });
    }
    try {
      await sendEmail(user.email, message);
    } catch (error) {
      const smtpError = error as { name?: string; message?: string; code?: string; responseCode?: number; command?: string };
      const hidden = [token, user.email, process.env.SMTP_HOST, process.env.SMTP_USER, process.env.SMTP_PASSWORD, process.env.SMTP_FROM].filter((value): value is string => !!value);
      let reason = typeof smtpError.message === 'string' ? smtpError.message : String(error);
      for (const value of hidden) reason = reason.replaceAll(value, '[redacted]');
      reason = reason.replace(/https?:\/\/\S+/gi, '[url]').replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email]');
      console.error('Password recovery email delivery failed', { name: smtpError.name || typeof error, code: smtpError.code, responseCode: smtpError.responseCode, command: smtpError.command, reason: reason.slice(0, 300) });
      return res.status(502).json({ error: 'Password recovery email could not be sent. Try again later.' });
    }
  }
  res.json({ ok: true });
}));
app.post('/api/auth/reset-password', route(async (req, res) => { if (demo) return res.status(400).json({ error: 'Password recovery is unavailable in demo mode.' }); const { token, password } = parse(z.object({ token: z.string().min(20), password: z.string().min(10).max(200) }), req.body); const reset = await prisma.passwordReset.findUnique({ where: { tokenHash: hash(token) } }); if (!reset || reset.usedAt || reset.expiresAt < new Date()) return res.status(400).json({ error: 'Reset link is expired or invalid.' }); await prisma.$transaction(async tx => { await tx.user.update({ where: { id: reset.userId }, data: { passwordHash: passwordHash(password) } }); await tx.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }); await tx.session.deleteMany({ where: { userId: reset.userId } }); }); res.json({ ok: true }); }));
app.post('/api/auth/logout', route(async (req, res) => { const token = req.cookies?.coach_session; if (!demo && token) await prisma.session.deleteMany({ where: { tokenHash: hash(token) } }); res.clearCookie('coach_session', { path: '/' }); res.json({ ok: true }); }));
app.get('/api/invites/:token', route(async (req, res) => { const token = String(req.params.token); if (demo) { const invite = demoInvites.find(i => i.token === token); if (!invite) return res.status(404).json({ error: 'Invite not found.' }); return res.json({ name: invite.name, email: invite.email }); } const invite = await prisma.invite.findUnique({ where: { tokenHash: hash(token) } }); if (!invite || invite.usedAt || invite.expiresAt < new Date()) return res.status(404).json({ error: 'Invite expired or not found.' }); res.json({ name: invite.name, email: invite.email }); }));
app.post('/api/auth/accept-invite', route(async (req, res) => { const { token, password } = parse(z.object({ token: z.string().min(20), password: z.string().min(10).max(200) }), req.body); if (demo) { const index = demoInvites.findIndex(i => i.token === token); if (index < 0) return res.status(404).json({ error: 'Invite not found.' }); const invite = demoInvites.splice(index, 1)[0]; const user = { id: randomUUID(), email: invite.email, name: invite.name, goal: invite.goal || null, notes: null, coachId: invite.coachId, role: 'CLIENT' as const, weightUnit: 'KG' as const, emailLocale: 'en', notifyMessages: true, notifyPrograms: true }; demoUsers.push(user); await createSession(res, user.id); return res.status(201).json({ user: publicUser(user) }); } const invite = await prisma.invite.findUnique({ where: { tokenHash: hash(token) } }); if (!invite || invite.usedAt || invite.expiresAt < new Date()) return res.status(404).json({ error: 'Invite expired or not found.' }); const user = await prisma.$transaction(async tx => { const created = await tx.user.create({ data: { email: invite.email, name: invite.name, goal: invite.goal, role: 'CLIENT', coachId: invite.coachId, passwordHash: passwordHash(password) } }); await tx.invite.update({ where: { id: invite.id }, data: { usedAt: new Date() } }); return created; }); await createSession(res, user.id); res.status(201).json({ user: publicUser(user) }); }));
app.get('/api/me', requireUser, route(async (req, res) => res.json(req.user)));
app.put('/api/me', requireUser, route(async (req, res) => { const input = req.user!.role === 'CLIENT' ? parse(ownProfile.omit({ notes: true }), req.body) : parse(ownProfile, req.body); const user = demo ? Object.assign(demoUsers.find(u => u.id === req.user!.id)!, input) : await prisma.user.update({ where: { id: req.user!.id }, data: input }); res.json(publicUser(user)); }));
app.patch('/api/me/language', requireUser, route(async (req, res) => {
  const { locale } = parse(z.object({ locale: z.string() }), req.body);
  if (!new Set<string>(brand.languages).has(locale)) return res.status(400).json({ error: 'Language is unavailable.' });
  const user = demo ? Object.assign(demoUsers.find(u => u.id === req.user!.id)!, { emailLocale: locale }) : await prisma.user.update({ where: { id: req.user!.id }, data: { emailLocale: locale } });
  res.json(publicUser(user));
}));
app.put('/api/me/password', requireUser, route(async (req, res) => { if (demo) return res.status(400).json({ error: 'Password changes are unavailable in demo mode.' }); const input = parse(z.object({ currentPassword: z.string(), newPassword: z.string().min(10).max(200) }), req.body); const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } }); if (!user.passwordHash || !verifyPassword(input.currentPassword, user.passwordHash)) return res.status(403).json({ error: 'Current password is incorrect.' }); await prisma.user.update({ where: { id: user.id }, data: { passwordHash: passwordHash(input.newPassword) } }); await prisma.session.deleteMany({ where: { userId: user.id, tokenHash: { not: hash(req.cookies.coach_session) } } }); res.json({ ok: true }); }));
app.delete('/api/me', requireUser, route(async (req, res) => { if (demo) return res.status(400).json({ error: 'Account deletion is unavailable in demo mode.' }); const { password } = parse(z.object({ password: z.string() }), req.body); const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } }); if (!user.passwordHash || !verifyPassword(password, user.passwordHash)) return res.status(403).json({ error: 'Password is incorrect.' }); await prisma.$transaction(async tx => { if (user.role === 'COACH') await tx.invite.deleteMany({ where: { coachId: user.id } }); else await tx.program.updateMany({ where: { clientId: user.id, status: 'ASSIGNED' }, data: { clientId: null, status: 'DRAFT' } }); await tx.user.delete({ where: { id: user.id } }); }); res.clearCookie('coach_session', { path: '/' }); res.json({ ok: true }); }));
app.get('/api/clients', requireUser, route(async (req, res) => { if (req.user!.role !== 'COACH') return res.status(403).json({ error: 'Coach access required.' }); const clients = demo ? demoUsers.filter(u => u.coachId === req.user!.id) : await prisma.user.findMany({ where: { coachId: req.user!.id, role: 'CLIENT' }, orderBy: { createdAt: 'desc' } }); res.json(clients.map(user => publicUser(user, true))); }));
app.post('/api/clients/invite', requireUser, requireCoach, route(async (req, res) => {
  const input = parse(inviteInput, req.body);
  const token = randomBytes(32).toString('base64url');
  if (demo) demoInvites.push({ ...input, token, coachId: req.user!.id });
  else await prisma.invite.create({ data: { ...input, tokenHash: hash(token), coachId: req.user!.id, expiresAt: new Date(Date.now() + 7 * 86400000) } });
  const inviteUrl = `${process.env.WEB_ORIGIN || 'http://localhost:3000'}/?invite=${encodeURIComponent(token)}`;
  let emailSent = false;
  if (!demo && process.env.NODE_ENV !== 'test' && smtpConfigured()) {
    try { await sendEmail(input.email, await invitationEmail(req.user!.name, input.name, inviteUrl, outgoingEmailLocale(req.user!.emailLocale))); emailSent = true; }
    catch (error) { const failure = error as { name?: string; code?: string; responseCode?: number }; console.error('Invitation email failed', { name: failure.name || typeof error, code: failure.code, responseCode: failure.responseCode }); }
  }
  res.status(201).json({ inviteUrl, emailSent });
}));
app.put('/api/clients/:clientId', requireUser, requireCoach, route(async (req, res) => { const input = parse(profile, req.body); const clientId = String(req.params.clientId); const found = demo ? demoUsers.find(u => u.id === clientId && u.coachId === req.user!.id) : await prisma.user.findFirst({ where: { id: clientId, coachId: req.user!.id } }); if (!found) return res.status(404).json({ error: 'Client not found.' }); const updated = demo ? Object.assign(found, input) : await prisma.user.update({ where: { id: clientId }, data: input }); res.json(publicUser(updated, true)); }));
app.get('/api/exercises', requireUser, route(async (req, res) => { const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 100) : undefined; const muscle = typeof req.query.muscle === 'string' ? req.query.muscle.slice(0, 100) : undefined; const data = demo ? demoExercises.filter(e => (!q || e.name.toLowerCase().includes(q.toLowerCase())) && (!muscle || e.primaryMuscles.some(m => m.code === muscle))) : await workout.exercises(q, muscle); res.json(data); }));
app.get('/api/exercises/:code/image', requireUser, route(async (req, res) => {
  const code = parse(z.string().min(2).max(100).regex(/^[A-Za-z0-9_-]+$/), String(req.params.code));
  if (demo) return res.status(404).end();
  const image = await workout.exerciseImage(code);
  res.set('Cache-Control', `private, max-age=${Math.max(0, Math.floor((image.expiresAt - Date.now()) / 1000))}`);
  if (!image.bytes) return res.status(404).end();
  res.type('png').send(image.bytes);
}));
app.get('/api/references', requireUser, route(async (_req, res) => { res.json(demo ? {
  muscles: [...new Map(demoExercises.flatMap(exercise => exercise.primaryMuscles).map(muscle => [muscle.code, muscle])).values()],
  categories: [...new Map(demoExercises.flatMap(exercise => exercise.categories).map(category => [category.code, category])).values()],
  types: [...new Map(demoExercises.flatMap(exercise => exercise.types).map(type => [type.code, type])).values()]
} : await workout.references()); }));
app.get('/api/goals', requireUser, route(async (_req, res) => { res.json(workout.goals); }));
app.get('/api/programs', requireUser, route(async (req, res) => { const user = req.user!; const data = demo ? demoPrograms.filter(p => user.role === 'COACH' ? p.coachId === user.id : p.clientId === user.id && p.status === 'ASSIGNED') : await prisma.program.findMany({ where: user.role === 'COACH' ? { coachId: user.id } : { clientId: user.id, status: 'ASSIGNED' }, orderBy: { updatedAt: 'desc' } }); res.json(data); }));
app.get('/api/programs/:programId/exercises/:dayIndex/:exerciseIndex/embed', requireUser, route(async (req, res) => {
  const { programId, dayIndex, exerciseIndex } = parse(z.object({ programId: id, dayIndex: z.coerce.number().int().min(0).max(6), exerciseIndex: z.coerce.number().int().min(0).max(14) }), req.params);
  const user = req.user!;
  const found = demo ? demoPrograms.find(p => p.id === programId && (user.role === 'COACH' ? p.coachId === user.id : p.clientId === user.id && p.status === 'ASSIGNED')) : await prisma.program.findFirst({ where: { id: programId, ...(user.role === 'COACH' ? { coachId: user.id } : { clientId: user.id, status: 'ASSIGNED' }) } });
  if (!found) return res.status(404).json({ error: 'Program not found.' });
  const content = found.content as { days?: { exercises?: { code?: string }[] }[] };
  const code = content.days?.[dayIndex]?.exercises?.[exerciseIndex]?.code;
  if (!code || !/^[A-Za-z0-9_-]{1,100}$/.test(code)) return res.status(404).json({ error: 'Exercise not found in program.' });
  if (demo) return res.status(404).json({ error: 'Exercise embeds are unavailable in demo mode.' });
  res.set('Cache-Control', 'no-store').json({ url: await workout.exerciseEmbedUrl(code) });
}));
app.post('/api/programs', requireUser, requireCoach, route(async (req, res) => { const input = parse(generation, req.body); if (demo) { const program = demoGenerate(input.name, input.description, input.goal, input.days); program.coachId = req.user!.id; demoPrograms.unshift(program); return res.status(201).json(program); } const generated = await workout.createProgram(input); const program = await prisma.program.create({ data: { coachId: req.user!.id, apiProgramId: generated.programId, name: input.name, description: input.description, content: generated as object } }); res.status(201).json(program); }));
app.put('/api/programs/:programId', requireUser, requireCoach, route(async (req, res) => { const input = parse(z.object({ name: z.string().trim().min(2).max(200), description: z.string().max(10000).nullable().optional() }), req.body); const found = demo ? demoPrograms.find(p => p.id === String(req.params.programId) && p.coachId === req.user!.id) : await prisma.program.findFirst({ where: { id: String(req.params.programId), coachId: req.user!.id } }); if (!found) return res.status(404).json({ error: 'Program not found.' }); if (!demo && found.apiProgramId) await workout.updateProgram(found.apiProgramId, { name: input.name, description: input.description || '' }); const updated = demo ? Object.assign(found, input, { updatedAt: new Date().toISOString() }) : await prisma.program.update({ where: { id: found.id }, data: input }); res.json(updated); }));
app.patch('/api/programs/:programId/exercise', requireUser, requireCoach, route(async (req, res) => { const input = parse(z.object({ dayIndex: z.number().int().min(0).max(6), exerciseIndex: z.number().int().min(0).max(14), sets: z.number().int().min(1).max(30), reps: z.number().int().min(1).max(1000), restSeconds: z.number().int().min(0).max(3640) }), req.body); const found = demo ? demoPrograms.find(p => p.id === String(req.params.programId) && p.coachId === req.user!.id) : await prisma.program.findFirst({ where: { id: String(req.params.programId), coachId: req.user!.id } }); if (!found) return res.status(404).json({ error: 'Program not found.' }); const content = structuredClone(found.content) as { days?: { label?: string; exercises?: Record<string, unknown>[] }[] }; const exercise = content.days?.[input.dayIndex]?.exercises?.[input.exerciseIndex]; if (!exercise) return res.status(404).json({ error: 'Exercise not found in program.' }); exercise.nbSets = { value: input.sets }; exercise.nbReps = { value: input.reps }; exercise.restSeconds = { value: input.restSeconds }; if (!demo && found.apiProgramId) await workout.updateProgram(found.apiProgramId, { days: content.days as Parameters<typeof workout.updateProgram>[1]['days'] }); const updated = demo ? Object.assign(found, { content, updatedAt: new Date().toISOString() }) : await prisma.program.update({ where: { id: found.id }, data: { content: content as Prisma.InputJsonValue } }); res.json(updated); }));
app.post('/api/programs/:programId/assign', requireUser, requireCoach, route(async (req, res) => {
  const { clientId } = parse(z.object({ clientId: id }), req.body);
  const found = demo ? demoPrograms.find(p => p.id === String(req.params.programId) && p.coachId === req.user!.id) : await prisma.program.findFirst({ where: { id: String(req.params.programId), coachId: req.user!.id } });
  const client = demo ? demoUsers.find(u => u.id === clientId && u.coachId === req.user!.id) : await prisma.user.findFirst({ where: { id: clientId, coachId: req.user!.id, role: 'CLIENT' } });
  if (!found || !client) return res.status(404).json({ error: 'Program or client not found.' });
  const changed = found.status !== 'ASSIGNED' || found.clientId !== clientId;
  const updated = demo ? Object.assign(found, { clientId, status: 'ASSIGNED' as const, updatedAt: new Date().toISOString() }) : await prisma.$transaction(async tx => {
    const program = await tx.program.update({ where: { id: found.id }, data: { clientId, status: 'ASSIGNED' } });
    if (changed && client.notifyPrograms) await tx.emailJob.create({ data: { kind: 'PROGRAM', recipientId: clientId, senderId: req.user!.id, programId: found.id, sendAfter: new Date() } });
    return program;
  });
  res.json(updated);
}));
app.post('/api/programs/:programId/share', requireUser, requireCoach, route(async (req, res) => { const found = demo ? demoPrograms.find(p => p.id === String(req.params.programId) && p.coachId === req.user!.id) : await prisma.program.findFirst({ where: { id: String(req.params.programId), coachId: req.user!.id } }); if (!found) return res.status(404).json({ error: 'Program not found.' }); if (demo) return res.status(400).json({ error: 'Public Workout API sharing is only available in live mode.' }); if (!found.apiProgramId) return res.status(400).json({ error: 'This program has no Workout API ID.' }); const shared = await workout.shareProgram(found.apiProgramId); const updated = await prisma.program.update({ where: { id: found.id }, data: { shareUrl: shared.url } }); res.json(updated); }));
app.delete('/api/programs/:programId/share', requireUser, requireCoach, route(async (req, res) => { if (demo) return res.status(400).json({ error: 'Public Workout API sharing is only available in live mode.' }); const found = await prisma.program.findFirst({ where: { id: String(req.params.programId), coachId: req.user!.id } }); if (!found) return res.status(404).json({ error: 'Program not found.' }); if (found.apiProgramId) await workout.unshareProgram(found.apiProgramId); res.json(await prisma.program.update({ where: { id: found.id }, data: { shareUrl: null } })); }));
app.delete('/api/programs/:programId', requireUser, requireCoach, route(async (req, res) => { const found = demo ? demoPrograms.find(p => p.id === String(req.params.programId) && p.coachId === req.user!.id) : await prisma.program.findFirst({ where: { id: String(req.params.programId), coachId: req.user!.id } }); if (!found) return res.status(404).json({ error: 'Program not found.' }); if (demo) { found.status = 'ARCHIVED'; found.clientId = null; return res.json(found); } res.json(await prisma.program.update({ where: { id: found.id }, data: { status: 'ARCHIVED', clientId: null } })); }));
app.get('/api/logs', requireUser, route(async (req, res) => {
  const query = parse(z.strictObject({ clientId: id.optional(), exerciseCode: id.optional(), includeGuided: z.enum(['true']).optional(), page: z.coerce.number().int().min(1).max(1000000).optional(), pageSize: z.coerce.number().int().min(1).max(20).optional() }), req.query);
  const clientId = query.clientId || req.user!.id;
  if (req.user!.role === 'CLIENT' && clientId !== req.user!.id) return res.status(403).json({ error: 'Access denied.' });
  if (req.user!.role === 'COACH') {
    const owned = demo ? demoUsers.some(u => u.id === clientId && u.coachId === req.user!.id) : !!await prisma.user.findFirst({ where: { id: clientId, coachId: req.user!.id, role: 'CLIENT' } });
    if (!owned) return res.status(404).json({ error: 'Client not found.' });
  }
  if (query.page != null && !query.exerciseCode) {
    const pageSize = query.pageSize ?? 8;
    if (demo) {
      const all = demoLogs.filter(l => l.clientId === clientId);
      const dayOf = (log: typeof demoLogs[number]) => log.performedOn?.slice(0, 10) || log.performedAt.slice(0, 10);
      const days = [...new Set(all.map(dayOf))].sort().reverse();
      const selected = new Set(days.slice((query.page - 1) * pageSize, query.page * pageSize));
      const items = all.filter(log => selected.has(dayOf(log))).sort((a, b) => dayOf(b).localeCompare(dayOf(a)) || b.performedAt.localeCompare(a.performedAt));
      return res.json({ items, totalSessions: days.length, page: query.page, pageSize });
    }
    const days = await prisma.performance.groupBy({ by: ['performedOn'], where: { clientId }, orderBy: { performedOn: 'desc' } });
    const selected = days.slice((query.page - 1) * pageSize, query.page * pageSize).map(day => day.performedOn);
    const items = selected.length ? await prisma.performance.findMany({ where: { clientId, performedOn: { in: selected } }, orderBy: [{ performedOn: 'desc' }, { performedAt: 'desc' }, { id: 'desc' }] }) : [];
    return res.json({ items, totalSessions: days.length, page: query.page, pageSize });
  }
  const data = demo
    ? demoLogs.filter(l => l.clientId === clientId && (!query.exerciseCode || l.exerciseCode === query.exerciseCode)).sort((a,b) => b.performedAt.localeCompare(a.performedAt))
    : await prisma.performance.findMany({ where: { clientId, ...(query.exerciseCode ? { exerciseCode: query.exerciseCode } : {}) }, orderBy: [{ performedOn: 'desc' }, { performedAt: 'desc' }, { id: 'desc' }] });
  if (query.includeGuided && query.exerciseCode) {
    const sessions = demo ? demoTrainingSessions.filter(session => session.clientId === clientId && session.status === 'COMPLETED') : await prisma.trainingSession.findMany({ where: { clientId, status: 'COMPLETED' }, select: { id: true, clientId: true, programId: true, content: true, completedAt: true } });
    const guided = sessions.flatMap(session => {
      const performedAt = session.completedAt ? new Date(session.completedAt).toISOString() : '';
      if (!performedAt) return [];
      const exercises = (session.content as { exercises?: { code?: string; name?: string; sets?: { reps: number; weightKg: number | null }[] }[] }).exercises || [];
      return exercises.flatMap((exercise, exerciseIndex) => exercise.code === query.exerciseCode && Array.isArray(exercise.sets) ? exercise.sets.map((set, setIndex) => ({ id: `${session.id}:${exerciseIndex}:${setIndex}`, clientId, programId: session.programId || '', exerciseCode: exercise.code!, exerciseName: exercise.name || '', sets: 1, reps: set.reps, weightKg: set.weightKg, notes: null, performedAt, performedOn: `${performedAt.slice(0, 10)}T00:00:00.000Z`, source: 'GUIDED' as const })) : []);
    });
    return res.json([...data, ...guided].sort((a, b) => new Date(String(b.performedAt)).getTime() - new Date(String(a.performedAt)).getTime()));
  }
  res.json(data);
}));
app.get('/api/progress-history', requireUser, route(async (req, res) => {
  const query = parse(z.strictObject({ clientId: id.optional(), page: z.coerce.number().int().min(1).max(1000000).optional(), pageSize: z.coerce.number().int().min(1).max(20).optional() }), req.query);
  const clientId = query.clientId || req.user!.id;
  if (req.user!.role === 'CLIENT' && clientId !== req.user!.id) return res.status(403).json({ error: 'Access denied.' });
  if (req.user!.role === 'COACH') {
    const owned = demo ? demoUsers.some(user => user.id === clientId && user.coachId === req.user!.id) : await prisma.user.findFirst({ where: { id: clientId, coachId: req.user!.id, role: 'CLIENT' }, select: { id: true } });
    if (!owned) return res.status(404).json({ error: 'Client not found.' });
  }
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 8;
  const guidedDates = demo
    ? demoTrainingSessions.filter(item => item.clientId === clientId && item.status === 'COMPLETED' && item.completedAt).map(item => ({ id: item.id, date: item.completedAt! }))
    : (await prisma.trainingSession.findMany({ where: { clientId, status: 'COMPLETED', completedAt: { not: null } }, select: { id: true, completedAt: true } })).map(item => ({ id: item.id, date: item.completedAt!.toISOString() }));
  const individualDates = demo
    ? [...new Set(demoLogs.filter(item => item.clientId === clientId).map(item => (item.performedOn || item.performedAt).slice(0, 10)))]
    : (await prisma.performance.groupBy({ by: ['performedOn'], where: { clientId } })).map(item => item.performedOn.toISOString().slice(0, 10));
  const timeline = [
    ...guidedDates.map(item => ({ kind: 'GUIDED' as const, id: item.id, date: item.date })),
    ...individualDates.map(date => ({ kind: 'INDIVIDUAL' as const, id: date, date: `${date}T12:00:00.000Z` }))
  ].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const selected = timeline.slice((page - 1) * pageSize, page * pageSize);
  const sessionIds = selected.filter(item => item.kind === 'GUIDED').map(item => item.id);
  const dates = selected.filter(item => item.kind === 'INDIVIDUAL').map(item => item.id);
  const sessions = demo ? demoTrainingSessions.filter(item => item.clientId === clientId && sessionIds.includes(item.id)) : await prisma.trainingSession.findMany({ where: { clientId, id: { in: sessionIds } } });
  const logs = demo ? demoLogs.filter(item => dates.includes((item.performedOn || item.performedAt).slice(0, 10)) && item.clientId === clientId) : await prisma.performance.findMany({ where: { clientId, performedOn: { in: dates.map(date => new Date(`${date}T00:00:00.000Z`)) } }, orderBy: { performedAt: 'desc' } });
  const logDate = (log: (typeof logs)[number]) => {
    const value = log.performedOn || log.performedAt;
    return (value instanceof Date ? value.toISOString() : value).slice(0, 10);
  };
  const items = selected.map(item => item.kind === 'GUIDED'
    ? { kind: item.kind, date: item.date.slice(0, 10), session: sessions.find(session => session.id === item.id)! }
    : { kind: item.kind, date: item.id, logs: logs.filter(log => logDate(log) === item.id) });
  res.json({ items, totalEntries: timeline.length, page, pageSize });
}));
app.post('/api/logs', requireUser, route(async (req, res) => {
  if (req.user!.role !== 'CLIENT') return res.status(403).json({ error: 'Client access required.' });
  const input = parse(logInput, req.body);
  const program = demo ? demoPrograms.find(p => p.id === input.programId && p.clientId === req.user!.id && p.status === 'ASSIGNED') : await prisma.program.findFirst({ where: { id: input.programId, clientId: req.user!.id, status: 'ASSIGNED' } });
  if (!program) return res.status(404).json({ error: 'Assigned program not found.' });
  const days = (program.content as { days?: { exercises?: { code: string; name: string }[] }[] }).days || [];
  const matched = days.flatMap(d => d.exercises || []).find(e => e.code === input.exerciseCode);
  if (!matched) return res.status(400).json({ error: 'Exercise is not in this program.' });
  const { performedOn, ...log } = input;
  const day = performedOn || new Date().toISOString().slice(0, 10);
  const performedOnDate = new Date(`${day}T00:00:00Z`);
  const performedAt = performedOn ? new Date(`${day}T12:00:00Z`) : new Date();
  const entry = demo
    ? { ...log, exerciseName: matched.name, id: randomUUID(), clientId: req.user!.id, performedAt: performedAt.toISOString(), performedOn: performedOnDate.toISOString(), weightKg: log.weightKg ?? null, notes: log.notes || null }
    : await prisma.performance.create({ data: { ...log, exerciseName: matched.name, clientId: req.user!.id, performedAt, performedOn: performedOnDate } });
  // Demo submissions exercise the form but do not alter the fictional history.
  res.status(201).json(entry);
}));
app.get('/api/messages', requireUser, route(async (req, res) => { const peerId = typeof req.query.peerId === 'string' ? req.query.peerId : ''; const peer = demo ? demoUsers.find(u => u.id === peerId) : await prisma.user.findUnique({ where: { id: peerId } }); if (!peer || !(req.user!.role === 'COACH' ? peer.coachId === req.user!.id : peer.id === req.user!.coachId)) return res.status(403).json({ error: 'Conversation unavailable.' }); const messages = demo ? demoMessages.filter(m => (m.senderId === req.user!.id && m.recipientId === peerId) || (m.senderId === peerId && m.recipientId === req.user!.id)) : await prisma.message.findMany({ where: { OR: [{ senderId: req.user!.id, recipientId: peerId }, { senderId: peerId, recipientId: req.user!.id }] }, orderBy: { createdAt: 'asc' }, take: 200 }); res.json(messages); }));
app.post('/api/messages/read', requireUser, route(async (req, res) => {
  const { peerId } = parse(z.object({ peerId: id }), req.body);
  const peer = demo ? demoUsers.find(u => u.id === peerId) : await prisma.user.findUnique({ where: { id: peerId } });
  if (!peer || !(req.user!.role === 'COACH' ? peer.coachId === req.user!.id : peer.id === req.user!.coachId)) return res.status(403).json({ error: 'Conversation unavailable.' });
  if (demo) { for (const message of demoMessages) if (message.senderId === peerId && message.recipientId === req.user!.id && !message.readAt) message.readAt = new Date().toISOString(); }
  else await prisma.message.updateMany({ where: { senderId: peerId, recipientId: req.user!.id, readAt: null }, data: { readAt: new Date() } });
  res.json({ ok: true });
}));
app.post('/api/messages', requireUser, route(async (req, res) => {
  const { recipientId, body } = parse(z.object({ recipientId: id, body: z.string().trim().min(1).max(2000) }), req.body);
  const peer = demo ? demoUsers.find(u => u.id === recipientId) : await prisma.user.findUnique({ where: { id: recipientId } });
  if (!peer || !(req.user!.role === 'COACH' ? peer.coachId === req.user!.id : peer.id === req.user!.coachId)) return res.status(403).json({ error: 'Recipient unavailable.' });
  const message = demo ? { id: randomUUID(), senderId: req.user!.id, recipientId, body, createdAt: new Date().toISOString(), readAt: null } : await prisma.$transaction(async tx => {
    const created = await tx.message.create({ data: { senderId: req.user!.id, recipientId, body } });
    if (peer.notifyMessages) await tx.emailJob.create({ data: { kind: 'MESSAGE', recipientId, senderId: req.user!.id, messageId: created.id, sendAfter: new Date(Date.now() + 10 * 60000) } });
    return created;
  });
  if (demo) demoMessages.push(message as typeof demoMessages[number]);
  res.status(201).json(message);
}));
app.get('/api/dashboard', requireUser, route(async (req, res) => {
  const user = req.user!;
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const weekStart = new Date(todayUtc - ((today.getUTCDay() + 6) % 7) * 86400000);
  const chartStart = new Date(todayUtc - 13 * 86400000);
  const activityDays = Array.from({ length: 14 }, (_, index) => new Date(chartStart.getTime() + index * 86400000).toISOString().slice(0, 10));
  if (user.role === 'COACH') {
    const clients = demo ? demoUsers.filter(u => u.coachId === user.id).length : await prisma.user.count({ where: { coachId: user.id } });
    const programs = demo ? demoPrograms.filter(p => p.coachId === user.id && p.status !== 'ARCHIVED').length : await prisma.program.count({ where: { coachId: user.id, status: { not: 'ARCHIVED' } } });
    const recent = demo ? demoLogs.filter(l => demoUsers.some(u => u.id === l.clientId && u.coachId === user.id)).sort((a, b) => b.performedAt.localeCompare(a.performedAt)).slice(0, 5) : await prisma.performance.findMany({ where: { client: { coachId: user.id } }, orderBy: { performedAt: 'desc' }, take: 5 });
    const assignedPrograms = demo ? demoPrograms.filter(p => p.coachId === user.id && p.status === 'ASSIGNED').length : await prisma.program.count({ where: { coachId: user.id, status: 'ASSIGNED' } });
    const unreadMessages = demo ? demoMessages.filter(m => m.recipientId === user.id && !m.readAt && demoUsers.some(client => client.id === m.senderId && client.coachId === user.id)).length : await prisma.message.count({ where: { recipientId: user.id, readAt: null, sender: { coachId: user.id } } });
    const guided = demo ? demoTrainingSessions.filter(item => item.status === 'COMPLETED' && demoUsers.some(client => client.id === item.clientId && client.coachId === user.id) && item.completedAt && item.completedAt.slice(0, 10) >= activityDays[0]) : await prisma.trainingSession.findMany({ where: { status: 'COMPLETED', client: { coachId: user.id }, completedAt: { gte: chartStart } }, select: { clientId: true, completedAt: true } });
    const guidedRecent = demo ? demoTrainingSessions.filter(item => item.status === 'COMPLETED' && demoUsers.some(client => client.id === item.clientId && client.coachId === user.id)).sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || '')).slice(0, 5) : await prisma.trainingSession.findMany({ where: { status: 'COMPLETED', client: { coachId: user.id } }, include: { client: { select: { name: true } } }, orderBy: { completedAt: 'desc' }, take: 5 });
    const recentGuided = guidedRecent.map(item => ({ id: item.id, clientId: item.clientId, clientName: demo ? demoUsers.find(client => client.id === item.clientId)?.name || '' : 'client' in item ? item.client.name : '', dayLabel: (item.content as { dayLabel?: string }).dayLabel || '', dayIndex: (item.content as { dayIndex?: number }).dayIndex || 0, performedOn: item.completedAt ? new Date(item.completedAt).toISOString().slice(0, 10) : '', exerciseCount: (item.content as { exercises?: { sets?: unknown[] }[] }).exercises?.filter(exercise => exercise.sets?.length).length || 0 }));
    const activityGroups = demo
      ? [...new Set(demoLogs.filter(log => demoUsers.some(client => client.id === log.clientId && client.coachId === user.id) && (log.performedOn || log.performedAt).slice(0, 10) >= activityDays[0] && (log.performedOn || log.performedAt).slice(0, 10) <= activityDays[13]).map(log => `${log.clientId}:${(log.performedOn || log.performedAt).slice(0, 10)}`))].map(key => ({ clientId: key.split(':')[0], performedOn: key.split(':')[1] }))
      : (await prisma.performance.groupBy({ by: ['clientId', 'performedOn'], where: { client: { coachId: user.id }, performedOn: { gte: chartStart, lte: new Date(todayUtc) } } })).map(group => ({ clientId: group.clientId, performedOn: group.performedOn.toISOString().slice(0, 10) }));
    const counts = new Map<string, number>();
    const trainingDays = new Set(activityGroups.map(group => `${group.clientId}:${group.performedOn}`));
    for (const item of guided) if (item.completedAt) { const day = new Date(item.completedAt).toISOString().slice(0, 10); if (day >= activityDays[0] && day <= activityDays[13]) trainingDays.add(`${item.clientId}:${day}`); }
    for (const key of trainingDays) { const day = key.split(':')[1]; counts.set(day, (counts.get(day) || 0) + 1); }
    const activity = activityDays.map(day => ({ day, sessions: counts.get(day) || 0 }));
    const sessionsThisWeek = activity.filter(point => point.day >= weekStart.toISOString().slice(0, 10)).reduce((total, point) => total + point.sessions, 0);
    if (demo) {
      const sessions = new Map<string, { clientId: string; clientName: string; performedOn: string; logs: typeof demoLogs }>();
      const entries = demoLogs.filter(log => demoUsers.some(client => client.id === log.clientId && client.coachId === user.id))
        .sort((a, b) => (b.performedOn || b.performedAt).slice(0, 10).localeCompare((a.performedOn || a.performedAt).slice(0, 10)) || a.clientId.localeCompare(b.clientId) || b.performedAt.localeCompare(a.performedAt));
      for (const log of entries) {
        const day = (log.performedOn || log.performedAt).slice(0, 10);
        const key = `${log.clientId}:${day}`;
        if (!sessions.has(key)) {
          if (sessions.size === 5) break;
          sessions.set(key, { clientId: log.clientId, clientName: demoUsers.find(client => client.id === log.clientId)!.name, performedOn: day, logs: [] });
        }
        sessions.get(key)!.logs.push(log);
      }
      return res.json({ clients, programs, assignedPrograms, unreadMessages, sessionsThisWeek, activity, recent, recentGuided, recentSessions: [...sessions.values()] });
    }
    const days = await prisma.performance.groupBy({ by: ['clientId', 'performedOn'], where: { client: { coachId: user.id } }, orderBy: [{ performedOn: 'desc' }, { clientId: 'asc' }], take: 5 });
    const entries = days.length ? await prisma.performance.findMany({ where: { OR: days.map(day => ({ clientId: day.clientId, performedOn: day.performedOn })) }, include: { client: { select: { name: true } } }, orderBy: { performedAt: 'desc' } }) : [];
    const recentSessions = days.map(day => {
      const logs = entries.filter(log => log.clientId === day.clientId && log.performedOn.getTime() === day.performedOn.getTime());
      return { clientId: day.clientId, clientName: logs[0]?.client.name || '', performedOn: day.performedOn.toISOString().slice(0, 10), logs };
    });
    return res.json({ clients, programs, assignedPrograms, unreadMessages, sessionsThisWeek, activity, recent, recentGuided, recentSessions });
  }
  const programs = demo ? demoPrograms.filter(p => p.clientId === user.id && p.status === 'ASSIGNED').length : await prisma.program.count({ where: { clientId: user.id, status: 'ASSIGNED' } });
  const currentProgram = demo ? demoPrograms.find(p => p.clientId === user.id && p.status === 'ASSIGNED') : await prisma.program.findFirst({ where: { clientId: user.id, status: 'ASSIGNED' }, orderBy: { updatedAt: 'desc' }, select: { id: true, name: true } });
  const unreadMessages = demo ? demoMessages.filter(m => m.recipientId === user.id && m.senderId === user.coachId && !m.readAt).length : await prisma.message.count({ where: { recipientId: user.id, senderId: user.coachId || '', readAt: null } });
  const guided = demo ? demoTrainingSessions.filter(item => item.clientId === user.id && item.status === 'COMPLETED') : await prisma.trainingSession.findMany({ where: { clientId: user.id, status: 'COMPLETED' }, select: { completedAt: true } });
  const guidedRecent = demo ? demoTrainingSessions.filter(item => item.clientId === user.id && item.status === 'COMPLETED').sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || '')).slice(0, 5) : await prisma.trainingSession.findMany({ where: { clientId: user.id, status: 'COMPLETED' }, orderBy: { completedAt: 'desc' }, take: 5 });
  const legacyDays = demo ? demoLogs.filter(l => l.clientId === user.id).map(l => (l.performedOn || l.performedAt).slice(0, 10)) : (await prisma.performance.groupBy({ by: ['performedOn'], where: { clientId: user.id } })).map(day => day.performedOn.toISOString().slice(0, 10));
  const sessions = new Set([...legacyDays, ...guided.filter(item => item.completedAt).map(item => new Date(item.completedAt!).toISOString().slice(0, 10))]).size;
  const recent = demo ? demoLogs.filter(l => l.clientId === user.id).sort((a, b) => b.performedAt.localeCompare(a.performedAt)).slice(0, 5) : await prisma.performance.findMany({ where: { clientId: user.id }, orderBy: { performedAt: 'desc' }, take: 5 });
  const sessionsThisWeek = new Set([...legacyDays, ...guided.filter(item => item.completedAt).map(item => new Date(item.completedAt!).toISOString().slice(0, 10))].filter(day => day >= weekStart.toISOString().slice(0, 10) && day <= today.toISOString().slice(0, 10))).size;
  res.json({ programs, sessions, sessionsThisWeek, unreadMessages, currentProgram: currentProgram ? { id: currentProgram.id, name: currentProgram.name } : null, recent, recentGuided: guidedRecent.map(item => ({ id: item.id, dayLabel: (item.content as { dayLabel?: string }).dayLabel || '', dayIndex: (item.content as { dayIndex?: number }).dayIndex || 0, performedOn: item.completedAt ? new Date(item.completedAt).toISOString().slice(0, 10) : '', exerciseCount: (item.content as { exercises?: { sets?: unknown[] }[] }).exercises?.filter(exercise => exercise.sets?.length).length || 0 })) });
}));

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => { if (error instanceof z.ZodError) { res.status(400).json({ error: 'Check the highlighted input and try again.', details: error.issues }); return; } if (error instanceof workout.WorkoutApiError) { res.status(error.status).json({ error: error.message }); return; } if (error?.code === 'P2002') { res.status(409).json({ error: 'That email is already in use.' }); return; } console.error('Request failed', error instanceof Error ? error.name : 'Unknown'); res.status(500).json({ error: 'An unexpected server error occurred.' }); };
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(process.cwd(), 'dist')));
  app.use((req, res, next) => { if (req.method === 'GET' && !req.path.startsWith('/api')) res.sendFile(join(process.cwd(), 'dist', 'index.html')); else next(); });
}
app.use(errorHandler);
const port = Number(process.env.NODE_ENV === 'production' ? process.env.PORT || 3000 : process.env.API_PORT || 3001);
if (process.env.NODE_ENV !== 'test') { app.listen(port, () => console.log(`Coach server listening on ${port} (${demo ? 'demo' : 'live'} mode)`)); if (!demo) startEmailWorker(prisma); }
export { app };
