import React from 'react';
import { 
  AlertTriangle, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  User, 
  Plus, 
  CalendarClock 
} from 'lucide-react';
import { Task, TeamMember } from '../types/kanban';
import { evaluateDueDate } from '../utils/dateUtils';

interface TimelineCalendarViewProps {
  tasks: Task[];
  teamMembers: TeamMember[];
  onEditTask: (task: Task) => void;
  onOpenNewTaskModal: () => void;
}

export const TimelineCalendarView: React.FC<TimelineCalendarViewProps> = ({
  tasks,
  teamMembers,
  onEditTask,
  onOpenNewTaskModal,
}) => {
  // Categorize tasks by due date urgency
  const overdueTasks: Task[] = [];
  const todayTasks: Task[] = [];
  const tomorrowTasks: Task[] = [];
  const upcomingTasks: Task[] = [];
  const completedTasks: Task[] = [];

  tasks.forEach((task) => {
    if (task.status === 'done') {
      completedTasks.push(task);
      return;
    }

    const evalStatus = evaluateDueDate(task.dueDate, false);
    if (evalStatus.isOverdue) {
      overdueTasks.push(task);
    } else if (evalStatus.isToday) {
      todayTasks.push(task);
    } else if (evalStatus.isTomorrow || evalStatus.isSoon) {
      tomorrowTasks.push(task);
    } else {
      upcomingTasks.push(task);
    }
  });

  const renderTaskSection = (
    title: string,
    tasksList: Task[],
    icon: React.ReactNode,
    badgeBg: string,
    emptyMessage: string
  ) => (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold text-neutral-100">{title}</h3>
          <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-medium ${badgeBg}`}>
            {tasksList.length}
          </span>
        </div>
      </div>

      {tasksList.length === 0 ? (
        <div className="py-4 text-center text-xs text-neutral-500">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-2.5">
          {tasksList.map((task) => {
            const due = evaluateDueDate(task.dueDate, task.status === 'done');
            const assignee = teamMembers.find((m) => m.id === task.assigneeId);

            return (
              <div
                key={task.id}
                onClick={() => onEditTask(task)}
                className="group flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-neutral-950/70 border border-neutral-800/80 hover:border-neutral-700 transition-colors cursor-pointer gap-2"
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5">
                    {task.status === 'done' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : due.isOverdue ? (
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                    ) : due.isToday ? (
                      <Clock className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Calendar className="w-4 h-4 text-indigo-400" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-neutral-100 group-hover:text-indigo-400 transition-colors">
                      {task.title}
                    </h4>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-400 mt-0.5">
                      <span className="font-mono">{due.badgeText}</span>
                      <span className="text-neutral-600">·</span>
                      <span className="capitalize text-neutral-400">
                        {task.status === 'todo'
                          ? 'Do zrobienia'
                          : task.status === 'in_progress'
                          ? 'W trakcie'
                          : 'Zrobione'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pl-6 sm:pl-0">
                  {assignee && (
                    <div className="flex items-center gap-1.5 text-xs text-neutral-300">
                      {assignee.avatarUrl ? (
                        <img
                          src={assignee.avatarUrl}
                          alt={assignee.name}
                          referrerPolicy="no-referrer"
                          className="w-5 h-5 rounded-full object-cover ring-1 ring-neutral-700"
                        />
                      ) : (
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                          style={{ backgroundColor: assignee.color }}
                        >
                          {assignee.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className="text-[11px]">{assignee.name}</span>
                    </div>
                  )}

                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">
                    {due.formatted}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex items-center justify-between bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-indigo-400" />
            Harmonogram i Monitor Terminów
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Zautomatyzowane monitorowanie zbliżających się terminów realizacji zadań w projekcie.
          </p>
        </div>

        <button
          onClick={onOpenNewTaskModal}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Zaplanuj zadanie
        </button>
      </div>

      <div className="space-y-4">
        {/* Overdue Section */}
        {renderTaskSection(
          'Wymagają natychmiastowej uwagi (Przeterminowane)',
          overdueTasks,
          <AlertTriangle className="w-4 h-4 text-rose-500" />,
          'bg-rose-950/60 text-rose-400 border border-rose-800/80',
          'Wspaniale! Brak zadań z przekroczonym terminem.'
        )}

        {/* Due Today */}
        {renderTaskSection(
          'Termin realizacji: DZISIAJ',
          todayTasks,
          <Clock className="w-4 h-4 text-amber-500" />,
          'bg-amber-950/60 text-amber-400 border border-amber-800/80',
          'Brak zadań wyznaczonych na dzisiaj.'
        )}

        {/* Due Tomorrow / Soon */}
        {renderTaskSection(
          'Zbliżające się w ciągu najbliższych 48 godzin',
          tomorrowTasks,
          <Calendar className="w-4 h-4 text-indigo-400" />,
          'bg-indigo-950/60 text-indigo-400 border border-indigo-800/80',
          'Brak zadań w horyzoncie 48 godzin.'
        )}

        {/* Upcoming */}
        {renderTaskSection(
          'Kolejne zaplanowane terminy',
          upcomingTasks,
          <CalendarClock className="w-4 h-4 text-neutral-400" />,
          'bg-neutral-800 text-neutral-300',
          'Brak dalszych zaplanowanych terminów.'
        )}

        {/* Completed */}
        {renderTaskSection(
          'Ukończone zadania',
          completedTasks,
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
          'bg-emerald-950/60 text-emerald-400 border border-emerald-800/80',
          'Brak zakończonych zadań.'
        )}
      </div>
    </div>
  );
};
