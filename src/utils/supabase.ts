import { createClient } from '@supabase/supabase-js';
import type { BoardData, BoardSnapshot, BoardUser } from '../types/kanban';
import { parseBoard } from './board';
import publicConfig from '../config.public.json';
import { AUTH_OPTIONS } from './authStorage';

const url = import.meta.env.VITE_SUPABASE_URL ?? publicConfig.supabaseUrl;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? publicConfig.publishableKey;
export const passwordLink = /(?:[?#&])type=(invite|recovery)(?:&|$)/.test(location.hash + location.search);
export const boardId = import.meta.env.VITE_KANBAN_BOARD_ID ?? publicConfig.boardId;
export const authConfigured = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)
  && key.startsWith('sb_publishable_')
  && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(boardId);

// Only a publishable key belongs in static assets. Roles come from protected
// membership rows; Postgres RLS checks every request independently of this UI.
export const supabase = authConfigured ? createClient(url, key, {
  auth: { ...AUTH_OPTIONS, storage: window.sessionStorage },
  global: { fetch: (input, init) => fetch(input, init) },
}) : null;

export class AccessDeniedError extends Error {}
export class RevisionConflictError extends Error {}

export async function verifiedUser(): Promise<BoardUser | null> {
  if (!supabase) return null;
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: membership, error: memberError } = await supabase.from('kanban_members')
    .select('role,display_name').eq('board_id', boardId).eq('user_id', user.id).maybeSingle();
  if (memberError) throw new Error('Nie udało się sprawdzić dostępu. Spróbuj ponownie.');
  if (!membership) throw new AccessDeniedError('To konto nie ma dostępu do projektu. Skontaktuj się z administratorem.');
  return { id: user.id, name: membership.display_name, email: user.email ?? '', role: membership.role };
}

export async function loadBoard(signal?: AbortSignal): Promise<BoardSnapshot> {
  if (!supabase) throw new AccessDeniedError('Logowanie nie jest skonfigurowane.');
  const request = supabase.from('kanban_boards').select('data,revision').eq('id', boardId);
  const { data, error } = await (signal ? request.abortSignal(signal) : request).maybeSingle();
  if (error) throw new Error('Nie udało się pobrać tablicy. Sprawdź połączenie i spróbuj ponownie.');
  if (!data) throw new AccessDeniedError('Brak dostępu do tablicy.');
  return { data: parseBoard(data.data), revision: data.revision };
}

export async function saveBoard(data: BoardData, revision: number): Promise<BoardSnapshot> {
  if (!supabase) throw new AccessDeniedError('Brak dostępu do tablicy.');
  // The RPC validates membership and uses a revision compare-and-swap in one
  // database transaction. A stale client cannot overwrite a teammate's work.
  const clean = parseBoard(data);
  const { data: result, error } = await supabase.rpc('save_kanban_board', { target_board: boardId, expected_revision: revision, new_data: clean });
  if (error?.code === '40001') throw new RevisionConflictError('Ktoś zmienił tablicę. Wczytaj aktualną wersję i ponów zmianę.');
  if (error?.code === '42501') throw new AccessDeniedError('Dostęp do tablicy został cofnięty.');
  if (error) throw new Error('Nie zapisano zmiany. Sprawdź połączenie i spróbuj ponownie.');
  if (!Number.isSafeInteger(Number(result)) || Number(result) <= revision) throw new Error('Serwer nie potwierdził zapisu. Odśwież tablicę.');
  return { data: clean, revision: Number(result) };
}
