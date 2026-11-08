import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emailLogoCid } from '../server/email/logo';
import { sendEmail } from '../server/email/send';

const sendMail = vi.hoisted(() => vi.fn().mockResolvedValue({}));
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail }) } }));

afterEach(() => { vi.unstubAllEnvs(); sendMail.mockClear(); });

describe('email delivery', () => {
  it('attaches the logo inline with the same CID used in the HTML', async () => {
    vi.stubEnv('SMTP_HOST', 'smtp.example.test');
    vi.stubEnv('SMTP_FROM', 'React Coach Starter <no-reply@example.test>');
    vi.stubEnv('NODE_ENV', 'development');
    const logoPath = join(process.cwd(), 'public', 'email-logo.png');
    expect(existsSync(logoPath)).toBe(true);

    await sendEmail('recipient@example.test', { subject: 'Example', html: `<img src="cid:${emailLogoCid}" alt=""/>`, text: 'Example' });

    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      attachments: [expect.objectContaining({ path: logoPath, cid: emailLogoCid, contentType: 'image/png', contentDisposition: 'inline' })],
    }));
  });
});
