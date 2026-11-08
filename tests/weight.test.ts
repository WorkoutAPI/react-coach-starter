import { describe, expect, it } from 'vitest';
import { formatWeight, fromKg, toKg } from '../src/lib/weight';

describe('weight units', () => {
  it('round trips entered pounds through kilogram storage', () => {
    const storedKg = toKg(225, 'LB');
    expect(storedKg).toBeCloseTo(102.0583, 4);
    expect(fromKg(storedKg, 'LB')).toBeCloseTo(225, 2);
    expect(formatWeight(storedKg, 'LB')).toBe('225 lb');
  });
  it('keeps kilograms as entered and formats zero correctly', () => {
    expect(toKg(52.5, 'KG')).toBe(52.5);
    expect(formatWeight(52.5, 'KG')).toBe('52.5 kg');
    expect(formatWeight(0, 'LB')).toBe('0 lb');
  });
});
