import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Dumbbell } from 'lucide-react';
import type { Exercise } from '../lib/types';
import { Button, Input, Label } from '../components/ui';
import { ExerciseThumbnail } from '../components/ExerciseThumbnail';
import { ProgramExerciseEmbed } from './ProgramExerciseEmbed';
import { formatWeight, type WeightUnit } from '../lib/weight';

const formatRange = (value?: { value?: number; min?: number; max?: number }) => value?.value != null ? String(value.value) : value?.min != null ? `${value.min}${value.max != null ? `–${value.max}` : ''}` : '—';
const initialValue = (value: { value?: number; min?: number } | undefined, fallback: number) => value?.value ?? value?.min ?? fallback;

export function ProgramExerciseRow({ exercise, index, dayIndex, programId, mode, unit, canEdit, busy, onSave }: {
  exercise: Exercise;
  index: number;
  dayIndex: number;
  programId: string;
  mode: 'demo' | 'live';
  unit: WeightUnit;
  canEdit: boolean;
  busy: boolean;
  onSave: (dayIndex: number, exerciseIndex: number, sets: number, reps: number, restSeconds: number) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [sets, setSets] = useState(() => initialValue(exercise.nbSets, 3));
  const [reps, setReps] = useState(() => initialValue(exercise.nbReps, 8));
  const [rest, setRest] = useState(() => initialValue(exercise.restSeconds, 90));
  const panelId = `program-exercise-${programId}-${dayIndex}-${index}`;
  const toggle = () => {
    if (!open) {
      setSets(initialValue(exercise.nbSets, 3));
      setReps(initialValue(exercise.nbReps, 8));
      setRest(initialValue(exercise.restSeconds, 90));
    }
    setOpen(!open);
  };
  const save = (event: FormEvent) => {
    event.preventDefault();
    void onSave(dayIndex, index, sets, reps, rest);
  };
  const detailGroups = [
    { label: t('programs.primary.muscles'), values: exercise.primaryMuscles },
    { label: t('programs.secondary.muscles'), values: exercise.secondaryMuscles },
    { label: t('programs.exercise.categories'), values: exercise.categories },
    { label: t('programs.movement.types'), values: exercise.types },
  ].filter(group => group.values?.length);
  const prescribedWeight = exercise.weight?.value != null ? formatWeight(exercise.weight.value, unit) : exercise.weight?.min != null ? `${formatWeight(exercise.weight.min, unit)}${exercise.weight.max != null ? `–${formatWeight(exercise.weight.max, unit)}` : ''}` : null;

  return <div>
    <button type="button" aria-expanded={open} aria-controls={panelId} onClick={toggle} className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">
      <span className="flex min-w-0 items-center gap-3"><span className="w-5 shrink-0 text-xs font-bold text-primary">{String(index + 1).padStart(2, '0')}</span><ExerciseThumbnail code={exercise.code} mode={mode} className="h-12 w-12" fallback={<Dumbbell size={20}/>}/><span className="min-w-0"><span className="block text-sm font-semibold">{exercise.name}</span><span className="mt-0.5 block text-xs text-foreground/45">{exercise.primaryMuscles?.map(m => m.name).join(', ') || t('programs.muscles.unavailable')}</span></span></span>
      <span className="flex items-center gap-3"><span className="text-xs font-medium text-foreground/60">{t('programs.prescription', { sets: formatRange(exercise.nbSets), reps: formatRange(exercise.nbReps), rest: formatRange(exercise.restSeconds) })}</span><ChevronDown size={17} className={`shrink-0 text-foreground/50 transition-transform ${open ? 'rotate-180' : ''}`}/></span>
    </button>
    {open && <div id={panelId} className="exercise-detail-panel border-t border-border bg-muted/20 px-5 py-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(260px,1fr)_1fr]">
        <ProgramExerciseEmbed programId={programId} dayIndex={dayIndex} exerciseIndex={index} code={exercise.code} name={exercise.name} mode={mode}/>
        <div className="space-y-4">
          <div><h4 className="text-xs font-semibold uppercase tracking-wider text-foreground/55">{t('programs.movement.description')}</h4><p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/75">{exercise.description || t('programs.movement.description.unavailable')}</p></div>
          {prescribedWeight && <div><h4 className="text-xs font-semibold uppercase tracking-wider text-foreground/55">{t('programs.prescribed.load')}</h4><p className="mt-1 text-sm text-foreground/75">{prescribedWeight}</p></div>}
          {detailGroups.map(group => <div key={group.label}><h4 className="text-xs font-semibold uppercase tracking-wider text-foreground/55">{group.label}</h4><p className="mt-1 text-sm text-foreground/75">{group.values?.map(value => value.name).join(', ')}</p></div>)}
        </div>
      </div>
      {canEdit && <form onSubmit={save} className="mt-6 border-t border-border pt-5"><h4 className="font-display font-semibold">{t('programs.adjust.exercise.prescription')}</h4><div className="mt-3 grid gap-3 sm:grid-cols-3"><div><Label htmlFor={`${panelId}-sets`}>{t('programs.sets.2')}</Label><Input id={`${panelId}-sets`} type="number" min={1} max={30} required value={sets} onChange={e => setSets(Number(e.target.value))}/></div><div><Label htmlFor={`${panelId}-reps`}>{t('programs.reps.2')}</Label><Input id={`${panelId}-reps`} type="number" min={1} max={1000} required value={reps} onChange={e => setReps(Number(e.target.value))}/></div><div><Label htmlFor={`${panelId}-rest`}>{t('programs.rest.seconds')}</Label><Input id={`${panelId}-rest`} type="number" min={0} max={3640} required value={rest} onChange={e => setRest(Number(e.target.value))}/></div></div><Button className="mt-4" disabled={busy}>{t('programs.save.prescription')}</Button></form>}
    </div>}
  </div>;
}
