import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dumbbell } from 'lucide-react';
import { api } from '../lib/api';
import { demoExerciseImage } from '../lib/demoExerciseImage';
import { Button } from '../components/ui';

export function TrainingExerciseEmbed({ sessionId, exerciseIndex, name }: { sessionId: string; exerciseIndex: number; name: string }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api<{ url: string }>(`/training-sessions/${encodeURIComponent(sessionId)}/exercises/${exerciseIndex}/embed`, { signal: controller.signal })
      .then(result => { setUrl(result.url); setError(''); })
      .catch(cause => { if (!controller.signal.aborted) setError((cause as Error).message); });
    return () => controller.abort();
  }, [sessionId, exerciseIndex, retry]);

  if (error) return <div className="flex h-[70vh] flex-col items-center justify-center gap-3 rounded-xl bg-muted px-5 text-center"><p role="alert" className="text-sm text-destructive">{error}</p><Button type="button" variant="outline" onClick={() => { setError(''); setRetry(value => value + 1); }}>{t('programs.embed.retry')}</Button></div>;
  if (!url) return <div role="status" className="flex h-[70vh] items-center justify-center rounded-xl bg-muted text-sm text-foreground/60">{t('programs.embed.loading')}</div>;
  return <iframe src={url} title={t('programs.embed.title', { name })} allow="autoplay; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" className="h-[70vh] w-full rounded-xl border border-border bg-card"/>;
}

export function DemoTrainingExercisePreview({ code, name }: { code: string; name: string }) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const image = demoExerciseImage(code);
  if (!image || failed) return <div className="flex h-[70vh] flex-col items-center justify-center gap-3 rounded-xl bg-primary/10 px-5 text-center text-primary"><Dumbbell size={56}/><p className="text-sm text-foreground/60">{t('programs.embed.demo.unavailable')}</p></div>;
  return <img src={image} alt={t('programs.embed.title', { name })} onError={() => setFailed(true)} className="h-[70vh] w-full rounded-xl border border-border bg-primary/10 object-contain"/>;
}
