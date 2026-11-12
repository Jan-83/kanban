import type { BoardData, BoardSnapshot, BoardUser } from '../types/kanban';
import { parseBoard } from './board';

export class AccessDeniedError extends Error {}
export class RevisionConflictError extends Error {}
export const boardId = 'b9e5466d-b243-4660-b8a3-25271eadbed5';
export interface SessionState { state: 'anonymous' | 'setup' | 'challenge' | 'authenticated'; csrf: string; user?: BoardUser; resetEnabled: boolean; }
let csrf = '';
let lastInteraction = Date.now();
for (const event of ['pointerdown', 'keydown', 'touchstart']) {
  window.addEventListener(event, () => { lastInteraction = Date.now(); }, { passive: true });
}
export async function session(): Promise<SessionState> {
  const response = await fetch('/api/session', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Nie udało się sprawdzić dostępu. Spróbuj ponownie.');
  const state = await response.json() as SessionState;
  csrf = state.csrf;
  return state;
}
export async function api<T>(path: string, options: { method?: string; data?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const method = options.method ?? 'GET';
  if (method !== 'GET' && !csrf) await session();
  const multipart = options.data instanceof FormData;
  const response = await fetch('/api' + path, {
    method, signal: options.signal, credentials: 'same-origin', cache: 'no-store',
    headers: { Accept: 'application/json', ...(method !== 'GET' ? { 'X-CSRF-TOKEN': csrf } : {}), ...(Date.now() - lastInteraction < 60000 ? { 'X-User-Active': '1' } : {}), ...(!multipart && options.data !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: options.data === undefined ? undefined : multipart ? options.data as FormData : JSON.stringify(options.data),
  });
  const result = await response.json().catch(() => ({}));
  if (result.csrf) csrf = result.csrf;
  if (response.status === 409) throw new RevisionConflictError('Ktoś zmienił tablicę. Wczytaj aktualną wersję i ponów zmianę.');
  if (response.status === 401 || response.status === 403) throw new AccessDeniedError(result.message ?? 'Sesja wygasła lub nie masz dostępu. Zaloguj się ponownie.');
  if (response.status === 419) { csrf = ''; throw new Error('Sesja formularza wygasła. Ponów czynność.'); }
  if (response.status === 429) throw new Error('Zbyt wiele prób. Odczekaj kilka minut i spróbuj ponownie.');
  if (!response.ok) throw new Error(result.message ?? 'Nie udało się wykonać operacji. Spróbuj ponownie.');
  return result as T;
}
export async function loadBoard(signal?: AbortSignal): Promise<BoardSnapshot> {
  const value = await api<BoardSnapshot>('/boards/' + boardId + '/kanban', { signal });
  return { data: parseBoard(value.data), revision: value.revision };
}
export async function saveBoard(data: BoardData, revision: number): Promise<BoardSnapshot> {
  const value = await api<BoardSnapshot>('/boards/' + boardId + '/kanban', { method: 'PUT', data: { data: parseBoard(data), revision } });
  return { data: parseBoard(value.data), revision: value.revision };
}
