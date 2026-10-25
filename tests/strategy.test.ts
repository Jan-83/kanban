import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canParent, createStrategySeed, deleteStrategyCard, descendantIds, hiddenStrategyIds, layoutStrategy, moveStrategyCards, parseStrategy, setStrategyConnection, setStrategySubtaskCompleted, updateStrategyCard } from '../src/utils/strategy';

test('legacy boards upgrade without changing card contents, links or coordinates', () => {
  const seed = createStrategySeed();
  const legacy = { version: 1, cards: seed.cards.map(({ parentIds, ...card }) => ({ ...card, parentId: parentIds[0] ?? null })) };
  assert.deepEqual(parseStrategy(legacy), seed);
  assert.equal(legacy.version, 1);
  for (const bad of [null, undefined, {}, { ...legacy, cards: [null] }, { ...legacy, cards: [{ task: seed.cards[0].task, position: { x: 0, y: 0 } }] }]) assert.throws(() => parseStrategy(bad));
});

test('connections add instead of replacing, concurrent changes merge and unlink is precise', () => {
  const seed = createStrategySeed(), id = 'strategy-light';
  const original = structuredClone(seed.cards.find(c => c.task.id === id)!);
  let data = setStrategyConnection(seed, id, 'strategy-1-0', true);
  data = setStrategyConnection(data, id, 'strategy-2-0', true);
  assert.equal(data.cards.length, seed.cards.length);
  assert.deepEqual(data.cards.find(c => c.task.id === id)!.parentIds, ['strategy-0-2', 'strategy-1-0', 'strategy-2-0']);
  assert.equal(setStrategyConnection(data, id, 'strategy-1-0', true), data);
  assert.deepEqual(data.cards.map(c => c.task), seed.cards.map(c => c.task));
  const edited = updateStrategyCard(data, original, { ...original.task, title: 'Wspólne światło' }, ['strategy-3-0'], original.position);
  assert.deepEqual(edited.cards.find(c => c.task.id === id)!.parentIds, ['strategy-1-0', 'strategy-2-0', 'strategy-3-0']);
  data = setStrategyConnection(edited, id, 'strategy-2-0', false);
  assert.deepEqual(data.cards.find(c => c.task.id === id)!.parentIds, ['strategy-1-0', 'strategy-3-0']);
  assert.equal(setStrategyConnection(data, id, 'strategy-2-0', false), data);
  assert.throws(() => setStrategyConnection(data, 'strategy-1-0', 'strategy-return', true), /pętli/);
  assert.throws(() => setStrategyConnection(data, id, id, true), /pętli/);
  assert.throws(() => setStrategyConnection(data, 'missing', id, true), /usunięta/);
  assert.throws(() => parseStrategy({ ...data, cards: data.cards.map(c => c.task.id === id ? { ...c, parentIds: ['strategy-1-0', 'strategy-1-0'] } : c) }));
});

test('shared cards stay visible through open parents and move only once with a group', () => {
  const data = setStrategyConnection(createStrategySeed(), 'strategy-light', 'strategy-1-0', true);
  assert.equal(hiddenStrategyIds(data, new Set(['strategy-0-0'])).has('strategy-light'), false);
  assert.equal(hiddenStrategyIds(data, new Set(['strategy-0-0'])).has('strategy-return'), false);
  assert.equal(hiddenStrategyIds(data, new Set(['strategy-0-0', 'strategy-1-0'])).has('strategy-light'), true);
  assert.equal(hiddenStrategyIds(data, new Set(['strategy-light'])).has('strategy-light'), false);
  assert.equal(hiddenStrategyIds(data, new Set(['strategy-light'])).has('strategy-return'), true);
  const ids = ['strategy-0-0', 'strategy-1-0', ...descendantIds(data, 'strategy-0-0'), ...descendantIds(data, 'strategy-1-0')];
  const moved = moveStrategyCards(data, ids, { x: 73, y: -22 });
  const old = data.cards.find(c => c.task.id === 'strategy-light')!, shared = moved.cards.find(c => c.task.id === 'strategy-light')!;
  assert.deepEqual(shared.position, { x: old.position.x + 73, y: old.position.y - 22 });
  const arranged = layoutStrategy(data);
  assert.equal(new Set(arranged.cards.map(c => JSON.stringify(c.position))).size, data.cards.length);
  assert.deepEqual(arranged.cards.map(c => c.parentIds), data.cards.map(c => c.parentIds));
});

test('deleting a shared parent keeps children, remaining links and inherited parents', () => {
  let data = setStrategyConnection(createStrategySeed(), 'strategy-light', 'strategy-1-0', true);
  data = setStrategyConnection(data, 'strategy-return', 'strategy-1-0', true);
  const after = deleteStrategyCard(data, data.cards.find(c => c.task.id === 'strategy-light')!);
  assert.equal(after.cards.length, data.cards.length - 1);
  assert.deepEqual(after.cards.find(c => c.task.id === 'strategy-return')!.parentIds, ['strategy-1-0', 'strategy-0-2']);
  assert.deepEqual(parseStrategy(after), after);
});

