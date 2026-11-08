export type View = 'overview' | 'clients' | 'programs' | 'training' | 'exercises' | 'progress' | 'messages' | 'account';

export const viewPaths: Record<View, string> = {
  overview: '/',
  clients: '/clients',
  programs: '/programs',
  training: '/training',
  exercises: '/exercises',
  progress: '/progress',
  messages: '/messages',
  account: '/settings'
};

export function viewFromLocation(pathname: string, hash = ''): View {
  const path = pathname.replace(/\/+$/, '') || '/';
  const legacy = hash.slice(1) as View;
  if (path === '/' && legacy in viewPaths) return legacy;
  return (Object.keys(viewPaths) as View[]).find(view => viewPaths[view] === path) || 'overview';
}
