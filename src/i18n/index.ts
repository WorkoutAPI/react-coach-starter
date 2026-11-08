import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './en';
import { brand } from '../config/brand';

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: brand.languages[0],
  fallbackLng: 'en',
  supportedLngs: [...brand.languages],
  keySeparator: false,
  interpolation: { escapeValue: false },
  initAsync: false
});

export default i18n;

export function dateLocale() {
  return i18n.resolvedLanguage === 'en' ? brand.locale : i18n.resolvedLanguage || brand.locale;
}
