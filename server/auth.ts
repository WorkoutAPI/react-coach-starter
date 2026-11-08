import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { demoUsers, type DemoUser } from './demo.js';

export const prisma = new PrismaClient();
const mode = process.env.APP_MODE || 'demo';
if (mode !== 'demo' && mode !== 'live') throw new Error('APP_MODE must be demo or live.');
export const demo = mode === 'demo';
if (!demo && !process.env.DATABASE_URL) throw new Error('DATABASE_URL is required in live mode.');
const secret = process.env.SESSION_SECRET || (demo ? 'demo-session-secret-unsafe-for-production' : '');
if (!demo && (secret.length < 32 || secret.startsWith('replace-'))) throw new Error('Set a unique SESSION_SECRET of at least 32 characters in live mode.');
export type AppUser = DemoUser;
export type AuthedRequest = Request & { user?: AppUser };

export function hash(value: string) { return createHmac('sha256', secret).update(value).digest('hex'); }
export function passwordHash(password: string) { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`; }
export function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  const target = Buffer.from(expected, 'hex');
  return actual.length === target.length && timingSafeEqual(actual, target);
}
export function publicUser(user: AppUser, includeCoachingNotes = false) { return { id: user.id, email: user.email, name: user.name, role: user.role, coachId: user.coachId, goal: user.goal, notes: includeCoachingNotes ? user.notes : null, weightUnit: user.weightUnit, emailLocale: user.emailLocale, notifyMessages: user.notifyMessages, notifyPrograms: user.notifyPrograms }; }
export async function createSession(res: Response, userId: string) {
  let token: string;
  if (demo) token = `demo:${userId}:${hash(userId)}`;
  else {
    token = randomBytes(32).toString('base64url');
    await prisma.session.create({ data: { tokenHash: hash(token), userId, expiresAt: new Date(Date.now() + 7 * 86400000) } });
  }
  res.cookie('coach_session', token, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 7 * 86400000 });
}
export async function session(req: AuthedRequest, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.coach_session;
    if (typeof token === 'string') {
      if (demo) {
        const [, id, sig] = token.split(':');
        if (sig && sig === hash(id)) { const found = demoUsers.find(user => user.id === id); if (found) req.user = publicUser(found); }
      } else {
        const found = await prisma.session.findUnique({ where: { tokenHash: hash(token) }, include: { user: true } });
        if (found && found.expiresAt > new Date()) req.user = publicUser(found.user);
      }
    }
    next();
  } catch (error) { next(error); }
}
export function requireUser(req: AuthedRequest, res: Response, next: NextFunction) { if (!req.user) { res.status(401).json({ error: 'Sign in to continue.' }); return; } next(); }
export function requireCoach(req: AuthedRequest, res: Response, next: NextFunction) { if (req.user?.role !== 'COACH') { res.status(403).json({ error: 'Coach access required.' }); return; } next(); }
