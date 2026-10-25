import type { StrategyData, StrategyRepository, StrategySnapshot } from '../types/strategy';
import { AccessDeniedError, boardId, RevisionConflictError, supabase } from './supabase';
import { createStrategySeed, parseStrategy } from './strategy';

function failure(error: { code?: string } | null) {
  if (error?.code === '42501') throw new AccessDeniedError('Brak dostępu do tablicy strategicznej.');
  if (error) throw new Error('Nie udało się zapisać lub wczytać tablicy strategicznej. Sprawdź połączenie.');
}
export const strategyRepository: StrategyRepository = {
  async load(signal) {
    if (!supabase) throw new AccessDeniedError('Brak dostępu.');
    const request = supabase.from('kanban_strategy_boards').select('data,revision').eq('board_id', boardId);
    const { data, error } = await (signal ? request.abortSignal(signal) : request).maybeSingle();
    failure(error);
    if (data) return { data: parseStrategy(data.data), revision: Number(data.revision) };
    if (signal?.aborted) throw new Error('Anulowano pobieranie.');
    const membership = await supabase.from('kanban_boards').select('id').eq('id', boardId).maybeSingle();
    failure(membership.error);
    if (!membership.data) throw new AccessDeniedError('Dostęp do projektu został cofnięty.');
    const seed = createStrategySeed();
    const created = await supabase.from('kanban_strategy_boards').insert({ board_id: boardId, data: seed, revision: 0 }).select('data,revision').single();
    // Another authorized teammate may initialize it at the same moment.
    if (created.error?.code === '23505') return strategyRepository.load(signal);
    failure(created.error);
    if (!created.data) throw new Error('Nie potwierdzono utworzenia tablicy.');
    return { data: parseStrategy(created.data.data), revision: Number(created.data.revision) };
  },
  async save(data: StrategyData, revision: number): Promise<StrategySnapshot> {
    if (!supabase) throw new AccessDeniedError('Brak dostępu.');
    const clean = parseStrategy(data);
    const result = await supabase.from('kanban_strategy_boards').update({ data: clean, revision: revision + 1 }).eq('board_id', boardId).eq('revision', revision).select('data,revision').maybeSingle();
    failure(result.error);
    if (!result.data) throw new RevisionConflictError('Tablica została zmieniona przez drugą osobę.');
    return { data: parseStrategy(result.data.data), revision: Number(result.data.revision) };
  },
  subscribe(onChange) {
    if (!supabase) return () => {};
    const channel = supabase.channel('strategy-' + crypto.randomUUID()).on('postgres_changes', { event: '*', schema: 'public', table: 'kanban_strategy_boards', filter: 'board_id=eq.' + boardId }, onChange).subscribe();
    return () => { void supabase?.removeChannel(channel); };
  },
};
