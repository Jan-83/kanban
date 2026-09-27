import React from 'react';
import { 
  Kanban, 
  ListFilter, 
  CalendarClock, 
  Users, 
  GitBranch, 
  Plus, 
  Bell, 
  CheckCircle2, 
  AlertTriangle,
  FileSpreadsheet
} from 'lucide-react';
import { ActiveTab, AppNotification } from '../types/kanban';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenNewTaskModal: () => void;
  onToggleNotifications: () => void;
  onExportCSV: () => void;
  notifications: AppNotification[];
  isNotificationsOpen: boolean;
  overdueCount: number;
  todayCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenNewTaskModal,
  onToggleNotifications,
  onExportCSV,
  notifications,
  isNotificationsOpen,
  overdueCount,
  todayCount,
}) => {
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Zone 1: Single text element Brand Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('board')}
              className="flex items-center gap-2.5 text-left group focus:outline-none"
            >
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20 group-hover:bg-indigo-500 transition-colors">
                <Kanban className="w-5 h-5" />
              </div>
              <div>
                <span className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
                  Strona Deli Smart Space
                  <span className="text-xs font-mono font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    GitHub
                  </span>
                </span>
              </div>
            </button>
          </div>

          {/* Zone 2: Navigation Links (single line, functional tabs) */}
          <nav className="hidden md:flex items-center space-x-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('board')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                activeTab === 'board'
                  ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Kanban className="w-4 h-4" />
              Tablica Kanban
            </button>

            <button
              onClick={() => setActiveTab('list')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                activeTab === 'list'
                  ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <ListFilter className="w-4 h-4" />
              Lista zadań
            </button>

            <button
              onClick={() => setActiveTab('timeline')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                activeTab === 'timeline'
                  ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <CalendarClock className="w-4 h-4" />
              Terminy
              {(overdueCount > 0 || todayCount > 0) && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('team')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                activeTab === 'team'
                  ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Users className="w-4 h-4" />
              Zespół & Zaproszenia
            </button>

            <button
              onClick={() => setActiveTab('github')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                activeTab === 'github'
                  ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <GitBranch className="w-4 h-4" />
              GitHub Repo
            </button>
          </nav>

          {/* Zone 3: Primary Actions */}
          <div className="flex items-center gap-2.5">
            {/* Notifications Button */}
            <div className="relative">
              <button
                onClick={onToggleNotifications}
                className={`relative p-2 rounded-lg border transition-colors ${
                  isNotificationsOpen
                    ? 'bg-slate-100 border-slate-300 text-slate-900'
                    : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
                title="Powiadomienia o terminach"
                aria-label="Powiadomienia"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.2 min-w-4.5 h-4.5 rounded-full bg-rose-600 text-[10px] font-mono font-bold text-white flex items-center justify-center shadow-md shadow-rose-600/30">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>

            {/* Export CSV Button */}
            <button
              onClick={onExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors whitespace-nowrap"
              title="Eksportuj wszystkie zadania do arkusza kalkulacyjnego CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Eksport CSV</span>
            </button>

            {/* Quick Add Task Button */}
            <button
              onClick={onOpenNewTaskModal}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm shadow-indigo-600/20 transition-all active:scale-95 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Dodaj zadanie</span>
            </button>

            {/* User Profile Capsule */}
            <div className="hidden lg:flex items-center pl-2 ml-1 border-l border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold border border-indigo-200">
                  DM
                </div>
                <div className="text-left">
                  <div className="text-xs font-semibold text-slate-800 leading-tight">Dariusz Maj</div>
                  <div className="text-[10px] text-slate-500 font-mono leading-tight">darecki.maj@gmail.com</div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Mobile Sub-Navigation Bar */}
        <div className="flex md:hidden overflow-x-auto py-2 space-x-1 border-t border-slate-200 no-scrollbar">
          <button
            onClick={() => setActiveTab('board')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap ${
              activeTab === 'board' ? 'bg-indigo-600 text-white' : 'text-slate-600'
            }`}
          >
            <Kanban className="w-3.5 h-3.5" />
            Tablica
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap ${
              activeTab === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-600'
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" />
            Lista
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap ${
              activeTab === 'timeline' ? 'bg-indigo-600 text-white' : 'text-slate-600'
            }`}
          >
            <CalendarClock className="w-3.5 h-3.5" />
            Terminy
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap ${
              activeTab === 'team' ? 'bg-indigo-600 text-white' : 'text-slate-600'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Zespół
          </button>
          <button
            onClick={() => setActiveTab('github')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap ${
              activeTab === 'github' ? 'bg-indigo-600 text-white' : 'text-slate-600'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            GitHub
          </button>
        </div>
      </div>
    </header>
  );
};
