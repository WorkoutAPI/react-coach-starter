import i18n from '../i18n';
export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, { credentials: 'same-origin', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new ApiError(i18n.t('api.invalid.response'), response.status); }
  if (!response.ok) throw new ApiError((payload as { error?: string }).error || i18n.t('api.request.failed'), response.status);
  return payload as T;
}
export const body = (value: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(value) });
export const put = (value: unknown): RequestInit => ({ method: 'PUT', body: JSON.stringify(value) });
