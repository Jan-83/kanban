import React, { useState } from 'react';
import { Plus, CheckCircle2, PlayCircle, CircleDot } from 'lucide-react';
import { Task, TeamMember, TaskStatus } from '../types/kanban';
import { TaskCard } from './TaskCard';

interface KanbanColumnProps {
  id: TaskStatus;
  title: string;
  tasks: Task[];
  teamMembers: TeamMember[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onMoveTaskStatus: (taskId: string, newStatus: TaskStatus) => void;
  onOpenNewTaskModalWithStatus: (status: TaskStatus) => void;
  onDropTask: (taskId: string, targetStatus: TaskStatus) => void;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  id,
  title,
  tasks,
  teamMembers,
  onEditTask,
  onDeleteTask,
  onMoveTaskStatus,
  onOpenNewTaskModalWithStatus,
  onDropTask,
}) => {
  const [isOver, setIsOver] = useState(false);

  const columnConfig = {
    todo: {
      icon: CircleDot,
      accentBorder: 'border-t-indigo-500',
      badgeColor: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
      emptyText: 'Brak zadań do zrobienia. Zaplanuj nowe zadania.',
    },
    in_progress: {
      icon: PlayCircle,
      accentBorder: 'border-t-amber-500',
      badgeColor: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
      emptyText: 'Nic nie jest aktualnie w trakcie realizacji. Przeciągnij zadanie tutaj.',
    },
    done: {
      icon: CheckCircle2,
      accentBorder: 'border-t-emerald-500',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
      emptyText: 'Brak ukończonych zadań w tym widoku.',
    },
  }[id];

  const Icon = columnConfig.icon;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(true);
  };

  const handleDragLeave = () => {
    setIsOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      onDropTask(taskId, id);
    }
  };

  const handleCardDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col bg-neutral-900/60 rounded-2xl border border-neutral-800 ${
        columnConfig.accentBorder
      } border-t-2 p-3.5 transition-colors min-h-[550px] ${
        isOver ? 'bg-neutral-800/60 ring-2 ring-indigo-500/50' : ''
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-800/80">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-neutral-400" />
          <h3 className="text-sm font-semibold text-neutral-100">{title}</h3>
          <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-medium tabular-nums ${columnConfig.badgeColor}`}>
            {tasks.length}
          </span>
        </div>

        <button
          onClick={() => onOpenNewTaskModalWithStatus(id)}
          className="p-1 rounded-md text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          title={`Dodaj zadanie do: ${title}`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Task List */}
      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {tasks.map((task) => {
          const assignee = teamMembers.find((m) => m.id === task.assigneeId);
          return (
            <TaskCard
              key={task.id}
              task={task}
              assignee={assignee}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
              onMoveStatus={onMoveTaskStatus}
              onDragStart={handleCardDragStart}
            />
          );
        })}

        {tasks.length === 0 && (
          <div className="h-36 border border-dashed border-neutral-800 rounded-xl flex flex-col items-center justify-center p-4 text-center text-xs text-neutral-500">
            <p className="max-w-[180px]">{columnConfig.emptyText}</p>
            <button
              onClick={() => onOpenNewTaskModalWithStatus(id)}
              className="mt-2 text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Dodaj zadanie
            </button>
          </div>
        )}
      </div>

      {/* Quick Add at bottom */}
      <button
        onClick={() => onOpenNewTaskModalWithStatus(id)}
        className="mt-3 py-2 px-3 border border-dashed border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/80 rounded-xl text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors flex items-center justify-center gap-1.5"
      >
        <Plus className="w-3.5 h-3.5" />
        Dodaj nowe zadanie
      </button>
    </div>
  );
};
