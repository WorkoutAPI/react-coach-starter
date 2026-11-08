import type { ReactNode } from 'react';
import { Body, Column, Container, Head, Hr, Html, Img, Link, Preview, Row, Section, Text } from 'react-email';
import { brand } from '../../../src/config/brand.js';
import { emailTranslator, type EmailLocale } from '../i18n/index.js';
import { emailLogoCid } from '../logo.js';

function color(hsl: string): string {
  const [h, s, l] = hsl.trim().split(/\s+/).map(parseFloat);
  if (![h, s, l].every(Number.isFinite)) throw new Error('Invalid email brand color.');
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const secondary = chroma * (1 - Math.abs((h / 60) % 2 - 1));
  const offset = lightness - chroma / 2;
  const [r, g, b] = h < 60 ? [chroma, secondary, 0] : h < 120 ? [secondary, chroma, 0] : h < 180 ? [0, chroma, secondary] : h < 240 ? [0, secondary, chroma] : h < 300 ? [secondary, 0, chroma] : [chroma, 0, secondary];
  return `#${[r, g, b].map(channel => Math.round((channel + offset) * 255).toString(16).padStart(2, '0')).join('')}`;
}

export const emailColors = {
  primary: color(brand.theme.primary),
  primaryForeground: color(brand.theme.primaryForeground),
  background: color(brand.theme.background),
  foreground: color(brand.theme.foreground),
  card: color(brand.theme.card),
  muted: color(brand.theme.muted),
  border: color(brand.theme.border),
};

export function EmailLayout({ locale, preview, previewLogo = false, children }: { locale: EmailLocale; preview: string; previewLogo?: boolean; children: ReactNode }) {
  const c = emailColors;
  const { t } = emailTranslator(locale);
  const logoUrl = previewLogo ? '/static/email-logo.png' : `cid:${emailLogoCid}`;
  return <Html lang={locale}>
    <Head />
    <Preview>{preview}</Preview>
    <Body style={{ margin: 0, padding: '32px 12px', backgroundColor: c.background, fontFamily: 'Arial, Helvetica, sans-serif', color: c.foreground }}>
      <Container style={{ width: '100%', maxWidth: 560, margin: '0 auto' }}>
        <Section style={{ backgroundColor: c.foreground, borderRadius: '16px 16px 0 0', padding: '24px 32px', borderTop: `5px solid ${c.primary}` }}>
          <Row>
            <Column style={{ width: 60, verticalAlign: 'middle' }}>
              <Img src={logoUrl} width="48" height="48" alt="" style={{ display: 'block', width: 48, height: 48, borderRadius: 10 }} />
            </Column>
            <Column style={{ verticalAlign: 'middle' }}>
              <Text style={{ margin: 0, color: '#ffffff', fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px', lineHeight: '24px' }}>{brand.name}</Text>
            </Column>
          </Row>
        </Section>
        <Section style={{ backgroundColor: c.card, padding: '36px 32px 32px', borderLeft: `1px solid ${c.border}`, borderRight: `1px solid ${c.border}` }}>
          {children}
        </Section>
        <Section style={{ backgroundColor: c.card, borderRadius: '0 0 16px 16px', padding: '0 32px 28px', border: `1px solid ${c.border}`, borderTop: 0 }}>
          <Hr style={{ borderColor: c.border, margin: '0 0 20px' }} />
          <Text style={{ margin: '0 0 8px', color: c.foreground, fontSize: 13, fontWeight: 700 }}>{brand.organization}</Text>
          <Text style={{ margin: 0, color: '#687076', fontSize: 12, lineHeight: '19px' }}>
            {t('layout.help')} <Link href={`mailto:${brand.supportEmail}`} style={{ color: c.primary, textDecoration: 'underline' }}>{brand.supportEmail}</Link>
          </Text>
        </Section>
        <Text style={{ margin: '18px 8px 0', color: '#687076', fontSize: 11, lineHeight: '18px', textAlign: 'center' }}>
          {t('layout.disclaimer', { brandName: brand.name })}
        </Text>
      </Container>
    </Body>
  </Html>;
}
