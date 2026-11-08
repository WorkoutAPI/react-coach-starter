import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, BookOpen, ChevronRight, CircleHelp, Dumbbell, LayoutDashboard, LogOut, Menu, MessageSquare, Moon, Settings, Sun, Users, X } from 'lucide-react';
import { api, body } from './lib/api';
import type { User } from './lib/types';
import { brand } from './config/brand';
import { applyTheme } from './config/theme';
import { Spinner, cn } from './components/ui';
import { AuthScreen } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { Clients } from './pages/Clients';
import { Programs } from './pages/Programs';
import { Training } from './pages/Training';
import { Exercises } from './pages/Exercises';
import { Progress } from './pages/Progress';
import { Messages } from './pages/Messages';
import { Account } from './pages/Account';
import { viewFromLocation, viewPaths, type View } from './lib/navigation';

type Bootstrap = { mode: 'demo' | 'live'; user: User | null; workoutConfigured: boolean };
const views: { key: View; labelKey: string; icon: typeof Activity; coachOnly?: boolean; clientOnly?: boolean }[] = [
  { key: 'overview', labelKey: 'app.overview', icon: LayoutDashboard },
  { key: 'clients', labelKey: 'app.clients', icon: Users, coachOnly: true },
  { key: 'programs', labelKey: 'app.programs', icon: BookOpen },
  { key: 'training', labelKey: 'app.training', icon: Dumbbell, clientOnly: true },
  { key: 'exercises', labelKey: 'app.exercise.library', icon: Dumbbell, coachOnly: true },
  { key: 'progress', labelKey: 'app.progress', icon: Activity },
  { key: 'messages', labelKey: 'app.messages', icon: MessageSquare },
  { key: 'account', labelKey: 'app.settings', icon: Settings }
];
const initialView = (): View => viewFromLocation(location.pathname, location.hash);

