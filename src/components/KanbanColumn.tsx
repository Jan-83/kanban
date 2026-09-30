import { Plus } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { BoardStage, Task, TeamMember } from '../types/kanban';
import { TaskCard } from './TaskCard';
interface Props { stage: BoardStage; stages: BoardStage[]; tasks: Task[]; total: number; members: TeamMember[]; onNew: (id: string) => void; onEdit: (task: Task) => void; onMove: (id: string, stage: string) => void; onAssign?: (id: string, assigneeId: string | null) => void; disabled: boolean; }
export function KanbanColumn({ stage, stages, tasks, total, members, onNew, onEdit, onMove, onAssign, disabled }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: 'stage:' + stage.id, disabled });
  return <section ref={setNodeRef} className={'kanban-column' + (isOver ? ' drop-target' : '')} aria-label={stage.title} style={{ '--stage-color': stage.color } as React.CSSProperties}>
    <div className="column-heading"><span className="stage-dot" /><h2>{stage.title}</h2><span className="count">{tasks.length}{tasks.length !== total && '/' + total}</span><button className="icon-button" onClick={() => onNew(stage.id)} disabled={disabled} aria-label={'Dodaj zadanie: ' + stage.title}><Plus size={16} /></button></div>
    <SortableContext items={tasks.map(t => 'task:' + t.id)} strategy={verticalListSortingStrategy}>
      <div className="column-cards">{tasks.map(task => <TaskCard key={task.id} task={task} stages={stages} teamMembers={members} onEdit={onEdit} onMove={onMove} onAssign={onAssign} disabled={disabled} />)}
        {!tasks.length && <p className="column-empty">{total ? 'Brak wyników dla tych filtrów' : 'Przenieś tutaj zadanie'}</p>}
      </div>
    </SortableContext>
    <button className="column-add" onClick={() => onNew(stage.id)} disabled={disabled}><Plus size={15} />Dodaj zadanie</button>
  </section>;
}

