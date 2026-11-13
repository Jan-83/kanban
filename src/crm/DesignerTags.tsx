import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Check, Plus, X } from 'lucide-react';
import type { CrmData, CrmRecord } from './types';
import { defaultDesignerTags, designerTagColor, retainedTagColors, visibleDesignerTags } from './designerModel';

interface Props {
  record: CrmRecord; records: CrmRecord[]; busy: boolean;
  onSave: (record: CrmRecord, data: Partial<CrmData>) => Promise<void>;
}
export function DesignerTags({ record, records, busy, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  return <div className="designer-tags-cell">
    <div className="designer-tags">{visibleDesignerTags(record.data).map(tag => <button key={tag} type="button" className="designer-tag" style={{ '--tag-color': designerTagColor(record.data, tag) } as CSSProperties} disabled={busy} onClick={() => setEditing(true)} aria-label={'Edytuj tag ' + tag + ': ' + record.data.title}><i />{tag}</button>)}</div>
    <button type="button" className="crm-text-btn" disabled={busy} onClick={() => setEditing(true)} aria-label={'Dodaj tag: ' + record.data.title}><Plus size={13} />Dodaj tag</button>
    {editing && <TagEditor record={record} records={records} onSave={onSave} onClose={() => setEditing(false)} />}
  </div>;
}
function TagEditor({ record, records, onSave, onClose }: Omit<Props, 'busy'> & { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tags, setTags] = useState(record.data.tags || []);
  const [colors, setColors] = useState(record.data.tagColors || {});
  const [name, setName] = useState(''); const [color, setColor] = useState('#2563eb');
  const [busy, setBusy] = useState(false); const [dirty, setDirty] = useState(false); const [error, setError] = useState('');
  const suggestions = [...new Set([...Object.keys(defaultDesignerTags), ...records.filter(r => r.kind === 'designer').flatMap(r => visibleDesignerTags(r.data))])].sort((a, b) => a.localeCompare(b, 'pl'));
  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close(); }, []);
  useEffect(() => { const warn = (e: BeforeUnloadEvent) => { if (dirty || busy || name) e.preventDefault(); }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty, busy, name]);
  const close = () => { if (!busy && (!(dirty || name.trim()) || window.confirm('Odrzucić niezapisane tagi?'))) onClose(); };
  const chooseName = (value: string) => {
    setName(value);
    const existing = records.find(r => r.kind === 'designer' && r.data.tags?.includes(value));
    setColor(colors[value] || (existing ? designerTagColor(existing.data, value) : defaultDesignerTags[value]) || '#2563eb');
  };
  return <dialog ref={dialog} className="crm-dialog designer-tags-dialog" aria-labelledby="designer-tags-title" onCancel={e => { e.preventDefault(); close(); }}>
    <form onSubmit={async e => {
      e.preventDefault(); if (busy) return;
      const pending = name.trim();
      if (pending.startsWith('knx:') || pending.startsWith('Import bazy ')) { setError('Wybierz inną nazwę tagu.'); return; }
      const existing = tags.find(t => t.toLocaleLowerCase('pl') === pending.toLocaleLowerCase('pl'));
      const chosen = existing || pending;
      const nextTags = pending && !existing ? [...tags, pending] : tags;
      if (nextTags.length > 20) { setError('Jeden projektant może mieć najwyżej 20 tagów.'); return; }
      const nextColors = retainedTagColors({ title: '', tagColors: { ...colors, ...(pending ? { [chosen]: color } : {}) } }, nextTags);
      setBusy(true); setError('');
      try { await onSave(record, { tags: nextTags, tagColors: nextColors }); onClose(); }
      catch (e) { setError(e instanceof Error ? e.message : 'Nie zapisano tagów.'); }
      finally { setBusy(false); }
    }}>
      <header><div><span className="crm-kicker">KOLOROWE TAGI</span><h2 id="designer-tags-title">{record.data.title}</h2></div><button type="button" className="crm-icon" aria-label="Zamknij tagi" onClick={close} disabled={busy}><X size={20} /></button></header>
      <fieldset disabled={busy} className="designer-tags-editor">
        <p>Oznacz doświadczenie pracowni lub dodaj własną etykietę.</p>
        {visibleDesignerTags({ title: '', tags }).map(tag => <div className="designer-tag-edit" key={tag}><input type="color" aria-label={'Kolor tagu ' + tag} value={designerTagColor({ title: '', tagColors: colors }, tag)} onChange={e => { setColors({ ...colors, [tag]: e.target.value }); setDirty(true); }} /><span>{tag}</span><button type="button" className="crm-icon" aria-label={'Usuń tag ' + tag} onClick={() => { setTags(tags.filter(t => t !== tag)); setDirty(true); }}><X size={15} /></button></div>)}
        <label className="crm-field">Nazwa nowego tagu<input autoFocus list={'designer-tag-names-' + record.id} value={name} maxLength={60} onChange={e => chooseName(e.target.value)} placeholder="Np. Automatyka, KNX, Historia zakupu" /></label>
        <datalist id={'designer-tag-names-' + record.id}>{suggestions.map(tag => <option value={tag} key={tag} />)}</datalist>
        <label className="designer-new-tag-color">Kolor nowego tagu<input type="color" value={color} aria-label="Kolor nowego tagu" onChange={e => setColor(e.target.value)} /></label>
      </fieldset>
      {error && <p role="alert" className="crm-form-error">{error}</p>}
      <footer><button type="button" className="crm-btn" onClick={close} disabled={busy}>Anuluj</button><button className="crm-btn crm-primary" disabled={busy}><Check size={15} />{busy ? 'Zapisywanie…' : 'Zapisz tagi'}</button></footer>
    </form>
  </dialog>;
}
