import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  RotateCcw, 
  GitBranch,
  FileSpreadsheet
} from 'lucide-react';
import { Task, TeamMember, TaskStatus, TaskPriority } from '../types/kanban';
import { KanbanColumn } from './KanbanColumn';
import { evaluateDueDate } from '../utils/dateUtils';

interface KanbanBoardProps {
  tasks: Task[];
  teamMembers: TeamMember[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onMoveTaskStatus: (taskId: string, newStatus: TaskStatus) => void;
  onOpenNewTaskModalWithStatus: (status: TaskStatus) => void;
  onOpenGitHubModal: () => void;
  onExportCSV: () => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  teamMembers,
  onEditTask,
  onDeleteTask,
  onMoveTaskStatus,
  onOpenNewTaskModalWithStatus,
  onOpenGitHubModal,
  onExportCSV,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [deadlineFilter, setDeadlineFilter] = useState<string>('all');

  // Stats calculation
  const stats = useMemo(() => {
    let overdue = 0;
    let today = 0;
    let todoCount = 0;
    let inProgressCount = 0;
    let doneCount = 0;

    tasks.forEach((t) => {
      if (t.status === 'todo') todoCount++;
      if (t.status === 'in_progress') inProgressCount++;
      if (t.status === 'done') doneCount++;

      if (t.status !== 'done' && t.dueDate) {
        const evalStatus = evaluateDueDate(t.dueDate, false);
        if (evalStatus.isOverdue) overdue++;
        if (evalStatus.isToday) today++;
      }
    });

    return {
      total: tasks.length,
      overdue,
      today,
      todoCount,
      inProgressCount,
      doneCount,
    };
  }, [tasks]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Search text filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = task.title.toLowerCase().includes(query);
        const matchDesc = task.description.toLowerCase().includes(query);
        const matchTags = task.tags.some((tag) => tag.toLowerCase().includes(query));
        if (!matchTitle && !matchDesc && !matchTags) return false;
      }

      // Priority filter
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
        return false;
      }

      // Assignee filter
      if (assigneeFilter !== 'all') {
        if (assigneeFilter === 'unassigned' && task.assigneeId !== null) return false;
        if (assigneeFilter !== 'unassigned' && task.assigneeId !== assigneeFilter) return false;
      }

      // Deadline filter
      if (deadlineFilter !== 'all' && task.status !== 'done') {
        const evalStatus = evaluateDueDate(task.dueDate, false);
        if (deadlineFilter === 'overdue' && !evalStatus.isOverdue) return false;
        if (deadlineFilter === 'today' && !evalStatus.isToday) return false;
        if (deadlineFilter === 'soon' && !evalStatus.isSoon) return false;
      }

