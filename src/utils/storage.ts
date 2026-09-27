import { Task, TeamMember, AppNotification, GitHubRepoConfig } from '../types/kanban';

const STORAGE_KEYS = {
  TASKS: 'kanban_tasks_v2',
  MEMBERS: 'kanban_members_v2',
  NOTIFICATIONS: 'kanban_notifications_v1',
  GITHUB: 'kanban_github_v3',
  SETTINGS: 'kanban_settings_v1',
};

const getRelativeDateString = (offsetDays: number, hour: number = 18): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, 0, 0, 0);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const INITIAL_MEMBERS: TeamMember[] = [
  {
    id: 'user-daro',
    name: 'Administrator (Daro)',
    email: 'darecki.maj@gmail.com',
    role: 'Projekt Lead & Admin',
    status: 'active',
    color: '#6366F1', // indigo
  },
  {
    id: 'user-janek',
    name: 'Janek',
    email: 'janek@deli.pl',
    role: 'Frontend Developer',
    status: 'active',
    color: '#06B6D4', // cyan
  },
  {
    id: 'user-marek',
    name: 'Marek',
    email: 'marek@deli.pl',
    role: 'Backend Developer',
    status: 'active',
    color: '#10B981', // emerald
  },
  {
    id: 'user-darek',
    name: 'Darek',
    email: 'darek@deli.pl',
    role: 'Full-Stack Developer',
    status: 'active',
    color: '#F59E0B', // amber
  },
];

