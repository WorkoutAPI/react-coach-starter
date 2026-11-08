import type { ComponentProps } from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { Button, cn } from './ui';

// shadcn/ui Pagination composition adapted to this app's Button and client-side paging.
export function Pagination({ className, ...props }: ComponentProps<'nav'>) {
  return <nav role="navigation" className={cn('mx-auto flex w-full justify-center', className)} {...props}/>;
}

export function PaginationContent({ className, ...props }: ComponentProps<'ul'>) {
  return <ul className={cn('flex flex-row items-center gap-1', className)} {...props}/>;
}

export function PaginationItem(props: ComponentProps<'li'>) {
  return <li {...props}/>;
}

type PaginationLinkProps = ComponentProps<typeof Button> & { isActive?: boolean };
export function PaginationLink({ className, isActive, size = 'icon', variant, ...props }: PaginationLinkProps) {
  return <Button type="button" size={size} variant={variant || (isActive ? 'outline' : 'ghost')} aria-current={isActive ? 'page' : undefined} className={cn(isActive && 'border-primary/40 bg-primary/10 text-primary', className)} {...props}/>;
}

export function PaginationPrevious({ text, className, ...props }: Omit<PaginationLinkProps, 'children'> & { text: string }) {
  return <PaginationLink size="default" className={cn('px-2.5 sm:px-3', className)} {...props}><ChevronLeft size={16}/><span className="hidden sm:inline">{text}</span></PaginationLink>;
}

export function PaginationNext({ text, className, ...props }: Omit<PaginationLinkProps, 'children'> & { text: string }) {
  return <PaginationLink size="default" className={cn('px-2.5 sm:px-3', className)} {...props}><span className="hidden sm:inline">{text}</span><ChevronRight size={16}/></PaginationLink>;
}

export function PaginationEllipsis({ label }: { label: string }) {
  return <span className="flex h-10 w-10 items-center justify-center text-foreground/50"><MoreHorizontal size={17} aria-hidden="true"/><span className="sr-only">{label}</span></span>;
}

export function paginationSlots(page: number, total: number): (number | 'ellipsis')[] {
  const visible = [...new Set([1, total, page - 1, page, page + 1].filter(value => value >= 1 && value <= total))].sort((a, b) => a - b);
  const slots: (number | 'ellipsis')[] = [];
  for (const value of visible) {
    const previous = slots.at(-1);
    if (typeof previous === 'number' && value - previous === 2) slots.push(previous + 1);
    else if (typeof previous === 'number' && value - previous > 2) slots.push('ellipsis');
    slots.push(value);
  }
  return slots;
}
