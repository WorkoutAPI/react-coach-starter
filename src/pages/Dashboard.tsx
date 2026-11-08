import { dateLocale } from '../i18n';
import { useTranslation } from 'react-i18next';
import { ArrowRight, BookOpen, CalendarDays, Check, Dumbbell, MessageSquare, TrendingUp, Users } from 'lucide-react';
import { Card, Empty, Spinner } from '../components/ui';
import { ExerciseThumbnail } from '../components/ExerciseThumbnail';
import { useResource } from '../lib/useResource';
import type { Log, User } from '../lib/types';
import type { View } from '../lib/navigation';
import { formatWeight } from '../lib/weight';
import { formatShortDay, logDay } from '../lib/progress';

type RecentSession = { clientId: string; clientName: string; performedOn: string; logs: Log[] };
type RecentGuided = { id: string; clientId?: string; clientName?: string; dayLabel: string; dayIndex: number; performedOn: string; exerciseCount: number };
type DashboardData = {
  clients?: number;
  programs: number;
  assignedPrograms?: number;
  sessions?: number;
  sessionsThisWeek: number;
  unreadMessages: number;
  currentProgram?: { id: string; name: string } | null;
  activity?: { day: string; sessions: number }[];
  recent: Log[];
  recentSessions?: RecentSession[];
  recentGuided?: RecentGuided[];
};
type Navigate = (view: View) => void;

