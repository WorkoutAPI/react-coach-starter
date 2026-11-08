import type { PrismaClient } from '@prisma/client';
import { newMessageEmail } from '../templates/new-message.js';
import { programAssignedEmail } from '../templates/program-assigned.js';
import { sendEmail, smtpConfigured, type RenderedEmail } from '../send.js';
import { outgoingEmailLocale } from '../i18n/index.js';

type Delivery = (to: string, email: RenderedEmail) => Promise<void>;
const origin = () => process.env.WEB_ORIGIN || 'http://localhost:3000';

export async function processEmailJobs(db: PrismaClient, deliver: Delivery = sendEmail, now = new Date()) {
  const due = await db.emailJob.findMany({ where: { status: 'PENDING', sendAfter: { lte: now } }, orderBy: { sendAfter: 'asc' }, take: 100 });
  const seen = new Set<string>();
  for (const job of due) {
    const groupKey = job.kind === 'MESSAGE' ? `${job.recipientId}:${job.senderId}` : job.id;
    if (seen.has(groupKey)) continue;
    seen.add(groupKey);
    const jobs = job.kind === 'MESSAGE'
      ? await db.emailJob.findMany({ where: { kind: 'MESSAGE', status: 'PENDING', recipientId: job.recipientId, senderId: job.senderId, sendAfter: { lte: now } } })
      : [job];
    const ids = jobs.map(item => item.id);
    if (!ids.length) continue;
    let deliveryIds = ids;
    try {
      const recipient = await db.user.findUnique({ where: { id: job.recipientId } });
      let email: RenderedEmail | null = null;
      if (job.kind === 'MESSAGE') {
        const sender = job.senderId ? await db.user.findUnique({ where: { id: job.senderId } }) : null;
        const messageIds = jobs.map(item => item.messageId).filter((id): id is string => !!id);
        const unreadMessages = messageIds.length ? await db.message.findMany({ where: { id: { in: messageIds }, recipientId: job.recipientId, senderId: job.senderId || '', readAt: null }, select: { id: true } }) : [];
        const unreadIds = new Set(unreadMessages.map(message => message.id));
        deliveryIds = jobs.filter(item => item.messageId && unreadIds.has(item.messageId)).map(item => item.id);
        const skippedIds = ids.filter(id => !deliveryIds.includes(id));
        if (skippedIds.length) await db.emailJob.updateMany({ where: { id: { in: skippedIds }, status: 'PENDING' }, data: { status: 'SKIPPED' } });
        if (recipient?.notifyMessages && sender && deliveryIds.length) email = await newMessageEmail(sender.name, deliveryIds.length, `${origin()}/messages`, outgoingEmailLocale(recipient.emailLocale));
      } else {
        const program = job.programId ? await db.program.findUnique({ where: { id: job.programId }, include: { coach: true } }) : null;
        if (recipient?.notifyPrograms && program?.clientId === recipient.id && program.status === 'ASSIGNED') email = await programAssignedEmail(program.coach.name, program.name, `${origin()}/programs`, outgoingEmailLocale(recipient.emailLocale));
      }
      if (!email || !recipient) {
        await db.emailJob.updateMany({ where: { id: { in: ids }, status: 'PENDING' }, data: { status: 'SKIPPED' } });
        continue;
      }
      await deliver(recipient.email, email);
      await db.emailJob.updateMany({ where: { id: { in: deliveryIds }, status: 'PENDING' }, data: { status: 'SENT', lastAttemptAt: now } });
    } catch (error) {
      const attempts = Math.max(...jobs.map(item => item.attempts)) + 1;
      await db.emailJob.updateMany({ where: { id: { in: deliveryIds }, status: 'PENDING' }, data: { status: attempts >= 5 ? 'FAILED' : 'PENDING', attempts: { increment: 1 }, lastAttemptAt: now, sendAfter: new Date(now.getTime() + Math.min(2 ** attempts, 30) * 60000) } });
      const failure = error as { name?: string; code?: string; responseCode?: number };
      console.error('Notification email delivery failed', { kind: job.kind, name: failure.name || typeof error, code: failure.code, responseCode: failure.responseCode });
    }
  }
}

export function startEmailWorker(db: PrismaClient) {
  if (!smtpConfigured()) { console.error('Email notifications are pending: SMTP_HOST or SMTP_FROM is missing.'); return; }
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await processEmailJobs(db); }
    catch (error) { console.error('Email notification worker failed', error instanceof Error ? error.name : typeof error); }
    finally { running = false; }
  };
  void tick();
  const timer = setInterval(() => void tick(), 60000);
  timer.unref();
}
