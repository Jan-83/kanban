// Separate development entry. Vite's production build includes index.html only.
import { createRoot } from 'react-dom/client';
import { Workspace, type BoardRepository } from '../src/components/Workspace';
import { emptyBoard, parseBoard } from '../src/utils/board';
import { RevisionConflictError } from '../src/utils/supabase';
import type { BoardData, TaskImage } from '../src/types/kanban';
import type { TaskImageRepository } from '../src/utils/taskImages';
import '../src/index.css';
import { applyTheme, readTheme } from '../src/utils/theme';
applyTheme(readTheme());
const data: BoardData = {
  ...emptyBoard(),
  members: [{ id: 'demo-1', name: 'Jan', email: '', role: 'Projekt', color: '#0d9488', status: 'active' }, { id: 'demo-2', name: 'Darek', email: '', role: 'Realizacja', color: '#6366f1', status: 'active' }],
  tasks: ['Przygotować ofertę oświetlenia', 'Materiały do nowej strony', 'Sprawdzić układ panelu JUNG', 'Zdjęcia realizacji: biuro', 'Uzupełnić specyfikację techniczną', 'Podsumowanie spotkania'].map((title, i) => ({
    id: 'demo-task-' + i, title, description: ['Zebrać warianty opraw i przygotować porównanie dla klienta.', 'Komplet treści do sekcji o inteligentnych wnętrzach.', 'Weryfikacja scen i opisów przycisków przed odbiorem.'][i % 3], status: i < 2 ? 'todo' : i < 5 ? 'in_progress' : 'done', priority: i === 0 ? 'urgent' : i === 2 ? 'high' : 'medium', dueDate: '2026-10-02T14:00', assigneeId: 'demo-' + (i % 2 + 1), tags: [['Oferta', 'Oświetlenie'], ['Strona', 'Treści'], ['JUNG', 'Projekt']][i % 3], subtasks: [{ id: 'step-' + i, title: 'Sprawdzić materiały', completed: i % 2 === 0 }], createdAt: '2026-09-29', updatedAt: '2026-09-29'
  })),
};
let snapshot = { data, revision: 0 };
try { const saved = JSON.parse(sessionStorage.getItem('kanban-media-preview-board') ?? 'null'); if (saved) snapshot = { data: parseBoard(saved.data), revision: saved.revision }; } catch {}
const repository: BoardRepository = {
  load: async () => structuredClone(snapshot),
  save: async (data, revision) => { if (revision !== snapshot.revision) throw new RevisionConflictError('Odśwież tablicę.'); snapshot = { data: structuredClone(data), revision: revision + 1 }; sessionStorage.setItem('kanban-media-preview-board', JSON.stringify(snapshot)); return structuredClone(snapshot); },
};
const imageRepository: TaskImageRepository = {
  async upload(taskId, file) {
    const id = crypto.randomUUID();
    const mimeType = file.type as TaskImage['mimeType'];
    const path = '10000000-0000-4000-a000-000000000001/' + taskId + '/' + id + '.' + ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mimeType]);
    const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
    sessionStorage.setItem('kanban-media-preview-photo-' + path, dataUrl);
    return { id, name: file.name, path, mimeType, size: file.size, uploadedAt: new Date().toISOString() };
  },
  async urls(images) { return Object.fromEntries(images.map(image => [image.id, sessionStorage.getItem('kanban-media-preview-photo-' + image.path) ?? ''])); },
};
createRoot(document.getElementById('root')!).render(<Workspace user={{ id: 'demo', name: 'Jan', email: 'demo@example.invalid', role: 'admin' }} repository={repository} imageRepository={imageRepository} onLogout={() => location.assign('/')} onAccessLost={() => location.assign('/')} />);

