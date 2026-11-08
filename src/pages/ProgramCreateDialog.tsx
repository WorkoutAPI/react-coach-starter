import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProgramGenerateRequest, ProgramExercisePrescriptionEntry } from '@workoutapi/sdk';
import { Plus, Trash2 } from 'lucide-react';
import { useResource } from '../lib/useResource';
import { toKg, type WeightUnit } from '../lib/weight';
import { Button, Card, Dialog, DialogContent, Input, Label, Select, Textarea } from '../components/ui';
import { api } from '../lib/api';

type Reference = { code: string; name: string };
type References = { muscles: Reference[]; categories: Reference[]; types: Reference[] };
type PrescriptionForm = { exercise: string; nbSets: string; nbReps: string; restSeconds: string; weight: string };
type DayForm = {
  id: string; label: string; exercisesCount: string; sessionDurationMinutes: string; autoPrescription: boolean;
  muscles: string; categories: string; types: string; requiredExercises: string; excludedExercises: string;
  exercisePrescriptions: PrescriptionForm[];
};
const newDay = (): DayForm => ({ id: crypto.randomUUID(), label: '', exercisesCount: '4', sessionDurationMinutes: '', autoPrescription: true, muscles: '', categories: '', types: '', requiredExercises: '', excludedExercises: '', exercisePrescriptions: [] });
const newPrescription = (): PrescriptionForm => ({ exercise: '', nbSets: '', nbReps: '', restSeconds: '', weight: '' });
const codes = (value: string) => [...new Set(value.split(/[\s,;]+/).map(code => code.trim().toUpperCase()).filter(Boolean))];
function numericTarget(value: string, minimum: number, maximum: number, integer = true) {
  const text = value.trim();
  if (!text) return undefined;
  if (!/^\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?$/.test(text)) throw new Error('invalid');
  const parts = text.split(/\s*[-–]\s*/).map(Number);
  if (parts.some(number => number < minimum || number > maximum || (integer && !Number.isInteger(number))) || (parts.length === 2 && parts[1] < parts[0])) throw new Error('invalid');
  return parts.length === 1 ? { value: parts[0] } : { min: parts[0], max: parts[1] };
}
function weightTargetInKg(value: string, unit: WeightUnit) {
  const target = numericTarget(value, 0, unit === 'LB' ? 22046 : 10000, false) as { value: number } | { min: number; max: number } | undefined;
  if (!target) return undefined;
  return 'value' in target ? { value: toKg(target.value, unit) } : { min: toKg(target.min, unit), max: toKg(target.max, unit) };
}

