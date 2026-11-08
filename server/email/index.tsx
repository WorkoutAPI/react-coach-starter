import type { ReactNode } from 'react';
import { render } from 'react-email';
import { EmailLayout } from './layout/index.js';
import { emailTranslator } from './i18n/index.js';

export async function renderEmail({ locale: requestedLocale, subject, preview, content }: { locale?: string; subject: string; preview: string; content: ReactNode }) {
  const { locale } = emailTranslator(requestedLocale);
  const message = <EmailLayout locale={locale} preview={preview}>{content}</EmailLayout>;
  return { subject, html: await render(message), text: await render(message, { plainText: true }) };
}