export function App() {
  const { t, i18n } = useTranslation();
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [view, setView] = useState<View>(initialView);
  const [trainingSelection, setTrainingSelection] = useState<{ programId: string; dayIndex: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const hydratedLanguageAccount = useRef<string | null>(null);
  const requestedLanguage = useRef<string | null>(null);
  const languageUpdates = useRef<Promise<void>>(Promise.resolve());
  const [dark, setDark] = useState(localStorage.getItem('coach-theme') === 'dark');
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const refresh = useCallback(async () => setBootstrap(await api<Bootstrap>('/bootstrap')), []);
  useEffect(() => { refresh().catch(() => setNotice({ text: i18n.t('app.connection.error'), error: true })); }, [refresh, i18n]);
  const accountId = bootstrap?.user?.id;
  const savedEmailLocale = bootstrap?.user?.emailLocale;
  useEffect(() => {
    if (!accountId) { hydratedLanguageAccount.current = null; requestedLanguage.current = null; return; }
    if (hydratedLanguageAccount.current === accountId) return;
    hydratedLanguageAccount.current = accountId;
    const supported = new Set<string>(brand.languages);
    const preferred = savedEmailLocale && supported.has(savedEmailLocale) ? savedEmailLocale : brand.languages[0];
    requestedLanguage.current = preferred;
    if (i18n.resolvedLanguage !== preferred) void i18n.changeLanguage(preferred);
    if (savedEmailLocale !== preferred) {
      void api<User>('/me/language', { method: 'PATCH', body: JSON.stringify({ locale: preferred }) })
        .then(user => setBootstrap(current => current?.user?.id === accountId ? { ...current, user } : current))
        .catch(() => setNotice({ text: i18n.t('api.request.failed'), error: true }));
    }
  }, [accountId, savedEmailLocale, i18n]);
  useEffect(() => {
    if (!accountId) return;
    const onLanguageChanged = (language: string) => {
      const locale = language.split(/[-_]/)[0].toLowerCase();
      if (locale === requestedLanguage.current || !new Set<string>(brand.languages).has(locale)) return;
      requestedLanguage.current = locale;
      languageUpdates.current = languageUpdates.current.then(async () => {
        const user = await api<User>('/me/language', { method: 'PATCH', body: JSON.stringify({ locale }) });
        setBootstrap(current => current?.user?.id === accountId ? { ...current, user } : current);
      }).catch(() => { setNotice({ text: i18n.t('api.request.failed'), error: true }); });
    };
    i18n.on('languageChanged', onLanguageChanged);
    return () => { i18n.off('languageChanged', onLanguageChanged); };
  }, [accountId, i18n]);
  useEffect(() => { applyTheme(dark); localStorage.setItem('coach-theme', dark ? 'dark' : 'light'); }, [dark]);
  useEffect(() => {
    const sync = () => {
      const next = initialView();
      if (location.pathname !== viewPaths[next] || location.hash) history.replaceState(null, '', `${viewPaths[next]}${location.search}`);
      setView(next);
    };
    sync();
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', sync); };
  }, []);
  useEffect(() => { if (notice) { const timer = setTimeout(() => setNotice(null), 5500); return () => clearTimeout(timer); } }, [notice]);
  useEffect(() => {
    if (!accountMenuOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setAccountMenuOpen(false); accountButtonRef.current?.focus(); }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeOnEscape); };
  }, [accountMenuOpen]);
  const notify = (text: string, error = false) => setNotice({ text, error });
  const navigate = (next: View) => { if (location.pathname !== viewPaths[next] || location.search || location.hash) history.pushState(null, '', viewPaths[next]); setView(next); setMenuOpen(false); setAccountMenuOpen(false); };
  const logout = async () => { setAccountMenuOpen(false); try { await api('/auth/logout', body({})); await refresh(); navigate('overview'); } catch (e) { notify((e as Error).message, true); } };
  if (!bootstrap) return <div className="flex min-h-screen items-center justify-center"><div className="text-center"><Spinner/><p className="text-sm text-foreground/55">{t('app.opening.your.workspace')}</p>{notice && <p className="mt-3 text-destructive">{notice.text}</p>}</div></div>;
  if (!bootstrap.user) return <>
    <AuthScreen mode={bootstrap.mode} onAuth={refresh} notify={notify}/>
    {notice && <div role="alert" className={cn('fixed bottom-5 right-5 z-50 max-w-sm rounded-xl px-5 py-3 text-sm font-medium text-white shadow-xl', notice.error ? 'bg-destructive' : 'bg-foreground')}>{notice.text}</div>}
  </>;
  const user = bootstrap.user;
  const active = views.find(v => v.key === view && !(v.coachOnly && user.role === 'CLIENT') && !(v.clientOnly && user.role === 'COACH')) || views[0];
  const startTraining = (programId: string, dayIndex: number) => { setTrainingSelection({ programId, dayIndex }); navigate('training'); };
  const bodyView = active.key === 'overview' ? <Dashboard user={user} mode={bootstrap.mode} navigate={navigate}/> : active.key === 'clients' ? <Clients notify={notify}/> : active.key === 'programs' ? <Programs user={user} mode={bootstrap.mode} notify={notify} onStartTraining={startTraining}/> : active.key === 'training' ? <Training user={user} mode={bootstrap.mode} initialSelection={trainingSelection} notify={notify} onGoDashboard={() => navigate('overview')}/> : active.key === 'exercises' ? <Exercises mode={bootstrap.mode} notify={notify}/> : active.key === 'progress' ? <Progress user={user} mode={bootstrap.mode} notify={notify} onOpenTraining={() => navigate('training')}/> : active.key === 'messages' ? <Messages user={user} notify={notify}/> : <Account user={user} mode={bootstrap.mode} onSaved={refresh} notify={notify} dark={dark} setDark={setDark}/>;
  return <div className="min-h-screen lg:flex">
    {menuOpen && <button aria-label={t('app.close.navigation')} onClick={() => setMenuOpen(false)} className="fixed inset-0 z-30 bg-foreground/40 lg:hidden"/>}
    <aside className={cn('fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-card transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0', menuOpen ? 'translate-x-0' : '-translate-x-full')}>
      <div className="flex h-20 items-center justify-between border-b border-border px-6"><div className="flex items-center gap-3">{brand.logoUrl ? <img src={brand.logoUrl} alt="" className="h-10 w-10 rounded-xl object-contain"/> : <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">{brand.shortName}</div>}<div><div className="font-display text-sm font-bold leading-tight">{brand.name}</div><div className="text-[11px] text-foreground/45">{t('app.coach.workspace')}</div></div></div><button className="lg:hidden" onClick={() => setMenuOpen(false)} aria-label={t('app.close')}><X size={20}/></button></div>
      <div className="px-4 pt-7"><p className="px-3 text-[10px] font-bold uppercase tracking-[.18em] text-foreground/40">{t('app.workspace')}</p><nav className="mt-3 space-y-1">{views.filter(v => !(v.coachOnly && user.role === 'CLIENT') && !(v.clientOnly && user.role === 'COACH')).map(item => <button key={item.key} onClick={() => navigate(item.key)} className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors', active.key === item.key ? 'bg-primary/10 text-primary' : 'text-foreground/65 hover:bg-muted hover:text-foreground')}><item.icon size={18} strokeWidth={1.9}/>{t(item.labelKey)}{active.key === item.key && <ChevronRight size={14} className="ml-auto"/>}</button>)}</nav></div>
      <div className="mt-auto space-y-4 p-4"><div className="rounded-xl bg-muted p-4"><CircleHelp size={18} className="text-primary"/><p className="mt-2 text-xs font-semibold">{t('app.need.a.hand')}</p><a href={`mailto:${brand.supportEmail}`} className="mt-1 inline-block text-xs text-primary underline">{t('app.contact.support')}</a></div><button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground/60 hover:bg-muted"><LogOut size={17}/> {t('app.sign.out')}</button></div>
    </aside>
    <div className="min-w-0 flex-1"><header className="flex h-20 items-center justify-between border-b border-border bg-card/70 px-5 backdrop-blur lg:px-10"><div className="flex items-center gap-4"><button className="lg:hidden" onClick={() => setMenuOpen(true)} aria-label={t('app.open.navigation')}><Menu size={22}/></button><div><p className="text-xs text-foreground/45">{brand.organization} / {t(active.labelKey)}</p><h1 className="font-display text-lg font-semibold">{t(active.labelKey)}</h1></div></div><div className="flex items-center gap-3">{bootstrap.mode === 'demo' && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">{t('app.demo.data')}</span>}<button onClick={() => setDark(!dark)} aria-label={dark ? t('app.use.light.theme') : t('app.use.dark.theme')} className="rounded-lg p-2 hover:bg-muted">{dark ? <Sun size={18}/> : <Moon size={18}/>}</button>
      <div ref={accountMenuRef} className="relative">
        <button ref={accountButtonRef} type="button" onClick={() => setAccountMenuOpen(open => !open)} aria-label={t('app.account.menu.for', { name: user.name })} aria-expanded={accountMenuOpen} aria-controls="account-options" className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary hover:bg-primary/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{user.name.split(' ').map(s => s[0]).join('').slice(0,2)}</button>
        {accountMenuOpen && <div id="account-options" aria-label={t('app.account.options')} className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-border bg-card p-2 text-foreground shadow-lg"><div className="border-b border-border px-3 py-2"><p className="truncate text-sm font-semibold">{user.name}</p><p className="truncate text-xs text-foreground/55">{user.email}</p></div><button type="button" onClick={() => navigate('account')} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"><Settings size={16}/> {t('app.account.settings')}</button><button type="button" onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"><LogOut size={16}/> {t('app.sign.out')}</button></div>}
      </div></div></header>
      {bootstrap.mode === 'live' && !bootstrap.workoutConfigured && <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900 lg:px-10">{t('app.workout.api.configuration.missing')}</div>}
      <main className="mx-auto max-w-[1320px] px-5 py-8 lg:px-10 lg:py-10">{bodyView}</main>
    </div>
    {notice && <div role="alert" className={cn('fixed bottom-5 right-5 z-50 max-w-sm rounded-xl px-5 py-3 text-sm font-medium text-white shadow-xl', notice.error ? 'bg-destructive' : 'bg-foreground')}>{notice.text}</div>}
  </div>;
}
