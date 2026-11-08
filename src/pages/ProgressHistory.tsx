import { useTranslation } from 'react-i18next';
import { Activity, ArrowRight, CalendarDays } from 'lucide-react';
import { Button, Card, Empty, Spinner } from '../components/ui';
import { ExerciseThumbnail } from '../components/ExerciseThumbnail';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, paginationSlots } from '../components/pagination';
import { useResource } from '../lib/useResource';
import { formatDay } from '../lib/progress';
import { formatWeight } from '../lib/weight';
import type { Log, TrainingSession, User } from '../lib/types';

type HistoryItem =
  | { kind: 'GUIDED'; date: string; session: TrainingSession }
  | { kind: 'INDIVIDUAL'; date: string; logs: Log[] };
type HistoryPage = { items: HistoryItem[]; totalEntries: number; page: number; pageSize: number };

export function ProgressHistory({ clientId, page, onPageChange, unit, mode, onSelectExercise }: {
  clientId: string;
  page: number;
  onPageChange: (page: number) => void;
  unit: User['weightUnit'];
  mode: 'demo' | 'live';
  onSelectExercise: (exercise: { code: string; name: string }) => void;
}) {
  const { t } = useTranslation();
  const history = useResource<HistoryPage>(`/progress-history?clientId=${encodeURIComponent(clientId)}&page=${page}&pageSize=8`);
  if (history.loading) return <Spinner/>;
  if (history.error) return <Empty title={t('progress.progress.unavailable')} text={history.error}/>;
  if (!history.data?.items.length) return <Empty title={t('progress.no.training.logged.yet')} text={t('progress.completed.sessions.will.appear.here.when.this.client.records.them')}/>;
  const totalPages = Math.ceil(history.data.totalEntries / history.data.pageSize);
  return <div className="space-y-5">
    {history.data.items.map((item, index) => {
      const exercises = item.kind === 'GUIDED'
        ? item.session.content.exercises.filter(exercise => exercise.sets.length || exercise.skipped)
        : item.logs;
      return <Card key={`${item.kind}:${item.kind === 'GUIDED' ? item.session.id : item.date}:${index}`} className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarDays size={19}/></div>
          <div className="min-w-0">
            <p className="font-display font-semibold capitalize">{formatDay(item.date)}</p>
            <p className="mt-1 truncate text-xs text-foreground/50">{item.kind === 'GUIDED'
              ? `${item.session.content.dayLabel || t('programs.day', { number: item.session.content.dayIndex + 1 })} · ${item.session.content.programName}`
              : t('progress.exercise.count', { count: item.logs.length })}</p>
          </div>
        </div>
        <div className="divide-y divide-border">{item.kind === 'GUIDED'
          ? exercises.map((exercise, exerciseIndex) => {
            const entry = exercise as TrainingSession['content']['exercises'][number];
            return <div key={`${entry.code}:${exerciseIndex}`} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3"><ExerciseThumbnail code={entry.code} mode={mode} className="h-11 w-11" fallback={<Activity size={18}/>}/><div className="min-w-0"><p className="text-sm font-semibold">{entry.name}</p><p className="mt-1 text-xs leading-relaxed text-foreground/50">{entry.skipped ? t('training.skipped') : entry.sets.map((set, position) => t('training.history.set', { number: position + 1, reps: set.reps, weight: set.weightKg == null ? t('training.bodyweight') : formatWeight(set.weightKg, unit) })).join(' · ')}</p></div></div>
              {entry.sets.length > 0 && <Button size="sm" variant="outline" onClick={() => onSelectExercise({ code: entry.code, name: entry.name })}>{t('progress.evolution')}<ArrowRight size={15}/></Button>}
            </div>;
          })
          : item.logs.map(log => <div key={log.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"><div className="flex min-w-0 items-center gap-3"><ExerciseThumbnail code={log.exerciseCode} mode={mode} className="h-11 w-11" fallback={<Activity size={18}/>}/><div className="min-w-0"><p className="text-sm font-semibold">{log.exerciseName}</p><p className="mt-1 text-xs text-foreground/50">{t('progress.log.summary', { sets: log.sets, reps: log.reps, weight: log.weightKg == null ? '' : t('progress.log.weight', { weight: formatWeight(log.weightKg, unit) }) })}</p>{log.notes && <p className="mt-1 text-xs text-foreground/55">{log.notes}</p>}</div></div><Button size="sm" variant="outline" onClick={() => onSelectExercise({ code: log.exerciseCode, name: log.exerciseName })}>{t('progress.evolution')}<ArrowRight size={15}/></Button></div>)}</div>
      </Card>;
    })}
    {totalPages > 1 && <Pagination aria-label={t('progress.pagination')} className="pt-2"><PaginationContent>
      <PaginationItem><PaginationPrevious text={t('progress.previous.page')} aria-label={t('progress.previous.page')} disabled={page <= 1} onClick={() => onPageChange(page - 1)}/></PaginationItem>
      {paginationSlots(page, totalPages).map((slot, index) => <PaginationItem key={slot === 'ellipsis' ? `gap-${index}` : slot}>{slot === 'ellipsis' ? <PaginationEllipsis label={t('progress.more.pages')}/> : <PaginationLink isActive={slot === page} aria-label={t('progress.go.to.page', { page: slot })} onClick={() => onPageChange(slot)}>{slot}</PaginationLink>}</PaginationItem>)}
      <PaginationItem><PaginationNext text={t('progress.next.page')} aria-label={t('progress.next.page')} disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}/></PaginationItem>
    </PaginationContent></Pagination>}
  </div>;
}