export const INITIAL_TASKS: Task[] = [
  {
    id: 'task-1',
    title: 'Przygotować schemat bazy danych i API repozytorium',
    description: 'Zaprojektować modele danych dla synchronizacji zadań z GitHub Webhooks oraz zapisać strukturę w formacie JSON i OpenAPI.',
    status: 'todo',
    priority: 'urgent',
    dueDate: getRelativeDateString(-1, 14), // Przeterminowane o 1 dzień!
    assigneeId: 'user-marek',
    tags: ['Backend', 'Architektura', 'GitHub'],
    subtasks: [
      { id: 'sub-1', title: 'Definicja encji zadań i powiadomień', completed: true },
      { id: 'sub-2', title: 'Walidacja schematu w TypeScript', completed: false },
      { id: 'sub-3', title: 'Przetestowanie webhooków GitHub', completed: false },
    ],
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    githubIssueNumber: 101,
  },
  {
    id: 'task-2',
    title: 'Wdrożyć powiadomienia e-mail i push o terminach zadań',
    description: 'Automatyczne sprawdzanie zadań ze zbliżającym się terminem poniżej 24h oraz generowanie alertów dźwiękowych i toastów w interfejsie.',
    status: 'todo',
    priority: 'high',
    dueDate: getRelativeDateString(0, 19), // Dzisiaj o 19:00!
    assigneeId: 'user-daro',
    tags: ['Powiadomienia', 'Frontend', 'Terminy'],
    subtasks: [
      { id: 'sub-4', title: 'Integracja z Web Audio API dla dźwięku', completed: true },
      { id: 'sub-5', title: 'Komponent panelu powiadomień', completed: true },
      { id: 'sub-6', title: 'Cykl automatycznego skanowania terminów', completed: false },
    ],
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    githubIssueNumber: 102,
  },
  {
    id: 'task-3',
    title: 'Projekt interfejsu przeciągania kart (Drag & Drop)',
    description: 'Optymalizacja UX i animacji przy przenoszeniu zadań pomiędzy kolumnami Do zrobienia, W trakcie oraz Zrobione.',
    status: 'in_progress',
    priority: 'high',
    dueDate: getRelativeDateString(1, 16), // Jutro o 16:00!
    assigneeId: 'user-janek',
    tags: ['Frontend', 'UI/UX', 'Animacje'],
    subtasks: [
      { id: 'sub-7', title: 'Stan hover nad kolumną docelową', completed: true },
      { id: 'sub-8', title: 'Szybkie przyciski przenoszenia na mobile', completed: true },
      { id: 'sub-9', title: 'Wskaźnik upuszczenia karty', completed: false },
    ],
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    githubIssueNumber: 103,
  },
  {
    id: 'task-4',
    title: 'Moduł zapraszania osób i generowanie linków aktywacyjnych',
    description: 'Formularz dodawania współpracowników, wybór roli w projekcie oraz automatyczne tworzenie linku zaproszenia z możliwością kopiowania.',
    status: 'in_progress',
    priority: 'medium',
    dueDate: getRelativeDateString(3, 17), // Za 3 dni
    assigneeId: 'user-darek',
    tags: ['Zespół', 'Dostęp', 'Funkcje'],
    subtasks: [
      { id: 'sub-10', title: 'Formularz z walidacją e-mail', completed: true },
      { id: 'sub-11', title: 'Kopiowanie linku do schowka', completed: true },
      { id: 'sub-12', title: 'Podgląd listy zaproszonych', completed: false },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    githubIssueNumber: 104,
  },
  {
    id: 'task-5',
    title: 'Połączenie z nowym repozytorium GitHub i eksport kodu',
    description: 'Przygotowanie gotowego szablonu repozytorium z plikami workflow, automatycznym eksportem zadań do GitHub Issues i instrukcją podpięcia git remote.',
    status: 'done',
    priority: 'medium',
    dueDate: getRelativeDateString(-2, 12),
    assigneeId: 'user-daro',
    tags: ['GitHub', 'DevOps', 'Hosting'],
    subtasks: [
      { id: 'sub-13', title: 'Szablon struktury repozytorium', completed: true },
      { id: 'sub-14', title: 'Generator issues w Markdown', completed: true },
      { id: 'sub-15', title: 'Instrukcja git push', completed: true },
    ],
    createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    githubIssueNumber: 105,
  },
  {
    id: 'task-6',
    title: 'Uruchomienie motywu graficznego w palecie Dark Slate',
    description: 'Wdrożenie profesjonalnego schematu kolorów zgodnego ze standardami B2B SaaS, z czytelnym podziałem na stany i dostępnością WCAG.',
    status: 'done',
    priority: 'low',
    dueDate: getRelativeDateString(-3, 10),
    assigneeId: 'user-anna',
    tags: ['Styling', 'Tailwind', 'Design System'],
    subtasks: [
      { id: 'sub-16', title: 'Dobór fontów Plus Jakarta Sans i JetBrains Mono', completed: true },
      { id: 'sub-17', title: 'Kontrast kart i etykiet terminów', completed: true },
    ],
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    githubIssueNumber: 106,
  },
];

export const INITIAL_GITHUB_CONFIG: GitHubRepoConfig = {
  repoName: 'kanban',
  owner: 'daromajowy',
  branch: 'main',
  isConnected: true,
  lastSyncedAt: new Date().toISOString(),
  autoSync: true,
  webhookActive: true,
};

export function loadTasksFromStorage(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
    if (!raw) {
      saveTasksToStorage(INITIAL_TASKS);
      return INITIAL_TASKS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_TASKS;
  }
}

export function saveTasksToStorage(tasks: Task[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  } catch {
    // quota exceeded or disabled
  }
}

export function loadMembersFromStorage(): TeamMember[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MEMBERS);
    if (!raw) {
      saveMembersToStorage(INITIAL_MEMBERS);
      return INITIAL_MEMBERS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_MEMBERS;
  }
}

export function saveMembersToStorage(members: TeamMember[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
  } catch {
    //
  }
}

export function loadGitHubConfigFromStorage(): GitHubRepoConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.GITHUB);
    if (!raw) {
      saveGitHubConfigToStorage(INITIAL_GITHUB_CONFIG);
      return INITIAL_GITHUB_CONFIG;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_GITHUB_CONFIG;
  }
}

export function saveGitHubConfigToStorage(config: GitHubRepoConfig): void {
  try {
    localStorage.setItem(STORAGE_KEYS.GITHUB, JSON.stringify(config));
  } catch {
    //
  }
}

export function loadNotificationsFromStorage(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveNotificationsToStorage(notifications: AppNotification[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
  } catch {
    //
  }
}
