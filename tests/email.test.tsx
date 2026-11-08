import { describe, expect, it } from 'vitest';
import { brand } from '../src/config/brand';
import { emailColors } from '../server/email/layout';
import InvitationPreview, { invitationEmail } from '../server/email/templates/invitation';
import NewMessagePreview, { newMessageEmail } from '../server/email/templates/new-message';
import ProgramAssignedPreview, { programAssignedEmail } from '../server/email/templates/program-assigned';
import PasswordResetPreview, { passwordResetEmail } from '../server/email/templates/password-reset';
import { emailTranslator, outgoingEmailLocale } from '../server/email/i18n';
import { render } from 'react-email';
import { emailLogoCid } from '../server/email/logo';

describe('password recovery email', () => {
  it('renders the shared branded layout, action link, and plain-text alternative', async () => {
    const url = 'https://coach.example.test/?reset=sample-token';
    const message = await passwordResetEmail(url);

    expect(message.subject).toContain(brand.name);
    expect(message.html).toContain(brand.name);
    expect(message.html).toContain(`cid:${emailLogoCid}`);
    const logoTag = message.html.match(/<img\b[^>]*cid:[^>]*>/)?.[0];
    expect(logoTag).toContain('width="48"');
    expect(logoTag).toContain('height="48"');
    expect(message.html).not.toContain(`>${brand.shortName}</span>`);
    expect(message.html).toContain(brand.organization);
    expect(message.html).toContain(brand.supportEmail);
    expect(emailColors.primary).toMatch(/^#[0-9a-f]{6}$/);
    expect(emailColors.foreground).toMatch(/^#[0-9a-f]{6}$/);
    expect(message.html).toContain(emailColors.primary);
    expect(message.html).toContain(`background-color:${emailColors.primary}`);
    expect(message.html).toContain(`border-left:3px solid ${emailColors.primary}`);
    expect(message.html).not.toContain('#NaN');
    expect(message.html).toContain(`href="${url}"`);
    expect(message.html).toContain('Reset password');
    expect(message.text).toContain(url);
    expect(message.text).toContain('one hour');
    expect(message.text).toContain(brand.supportEmail);
  });

  it('renders French in the subject, HTML, text, and shared footer', async () => {
    const message = await passwordResetEmail('https://coach.example.test/?reset=sample-token', 'fr-FR');

    expect(message.subject).toContain('Réinitialisez votre mot de passe');
    expect(message.html).toContain('lang="fr"');
    expect(message.html).toContain('Sécurité du compte');
    expect(message.html).toContain('Besoin d’aide');
    expect(message.text).toContain('Ce lien expire dans une heure');
    expect(message.text).toContain('Cet email a été envoyé par');
  });

  it('falls back to English for an unsupported email language', async () => {
    expect(emailTranslator('de-DE').locale).toBe('en');
    expect(outgoingEmailLocale('fr')).toBe('en');
    expect((await passwordResetEmail('https://coach.example.test/?reset=sample-token', 'de-DE')).subject).toContain('Reset your');
  });

  it('previews the real template in another language', async () => {
    const html = await render(<PasswordResetPreview locale="fr" />);
    expect(html).toContain('lang="fr"');
    expect(html).toContain('Réinitialisez votre mot de passe');
    expect(html).toContain('example-preview-token');
    expect(html).toContain('src="/static/email-logo.png"');
  });
});


describe('notification email templates', () => {
  it('uses the locally served logo in every preview', async () => {
    for (const preview of [<InvitationPreview />, <NewMessagePreview />, <ProgramAssignedPreview />]) {
      expect(await render(preview)).toContain('src="/static/email-logo.png"');
    }
  });
  it('renders invitation, message and program emails in English and French using the shared layout', async () => {
    for (const locale of ['en', 'fr']) {
      const invite = await invitationEmail('Alex Morgan', 'Sam Rivera', 'https://example.test/?invite=token', locale);
      const message = await newMessageEmail('Alex Morgan', 2, 'https://example.test/messages', locale);
      const program = await programAssignedEmail('Alex Morgan', 'Strength plan', 'https://example.test/programs', locale);
      for (const email of [invite, message, program]) {
        expect(email.html).toContain(`lang="${locale}"`);
        expect(email.html).toContain(brand.name);
        expect(email.html).toContain(`cid:${emailLogoCid}`);
        expect(email.html).toContain(emailColors.primary);
        expect(email.text).toContain('https://example.test/');
      }
      expect(invite.text).toContain('Sam Rivera');
      expect(message.text).toContain(locale === 'fr' ? '2 messages' : '2 messages');
      expect(program.text).toContain('Strength plan');
    }
  });
  it('keeps message content out of email', async () => {
    const email = await newMessageEmail('Alex Morgan', 1, 'https://example.test/messages', 'fr');
    expect(email.text).toContain('un message');
    expect(email.html).not.toContain('Well done');
  });
});
