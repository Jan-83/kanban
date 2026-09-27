/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Task, 
  TeamMember, 
  AppNotification, 
  TaskStatus, 
  ActiveTab, 
  GitHubRepoConfig 
} from './types/kanban';
import { 
  loadTasksFromStorage, 
  saveTasksToStorage, 
  loadMembersFromStorage, 
  saveMembersToStorage, 
  loadNotificationsFromStorage, 
  saveNotificationsToStorage, 
  loadGitHubConfigFromStorage, 
  saveGitHubConfigToStorage 
} from './utils/storage';
import { scanTasksForDueNotifications } from './utils/notificationEngine';
import { evaluateDueDate } from './utils/dateUtils';
import { exportTasksToCSV } from './utils/githubExport';
import { Navbar } from './components/Navbar';
import { KanbanBoard } from './components/KanbanBoard';
import { TaskListView } from './components/TaskListView';
import { TimelineCalendarView } from './components/TimelineCalendarView';
import { TeamView } from './components/TeamView';
import { GitHubModal } from './components/GitHubModal';
import { TaskModal } from './components/TaskModal';
import { NotificationsDrawer } from './components/NotificationsDrawer';
import { AlertCircle, CheckCircle2, Bell } from 'lucide-react';

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(loadTasksFromStorage);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(loadMembersFromStorage);
  const [notifications, setNotifications] = useState<AppNotification[]>(loadNotificationsFromStorage);
  const [githubConfig, setGitHubConfig] = useState<GitHubRepoConfig>(loadGitHubConfigFromStorage);

  const [activeTab, setActiveTab] = useState<ActiveTab>('board');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [modalDefaultStatus, setModalDefaultStatus] = useState<TaskStatus>('todo');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Active toast banner for deadline or task updates
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'info' | 'success' | 'alert' } | null>(null);

  const showToast = useCallback((text: string, type: 'info' | 'success' | 'alert' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  }, []);

  // Save states to local storage
  useEffect(() => {
    saveTasksToStorage(tasks);
  }, [tasks]);

  useEffect(() => {
    saveMembersToStorage(teamMembers);
  }, [teamMembers]);

  useEffect(() => {
    saveNotificationsToStorage(notifications);
  }, [notifications]);

  useEffect(() => {
    saveGitHubConfigToStorage(githubConfig);
  }, [githubConfig]);

  // Automated Deadline Notification Scanner
  const runDeadlineCheck = useCallback((playSound = false) => {
    setNotifications((prevNotifs) => {
      const { updatedNotifications, newCount } = scanTasksForDueNotifications(
        tasks,
        prevNotifs,
        teamMembers,
        playSound
      );
      if (newCount > 0) {
        showToast(`Wykryto ${newCount} nowe powiadomienie(a) o zbliżających się lub przekroczonych terminach!`, 'alert');
      }
      return updatedNotifications;
    });
  }, [tasks, teamMembers, showToast]);

  // Initial scan on mount and periodic interval every 30 seconds
  useEffect(() => {
    runDeadlineCheck(false);

    const interval = setInterval(() => {
      runDeadlineCheck(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [runDeadlineCheck]);

  // Calculate overdue & today counts
  const { overdueCount, todayCount } = useMemo(() => {
    let overdue = 0;
    let today = 0;
    tasks.forEach((t) => {
      if (t.status !== 'done' && t.dueDate) {
        const evalStatus = evaluateDueDate(t.dueDate, false);
        if (evalStatus.isOverdue) overdue++;
        if (evalStatus.isToday) today++;
      }
    });
    return { overdueCount: overdue, todayCount: today };
  }, [tasks]);

  // Task Actions
  const handleOpenNewTaskModal = (status: TaskStatus = 'todo') => {
    setEditingTask(null);
    setModalDefaultStatus(status);
    setIsTaskModalOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    const now = new Date().toISOString();
    if (taskData.id) {
      // Update existing task
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskData.id
            ? {
                ...t,
                ...taskData,
                updatedAt: now,
              }
            : t
        )
      );
      showToast(`Zaktualizowano zadanie "${taskData.title}"`, 'success');
    } else {
      // Create new task
      const newTask: Task = {
        ...taskData,
        id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        createdAt: now,
        updatedAt: now,
      };
      setTasks((prev) => [newTask, ...prev]);
      showToast(`Utworzono nowe zadanie "${newTask.title}"`, 'success');

      // Check if newly created task has immediate deadline
      setTimeout(() => runDeadlineCheck(true), 300);
    }
  };

  const handleDeleteTask = (taskId: string) => {
    const taskToDelete = tasks.find((t) => t.id === taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    if (taskToDelete) {
      showToast(`Usunięto zadanie "${taskToDelete.title}"`, 'info');
    }
  };

  const handleMoveTaskStatus = (taskId: string, newStatus: TaskStatus) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus, updatedAt: new Date().toISOString() } : t))
    );
    const task = tasks.find((t) => t.id === taskId);
    const statusLabels: Record<TaskStatus, string> = {
      todo: 'Do zrobienia',
      in_progress: 'W trakcie',
      done: 'Zrobione',
    };
    if (task) {
      showToast(`Przeniesiono zadanie do: ${statusLabels[newStatus]}`, 'info');
    }
  };

  // Team Member Actions
  const handleAddMember = (newMemberData: Omit<TeamMember, 'id'>) => {
    const newMember: TeamMember = {
      ...newMemberData,
      id: `user-${Date.now()}`,
    };
    setTeamMembers((prev) => [...prev, newMember]);
    showToast(`Pomyślnie dodano ${newMember.name} do zespołu!`, 'success');
  };

  const handleRemoveMember = (memberId: string) => {
    setTeamMembers((prev) => prev.filter((m) => m.id !== memberId));
    // Clear assignees for this user
    setTasks((prev) =>
      prev.map((t) => (t.assigneeId === memberId ? { ...t, assigneeId: null } : t))
    );
    showToast('Usunięto członka zespołu z projektu', 'info');
  };

  // Notification Actions
  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
  };

  const handleSelectTaskFromNotification = (taskId: string) => {
    const found = tasks.find((t) => t.id === taskId);
    if (found) {
      setEditingTask(found);
      setIsTaskModalOpen(true);
    }
  };

  const handleExportCSV = useCallback(() => {
    if (tasks.length === 0) {
      showToast('Brak zadań do wyeksportowania', 'info');
      return;
    }
    exportTasksToCSV(tasks, teamMembers);
    showToast(`Pomyślnie wyeksportowano ${tasks.length} zadań do pliku CSV!`, 'success');
  }, [tasks, teamMembers, showToast]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenNewTaskModal={() => handleOpenNewTaskModal('todo')}
        onToggleNotifications={() => setIsNotificationsOpen(!isNotificationsOpen)}
        onExportCSV={handleExportCSV}
        notifications={notifications}
        isNotificationsOpen={isNotificationsOpen}
        overdueCount={overdueCount}
        todayCount={todayCount}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div
            className={`p-3.5 rounded-xl border shadow-xl flex items-center gap-2.5 text-xs font-medium backdrop-blur-md ${
              toastMessage.type === 'alert'
                ? 'bg-rose-50/95 border-rose-200 text-rose-900 shadow-rose-200/50'
                : toastMessage.type === 'success'
                ? 'bg-emerald-50/95 border-emerald-200 text-emerald-900 shadow-emerald-200/50'
                : 'bg-white/95 border-slate-200 text-slate-800 shadow-slate-200/60'
            }`}
          >
            {toastMessage.type === 'alert' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <Bell className="w-4 h-4 text-indigo-600 shrink-0" />
            )}
            <span className="flex-1">{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'board' && (
          <KanbanBoard
            tasks={tasks}
            teamMembers={teamMembers}
            onEditTask={handleEditTask}
            onDeleteTask={handleDeleteTask}
            onMoveTaskStatus={handleMoveTaskStatus}
            onOpenNewTaskModalWithStatus={handleOpenNewTaskModal}
            onOpenGitHubModal={() => setActiveTab('github')}
            onExportCSV={handleExportCSV}
          />
        )}

        {activeTab === 'list' && (
          <TaskListView
            tasks={tasks}
            teamMembers={teamMembers}
            onEditTask={handleEditTask}
            onDeleteTask={handleDeleteTask}
            onMoveTaskStatus={handleMoveTaskStatus}
            onOpenNewTaskModal={() => handleOpenNewTaskModal('todo')}
            onExportCSV={handleExportCSV}
          />
        )}

        {activeTab === 'timeline' && (
          <TimelineCalendarView
            tasks={tasks}
            teamMembers={teamMembers}
            onEditTask={handleEditTask}
            onOpenNewTaskModal={() => handleOpenNewTaskModal('todo')}
          />
        )}

        {activeTab === 'team' && (
          <TeamView
            teamMembers={teamMembers}
            tasks={tasks}
            onAddMember={handleAddMember}
            onRemoveMember={handleRemoveMember}
          />
        )}

        {activeTab === 'github' && (
          <GitHubModal
            config={githubConfig}
            onUpdateConfig={setGitHubConfig}
            tasks={tasks}
            teamMembers={teamMembers}
          />
        )}
      </main>

      {/* Modal for Creating & Editing Tasks */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        initialTask={editingTask}
        defaultStatus={modalDefaultStatus}
        teamMembers={teamMembers}
      />

      {/* Notifications Drawer */}
      <NotificationsDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAllAsRead={handleMarkAllAsRead}
        onClearAll={handleClearAllNotifications}
        onSelectTask={handleSelectTaskFromNotification}
      />

      {/* Subtle, clean footer */}
      <footer className="border-t border-neutral-900 bg-neutral-950 py-4 text-center text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            KanbanFlow &copy; 2026. Zsynchronizowano z repozytorium GitHub.
          </div>
          <div className="flex items-center gap-4 text-[11px] text-neutral-400">
            <span>Kolumny: Do zrobienia · W trakcie · Zrobione</span>
            <span>·</span>
            <span>Automatyczny nadzór terminów aktywny</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
