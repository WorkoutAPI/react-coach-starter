import type { Log } from './types';
import { logDay } from './progress';

export type ExercisePoint = { date: string; weight: number | null; volume: number; repsPerSet: number; sets: number; estimatedMax: number | null };

export function exercisePoints(logs: Log[]): ExercisePoint[] {
  const byDay = new Map<string, ExercisePoint>();
  for (const log of logs) {
    const date = logDay(log);
    const point = byDay.get(date) || { date, weight: null, volume: 0, repsPerSet: 0, sets: 0, estimatedMax: null };
    if (log.weightKg != null) {
      point.weight = Math.max(point.weight ?? 0, log.weightKg);
      point.volume += log.weightKg * log.sets * log.reps;
      if (log.weightKg > 0 && log.reps <= 12) point.estimatedMax = Math.max(point.estimatedMax ?? 0, log.weightKg * (1 + log.reps / 30));
    }
    point.repsPerSet = Math.max(point.repsPerSet, log.reps);
    point.sets += log.sets;
    byDay.set(date, point);
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)).map(point => ({ ...point, estimatedMax: point.estimatedMax == null ? null : Math.round(point.estimatedMax * 10) / 10 }));
}

export function estimatedStrengthChange(points: ExercisePoint[]) {
  const comparable = points.filter(point => point.estimatedMax != null && point.estimatedMax > 0);
  if (comparable.length < 2) return null;
  const first = comparable[0].estimatedMax!;
  const last = comparable[comparable.length - 1].estimatedMax!;
  return { percent: Math.round(((last - first) / first) * 1000) / 10, first, last };
}
