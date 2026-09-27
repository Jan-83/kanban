import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  User, 
  Tag, 
  Plus, 
  CheckSquare, 
  Trash2, 
  Clock, 
  AlertCircle 
} from 'lucide-react';
import { Task, TaskPriority, TaskStatus, TeamMember, Subtask } from '../types/kanban';
import { formatDateTimeForInput } from '../utils/dateUtils';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void;
  onDelete?: (taskId: string) => void;
  initialTask?: Task | null;
  defaultStatus?: TaskStatus;
  teamMembers: TeamMember[];
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialTask,
  defaultStatus = 'todo',
  teamMembers,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskInput, setNewSubtaskInput] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialTask) {
      setTitle(initialTask.title);
      setDescription(initialTask.description || '');
      setStatus(initialTask.status);
      setPriority(initialTask.priority);
      setDueDate(formatDateTimeForInput(initialTask.dueDate));
      setAssigneeId(initialTask.assigneeId);
      setTags([...initialTask.tags]);
      setSubtasks([...initialTask.subtasks]);
    } else {
      setTitle('');
      setDescription('');
      setStatus(defaultStatus);
      setPriority('medium');
      // default due date: tomorrow at 18:00
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(18, 0, 0, 0);
      setDueDate(formatDateTimeForInput(tomorrow.toISOString()));
      setAssigneeId(teamMembers[0]?.id || null);
      setTags([]);
      setSubtasks([]);
    }
    setError('');
  }, [initialTask, defaultStatus, isOpen, teamMembers]);

  if (!isOpen) return null;

  const handleAddTag = () => {
    const trimmed = newTagInput.trim().replace(/^#/, '');
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setNewTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleAddSubtask = () => {
    const trimmed = newSubtaskInput.trim();
    if (trimmed) {
      const newSub: Subtask = {
        id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title: trimmed,
        completed: false,
      };
      setSubtasks([...subtasks, newSub]);
      setNewSubtaskInput('');
    }
  };

  const handleToggleSubtask = (subId: string) => {
    setSubtasks(
      subtasks.map((st) => (st.id === subId ? { ...st, completed: !st.completed } : st))
    );
  };

  const handleRemoveSubtask = (subId: string) => {
    setSubtasks(subtasks.filter((st) => st.id !== subId));
  };

  const handleQuickDeadline = (daysOffset: number, hour: number = 18) => {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    d.setHours(hour, 0, 0, 0);
    setDueDate(formatDateTimeForInput(d.toISOString()));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Tytuł zadania jest wymagany');
      return;
    }

    onSave({
      id: initialTask?.id,
      title: title.trim(),
      description: description.trim(),
      status,
      priority,
      dueDate,
      assigneeId,
      tags,
      subtasks,
    });
    onClose();
  };

  const popularTags = ['Frontend', 'Backend', 'UI/UX', 'DevOps', 'GitHub', 'Baza Danych', 'Testy'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div
        className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-6 my-8 text-neutral-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div>
            <h3 className="text-base font-bold text-white">
              {initialTask ? 'Edycja zadania' : 'Nowe zadanie'}
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Ustal priorytet, termin realizacji i przypisz osobę do wykonania.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-2.5 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Tytuł zadania <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="np. Zaprojektować komponent nawigacji"
              className="w-full bg-neutral-950 border border-neutral-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none transition-colors"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Opis szczegółowy
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Dodaj szczegóły, wytyczne techniczne lub kryteria akceptacji..."
              rows={3}
              className="w-full bg-neutral-950 border border-neutral-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Row: Status & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Column / Status */}
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Kolumna Kanban
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none"
              >
                <option value="todo">📋 Do zrobienia</option>
                <option value="in_progress">⚡ W trakcie</option>
                <option value="done">✅ Zrobione</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Priorytet zadania
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none"
              >
                <option value="urgent">🔴 Pilny / Krytyczny</option>
                <option value="high">🟠 Wysoki</option>
                <option value="medium">🟡 Średni</option>
                <option value="low">⚪ Niski</option>
              </select>
            </div>
          </div>

          {/* Row: Due Date & Assignee */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Due Date */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-neutral-400" />
                  Termin realizacji (Deadline)
                </label>
              </div>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none font-mono"
              />
              {/* Quick Date Presets */}
              <div className="flex items-center gap-1.5 mt-1.5 overflow-x-auto text-[11px] text-neutral-400">
                <span className="text-[10px] text-neutral-500">Szybki wybór:</span>
                <button
                  type="button"
                  onClick={() => handleQuickDeadline(0, 18)}
                  className="px-1.5 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[10px]"
                >
                  Dziś (18:00)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDeadline(1, 12)}
                  className="px-1.5 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[10px]"
                >
                  Jutro
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDeadline(3, 17)}
                  className="px-1.5 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[10px]"
                >
                  Za 3 dni
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDeadline(7, 18)}
                  className="px-1.5 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[10px]"
                >
                  Za tydzień
                </button>
              </div>
            </div>

            {/* Assignee */}
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-neutral-400" />
                Przypisana osoba
              </label>
              <select
                value={assigneeId || ''}
                onChange={(e) => setAssigneeId(e.target.value ? e.target.value : null)}
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none"
              >
                <option value="">Brak przypisania</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.role})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-neutral-500 mt-1">
                Przypisany członek zespołu otrzyma automatyczne powiadomienia o terminie.
              </p>
            </div>
          </div>

          {/* Subtasks / Checklist */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1 flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-neutral-400" />
              Zadania cząstkowe (Checklista)
            </label>
            <div className="space-y-1.5 mb-2">
              {subtasks.map((st) => (
                <div
                  key={st.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-neutral-950 border border-neutral-800/80 text-xs"
                >
                  <label className="flex items-center gap-2 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={st.completed}
                      onChange={() => handleToggleSubtask(st.id)}
                      className="rounded border-neutral-700 text-indigo-600 focus:ring-0 w-3.5 h-3.5"
                    />
                    <span className={st.completed ? 'line-through text-neutral-500' : 'text-neutral-200'}>
                      {st.title}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleRemoveSubtask(st.id)}
                    className="p-1 text-neutral-500 hover:text-rose-400 rounded"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newSubtaskInput}
                onChange={(e) => setNewSubtaskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubtask();
                  }
                }}
                placeholder="Wpisz podzadanie i naciśnij Enter..."
                className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 rounded-lg"
              >
                Dodaj
              </button>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-neutral-400" />
              Tagi i etykiety
            </label>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-800 border border-neutral-700 rounded text-[11px] font-mono text-neutral-300"
                >
                  #{t}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    className="hover:text-rose-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Wpisz tag (np. Frontend)..."
                className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 rounded-lg"
              >
                Dodaj tag
              </button>
            </div>

            {/* Popular tags suggestions */}
            <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-neutral-500 overflow-x-auto">
              <span>Szybkie:</span>
              {popularTags.map((pt) => (
                <button
                  key={pt}
                  type="button"
                  onClick={() => {
                    if (!tags.includes(pt)) setTags([...tags, pt]);
                  }}
                  className="hover:text-neutral-300 underline"
                >
                  +{pt}
                </button>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-neutral-800 flex items-center justify-between">
            {initialTask && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Czy na pewno chcesz usunąć to zadanie?')) {
                    onDelete(initialTask.id);
                    onClose();
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Usuń zadanie
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
              >
                Anuluj
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm shadow-indigo-600/30 transition-all active:scale-95"
              >
                {initialTask ? 'Zapisz zmiany' : 'Utwórz zadanie'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
