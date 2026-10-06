import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignTask, emptyBoard, moveTask, parseBoard, parseLegacyBoard, removeMember, taskAssigneeIds, taskAssignees } from '../src/utils/board';
import { generateGitHubIssuesMarkdown } from '../src/utils/githubExport';
import { scanTasksForDueNotifications } from '../src/utils/notificationEngine';
import type { Task, TeamMember } from '../src/types/kanban';

const members: TeamMember[] = [
  { id: 'daro', name: 'Daro', email: 'daro@example.invalid', role: 'Projekt', color: '#6366f1', status: 'active' },
  { id: 'janek', name: 'Pan Janek', email: 'janek@example.invalid', role: 'Realizacja', color: '#0d9488', status: 'active' },
];
const task: Task = { id: 'task-1', title: 'Odbiór', description: 'Weryfikacja scen', descriptionHtml: '<p>Weryfikacja <strong>scen</strong></p>', color: '#10b981', status: 'todo', priority: 'high', dueDate: '2026-01-01', assigneeId: 'daro',
  tags: ['KNX'], subtasks: [{ id: 'step-1', title: 'Test oświetlenia', completed: true }], statusComments: [{ id: 'comment-1', text: 'Testy trwają', timestamp: '2026-10-06T22:00:00Z' }], closingStatus: 'Do odbioru', createdAt: '2026-10-06', updatedAt: '2026-10-06' };
const board = () => ({ ...emptyBoard(), members: structuredClone(members), tasks: [structuredClone(task)] });

test('legacy single assignments remain unchanged; multiple assignees survive save, reload and task moves', () => {
  assert.deepEqual(parseBoard(board()).tasks[0], task);
  assert.deepEqual(taskAssigneeIds(task), ['daro']);
  const assigned = assignTask(board(), task.id, ['daro', 'janek']);
  const restored = parseBoard(JSON.parse(JSON.stringify(moveTask(assigned, task.id, 'in_progress'))));
  assert.deepEqual(taskAssigneeIds(restored.tasks[0]), ['daro', 'janek']);
  assert.deepEqual(taskAssignees(restored.tasks[0], members).map(person => person.name), ['Daro', 'Pan Janek']);
  for (const key of ['description', 'descriptionHtml', 'color', 'tags', 'subtasks', 'statusComments', 'closingStatus'] as const) assert.deepEqual(restored.tasks[0][key], task[key]);
  assert.equal(restored.tasks[0].assigneeId, 'daro');
  assert.equal(restored.tasks[0].status, 'in_progress');
  assert.deepEqual(board().tasks[0], task);
});

test('assignment accepts existing people once, supports clearing and rejects malformed imported lists', () => {
  const assigned = assignTask(board(), task.id, ['daro', 'janek', 'janek', 'missing']);
  assert.deepEqual(taskAssigneeIds(assigned.tasks[0]), ['daro', 'janek']);
  assert.equal(assignTask(assigned, task.id, ['daro', 'janek']), assigned);
  const cleared = parseBoard(assignTask(assigned, task.id, []));
  assert.equal(cleared.tasks[0].assigneeId, null);
  assert.deepEqual(taskAssigneeIds(cleared.tasks[0]), []);
  for (const assigneeIds of [null, 'daro', ['daro', 'daro'], ['daro', 'missing'], ['janek', 'daro'], [], [1]]) {
    assert.throws(() => parseBoard({ ...board(), tasks: [{ ...task, assigneeIds }] }), /Nieprawidłowe dane zadań/);
  }
});

test('removing a team member preserves the other assignees, task notes and legacy assignments', () => {
  const assigned = assignTask(board(), task.id, ['daro', 'janek']);
  const afterDaro = parseBoard(removeMember(assigned, 'daro'));
  assert.deepEqual(taskAssigneeIds(afterDaro.tasks[0]), ['janek']);
  assert.equal(afterDaro.tasks[0].assigneeId, 'janek');
  assert.deepEqual(afterDaro.tasks[0].statusComments, task.statusComments);
  assert.equal(afterDaro.tasks[0].descriptionHtml, task.descriptionHtml);
  assert.equal(afterDaro.tasks[0].color, task.color);
  assert.deepEqual(taskAssigneeIds(parseBoard(removeMember(afterDaro, 'janek')).tasks[0]), []);
  assert.equal(parseBoard(removeMember(board(), 'daro')).tasks[0].assigneeId, null);
  assert.deepEqual(taskAssigneeIds(assigned.tasks[0]), ['daro', 'janek']);
});

test('legacy import removes a deleted person while retaining remaining responsible people', () => {
  const result = parseLegacyBoard([{ ...task, assigneeIds: ['daro', 'janek'] }], [members[1]]);
  assert.equal(result.unassigned, 1);
  assert.deepEqual(taskAssigneeIds(result.data.tasks[0]), ['janek']);
  assert.equal(result.data.tasks[0].assigneeId, 'janek');
});

test('task exports and deadline notifications include every responsible person', () => {
  const assigned = assignTask(board(), task.id, ['daro', 'janek']);
  const markdown = generateGitHubIssuesMarkdown(assigned.tasks, members);
  assert.match(markdown, /Odpowiedzialni:\*\* Daro \(@daro\), Pan Janek \(@janek\)/);
  const notification = scanTasksForDueNotifications(assigned.tasks, [], members).updatedNotifications[0];
  assert.match(notification.message, /Daro, Pan Janek/);
});
