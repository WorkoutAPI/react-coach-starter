import { Button, Heading, Link, Section, Text } from 'react-email';
import { brand } from '../../../src/config/brand.js';
import { EmailLayout, emailColors } from '../layout/index.js';
import { emailTranslator, type EmailLocale } from '../i18n/index.js';
import { renderEmail } from '../index.js';

export function PasswordResetContent({ resetUrl, locale }: { resetUrl: string; locale: EmailLocale }) {
  const c = emailColors;
  const { t } = emailTranslator(locale);
  return <>
      <Text style={{ margin: '0 0 12px', color: c.primary, fontSize: 12, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase' }}>{t('passwordReset.eyebrow')}</Text>
      <Heading as="h1" style={{ margin: '0 0 16px', color: c.foreground, fontSize: 28, fontWeight: 700, lineHeight: '34px', letterSpacing: '-0.6px' }}>{t('passwordReset.title')}</Heading>
      <Text style={{ margin: '0 0 24px', color: c.foreground, fontSize: 15, lineHeight: '24px' }}>{t('passwordReset.intro')}</Text>
      <Button href={resetUrl} style={{ display: 'inline-block', backgroundColor: c.primary, borderRadius: 10, color: c.primaryForeground, fontSize: 15, fontWeight: 700, lineHeight: '20px', padding: '14px 22px', textDecoration: 'none' }}>{t('passwordReset.button')}</Button>
      <Section style={{ marginTop: 28, padding: '12px 16px', backgroundColor: c.muted, borderLeft: `3px solid ${c.primary}`, borderRadius: '0 8px 8px 0' }}>
        <Text style={{ margin: 0, color: c.foreground, fontSize: 13, lineHeight: '21px' }}>{t('passwordReset.expiry')}</Text>
      </Section>
      <Text style={{ margin: '24px 0 6px', color: '#687076', fontSize: 12, lineHeight: '18px' }}>{t('passwordReset.linkFallback')}</Text>
      <Link href={resetUrl} style={{ color: c.primary, fontSize: 12, lineHeight: '18px', textDecoration: 'underline', wordBreak: 'break-all' }}>{resetUrl}</Link>
    </>;
}

export function passwordResetEmail(resetUrl: string, requestedLocale?: string) {
  const { locale, t } = emailTranslator(requestedLocale);
  return renderEmail({
    locale,
    subject: t('passwordReset.subject', { brandName: brand.name }),
    preview: t('passwordReset.preview', { brandName: brand.name }),
    content: <PasswordResetContent resetUrl={resetUrl} locale={locale} />,
  });
}

function PasswordResetPreview({ locale: requestedLocale = 'en' }: { locale?: string }) {
  const { locale, t } = emailTranslator(requestedLocale);
  return <EmailLayout locale={locale} preview={t('passwordReset.preview', { brandName: brand.name })} previewLogo>
    <PasswordResetContent locale={locale} resetUrl="https://example.test/?reset=example-preview-token" />
  </EmailLayout>;
}

PasswordResetPreview.PreviewProps = { locale: 'en' };

export default PasswordResetPreview;
