import React from 'react';
import { 
  Clock, 
  AlertCircle, 
  CheckSquare, 
  MoreVertical, 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  Edit3, 
  GitPullRequest 
} from 'lucide-react';
import { Task, TeamMember, TaskStatus } from '../types/kanban';
import { evaluateDueDate } from '../utils/dateUtils';

interface TaskCardProps {
  task: Task;
  assignee?: TeamMember;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onMoveStatus: (taskId: string, newStatus: TaskStatus) => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  assignee,
  onEdit,
  onDelete,
  onMoveStatus,
  onDragStart,
}) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const dueStatus = evaluateDueDate(task.dueDate, task.status === 'done');

  const priorityConfig = {
    low: { label: 'Niski', color: 'text-neutral-400', dot: 'bg-neutral-500' },
    medium: { label: 'Średni', color: 'text-sky-400', dot: 'bg-sky-400' },
    high: { label: 'Wysoki', color: 'text-amber-400', dot: 'bg-amber-400' },
    urgent: { label: 'Pilny', color: 'text-rose-400', dot: 'bg-rose-500 animate-pulse' },
  }[task.priority];

  const totalSubtasks = task.subtasks.length;
  const completedSubtasks = task.subtasks.filter((st) => st.completed).length;

  const nextStatusMap: Record<TaskStatus, TaskStatus | null> = {
    todo: 'in_progress',
    in_progress: 'done',
    done: null,
  };

  const prevStatusMap: Record<TaskStatus, TaskStatus | null> = {
    todo: null,
    in_progress: 'todo',
    done: 'in_progress',
  };

  const nextStatus = nextStatusMap[task.status];
  const prevStatus = prevStatusMap[task.status];

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      className={`group relative bg-neutral-900 border rounded-xl p-4 transition-all duration-150 hover:shadow-lg cursor-grab active:cursor-grabbing ${
        dueStatus.isOverdue && task.status !== 'done'
          ? 'border-rose-800/80 bg-rose-950/20 shadow-rose-900/10'
          : dueStatus.isToday && task.status !== 'done'
          ? 'border-amber-800/60 bg-amber-950/15'
          : 'border-neutral-800 hover:border-neutral-700 bg-neutral-900/90'
      }`}
    >
      {/* Top Header of Card: Priority & Menu */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <span className={`w-2 h-2 rounded-full ${priorityConfig.dot}`} />
          <span className={priorityConfig.color}>{priorityConfig.label}</span>
          {task.githubIssueNumber && (
            <>
              <span className="text-neutral-600" aria-hidden="true">·</span>
              <span className="text-[11px] font-mono text-neutral-400 flex items-center gap-0.5">
                <GitPullRequest className="w-3 h-3 text-neutral-500" />
                #{task.githubIssueNumber}
              </span>
            </>
          )}
        </div>

        {/* Quick Menu */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
            aria-label="Opcje zadania"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-6 z-20 w-44 bg-neutral-950 border border-neutral-800 rounded-lg shadow-xl py-1 text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onEdit(task);
                }}
                className="w-full px-3 py-1.5 text-left text-neutral-200 hover:bg-neutral-900 flex items-center gap-2"
              >
                <Edit3 className="w-3.5 h-3.5 text-neutral-400" />
                Edytuj zadanie
              </button>
              {prevStatus && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onMoveStatus(task.id, prevStatus);
                  }}
                  className="w-full px-3 py-1.5 text-left text-neutral-300 hover:bg-neutral-900 flex items-center gap-2"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Cofnij kolumnę
                </button>
              )}
              {nextStatus && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onMoveStatus(task.id, nextStatus);
                  }}
                  className="w-full px-3 py-1.5 text-left text-neutral-300 hover:bg-neutral-900 flex items-center gap-2"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                  Przesuń dalej
                </button>
              )}
              <hr className="my-1 border-neutral-800" />
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(task.id);
                }}
                className="w-full px-3 py-1.5 text-left text-rose-400 hover:bg-rose-950/30 flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Usuń zadanie
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Task Title & Description */}
      <h4
        onClick={() => onEdit(task)}
        className="text-sm font-semibold text-neutral-100 hover:text-indigo-400 transition-colors leading-snug cursor-pointer mb-1.5 line-clamp-2"
      >
        {task.title}
      </h4>

      {task.description && (
        <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed mb-3">
          {task.description}
        </p>
      )}

      {/* Tags rendered as clean unboxed text metadata */}
      {task.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-400 mb-3">
          {task.tags.map((tag, idx) => (
            <React.Fragment key={tag}>
              {idx > 0 && <span className="text-neutral-600">/</span>}
              <span className="text-neutral-400 font-mono">#{tag}</span>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Checklist Progress if present */}
      {totalSubtasks > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1">
            <span className="flex items-center gap-1">
              <CheckSquare className="w-3 h-3 text-neutral-500" />
              Zadania cząstkowe
            </span>
            <span className="font-mono tabular-nums">
              {completedSubtasks}/{totalSubtasks}
            </span>
          </div>
          <div className="w-full bg-neutral-800 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                completedSubtasks === totalSubtasks ? 'bg-emerald-500' : 'bg-indigo-500'
              }`}
              style={{ width: `${(completedSubtasks / totalSubtasks) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Card Footer: Due Date, Assignee, Quick shift buttons */}
      <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between gap-2">
        {/* Due Date Indicator */}
        <div className="flex items-center gap-1.5 text-xs font-mono">
          {dueStatus.isOverdue && task.status !== 'done' ? (
            <span className="flex items-center gap-1 text-rose-400 font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{dueStatus.badgeText}</span>
            </span>
          ) : dueStatus.isToday && task.status !== 'done' ? (
            <span className="flex items-center gap-1 text-amber-400 font-medium">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>{dueStatus.badgeText}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-neutral-400">
              <Clock className="w-3.5 h-3.5 shrink-0 text-neutral-500" />
              <span>{dueStatus.formatted}</span>
            </span>
          )}
        </div>

        {/* Right side: Assignee Avatar + Fast Movement Buttons */}
        <div className="flex items-center gap-2">
          {/* Quick Column Shift for convenience */}
          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
            {prevStatus && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveStatus(task.id, prevStatus);
                }}
                title="Cofnij do poprzedniej kolumny"
                className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            )}
            {nextStatus && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveStatus(task.id, nextStatus);
                }}
                title="Przesuń do kolejnej kolumny"
                className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Assignee Avatar */}
          {assignee ? (
            <div
              className="relative group/avatar"
              title={`${assignee.name} (${assignee.role})`}
            >
              {assignee.avatarUrl ? (
                <img
                  src={assignee.avatarUrl}
                  alt={assignee.name}
                  referrerPolicy="no-referrer"
                  className="w-6 h-6 rounded-full object-cover ring-1 ring-neutral-700"
                />
              ) : (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-1 ring-neutral-700"
                  style={{ backgroundColor: assignee.color }}
                >
                  {assignee.name.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
          ) : (
            <span className="text-[10px] text-neutral-500 font-mono">Brak osoby</span>
          )}
        </div>
      </div>
    </div>
  );
};
