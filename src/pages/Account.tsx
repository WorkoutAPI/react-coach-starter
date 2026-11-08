import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { api, put } from '../lib/api';
import type { User } from '../lib/types';
import { brand } from '../config/brand';
import { Badge, Button, Card, ConfirmDialog, Input, Label, Select } from '../components/ui';
import { GoalSelect, type GoalOption } from '../components/GoalSelect';
import { useResource } from '../lib/useResource';

export function Account({ user, mode, onSaved, notify, dark, setDark }: { user: User; mode: 'demo' | 'live'; onSaved: () => Promise<void>; notify: (text: string, error?: boolean) => void; dark: boolean; setDark: (value: boolean) => void }) {
  const { t } = useTranslation();
  const { data: goals, error: goalsError } = useResource<GoalOption[]>('/goals');
  const [name, setName] = useState(user.name); const [goal, setGoal] = useState(user.goal || ''); const [weightUnit, setWeightUnit] = useState(user.weightUnit); const [notifyMessages, setNotifyMessages] = useState(user.notifyMessages); const [notifyPrograms, setNotifyPrograms] = useState(user.notifyPrograms); const [busy, setBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState(''); const [newPassword, setNewPassword] = useState(''); const [deletePassword, setDeletePassword] = useState(''); const [deleteOpen, setDeleteOpen] = useState(false);
  const save = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); try { await api('/me', put({ name, goal, weightUnit, notifyMessages, notifyPrograms })); await onSaved(); notify(t('account.profile.saved')); } catch (e) { notify((e as Error).message, true); } finally { setBusy(false); } };
  const changePassword = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); try { await api('/me/password', put({ currentPassword, newPassword })); setCurrentPassword(''); setNewPassword(''); notify(t('account.password.changed')); } catch (e) { notify((e as Error).message, true); } finally { setBusy(false); } };
  const deleteAccount = async () => { setBusy(true); try { await api('/me', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: deletePassword }) }); setDeleteOpen(false); await onSaved(); notify(t('account.account.deleted')); } catch (e) { notify((e as Error).message, true); } finally { setBusy(false); } };
  return <div className="space-y-6">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">{t('account.your.workspace')}</p>
      <h2 className="mt-2 font-display text-3xl font-semibold">{t('account.account.settings')}</h2>
      <p className="mt-2 text-sm text-foreground/55">{t('account.keep.your.profile.and.workspace.preferences.current')}</p>
    </div>
    <div className="grid gap-5 xl:grid-cols-[1.4fr_.6fr]">
      <Card className="p-6 xl:col-start-1 xl:row-start-1">
        <h3 className="font-display text-lg font-semibold">{t('account.profile')}</h3>
        <form onSubmit={save} className="mt-6 space-y-4">
          <div><Label>{t('account.name')}</Label><Input value={name} onChange={e => setName(e.target.value)} required/></div>
          <div><Label>{t('account.email')}</Label><Input value={user.email} disabled/></div>
          <div><Label>{t('account.role')}</Label><Badge tone="accent">{user.role === 'COACH' ? t('account.role.coach') : t('account.role.client')}</Badge></div>
          <div><Label htmlFor="account-weight-unit">{t('account.weight.unit')}</Label><Select id="account-weight-unit" value={weightUnit} onChange={e => setWeightUnit(e.target.value as User['weightUnit'])}><option value="KG">{t('account.weight.unit.kg')}</option><option value="LB">{t('account.weight.unit.lb')}</option></Select><p className="mt-1 text-xs text-foreground/50">{t('account.weight.unit.help')}</p></div>
          {user.role === 'CLIENT' && <div><Label htmlFor="account-goal">{t('account.goal')}</Label><GoalSelect id="account-goal" value={goal} goals={goals} onChange={setGoal}/>{goalsError && <p role="alert" className="mt-1 text-xs text-destructive">{t('goals.unavailable')}</p>}</div>}
          <div className="border-t border-border pt-5"><h4 className="font-display font-semibold">{t('account.email.notifications')}</h4><p className="mt-1 text-sm text-foreground/55">{t('account.email.notifications.help')}</p></div>
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 accent-primary" checked={notifyMessages} onChange={e => setNotifyMessages(e.target.checked)}/><span><strong className="block">{t('account.notify.messages')}</strong><span className="text-foreground/55">{t('account.notify.messages.help')}</span></span></label>
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 accent-primary" checked={notifyPrograms} onChange={e => setNotifyPrograms(e.target.checked)}/><span><strong className="block">{t('account.notify.programs')}</strong><span className="text-foreground/55">{t('account.notify.programs.help')}</span></span></label>
          <Button disabled={busy}>{t('account.save.profile')}</Button>
        </form>
      </Card>
      {mode === 'live' && <Card className="p-6 xl:col-start-1 xl:row-start-2">
        <h3 className="font-display text-lg font-semibold">{t('account.change.password')}</h3>
        <form onSubmit={changePassword} className="mt-4 space-y-3">
          <div><Label>{t('account.current.password')}</Label><Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required/></div>
          <div><Label>{t('account.new.password')}</Label><Input type="password" minLength={10} value={newPassword} onChange={e => setNewPassword(e.target.value)} required/></div>
          <Button disabled={busy}>{t('account.update.password')}</Button>
        </form>
      </Card>}
      <div className="grid gap-5 xl:col-start-2 xl:row-start-1 xl:grid-rows-2">
        <Card className="p-6">
          <h3 className="font-display text-lg font-semibold">{t('account.appearance')}</h3>
          <p className="mt-2 text-sm text-foreground/55">{t('account.choose.a.comfortable.theme.for.your.workspace')}</p>
          <div className="mt-4 flex gap-2"><Button size="sm" variant={!dark ? 'default' : 'outline'} onClick={() => setDark(false)}>{t('account.light')}</Button><Button size="sm" variant={dark ? 'default' : 'outline'} onClick={() => setDark(true)}>{t('account.dark')}</Button></div>
        </Card>
        <Card className="p-6">
          <h3 className="font-display text-lg font-semibold">{t('account.support')}</h3>
          <p className="mt-2 text-sm text-foreground/55">{t('account.questions.about.brand', { brand: brand.name })}</p>
          <a className="mt-4 inline-block text-sm font-semibold text-primary underline" href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>
        </Card>
      </div>
      {mode === 'live' && <Card className="border-destructive/30 p-6 xl:col-start-2 xl:row-start-2">
        <h3 className="font-display text-lg font-semibold text-destructive">{t('account.delete.account')}</h3>
        <p className="mt-2 text-sm text-foreground/55">{t('account.permanently.removes.your.account.and.associated.data')}</p>
        <form onSubmit={event => { event.preventDefault(); setDeleteOpen(true); }} className="mt-4 space-y-3">
          <div><Label>{t('account.confirm.password')}</Label><Input type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} required/></div>
          <Button variant="destructive" disabled={busy}>{t('account.delete.account')}</Button>
        </form>
      </Card>}
    </div>
    <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title={t('account.delete.account')} description={t('account.permanently.delete.your.account.and.associated.data.this.cannot.be.undone')} confirmLabel={t('account.delete.account')} confirmVariant="destructive" busy={busy} onConfirm={() => void deleteAccount()}/>
  </div>;
}
