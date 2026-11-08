import { ActionEmail } from '../layout/action.js';
import { EmailLayout } from '../layout/index.js';
import { emailTranslator, type EmailLocale } from '../i18n/index.js';
import { renderEmail } from '../index.js';

function NewMessageContent({ locale, senderName, count, url }: { locale: EmailLocale; senderName: string; count: number; url: string }) {
  const { t } = emailTranslator(locale);
  return <ActionEmail locale={locale} eyebrow={t('message.eyebrow')} title={t('message.title')} body={t('message.body', { count, senderName })} action={t('message.button')} url={url} note={t('message.note')} />;
}

export function newMessageEmail(senderName: string, count: number, url: string, requestedLocale?: string) {
  const { locale, t } = emailTranslator(requestedLocale);
  return renderEmail({ locale, subject: t('message.subject', { senderName }), preview: t('message.preview', { count, senderName }), content: <NewMessageContent locale={locale} senderName={senderName} count={count} url={url} /> });
}

function NewMessagePreview({ locale: requestedLocale = 'en' }: { locale?: string }) {
  const { locale, t } = emailTranslator(requestedLocale);
  return <EmailLayout locale={locale} preview={t('message.preview', { count: 2, senderName: 'Sam Rivera' })} previewLogo><NewMessageContent locale={locale} senderName="Sam Rivera" count={2} url="https://example.test/messages" /></EmailLayout>;
}
NewMessagePreview.PreviewProps = { locale: 'en' };
export default NewMessagePreview;
