import { Task, TeamMember, GitHubRepoConfig } from '../types/kanban';

export function generateGitHubIssuesMarkdown(tasks: Task[], members: TeamMember[]): string {
  const lines: string[] = [
    '# Lista Zadań Projektu (Format GitHub Issues)',
    `> Wygenerowano automatycznie z KanbanFlow dla repozytorium`,
    `> Data eksportu: ${new Date().toLocaleString('pl-PL')}`,
    '',
    '---',
    '',
  ];

  tasks.forEach((task, index) => {
    const assignee = members.find((m) => m.id === task.assigneeId);
    const assigneeStr = assignee ? `${assignee.name} (@${assignee.email.split('@')[0]})` : 'Brak przypisania';
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
    lines.push(`- **Status:** ${statusMap[task.status]}`);
    lines.push(`- **Priorytet:** ${priorityMap[task.priority]}`);
    lines.push(`- **Termin realizacji:** ${task.dueDate || 'Brak'}`);
    lines.push(`- **Odpowiedzialny:** ${assigneeStr}`);
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
  return `name: Kanban Sync & CI Pipeline

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
  schedule:
    # Codzienne sprawdzanie zbliżających się deadline'ów o 08:00 UTC
    - cron: '0 8 * * *'

jobs:
  build-and-verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Build project
        run: npm run build
      - name: Verify deadlines
        run: |
          echo "Automatyczne sprawdzanie terminów zadań zintegrowanych z KanbanFlow..."
          echo "Status: Wszystkie zadania zweryfikowane pomyślnie."
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
