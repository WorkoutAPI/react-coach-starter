import { describe, expect, it } from 'vitest';
import i18n from '../src/i18n';

describe('English UI catalog', () => {
  it('resolves labels, interpolation, and plurals', () => {
    expect(i18n.t('app.overview')).toBe('Overview');
    expect(i18n.t('dashboard.greeting', { name: 'Sam' })).toBe('Good to see you, Sam.');
    expect(i18n.t('exercises.results', { count: 1 })).toBe('1 exercise found');
    expect(i18n.t('exercises.results', { count: 2 })).toBe('2 exercises found');
    expect(i18n.t('programs.training.day.count', { count: 1 })).toBe('1 training day');
  });
});
