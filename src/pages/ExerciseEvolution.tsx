import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, ArrowLeft } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { Button, Card, Empty, Input, Label, Spinner } from '../components/ui';
import { ChartContainer, ChartTooltip, chartTooltipStyle } from '../components/chart';
import { ExerciseThumbnail } from '../components/ExerciseThumbnail';
import { useResource } from '../lib/useResource';
import type { Log } from '../lib/types';
import { formatWeight, fromKg, type WeightUnit } from '../lib/weight';
import { dateLocale } from '../i18n';
import { formatDay, logDay, number } from '../lib/progress';
import { estimatedStrengthChange, exercisePoints, type ExercisePoint } from '../lib/exerciseProgress';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, paginationSlots } from '../components/pagination';

const axisDate = (value: string) => new Intl.DateTimeFormat(dateLocale(), { day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00`));
const cardDate = (value: string) => new Intl.DateTimeFormat(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
const comparisonRowsPerPage = 10;

export function ExerciseEvolution({ clientId, exercise, mode, unit, onBack }: { clientId: string; exercise: { code: string; name: string }; mode: 'demo' | 'live'; unit: WeightUnit; onBack: () => void }) {
  const { t } = useTranslation();
  const history = useResource<Log[]>(`/logs?clientId=${encodeURIComponent(clientId)}&exerciseCode=${encodeURIComponent(exercise.code)}&includeGuided=true`);
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [tablePage, setTablePage] = useState(1);
  const invalidRange = !!(from && to && from > to);
  const filtered = useMemo(() => (history.data || []).filter(log => { const day = logDay(log); return (!from || day >= from) && (!to || day <= to); }).sort((a, b) => a.performedAt.localeCompare(b.performedAt)), [history.data, from, to]);
  const points = useMemo(() => exercisePoints(filtered), [filtered]);
  const tablePages = Math.ceil(points.length / comparisonRowsPerPage);
  const tableRows = points.slice().reverse().slice((tablePage - 1) * comparisonRowsPerPage, tablePage * comparisonRowsPerPage);
  const weighted = points.filter(point => point.weight != null);
  const bestLoad = weighted.reduce<ExercisePoint | null>((best, point) => !best || (point.weight ?? 0) >= (best.weight ?? 0) ? point : best, null);
  const latestLog = filtered.at(-1);
  const strengthChange = estimatedStrengthChange(points);
  const chartPoints = points.map(point => ({ ...point, weight: point.weight == null ? null : fromKg(point.weight, unit), volume: fromKg(point.volume, unit), estimatedMax: point.estimatedMax == null ? null : fromKg(point.estimatedMax, unit) }));
  const unitLabel = unit === 'LB' ? 'lb' : 'kg';
  const tooltip = { contentStyle: chartTooltipStyle, labelFormatter: (value: unknown) => formatDay(String(value)) };
  const charts: { title: string; help: string; key: keyof ExercisePoint; kind: 'line' | 'bar'; unit: string; empty: boolean; emptyText: string }[] = [
    { title: t('progress.chart.weight'), help: t('progress.chart.weight.help'), key: 'weight', kind: 'line', unit: unitLabel, empty: !weighted.length, emptyText: t('progress.no.weight.data') },
    { title: t('progress.chart.estimated.max'), help: t('progress.chart.estimated.max.help'), key: 'estimatedMax', kind: 'line', unit: unitLabel, empty: !points.some(point => point.estimatedMax != null), emptyText: t('progress.no.estimate.data') },
    { title: t('progress.chart.volume'), help: t('progress.volume.definition'), key: 'volume', kind: 'bar', unit: unitLabel, empty: !weighted.length, emptyText: t('progress.no.weight.data') },
    { title: t('progress.chart.reps'), help: t('progress.chart.reps.help'), key: 'repsPerSet', kind: 'bar', unit: '', empty: false, emptyText: '' }
  ];
  const tablePager = tablePages > 1 && <Pagination aria-label={t('progress.comparison.pagination')} className="border-t border-border px-3 py-4"><PaginationContent>
    <PaginationItem><PaginationPrevious text={t('progress.previous.page')} aria-label={t('progress.previous.page')} disabled={tablePage <= 1} onClick={() => setTablePage(current => current - 1)}/></PaginationItem>
    {paginationSlots(tablePage, tablePages).map((slot, index) => <PaginationItem key={slot === 'ellipsis' ? `gap-${index}` : slot}>{slot === 'ellipsis' ? <PaginationEllipsis label={t('progress.more.pages')}/> : <PaginationLink isActive={slot === tablePage} aria-label={t('progress.go.to.page', { page: slot })} onClick={() => setTablePage(slot)}>{slot}</PaginationLink>}</PaginationItem>)}
    <PaginationItem><PaginationNext text={t('progress.next.page')} aria-label={t('progress.next.page')} disabled={tablePage >= tablePages} onClick={() => setTablePage(current => current + 1)}/></PaginationItem>
  </PaginationContent></Pagination>;
  return <div className="space-y-6">
    <Button variant="ghost" onClick={onBack}><ArrowLeft size={17}/>{t('progress.back.to.sessions')}</Button>
    <div className="flex items-center gap-4"><ExerciseThumbnail code={exercise.code} mode={mode} className="h-14 w-14" fallback={<Activity size={23}/>}/><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">{t('progress.exercise.evolution')}</p><h2 className="mt-1 font-display text-3xl font-semibold">{exercise.name}</h2><p className="mt-1 text-sm text-foreground/55">{t('progress.evolution.description')}</p></div></div>
    <Card className="p-5"><div className="flex flex-wrap items-end gap-4"><div className="min-w-40 flex-1"><Label htmlFor="progress-from">{t('progress.from')}</Label><Input id="progress-from" type="date" max={to || undefined} value={from} onChange={e => { setFrom(e.target.value); setTablePage(1); }}/></div><div className="min-w-40 flex-1"><Label htmlFor="progress-to">{t('progress.to')}</Label><Input id="progress-to" type="date" min={from || undefined} value={to} onChange={e => { setTo(e.target.value); setTablePage(1); }}/></div><Button variant="outline" onClick={() => { setFrom(''); setTo(''); setTablePage(1); }}>{t('progress.all.dates')}</Button></div>{invalidRange && <p className="mt-3 text-sm text-destructive">{t('progress.invalid.range')}</p>}</Card>
    {history.loading ? <Spinner/> : history.error ? <Empty title={t('progress.progress.unavailable')} text={history.error}/> : !filtered.length || invalidRange ? <Empty title={t('progress.no.data.in.range')} text={t('progress.adjust.dates')}/> : <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t('progress.last.logged')} value={cardDate(points[points.length - 1].date)} detail={t('progress.session.count', { count: points.length })}/>
        <Stat label={t('progress.latest.performance')} value={latestLog ? latestLog.source === 'GUIDED' ? t('progress.latest.guided.set', { reps: latestLog.reps }) : t('progress.sets.reps', { sets: latestLog.sets, reps: latestLog.reps }) : '—'} detail={latestLog?.weightKg == null ? t('progress.no.load.recorded') : t('progress.at.load', { load: formatWeight(latestLog.weightKg, unit) })}/>
        <Stat label={t('progress.best.weight')} value={bestLoad?.weight == null ? '—' : formatWeight(bestLoad.weight, unit)} detail={bestLoad ? t('progress.on.date', { date: cardDate(bestLoad.date) }) : t('progress.no.load.recorded')}/>
        <Stat label={t('progress.strength.change')} value={strengthChange ? `${strengthChange.percent > 0 ? '+' : ''}${number(strengthChange.percent)}%` : '—'} detail={strengthChange ? t('progress.estimate.comparison', { first: formatWeight(strengthChange.first, unit), last: formatWeight(strengthChange.last, unit) }) : t('progress.need.two.estimated.days')}/>
      </div>
      {points.length < 2 ? <Empty title={t('progress.more.days.title')} text={t('progress.more.days.help')}/> : <div className="grid gap-4 xl:grid-cols-2">{charts.map(chart => <Card key={chart.key} className="min-w-0 p-5"><h3 className="font-display font-semibold">{chart.title}</h3><p className="mt-1 text-xs text-foreground/50">{chart.help}</p><div className="mt-5 h-60 w-full" role="img" aria-label={chart.title}>{chart.empty ? <div className="flex h-full items-center justify-center text-sm text-foreground/45">{chart.emptyText}</div> : <ChartContainer label={chart.title}>{chart.kind === 'line' ? <LineChart data={chartPoints} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}><CartesianGrid vertical={false} stroke="currentColor" opacity={0.12}/><XAxis dataKey="date" tickFormatter={axisDate} tickLine={false} axisLine={false} fontSize={11}/><YAxis tickLine={false} axisLine={false} fontSize={11} width={42}/><ChartTooltip {...tooltip} formatter={value => [`${number(Number(value))} ${chart.unit}`, chart.title]}/><Line type="monotone" dataKey={chart.key} stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false}/></LineChart> : <BarChart data={chartPoints} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}><CartesianGrid vertical={false} stroke="currentColor" opacity={0.12}/><XAxis dataKey="date" tickFormatter={axisDate} tickLine={false} axisLine={false} fontSize={11}/><YAxis tickLine={false} axisLine={false} fontSize={11} width={42}/><ChartTooltip {...tooltip} formatter={value => [`${number(Number(value))} ${chart.unit}`, chart.title]}/><Bar dataKey={chart.key} fill="hsl(var(--primary))" radius={[5, 5, 0, 0]}/></BarChart>}</ChartContainer>}</div></Card>)}</div>}
      <Card className="overflow-hidden"><div className="border-b border-border p-5"><h3 className="font-display font-semibold">{t('progress.comparison.table')}</h3><p className="mt-1 text-xs text-foreground/50">{t('progress.comparison.table.help')}</p></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-muted/40 text-xs text-foreground/60"><tr><th className="px-5 py-3">{t('progress.date')}</th><th className="px-5 py-3">{t('progress.best.weight')}</th><th className="px-5 py-3">{t('progress.day.volume')}</th><th className="px-5 py-3">{t('progress.best.reps.per.set')}</th><th className="px-5 py-3">{t('progress.sets')}</th></tr></thead><tbody className="divide-y divide-border">{tableRows.map(point => <tr key={point.date}><td className="px-5 py-3">{formatDay(point.date)}</td><td className="px-5 py-3">{point.weight == null ? '—' : formatWeight(point.weight, unit)}</td><td className="px-5 py-3">{point.weight == null ? '—' : formatWeight(point.volume, unit)}</td><td className="px-5 py-3">{number(point.repsPerSet)}</td><td className="px-5 py-3">{number(point.sets)}</td></tr>)}</tbody></table></div>{tablePager}</Card>
    </>}
    {!!history.data?.length && <p className="text-xs text-foreground/45">{t('progress.data.caveat')}</p>}
  </div>;
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) { return <Card className="p-5"><p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">{label}</p><p className="mt-3 font-display text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-foreground/50">{detail}</p></Card>; }
