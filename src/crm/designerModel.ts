import type { CrmData, CrmRecord } from './types';
export interface DesignerFilters { query: string; category: string; strategy: string; city: string; owner: string; tag?: string }
export const defaultDesignerTags: Record<string, string> = { Automatyka: '#2563eb', KNX: '#7c3aed', 'Historia zakupu': '#16806a' };
export const visibleDesignerTags = (data: CrmData) => (data.tags || []).filter(tag => !tag.startsWith('knx:') && !tag.startsWith('Import bazy '));
export const designerTagColor = (data: CrmData, tag: string) => {
  const color = data.tagColors?.[tag] || defaultDesignerTags[tag];
  return /^#[0-9a-f]{6}$/i.test(color || '') ? color : '#64748b';
};
export const retainedTagColors = (data: CrmData, tags: string[]) => Object.fromEntries(Object.entries(data.tagColors || {}).filter(([tag]) => tags.includes(tag)));
export const normalizeDesignerText = (text: string) => text.toLocaleLowerCase('pl-PL').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');
export function designerNotes(records: CrmRecord[]) {
  const notes = new Map<string, CrmRecord[]>();
  for (const record of records) {
    if (record.kind !== 'activity' || !record.parentId) continue;
    const items = notes.get(record.parentId) || [];
    items.push(record); notes.set(record.parentId, items);
  }
  for (const items of notes.values()) items.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  return notes;
}
export function filterDesigners(records: CrmRecord[], filters: DesignerFilters, notes: Map<string, CrmRecord[]>): CrmRecord[] {
  const query = normalizeDesignerText(filters.query.trim());
  return records.filter(r => r.kind === 'designer')
    .filter(r => !filters.category || r.data.categoryId === filters.category)
    .filter(r => !filters.strategy || (filters.strategy === '_none' ? !r.data.strategyId : r.data.strategyId === filters.strategy))
    .filter(r => !filters.city || r.data.city === filters.city)
    .filter(r => !filters.owner || r.ownerId === filters.owner)
    .filter(r => !filters.tag || r.data.tags?.includes(filters.tag))
    .filter(r => !query || normalizeDesignerText([r.data.title, r.data.studio, r.data.city, r.data.email, r.data.phone, r.data.specialization, r.data.notes, ...(r.data.tags || []), ...(notes.get(r.id) || []).map(n => n.data.notes || n.data.title)].filter(Boolean).join(' ')).includes(query))
    .sort((a, b) => a.data.title.localeCompare(b.data.title, 'pl') || a.id.localeCompare(b.id));
}
