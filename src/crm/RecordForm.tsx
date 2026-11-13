import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, LockKeyhole, Plus, Trash2, X } from 'lucide-react';
import type { BoardUser } from '../types/kanban';
import type { CrmData, CrmInput, CrmKind, CrmRecord, CrmSettings, CrmSnapshot, Relationship } from './types';
import { cleanData, defaultData, kindLabels, kindAccusative, labels } from './model';

type Field = { key: keyof CrmData; label: string; type?: 'text' | 'email' | 'url' | 'date' | 'datetime-local' | 'number' | 'money' | 'list'; options?: [string, string][]; required?: boolean; hint?: string };
const options = (values: string[]) => values.map(value => [value, labels[value] || value] as [string, string]);
const status = (values: string[]): Field => ({ key: 'status', label: 'Status', options: options(values), required: true });
const moneyFields: Field[] = [{ key: 'valueCents', label: 'Wartość netto', type: 'money' }, { key: 'currency', label: 'Waluta', options: options(['PLN', 'EUR', 'USD']), required: true }];
export function fields(kind: CrmKind, settings: CrmSettings, members: CrmSnapshot['members']): Field[] {
  const source: Field = { key: 'source', label: 'Źródło kontaktu', options: options(settings.sources) };
  const category: Field = { key: 'category', label: 'Kategoria', options: options(settings.categories) };
  const assign: Field = { key: 'assigneeId', label: 'Osoba odpowiedzialna', options: members.map(m => [m.id, m.name]) };
  const priority: Field = { key: 'priority', label: 'Priorytet', options: options(['low', 'medium', 'high', 'urgent']), required: true };
  const reminder: Field = { key: 'reminderMinutes', label: 'Przypomnienie przed terminem', options: [['0', 'W chwili terminu'], ['15', '15 minut'], ['30', '30 minut'], ['60', 'Godzinę'], ['1440', 'Dzień']] };
  const type = (values: string[]): Field => ({ key: 'type', label: 'Rodzaj', options: options(values), required: true });
  switch (kind) {
    case 'designer': return [{ key: 'studio', label: 'Pracownia / firma' }, { key: 'categoryId', label: 'Kategoria kolorystyczna', options: settings.designerCategories.map(c => [c.id, c.title]), required: true }, { key: 'strategyId', label: 'Strategia współpracy', options: settings.designerStrategies.map(s => [s.id, s.title]) }, { key: 'email', label: 'E-mail', type: 'email' }, { key: 'phone', label: 'Telefon' }, { key: 'city', label: 'Miasto' }, { key: 'address', label: 'Adres' }, { key: 'website', label: 'Strona internetowa', type: 'url' }, { key: 'specialization', label: 'Specjalizacja' }, source];
    case 'company': return [category, { key: 'nip', label: 'NIP' }, { key: 'email', label: 'E-mail', type: 'email' }, { key: 'phone', label: 'Telefon' }, { key: 'address', label: 'Adres' }, { key: 'city', label: 'Miasto' }, { key: 'website', label: 'Strona internetowa', type: 'url' }, { key: 'industry', label: 'Branża' }, source];
    case 'contact': return [category, { key: 'jobTitle', label: 'Stanowisko / rola' }, { key: 'email', label: 'E-mail', type: 'email' }, { key: 'phone', label: 'Telefon' }, source];
    case 'project': return [{ key: 'type', label: 'Typ obiektu', options: options(['Dom', 'Apartament', 'Biuro', 'Hotel', 'Obiekt komercyjny', 'Inny']) }, status(['planning', 'design', 'construction', 'installation', 'commissioning', 'complete']), { key: 'address', label: 'Adres inwestycji' }, { key: 'city', label: 'Miasto' }, ...moneyFields, { key: 'area', label: 'Powierzchnia (m²)', type: 'number' }, { key: 'systems', label: 'Systemy', type: 'list', hint: 'Np. KNX, JUNG HOME, AV — oddziel przecinkami.' }, { key: 'startDate', label: 'Początek', type: 'date' }, { key: 'dueDate', label: 'Planowane zakończenie', type: 'date' }];
    case 'deal': return [{ key: 'stageId', label: 'Etap sprzedaży', options: settings.stages.map(s => [s.id, s.title]), required: true }, ...moneyFields, { key: 'expectedDate', label: 'Planowana decyzja', type: 'date' }, source, { key: 'lostReason', label: 'Powód przegranej / rezygnacji' }];
    case 'activity': return [type(['note', 'call', 'meeting', 'email']), { key: 'occurredAt', label: 'Data kontaktu', type: 'datetime-local' }, { key: 'outlookUrl', label: 'Link do wiadomości w Outlooku', type: 'url', hint: 'Link otworzy wiadomość na Twoim koncie Microsoft. Treść maili nie jest pobierana automatycznie.' }];
    case 'followup': return [type(['call', 'email', 'meeting', 'task']), status(['open', 'done']), { key: 'dueAt', label: 'Termin', type: 'datetime-local' }, assign, priority, reminder];
    case 'event': return [type(['meeting', 'visit', 'presentation', 'deadline']), { key: 'startsAt', label: 'Początek', type: 'datetime-local', required: true }, { key: 'endsAt', label: 'Koniec', type: 'datetime-local', required: true }, { key: 'location', label: 'Miejsce / adres spotkania' }, { key: 'participants', label: 'Uczestnicy' }, assign, reminder];
    case 'offer': return [{ key: 'number', label: 'Numer oferty', required: true }, status(['draft', 'sent', 'accepted', 'rejected', 'expired']), ...moneyFields, { key: 'validUntil', label: 'Ważna do', type: 'date' }];
    case 'service': return [type(['ticket', 'warranty', 'inspection', 'expansion']), status(['new', 'in_progress', 'waiting', 'closed']), priority, assign, { key: 'dueAt', label: 'Termin realizacji', type: 'datetime-local' }, { key: 'warrantyUntil', label: 'Gwarancja do', type: 'date' }, { key: 'nextInspectionDate', label: 'Następny przegląd', type: 'date' }, { key: 'resolution', label: 'Rozwiązanie zgłoszenia' }];
    case 'rule': return [{ key: 'trigger', label: 'Kiedy uruchomić', options: options(['offer_sent', 'stage_changed', 'inactive']), required: true }, { key: 'stageId', label: 'Etap wyzwalający regułę', options: settings.stages.map(s => [s.id, s.title]), hint: 'Dotyczy reguły po zmianie etapu.' }, { key: 'days', label: 'Dni bez kontaktu', type: 'number', required: true }, { key: 'action', label: 'Co zrobić', options: options(['followup', 'notice']), required: true }, { key: 'delayDays', label: 'Termin zadania za ile dni', type: 'number', required: true }, { key: 'taskType', label: 'Rodzaj nowego zadania', options: options(['call', 'email', 'meeting', 'task']), required: true }, assign];
  }
}
const toLocal = (value: string) => { if (!value) return ''; const d = new Date(value); return new Date(+d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
interface Props { kind: CrmKind; record?: CrmRecord; parentId?: string; day?: string; snapshot: CrmSnapshot; user: BoardUser; onSave: (data: CrmInput, id?: string) => Promise<void>; onClose: () => void }
export function RecordForm({ kind, record, parentId, day, snapshot, user, onSave, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const initial = useRef(record ? cleanData(record.data) : { ...defaultData(kind, snapshot.settings.data, user.id), ...(day && kind === 'event' ? { startsAt: new Date(day + 'T09:00:00').toISOString().replace('.000Z', '+00:00'), endsAt: new Date(day + 'T10:00:00').toISOString().replace('.000Z', '+00:00') } : {}) }).current;
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [dirty, setDirty] = useState(false);
  const [visibility, setVisibility] = useState(record?.visibility || 'team');
  const [access, setAccess] = useState(record?.accessIds || []);
  const [relationships, setRelationships] = useState<Relationship[]>(initial.relationships || []);
  const canManage = !record || snapshot.role === 'admin' || record.ownerId === user.id;
  const descriptors = fields(kind, snapshot.settings.data, snapshot.members);
  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close(); }, []);
  useEffect(() => { const warn = (e: BeforeUnloadEvent) => { if (dirty || busy) e.preventDefault(); }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty, busy]);
  const close = () => { if (!busy && (!dirty || window.confirm('Odrzucić niezapisane zmiany?'))) onClose(); };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (busy) return;
    const form = new FormData(event.currentTarget); const data: CrmData = { title: String(form.get('title')).trim(), notes: String(form.get('notes') || ''), tags: String(form.get('tags') || '').split(',').map(x => x.trim()).filter(Boolean) };
    for (const field of descriptors) {
      const raw = String(form.get(field.key) || '');
      if (raw === '') continue;
      const value = field.type === 'money' ? Math.round(Number(raw) * 100) : field.type === 'number' || field.key === 'reminderMinutes' ? Number(raw) : field.type === 'datetime-local' ? new Date(raw).toISOString().replace('.000Z', '+00:00') : field.type === 'list' ? raw.split(',').map(x => x.trim()).filter(Boolean) : raw;
      Object.assign(data, { [field.key]: value });
    }
    if (kind === 'project') data.relationships = relationships.filter(r => r.recordId && r.role.trim());
    if (kind === 'rule') data.enabled = form.get('enabled') === 'on';
    setBusy(true); setError('');
    try { await onSave({ kind, parentId: canManage ? String(form.get('parentId') || '') || null : record!.parentId, ownerId: snapshot.role === 'admin' ? String(form.get('ownerId')) : record?.ownerId || user.id, visibility, accessIds: access, revision: record?.revision || 0, data }, record?.id); }
    catch (e) { setError(e instanceof Error ? e.message : 'Nie zapisano zmian.'); }
    finally { setBusy(false); }
  };
  return <dialog className="crm-dialog crm-form-dialog" ref={dialog} onCancel={e => { e.preventDefault(); close(); }} aria-labelledby="crm-form-title">
    <form onSubmit={submit} onChange={() => setDirty(true)}>
      <div className="crm-dialog-head"><div><span className="crm-kicker">{record ? 'EDYCJA' : 'NOWY REKORD'}</span><h2 id="crm-form-title">{kindLabels[kind]}</h2></div><button type="button" className="crm-icon" onClick={close} disabled={busy} aria-label="Zamknij formularz"><X size={20} /></button></div>
      <fieldset disabled={busy} className="crm-form-body">
        <label className="crm-field crm-span">{kind === 'contact' ? 'Imię i nazwisko' : kind === 'company' ? 'Nazwa firmy / klienta' : 'Nazwa'}<input name="title" defaultValue={initial.title} required maxLength={200} autoFocus placeholder={kind === 'project' ? 'Np. Dom pod Warszawą — KNX' : undefined} /></label>
        <div className="crm-form-grid">{descriptors.map(field => {
          const original = initial[field.key];
          const value = field.type === 'money' ? original === undefined ? '' : Number(original) / 100 : field.type === 'datetime-local' ? toLocal(String(original || '')) : Array.isArray(original) ? original.join(', ') : original === undefined ? '' : String(original);
          return <label className="crm-field" key={field.key}>{field.label}{field.options ? <select name={field.key} defaultValue={value} required={field.required}><option value="">Wybierz…</option>{field.options.map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select> : <input name={field.key} type={field.type === 'money' ? 'number' : field.type === 'list' ? 'text' : field.type || 'text'} defaultValue={value} required={field.required} min={field.key === 'days' ? 1 : 0} max={field.type === 'money' ? 9999999999.99 : field.key === 'days' || field.key === 'delayDays' ? 365 : undefined} step={field.type === 'money' || field.key === 'area' ? '0.01' : '1'} maxLength={field.key === 'outlookUrl' ? 2000 : 300} />}{field.hint && <small>{field.hint}</small>}</label>;
        })}</div>
        {kind !== 'rule' && <label className="crm-field">Powiąż z klientem, inwestycją lub szansą<select name="parentId" defaultValue={record?.parentId || parentId || ''} disabled={!canManage}><option value="">Samodzielny rekord</option>{snapshot.records.filter(r => r.id !== record?.id && ['company', 'contact', 'designer', 'project', 'deal', 'offer', 'service'].includes(r.kind)).map(r => <option key={r.id} value={r.id}>{kindLabels[r.kind]} · {r.data.title}</option>)}</select><small>Rekord dziedziczy ograniczenia dostępu z tego powiązania.</small></label>}
        {kind === 'project' && <section className="crm-relations-form"><div className="crm-section-title"><h3>Uczestnicy inwestycji</h3><button type="button" className="crm-text-btn" onClick={() => { setDirty(true); setRelationships([...relationships, { recordId: '', role: 'Inwestor' }]); }}><Plus size={14} />Dodaj</button></div>{relationships.map((relation, i) => <div className="crm-relation-row" key={i}><select aria-label={'Uczestnik ' + (i + 1)} value={relation.recordId} onChange={e => setRelationships(relationships.map((r, j) => j === i ? { ...r, recordId: e.target.value } : r))}><option value="">Wybierz kontakt / firmę</option>{snapshot.records.filter(r => ['company', 'contact', 'designer'].includes(r.kind)).map(r => <option key={r.id} value={r.id}>{r.data.title}</option>)}</select><input aria-label={'Rola uczestnika ' + (i + 1)} value={relation.role} maxLength={80} onChange={e => setRelationships(relationships.map((r, j) => j === i ? { ...r, role: e.target.value } : r))} /><button type="button" className="crm-icon" aria-label="Usuń uczestnika" onClick={() => { setDirty(true); setRelationships(relationships.filter((_, j) => j !== i)); }}><Trash2 size={16} /></button></div>)}</section>}
        <label className="crm-field">{kind === 'activity' ? 'Treść / ustalenia' : 'Notatki'}<textarea name="notes" defaultValue={initial.notes} rows={4} maxLength={20000} placeholder="Ustalenia, potrzeby, następny krok…" /></label>
        <label className="crm-field">Tagi<input name="tags" defaultValue={initial.tags?.join(', ')} placeholder="Oddziel przecinkami" maxLength={1000} /></label>
        {kind === 'rule' && <label className="crm-check"><input type="checkbox" name="enabled" defaultChecked={initial.enabled} />Reguła włączona<small>Powiadomienia trafiają wyłącznie do CRM.</small></label>}
        <section className="crm-access"><div className="crm-section-title"><h3><LockKeyhole size={15} />Dostęp do danych</h3></div><div className="crm-form-grid"><label className="crm-field">Opiekun<select name="ownerId" defaultValue={record?.ownerId || user.id} disabled={snapshot.role !== 'admin'}>{snapshot.members.map(m => <option value={m.id} key={m.id}>{m.name}</option>)}</select></label><label className="crm-field">Widoczność<select value={visibility} disabled={!canManage} onChange={e => setVisibility(e.target.value as 'team' | 'restricted')}><option value="team">Zespół</option><option value="restricted">Wybrane osoby</option></select></label></div>{visibility === 'restricted' && <div className="crm-access-people">{snapshot.members.filter(m => m.id !== (record?.ownerId || user.id)).map(m => <label className="crm-check" key={m.id}><input type="checkbox" checked={access.includes(m.id)} disabled={!canManage} onChange={e => setAccess(e.target.checked ? [...access, m.id] : access.filter(id => id !== m.id))} />{m.name}</label>)}<small>Opiekun i administratorzy mają dostęp. Powiązany rekord może dodatkowo ograniczać widoczność.</small></div>}</section>
      </fieldset>
      {error && <div role="alert" className="crm-form-error">{error}<span>Twoje zmiany pozostają w formularzu.</span></div>}
      <footer className="crm-dialog-footer"><button type="button" className="crm-btn" onClick={close} disabled={busy}>Anuluj</button><button className="crm-btn crm-primary" disabled={busy}>{busy ? 'Zapisywanie…' : record ? <><Check size={16} />Zapisz zmiany</> : <>Utwórz {kindAccusative[kind]}<ArrowRight size={16} /></>}</button></footer>
    </form>
  </dialog>;
}
