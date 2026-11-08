import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { demoTrainingSessions } from '../server/demo';

let app: Express;
beforeAll(async () => { process.env.APP_MODE = 'demo'; process.env.NODE_ENV = 'test'; ({ app } = await import('../server/index.js')); });

describe('guided training sessions', () => {
  it('rejects new demo sessions when the in-memory limit is reached', async () => {
    const client = request.agent(app);
    expect((await client.post('/api/auth/demo-login').send({ role: 'CLIENT' })).status).toBe(200);
    const originalLength = demoTrainingSessions.length;
    try {
      const sample = demoTrainingSessions[0];
      demoTrainingSessions.push(...Array.from({ length: 500 - originalLength }, (_, index) => ({ ...sample, id: `limit-test-${index}` })));
      const response = await client.post('/api/training-sessions').send({ programId: 'demo-program', dayIndex: 0 });
      expect(response.status).toBe(429);
      expect(response.body.error).toMatch(/Demo training limit reached/);
    } finally {
      demoTrainingSessions.splice(originalLength);
    }
  });

  it('supports the full demo flow without retaining the finished session', async () => {
    expect((await request(app).get('/api/training-sessions')).status).toBe(401);
    const coach = request.agent(app);
    const client = request.agent(app);
    expect((await coach.post('/api/auth/demo-login').send({ role: 'COACH' })).status).toBe(200);
    expect((await client.post('/api/auth/demo-login').send({ role: 'CLIENT' })).status).toBe(200);
    const seededGuided = await coach.get('/api/training-sessions?clientId=demo-client');
    expect(seededGuided.status).toBe(200);
    expect(seededGuided.body[0]).toMatchObject({ status: 'COMPLETED', content: { programName: 'Strength foundations' } });
    expect(seededGuided.body).toHaveLength(58);
    expect(seededGuided.body[0].content.exercises.every((exercise: { extra: boolean; sets: unknown[] }) => !exercise.extra && exercise.sets.length > 0)).toBe(true);
    expect((await coach.get('/api/dashboard')).body.recentGuided[0]).toMatchObject({ clientName: 'Sam Rivera' });
    const seededProgramLog = await client.get('/api/logs?exerciseCode=BARBELL_BENCH_PRESS');
    expect(seededProgramLog.body[0]).toMatchObject({ programId: 'demo-program', exerciseCode: 'BARBELL_BENCH_PRESS' });
    expect((await coach.post('/api/training-sessions').send({ programId: 'demo-program', dayIndex: 0 })).status).toBe(403);
    expect((await client.post('/api/training-sessions').send({ programId: 'demo-program-jordan', dayIndex: 0 })).status).toBe(404);
    expect((await client.post('/api/training-sessions').send({ programId: 'demo-program', dayIndex: 6 })).status).toBe(400);
    const started = await client.post('/api/training-sessions').send({ programId: 'demo-program', dayIndex: 0 });
    expect(started.status).toBe(201);
    expect(started.body.content.exercises[0]).toMatchObject({ code: 'BARBELL_BENCH_PRESS', sets: [], extra: false });
    const sessionId = started.body.id as string;
    expect((await client.get(`/api/training-sessions/${sessionId}/exercises/0/embed`)).status).toBe(404);
    expect((await client.get(`/api/training-sessions/${sessionId}/exercises/0/embed`)).body.error).toContain('demo mode');
    expect((await client.get(`/api/training-sessions/${sessionId}/exercises/49/embed`)).status).toBe(404);
    expect((await coach.get(`/api/training-sessions/${sessionId}/exercises/0/embed`)).status).toBe(403);
    expect((await request(app).get(`/api/training-sessions/${sessionId}/exercises/0/embed`)).status).toBe(401);
    expect((await client.post('/api/training-sessions').send({ programId: 'demo-program', dayIndex: 1 })).status).toBe(409);
    expect((await client.get('/api/training-sessions?clientId=demo-client-2')).status).toBe(403);
    expect((await client.post(`/api/training-sessions/${sessionId}/finish`).send({})).status).toBe(400);
    expect((await coach.put(`/api/training-sessions/${sessionId}/exercise`).send({ exerciseIndex: 0, sets: [{ reps: 8, weightKg: 40 }], skipped: false })).status).toBe(403);
    expect((await client.put(`/api/training-sessions/${sessionId}/exercise`).send({ exerciseIndex: 0, sets: [{ reps: 8, weightKg: 40 }], skipped: true })).status).toBe(400);
    const saved = await client.put(`/api/training-sessions/${sessionId}/exercise`).send({ exerciseIndex: 0, sets: [{ reps: 8, weightKg: 40 }, { reps: 7, weightKg: 42.5 }], skipped: false });
    expect(saved.status).toBe(200);
    expect(saved.body.content.exercises[0].sets).toEqual([{ reps: 8, weightKg: 40 }, { reps: 7, weightKg: 42.5 }]);
    expect((await client.get(`/api/training-sessions/${sessionId}`)).body.content.exercises[0].sets).toHaveLength(2);
    expect((await client.get('/api/logs?exerciseCode=BARBELL_BENCH_PRESS&includeGuided=true')).body.some((entry: { id: string }) => entry.id.startsWith(sessionId))).toBe(false);
    expect((await client.post(`/api/training-sessions/${sessionId}/exercises`).send({ code: 'FAKE_LIFT', name: 'Fake Lift' })).status).toBe(400);
    const added = await client.post(`/api/training-sessions/${sessionId}/exercises`).send({ code: 'BARBELL_CURL', name: 'Barbell Curl' });
    expect(added.status).toBe(201);
    expect(added.body.content.exercises.at(-1)).toMatchObject({ code: 'BARBELL_CURL', extra: true });
    const extraIndex = added.body.content.exercises.length - 1;
    expect((await client.delete(`/api/training-sessions/${sessionId}/exercises/0`)).status).toBe(400);
    expect((await client.put(`/api/training-sessions/${sessionId}/exercise`).send({ exerciseIndex: extraIndex, sets: [{ reps: 10, weightKg: 15 }], skipped: false })).status).toBe(200);
    expect((await coach.get('/api/training-sessions?clientId=demo-client')).body[0].id).toBe(sessionId);
    expect((await coach.get(`/api/training-sessions/${sessionId}`)).status).toBe(200);
    const finished = await client.post(`/api/training-sessions/${sessionId}/finish`).send({});
    expect(finished.status).toBe(200);
    expect(finished.body.status).toBe('COMPLETED');
    const combined = await client.get('/api/logs?exerciseCode=BARBELL_BENCH_PRESS&includeGuided=true');
    expect(combined.status).toBe(200);
    expect(combined.body.filter((entry: { id: string }) => entry.id.startsWith(sessionId))).toHaveLength(0);
    expect((await coach.get('/api/logs?clientId=demo-client&exerciseCode=BARBELL_BENCH_PRESS&includeGuided=true')).body.filter((entry: { id: string }) => entry.id.startsWith(sessionId))).toHaveLength(0);
    expect((await client.get('/api/logs?clientId=demo-client-2&exerciseCode=BARBELL_BENCH_PRESS&includeGuided=true')).status).toBe(403);
    expect((await client.get(`/api/training-sessions/${sessionId}`)).status).toBe(404);
    expect((await client.put(`/api/training-sessions/${sessionId}/exercise`).send({ exerciseIndex: 0, sets: [], skipped: false })).status).toBe(404);
    expect((await client.delete(`/api/training-sessions/${sessionId}`)).status).toBe(404);
    expect((await coach.get('/api/dashboard')).body.recentGuided.some((item: { id: string }) => item.id === sessionId)).toBe(false);
    expect((await coach.get('/api/progress-history?clientId=demo-client')).body.totalEntries).toBe(78);
    const next = await client.post('/api/training-sessions').send({ programId: 'demo-program', dayIndex: 1 });
    expect(next.status).toBe(201);
    expect((await client.delete(`/api/training-sessions/${next.body.id}`)).status).toBe(200);
    const plannedOnly = await client.post('/api/training-sessions').send({ programId: 'demo-program', dayIndex: 0 });
    expect(plannedOnly.status).toBe(201);
    expect((await client.put(`/api/training-sessions/${plannedOnly.body.id}/exercise`).send({ exerciseIndex: 0, sets: [{ reps: 6, weightKg: 50 }], skipped: false })).status).toBe(200);
    expect((await client.post(`/api/training-sessions/${plannedOnly.body.id}/finish`).send({})).status).toBe(200);
    const clientDashboard = await client.get('/api/dashboard');
    expect(clientDashboard.body.recentGuided.some((item: { id: string }) => item.id === plannedOnly.body.id)).toBe(false);
    const progressSessions = await client.get('/api/training-sessions');
    expect(progressSessions.body.some((item: { id: string }) => item.id === plannedOnly.body.id)).toBe(false);
    expect((await client.get('/api/logs?exerciseCode=BARBELL_BENCH_PRESS&includeGuided=true')).body.some((entry: { id: string }) => entry.id.startsWith(plannedOnly.body.id))).toBe(false);
  });
});
