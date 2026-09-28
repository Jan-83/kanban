import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addStage, assertDraftCurrent, emptyBoard, moveTask, parseBoard, parseLegacyBoard } from '../src/utils/board';
import { INITIAL_TASKS, INITIAL_MEMBERS } from '../src/utils/storage';
import { clearLegacyAuthentication } from '../src/utils/authStorage';
import { generateGitHubIssuesMarkdown } from '../src/utils/githubExport';
import type { BoardData, Task } from '../src/types/kanban';
const task = (id: string, status = 'todo'): Task => ({ id, title: id, description: '', status, priority: 'medium', dueDate: '', assigneeId: null, tags: [], subtasks: [], createdAt: '2026-09-29', updatedAt: '2026-09-29' });
test('custom stage survives serialization and is inserted before Done', () => {
  const data = addStage(emptyBoard(), '  Do akceptacji  ', '#6366f1', 'review');
  assert.deepEqual(data.stages.map(s => s.id), ['todo', 'in_progress', 'review', 'done']);
  assert.equal(parseBoard(JSON.parse(JSON.stringify(data))).stages[2].title, 'Do akceptacji');
  assert.throws(() => addStage(data, 'DO AKCEPTACJI', '#6366f1', 'other'));
  assert.throws(() => addStage(data, '  ', '#6366f1', 'other'));
});
test('original board migrates without dropping tasks with deleted assignees', () => {
  const result = parseLegacyBoard(INITIAL_TASKS, INITIAL_MEMBERS);
  assert.equal(result.data.tasks.length, INITIAL_TASKS.length);
  assert.equal(result.unassigned, 1);
  assert.equal(result.data.tasks.find(t => t.id === 'task-6')?.assigneeId, null);
  assert.deepEqual(result.data.tasks.map(t => t.id), INITIAL_TASKS.map(t => t.id));
});
test('a draft cannot overwrite a task updated by background refresh', () => {
  const original = task('a');
  assert.throws(() => assertDraftCurrent({ ...emptyBoard(), tasks: [{ ...original, description: 'Teammate update' }] }, original, 'a'), /podczas edycji/);
  assert.throws(() => assertDraftCurrent(emptyBoard(), original, 'a'), /usunięte/);
  assert.doesNotThrow(() => assertDraftCurrent({ ...emptyBoard(), tasks: [original, task('other')] }, original, 'a'));
});
test('moving between stages, into an empty stage, both reorder directions and hidden cards preserves tasks', () => {
  const original: BoardData = { ...addStage(emptyBoard(), 'Weryfikacja', '#6366f1', 'review'), tasks: [task('a'), task('hidden'), task('b'), task('c')] };
  const movedDown = moveTask(original, 'a', 'todo', 'c');
  assert.deepEqual(movedDown.tasks.map(t => t.id), ['hidden', 'b', 'a', 'c']);
  const movedUp = moveTask(movedDown, 'c', 'todo', 'hidden');
  assert.deepEqual(movedUp.tasks.map(t => t.id), ['c', 'hidden', 'b', 'a']);
  const custom = moveTask(movedUp, 'b', 'review');
  assert.equal(custom.tasks.find(t => t.id === 'b')?.status, 'review');
  assert.equal(parseBoard(custom).tasks.length, 4);
  assert.equal(moveTask(original, 'a', 'bogus'), original);
  assert.equal(moveTask(original, 'a', 'todo', 'a'), original);
  assert.deepEqual(original.tasks.map(t => t.id), ['a', 'hidden', 'b', 'c']);
  assert.match(generateGitHubIssuesMarkdown(custom.tasks, [], custom.stages), /Weryfikacja/);
});
test('reject broken references, duplicates, untrusted fields and unsafe styles', () => {
  const data: BoardData = { ...emptyBoard(), tasks: [task('a')] };
  assert.throws(() => parseBoard({ ...data, tasks: [task('a', 'unknown')] }));
  assert.throws(() => parseBoard({ ...data, tasks: [task('a'), task('a')] }));
  assert.throws(() => parseBoard({ ...data, tasks: [{ ...task('a'), assigneeId: 'missing' }] }));
  assert.throws(() => parseBoard({ ...data, stages: data.stages.map(s => ({ ...s, color: 'url(https://example.test)' })) }));
  assert.equal('authSession' in parseBoard({ ...data, authSession: { role: 'admin' } }), false);
  assert.equal('password' in parseBoard({ ...data, tasks: [{ ...task('a'), password: 'do-not-import' }] }).tasks[0], false);
});
test('remove forged and default legacy auth while preserving board data for explicit import', () => {
  const initial = { kanban_tasks_v2: '[{"id":"legacy"}]', kanban_security_config_v2: '{}', kanban_auth_session_v2: '{"user":{"role":"admin"}}' };
  const local = new Map(Object.entries(initial));
  const session = new Map(Object.entries(initial));
  (globalThis as any).window = { localStorage: { removeItem: (key: string) => local.delete(key) }, sessionStorage: { removeItem: (key: string) => session.delete(key) } };
  clearLegacyAuthentication();
  assert.deepEqual([...local.keys()], ['kanban_tasks_v2']);
  assert.deepEqual([...session.keys()], ['kanban_tasks_v2']);
  (globalThis as any).window = { get localStorage() { throw new Error('blocked'); }, get sessionStorage() { throw new Error('blocked'); } };
  assert.doesNotThrow(clearLegacyAuthentication);
});

