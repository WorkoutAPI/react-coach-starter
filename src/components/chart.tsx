import type { ReactNode } from 'react';
import { ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from './ui';

// Local shadcn-style chart primitives keep Recharts tied to the app theme.
export function ChartContainer({ children, label, className }: { children: ReactNode; label: string; className?: string }) {
  return <div role="img" aria-label={label} className={cn('h-60 w-full min-w-0 text-foreground/55', className)}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>;
}
export const ChartTooltip = Tooltip;
export const chartTooltipStyle = {
  borderRadius: 12,
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--card))',
  color: 'hsl(var(--foreground))',
  fontSize: 12
};
