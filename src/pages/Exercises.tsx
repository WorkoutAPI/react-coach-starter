import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Dumbbell, Search } from 'lucide-react';
import { api } from '../lib/api';
import type { Exercise } from '../lib/types';
import { useResource } from '../lib/useResource';
import { Badge, Button, Card, Empty, Input, Select, Spinner } from '../components/ui';
import { ExerciseThumbnail } from '../components/ExerciseThumbnail';

export function Exercises({ mode, notify }: { mode: 'demo' | 'live'; notify: (text: string, error?: boolean) => void }) {
  const { t } = useTranslation();
  const { data: references } = useResource<{ muscles: { code: string; name: string }[]; categories: { code: string; name: string }[] }>('/references');
  const [query, setQuery] = useState(''); const [muscle, setMuscle] = useState(''); const [results, setResults] = useState<Exercise[] | null>(null); const [loading, setLoading] = useState(false);
  const search = async (event?: React.FormEvent) => { event?.preventDefault(); setLoading(true); try { const params = new URLSearchParams(); if (query) params.set('q', query); if (muscle) params.set('muscle', muscle); setResults(await api<Exercise[]>(`/exercises?${params}`)); } catch (e) { notify((e as Error).message, true); } finally { setLoading(false); } };
  return <div className="space-y-6"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">{t('exercises.workout.api.library')}</p><h2 className="mt-2 font-display text-3xl font-semibold">{t('exercises.find.the.right.movement')}</h2><p className="mt-2 text-sm text-foreground/55">{t('exercises.search.verified.exercises.and.use.their.muscle.codes.when.shaping.a.program')}</p></div><form onSubmit={search} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row"><div className="relative flex-1"><Search size={17} className="absolute left-3 top-3 text-foreground/40"/><Input className="pl-9" placeholder={t('exercises.search.exercise.names')} value={query} onChange={e => setQuery(e.target.value)}/></div><Select className="sm:w-48" value={muscle} onChange={e => setMuscle(e.target.value)}><option value="">{t('exercises.all.muscles')}</option>{references?.muscles.map(m => <option key={m.code} value={m.code}>{m.name}</option>)}</Select><Button disabled={loading}>{t('exercises.search')}</Button></form>
    {loading ? <Spinner/> : !results ? <Empty title={t('exercises.explore.the.exercise.library')} text={t('exercises.enter.a.name.or.choose.a.muscle.then.search.live.mode.queries.workout.api.direct')} action={<Button onClick={() => void search()}>{t('exercises.browse.all.exercises')}</Button>}/> : !results.length ? <Empty title={t('exercises.no.exercises.found')} text={t('exercises.try.a.broader.name.or.a.different.muscle.group')}/> : <><p className="text-xs text-foreground/45">{t('exercises.results', { count: results.length })}</p><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{results.map(exercise => <Card key={exercise.id} className="p-5"><ExerciseThumbnail code={exercise.code} mode={mode} className="h-20 w-20 rounded-xl" fallback={<Dumbbell size={26}/>}/><h3 className="mt-4 font-display text-lg font-semibold">{exercise.name}</h3><p className="mt-2 line-clamp-3 text-sm leading-relaxed text-foreground/55">{exercise.description || t('exercises.view.exercise.details.in.workout.api')}</p><div className="mt-4 flex flex-wrap gap-2">{exercise.primaryMuscles?.map(m => <Badge key={m.code} tone="accent">{m.name}</Badge>)}</div></Card>)}</div></>}
  </div>;
}
