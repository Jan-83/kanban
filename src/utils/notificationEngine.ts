import { Task, AppNotification, TeamMember } from '../types/kanban';
import { evaluateDueDate } from './dateUtils';
import { playNotificationSound } from './sound';
import { taskAssignees } from './board';

export function scanTasksForDueNotifications(
  tasks: Task[],
  existingNotifications: AppNotification[],
  teamMembers: TeamMember[],
  playSound: boolean = false
): { updatedNotifications: AppNotification[]; newCount: number } {
  const newNotifs: AppNotification[] = [];
  const existingKeys = new Set(existingNotifications.map((n) => `${n.taskId}-${n.type}`));

  tasks.forEach((task) => {
    // Only check active tasks (not done)
    if (task.status === 'done' || !task.dueDate) return;

    const status = evaluateDueDate(task.dueDate, false);
    const assigneeName = taskAssignees(task, teamMembers).map(person => person.name).join(', ') || 'Nieprzypisane';

    if (status.isOverdue) {
      const key = `${task.id}-overdue`;
      if (!existingKeys.has(key)) {
        newNotifs.push({
          id: `notif-overdue-${task.id}-${Date.now()}`,
          taskId: task.id,
          taskTitle: task.title,
          type: 'overdue',
          title: 'Zadanie przeterminowane!',
          message: `Zadanie "${task.title}" (przypisane do: ${assigneeName}) przekroczyło ustalony termin realizacji (${status.formatted}).`,
          timestamp: new Date().toISOString(),
          read: false,
        });
        existingKeys.add(key);
      }
    } else if (status.isToday) {
      const key = `${task.id}-due_today`;
      if (!existingKeys.has(key)) {
        newNotifs.push({
          id: `notif-today-${task.id}-${Date.now()}`,
          taskId: task.id,
          taskTitle: task.title,
          type: 'due_today',
          title: 'Termin upływa dzisiaj!',
          message: `Zadanie "${task.title}" ma wyznaczony termin na dzisiaj (${status.formatted}). Osoby odpowiedzialne: ${assigneeName}.`,
          timestamp: new Date().toISOString(),
          read: false,
        });
        existingKeys.add(key);
      }
    } else if (status.isTomorrow || status.isSoon) {
      const key = `${task.id}-due_soon`;
      if (!existingKeys.has(key)) {
        newNotifs.push({
          id: `notif-soon-${task.id}-${Date.now()}`,
          taskId: task.id,
          taskTitle: task.title,
          type: 'due_soon',
          title: 'Zbliżający się termin',
          message: `Zbliża się realizacja zadania "${task.title}". Termin przypada na ${status.formatted}.`,
          timestamp: new Date().toISOString(),
          read: false,
        });
        existingKeys.add(key);
      }
    }
  });

  if (newNotifs.length > 0 && playSound) {
    playNotificationSound();

    // Browser native notification if permission granted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const first = newNotifs[0];
      try {
        new Notification(first.title, {
          body: first.message,
          icon: '/favicon.ico',
        });
      } catch {
        // Notification API fallback
      }
    }
  }

  return {
    updatedNotifications: [...newNotifs, ...existingNotifications],
    newCount: newNotifs.length,
  };
}
