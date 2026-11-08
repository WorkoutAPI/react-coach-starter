import { useState, type ReactNode } from 'react';
import { cn } from './ui';
import { demoExerciseImage } from '../lib/demoExerciseImage';

export function ExerciseThumbnail({ code, mode, className, imageClassName, fallback }: { code: string; mode: 'demo' | 'live'; className?: string; imageClassName?: string; fallback: ReactNode }) {
  const [failedCode, setFailedCode] = useState<string | null>(null);
  const image = mode === 'demo' ? demoExerciseImage(code) : `/api/exercises/${encodeURIComponent(code)}/image`;
  return <span className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-primary', className)}>
    {image && failedCode !== code ? <img src={image} alt="" loading="lazy" decoding="async" className={cn('h-full w-full', imageClassName || (mode === 'demo' ? 'object-contain' : 'object-cover'))} onError={() => setFailedCode(code)}/> : fallback}
  </span>;
}
