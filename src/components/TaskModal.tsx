import { useEffect, useRef, useState } from 'react';
import { Clock, Plus, Trash2, X } from 'lucide-react';
import type { BoardStage, BoardUser, StatusComment, Subtask, Task, TaskPriority, TeamMember } from '../types/kanban';
import { formatDateTimeForInput } from '../utils/dateUtils';
import { PRIORITIES } from './TaskCard';

export type TaskDraft = Omit<Task, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: TaskDraft) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  initialTask: Task | null;
  defaultStatus: string;
  teamMembers: TeamMember[];
  stages: BoardStage[];
  busy: boolean;
  error: string;
  currentUser?: BoardUser;
}

function formatCommentDate(iso: string): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Warsaw',
  }).format(new Date(iso));
}

export function TaskModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialTask,
  defaultStatus,
  teamMembers,
  stages,
  busy,
  error,
  currentUser,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState(defaultStatus);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [tags, setTags] = useState('');
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [subtask, setSubtask] = useState('');
  const [statusComments, setStatusComments] = useState<StatusComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [closingStatus, setClosingStatus] = useState('');

  useEffect(() => {
    if (!isOpen) {
      dialog.current?.close();
      return;
    }
    setTitle(initialTask?.title ?? '');
    setDescription(initialTask?.description ?? '');
    setStatus(initialTask?.status ?? defaultStatus);
    setPriority(initialTask?.priority ?? 'medium');
    setDueDate(formatDateTimeForInput(initialTask?.dueDate ?? ''));
    setAssigneeId(initialTask?.assigneeId ?? '');
    setTags(initialTask?.tags.join(', ') ?? '');
    setSubtasks(initialTask?.subtasks.map(s => ({ ...s })) ?? []);
    setSubtask('');
    setStatusComments(initialTask?.statusComments ? initialTask.statusComments.map(c => ({ ...c })) : []);
    setNewComment('');
    setClosingStatus(initialTask?.closingStatus ?? '');
    dialog.current?.showModal();
  }, [isOpen, initialTask, defaultStatus]);

  const addSubtask = () => {
    if (subtask.trim() && subtasks.length < 100) {
      setSubtasks([...subtasks, { id: crypto.randomUUID(), title: subtask.trim(), completed: false }]);
      setSubtask('');
    }
  };

  const addStatusComment = () => {
    const text = newComment.trim();
    if (!text || statusComments.length >= 500) return;
    const comment: StatusComment = {
      id: crypto.randomUUID(),
      text,
      timestamp: new Date().toISOString(),
      author: currentUser?.name || 'Użytkownik',
    };
    setStatusComments(prev => [...prev, comment]);
    setNewComment('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let finalComments = [...statusComments];
    const pendingComment = newComment.trim();
    if (pendingComment && statusComments.length < 500) {
      finalComments.push({
        id: crypto.randomUUID(),
        text: pendingComment,
        timestamp: new Date().toISOString(),
        author: currentUser?.name || 'Użytkownik',
      });
    }

    const ok = await onSave({
      ...(initialTask ?? {}),
      id: initialTask?.id,
      title: title.trim(),
      description: description.trim(),
      status,
      priority,
      dueDate,
      assigneeId: assigneeId || null,
      tags: [...new Set(tags.split(',').map(t => t.trim()).filter(Boolean))],
      subtasks,
      statusComments: finalComments,
      closingStatus: closingStatus.trim(),
    });
    if (ok) onClose();
  };

  return (
    <dialog
      ref={dialog}
      className="task-dialog"
      aria-labelledby="task-dialog-title"
      onCancel={e => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="dialog-heading">
        <div>
          <p className="eyebrow">ZADANIA ZESPOŁU</p>
          <h2 id="task-dialog-title">{initialTask ? 'Edytuj zadanie' : 'Nowe zadanie'}</h2>
        </div>
        <button className="icon-button" onClick={onClose} disabled={busy} aria-label="Zamknij edycję">
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <fieldset disabled={busy} className="form-stack">
          {error && <p className="notice error" role="alert">{error}</p>}
          <label>
            Tytuł zadania
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={300}
              required
              autoFocus
              placeholder="Co mamy zrobić?"
            />
          </label>
          <label>
            Opis
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={10000}
              rows={3}
              placeholder="Szczegóły, materiały, oczekiwany efekt…"
            />
          </label>
          <div className="form-grid">
            <label>
              Etap
              <select value={status} onChange={e => setStatus(e.target.value)}>
                {stages.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </label>
            <label>
              Priorytet
              <select value={priority} onChange={e => setPriority(e.target.value as TaskPriority)}>
                {Object.entries(PRIORITIES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
            <label>
              Termin
              <input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </label>
            <label>
              Osoba odpowiedzialna
              <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
                <option value="">Nieprzypisane</option>
                {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
          </div>
          <label>
            Tagi <span className="muted">(oddziel przecinkami)</span>
            <input
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="Strona, JUNG, Oferta"
              maxLength={3000}
            />
          </label>

          {/* LISTA KROKÓW */}
          <div className="checklist-editor">
            <p className="field-label">
              Lista kroków <span className="muted">{subtasks.filter(s => s.completed).length}/{subtasks.length}</span>
            </p>
            {subtasks.map(s => (
              <div key={s.id} className="checklist-row">
                <label>
                  <input
                    type="checkbox"
                    checked={s.completed}
                    onChange={() => setSubtasks(subtasks.map(x => x.id === s.id ? { ...x, completed: !x.completed } : x))}
                  />
                  <span className={s.completed ? 'completed-text' : ''}>{s.title}</span>
                </label>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={'Usuń krok: ' + s.title}
                  onClick={() => setSubtasks(subtasks.filter(x => x.id !== s.id))}
                >
                  <X size={15} />
                </button>
              </div>
            ))}
            <div className="inline-form">
              <input
                value={subtask}
                onChange={e => setSubtask(e.target.value)}
                placeholder="Dodaj krok…"
                aria-label="Nowy krok"
                maxLength={300}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSubtask();
                  }
                }}
              />
              <button type="button" className="button" onClick={addSubtask} disabled={subtasks.length >= 100}>
                <Plus size={15} />Dodaj
              </button>
            </div>
          </div>

          {/* KOMENTARZ O STATUSIE (poniżej listy kroków) */}
          <div className="status-comments-box">
            <div className="section-title-row">
              <label className="field-label-prominent" htmlFor="new-status-comment">KOMENTARZ O STATUSIE</label>
              <span className="muted hint-small">Data i godzina: Polska</span>
            </div>

            {statusComments.length > 0 ? (
              <div className="status-comments-history" aria-label="Historia komentarzy o statusie">
                {statusComments.map(c => (
                  <div key={c.id} className="status-comment-card">
                    <div className="status-comment-meta">
                      <span className="status-comment-author">{c.author || 'Członek zespołu'}</span>
                      <span className="status-comment-time">
                        <Clock size={12} />
                        {formatCommentDate(c.timestamp)}
                      </span>
                      <button
                        type="button"
                        className="icon-button delete-comment-btn"
                        aria-label="Usuń ten komentarz"
                        title="Usuń wpis"
                        onClick={() => setStatusComments(statusComments.filter(x => x.id !== c.id))}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className="status-comment-content">{c.text}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="status-comment-empty">Brak wpisów o statusie prac. Dodaj komentarz poniżej.</p>
            )}

            <div className="status-comment-composer">
              <textarea
                id="new-status-comment"
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Wpisz komentarz o aktualnym statusie prac nad zadaniem…"
                rows={2}
                maxLength={2000}
                disabled={statusComments.length >= 500}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    addStatusComment();
                  }
                }}
              />
              <div className="status-comment-bottom">
                <span className="muted composer-tip">{statusComments.length >= 500 ? 'Osiągnięto limit 500 komentarzy.' : 'Ctrl+Enter dodaje wpis do historii.'}</span>
                <button
                  type="button"
                  className="button secondary status-add-btn"
                  onClick={addStatusComment}
                  disabled={!newComment.trim() || statusComments.length >= 500}
                >
                  <Plus size={14} />
                  Dodaj komentarz
                </button>
              </div>
            </div>
          </div>

          <p className="muted hint-small" role="status">Komentarze i status zamknięcia zapiszesz razem z zadaniem przyciskiem „{initialTask ? 'Zapisz zmiany' : 'Utwórz zadanie'}”.</p>

          {/* STATUS ZAMKNIĘCIA (osobne pole) */}
          <div className="closing-status-box">
            <label htmlFor="closing-status-input" className="field-label-prominent">
              STATUS ZAMKNIĘCIA
              <span className="field-sublabel">Opis, co zostało zrobione, żeby uznać zadanie za wykonane</span>
            </label>
            <textarea
              id="closing-status-input"
              value={closingStatus}
              onChange={e => setClosingStatus(e.target.value)}
              placeholder="Opisz, co zostało zrobione: zrealizowane etapy, przeprowadzone testy, uzyskane akceptacje, wdrożenie…"
              rows={3}
              maxLength={5000}
            />
          </div>

          <div className="dialog-actions">
            {initialTask && (
              <button
                type="button"
                className="button danger"
                onClick={async () => {
                  if (confirm('Usunąć zadanie „' + initialTask.title + '”?') && await onDelete(initialTask.id)) onClose();
                }}
              >
                <Trash2 size={15} />Usuń
              </button>
            )}
            <span className="spacer" />
            <button type="button" className="button" onClick={onClose}>Anuluj</button>
            <button className="button primary">{busy ? 'Zapisywanie…' : initialTask ? 'Zapisz zmiany' : 'Utwórz zadanie'}</button>
          </div>
        </fieldset>
      </form>
    </dialog>
  );
}
