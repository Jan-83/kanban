import { Download, FileJson, FileSpreadsheet, Github, Upload } from 'lucide-react';
import type { BoardData } from '../types/kanban';
import { downloadFile, exportTasksToCSV, generateGitHubIssuesMarkdown } from '../utils/githubExport';
export function GitHubModal({ data, canImport, onImport, busy }: { data: BoardData; canImport: boolean; onImport: () => void; busy: boolean }) {
  return <div className="export-grid">
    <section className="panel"><FileSpreadsheet size={22} /><h2>Lista zadań</h2><p className="panel-description">Zadania, etapy, priorytety i terminy w pliku CSV do arkusza.</p><button className="button" onClick={() => exportTasksToCSV(data.tasks, data.members, data.stages)}><Download size={15} />Pobierz CSV</button></section>
    <section className="panel"><FileJson size={22} /><h2>Kopia tablicy</h2><p className="panel-description">Pełny zapis zadań, osób i własnych etapów w pliku JSON.</p><button className="button" onClick={() => downloadFile(JSON.stringify(data, null, 2), 'kanban-backup-' + new Date().toISOString().slice(0, 10) + '.json', 'application/json')}><Download size={15} />Pobierz kopię</button></section>
    <section className="panel"><Github size={22} /><h2>Notatka do GitHuba</h2><p className="panel-description">Eksport Markdown do dalszej pracy. Nie synchronizuje automatycznie GitHub Issues.</p><button className="button" onClick={() => downloadFile(generateGitHubIssuesMarkdown(data.tasks, data.members, data.stages), 'kanban.md')}><Download size={15} />Pobierz Markdown</button></section>
    {canImport && <section className="panel"><Upload size={22} /><h2>Przenieś poprzednią tablicę</h2><p className="panel-description">Wczytaj zadania i osoby zapisane przez poprzednią wersję w tej przeglądarce. Import jest dostępny tylko na pustej tablicy. Hasła i stare uprawnienia nie są importowane.</p><button className="button" disabled={busy || data.tasks.length > 0 || data.members.length > 0} onClick={onImport}>Importuj lokalne zadania</button></section>}
  </div>;
}

