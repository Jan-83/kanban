import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanData, descendants, salesStats } from '../src/crm/model.ts';
import type { CrmRecord, CrmSettings } from '../src/crm/types.ts';
const settings: CrmSettings = { sources: [], categories: [], stages: [
  { id: 'new', title: 'Nowe', color: '#000000', probability: 30, outcome: 'open' },
  { id: 'won', title: 'Wygrane', color: '#000000', probability: 100, outcome: 'won' },
  { id: 'lost', title: 'Przegrane', color: '#000000', probability: 0, outcome: 'lost' },
] };
const record = (id: string, currency: string, cents: number, stageId: string, parentId: string | null = null): CrmRecord => ({ id, kind: 'deal', parentId, ownerId: 'test', visibility: 'team', accessIds: [], revision: 1, createdAt: '2026-01-01', updatedAt: '2026-01-01', data: { title: id, currency, valueCents: cents, stageId } });
test('sales totals never mix currencies and forecast rounds in minor units', () => {
  const results = salesStats([record('open', 'PLN', 10001, 'new'), record('foreign', 'EUR', 500000, 'new'), record('won', 'PLN', 30000, 'won'), record('lost', 'PLN', 70000, 'lost')], settings, 'PLN');
  assert.equal(results.pipeline, 10001); assert.equal(results.weighted, 3000); assert.equal(results.revenue, 30000); assert.equal(results.conversion, 50); assert.equal(results.deals.length, 3);
});
test('empty sales pipeline does not invent a conversion rate', () => {
  assert.equal(salesStats([], settings, 'PLN').conversion, null);
});
test('linked client timeline includes nested project records without unrelated records', () => {
  const records = [record('project', 'PLN', 0, 'new', 'client'), record('offer', 'PLN', 0, 'new', 'project'), record('note', 'PLN', 0, 'new', 'offer'), record('unrelated', 'PLN', 0, 'new', 'other')];
  assert.deepEqual(descendants(records, 'client').map(r=>r.id), ['project', 'offer', 'note']);
});
test('edit payload preserves customer notes but omits server managed offer and task identity', () => {
  assert.deepEqual(cleanData({ title: 'Offer', notes: 'Private', version: 2, seriesId: 'x', sentAt: 'date', kanbanTaskId: 'task', valueCents: 120 }), { title: 'Offer', notes: 'Private', valueCents: 120 });
});
