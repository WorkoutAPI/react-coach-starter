import { Button, Heading, Link, Section, Text } from 'react-email';
import { emailColors } from './index.js';
import { emailTranslator, type EmailLocale } from '../i18n/index.js';

export function ActionEmail({ locale, eyebrow, title, body, action, url, note }: { locale: EmailLocale; eyebrow: string; title: string; body: string; action: string; url: string; note?: string }) {
  const c = emailColors;
  const { t } = emailTranslator(locale);
  return <>
    <Text style={{ margin: '0 0 12px', color: c.primary, fontSize: 12, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase' }}>{eyebrow}</Text>
    <Heading as="h1" style={{ margin: '0 0 16px', color: c.foreground, fontSize: 28, fontWeight: 700, lineHeight: '34px' }}>{title}</Heading>
    <Text style={{ margin: '0 0 24px', color: c.foreground, fontSize: 15, lineHeight: '24px' }}>{body}</Text>
    <Button href={url} style={{ display: 'inline-block', backgroundColor: c.primary, borderRadius: 10, color: c.primaryForeground, fontSize: 15, fontWeight: 700, lineHeight: '20px', padding: '14px 22px', textDecoration: 'none' }}>{action}</Button>
    {note && <Section style={{ marginTop: 28, padding: '12px 16px', backgroundColor: c.muted, borderLeft: `3px solid ${c.primary}` }}><Text style={{ margin: 0, color: c.foreground, fontSize: 13, lineHeight: '21px' }}>{note}</Text></Section>}
    <Text style={{ margin: '24px 0 6px', color: '#687076', fontSize: 12, lineHeight: '18px' }}>{t('layout.linkFallback')}</Text>
    <Link href={url} style={{ color: c.primary, fontSize: 12, lineHeight: '18px', textDecoration: 'underline', wordBreak: 'break-all' }}>{url}</Link>
  </>;
}
