import { useEffect, useRef, useState } from 'react';
import type { StrategyData, StrategyRepository, StrategySnapshot } from '../types/strategy';
import { AccessDeniedError, RevisionConflictError } from '../utils/supabase';
import { parseStrategy } from '../utils/strategy';

export function useStrategyBoard(repository: StrategyRepository, onAccessLost: () => void) {
  const [snapshot, setSnapshot] = useState<StrategySnapshot | null>(null);
  const current = useRef<StrategySnapshot | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const writing = useRef(false), hold = useRef(false), generation = useRef(0), alive = useRef(false);
  const replace = (value: StrategySnapshot) => { current.current = value; setSnapshot(value); };
  const refresh = async (signal?: AbortSignal) => {
    if (writing.current || hold.current) return;
    const ticket = generation.current;
    try {
      const next = await repository.load(signal);
      if (!alive.current || signal?.aborted || writing.current || hold.current || ticket !== generation.current) return;
      if (!current.current || next.revision > current.current.revision) replace(next);
      setCheckedAt(Date.now());
    } catch (e) {
      if (!alive.current || signal?.aborted || ticket !== generation.current) return;
      if (e instanceof AccessDeniedError) onAccessLost();
      else setError(e instanceof Error ? e.message : 'Nie udało się wczytać strategii.');
    }
  };
  useEffect(() => {
    alive.current = true;
    const abort = new AbortController();
    void refresh(abort.signal);
    const interval = setInterval(() => { void refresh(abort.signal); }, 10000);
    const unsubscribe = repository.subscribe?.(() => { void refresh(abort.signal); });
    const focus = () => { void refresh(abort.signal); };
    const unload = (e: BeforeUnloadEvent) => { if (writing.current) e.preventDefault(); };
    window.addEventListener('focus', focus); window.addEventListener('beforeunload', unload);
    return () => { alive.current = false; ++generation.current; abort.abort(); clearInterval(interval); unsubscribe?.(); window.removeEventListener('focus', focus); window.removeEventListener('beforeunload', unload); };
  }, [repository]);

  const commit = async (change: (data: StrategyData) => StrategyData): Promise<boolean> => {
    if (!current.current || writing.current || !alive.current) return false;
    writing.current = true; ++generation.current; setBusy(true); setError('');
    let base = current.current;
    try {
      // Rebase operations on fresh data. Edits compare the original card;
      // unrelated edits and relative drags can safely survive a CAS conflict.
      for (let attempt = 0; attempt < 3; attempt++) {
        const next = parseStrategy(change(base.data));
        replace({ ...base, data: next });
        try {
          const saved = await repository.save(next, base.revision);
          if (!alive.current) return false;
          replace(saved); setCheckedAt(Date.now()); return true;
        } catch (e) {
          if (!(e instanceof RevisionConflictError)) throw e;
          base = await repository.load();
          if (!alive.current) return false;
          replace(base);
        }
      }
      throw new Error('Tablica jest teraz intensywnie edytowana. Zmiana nie została zapisana; ponów ją za chwilę.');
    } catch (e) {
      if (!alive.current) return false;
      replace(base); setError(e instanceof Error ? e.message : 'Nie zapisano zmiany.');
      if (e instanceof AccessDeniedError) onAccessLost();
      return false;
    } finally { writing.current = false; ++generation.current; if (alive.current) setBusy(false); }
  };
  return { snapshot, busy, error, setError, checkedAt, commit, refresh, hold };
}