test('checklist saves intent on latest card without undoing concurrent checks or other edits', () => {
  const initial = createStrategySeed();
  initial.cards[0].task.subtasks = [{ id: 'first', title: 'Światło', completed: false }, { id: 'second', title: 'Rolety', completed: false }];
  const theirs = setStrategySubtaskCompleted(initial, 'strategy-0-0', 'second', true);
  theirs.cards[0].task.title = 'Aktualny tytuł Darka';
  const ours = setStrategySubtaskCompleted(theirs, 'strategy-0-0', 'first', true);
  assert.ok(ours.cards[0].task.subtasks.every(s => s.completed));
  assert.equal(ours.cards[0].task.title, 'Aktualny tytuł Darka');
  assert.equal(setStrategySubtaskCompleted(ours, 'strategy-0-0', 'first', true), ours);
  assert.deepEqual(ours.cards.slice(1), initial.cards.slice(1));
  assert.deepEqual(ours.cards[0].position, initial.cards[0].position);
  assert.throws(() => setStrategySubtaskCompleted(ours, 'strategy-0-0', 'deleted', true), /usunięty/);
  assert.equal(setStrategySubtaskCompleted(ours, 'strategy-0-0', 'first', false).cards[0].task.subtasks[0].completed, false);
});

test('strategy starts with six real root cards and recursively editable children', () => {
  const data = parseStrategy(createStrategySeed());
  assert.equal(data.cards.length, 32);
  assert.deepEqual(data.cards.filter(c => !c.parentIds.length).map(c => c.task.title), ['Mieszkanie', 'Dom', 'Willa', 'Małe biuro', 'Mały budynek biurowy', 'Większe biuro']);
  assert.equal(descendantIds(data, 'strategy-0-0').size, 6);
  assert.deepEqual(parseStrategy(JSON.parse(JSON.stringify(data))), data);
});

test('deep nesting, colors and safe reparenting preserve other branches', () => {
  let data = createStrategySeed();
  const original = structuredClone(data.cards[0]);
  data = updateStrategyCard(data, original, { ...original.task, color: '#db2777' }, [], original.position, true);
  for (const id of descendantIds(data, original.task.id)) assert.equal(data.cards.find(c => c.task.id === id)!.task.color, '#db2777');
  assert.equal(data.cards.find(c => c.task.id === 'strategy-1-0')!.task.color, '#6366f1');
  let parent = 'strategy-return';
  for (let i = 0; i < 25; i++) { const id = 'deep-' + i; data = updateStrategyCard(data, null, { ...original.task, id, title: 'Deep ' + i }, [parent], { x: i, y: i }); parent = id; }
  assert.equal(canParent(data, 'strategy-0-0', parent), false);
  assert.throws(() => setStrategyConnection(data, 'strategy-0-0', parent, true), /pętli/);
  const changed = setStrategyConnection(data, parent, 'strategy-1-0', true);
  assert.deepEqual(changed.cards.find(c => c.task.id === parent)!.parentIds, ['deep-23', 'strategy-1-0']);
  assert.equal(parseStrategy(changed).cards.length, 57);
});

test('relative drag preserves concurrent edits, stale edit never overwrites a teammate', () => {
  const data = createStrategySeed(), original = structuredClone(data.cards[0]);
  const theirs = updateStrategyCard(data, original, { ...original.task, title: 'Nowy tytuł Dara' }, [], original.position);
  const moved = moveStrategyCards(theirs, [original.task.id, ...descendantIds(theirs, original.task.id)], { x: 47, y: -19 });
  assert.equal(moved.cards[0].task.title, 'Nowy tytuł Dara');
  assert.equal(moved.cards[0].position.x, original.position.x + 47);
  assert.throws(() => updateStrategyCard(theirs, original, { ...original.task, title: 'Stary zapis Janka' }, [], original.position), /drugą osobę/);
  const positionOnly = moveStrategyCards(data, [original.task.id], { x: 10, y: 10 });
  const editAfterMove = updateStrategyCard(positionOnly, original, { ...original.task, description: 'Nowy opis' }, [], original.position);
  assert.deepEqual(editAfterMove.cards[0].position, positionOnly.cards[0].position);
});

test('deleting a parent keeps children; invalid graphs cannot be persisted', () => {
  const data = createStrategySeed(), parent = data.cards.find(c => c.task.id === 'strategy-0-2')!;
  const after = deleteStrategyCard(data, parent);
  assert.equal(after.cards.length, 31);
  assert.deepEqual(after.cards.find(c => c.task.id === 'strategy-light')!.parentIds, ['strategy-0-0']);
  assert.deepEqual(after.cards.find(c => c.task.id === 'strategy-return')!.parentIds, ['strategy-light']);
  for (const mutate of [(d: any) => d.cards[0].parentIds = ['missing'], (d: any) => d.cards[0].parentIds = ['strategy-return'], (d: any) => d.cards[0].position.x = Infinity, (d: any) => d.cards.push(d.cards[0])]) {
    const bad = structuredClone(data); mutate(bad); assert.throws(() => parseStrategy(bad));
  }
  assert.deepEqual(layoutStrategy(data).cards.map(c => c.task), data.cards.map(c => c.task));
});
