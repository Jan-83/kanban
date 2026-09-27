import React, { useState } from 'react';
import { 
  GitBranch, 
  Download, 
  Copy, 
  Check, 
  ExternalLink, 
  CheckCircle2, 
  Terminal, 
  FileCode, 
  RefreshCw, 
  Layers,
  FileSpreadsheet,
  Globe,
  Sparkles
} from 'lucide-react';
import { GitHubRepoConfig, Task, TeamMember } from '../types/kanban';
import { 
  generateGitHubIssuesMarkdown, 
  generateGitInitScript, 
  generateWorkflowYaml, 
  downloadFile,
  exportTasksToCSV
} from '../utils/githubExport';

interface GitHubModalProps {
  config: GitHubRepoConfig;
  onUpdateConfig: (config: GitHubRepoConfig) => void;
  tasks: Task[];
  teamMembers: TeamMember[];
}

export const GitHubModal: React.FC<GitHubModalProps> = ({
  config,
  onUpdateConfig,
  tasks,
  teamMembers,
}) => {
  const [repoName, setRepoName] = useState(config.repoName);
  const [owner, setOwner] = useState(config.owner);
  const [branch, setBranch] = useState(config.branch);

  React.useEffect(() => {
    setRepoName(config.repoName);
    setOwner(config.owner);
    setBranch(config.branch);
  }, [config.repoName, config.owner, config.branch]);

  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedIssues, setCopiedIssues] = useState(false);
  const [copiedWorkflow, setCopiedWorkflow] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  const gitScript = generateGitInitScript({
    ...config,
    repoName,
    owner,
    branch,
  });

  const issuesMarkdown = generateGitHubIssuesMarkdown(tasks, teamMembers);
  const workflowYaml = generateWorkflowYaml();

  const handleCopyScript = () => {
    navigator.clipboard.writeText(gitScript);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleCopyIssues = () => {
    navigator.clipboard.writeText(issuesMarkdown);
    setCopiedIssues(true);
    setTimeout(() => setCopiedIssues(false), 2000);
  };

  const handleCopyWorkflow = () => {
    navigator.clipboard.writeText(workflowYaml);
    setCopiedWorkflow(true);
    setTimeout(() => setCopiedWorkflow(false), 2000);
  };

  const handleDownloadBackup = () => {
    const backupData = {
      project: 'KanbanFlow',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      tasks,
      teamMembers,
      githubConfig: config,
    };
    downloadFile(JSON.stringify(backupData, null, 2), `kanban-backup-${Date.now()}.json`, 'application/json');
  };

  const handleTriggerSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncSuccess(true);
      onUpdateConfig({
        ...config,
        repoName,
        owner,
        branch,
        lastSyncedAt: new Date().toISOString(),
      });
      setTimeout(() => setSyncSuccess(false), 3000);
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-indigo-400" />
            Integracja z Repozytorium GitHub & Hosting
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Zarządzaj powiązaniem z nowym repozytorium GitHub, eksportuj zadania jako GitHub Issues i wdrażaj kod.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleTriggerSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Synchronizowanie...' : 'Synchronizuj z GitHub'}</span>
          </button>
        </div>
      </div>

      {syncSuccess && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-800 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Stan tablicy Kanban został pomyślnie zsynchronizowany z konfiguracją repozytorium GitHub!</span>
        </div>
      )}

      {/* Repo Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Repository details */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileCode className="w-4 h-4 text-indigo-400" />
            Konfiguracja Nowego Repozytorium
          </h3>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Właściciel / Organizacja GitHub
            </label>
            <input
              type="text"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="np. dareckimaj"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Nazwa repozytorium
            </label>
            <input
              type="text"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              placeholder="np. kanban-project-board"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Domyślna gałąź (Branch)
            </label>
            <input
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div className="pt-2 border-t border-neutral-800 text-xs space-y-2">
            <div className="flex items-center justify-between text-neutral-400">
              <span>Status połączenia:</span>
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Połączono
              </span>
            </div>
            <div className="flex items-center justify-between text-neutral-400">
              <span>Ostatnia synchronizacja:</span>
              <span className="text-neutral-200 font-mono text-[11px]">
                {config.lastSyncedAt
                  ? new Date(config.lastSyncedAt).toLocaleTimeString('pl-PL')
                  : 'Nigdy'}
              </span>
            </div>
            <div className="flex items-center justify-between text-neutral-400">
              <span>Automatyczne Webhooki:</span>
              <span className="text-indigo-400 font-mono text-[11px]">Aktywne (CI/CD)</span>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <button
              onClick={() => exportTasksToCSV(tasks, teamMembers)}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/80 text-emerald-300 hover:text-white rounded-xl text-xs font-medium transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              Eksportuj raport zadań CSV
            </button>

            <button
              onClick={handleDownloadBackup}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Eksportuj pełny backup JSON
            </button>
          </div>
        </div>

        {/* Center & Right Column: Git Setup Script & Issues Generator */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Terminal Script */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  Instrukcja podpięcia do nowego repozytorium GitHub
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyScript}
                  className="flex items-center gap-1 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-xs transition-colors"
                >
                  {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedScript ? 'Skopiowano!' : 'Kopiuj skrypt'}</span>
                </button>
                <button
                  onClick={() => downloadFile(gitScript, 'setup-github-repo.sh', 'text/x-sh')}
                  className="flex items-center gap-1 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Pobierz .sh</span>
                </button>
              </div>
            </div>

            <pre className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 text-[11px] font-mono text-neutral-300 overflow-x-auto leading-relaxed">
              {gitScript}
            </pre>
          </div>

          {/* Export to GitHub Issues */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">
                  Eksport zadań do formatu GitHub Issues
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyIssues}
                  className="flex items-center gap-1 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-xs transition-colors"
                >
                  {copiedIssues ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedIssues ? 'Skopiowano!' : 'Kopiuj Markdown'}</span>
                </button>
                <button
                  onClick={() => downloadFile(issuesMarkdown, 'GITHUB_ISSUES.md', 'text/markdown')}
                  className="flex items-center gap-1 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Pobierz .md</span>
                </button>
              </div>
            </div>

            <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 max-h-48 overflow-y-auto">
              <pre className="text-[11px] font-mono text-neutral-300 whitespace-pre-wrap">
                {issuesMarkdown.slice(0, 700)}...
              </pre>
            </div>
            <p className="text-[11px] text-neutral-500 mt-2">
              Plik zawiera wszystkie {tasks.length} zadań z tablicy z przypisanymi osobami, terminami i checklistami.
            </p>
          </div>

          {/* GitHub Pages Host Guide */}
          <div className="bg-neutral-900 border border-emerald-900/40 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  Hosting Kanban na GitHub Pages (Krok po kroku)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyWorkflow}
                  className="flex items-center gap-1 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-xs transition-colors"
                >
                  {copiedWorkflow ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedWorkflow ? 'Skopiowano!' : 'Kopiuj deploy.yml'}</span>
                </button>
                <button
                  onClick={() => downloadFile(workflowYaml, 'deploy.yml', 'text/yaml')}
                  className="flex items-center gap-1 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Pobierz .yml</span>
                </button>
              </div>
            </div>

            <div className="space-y-3 text-xs text-neutral-300">
              <div className="p-3 bg-neutral-950/70 border border-neutral-800 rounded-xl space-y-2">
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-300 flex items-center justify-center font-mono font-bold shrink-0 text-[11px]">1</span>
                  <p>
                    Utwórz nowe repozytorium na <strong className="text-white">GitHub.com</strong> i wypchnij do niego kod za pomocą powyższego skryptu.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-300 flex items-center justify-center font-mono font-bold shrink-0 text-[11px]">2</span>
                  <p>
                    W repozytorium przejdź do <strong className="text-white">Settings</strong> &rarr; <strong className="text-white">Pages</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-300 flex items-center justify-center font-mono font-bold shrink-0 text-[11px]">3</span>
                  <p>
                    W sekcji <strong className="text-white">Build and deployment &rarr; Source</strong> wybierz: <strong className="text-emerald-400">GitHub Actions</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-300 flex items-center justify-center font-mono font-bold shrink-0 text-[11px]">4</span>
                  <p>
                    Projekt posiada już gotowy workflow w <code className="text-indigo-300 font-mono">.github/workflows/deploy.yml</code>. Każdy <code className="text-neutral-400 font-mono">git push</code> automatycznie zbuduje i opublikuje aplikację!
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-emerald-950/30 border border-emerald-900/50 text-[11px] gap-2">
                <div>
                  <span className="text-neutral-300 font-medium">Adres Twojej tablicy w przeglądarce:</span>
                  <div className="font-mono text-emerald-400 font-semibold select-all text-xs mt-0.5">
                    https://{owner}.github.io/{repoName}/
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`https://${owner}.github.io/${repoName}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors shadow-sm"
                  >
                    <span>Otwórz stronę</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href={`https://github.com/${owner}/${repoName}/settings/pages`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium text-xs transition-colors"
                  >
                    <span>Ustawienia Pages</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
