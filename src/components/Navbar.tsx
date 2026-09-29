import { CalendarClock, Download, Kanban, LayoutGrid, List, LogOut, Plus, Users } from 'lucide-react';
import type { ActiveTab, BoardUser } from '../types/kanban';
interface Props { activeTab: ActiveTab; onTab: (tab: ActiveTab) => void; user: BoardUser; onLogout: () => void; onNew: () => void; busy: boolean; }
export function Navbar({ activeTab, onTab, user, onLogout, onNew, busy }: Props) {
  const tabs = [['board', Kanban, 'Tablica'], ['list', List, 'Lista'], ['timeline', CalendarClock, 'Terminy'], ['team', Users, 'Zespół'], ['github', Download, 'Eksport']] as const;
  return <header className="app-header">
    <div className="topbar">
      <button className="brand" onClick={() => onTab('board')} aria-label="Delitech — tablica"><span className="brand-symbol"><LayoutGrid size={19} /></span>delitech<span className="brand-divider">/</span><span className="muted brand-context">workspace</span></button>
      <div className="header-actions"><span className="user-name">{user.name}</span><span className="avatar" title={user.email}>{user.name.slice(0, 2).toUpperCase()}</span><button className="icon-button" onClick={onLogout} aria-label="Wyloguj się" title="Wyloguj się"><LogOut size={17} /></button><span className="header-divider" /><button className="button primary" onClick={onNew} disabled={busy}><Plus size={16} />Nowe zadanie</button></div>
    </div>
    <nav className="tabs" aria-label="Widoki projektu">{tabs.map(([id, Icon, label]) => <button key={id} className={activeTab === id ? 'tab active' : 'tab'} aria-current={activeTab === id ? 'page' : undefined} onClick={() => onTab(id)}><Icon size={16} />{label}</button>)}</nav>
  </header>;
}