      return true;
    });
  }, [tasks, searchQuery, priorityFilter, assigneeFilter, deadlineFilter]);

  const todoTasks = filteredTasks.filter((t) => t.status === 'todo');
  const inProgressTasks = filteredTasks.filter((t) => t.status === 'in_progress');
  const doneTasks = filteredTasks.filter((t) => t.status === 'done');

  const handleDrop = (taskId: string, targetStatus: TaskStatus) => {
    onMoveTaskStatus(taskId, targetStatus);
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    priorityFilter !== 'all' ||
    assigneeFilter !== 'all' ||
    deadlineFilter !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setPriorityFilter('all');
    setAssigneeFilter('all');
    setDeadlineFilter('all');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Metrics Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200/90 shadow-2xs rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">Wszystkie zadania</div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-0.5">
              {stats.total}
            </div>
          </div>
          <span className="text-xs font-mono text-slate-400">100%</span>
        </div>

        <div className="bg-white border border-slate-200/90 shadow-2xs rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">Do zrobienia</div>
            <div className="text-xl font-bold font-mono tabular-nums text-indigo-600 mt-0.5">
              {stats.todoCount}
            </div>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {stats.total ? Math.round((stats.todoCount / stats.total) * 100) : 0}%
          </span>
        </div>

        <div className="bg-white border border-slate-200/90 shadow-2xs rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">W trakcie</div>
            <div className="text-xl font-bold font-mono tabular-nums text-amber-600 mt-0.5">
              {stats.inProgressCount}
            </div>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {stats.total ? Math.round((stats.inProgressCount / stats.total) * 100) : 0}%
          </span>
        </div>

        <div className="bg-white border border-slate-200/90 shadow-2xs rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">Zrobione</div>
            <div className="text-xl font-bold font-mono tabular-nums text-emerald-600 mt-0.5">
              {stats.doneCount}
            </div>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {stats.total ? Math.round((stats.doneCount / stats.total) * 100) : 0}%
          </span>
        </div>

        <div className="col-span-2 sm:col-span-1 bg-white border border-rose-200/90 shadow-2xs rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div className="text-xs text-rose-600 font-medium flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Przeterminowane
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-rose-600 mt-0.5">
              {stats.overdue}
            </div>
          </div>
          {stats.today > 0 && (
            <div className="text-right">
              <div className="text-[10px] text-amber-600 font-medium">Na dzisiaj:</div>
              <div className="text-xs font-bold font-mono text-amber-700">{stats.today}</div>
            </div>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Szukaj po tytule, opisie lub tagu..."
            className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-colors"
          />
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            aria-label="Filtruj po priorytecie"
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 focus:bg-white cursor-pointer"
          >
            <option value="all">Wszystkie priorytety</option>
            <option value="urgent">🔴 Pilny / Krytyczny</option>
            <option value="high">🟠 Wysoki</option>
            <option value="medium">🟡 Średni</option>
            <option value="low">⚪ Niski</option>
          </select>

          {/* Assignee filter */}
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            aria-label="Filtruj po osobie odpowiedzialnej"
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 focus:bg-white cursor-pointer"
          >
            <option value="all">Wszyscy wykonawcy</option>
            <option value="unassigned">Nieprzypisane</option>
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          {/* Deadline alert filter */}
          <select
            value={deadlineFilter}
            onChange={(e) => setDeadlineFilter(e.target.value)}
            aria-label="Filtruj po terminie realizacji"
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 focus:bg-white cursor-pointer"
          >
            <option value="all">Wszystkie terminy</option>
            <option value="overdue">⚠️ Tylko przeterminowane</option>
            <option value="today">⏰ Termin dzisiaj</option>
            <option value="soon">📅 Wkrótce (do 48h)</option>
          </select>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset filtrów
            </button>
          )}

          {/* Export CSV Report Button */}
          <button
            onClick={onExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 shadow-2xs transition-colors ml-auto cursor-pointer"
            title="Eksportuj zadania do pliku arkusza kalkulacyjnego (.csv)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Raport CSV</span>
          </button>

          {/* GitHub Quick Button */}
          <button
            onClick={onOpenGitHubModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
          >
            <GitBranch className="w-3.5 h-3.5 text-indigo-600" />
            GitHub Hub
          </button>
        </div>
      </div>

      {/* Main Kanban Board: 3 Standard Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <KanbanColumn
          id="todo"
          title="Do zrobienia"
          tasks={todoTasks}
          teamMembers={teamMembers}
          onEditTask={onEditTask}
          onDeleteTask={onDeleteTask}
          onMoveTaskStatus={onMoveTaskStatus}
          onOpenNewTaskModalWithStatus={onOpenNewTaskModalWithStatus}
          onDropTask={handleDrop}
        />

        <KanbanColumn
          id="in_progress"
          title="W trakcie"
          tasks={inProgressTasks}
          teamMembers={teamMembers}
          onEditTask={onEditTask}
          onDeleteTask={onDeleteTask}
          onMoveTaskStatus={onMoveTaskStatus}
          onOpenNewTaskModalWithStatus={onOpenNewTaskModalWithStatus}
          onDropTask={handleDrop}
        />

        <KanbanColumn
          id="done"
          title="Zrobione"
          tasks={doneTasks}
          teamMembers={teamMembers}
          onEditTask={onEditTask}
          onDeleteTask={onDeleteTask}
          onMoveTaskStatus={onMoveTaskStatus}
          onOpenNewTaskModalWithStatus={onOpenNewTaskModalWithStatus}
          onDropTask={handleDrop}
        />
      </div>
    </div>
  );
};
