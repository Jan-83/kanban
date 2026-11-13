import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Plus, Trash2, X } from 'lucide-react';
import type { CrmSettings, CrmSnapshot } from './types';
import { crmApi } from './api';

export function DesignerOptionsFields({ data, onChange, snapshot }: { data: CrmSettings; onChange: (data: CrmSettings) => void; snapshot: CrmSnapshot }) {
  const used = (field: 'categoryId' | 'strategyId', id: string) => snapshot.records.some(r => r.kind === 'designer' && r.data[field] === id);
  const move = (key: 'designerCategories' | 'designerStrategies', index: number, direction: number) => {
    const items = [...data[key]]; [items[index], items[index + direction]] = [items[index + direction], items[index]];
    onChange({ ...data, [key]: items });
  };
  return <div className="designer-options">
    <section><div className="crm-section-title"><div><h3>Statusy współpracy</h3><p>Status opisuje relację z pracownią. Tagi na liście oznaczają jej doświadczenie.</p></div><button type="button" className="crm-btn" disabled={data.designerCategories.length >= 16} onClick={() => onChange({ ...data, designerCategories: [...data.designerCategories, { id: 'cat_' + crypto.randomUUID().slice(0, 8), title: '', color: '#7464dd' }] })}><Plus size={15} />Dodaj kategorię</button></div>
      {data.designerCategories.map((category, i) => <div className="designer-category-edit" key={category.id}>
        <input type="color" aria-label={'Kolor kategorii ' + (i + 1)} value={category.color} onChange={e => onChange({ ...data, designerCategories: data.designerCategories.map(c => c.id === category.id ? { ...c, color: e.target.value } : c) })} />
        <input aria-label={'Nazwa kategorii ' + (i + 1)} placeholder="Nazwa kategorii" value={category.title} maxLength={60} required onChange={e => onChange({ ...data, designerCategories: data.designerCategories.map(c => c.id === category.id ? { ...c, title: e.target.value } : c) })} />
        <button type="button" className="crm-icon" disabled={i === 0} aria-label={'Przesuń kategorię w górę: ' + category.title} onClick={() => move('designerCategories', i, -1)}><ArrowUp size={15} /></button><button type="button" className="crm-icon" disabled={i === data.designerCategories.length - 1} aria-label={'Przesuń kategorię w dół: ' + category.title} onClick={() => move('designerCategories', i, 1)}><ArrowDown size={15} /></button>
        <button type="button" className="crm-icon" disabled={data.designerCategories.length === 1 || used('categoryId', category.id)} title={used('categoryId', category.id) ? 'Najpierw przenieś projektantów z tej kategorii.' : 'Usuń kategorię'} aria-label={'Usuń kategorię: ' + category.title} onClick={() => onChange({ ...data, designerCategories: data.designerCategories.filter(c => c.id !== category.id) })}><Trash2 size={15} /></button>
      </div>)}
    </section>
    <section><div className="crm-section-title"><div><h3>Strategie współpracy</h3><p>Jedna aktywna strategia dla projektanta. Opis podpowiada następny krok.</p></div><button type="button" className="crm-btn" disabled={data.designerStrategies.length >= 40} onClick={() => onChange({ ...data, designerStrategies: [...data.designerStrategies, { id: 'strategy_' + crypto.randomUUID().slice(0, 8), title: '', description: '' }] })}><Plus size={15} />Dodaj strategię</button></div>
      {data.designerStrategies.map((strategy, i) => <div className="designer-strategy-edit" key={strategy.id}><div>
        <input aria-label={'Nazwa strategii ' + (i + 1)} placeholder="Nazwa strategii" value={strategy.title} required maxLength={80} onChange={e => onChange({ ...data, designerStrategies: data.designerStrategies.map(s => s.id === strategy.id ? { ...s, title: e.target.value } : s) })} />
        <button type="button" className="crm-icon" disabled={i === 0} aria-label={'Przesuń strategię w górę: ' + strategy.title} onClick={() => move('designerStrategies', i, -1)}><ArrowUp size={15} /></button><button type="button" className="crm-icon" disabled={i === data.designerStrategies.length - 1} aria-label={'Przesuń strategię w dół: ' + strategy.title} onClick={() => move('designerStrategies', i, 1)}><ArrowDown size={15} /></button>
        <button type="button" className="crm-icon" disabled={used('strategyId', strategy.id)} title={used('strategyId', strategy.id) ? 'Najpierw zmień strategię u przypisanych projektantów.' : 'Usuń strategię'} aria-label={'Usuń strategię: ' + strategy.title} onClick={() => onChange({ ...data, designerStrategies: data.designerStrategies.filter(s => s.id !== strategy.id) })}><Trash2 size={15} /></button>
      </div><textarea aria-label={'Opis strategii ' + (i + 1)} placeholder="Jak działamy?" rows={2} maxLength={500} value={strategy.description || ''} onChange={e => onChange({ ...data, designerStrategies: data.designerStrategies.map(s => s.id === strategy.id ? { ...s, description: e.target.value } : s) })} /></div>)}
      {!data.designerStrategies.length && <p className="crm-help">Dodaj pierwszą strategię. Projektanci mogą też pozostać bez przypisanej strategii.</p>}
    </section>
  </div>;
}
export function DesignerOptions({ snapshot, onRefresh, onClose }: { snapshot: CrmSnapshot; onRefresh: () => Promise<void>; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null); const [data, setData] = useState(() => structuredClone(snapshot.settings.data));
  const [revision] = useState(snapshot.settings.revision); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [dirty, setDirty] = useState(false);
  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close(); }, []);
  useEffect(() => { const warn = (e: BeforeUnloadEvent) => { if (dirty || busy) e.preventDefault(); }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty, busy]);
  const close = () => { if (!busy && (!dirty || window.confirm('Odrzucić niezapisane zmiany kategorii i strategii?'))) onClose(); };
  return <dialog ref={dialog} className="crm-dialog designer-options-dialog" aria-labelledby="designer-options-title" onCancel={e => { e.preventDefault(); close(); }}><form onSubmit={async e => { e.preventDefault(); if (busy) return; setBusy(true); setError(''); try { await crmApi.settings(data, revision); await onRefresh(); onClose(); } catch (e) { setError(e instanceof Error ? e.message : 'Nie zapisano ustawień.'); } finally { setBusy(false); } }}>
    <header><div><span className="crm-kicker">LISTA PROJEKTANTÓW</span><h2 id="designer-options-title">Statusy i strategie</h2></div><button type="button" className="crm-icon" onClick={close} disabled={busy} aria-label="Zamknij ustawienia projektantów"><X size={20} /></button></header>
    <fieldset disabled={busy}><DesignerOptionsFields snapshot={snapshot} data={data} onChange={next => { setData(next); setDirty(true); }} /></fieldset>
    {error && <p role="alert" className="crm-form-error">{error}</p>}<footer><span>Zmiany obowiązują cały zespół.</span><button className="crm-btn crm-primary" disabled={busy}><Check size={16} />{busy ? 'Zapisywanie…' : 'Zapisz kolory i strategie'}</button></footer>
  </form></dialog>;
}
