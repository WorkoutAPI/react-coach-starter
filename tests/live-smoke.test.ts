import 'dotenv/config';
import { expect, it } from 'vitest';
import request from 'supertest';

it('persists coach, client, training, and progress in PostgreSQL', async ({ skip }) => {
  if (process.env.APP_MODE !== 'live' || !process.env.DATABASE_URL || !process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32 || process.env.SESSION_SECRET.startsWith('replace-')) {
    console.info('Live integration test skipped: set APP_MODE=live, DATABASE_URL, and a real SESSION_SECRET in .env.');
    skip();
    return;
  }
  process.env.NODE_ENV = 'test';
  const { prisma } = await import('../server/auth.js');
  try {
    await Promise.all([prisma.user.count(), prisma.invite.count(), prisma.program.count(), prisma.trainingSession.count(), prisma.performance.count(), prisma.message.count(), prisma.emailJob.count()]);
  } catch (error) {
    if (['P1000', 'P1001', 'P1003', 'P1008', 'P1017', 'P2021', 'P2022'].includes((error as { code?: string }).code || '')) {
      console.info('Live integration test skipped: PostgreSQL is unavailable or migrations are missing.');
      skip();
      return;
    }
    throw error;
  }
  const { app } = await import('../server/index.js');
  const password = 'test-only-password-123';
  const email = `coach-${crypto.randomUUID()}@example.test`;
  const clientEmail = `client-${crypto.randomUUID()}@example.test`;
  const coach = request.agent(app);
  const client = request.agent(app);
  let createdCoachId: string | undefined;
  let createdClientId: string | undefined;
  try {
    const registered = await coach.post('/api/auth/register').send({ name: 'Smoke Coach', email, password });
    expect(registered.status).toBe(201);
    createdCoachId = registered.body.user.id as string;
    const invite = await coach.post('/api/clients/invite').send({ name: 'Smoke Client', email: clientEmail, goal: 'Strength' });
    expect(invite.status).toBe(201);
    const token = new URL(invite.body.inviteUrl).searchParams.get('invite');
    expect(token).toBeTruthy();
    const accepted = await client.post('/api/auth/accept-invite').send({ token, password });
    expect(accepted.status).toBe(201);
    createdClientId = accepted.body.user.id as string;
    expect((await coach.get('/api/clients')).body.some((u: { id: string }) => u.id === accepted.body.user.id)).toBe(true);
    expect((await client.get('/api/clients')).status).toBe(403);
    const clientId = accepted.body.user.id as string;
    expect((await client.put('/api/me').send({ name: 'Smoke Client', notifyMessages: true, notifyPrograms: true })).status).toBe(200);
    const sent = await coach.post('/api/messages').send({ recipientId: clientId, body: 'Private smoke message' });
    expect(sent.status).toBe(201);
    const messageJob = await prisma.emailJob.findUnique({ where: { messageId: sent.body.id } });
    expect(messageJob).toMatchObject({ kind: 'MESSAGE', recipientId: clientId, status: 'PENDING' });
    expect(messageJob!.sendAfter.getTime()).toBeGreaterThan(Date.now());
    expect((await client.post('/api/messages/read').send({ peerId: registered.body.user.id })).status).toBe(200);
    expect((await prisma.message.findUnique({ where: { id: sent.body.id } }))!.readAt).toBeTruthy();
    const exerciseCode = 'LIVE_TEST_BENCH_PRESS';
    const program = await prisma.program.create({ data: { coachId: registered.body.user.id, name: 'Smoke plan', content: { days: [{ label: 'Day 1', exercises: [{ code: exerciseCode, name: 'Test Bench Press', nbSets: { value: 2 }, nbReps: { min: 8, max: 10 }, restSeconds: { value: 90 } }] }] } } });
    expect((await coach.post(`/api/programs/${program.id}/assign`).send({ clientId })).status).toBe(200);
    expect(await prisma.emailJob.count({ where: { kind: 'PROGRAM', programId: program.id, recipientId: clientId } })).toBe(1);
    const started = await client.post('/api/training-sessions').send({ programId: program.id, dayIndex: 0 });
    expect(started.status).toBe(201);
    const trainingId = started.body.id as string;
    expect((await client.put(`/api/training-sessions/${trainingId}/exercise`).send({ exerciseIndex: 0, sets: [{ reps: 8, weightKg: 40 }, { reps: 7, weightKg: 42.5 }], skipped: false })).status).toBe(200);
    expect((await client.post(`/api/training-sessions/${trainingId}/finish`).send({})).body.status).toBe('COMPLETED');
    expect(await prisma.trainingSession.findUnique({ where: { id: trainingId } })).toMatchObject({ clientId, programId: program.id, status: 'COMPLETED' });
    const manual = await client.post('/api/logs').send({ programId: program.id, exerciseCode, sets: 3, reps: 10, weightKg: 35 });
    expect(manual.status).toBe(201);
    expect(await prisma.performance.findUnique({ where: { id: manual.body.id } })).toMatchObject({ clientId, programId: program.id, exerciseCode });
    const history = await coach.get(`/api/progress-history?clientId=${clientId}`);
    expect(history.status).toBe(200);
    expect(history.body.totalEntries).toBe(2);
    expect(history.body.items.map((item: { kind: string }) => item.kind).sort()).toEqual(['GUIDED', 'INDIVIDUAL']);
    expect(history.body.items.find((item: { kind: string }) => item.kind === 'GUIDED').session.id).toBe(trainingId);
    expect(history.body.items.find((item: { kind: string }) => item.kind === 'INDIVIDUAL').logs[0].id).toBe(manual.body.id);
    const evolution = await coach.get(`/api/logs?clientId=${clientId}&exerciseCode=${exerciseCode}&includeGuided=true`);
    expect(evolution.status).toBe(200);
    expect(evolution.body.filter((entry: { source?: string }) => entry.source === 'GUIDED')).toMatchObject([{ reps: 8, weightKg: 40 }, { reps: 7, weightKg: 42.5 }]);
    expect(evolution.body.filter((entry: { source?: string }) => !entry.source)).toHaveLength(1);
    expect((await coach.get('/api/dashboard')).body.recentGuided[0].id).toBe(trainingId);
    const unreadA = await coach.post('/api/messages').send({ recipientId: clientId, body: 'First private message' });
    const unreadB = await coach.post('/api/messages').send({ recipientId: clientId, body: 'Second private message' });
    expect(unreadA.status).toBe(201); expect(unreadB.status).toBe(201);
    await prisma.user.update({ where: { id: clientId }, data: { emailLocale: 'fr' } }); // Legacy preference is ignored while the interface supports English only.
    const { processEmailJobs } = await import('../server/email/notifications/worker.js');
    const delivered: { to: string; subject: string; html: string; text: string }[] = [];
    await processEmailJobs(prisma, async (to, email) => { delivered.push({ to, ...email }); }, new Date(Date.now() + 11 * 60000));
    expect(delivered).toHaveLength(2);
    expect(delivered.every(email => email.to === accepted.body.user.email && email.html.includes('lang="en"'))).toBe(true);
    expect(delivered.some(email => email.text.includes('2 messages'))).toBe(true);
    expect(delivered.some(email => email.text.includes('Smoke plan'))).toBe(true);
    expect(delivered.every(email => !email.html.includes('First private message') && !email.text.includes('Second private message'))).toBe(true);
    expect((await prisma.emailJob.findUnique({ where: { messageId: sent.body.id } }))!.status).toBe('SKIPPED');
    expect((await prisma.emailJob.findUnique({ where: { messageId: unreadA.body.id } }))!.status).toBe('SENT');
    expect((await client.put('/api/me').send({ name: 'Smoke Client', notifyMessages: false, notifyPrograms: false })).status).toBe(200);
    const muted = await coach.post('/api/messages').send({ recipientId: clientId, body: 'Muted smoke message' });
    expect(muted.status).toBe(201);
    expect(await prisma.emailJob.findUnique({ where: { messageId: muted.body.id } })).toBeNull();
    expect((await client.delete('/api/me').send({ password })).status).toBe(200);
    expect(await prisma.trainingSession.findUnique({ where: { id: trainingId } })).toBeNull();
    expect(await prisma.performance.findUnique({ where: { id: manual.body.id } })).toBeNull();
    expect(await prisma.program.findUnique({ where: { id: program.id } })).toMatchObject({ clientId: null, status: 'DRAFT' });
    expect((await coach.get('/api/clients')).body.some((person: { id: string }) => person.id === clientId)).toBe(false);
    expect((await coach.get(`/api/messages?peerId=${clientId}`)).status).toBe(403);
    expect(await prisma.message.findUnique({ where: { id: sent.body.id } })).toBeNull();
    expect(await prisma.emailJob.findUnique({ where: { messageId: sent.body.id } })).toBeNull();
    expect((await coach.delete('/api/me').send({ password })).status).toBe(200);
  } finally {
    const testUsers = await prisma.user.findMany({ where: { email: { in: [email, clientEmail] } }, select: { id: true, email: true } });
    const userIds = [...new Set([...testUsers.map(user => user.id), createdCoachId, createdClientId].filter((value): value is string => !!value))];
    const coachId = createdCoachId || testUsers.find(user => user.email === email)?.id;
    await prisma.$transaction(async tx => {
      await tx.invite.deleteMany({ where: { OR: [{ email: clientEmail }, ...(coachId ? [{ coachId }] : [])] } });
      await tx.user.deleteMany({ where: { email: { in: [email, clientEmail] } } });
    });
    expect(await prisma.user.count({ where: { email: { in: [email, clientEmail] } } })).toBe(0);
    expect(await prisma.invite.count({ where: { email: clientEmail } })).toBe(0);
    if (userIds.length) {
      expect(await prisma.program.count({ where: { coachId: { in: userIds } } })).toBe(0);
      expect(await prisma.trainingSession.count({ where: { clientId: { in: userIds } } })).toBe(0);
      expect(await prisma.performance.count({ where: { clientId: { in: userIds } } })).toBe(0);
      expect(await prisma.message.count({ where: { OR: [{ senderId: { in: userIds } }, { recipientId: { in: userIds } }] } })).toBe(0);
      expect(await prisma.emailJob.count({ where: { recipientId: { in: userIds } } })).toBe(0);
    }
  }
});
