import { useEffect, useRef, useState } from 'react';
import { Copy, LoaderCircle, X } from 'lucide-react';
import type { StrategyData } from '../types/strategy';
import { descendantIds } from '../utils/strategy';
import { copyStrategyImages, createStrategyCopyPlan, type StrategyCopyPlan } from '../utils/strategyCopy';
import { useTaskImages } from './TaskImageContext';

interface Props {
  data: StrategyData;
  sourceId: string;
  error: string;
  onCopy: (plan: StrategyCopyPlan) => Promise<boolean>;
  onClose: () => void;
}

export function StrategyCopyDialog({ data, sourceId, error, onCopy, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null), plan = useRef<StrategyCopyPlan | null>(null);
  const running = useRef(false);
  const [withChildren, setWithChildren] = useState(false), [keepParents, setKeepParents] = useState(false);
  const [busy, setBusy] = useState(false), [localError, setLocalError] = useState(''), [progress, setProgress] = useState('');
  const images = useTaskImages();
  const source = data.cards.find(c => c.task.id === sourceId);
  const count = descendantIds(data, sourceId).size;
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    const protect = (e: BeforeUnloadEvent) => { if (running.current) e.preventDefault(); };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, []);
  const copy = async () => {
    if (running.current) return;
    running.current = true; setBusy(true); setLocalError('');
    try {
      plan.current ??= createStrategyCopyPlan(data, sourceId, { descendants: withChildren, keepParents });
      await copyStrategyImages(plan.current, images, (done, total) => setProgress(total ? `Zdjęcia: ${done}/${total}` : ''));
      setProgress('Zapisywanie kopii…');
      if (await onCopy(plan.current)) onClose();
    } catch (e) { setLocalError(e instanceof Error ? e.message : 'Nie udało się skopiować karty.'); }
    finally { running.current = false; setBusy(false); setProgress(''); }
  };
  return <dialog ref={dialog} className="task-dialog strategy-copy-dialog" aria-labelledby="strategy-copy-title" onCancel={e => { e.preventDefault(); if (!running.current) onClose(); }}>
    <div className="dialog-heading"><div><p className="eyebrow">TABLICA STRATEGICZNA</p><h2 id="strategy-copy-title">Kopiuj kartę</h2></div><button className="icon-button" aria-label="Zamknij kopiowanie" disabled={busy} onClick={onClose}><X size={20} /></button></div>
    <form onSubmit={e => { e.preventDefault(); void copy(); }} className="form-stack">
      <p className="strategy-copy-source">{source?.task.title ?? 'Karta została usunięta'}</p>
      <p className="strategy-copy-help">Kopia zachowa opis, zdjęcia, kolor, osoby, terminy, status, kroki i komentarze. Jej treść będzie niezależna od oryginału.</p>
      <fieldset disabled={busy || !!plan.current} className="strategy-copy-options">
        <label><input type="checkbox" checked={withChildren} onChange={e => setWithChildren(e.target.checked)} disabled={!count} />Skopiuj również podkarty ({count})</label>
        <label><input type="checkbox" checked={keepParents} onChange={e => setKeepParents(e.target.checked)} disabled={!source?.parentIds.length} />Zachowaj połączenia nadrzędne kopiowanej karty</label>
      </fieldset>
      <p className="strategy-copy-help">{withChildren ? 'Połączenia wewnątrz gałęzi zostaną odtworzone. Wspólne podkarty skopiujemy po jednym razie.' : 'Powstanie jedna karta, bez jej podkart.'} {!keepParents && 'Kopia będzie kartą główną, gotową do podpięcia w nowym miejscu.'}</p>
      {(localError || error) && <p role="alert" className="notice error">{localError || error}</p>}
      <div className="dialog-actions"><span className="spacer" /><button type="button" className="button" disabled={busy} onClick={onClose}>Anuluj</button><button type="submit" className="button primary" disabled={busy || (!source && !plan.current)}>{busy ? <LoaderCircle size={15} className="spin" /> : <Copy size={15} />}{busy ? progress || 'Kopiowanie…' : plan.current ? 'Ponów kopiowanie' : withChildren ? 'Kopiuj z podkartami' : 'Utwórz kopię'}</button></div>
    </form>
  </dialog>;
}
