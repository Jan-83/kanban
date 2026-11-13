import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { designerNotes, filterDesigners, designerTagColor, retainedTagColors, visibleDesignerTags } from '../src/crm/designerModel.ts';
import { JSDOM } from 'jsdom';
import type { CrmRecord, CrmSnapshot } from '../src/crm/types.ts';
const record = (id: string, data: CrmRecord['data'], rest: Partial<CrmRecord> = {}): CrmRecord => ({ id, kind: 'designer', ownerId: 'member', parentId: null, visibility: 'team', accessIds: [], revision: 1, createdBy: 'member', createdAt: '2026-11-13T10:00:00Z', updatedAt: '2026-11-13T10:00:00Z', data, ...rest });
const filters = { query: '', category: '', strategy: '', city: '', owner: '' };
test('designer search combines accent-insensitive notes with category, strategy and owner filters', () => {
  const records = [record('a', { title: 'Łucja', categoryId: 'new', strategyId: 'showroom', city: 'Łódź' }), record('b', { title: 'Bartosz', categoryId: 'partner', city: 'Łódź' }), record('note', { title: 'Rozmowa', notes: 'Światło w dużej kuchni' }, { kind: 'activity', parentId: 'a' })];
  assert.deepEqual(filterDesigners(records, { ...filters, query: 'swiatlo', category: 'new', strategy: 'showroom', owner: 'member' }, designerNotes(records)).map(r => r.id), ['a']);
  assert.deepEqual(filterDesigners(records, { ...filters, strategy: '_none' }, designerNotes(records)).map(r => r.id), ['b']);
  assert.deepEqual(filterDesigners(records, { ...filters, query: 'lucja', city: 'Warszawa' }, designerNotes(records)), []);
});
test('latest note is kept per designer and unrelated notes do not appear', () => {
  const records = [record('old', { title: 'Old' }, { kind: 'activity', parentId: 'a', createdAt: '2026-11-12T10:00:00Z' }), record('new', { title: 'New' }, { kind: 'activity', parentId: 'a' }), record('other', { title: 'Other' }, { kind: 'activity', parentId: 'b' }), record('task', { title: 'Not a note' }, { kind: 'followup', parentId: 'a' })];
  const notes = designerNotes(records);
  assert.deepEqual(notes.get('a')?.map(r => r.id), ['new', 'old']);
  assert.deepEqual(notes.get('b')?.map(r => r.id), ['other']);
});
test('designer list escapes client names and notes, identifies colors with text and has no board switch', async () => {
  const dom = new JSDOM('');
  Object.defineProperty(globalThis, 'window', { value: dom.window, configurable: true });
  const { DesignerBoard } = await import('../src/crm/DesignerBoard.tsx');
  const malicious = '<script>alert("contact")</script>';
  const records = [record('a', { title: malicious, studio: 'Studio <img src=x onerror=alert(1)>', categoryId: 'new', notes: malicious })];
  const snapshot: CrmSnapshot = { records, role: 'member', serverTime: '2026-11-13T10:00:00Z', notifications: [], members: [{ id: 'member', name: 'Test', role: 'member' }], settings: { revision: 0, data: { sources: [], categories: [], stages: [], designerCategories: [{ id: 'new', title: 'Do poznania', color: '#123456' }], designerStrategies: [] } } };
  const html = renderToStaticMarkup(createElement(DesignerBoard, { snapshot, userId: 'member', busy: false, onOpen: () => {}, onNew: () => {}, onChange: async () => {}, onSaveTags: async () => {}, onSaveNote: async () => {}, onRefresh: async () => {} }));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('Lista projektantów'));
  assert.ok(html.includes('Do poznania'));
  assert.ok(html.includes('Dodaj tag'));
  assert.ok(!html.includes('Widok kart projektantów'));
  assert.ok(!html.includes('Statusy i strategie'));
  dom.window.close();
  Reflect.deleteProperty(globalThis, 'window');
});
test('tag filters use assigned tags and color edits retain other tags and import identifiers', () => {
  const data = { title: 'Studio', tags: ['KNX', 'Historia zakupu', 'knx:K001', 'Import bazy 13.11.2026'], tagColors: { KNX: '#112233', 'Historia zakupu': '#16806a' } };
  const records = [record('a', data), record('b', { title: 'KNX only mentioned in a note', categoryId: 'new' })];
  assert.deepEqual(filterDesigners(records, { ...filters, tag: 'KNX' }, designerNotes(records)).map(r => r.id), ['a']);
  assert.deepEqual(visibleDesignerTags(data), ['KNX', 'Historia zakupu']);
  assert.deepEqual(retainedTagColors(data, ['Historia zakupu', 'knx:K001']), { 'Historia zakupu': '#16806a' });
  assert.equal(designerTagColor(data, 'KNX'), '#112233');
  assert.equal(designerTagColor({ title: '', tagColors: { KNX: 'url(https://example.test)' } }, 'KNX'), '#64748b');
});

