import { randomUUID } from 'node:crypto';
import type { ProgramGenerateRequest } from '@workoutapi/sdk';

export type DemoUser = { id: string; email: string; name: string; role: 'COACH' | 'CLIENT'; coachId: string | null; goal: string | null; notes: string | null; weightUnit: 'KG' | 'LB'; emailLocale: string; notifyMessages: boolean; notifyPrograms: boolean };
export type DemoProgram = { id: string; coachId: string; clientId: string | null; apiProgramId: string | null; name: string; description: string | null; status: 'DRAFT' | 'ASSIGNED' | 'ARCHIVED'; content: unknown; shareUrl: string | null; createdAt: string; updatedAt: string };
export type DemoLog = { id: string; clientId: string; programId: string; exerciseCode: string; exerciseName: string; sets: number; reps: number; weightKg: number | null; notes: string | null; performedAt: string; performedOn?: string };
export type DemoMessage = { id: string; senderId: string; recipientId: string; body: string; createdAt: string; readAt: string | null };
export type DemoTrainingSession = { id: string; clientId: string; programId: string | null; status: 'IN_PROGRESS' | 'COMPLETED'; content: { programName: string; dayLabel: string; dayIndex: number; exercises: { code: string; name: string; targetSets: number | null; targetReps: string; restSeconds: number | null; sets: { reps: number; weightKg: number | null }[]; skipped: boolean; extra: boolean }[] }; startedAt: string; completedAt: string | null; updatedAt: string };

