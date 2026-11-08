import { dateLocale } from '../i18n';
import type { Log } from './types';

export const dayKey = (value: string) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
export const logDay = (log: Pick<Log, 'performedAt' | 'performedOn'>) => log.performedOn?.slice(0, 10) || dayKey(log.performedAt);
export const todayKey = () => dayKey(new Date().toISOString());
export const formatDay = (key: string) => new Intl.DateTimeFormat(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${key}T12:00:00`));
export const formatShortDay = (key: string) => new Intl.DateTimeFormat(dateLocale(), { day: 'numeric', month: 'numeric', year: 'numeric' }).format(new Date(`${key}T12:00:00`));
export const number = (value: number) => new Intl.NumberFormat(dateLocale(), { maximumFractionDigits: 1 }).format(value);
