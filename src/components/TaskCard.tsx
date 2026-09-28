import { CalendarDays, CheckSquare, GripVertical, UserRound } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { BoardStage, Task, TeamMember } from '../types/kanban';
import { evaluateDueDate } from '../utils/dateUtils';
export const PRIORITIES = { urgent: 'Pilny', high: 'Wysoki', medium: 'Średni', low: 'Niski' };
interface Props { task: Task; teamMembers: TeamMember[]; stages: BoardStage[]; onEdit: (task: Task) => void; onMove: (taskId: string, stageId: string) => void; disabled?: boolean; overlay?: boolean; }
function CardContent({ task, teamMembers, stages, onEdit, onMove, disabled, overlay, handle }: Props & { handle?: React.ReactNode }) {
  const person = teamMembers.find(m => m.id === task.assigneeId);
  const due = evaluateDueDate(task.dueDate, task.status === 'done');
  return <>
    <div className="card-top"><span className={'priority ' + task.priority}><span />{PRIORITIES[task.priority]}</span>{handle}</div>
    <button className="card-open" onClick={() => onEdit(task)} disabled={disabled || overlay}><h3>{task.title}</h3>{task.description && <p>{task.description}</p>}</button>
    {task.tags.length > 0 && <div className="card-tags">{task.tags.slice(0, 3).map(t => <span key={t}>{t}</span>)}{task.tags.length > 3 && <span>+{task.tags.length - 3}</span>}</div>}
    <div className="card-footer"><span className={due.isOverdue ? 'card-date overdue' : 'card-date'} title={due.badgeText}><CalendarDays size={13} />{task.dueDate ? due.formatted : 'Bez terminu'}</span>{task.subtasks.length > 0 && <span className="card-checklist" title="Ukończone podzadania"><CheckSquare size={13} />{task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}</span>}<span className="avatar small" style={person ? { background: person.color + '18', color: person.color } : undefined} title={person?.name ?? 'Nieprzypisane'}>{person ? person.name.split(' ').map(x => x[0]).slice(0, 2).join('') : <UserRound size={12} />}</span></div>
    {!overlay && <select className="card-stage" aria-label={'Przenieś: ' + task.title} value={task.status} disabled={disabled} onChange={e => onMove(task.id, e.target.value)}>{stages.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select>}
  </>;
}
export function TaskCard(props: Props) {
  const sortable = useSortable({ id: 'task:' + props.task.id, disabled: props.disabled, data: { task: props.task } });
  return <article ref={sortable.setNodeRef} style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }} className={'task-card' + (sortable.isDragging ? ' dragging' : '')}>
    <CardContent {...props} handle={<button ref={sortable.setActivatorNodeRef} className="drag-handle" {...sortable.attributes} {...sortable.listeners} aria-label={'Przeciągnij: ' + props.task.title} disabled={props.disabled} title="Przeciągnij lub użyj spacji i strzałek"><GripVertical size={17} /></button>} />
  </article>;
}
export function TaskOverlay(props: Props) { return <article className="task-card drag-overlay"><CardContent {...props} overlay handle={<GripVertical size={17} />} /></article>; }

