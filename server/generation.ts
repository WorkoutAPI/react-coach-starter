import { z } from 'zod';

const code = z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/);
const codes = z.array(code).max(100).optional();
const target = (minimum: number, maximum: number, integer = true) => {
  const number = integer ? z.number().int().min(minimum).max(maximum) : z.number().min(minimum).max(maximum);
  return z.union([
    z.object({ value: number }).strict(),
    z.object({ min: number, max: number }).strict().refine(range => range.max >= range.min, 'Maximum must be at least the minimum.')
  ]);
};

const prescription = z.object({
  exercise: code,
  nbSets: target(1, 100).optional(),
  nbReps: target(1, 1000).optional(),
  restSeconds: target(0, 3640).optional(),
  weight: target(0, 10000, false).optional()
}).strict().refine(value => value.nbSets || value.nbReps || value.restSeconds || value.weight, 'Add at least one prescription value.');

const criteria = z.object({
  muscles: codes,
  categories: codes,
  types: codes,
  exercisesCount: z.number().int().min(1).max(15).optional(),
  sessionDurationMinutes: z.number().int().min(1).max(1440).optional(),
  autoPrescription: z.boolean().optional(),
  requiredExercises: codes,
  excludedExercises: codes,
  exercisePrescriptions: z.array(prescription).max(100).optional()
}).strict().refine(value => {
  const excluded = new Set(value.excludedExercises || []);
  return !(value.requiredExercises || []).some(code => excluded.has(code)) && !(value.exercisePrescriptions || []).some(item => excluded.has(item.exercise));
}, 'An exercise cannot be both required or prescribed and excluded.');

export const generation = z.object({
  name: z.string().trim().min(2).max(200),
  description: z.string().max(10000).optional(),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
  goal: z.enum(['HYPERTROPHY', 'STRENGTH', 'ENDURANCE', 'WEIGHT_LOSS']).optional(),
  days: z.array(z.object({ label: z.string().max(100).optional(), criteria: criteria.optional() }).strict()).min(1).max(7)
}).strict();
