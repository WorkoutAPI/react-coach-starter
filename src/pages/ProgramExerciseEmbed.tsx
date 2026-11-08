import { useEffect, useState } from 'react';
import { Dumbbell, Maximize2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { demoExerciseImage } from '../lib/demoExerciseImage';
import { Button, Dialog, DialogContent } from '../components/ui';

export function ProgramExerciseEmbed({ programId, dayIndex, exerciseIndex, code, name, mode }: {
  programId: string;
  dayIndex: number;
  exerciseIndex: number;
  code: string;
  name: string;
  mode: 'demo' | 'live';
}) {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [failedImageCode, setFailedImageCode] = useState<string | null>(null);
  useEffect(() => {
    if (mode === 'demo') return;
    const controller = new AbortController();
    api<{ url: string }>(`/programs/${encodeURIComponent(programId)}/exercises/${dayIndex}/${exerciseIndex}/embed`, { signal: controller.signal })
      .then(result => { setUrl(result.url); setError(''); })
      .catch(cause => { if (!controller.signal.aborted) setError((cause as Error).message); });
    return () => controller.abort();
  }, [programId, dayIndex, exerciseIndex, mode, retry]);

  const demoImage = demoExerciseImage(code);
  if (mode === 'demo' && (!demoImage || failedImageCode === code)) return <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl bg-primary/10 px-5 text-center text-primary"><Dumbbell size={56}/><p className="text-sm text-foreground/60">{t('programs.embed.demo.unavailable')}</p></div>;
  if (mode === 'live' && error) return <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl bg-muted px-5 text-center"><p role="alert" className="text-sm text-destructive">{error}</p><Button type="button" variant="outline" onClick={() => { setError(''); setRetry(value => value + 1); }}>{t('programs.embed.retry')}</Button></div>;
  if (mode === 'live' && !url) return <div role="status" className="flex h-64 items-center justify-center rounded-xl bg-muted text-sm text-foreground/60">{t('programs.embed.loading')}</div>;

  const frame = (large: boolean) => mode === 'demo'
    ? <img src={demoImage!} alt={t('programs.embed.title', { name })} onError={() => setFailedImageCode(code)} className={`w-full rounded-xl border border-border bg-primary/10 object-contain ${large ? 'h-full' : 'h-[420px]'}`}/>
    : <iframe src={url} title={t('programs.embed.title', { name })} allow="autoplay; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" className={`w-full rounded-xl border border-border bg-card ${large ? 'h-full' : 'h-[420px]'}`}/>;
  return <>
    <div className="relative"><div className="absolute right-3 top-3 z-10"><Button type="button" size="sm" variant="outline" onClick={() => setZoomed(true)} aria-label={t('programs.embed.enlarge')}><Maximize2 size={16}/>{t('programs.embed.enlarge')}</Button></div>{!zoomed && frame(false)}{zoomed && <div className="h-[420px] rounded-xl bg-muted"/>}</div>
    <Dialog open={zoomed} onOpenChange={setZoomed}><DialogContent title={t('programs.embed.title', { name })} wide><div className="h-[70vh]">{zoomed && frame(true)}</div></DialogContent></Dialog>
  </>;
}
