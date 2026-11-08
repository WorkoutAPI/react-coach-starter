import { brand } from '../../../src/config/brand.js';
import { ActionEmail } from '../layout/action.js';
import { EmailLayout } from '../layout/index.js';
import { emailTranslator, type EmailLocale } from '../i18n/index.js';
import { renderEmail } from '../index.js';

function InvitationContent({ locale, coachName, name, url }: { locale: EmailLocale; coachName: string; name: string; url: string }) {
  const { t } = emailTranslator(locale);
  return <ActionEmail locale={locale} eyebrow={t('invitation.eyebrow')} title={t('invitation.title')} body={t('invitation.body', { name, coachName })} action={t('invitation.button')} url={url} note={t('invitation.note')} />;
}

export function invitationEmail(coachName: string, name: string, url: string, requestedLocale?: string) {
  const { locale, t } = emailTranslator(requestedLocale);
  return renderEmail({ locale, subject: t('invitation.subject', { brandName: brand.name }), preview: t('invitation.preview', { coachName }), content: <InvitationContent locale={locale} coachName={coachName} name={name} url={url} /> });
}

function InvitationPreview({ locale: requestedLocale = 'en' }: { locale?: string }) {
  const { locale, t } = emailTranslator(requestedLocale);
  return <EmailLayout locale={locale} preview={t('invitation.preview', { coachName: 'Alex Morgan' })} previewLogo><InvitationContent locale={locale} coachName="Alex Morgan" name="Sam Rivera" url="https://example.test/?invite=fictional-token" /></EmailLayout>;
}
InvitationPreview.PreviewProps = { locale: 'en' };
export default InvitationPreview;
