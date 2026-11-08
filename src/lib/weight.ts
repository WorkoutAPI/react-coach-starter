import { dateLocale } from '../i18n';
import type { User } from './types';

export type WeightUnit = User['weightUnit'];
export const KG_PER_LB = 0.45359237;
export const fromKg = (kg: number, unit: WeightUnit) => unit === 'LB' ? kg / KG_PER_LB : kg;
export const toKg = (weight: number, unit: WeightUnit) => Math.round((unit === 'LB' ? weight * KG_PER_LB : weight) * 10000) / 10000;
export const formatWeightValue = (kg: number, unit: WeightUnit) => new Intl.NumberFormat(dateLocale(), { maximumFractionDigits: 1 }).format(fromKg(kg, unit));
export const formatWeight = (kg: number, unit: WeightUnit) => `${formatWeightValue(kg, unit)} ${unit === 'LB' ? 'lb' : 'kg'}`;
