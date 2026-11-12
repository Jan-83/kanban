import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { clearLegacyAuthentication } from './utils/authStorage';
import { api, session, type SessionState } from './utils/api';
import { PasswordGate } from './components/PasswordGate';
const CrmWorkspace = lazy(() => import('./crm/CrmWorkspace'));
const Workspace = lazy(() => import('./components/Workspace').then(module => ({ default: module.Workspace })));
export default function App() {
  const [auth, setAuth] = useState<SessionState | null>(null);
  const [message, setMessage] = useState('');
  const [module, setModule] = useState<'crm' | 'kanban'>('crm');
  const [kanbanTarget, setKanbanTarget] = useState<{taskId?: string; strategy?: boolean}>({});
  const refresh = useCallback(async () => {
    try { setAuth(await session()); setMessage(''); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Nie udało się sprawdzić dostępu.'); }
  }, []);
  useEffect(() => {
    clearLegacyAuthentication(); void refresh();
    if (auth?.state !== 'authenticated') return;
    const timer = setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [refresh, auth?.state]);
  const logout = async () => {
    try { await api('/logout', { method: 'POST' }); setAuth(await session()); }
    catch { setAuth(null); setMessage('Nie potwierdzono wylogowania. Zamknij kartę i spróbuj ponownie.'); }
  };
  if (!auth) return <div className="loading-screen" role="status">{message || 'Sprawdzanie dostępu…'}{message && <button className="button" onClick={refresh}>Spróbuj ponownie</button>}</div>;
  if (location.hash.startsWith('#reset=') || auth.state !== 'authenticated' || !auth.user) return <PasswordGate auth={auth} message={message} onAuthenticated={refresh} onCancel={logout} />;
  return <Suspense fallback={<div className="loading-screen" role="status">Wczytywanie tablicy…</div>}>{module === 'crm' ? <CrmWorkspace key={auth.user.id} user={auth.user} onLogout={logout} onAccessLost={refresh} onKanban={(taskId, strategy) => { setKanbanTarget({ taskId, strategy }); setModule('kanban'); }} /> : <Workspace key={auth.user.id} user={auth.user} onLogout={logout} onAccessLost={refresh} onOpenCrm={() => setModule('crm')} initialTab={kanbanTarget.strategy ? 'strategy' : 'board'} initialTaskId={kanbanTarget.taskId} />}</Suspense>;
}