function CodeFilter({ label, value, onChange, items }: { label: string; value: string; onChange: (value: string) => void; items?: Reference[] }) {
  const { t } = useTranslation();
  const selected = new Set(codes(value));
  return <div><Label>{label}</Label><Select value="" onChange={event => onChange([...codes(value), event.target.value].join(', '))} aria-label={label}><option value="">{label}</option>{items?.filter(item => !selected.has(item.code)).map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</Select>{!!selected.size && <div className="mt-2 flex flex-wrap gap-1.5">{items?.filter(item => selected.has(item.code)).map(item => <button key={item.code} type="button" onClick={() => onChange(codes(value).filter(code => code !== item.code).join(', '))} className="rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground" aria-label={t('programs.remove.named.selection', { name: item.name })}>{item.name} ×</button>)}</div>}</div>;
}

export function ProgramCreateDialog({ open, onOpenChange, onCreate, busy, unit }: { open: boolean; onOpenChange: (open: boolean) => void; onCreate: (input: ProgramGenerateRequest & { name: string }) => Promise<void>; busy: boolean; unit: WeightUnit }) {
  const { t } = useTranslation();
  const { data: references } = useResource<References>('/references');
  const [exerciseChoices, setExerciseChoices] = useState<Reference[]>([]);
  const [exerciseChoicesError, setExerciseChoicesError] = useState('');
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    api<Reference[]>('/exercises').then(items => { if (!cancelled) { setExerciseChoices(items); setExerciseChoicesError(''); } }).catch(error => { if (!cancelled) setExerciseChoicesError((error as Error).message); });
    return () => { cancelled = true; };
  }, [open]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState<'' | 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'>('INTERMEDIATE');
  const [goal, setGoal] = useState<'' | 'HYPERTROPHY' | 'STRENGTH' | 'ENDURANCE' | 'WEIGHT_LOSS'>('HYPERTROPHY');
  const [days, setDays] = useState<DayForm[]>(() => [newDay()]);
  const [validationError, setValidationError] = useState('');
  const updateDay = (index: number, patch: Partial<DayForm>) => setDays(current => current.map((day, i) => i === index ? { ...day, ...patch } : day));
  const updatePrescription = (dayIndex: number, entryIndex: number, patch: Partial<PrescriptionForm>) => updateDay(dayIndex, { exercisePrescriptions: days[dayIndex].exercisePrescriptions.map((entry, i) => i === entryIndex ? { ...entry, ...patch } : entry) });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setValidationError('');
    try {
      const payload: ProgramGenerateRequest & { name: string } = {
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(level ? { level } : {}),
        ...(goal ? { goal } : {}),
        days: days.map((day, index) => {
          const prescriptions: ProgramExercisePrescriptionEntry[] = day.exercisePrescriptions.map(entry => {
            const prescription = {
              exercise: entry.exercise.trim().toUpperCase(),
              nbSets: numericTarget(entry.nbSets, 1, 100),
              nbReps: numericTarget(entry.nbReps, 1, 1000),
              restSeconds: numericTarget(entry.restSeconds, 0, 3640),
              weight: weightTargetInKg(entry.weight, unit)
            };
            if (!prescription.exercise || ![prescription.nbSets, prescription.nbReps, prescription.restSeconds, prescription.weight].some(Boolean)) throw new Error('invalid');
            return prescription;
          });
          const count = day.exercisesCount.trim() ? Number(day.exercisesCount) : undefined;
          const duration = day.sessionDurationMinutes.trim() ? Number(day.sessionDurationMinutes) : undefined;
          if ((count !== undefined && (!Number.isInteger(count) || count < 1 || count > 15)) || (duration !== undefined && (!Number.isInteger(duration) || duration < 1 || duration > 1440))) throw new Error('invalid');
          const muscles = codes(day.muscles), categories = codes(day.categories), types = codes(day.types);
          const requiredExercises = codes(day.requiredExercises), excludedExercises = codes(day.excludedExercises);
          if ([...muscles, ...categories, ...types, ...requiredExercises, ...excludedExercises, ...prescriptions.map(item => item.exercise)].some(code => !/^[A-Z0-9_-]{1,100}$/.test(code))) throw new Error('invalid');
          return {
            label: day.label.trim() || t('programs.day', { number: index + 1 }),
            criteria: {
              ...(muscles.length ? { muscles } : {}),
              ...(categories.length ? { categories } : {}),
              ...(types.length ? { types } : {}),
              ...(count !== undefined ? { exercisesCount: count } : {}),
              ...(duration !== undefined ? { sessionDurationMinutes: duration } : {}),
              autoPrescription: day.autoPrescription,
              ...(requiredExercises.length ? { requiredExercises } : {}),
              ...(excludedExercises.length ? { excludedExercises } : {}),
              ...(prescriptions.length ? { exercisePrescriptions: prescriptions } : {})
            }
          };
        })
      };
      await onCreate(payload);
    } catch {
      setValidationError(t('programs.check.generation.criteria'));
    }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent title={t('programs.generate.a.program')}><form onSubmit={submit} className="space-y-5">
    <div><Label>{t('programs.program.name')}</Label><Input value={name} onChange={event => setName(event.target.value)} required maxLength={200} placeholder={t('programs.e.g.strength.foundations')}/></div>
    <div><Label>{t('programs.description')}</Label><Textarea value={description} onChange={event => setDescription(event.target.value)} maxLength={10000} placeholder={t('programs.focus.and.coaching.context')}/></div>
    <div className="grid gap-3 sm:grid-cols-2"><div><Label>{t('programs.level')}</Label><Select value={level} onChange={event => setLevel(event.target.value as typeof level)}><option value="">{t('programs.no.preference')}</option><option value="BEGINNER">{t('programs.beginner')}</option><option value="INTERMEDIATE">{t('programs.intermediate')}</option><option value="ADVANCED">{t('programs.advanced')}</option></Select></div><div><Label>{t('programs.goal')}</Label><Select value={goal} onChange={event => setGoal(event.target.value as typeof goal)}><option value="">{t('programs.no.preference')}</option><option value="HYPERTROPHY">{t('programs.hypertrophy')}</option><option value="STRENGTH">{t('programs.strength')}</option><option value="ENDURANCE">{t('programs.endurance')}</option><option value="WEIGHT_LOSS">{t('programs.weight.loss')}</option></Select></div></div>
    <div className="space-y-3">{days.map((day, index) => <Card key={day.id} className="p-4"><div className="flex items-center justify-between gap-2"><h3 className="font-display text-base font-semibold">{t('programs.day', { number: index + 1 })}</h3>{days.length > 1 && <Button type="button" variant="ghost" size="sm" aria-label={t('programs.remove.day.number', { number: index + 1 })} onClick={() => setDays(current => current.filter(item => item.id !== day.id))}><Trash2 size={15}/>{t('programs.remove.day')}</Button>}</div><div className="mt-3 space-y-3"><div><Label>{t('programs.day.label')}</Label><Input value={day.label} onChange={event => updateDay(index, { label: event.target.value })} maxLength={100} placeholder={t('programs.day', { number: index + 1 })}/></div><div className="grid gap-3 sm:grid-cols-2"><div><Label>{t('programs.exercises.per.day')}</Label><Input type="number" min={1} max={15} value={day.exercisesCount} onChange={event => updateDay(index, { exercisesCount: event.target.value })} placeholder="4"/></div><div><Label>{t('programs.target.duration.minutes')}</Label><Input type="number" min={1} max={1440} value={day.sessionDurationMinutes} onChange={event => updateDay(index, { sessionDurationMinutes: event.target.value })} placeholder="45"/></div></div><p className="text-xs text-foreground/50">{t('programs.count.overrides.duration')}</p><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={day.autoPrescription} onChange={event => updateDay(index, { autoPrescription: event.target.checked })} className="accent-primary"/>{t('programs.automatic.prescriptions')}</label>
      <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-sm font-semibold text-primary">{t('programs.additional.criteria')}</summary><div className="mt-4 space-y-4"><CodeFilter label={t('programs.muscle.groups')} value={day.muscles} onChange={value => updateDay(index, { muscles: value })} items={references?.muscles}/><CodeFilter label={t('programs.equipment.categories')} value={day.categories} onChange={value => updateDay(index, { categories: value })} items={references?.categories}/><CodeFilter label={t('programs.movement.types')} value={day.types} onChange={value => updateDay(index, { types: value })} items={references?.types}/><CodeFilter label={t('programs.required.exercise.codes')} value={day.requiredExercises} onChange={value => updateDay(index, { requiredExercises: value })} items={exerciseChoices}/><CodeFilter label={t('programs.excluded.exercise.codes')} value={day.excludedExercises} onChange={value => updateDay(index, { excludedExercises: value })} items={exerciseChoices}/>{exerciseChoicesError && <p role="alert" className="text-sm text-destructive">{exerciseChoicesError}</p>}
        <div><div className="flex items-center justify-between gap-2"><Label>{t('programs.manual.prescriptions')}</Label><Button type="button" size="sm" variant="outline" onClick={() => updateDay(index, { exercisePrescriptions: [...day.exercisePrescriptions, newPrescription()] })}><Plus size={15}/>{t('programs.add.exercise')}</Button></div><p className="mb-3 text-xs text-foreground/50">{t('programs.prescription.help')}</p><div className="space-y-3">{day.exercisePrescriptions.map((entry, entryIndex) => <div key={entryIndex} className="rounded-lg border border-border p-3"><div className="flex gap-2"><Select value={entry.exercise} onChange={event => updatePrescription(index, entryIndex, { exercise: event.target.value })} aria-label={t('programs.exercise')}><option value="">{t('progress.choose.exercise')}</option>{exerciseChoices.map(exercise => <option key={exercise.code} value={exercise.code}>{exercise.name}</option>)}</Select><Button type="button" size="icon" variant="ghost" aria-label={t('programs.remove.exercise')} onClick={() => updateDay(index, { exercisePrescriptions: day.exercisePrescriptions.filter((_, i) => i !== entryIndex) })}><Trash2 size={16}/></Button></div><div className="mt-2 grid grid-cols-2 gap-2"><Input value={entry.nbSets} onChange={event => updatePrescription(index, entryIndex, { nbSets: event.target.value })} aria-label={t('programs.sets.2')} placeholder={t('programs.sets.example')}/><Input value={entry.nbReps} onChange={event => updatePrescription(index, entryIndex, { nbReps: event.target.value })} aria-label={t('programs.reps.2')} placeholder={t('programs.reps.example')}/><Input value={entry.restSeconds} onChange={event => updatePrescription(index, entryIndex, { restSeconds: event.target.value })} aria-label={t('programs.rest.seconds')} placeholder={t('programs.rest.example')}/><Input value={entry.weight} onChange={event => updatePrescription(index, entryIndex, { weight: event.target.value })} aria-label={t('programs.weight.unit', { unit: unit === 'LB' ? 'lb' : 'kg' })} placeholder={t('programs.weight.example')}/></div></div>)}</div></div>
      </div></details></div></Card>)}<Button type="button" variant="outline" className="w-full border-dashed" disabled={days.length >= 7} onClick={() => setDays(current => current.length < 7 ? [...current, newDay()] : current)}><Plus size={17}/>{t('programs.add.day')}</Button>{days.length >= 7 && <p className="text-center text-xs text-foreground/50">{t('programs.maximum.seven.days')}</p>}</div>
    {validationError && <p role="alert" className="text-sm text-destructive">{validationError}</p>}
    <Button className="w-full" disabled={busy}>{busy ? t('programs.generating') : t('programs.generate.program')}</Button>
  </form></DialogContent></Dialog>;
}
