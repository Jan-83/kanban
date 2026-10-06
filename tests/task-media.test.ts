import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';
import { assignTask, emptyBoard, moveTask, parseBoard } from '../src/utils/board';
import { descriptionText, plainTextToHtml, sanitizeDescription } from '../src/utils/richDescription';
import { MAX_IMAGE_BYTES, validTaskImage, validateImageContent, validateImageFile } from '../src/utils/taskImageValidation';
import type { Task, TaskImage } from '../src/types/kanban';

const boardId = '10000000-0000-4000-a000-000000000001';
const image: TaskImage = { id: 'photo-1', name: 'panel.jpg', path: boardId + '/task-1/photo-1.jpg', size: 100, mimeType: 'image/jpeg', uploadedAt: '2026-10-06T20:00:00Z' };
const task: Task = { id: 'task-1', title: 'Odbiór', description: 'Sprawdź oświetlenie', descriptionHtml: '<p>Sprawdź <strong>oświetlenie</strong></p>', images: [image], status: 'todo', priority: 'medium', dueDate: '', assigneeId: null, tags: [], subtasks: [], statusComments: [], closingStatus: '', createdAt: '2026-10-06', updatedAt: '2026-10-06' };

test('HTML, task colors and private photo metadata survive board saves, assignment and moving', () => {
  const board = parseBoard({ ...emptyBoard(), tasks: [{ ...task, color: '#db2777' }] });
  const result = parseBoard(JSON.parse(JSON.stringify(assignTask(moveTask(board, task.id, 'done'), task.id, null))));
  assert.equal(result.tasks[0].descriptionHtml, task.descriptionHtml);
  assert.deepEqual(result.tasks[0].images, [image]);
  assert.equal(result.tasks[0].status, 'done');
  assert.equal(result.tasks[0].description, task.description);
  assert.equal(result.tasks[0].color, '#db2777');
});

test('task border colors can be cleared, leave legacy tasks unchanged and reject unsafe CSS', () => {
  const board = parseBoard({ ...emptyBoard(), tasks: [{ ...task, color: '#12ABef' }] });
  assert.equal(board.tasks[0].color, '#12ABef');
  const cleared = parseBoard({ ...board, tasks: [{ ...board.tasks[0], color: undefined }] });
  assert.deepEqual(cleared.tasks[0], task);
  assert.equal('color' in cleared.tasks[0], false);
  for (const color of ['red', '#abc', '#12345678', 'url(https://example.invalid/)', 'var(--text)', '#123456;display:none', null, 1]) {
    assert.throws(() => parseBoard({ ...emptyBoard(), tasks: [{ ...task, color }] }));
  }
});

test('legacy descriptions retain text without invented image or HTML fields', () => {
  const { images: _images, descriptionHtml: _html, ...legacy } = task;
  assert.deepEqual(parseBoard({ ...emptyBoard(), tasks: [legacy] }).tasks[0], legacy);
});

test('image metadata cannot supply arbitrary URLs, wrong-task paths, mismatched types or oversized files', () => {
  for (const invalid of [
    { ...image, path: 'https://example.invalid/a.jpg' },
    { ...image, path: boardId + '/other-task/photo-1.jpg' },
    { ...image, path: boardId + '/task-1/../photo-1.jpg' },
    { ...image, mimeType: 'image/svg+xml' },
    { ...image, mimeType: 'image/png' },
    { ...image, size: MAX_IMAGE_BYTES + 1 },
    { ...image, uploadedAt: 'invalid' },
  ]) {
    assert.equal(validTaskImage(invalid, task.id), false);
    assert.throws(() => parseBoard({ ...emptyBoard(), tasks: [{ ...task, images: [invalid] }] }));
  }
  assert.throws(() => parseBoard({ ...emptyBoard(), tasks: [{ ...task, images: [image, image] }] }));
  assert.equal('signedUrl' in parseBoard({ ...emptyBoard(), tasks: [{ ...task, images: [{ ...image, signedUrl: 'secret', other: true }] }] }).tasks[0].images![0], false);
});

test('formatted descriptions preserve lists and safe links while removing executable HTML and remote images', () => {
  const window = new JSDOM('').window;
  const purifier = createDOMPurify(window as unknown as Parameters<typeof createDOMPurify>[0]);
  const cleaned = sanitizeDescription('<h2>Odbiór</h2><ul><li><strong>Sceny</strong></li></ul><a href="https://example.com/">Projekt</a><script>alert(1)</script><img src="https://tracker.example/" onerror="alert(1)"><iframe srcdoc="x"></iframe><p style="color:red" onclick="alert(1)">Treść</p><a href="jav&#97;script:alert(1)">Zły</a><svg onload="alert(1)"></svg>', purifier);
  assert.match(cleaned, /<strong>Sceny<\/strong>/);
  assert.match(cleaned, /<ul><li>/);
  assert.match(cleaned, /target="_blank" rel="noopener noreferrer"/);
  assert.doesNotMatch(cleaned, /script|onclick|onerror|style=|<img|<iframe|<svg|javascript:/);
  assert.match(descriptionText(cleaned, window.document), /Odbiór\nSceny/);
  window.close();
});

test('plain text conversion escapes markup and retains line breaks and Polish characters', () => {
  const window = new JSDOM('').window;
  const text = 'Zażółć <test> & "opis"\nDrugie zdanie.';
  const html = plainTextToHtml(text);
  assert.doesNotMatch(html, /<test>/);
  assert.equal(descriptionText(html, window.document), text);
  window.close();
});

test('upload validation rejects SVG, renamed text and files exceeding the size limit', async () => {
  assert.throws(() => validateImageFile({ type: 'image/svg+xml', name: 'x.svg', size: 500 }));
  assert.throws(() => validateImageFile({ type: 'image/png', name: 'huge.png', size: MAX_IMAGE_BYTES + 1 }));
  await assert.rejects(validateImageContent(new File(['<script>'], 'fake.png', { type: 'image/png' })), /nie zawiera/);
  await validateImageContent(new File([new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0])], 'x.png', { type: 'image/png' }));
});
