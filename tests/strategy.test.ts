import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canParent, createStrategySeed, deleteStrategyCard, descendantIds, layoutStrategy, moveStrategyCards, parseStrategy, reparentStrategyCard, setStrategySubtaskCompleted, updateStrategyCard } from '../src/utils/strategy';

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
  assert.deepEqual(data.cards.filter(c => !c.parentId).map(c => c.task.title), ['Mieszkanie', 'Dom', 'Willa', 'Małe biuro', 'Mały budynek biurowy', 'Większe biuro']);
  assert.equal(descendantIds(data, 'strategy-0-0').size, 6);
  assert.deepEqual(parseStrategy(JSON.parse(JSON.stringify(data))), data);
});

test('deep nesting, colors and safe reparenting preserve other branches', () => {
  let data = createStrategySeed();
  const original = structuredClone(data.cards[0]);
  data = updateStrategyCard(data, original, { ...original.task, color: '#db2777' }, null, original.position, true);
  for (const id of descendantIds(data, original.task.id)) assert.equal(data.cards.find(c => c.task.id === id)!.task.color, '#db2777');
  assert.equal(data.cards.find(c => c.task.id === 'strategy-1-0')!.task.color, '#6366f1');
  let parent = 'strategy-return';
  for (let i = 0; i < 25; i++) { const id = 'deep-' + i; data = updateStrategyCard(data, null, { ...original.task, id, title: 'Deep ' + i }, parent, { x: i, y: i }); parent = id; }
  assert.equal(canParent(data, 'strategy-0-0', parent), false);
  assert.throws(() => reparentStrategyCard(data, 'strategy-0-0', parent, null), /pętli/);
  const changed = reparentStrategyCard(data, parent, 'strategy-1-0', 'deep-23');
  assert.equal(changed.cards.find(c => c.task.id === parent)!.parentId, 'strategy-1-0');
  assert.equal(parseStrategy(changed).cards.length, 57);
});

test('relative drag preserves concurrent edits, stale edit never overwrites a teammate', () => {
  const data = createStrategySeed(), original = structuredClone(data.cards[0]);
  const theirs = updateStrategyCard(data, original, { ...original.task, title: 'Nowy tytuł Dara' }, null, original.position);
  const moved = moveStrategyCards(theirs, [original.task.id, ...descendantIds(theirs, original.task.id)], { x: 47, y: -19 });
  assert.equal(moved.cards[0].task.title, 'Nowy tytuł Dara');
  assert.equal(moved.cards[0].position.x, original.position.x + 47);
  assert.throws(() => updateStrategyCard(theirs, original, { ...original.task, title: 'Stary zapis Janka' }, null, original.position), /drugą osobę/);
  const positionOnly = moveStrategyCards(data, [original.task.id], { x: 10, y: 10 });
  const editAfterMove = updateStrategyCard(positionOnly, original, { ...original.task, description: 'Nowy opis' }, null, original.position);
  assert.deepEqual(editAfterMove.cards[0].position, positionOnly.cards[0].position);
});

test('deleting a parent keeps children; invalid graphs cannot be persisted', () => {
  const data = createStrategySeed(), parent = data.cards.find(c => c.task.id === 'strategy-0-2')!;
  const after = deleteStrategyCard(data, parent);
  assert.equal(after.cards.length, 31);
  assert.equal(after.cards.find(c => c.task.id === 'strategy-light')!.parentId, 'strategy-0-0');
  assert.equal(after.cards.find(c => c.task.id === 'strategy-return')!.parentId, 'strategy-light');
  for (const mutate of [(d: any) => d.cards[0].parentId = 'missing', (d: any) => d.cards[0].parentId = 'strategy-return', (d: any) => d.cards[0].position.x = Infinity, (d: any) => d.cards.push(d.cards[0])]) {
    const bad = structuredClone(data); mutate(bad); assert.throws(() => parseStrategy(bad));
  }
  assert.deepEqual(layoutStrategy(data).cards.map(c => c.task), data.cards.map(c => c.task));
});