export function Dashboard({ user, mode, navigate }: { user: User; mode: 'demo' | 'live'; navigate: Navigate }) {
  const { t } = useTranslation();
  const { data, loading, error } = useResource<DashboardData>('/dashboard');
  if (loading) return <Spinner/>;
  if (error || !data) return <Empty title={t('dashboard.dashboard.unavailable')} text={error || t('dashboard.try.refreshing.the.page')}/>;
  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">{t('dashboard.your.workspace')}</p><h2 className="mt-2 font-display text-3xl font-semibold">{t('dashboard.greeting', { name: user.name.split(' ')[0] })}</h2><p className="mt-2 text-sm text-foreground/55">{user.role === 'COACH' ? t('dashboard.coach.intro') : t('dashboard.client.intro')}</p></div>
      <span className="rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-foreground/60">{new Intl.DateTimeFormat(dateLocale(), { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</span>
    </div>
    {user.role === 'COACH' ? <CoachDashboard data={data} navigate={navigate}/> : <ClientDashboard data={data} user={user} mode={mode} navigate={navigate}/>}
  </div>;
}

function CoachDashboard({ data, navigate }: { data: DashboardData; navigate: Navigate }) {
  const { t } = useTranslation();
  const recent = [
    ...(data.recentGuided || []).map(item => ({ key: item.id, clientName: item.clientName || '', day: item.performedOn, detail: `${item.dayLabel || t('programs.day', { number: item.dayIndex + 1 })} · ${t('dashboard.session.exercise.count', { count: item.exerciseCount })}` })),
    ...(data.recentSessions || []).map(item => ({ key: `${item.clientId}:${item.performedOn}`, clientName: item.clientName, day: item.performedOn, detail: t('dashboard.session.exercise.count', { count: item.logs.length }) }))
  ].sort((a, b) => b.day.localeCompare(a.day)).slice(0, 4);
  const hasClients = (data.clients || 0) > 0;
  const hasPrograms = data.programs > 0;
  const hasAssignments = (data.assignedPrograms || 0) > 0;
  const action = !hasClients ? { label: t('dashboard.invite.client'), view: 'clients' as View } : !hasPrograms ? { label: t('dashboard.create.a.program'), view: 'programs' as View } : !hasAssignments ? { label: t('dashboard.assign.program'), view: 'programs' as View } : data.unreadMessages ? { label: t('dashboard.open.messages'), view: 'messages' as View } : { label: t('dashboard.review.your.clients'), view: 'clients' as View };
  return <>
    <Card className="relative overflow-hidden !bg-[#25343a] p-6 !text-white sm:p-8">
      <div className="relative z-10 flex flex-wrap items-end justify-between gap-6"><div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#93c5fd]">{t('dashboard.coach.pulse')}</p><h3 className="mt-3 font-display text-2xl font-semibold sm:text-3xl">{hasClients ? t('dashboard.coach.hero.ready') : t('dashboard.coach.hero.start')}</h3><p className="mt-3 text-sm text-white/65">{hasClients ? t('dashboard.coach.hero.summary') : t('dashboard.coach.hero.empty')}</p></div><button onClick={() => navigate(action.view)} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#25343a] hover:bg-white/90">{action.label}<ArrowRight size={16}/></button></div>
    </Card>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat icon={Users} label={t('dashboard.clients.total')} value={data.clients || 0} hint={t('dashboard.clients.hint')} onClick={() => navigate('clients')}/>
      <Stat icon={CalendarDays} label={t('dashboard.sessions.this.week')} value={data.sessionsThisWeek} hint={t('dashboard.sessions.hint')} onClick={() => navigate('progress')}/>
      <Stat icon={BookOpen} label={t('dashboard.programs.assigned')} value={data.assignedPrograms || 0} hint={t('dashboard.programs.hint')} onClick={() => navigate('programs')}/>
      <Stat icon={MessageSquare} label={t('dashboard.messages.unread')} value={data.unreadMessages} hint={t('dashboard.messages.hint')} onClick={() => navigate('messages')}/>
    </div>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)]">
      <Card className="p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-display text-lg font-semibold">{t('dashboard.training.activity')}</h3><p className="mt-1 text-xs text-foreground/50">{t('dashboard.activity.last.14.days')}</p></div><span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground/60">{t('dashboard.activity.sessions.label')}</span></div><ActivityChart points={data.activity || []}/></Card>
      <Card className="p-6"><div className="flex items-start justify-between gap-3"><div><h3 className="font-display text-lg font-semibold">{t('dashboard.latest.sessions')}</h3><p className="mt-1 text-xs text-foreground/50">{t('dashboard.latest.sessions.hint')}</p></div><button onClick={() => navigate('progress')} className="shrink-0 text-xs font-semibold text-primary hover:underline">{t('dashboard.view.progress')}</button></div>
        {recent.length ? <div className="mt-5 divide-y divide-border">{recent.map(item => <div key={item.key} className="flex items-center gap-3 py-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Dumbbell size={18}/></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.clientName}</p><p className="mt-0.5 truncate text-xs text-foreground/50">{item.detail}</p></div><span className="shrink-0 text-xs text-foreground/45">{formatShortDay(item.day)}</span></div>)}</div> : <EmptyPanel text={t('dashboard.coach.no.sessions')}/>}
      </Card>
    </div>
    {(!hasClients || !hasAssignments) && <Card className="flex flex-wrap items-center justify-between gap-4 p-6"><div><h3 className="font-display text-lg font-semibold">{t('dashboard.next.step')}</h3><p className="mt-1 text-sm text-foreground/55">{!hasClients ? t('dashboard.invite.first.client.hint') : !hasPrograms ? t('dashboard.create.first.program.hint') : t('dashboard.assign.first.program.hint')}</p></div><button onClick={() => navigate(action.view)} className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">{action.label}<ArrowRight size={16}/></button></Card>}
  </>;
}

function ClientDashboard({ data, user, mode, navigate }: { data: DashboardData; user: User; mode: 'demo' | 'live'; navigate: Navigate }) {
  const { t } = useTranslation();
  const recent = [
    ...(data.recentGuided || []).map(item => ({ kind: 'guided' as const, key: item.id, day: item.performedOn, title: item.dayLabel || t('programs.day', { number: item.dayIndex + 1 }), detail: t('dashboard.session.exercise.count', { count: item.exerciseCount }) })),
    ...data.recent.map(item => ({ kind: 'log' as const, key: item.id, day: logDay(item), title: item.exerciseName, detail: t('dashboard.log.summary', { sets: item.sets, reps: item.reps, weight: item.weightKg == null ? '' : t('dashboard.log.weight', { weight: formatWeight(item.weightKg, user.weightUnit) }) }), code: item.exerciseCode }))
  ].sort((a, b) => b.day.localeCompare(a.day)).slice(0, 4);
  return <>
    <Card className="relative overflow-hidden !bg-[#25343a] p-6 !text-white sm:p-8"><div className="relative z-10 flex flex-wrap items-end justify-between gap-6"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#93c5fd]">{t('dashboard.client.plan')}</p><h3 className="mt-3 font-display text-2xl font-semibold sm:text-3xl">{data.currentProgram?.name || t('dashboard.client.no.program.title')}</h3><p className="mt-3 text-sm text-white/65">{data.currentProgram ? t('dashboard.client.plan.hint') : t('dashboard.client.no.program.hint')}</p></div><button onClick={() => navigate(data.currentProgram ? 'training' : 'messages')} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#25343a] hover:bg-white/90">{data.currentProgram ? t('training.start') : t('dashboard.open.messages')}<ArrowRight size={16}/></button></div></Card>
    <div className="grid gap-3 sm:grid-cols-3">
      <Stat icon={CalendarDays} label={t('dashboard.sessions.this.week')} value={data.sessionsThisWeek} hint={t('dashboard.sessions.hint')} onClick={() => navigate('progress')}/>
      <Stat icon={BookOpen} label={t('dashboard.assigned.programs')} value={data.programs} hint={t('dashboard.client.programs.hint')} onClick={() => navigate('programs')}/>
      <Stat icon={MessageSquare} label={t('dashboard.messages.unread')} value={data.unreadMessages} hint={t('dashboard.messages.hint')} onClick={() => navigate('messages')}/>
    </div>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)]">
      <Card className="p-6"><div className="flex items-start justify-between gap-3"><div><h3 className="font-display text-lg font-semibold">{t('dashboard.client.recent.training')}</h3><p className="mt-1 text-xs text-foreground/50">{t('dashboard.client.recent.hint')}</p></div><button onClick={() => navigate('progress')} className="shrink-0 text-xs font-semibold text-primary hover:underline">{t('dashboard.view.progress')}</button></div>
        {recent.length ? <div className="mt-5 divide-y divide-border">{recent.map(item => <div key={item.key} className="flex items-center gap-3 py-3">{item.kind === 'log' ? <ExerciseThumbnail code={item.code} mode={mode} className="h-10 w-10 shrink-0" fallback={<Dumbbell size={18}/>}/> : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Check size={18}/></div>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.title}</p><p className="mt-0.5 truncate text-xs text-foreground/50">{item.detail}</p></div><span className="shrink-0 text-xs text-foreground/45">{formatShortDay(item.day)}</span></div>)}</div> : <EmptyPanel text={t('dashboard.client.no.training')}/>}
      </Card>
      <Card className="flex flex-col justify-between p-6"><div><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><TrendingUp size={20}/></div><h3 className="mt-5 font-display text-xl font-semibold">{t('dashboard.client.log.title')}</h3><p className="mt-3 text-sm leading-relaxed text-foreground/55">{data.currentProgram ? t('dashboard.client.log.hint') : t('dashboard.client.log.no.program')}</p></div><button onClick={() => navigate(data.currentProgram ? 'training' : 'messages')} className="mt-6 inline-flex items-center gap-2 self-start text-sm font-semibold text-primary hover:underline">{data.currentProgram ? t('dashboard.client.log.action') : t('dashboard.open.messages')}<ArrowRight size={16}/></button></Card>
    </div>
  </>;
}

function ActivityChart({ points }: { points: { day: string; sessions: number }[] }) {
  const { t } = useTranslation();
  const max = Math.max(1, ...points.map(point => point.sessions));
  const hasActivity = points.some(point => point.sessions > 0);
  return <div className="mt-6"><div className="flex h-40 items-end gap-2 border-b border-border pb-2" role="img" aria-label={hasActivity ? t('dashboard.activity.chart.label', { count: points.reduce((sum, point) => sum + point.sessions, 0) }) : t('dashboard.activity.no.data')}>
    {points.map(point => <div key={point.day} className="group relative flex h-full flex-1 items-end"><div className={`w-full rounded-t-md ${point.sessions ? 'bg-primary/75 group-hover:bg-primary' : 'bg-muted'}`} style={{ height: `${point.sessions ? Math.max(12, point.sessions / max * 100) : 8}%` }}/>{point.sessions > 0 && <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-1 text-[10px] text-background group-hover:block">{t('dashboard.activity.bar', { count: point.sessions, day: formatShortDay(point.day) })}</span>}</div>)}
  </div><div className="mt-2 flex justify-between text-[11px] text-foreground/45"><span>{points[0] ? formatShortDay(points[0].day) : ''}</span><span>{points.at(-1) ? formatShortDay(points.at(-1)!.day) : ''}</span></div>{!hasActivity && <p className="mt-4 text-sm text-foreground/50">{t('dashboard.activity.no.data')}</p>}</div>;
}

function EmptyPanel({ text }: { text: string }) { return <div className="mt-5 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-foreground/50">{text}</div>; }
function Stat({ icon: Icon, label, value, hint, onClick }: { icon: typeof Users; label: string; value: number; hint: string; onClick: () => void }) { return <button onClick={onClick} className="text-left"><Card className="h-full p-5 transition-transform hover:-translate-y-0.5"><div className="flex items-start justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-[.08em] text-foreground/50">{label}</p><Icon size={18} className="shrink-0 text-primary"/></div><p className="mt-5 font-display text-3xl font-semibold">{value}</p><p className="mt-2 text-xs text-foreground/45">{hint}</p></Card></button>; }
