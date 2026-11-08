import { describe, expect, it } from 'vitest';
import { generation } from '../server/generation.js';

describe('program generation input', () => {
  const fullInput = {
    name: 'Strength block', description: 'Three weeks', level: 'INTERMEDIATE', goal: 'STRENGTH',
    days: [{ label: 'Day 1', criteria: {
      muscles: ['CHEST'], categories: ['FREE_WEIGHT'], types: ['POLYARTICULAR'],
      sessionDurationMinutes: 45, autoPrescription: true,
      requiredExercises: ['BARBELL_BENCH_PRESS'], excludedExercises: ['SQUAT'],
      exercisePrescriptions: [{ exercise: 'BARBELL_BENCH_PRESS', nbSets: { min: 3, max: 5 }, nbReps: { value: 8 }, restSeconds: { min: 60, max: 90 }, weight: { value: 40.5 } }]
    } }]
  };

  it('accepts every SDK generation criterion and fixed or ranged prescriptions', () => {
    expect(generation.safeParse(fullInput).success).toBe(true);
  });
  it('rejects inverted ranges and excluded prescribed exercises', () => {
    const inverted = structuredClone(fullInput);
    inverted.days[0].criteria.exercisePrescriptions[0].nbSets = { min: 5, max: 3 };
    expect(generation.safeParse(inverted).success).toBe(false);
    const excluded = structuredClone(fullInput);
    excluded.days[0].criteria.excludedExercises = ['BARBELL_BENCH_PRESS'];
    expect(generation.safeParse(excluded).success).toBe(false);
  });
});
