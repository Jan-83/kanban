import React, { useState } from 'react';
import { 
  Lock, 
  ShieldCheck, 
  KeyRound, 
  User, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  Eye, 
  EyeOff,
  Sparkles,
  Users
} from 'lucide-react';
import { SecurityConfig, AuthSession, AccessAccount } from '../utils/authStorage';

interface PasswordGateProps {
  securityConfig: SecurityConfig;
  onLoginSuccess: (session: AuthSession, rememberMe: boolean) => void;
}

export const PasswordGate: React.FC<PasswordGateProps> = ({
  securityConfig,
  onLoginSuccess,
}) => {
  const [loginMode, setLoginMode] = useState<'individual' | 'master'>('individual');
  const [selectedEmail, setSelectedEmail] = useState<string>(
    securityConfig.accounts[0]?.email || ''
  );
  const [password, setPassword] = useState('');
  const [masterCode, setMasterCode] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleIndividualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const account = securityConfig.accounts.find(
      (acc) => acc.email.toLowerCase() === selectedEmail.toLowerCase()
    );

    if (!account) {
      setError('Nie znaleziono takiego użytkownika na liście uprawnionych.');
      return;
    }

    if (password.trim() !== account.passcode) {
      setError('Nieprawidłowe hasło dostępowe. Skontaktuj się z administratorem.');
      return;
    }

    const session: AuthSession = {
      user: {
        id: account.id,
        name: account.name,
        email: account.email,
        role: account.role,
      },
      loginTime: new Date().toISOString(),
    };

    setSuccessMsg(`Zalogowano pomyślnie jako ${account.name}!`);
    setTimeout(() => {
      onLoginSuccess(session, rememberMe);
    }, 400);
  };

  const handleMasterLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (masterCode.trim() !== securityConfig.masterPassword) {
      setError('Nieprawidłowy kod dostępu do projektu.');
      return;
    }

    const session: AuthSession = {
      user: {
        id: 'acc-admin',
        name: 'Dariusz Maj (Admin)',
        email: 'darecki.maj@gmail.com',
        role: 'admin',
      },
      loginTime: new Date().toISOString(),
    };

    setSuccessMsg('Kod zaakceptowany! Witaj w Deli Smart Space.');
    setTimeout(() => {
      onLoginSuccess(session, rememberMe);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 selection:bg-indigo-500/20 selection:text-indigo-800">
      {/* Background soft ambient decor */}
      <div className="fixed inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
        <div className="w-[500px] h-[500px] bg-indigo-200/40 rounded-full blur-3xl -top-20 -left-20 absolute" />
        <div className="w-[450px] h-[450px] bg-blue-100/50 rounded-full blur-3xl -bottom-20 -right-20 absolute" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Brand Card Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 mb-3.5">
            <Lock className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Strona Deli Smart Space
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
            Dostęp prywatny. Tablica zadań Kanban jest zabezpieczona hasłem.
          </p>
        </div>

        {/* Login Container */}
        <div className="bg-white border border-slate-200 shadow-xl rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
          {/* Mode Switcher */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl mb-6 text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setLoginMode('individual');
                setError('');
              }}
              className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                loginMode === 'individual'
                  ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              Konto osobiste
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMode('master');
                setError('');
              }}
              className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                loginMode === 'master'
                  ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              Kod projektu
            </button>
          </div>

          {/* Feedback messages */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {loginMode === 'individual' ? (
            /* Individual User Passcode Form */
            <form onSubmit={handleIndividualLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Wybierz swoje konto
                </label>
                <div className="relative">
                  <select
                    value={selectedEmail}
                    onChange={(e) => setSelectedEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none cursor-pointer"
                  >
                    {securityConfig.accounts.map((acc) => (
                      <option key={acc.id} value={acc.email}>
                        {acc.name} ({acc.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Hasło dostępowe
                  </label>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Wprowadź swoje hasło..."
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-colors"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>Zapamiętaj sesję w tej przeglądarce</span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <span>Odblokuj tablicę</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            /* Master Team Code Form */
            <form onSubmit={handleMasterLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Główny kod dostępu (Master PIN)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={masterCode}
                    onChange={(e) => setMasterCode(e.target.value)}
                    placeholder="Wpisz wspólny kod zespołu..."
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-colors font-mono"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                  Kod nadany przez administratora projektu (np. dla nowych członków).
                </p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>Zapamiętaj sesję w tej przeglądarce</span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <span>Wejdź do projektu</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Quick Helper Tips */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex items-start gap-2.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Domyślne hasło Administratora (Daro) oraz kod projektu to: <strong className="text-slate-800 font-mono">deli2025</strong>. Pozostałe hasła dla zespołu: Janek (<span className="font-mono text-slate-700">Janek123</span>), Marek (<span className="font-mono text-slate-700">Marek123</span>), Darek (<span className="font-mono text-slate-700">Darek123</span>).
            </p>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-4 text-center text-[11px] text-slate-400">
          Strona Deli Smart Space &copy; {new Date().getFullYear()} &middot; Dostęp chroniony
        </div>
      </div>
    </div>
  );
};
