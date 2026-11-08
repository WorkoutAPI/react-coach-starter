import { useTranslation } from 'react-i18next';
import { Select } from './ui';

export type GoalOption = { code: string; name: string };

export function goalLabel(value: string | null, goals: GoalOption[] | null) {
  return goals?.find(goal => goal.code === value)?.name || value;
}

export function GoalSelect({ id, value, goals, onChange, disabled = false }: { id: string; value: string; goals: GoalOption[] | null; onChange: (value: string) => void; disabled?: boolean }) {
  const { t } = useTranslation();
  const legacyValue = value && !goals?.some(goal => goal.code === value);
  return <Select id={id} value={value} onChange={event => onChange(event.target.value)} disabled={disabled || !goals}>
    <option value="">{t('goals.none')}</option>
    {legacyValue && <option value={value}>{value}</option>}
    {goals?.map(goal => <option key={goal.code} value={goal.code}>{goal.name}</option>)}
  </Select>;
}
