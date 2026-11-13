import type { CrmData, CrmInput, CrmKind, CrmRecord, CrmSettings } from './types';
export const kindLabels: Record<CrmKind, string> = { designer: 'Projektant', company: 'Firma', contact: 'Kontakt', project: 'Inwestycja', deal: 'Szansa sprzedaży', activity: 'Aktywność', followup: 'Zadanie', event: 'Wydarzenie', offer: 'Oferta', service: 'Obsługa', rule: 'Automatyzacja' };
export const kindAccusative: Record<CrmKind, string> = { designer: 'projektanta', company: 'firmę', contact: 'kontakt', project: 'inwestycję', deal: 'szansę sprzedaży', activity: 'aktywność', followup: 'zadanie', event: 'wydarzenie', offer: 'ofertę', service: 'zgłoszenie', rule: 'regułę' };
export const labels: Record<string, string> = {
  planning: 'Planowanie', design: 'Projektowanie', construction: 'Budowa', installation: 'Montaż', commissioning: 'Uruchomienie', complete: 'Zakończona',
  open: 'Do zrobienia', done: 'Zrobione', new: 'Nowe', in_progress: 'W realizacji', waiting: 'Oczekuje', closed: 'Zamknięte',
  draft: 'Szkic', sent: 'Wysłana', accepted: 'Przyjęta', rejected: 'Odrzucona', expired: 'Wygasła',
  low: 'Niski', medium: 'Normalny', high: 'Wysoki', urgent: 'Pilny', note: 'Notatka', call: 'Telefon', email: 'E-mail', meeting: 'Spotkanie', task: 'Zadanie',
  visit: 'Wizja lokalna', presentation: 'Prezentacja', deadline: 'Termin oferty', ticket: 'Zgłoszenie', warranty: 'Gwarancja', inspection: 'Przegląd', expansion: 'Rozbudowa',
  offer_sent: 'Po wysłaniu oferty', stage_changed: 'Po zmianie etapu', inactive: 'Brak kontaktu', followup: 'Utwórz zadanie', notice: 'Powiadom opiekuna',
};
export const money = (cents = 0, currency = 'PLN') => new Intl.NumberFormat('pl-PL', { style: 'currency', currency, maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
export const dateText = (value?: string, time = false) => value ? new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', ...(time ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(new Date(value.includes('T') || value.includes(' ') ? value.replace(' ', 'T') + (value.includes('T') ? '' : 'Z') : value + 'T12:00:00')) : 'Bez terminu';
export const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase();
export const due = (record: CrmRecord) => record.data.dueAt || record.data.startsAt || record.data.expectedDate || record.data.dueDate || record.data.validUntil || record.data.nextInspectionDate;
export const overdue = (record: CrmRecord, now = Date.now()) => !!due(record) && new Date(due(record)!).getTime() < now && !['done', 'closed', 'complete', 'accepted', 'rejected'].includes(record.data.status ?? '');
export const cleanData = (data: CrmData): CrmData => { const { version, seriesId, sentAt, kanbanTaskId, ...editable } = data; return editable; };
export const inputOf = (record: CrmRecord): CrmInput => ({ kind: record.kind, parentId: record.parentId, ownerId: record.ownerId, visibility: record.visibility, accessIds: record.accessIds, revision: record.revision, data: cleanData(record.data) });
export function defaultData(kind: CrmKind, settings: CrmSettings, userId: string): CrmData {
  const now = new Date(); now.setSeconds(0, 0);
  const stamp = (d: Date) => d.toISOString().replace('.000Z', '+00:00');
  const values: Partial<Record<CrmKind, Partial<CrmData>>> = {
    designer: { categoryId: settings.designerCategories[0].id },
    project: { status: 'planning', currency: 'PLN', systems: [], relationships: [] }, deal: { stageId: settings.stages[0].id, currency: 'PLN' },
    activity: { type: 'note', occurredAt: stamp(now) }, followup: { type: 'call', status: 'open', priority: 'medium', assigneeId: userId, reminderMinutes: 30 },
    event: { type: 'meeting', startsAt: stamp(now), endsAt: stamp(new Date(+now + 3600000)), assigneeId: userId, reminderMinutes: 30 },
    offer: { status: 'draft', currency: 'PLN' }, service: { type: 'ticket', status: 'new', priority: 'medium', assigneeId: userId },
    rule: { enabled: true, trigger: 'offer_sent', days: 14, delayDays: 3, action: 'followup', taskType: 'call' },
  };
  return { title: '', notes: '', tags: [], ...values[kind] };
}
export function salesStats(records: CrmRecord[], settings: CrmSettings, currency: string) {
  const deals = records.filter(r => r.kind === 'deal' && (r.data.currency || 'PLN') === currency);
  const stageOf = (r: CrmRecord) => settings.stages.find(s => s.id === r.data.stageId);
  const open = deals.filter(r => stageOf(r)?.outcome === 'open');
  const won = deals.filter(r => stageOf(r)?.outcome === 'won');
  const closed = deals.filter(r => ['won', 'lost'].includes(stageOf(r)?.outcome ?? ''));
  return { deals, open, won, pipeline: open.reduce((sum, r) => sum + (r.data.valueCents || 0), 0),
    weighted: open.reduce((sum, r) => sum + Math.round((r.data.valueCents || 0) * (stageOf(r)?.probability || 0) / 100), 0),
    revenue: won.reduce((sum, r) => sum + (r.data.valueCents || 0), 0), conversion: closed.length ? Math.round(won.length / closed.length * 100) : null };
}
export function descendants(records: CrmRecord[], id: string): CrmRecord[] {
  const ids = new Set([id]);
  for (let i = 0; i < 12; i++) { let added = false; records.forEach(r => { if (r.parentId && ids.has(r.parentId) && !ids.has(r.id)) { ids.add(r.id); added = true; } }); if (!added) break; }
  return records.filter(r => r.id !== id && ids.has(r.id));
}

export function hasRestrictedScope(record: CrmRecord, records: CrmRecord[]): boolean {
  let cursor: CrmRecord | undefined = record;
  for (let depth = 0; cursor && depth < 12; depth++) {
    if (cursor.visibility === 'restricted') return true;
    cursor = records.find(r => r.id === cursor?.parentId);
  }
  return false;
}
