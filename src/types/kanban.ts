export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TaskStatus = string;

export interface BoardStage { id: string; title: string; color: string; }
export interface BoardData { tasks: Task[]; members: TeamMember[]; stages: BoardStage[]; }
export interface BoardSnapshot { data: BoardData; revision: number; }
export interface BoardUser { id: string; name: string; email: string; role: 'admin' | 'member'; }

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string; // ISO string YYYY-MM-DD or YYYY-MM-DDTHH:mm
  assigneeId: string | null;
  tags: string[];
  subtasks: Subtask[];
  createdAt: string;
  updatedAt: string;
  githubIssueNumber?: number;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
  status: 'active' | 'invited';
  invitedAt?: string;
  color: string;
}

export type NotificationType = 'overdue' | 'due_today' | 'due_soon' | 'assigned' | 'system';

export interface AppNotification {
  id: string;
  taskId?: string;
  taskTitle?: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface GitHubRepoConfig {
  repoName: string;
  owner: string;
  branch: string;
  isConnected: boolean;
  lastSyncedAt?: string;
  autoSync: boolean;
  webhookActive: boolean;
}

export type ActiveTab = 'board' | 'list' | 'timeline' | 'team' | 'github';
