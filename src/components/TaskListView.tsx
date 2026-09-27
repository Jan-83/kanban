import React, { useState } from 'react';
import { 
  Plus, 
  ArrowUpDown, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  CircleDot, 
  PlayCircle, 
  Edit3, 
  Trash2, 
  Tag,
  FileSpreadsheet
} from 'lucide-react';
import { Task, TeamMember, TaskStatus, TaskPriority } from '../types/kanban';
import { evaluateDueDate } from '../utils/dateUtils';

interface TaskListViewProps {
  tasks: Task[];
  teamMembers: TeamMember[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onMoveTaskStatus: (taskId: string, newStatus: TaskStatus) => void;
  onOpenNewTaskModal: () => void;
  onExportCSV: () => void;
}

export const TaskListView: React.FC<TaskListViewProps> = ({
  tasks,
  teamMembers,
  onEditTask,
  onDeleteTask,
  onMoveTaskStatus,
  onOpenNewTaskModal,
  onExportCSV,
}) => {
  const [sortField, setSortField] = useState<'dueDate' | 'priority' | 'status' | 'title'>('dueDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const priorityWeights: Record<TaskPriority, number> = {
    urgent: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  const handleSort = (field: 'dueDate' | 'priority' | 'status' | 'title') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    return true;
  });

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    let comp = 0;
    if (sortField === 'dueDate') {
      const aTime = a.dueDate ? new Date(a.dueDate).getTime() : 9999999999999;
      const bTime = b.dueDate ? new Date(b.dueDate).getTime() : 9999999999999;
      comp = aTime - bTime;
    } else if (sortField === 'priority') {
      comp = priorityWeights[b.priority] - priorityWeights[a.priority];
    } else if (sortField === 'status') {
      comp = a.status.localeCompare(b.status);
    } else if (sortField === 'title') {
      comp = a.title.localeCompare(b.title);
    }
    return sortOrder === 'asc' ? comp : -comp;
  });

  const priorityLabels = {
    urgent: { label: 'Pilny', dot: 'bg-rose-500' },
    high: { label: 'Wysoki', dot: 'bg-amber-500' },
    medium: { label: 'Średni', dot: 'bg-sky-500' },
    low: { label: 'Niski', dot: 'bg-slate-400' },
  };

  return (
    <div className="space-y-4">
      {/* Control bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200/90 shadow-2xs rounded-xl p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Pokaż:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 focus:bg-white cursor-pointer"
          >
            <option value="all">Wszystkie statusy</option>
            <option value="todo">Do zrobienia</option>
            <option value="in_progress">W trakcie</option>
            <option value="done">Zrobione</option>
          </select>
          <span className="text-xs font-mono text-slate-500 tabular-nums ml-2">
            Znaleziono: {sortedTasks.length} zadań
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 shadow-2xs transition-colors cursor-pointer"
            title="Pobierz aktualną listę zadań w formacie CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Eksport CSV</span>
          </button>

          <button
            onClick={onOpenNewTaskModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm shadow-indigo-600/20 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Dodaj zadanie
          </button>
        </div>
      </div>

      {/* Task Table */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th
                  onClick={() => handleSort('title')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-900"
                >
                  <div className="flex items-center gap-1">
                    Zadanie
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('status')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-900"
                >
                  <div className="flex items-center gap-1">
                    Status
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('priority')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-900"
                >
                  <div className="flex items-center gap-1">
                    Priorytet
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('dueDate')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-900"
                >
                  <div className="flex items-center gap-1">
                    Termin realizacji
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4">Odpowiedzialny</th>
                <th className="py-3 px-4 text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedTasks.map((task) => {
                const due = evaluateDueDate(task.dueDate, task.status === 'done');
                const assignee = teamMembers.find((m) => m.id === task.assigneeId);

                return (
                  <tr
                    key={task.id}
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    onClick={() => onEditTask(task)}
                  >
                    {/* Task Title & Details */}
                    <td className="py-3 px-4 max-w-[280px]">
                      <div className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-1">
                        {task.title}
                      </div>
                      {task.tags.length > 0 && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono mt-0.5">
                          {task.tags.map((t) => (
                            <span key={t}>#{t}</span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Status dropdown inline */}
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={task.status}
                        onChange={(e) => onMoveTaskStatus(task.id, e.target.value as TaskStatus)}
                        className={`text-xs rounded-lg px-2 py-1 font-medium border bg-white focus:outline-none cursor-pointer ${
                          task.status === 'done'
                            ? 'text-emerald-700 border-emerald-200 bg-emerald-50'
                            : task.status === 'in_progress'
                            ? 'text-amber-700 border-amber-200 bg-amber-50'
                            : 'text-indigo-700 border-indigo-200 bg-indigo-50'
                        }`}
                      >
                        <option value="todo">Do zrobienia</option>
                        <option value="in_progress">W trakcie</option>
                        <option value="done">Zrobione</option>
                      </select>
                    </td>

                    {/* Priority */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${priorityLabels[task.priority].dot}`} />
                        <span>{priorityLabels[task.priority].label}</span>
                      </div>
                    </td>

                    {/* Due Date with alerts */}
                    <td className="py-3 px-4 font-mono">
                      {due.isOverdue && task.status !== 'done' ? (
                        <div className="flex items-center gap-1.5 text-rose-600 font-medium">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{due.badgeText}</span>
                        </div>
                      ) : due.isToday && task.status !== 'done' ? (
                        <div className="flex items-center gap-1.5 text-amber-600 font-medium">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span>{due.badgeText}</span>
                        </div>
                      ) : (
                        <div className="text-slate-500">
                          {due.formatted}
                        </div>
                      )}
                    </td>

                    {/* Assignee */}
                    <td className="py-3 px-4">
                      {assignee ? (
                        <div className="flex items-center gap-2">
                          {assignee.avatarUrl ? (
                            <img
                              src={assignee.avatarUrl}
                              alt={assignee.name}
                              referrerPolicy="no-referrer"
                              className="w-5 h-5 rounded-full object-cover ring-1 ring-slate-200"
                            />
                          ) : (
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white ring-1 ring-slate-200 shadow-2xs"
                              style={{ backgroundColor: assignee.color }}
                            >
                              {assignee.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <span className="text-xs text-slate-700">{assignee.name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onEditTask(task)}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                          title="Edytuj"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Czy na pewno chcesz usunąć to zadanie?')) {
                              onDeleteTask(task.id);
                            }
                          }}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                          title="Usuń"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {sortedTasks.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Brak zadań w wybranym filtrze.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
