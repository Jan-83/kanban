import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { BoardUser } from './types/kanban';
import { clearLegacyAuthentication } from './utils/authStorage';
import { authConfigured, passwordLink, supabase, verifiedUser } from './utils/supabase';
import { PasswordGate } from './components/PasswordGate';
const Workspace = lazy(() => import('./components/Workspace').then(module => ({ default: module.Workspace })));

export default function App() {
  const [user, setUser] = useState<BoardUser | null>(null);
  const [loading, setLoading] = useState(authConfigured);
  const [message, setMessage] = useState('');
  const [recovery, setRecovery] = useState(passwordLink);
  const generation = useRef(0);
  const loggingOut = useRef(false);
  useEffect(() => {
    clearLegacyAuthentication();
    if (!supabase) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const verify = async () => {
      if (!active || loggingOut.current) return;
      const ticket = ++generation.current;
      try {
        const verified = await verifiedUser();
        if (active && ticket === generation.current) { setUser(verified); setMessage(''); }
      } catch (error) {
        if (active && ticket === generation.current) {
          setUser(null);
          setMessage(error instanceof Error ? error.message : 'Nie udało się sprawdzić dostępu.');
        }
      } finally {
        if (active && ticket === generation.current) setLoading(false);
      }
    };
    // Schedule outside the auth callback to avoid nested auth lock waits.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        ++generation.current;
        setUser(null); setRecovery(false); setLoading(false);
      } else {
        if (event === 'PASSWORD_RECOVERY') setRecovery(true);
        clearTimeout(timer);
        timer = setTimeout(verify, 0);
      }
    });
    void verify();
    const interval = setInterval(verify, 60000);
    window.addEventListener('focus', verify);
    return () => { active = false; ++generation.current; clearTimeout(timer); clearInterval(interval); subscription.unsubscribe(); window.removeEventListener('focus', verify); };
  }, []);
  const logout = async () => {
    loggingOut.current = true;
    ++generation.current;
    setUser(null); setRecovery(false); setLoading(false);
    try { await supabase?.auth.signOut({ scope: 'local' }); }
    finally { loggingOut.current = false; }
  };
  if (recovery) return <PasswordGate recovery onPasswordSet={() => { setRecovery(false); window.location.reload(); }} onCancel={logout} />;
  if (loading) return <div className="loading-screen" role="status">Sprawdzanie dostępu…</div>;
  if (!user) return <PasswordGate message={message} onCancel={logout} />;
  return <Suspense fallback={<div className="loading-screen" role="status">Wczytywanie tablicy…</div>}><Workspace key={user.id} user={user} onLogout={logout} onAccessLost={logout} /></Suspense>;
}

