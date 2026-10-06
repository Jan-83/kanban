import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Clock, ImagePlus, Maximize2, Plus, Trash2, X } from 'lucide-react';
import type { BoardStage, BoardUser, StatusComment, Subtask, Task, TaskImage, TaskPriority, TeamMember } from '../types/kanban';
import { formatDateTimeForInput } from '../utils/dateUtils';
import { PRIORITIES } from './TaskCard';
import { sanitizeDescription } from '../utils/richDescription';
import { MAX_TASK_IMAGES, validateImageContent } from '../utils/taskImageValidation';
import { TaskImageGallery, type LocalImagePreview } from './TaskImageGallery';
import { useTaskImages } from './TaskImageContext';

const DescriptionEditor = lazy(() => import('./DescriptionEditor').then(module => ({ default: module.DescriptionEditor })));
const TASK_COLORS = [
  ['#6366f1', 'Fioletowy'], ['#0284c7', 'Niebieski'], ['#0d9488', 'Turkusowy'], ['#10b981', 'Zielony'],
  ['#f59e0b', 'Bursztynowy'], ['#d97706', 'Pomarańczowy'], ['#db2777', 'Różowy'], ['#64748b', 'Szary'],
] as const;

export type TaskDraft = Omit<Task, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; newTaskId?: string };

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
  busy: boardBusy,
  error,
  currentUser,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionHtml, setDescriptionHtml] = useState('');
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [images, setImages] = useState<TaskImage[]>([]);
  const [pendingImages, setPendingImages] = useState<(LocalImagePreview & { file: File })[]>([]);
  const [photoTaskId, setPhotoTaskId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectingImages, setSelectingImages] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [localError, setLocalError] = useState('');
  const photoInput = useRef<HTMLInputElement>(null);
  const previewUrls = useRef(new Set<string>());
  const imageRepository = useTaskImages();
  const busy = boardBusy || uploading || selectingImages;
  const [status, setStatus] = useState(defaultStatus);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [taskColor, setTaskColor] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [tags, setTags] = useState('');
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [subtask, setSubtask] = useState('');
  const [statusComments, setStatusComments] = useState<StatusComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [closingStatus, setClosingStatus] = useState('');

  useEffect(() => {
    previewUrls.current.forEach(url => URL.revokeObjectURL(url));
    previewUrls.current.clear();
    setPendingImages([]);
    setDescriptionOpen(false);
    if (!isOpen) {
      dialog.current?.close();
      return;
    }
    setTitle(initialTask?.title ?? '');
    setDescription(initialTask?.description ?? '');
    setDescriptionHtml(initialTask?.descriptionHtml ?? '');
    setImages(initialTask?.images?.map(image => ({ ...image })) ?? []);
    setPhotoTaskId(initialTask?.id ?? crypto.randomUUID());
    setLocalError('');
    setUploadProgress('');
    setStatus(initialTask?.status ?? defaultStatus);
    setPriority(initialTask?.priority ?? 'medium');
    setTaskColor(initialTask?.color ?? '');
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
  useEffect(() => () => { previewUrls.current.forEach(url => URL.revokeObjectURL(url)); }, []);
  useEffect(() => {
    if (!uploading && !selectingImages) return;
    const protectUpload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', protectUpload);
    return () => window.removeEventListener('beforeunload', protectUpload);
  }, [uploading, selectingImages]);

  const selectImages = async (files: File[]) => {
    if (!files.length) return;
    setLocalError('');
    if (images.length + pendingImages.length + files.length > MAX_TASK_IMAGES) { setLocalError('Do zadania można dodać maksymalnie 12 zdjęć.'); return; }
    setSelectingImages(true);
    try {
      for (const file of files) await validateImageContent(file);
      const added = files.map(file => { const url = URL.createObjectURL(file); previewUrls.current.add(url); return { id: crypto.randomUUID(), name: file.name, file, url }; });
      setPendingImages(previous => [...previous, ...added]);
      for (const [index, image] of added.entries()) {
        setUploadProgress('Przesyłanie zdjęć: ' + (index + 1) + ' / ' + added.length);
        const uploaded = await imageRepository.upload(photoTaskId, image.file);
        setImages(previous => [...previous, uploaded]);
        setPendingImages(previous => previous.filter(pending => pending.id !== image.id));
      }
    } catch (error) { setLocalError(error instanceof Error ? error.message : 'Nie udało się dodać zdjęć.'); }
    finally { setSelectingImages(false); setUploadProgress(''); }
  };
  const removeImage = (id: string) => {
    setImages(previous => previous.filter(image => image.id !== id));
    const pending = pendingImages.find(image => image.id === id);
    if (pending) { URL.revokeObjectURL(pending.url); previewUrls.current.delete(pending.url); }
    setPendingImages(previous => previous.filter(image => image.id !== id));
  };

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
    if (busy) return;
    setUploading(true); setLocalError('');
    try {
    const finalImages = [...images];
    for (const [index, image] of pendingImages.entries()) {
      setUploadProgress('Przesyłanie zdjęć: ' + (index + 1) + ' / ' + pendingImages.length);
      const uploaded = await imageRepository.upload(photoTaskId, image.file);
      finalImages.push(uploaded);
      setImages(previous => [...previous, uploaded]);
      setPendingImages(previous => previous.filter(pending => pending.id !== image.id));
    }
    setUploadProgress('');
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
      ...(!initialTask ? { newTaskId: photoTaskId } : {}),
      title: title.trim(),
      description: description.trim(),
      descriptionHtml: descriptionHtml ? sanitizeDescription(descriptionHtml) : '',
      images: finalImages,
      status,
      priority,
      color: taskColor || undefined,
      dueDate,
      assigneeId: assigneeId || null,
      tags: [...new Set(tags.split(',').map(t => t.trim()).filter(Boolean))],
      subtasks,
      statusComments: finalComments,
      closingStatus: closingStatus.trim(),
    });
    if (ok) onClose();
    } catch (error) { setLocalError(error instanceof Error ? error.message : 'Nie zapisano zadania.'); }
    finally { setUploading(false); setUploadProgress(''); }
  };

  return (<>
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
          {localError && <p className="notice error" role="alert">{localError}</p>}
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
          <div className="description-field">
            <div className="section-title-row"><label htmlFor="task-description" className="field-label">Opis</label><button type="button" className="button description-expand" onClick={() => setDescriptionOpen(true)}><Maximize2 size={14} />Powiększ / formatuj</button></div>
            {descriptionHtml ? <div className="rich-description description-summary" id="task-description" dangerouslySetInnerHTML={{ __html: sanitizeDescription(descriptionHtml) }} /> : <textarea
              id="task-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={10000}
              rows={3}
              placeholder="Szczegóły, materiały, oczekiwany efekt…"
            />}
          </div>
          <section className="task-image-editor" aria-label="Zdjęcia do zadania">
            <div className="section-title-row"><span className="field-label">Zdjęcia <span className="muted">{images.length + pendingImages.length} / {MAX_TASK_IMAGES}</span></span>
              <button type="button" className="button" disabled={images.length + pendingImages.length >= MAX_TASK_IMAGES} onClick={() => photoInput.current?.click()}><ImagePlus size={15} />Dodaj zdjęcia</button></div>
            <input ref={photoInput} type="file" className="visually-hidden" aria-label="Wybierz zdjęcia do zadania" accept="image/jpeg,image/png,image/webp" multiple onChange={event => { void selectImages(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
            <TaskImageGallery images={images} localImages={pendingImages} onRemove={removeImage} disabled={busy} />
            <p className="muted hint-small">JPG, PNG lub WebP, do 5 MB. Kliknij miniaturę, aby powiększyć zdjęcie.</p>
            {!!pendingImages.length && <p className="muted hint-small">Nieprzesłane zdjęcia wyślemy ponownie przy zapisie zadania.</p>}
            {images.length + pendingImages.length > 0 && <p className="muted hint-small">Zmiany zdjęć dołączysz do tablicy przyciskiem „{initialTask ? 'Zapisz zmiany' : 'Utwórz zadanie'}”.</p>}
          </section>
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
          <fieldset className="task-color-picker">
            <legend className="field-label">Kolor zadania <span className="muted hint-small">Obramowanie kafelka na tablicy</span></legend>
            <div className="task-color-options">
              <button type="button" className="button task-color-default" aria-pressed={!taskColor} onClick={() => setTaskColor('')}>Domyślny</button>
              {TASK_COLORS.map(([color, name]) => <button type="button" key={color} className="task-color-swatch" style={{ backgroundColor: color }} aria-label={'Kolor zadania: ' + name} title={name} aria-pressed={taskColor.toLowerCase() === color} onClick={() => setTaskColor(color)} />)}
              <label className="task-color-custom">Własny<input type="color" aria-label="Własny kolor obramowania zadania" value={taskColor || '#6366f1'} onChange={event => setTaskColor(event.target.value)} /></label>
            </div>
          </fieldset>
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
            <button className="button primary">{uploadProgress || (busy ? 'Zapisywanie…' : initialTask ? 'Zapisz zmiany' : 'Utwórz zadanie')}</button>
          </div>
        </fieldset>
      </form>
    </dialog>
    {descriptionOpen && <Suspense fallback={null}><DescriptionEditor text={description} html={descriptionHtml} onClose={() => setDescriptionOpen(false)} onApply={(text, html) => { setDescription(text); setDescriptionHtml(html); setDescriptionOpen(false); }} /></Suspense>}
    </>
  );
}
