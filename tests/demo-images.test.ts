import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { demoExercises, demoLogs, demoPrograms, demoTrainingSessions } from '../server/demo';
import { demoExerciseImage } from '../src/lib/demoExerciseImage';

describe('demo exercise illustrations', () => {
  it('covers every exercise in the catalog, assigned programs, and training history', () => {
    const catalog = new Set(demoExercises.map(exercise => exercise.code));
    const programCodes = demoPrograms.flatMap(program => (program.content as { days: { exercises: { code: string }[] }[] }).days.flatMap(day => day.exercises.map(exercise => exercise.code)));
    expect(catalog.size).toBe(10);
    expect(new Set(programCodes)).toEqual(catalog);
    expect(new Set(demoLogs.map(log => log.exerciseCode))).toEqual(catalog);
    for (const code of catalog) {
      const image = demoExerciseImage(code);
      expect(image).not.toBeNull();
      expect(existsSync(join(process.cwd(), 'public', image!.slice(1)))).toBe(true);
    }
    expect(demoExerciseImage('../missing')).toBeNull();
    expect(demoLogs.filter(log => ['DIPS', 'AB_WHEEL', 'PRONATED_GRIP_PULL_UPS'].includes(log.exerciseCode)).every(log => log.weightKg === null)).toBe(true);
  });
});

describe('demo training history', () => {
  it('shows mostly complete assigned program days without duplicating isolated exercise dates', () => {
    for (const program of demoPrograms) {
      const guided = demoTrainingSessions.filter(session => session.clientId === program.clientId);
      const isolated = demoLogs.filter(log => log.clientId === program.clientId);
      const isolatedDates = new Set(isolated.map(log => log.performedOn!.slice(0, 10)));
      const guidedDates = new Set(guided.map(session => session.completedAt!.slice(0, 10)));
      expect(guided).toHaveLength(58);
      expect(isolated).toHaveLength(20);
      expect(guidedDates.size).toBe(58);
      expect(isolatedDates.size).toBe(20);
      expect([...guidedDates].every(date => !isolatedDates.has(date))).toBe(true);
      const days = (program.content as { days: { exercises: { code: string }[] }[] }).days;
      for (const session of guided) {
        expect(session.programId).toBe(program.id);
        expect(session.content.exercises.map(exercise => exercise.code)).toEqual(days[session.content.dayIndex].exercises.map(exercise => exercise.code));
        expect(session.content.exercises.every(exercise => exercise.sets.length > 0 && !exercise.extra && !exercise.skipped)).toBe(true);
      }
    }
  });
});
