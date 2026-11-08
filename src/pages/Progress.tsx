import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, Plus } from 'lucide-react';
import { api, body } from '../lib/api';
import type { Exercise, Program, User } from '../lib/types';
import { useResource } from '../lib/useResource';
import { Button, Dialog, DialogContent, Empty, Input, Label, Select, Spinner, Textarea } from '../components/ui';
import { todayKey } from '../lib/progress';
import { toKg } from '../lib/weight';
import { ProgressHistory } from './ProgressHistory';

const ExerciseEvolution = lazy(() => import('./ExerciseEvolution').then(module => ({ default: module.ExerciseEvolution })));

export function Progress({ user, mode, notify, onOpenTraining }: { user: User; mode: 'demo' | 'live'; notify: (text: string, error?: boolean) => void; onOpenTraining: () => void }) {
  const { t } = useTranslation();
  const clients = useResource<User[]>(user.role === 'COACH' ? '/clients' : '/me');
  const [clientId, setClientId] = useState(user.role === 'CLIENT' ? user.id : '');
  const [page, setPage] = useState(1);
  const [historyRevision, setHistoryRevision] = useState(0);
  const programs = useResource<Program[]>('/programs');
  const [focus, setFocus] = useState<{ code: string; name: string } | null>(null);
  const [open, setOpen] = useState(false); const [programId, setProgramId] = useState(''); const [code, setCode] = useState(''); const [sets, setSets] = useState(3); const [reps, setReps] = useState(8); const [weight, setWeight] = useState(''); const [notes, setNotes] = useState(''); const [performedOn, setPerformedOn] = useState(todayKey); const [busy, setBusy] = useState(false);
  const selectedProgram = programs.data?.find(p => p.id === programId);
  const exercises = selectedProgram?.content.days?.flatMap(d => d.exercises || []) || [];
  const selectedExercise: Exercise | undefined = exercises.find(e => e.code === code);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!selectedExercise) return; setBusy(true); try { await api('/logs', body({ programId, exerciseCode: code, sets, reps, weightKg: weight ? toKg(Number(weight), user.weightUnit) : null, notes, performedOn })); setOpen(false); setNotes(''); if (mode === 'live') { notify(t('progress.session.recorded')); setPage(1); setHistoryRevision(current => current + 1); } } catch (e) { notify((e as Error).message, true); } finally { setBusy(false); } };

  return <div className="space-y-6">
    {focus && clientId ? <Suspense fallback={<Spinner/>}><ExerciseEvolution key={`${clientId}:${focus.code}`} clientId={clientId} exercise={focus} mode={mode} unit={user.weightUnit} onBack={() => setFocus(null)}/></Suspense> : <>
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">{t('progress.training.history')}</p><h2 className="mt-2 font-display text-3xl font-semibold">{t('progress.progress.recorded')}</h2><p className="mt-2 text-sm text-foreground/55">{user.role === 'COACH' ? t('progress.review.your.clients.completed.work') : t('progress.add.your.actual.sets.and.see.your.consistency.grow')}</p></div>{user.role === 'CLIENT' && <div className="flex flex-wrap gap-2"><Button disabled={!programs.data?.length} onClick={onOpenTraining}><Activity size={17}/>{t('training.start')}</Button><Button variant="outline" disabled={!programs.data?.length} onClick={() => { setProgramId(programs.data?.[0]?.id || ''); setCode(''); setPerformedOn(todayKey()); setOpen(true); }}><Plus size={17}/>{t('progress.log.exercise')}</Button></div>}</div>
      {user.role === 'COACH' && <Select className="max-w-sm" value={clientId} onChange={e => { setClientId(e.target.value); setPage(1); setFocus(null); }}><option value="">{t('progress.choose.a.client')}</option>{Array.isArray(clients.data) && clients.data.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}
      {!clientId
        ? <Empty title={t('progress.select.a.client')} text={t('progress.choose.a.client.to.review.their.training.history')}/>
        : <ProgressHistory key={`${clientId}:${historyRevision}`} clientId={clientId} page={page} onPageChange={setPage} unit={user.weightUnit} mode={mode} onSelectExercise={setFocus}/>}
    </>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent title={t('progress.log.an.exercise')}><form onSubmit={submit} className="space-y-4"><div><Label>{t('progress.program')}</Label><Select value={programId} onChange={e => { setProgramId(e.target.value); setCode(''); }} required><option value="">{t('progress.choose.program')}</option>{programs.data?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></div><div><Label>{t('progress.exercise')}</Label><Select value={code} onChange={e => setCode(e.target.value)} required><option value="">{t('progress.choose.exercise')}</option>{exercises.map((exercise, i) => <option key={`${exercise.code}-${i}`} value={exercise.code}>{exercise.name}</option>)}</Select></div><div><Label htmlFor="progress-performed-on">{t('progress.performed.on')}</Label><Input id="progress-performed-on" type="date" required max={todayKey()} value={performedOn} onChange={e => setPerformedOn(e.target.value)}/></div><div className="grid grid-cols-3 gap-3"><div><Label>{t('progress.sets')}</Label><Input type="number" min={1} max={30} value={sets} onChange={e => setSets(Number(e.target.value))}/></div><div><Label>{t('progress.reps')}</Label><Input type="number" min={1} max={1000} value={reps} onChange={e => setReps(Number(e.target.value))}/></div><div><Label>{t('progress.weight.unit', { unit: user.weightUnit === 'LB' ? 'lb' : 'kg' })}</Label><Input type="number" min={0} step="any" value={weight} onChange={e => setWeight(e.target.value)}/></div></div><div><Label>{t('progress.notes')}</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('progress.how.did.it.feel')}/></div><Button className="w-full" disabled={busy || !selectedExercise}>{t('progress.save.session')}</Button></form></DialogContent></Dialog>
  </div>;
}