test('designer list shows three newest notes with their authors and keeps the contact summary available', async () => {
  const dom = new JSDOM('');
  Object.defineProperty(globalThis, 'window', { value: dom.window, configurable: true });
  try {
    const { DesignerBoard } = await import('../src/crm/DesignerBoard.tsx');
    const records = [record('studio', { title: 'Studio', notes: 'Zakupy łącznie netto: 100,00 PLN' }),
      record('old', { title: 'Stara', notes: 'Czwarty wpis poza zajawkami' }, { kind: 'activity', parentId: 'studio', createdAt: '2026-11-10T10:00:00Z' }),
      record('third', { title: 'Trzecia', notes: 'Uzgodniony zakres' }, { kind: 'activity', parentId: 'studio', createdBy: 'inactive', createdAt: '2026-11-11T10:00:00Z' }),
      record('new', { title: 'Najnowsza', notes: 'Termin spotkania <script>alert(1)</script>' }, { kind: 'activity', parentId: 'studio', createdBy: 'author' }),
      record('second', { title: 'Druga', notes: 'Wysłane materiały' }, { kind: 'activity', parentId: 'studio', createdAt: '2026-11-12T10:00:00Z' })];
    const snapshot: CrmSnapshot = { records, role: 'member', serverTime: '2026-11-13T10:00:00Z', notifications: [], members: [{ id: 'member', name: 'Jan Opiekun', role: 'member' }, { id: 'author', name: 'Anna Autorka', role: 'member' }], settings: { revision: 0, data: { sources: [], categories: [], stages: [], designerCategories: [{ id: 'new', title: 'Nowe biuro', color: '#123456' }], designerStrategies: [] } } };
    dom.window.document.body.innerHTML = renderToStaticMarkup(createElement(DesignerBoard, { snapshot, userId: 'member', busy: false, onOpen: () => {}, onNew: () => {}, onChange: async () => {}, onSaveTags: async () => {}, onSaveNote: async () => {}, onRefresh: async () => {} }));
    const document = dom.window.document;
    const previews = [...document.querySelectorAll('.designer-note-snippet')];
    assert.equal(previews.length, 3);
    assert.deepEqual(previews.map(el => el.querySelector('.designer-note-excerpt')?.textContent), ['Termin spotkania <script>alert(1)</script>', 'Wysłane materiały', 'Uzgodniony zakres']);
    assert.deepEqual(previews.map(el => el.querySelector('[role="img"]')?.getAttribute('aria-label')), ['Autor: Anna Autorka', 'Autor: Jan Opiekun', 'Autor: Nieaktywny autor']);
    assert.equal(document.querySelectorAll('script').length, 0);
    assert.ok(document.querySelector('details')?.textContent?.includes('Zakupy łącznie netto: 100,00 PLN'));
    assert.equal(document.querySelector('details')?.hasAttribute('open'), false);
  } finally {
    dom.window.close();
    Reflect.deleteProperty(globalThis, 'window');
  }
});
