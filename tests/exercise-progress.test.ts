import { describe, expect, it } from 'vitest';
import type { Log } from '../src/lib/types';
import { estimatedStrengthChange, exercisePoints } from '../src/lib/exerciseProgress';
import { logDay } from '../src/lib/progress';

const log = (id: string, performedAt: string, sets: number, reps: number, weightKg: number | null): Log => ({
  id, performedAt, sets, reps, weightKg, clientId: 'client', programId: 'program', exerciseCode: 'PRESS', exerciseName: 'Press', notes: null
});

describe('coach exercise comparisons', () => {
  it('groups a day while retaining the best reps per set and daily load', () => {
    const points = exercisePoints([
      log('a', '2026-10-01T12:00:00Z', 4, 8, 40),
      log('b', '2026-10-01T13:00:00Z', 3, 10, 30),
      log('c', '2026-10-08T12:00:00Z', 4, 8, 45)
    ]);
    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({ weight: 40, volume: 2180, repsPerSet: 10, sets: 7, estimatedMax: 50.7 });
    expect(estimatedStrengthChange(points)).toEqual({ first: 50.7, last: 57, percent: 12.4 });
  });

  it('does not infer a trend or max from one unloaded or high-rep day', () => {
    const points = exercisePoints([log('a', '2026-10-01T12:00:00Z', 3, 15, 40), log('b', '2026-10-08T12:00:00Z', 3, 8, null)]);
    expect(points.map(point => point.estimatedMax)).toEqual([null, null]);
    expect(estimatedStrengthChange(points)).toBeNull();
  });
  it('uses the chosen workout date independently of the timestamp', () => {
    const entry = { ...log('backdated', '2025-04-09T22:00:00Z', 3, 8, 40), performedOn: '2025-04-10T00:00:00.000Z' };
    expect(logDay(entry)).toBe('2025-04-10');
    expect(exercisePoints([entry])[0].date).toBe('2025-04-10');
  });
  it('combines guided sets with manual logs using each actual rep count and load', () => {
    const points = exercisePoints([
      log('manual', '2026-10-01T10:00:00Z', 2, 8, 30),
      { ...log('guided-1', '2026-10-01T12:00:00Z', 1, 8, 40), source: 'GUIDED' },
      { ...log('guided-2', '2026-10-01T12:00:00Z', 1, 6, 45), source: 'GUIDED' }
    ]);
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ sets: 4, repsPerSet: 8, weight: 45, volume: 1070, estimatedMax: 54 });
  });
});
