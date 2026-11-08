import nodemailer from 'nodemailer';
import { join } from 'node:path';
import { emailLogoCid } from './logo.js';

export type RenderedEmail = { subject: string; html: string; text: string };
export function smtpConfigured() { return !!process.env.SMTP_HOST && !!process.env.SMTP_FROM; }

export async function sendEmail(to: string, message: RenderedEmail) {
  if (!smtpConfigured()) throw new Error('SMTP is not configured.');
  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port, secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  });
  const logoPath = join(process.cwd(), process.env.NODE_ENV === 'production' ? 'dist' : 'public', 'email-logo.png');
  await transporter.sendMail({ from: process.env.SMTP_FROM, to, ...message, attachments: [{ filename: 'email-logo.png', path: logoPath, cid: emailLogoCid, contentType: 'image/png', contentDisposition: 'inline' }] });
}
