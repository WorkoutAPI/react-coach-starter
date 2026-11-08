import { brand } from '../../../src/config/brand.js';
import { ActionEmail } from '../layout/action.js';
import { EmailLayout } from '../layout/index.js';
import { emailTranslator, type EmailLocale } from '../i18n/index.js';
import { renderEmail } from '../index.js';

function ProgramAssignedContent({ locale, coachName, programName, url }: { locale: EmailLocale; coachName: string; programName: string; url: string }) {
  const { t } = emailTranslator(locale);
  return <ActionEmail locale={locale} eyebrow={t('program.eyebrow')} title={t('program.title')} body={t('program.body', { coachName, programName })} action={t('program.button')} url={url} />;
}

export function programAssignedEmail(coachName: string, programName: string, url: string, requestedLocale?: string) {
  const { locale, t } = emailTranslator(requestedLocale);
  return renderEmail({ locale, subject: t('program.subject', { brandName: brand.name }), preview: t('program.preview', { programName }), content: <ProgramAssignedContent locale={locale} coachName={coachName} programName={programName} url={url} /> });
}

function ProgramAssignedPreview({ locale: requestedLocale = 'en' }: { locale?: string }) {
  const { locale, t } = emailTranslator(requestedLocale);
  return <EmailLayout locale={locale} preview={t('program.preview', { programName: 'Three-day strength plan' })} previewLogo><ProgramAssignedContent locale={locale} coachName="Alex Morgan" programName="Three-day strength plan" url="https://example.test/programs" /></EmailLayout>;
}
ProgramAssignedPreview.PreviewProps = { locale: 'en' };
export default ProgramAssignedPreview;