export const demoUsers: DemoUser[] = [
  { id: 'demo-coach', email: 'coach@demo.local', name: 'Alex Morgan', role: 'COACH', coachId: null, goal: null, notes: null, weightUnit: 'KG', emailLocale: 'en', notifyMessages: true, notifyPrograms: true },
  { id: 'demo-client', email: 'sam@demo.local', name: 'Sam Rivera', role: 'CLIENT', coachId: 'demo-coach', goal: 'STRENGTH', notes: 'Training three times a week', weightUnit: 'KG', emailLocale: 'en', notifyMessages: true, notifyPrograms: true },
  { id: 'demo-client-2', email: 'jordan@demo.local', name: 'Jordan Lee', role: 'CLIENT', coachId: 'demo-coach', goal: 'HYPERTROPHY', notes: 'Prefers dumbbells', weightUnit: 'KG', emailLocale: 'en', notifyMessages: true, notifyPrograms: true }
];
export const demoExercises = [
  { id: 'd-1', code: 'BARBELL_BENCH_PRESS', name: 'Barbell Bench Press', description: 'A compound chest press with a barbell.', primaryMuscles: [{ code: 'CHEST', name: 'Chest' }], categories: [{ code: 'FREE_WEIGHT', name: 'Free weight' }], types: [{ code: 'POLYARTICULAR', name: 'Compound' }] },
  { id: 'd-2', code: 'SEATED_CHEST_PRESS', name: 'Seated Chest Press', description: 'A seated machine press for the chest.', primaryMuscles: [{ code: 'CHEST', name: 'Chest' }], categories: [{ code: 'MACHINE', name: 'Machine' }], types: [{ code: 'POLYARTICULAR', name: 'Compound' }] },
  { id: 'd-3', code: 'DIPS', name: 'Dips', description: 'A bodyweight press for the triceps and chest.', primaryMuscles: [{ code: 'TRICEPS', name: 'Triceps' }], categories: [{ code: 'BODYWEIGHT', name: 'Bodyweight' }], types: [{ code: 'POLYARTICULAR', name: 'Compound' }] },
  { id: 'd-4', code: 'DEADLIFT', name: 'Deadlift', description: 'A barbell hip hinge for the posterior chain.', primaryMuscles: [{ code: 'HAMSTRINGS', name: 'Hamstrings' }], categories: [{ code: 'FREE_WEIGHT', name: 'Free weight' }], types: [{ code: 'POLYARTICULAR', name: 'Compound' }] },
  { id: 'd-5', code: 'LUNGES', name: 'Lunges', description: 'A single-leg lower-body movement.', primaryMuscles: [{ code: 'QUADRICEPS', name: 'Quadriceps' }], categories: [{ code: 'FREE_WEIGHT', name: 'Free weight' }], types: [{ code: 'POLYARTICULAR', name: 'Compound' }] },
  { id: 'd-6', code: 'AB_WHEEL', name: 'Ab Wheel', description: 'A bodyweight rollout for the core.', primaryMuscles: [{ code: 'ABS', name: 'Abdominals' }], categories: [{ code: 'BODYWEIGHT', name: 'Bodyweight' }], types: [{ code: 'ISOLATION', name: 'Isolation' }] },
  { id: 'd-7', code: 'PRONATED_GRIP_PULL_UPS', name: 'Pronated Grip Pull-Ups', description: 'A bodyweight vertical pull for the back.', primaryMuscles: [{ code: 'BACK', name: 'Back' }], categories: [{ code: 'BODYWEIGHT', name: 'Bodyweight' }], types: [{ code: 'POLYARTICULAR', name: 'Compound' }] },
  { id: 'd-8', code: 'UNILATERAL_BENT_OVER_ROW', name: 'Unilateral Bent-Over Row', description: 'A single-arm row for the back.', primaryMuscles: [{ code: 'BACK', name: 'Back' }], categories: [{ code: 'FREE_WEIGHT', name: 'Free weight' }], types: [{ code: 'POLYARTICULAR', name: 'Compound' }] },
  { id: 'd-9', code: 'INCLINE_DUMBBELL_REVERSE_FLY', name: 'Incline Dumbbell Reverse Fly', description: 'A rear-shoulder raise on an incline bench.', primaryMuscles: [{ code: 'SHOULDERS', name: 'Shoulders' }], categories: [{ code: 'FREE_WEIGHT', name: 'Free weight' }], types: [{ code: 'ISOLATION', name: 'Isolation' }] },
  { id: 'd-10', code: 'BARBELL_CURL', name: 'Barbell Curl', description: 'A barbell curl for the biceps.', primaryMuscles: [{ code: 'BICEPS', name: 'Biceps' }], categories: [{ code: 'FREE_WEIGHT', name: 'Free weight' }], types: [{ code: 'ISOLATION', name: 'Isolation' }] }
];
type DemoExercisePlan = { code: string; sets: number; reps: number; baseKg: number | null; gainKg: number; restSeconds: number };
const demoSplit: { label: string; exercises: DemoExercisePlan[] }[] = [
  { label: 'Day 1 · Push', exercises: [
    { code: 'BARBELL_BENCH_PRESS', sets: 4, reps: 8, baseKg: 35, gainKg: 1, restSeconds: 120 },
    { code: 'SEATED_CHEST_PRESS', sets: 3, reps: 10, baseKg: 35, gainKg: 1, restSeconds: 90 },
    { code: 'DIPS', sets: 3, reps: 8, baseKg: null, gainKg: 0, restSeconds: 90 }
  ] },
  { label: 'Day 2 · Legs & core', exercises: [
    { code: 'DEADLIFT', sets: 4, reps: 8, baseKg: 55, gainKg: 1.5, restSeconds: 120 },
    { code: 'LUNGES', sets: 3, reps: 10, baseKg: 10, gainKg: 0.5, restSeconds: 90 },
    { code: 'AB_WHEEL', sets: 3, reps: 10, baseKg: null, gainKg: 0, restSeconds: 60 }
  ] },
  { label: 'Day 3 · Pull', exercises: [
    { code: 'PRONATED_GRIP_PULL_UPS', sets: 3, reps: 6, baseKg: null, gainKg: 0, restSeconds: 120 },
    { code: 'UNILATERAL_BENT_OVER_ROW', sets: 4, reps: 10, baseKg: 16, gainKg: 0.5, restSeconds: 90 },
    { code: 'INCLINE_DUMBBELL_REVERSE_FLY', sets: 3, reps: 12, baseKg: 5, gainKg: 0.25, restSeconds: 60 },
    { code: 'BARBELL_CURL', sets: 3, reps: 10, baseKg: 15, gainKg: 0.5, restSeconds: 60 }
  ] }
];
const demoProgramContent = (hypertrophy: boolean) => ({ days: demoSplit.map(day => ({ label: day.label, exercises: day.exercises.map(plan => ({
  ...demoExercises.find(exercise => exercise.code === plan.code)!,
  nbSets: { value: hypertrophy ? Math.min(plan.sets, 3) : plan.sets },
  nbReps: { min: plan.reps, max: plan.reps + 2 },
  restSeconds: { value: plan.restSeconds }
})) })) });
export const demoPrograms: DemoProgram[] = [
  { id: 'demo-program', coachId: 'demo-coach', clientId: 'demo-client', apiProgramId: null, name: 'Strength foundations', description: 'A three-day push, legs and core, and pull plan for Sam.', status: 'ASSIGNED', content: demoProgramContent(false), shareUrl: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'demo-program-jordan', coachId: 'demo-coach', clientId: 'demo-client-2', apiProgramId: null, name: 'Consistent growth', description: 'A three-day hypertrophy plan for Jordan.', status: 'ASSIGNED', content: demoProgramContent(true), shareUrl: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
];
const DAY_MS = 86_400_000;
function demoTrainingHistory(clientId: string, programId: string, weeks: number, loadFactor: number): DemoLog[] {
  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const lastFriday = todayUtc - ((new Date(todayUtc).getUTCDay() + 2) % 7) * DAY_MS;
  const firstMonday = lastFriday - ((weeks - 1) * 7 + 4) * DAY_MS;
  return Array.from({ length: weeks }, (_, week) => demoSplit.flatMap((day, dayIndex) => {
    const date = new Date(firstMonday + (week * 7 + dayIndex * 2) * DAY_MS).toISOString().slice(0, 10);
    const deload = week > 0 && (week + 1) % 6 === 0;
    return day.exercises.map((plan, exerciseIndex) => {
      const exercise = demoExercises.find(item => item.code === plan.code)!;
      const progression = Math.floor(week / 3);
      const load = plan.baseKg == null ? null : (plan.baseKg + progression * plan.gainKg) * loadFactor * (deload ? 0.85 : 1);
      return {
        id: `demo-log-${clientId}-${week}-${dayIndex}-${exerciseIndex}`,
        clientId, programId, exerciseCode: plan.code, exerciseName: exercise.name,
        sets: deload ? Math.max(2, plan.sets - 1) : clientId === 'demo-client-2' ? Math.min(plan.sets, 3) : plan.sets,
        reps: plan.reps + (week % 3), weightKg: load == null ? null : Math.round(load * 2) / 2,
        notes: deload && exerciseIndex === 0 ? 'Planned lighter week; focus on technique.' : null,
        performedOn: `${date}T00:00:00.000Z`, performedAt: `${date}T${String(12 + Math.floor(exerciseIndex / 4)).padStart(2, '0')}:${String(exerciseIndex * 10).padStart(2, '0')}:00.000Z`
      };
    });
  })).flat().sort((a, b) => b.performedAt.localeCompare(a.performedAt));
}
function demoHistory(clientId: string, programId: string, loadFactor: number) {
  const program = demoPrograms.find(item => item.id === programId)!;
  const byDate = new Map<string, DemoLog[]>();
  for (const log of demoTrainingHistory(clientId, programId, 26, loadFactor)) {
    const date = log.performedOn!.slice(0, 10);
    byDate.set(date, [...(byDate.get(date) || []), log]);
  }
  const logs: DemoLog[] = [];
  const sessions: DemoTrainingSession[] = [];
  const isolatedByDay = [0, 0, 0];
  [...byDate.entries()].forEach(([date, dayLogs], index) => {
    const match = dayLogs[0].id.match(/-(\d+)-(\d+)-(\d+)$/)!;
    const dayIndex = Number(match[2]);
    // One isolated exercise for every three complete program days.
    if (index % 4 === 0) {
      logs.push(dayLogs[isolatedByDay[dayIndex]++ % dayLogs.length]);
      return;
    }
    const day = demoSplit[dayIndex];
    const exercises = day.exercises.map(plan => {
      const log = dayLogs.find(item => item.exerciseCode === plan.code)!;
      return {
        code: plan.code, name: log.exerciseName, targetSets: clientId === 'demo-client-2' ? Math.min(plan.sets, 3) : plan.sets,
        targetReps: `${plan.reps}–${plan.reps + 2}`, restSeconds: plan.restSeconds,
        sets: Array.from({ length: log.sets }, (_, setIndex) => ({ reps: Math.max(1, log.reps - (setIndex === log.sets - 1 ? 1 : 0)), weightKg: log.weightKg })),
        skipped: false, extra: false
      };
    });
    sessions.push({
      id: `demo-guided-${clientId}-${date}`, clientId, programId, status: 'COMPLETED',
      content: { programName: program.name, dayLabel: day.label, dayIndex, exercises },
      startedAt: `${date}T17:00:00.000Z`, completedAt: `${date}T18:00:00.000Z`, updatedAt: `${date}T18:00:00.000Z`
    });
  });
  return { logs, sessions };
}
const samHistory = demoHistory('demo-client', 'demo-program', 1);
const jordanHistory = demoHistory('demo-client-2', 'demo-program-jordan', 0.8);
export const demoLogs: DemoLog[] = [...samHistory.logs, ...jordanHistory.logs].sort((a, b) => b.performedAt.localeCompare(a.performedAt));
export const demoTrainingSessions: DemoTrainingSession[] = [...samHistory.sessions, ...jordanHistory.sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
export const demoMessages: DemoMessage[] = [{ id: 'demo-message', senderId: 'demo-coach', recipientId: 'demo-client', body: 'Great first session, Sam. Keep tracking your sets here.', createdAt: new Date(Date.now() - 3600000).toISOString(), readAt: null }];
export const demoInvites: { token: string; email: string; name: string; goal?: string; coachId: string }[] = [];
export function demoGenerate(name: string, description: string | undefined, goal: string | undefined, days: ProgramGenerateRequest['days']) {
  return { id: randomUUID(), coachId: 'demo-coach', clientId: null, apiProgramId: null, name, description: description || null, status: 'DRAFT' as const, content: { days: days.map((day, index) => {
    const criteria = day.criteria || {};
    const excluded = new Set(criteria.excludedExercises || []);
    const prescriptions = criteria.exercisePrescriptions || [];
    const required = [...new Set([...(criteria.requiredExercises || []), ...prescriptions.map(item => item.exercise)])];
    const matches = demoExercises.filter(exercise => !excluded.has(exercise.code) &&
      (!criteria.muscles?.length || exercise.primaryMuscles.some(item => criteria.muscles?.includes(item.code))) &&
      (!criteria.categories?.length || exercise.categories.some(item => criteria.categories?.includes(item.code))) &&
      (!criteria.types?.length || exercise.types.some(item => criteria.types?.includes(item.code))));
    const selected = [...required.map(code => demoExercises.find(exercise => exercise.code === code)).filter((exercise): exercise is typeof demoExercises[number] => !!exercise && !excluded.has(exercise.code)), ...matches];
    const count = criteria.exercisesCount || (criteria.sessionDurationMinutes ? Math.max(1, Math.round(criteria.sessionDurationMinutes / 12)) : 3);
    const unique = [...new Map(selected.map(exercise => [exercise.code, exercise])).values()].slice(0, Math.max(count, required.length));
    return { label: day.label || `Day ${index + 1}`, exercises: unique.map(exercise => {
      const explicit = prescriptions.find(item => item.exercise === exercise.code);
      return { ...exercise, ...(criteria.autoPrescription === false ? {} : { nbSets: { value: goal === 'STRENGTH' ? 4 : 3 }, nbReps: goal === 'STRENGTH' ? { min: 5, max: 8 } : { min: 8, max: 12 }, restSeconds: { value: 90 } }), ...(explicit?.nbSets ? { nbSets: explicit.nbSets } : {}), ...(explicit?.nbReps ? { nbReps: explicit.nbReps } : {}), ...(explicit?.restSeconds ? { restSeconds: explicit.restSeconds } : {}), ...(explicit?.weight ? { weight: explicit.weight } : {}) };
    }) };
  }) }, shareUrl: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}
