import { createInstance } from 'i18next';
import { brand } from '../../../src/config/brand.js';
import { en } from './en.js';
import { fr } from './fr.js';

const resources = { en: { translation: en }, fr: { translation: fr } };
export type EmailLocale = keyof typeof resources;

const emailI18n = createInstance();
void emailI18n.init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: Object.keys(resources),
  keySeparator: false,
  interpolation: { escapeValue: false },
  initAsync: false,
});

export function emailTranslator(requestedLocale?: string) {
  const code = (requestedLocale || brand.languages[0] || 'en').split(/[-_]/)[0].toLowerCase();
  const locale: EmailLocale = code in resources ? code as EmailLocale : 'en';
  return { locale, t: emailI18n.getFixedT(locale) };
}

export function outgoingEmailLocale(savedLocale?: string) {
  const locale = emailTranslator(savedLocale).locale;
  return new Set<string>(brand.languages).has(locale) ? locale : 'en';
}
