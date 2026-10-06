import { Task, TeamMember, GitHubRepoConfig, BoardStage } from '../types/kanban';
import { DEFAULT_STAGES, stageTitle, taskAssignees } from './board';

export function generateGitHubIssuesMarkdown(tasks: Task[], members: TeamMember[], stages: BoardStage[] = DEFAULT_STAGES): string {
  const lines: string[] = [
    '# Lista Zadań Projektu (Format GitHub Issues)',
    `> Wygenerowano automatycznie z KanbanFlow dla repozytorium`,
    `> Data eksportu: ${new Date().toLocaleString('pl-PL')}`,
    '',
    '---',
    '',
  ];

  tasks.forEach((task, index) => {
    const assignees = taskAssignees(task, members);
    const assigneeStr = assignees.map(person => `${person.name} (@${person.email.split('@')[0]})`).join(', ') || 'Brak przypisania';
    const statusMap = {
      todo: 'Do zrobienia (Backlog)',
      in_progress: 'W trakcie (In Progress)',
      done: 'Zrobione (Closed)',
    };
    const priorityMap = {
      low: 'Niski',
      medium: 'Średni',
      high: 'Wysoki',
      urgent: 'PILNY / KRYTYCZNY',
    };

    lines.push(`## #${index + 1} - ${task.title}`);
    lines.push(`- **Status:** ${stageTitle(stages, task.status)}`);
    lines.push(`- **Priorytet:** ${priorityMap[task.priority]}`);
    lines.push(`- **Termin realizacji:** ${task.dueDate || 'Brak'}`);
    lines.push(`- **Odpowiedzialni:** ${assigneeStr}`);
    if (task.tags.length > 0) {
      lines.push(`- **Etykiety:** ${task.tags.map((t) => `\`${t}\``).join(', ')}`);
    }
    lines.push('');
    lines.push('### Opis:');
    lines.push(task.description || '_Brak dodatkowego opisu._');
    lines.push('');

    if (task.subtasks.length > 0) {
      lines.push('### Zadania cząstkowe:');
      task.subtasks.forEach((st) => {
        lines.push(`- [${st.completed ? 'x' : ' '}] ${st.title}`);
      });
      lines.push('');
    }

    if (task.statusComments && task.statusComments.length > 0) {
      lines.push('### Komentarze o statusie:');
      task.statusComments.forEach((c) => {
        lines.push(`- **${c.author || 'Członek zespołu'}** (${c.timestamp}): ${c.text}`);
      });
      lines.push('');
    }

    if (task.closingStatus) {
      lines.push('### Status zamknięcia:');
      lines.push(task.closingStatus);
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  });

  return lines.join('\n');
}

export function generateGitInitScript(config: GitHubRepoConfig): string {
  const repoUrl = `https://github.com/${config.owner}/${config.repoName}.git`;
  return `#!/bin/bash
# Skrypt automatycznego połączenia i wdrożenia na GitHubie
# Repozytorium: ${repoUrl}
# Wygenerowane przez KanbanFlow

set -e

echo "🚀 Inicjalizacja lokalnego repozytorium Git..."
if [ ! -d ".git" ]; then
  git init
  echo "✅ Utworzono .git"
fi

echo "🌿 Ustawianie gałęzi głównej: ${config.branch}"
git checkout -B ${config.branch}

echo "📦 Dodawanie plików projektu..."
git add .

echo "💾 Tworzenie pierwszego commita..."
git commit -m "feat(kanban): inicjalizacja tablicy zadań z powiadomieniami i zespołem" || echo "Brak nowych zmian do commita"

echo "🔗 Podpinanie zdalnego repozytorium GitHub..."
git remote remove origin 2>/dev/null || true
git remote add origin ${repoUrl}

echo "✨ Gotowe do wypchnięcia kodu na GitHub!"
echo "Uruchom poniższe polecenie:"
echo "👉 git push -u origin ${config.branch}"
`;
}

export function generateWorkflowYaml(): string {
  return `name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  build-and-deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: |
          if [ -f package-lock.json ]; then
            npm ci
          else
            npm install
          fi

      - name: Build application for production
        run: npm run build

      - name: Setup GitHub Pages
        uses: actions/configure-pages@v5

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
`;
}

export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports tasks to CSV format with UTF-8 BOM for Microsoft Excel, Google Sheets, and LibreOffice.
 */
export function exportTasksToCSV(tasks: Task[], members: TeamMember[], stages: BoardStage[] = DEFAULT_STAGES): void {
  const headers = [
    'ID Zadania',
    'Tytuł',
    'Status',
    'Priorytet',
    'Termin Realizacji (Deadline)',
    'Przypisane Osoby',
    'Emaile Wykonawców',
    'Tagi',
    'Ukończone Podzadania',
    'Wszystkie Podzadania',
    'Opis',
    'Numer GitHub Issue',
    'Data Utworzenia',
    'Ostatnia Aktualizacja',
  ];

  const escapeCSV = (field: string | number | undefined | null): string => {
    if (field === undefined || field === null) return '""';
    const raw = String(field);
    const stringValue = /^[\s]*[=+@-]/.test(raw) ? "'" + raw : raw;
    const escaped = stringValue.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const statusMap: Record<string, string> = {
    todo: 'Do zrobienia',
    in_progress: 'W trakcie',
    done: 'Zrobione',
  };

  const priorityMap: Record<string, string> = {
    low: 'Niski',
    medium: 'Średni',
    high: 'Wysoki',
    urgent: 'Pilny',
  };

  const rows: string[] = [];
  rows.push(headers.map(escapeCSV).join(','));

  tasks.forEach((task) => {
    const assignees = taskAssignees(task, members);
    const completedSubs = task.subtasks.filter((s) => s.completed).length;
    const totalSubs = task.subtasks.length;

    const row = [
      escapeCSV(task.id),
      escapeCSV(task.title),
      escapeCSV(stageTitle(stages, task.status)),
      escapeCSV(priorityMap[task.priority] || task.priority),
      escapeCSV(task.dueDate || 'Brak terminu'),
      escapeCSV(assignees.map(person => person.name).join('; ') || 'Nieprzypisane'),
      escapeCSV(assignees.map(person => person.email).join('; ')),
      escapeCSV(task.tags.join(', ')),
      escapeCSV(completedSubs),
      escapeCSV(totalSubs),
      escapeCSV(task.description || ''),
      escapeCSV(task.githubIssueNumber ? `#${task.githubIssueNumber}` : ''),
      escapeCSV(task.createdAt ? new Date(task.createdAt).toLocaleString('pl-PL') : ''),
      escapeCSV(task.updatedAt ? new Date(task.updatedAt).toLocaleString('pl-PL') : ''),
    ];

    rows.push(row.join(','));
  });

  // \uFEFF is UTF-8 Byte Order Mark so Excel opens Polish characters (ą, ę, ś, ć, ż, ź, ł, ó) without encoding glitches
  const csvContent = '\uFEFF' + rows.join('\r\n');
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadFile(csvContent, `kanban-raport-zadan-${dateStr}.csv`, 'text/csv;charset=utf-8;');
}

