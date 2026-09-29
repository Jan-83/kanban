import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, LayoutGrid, LockKeyhole } from 'lucide-react';
import { authConfigured, supabase } from '../utils/supabase';

interface Props { message?: string; recovery?: boolean; onPasswordSet?: () => void; onCancel?: () => void; }
export function PasswordGate({ message = '', recovery = false, onPasswordSet, onCancel }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [reset, setReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      if (recovery) {
        if (password.length < 12) throw new Error('Użyj hasła o długości przynajmniej 12 znaków.');
        if (password !== confirmation) throw new Error('Hasła nie są jednakowe.');
        const result = await supabase.auth.updateUser({ password });
        if (result.error) throw new Error('Nie udało się ustawić hasła. Otwórz nowy link odzyskiwania.');
        setPassword(''); setConfirmation(''); onPasswordSet?.();
      } else if (reset) {
        const result = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: new URL('.', location.href).href });
        if (result.error) throw new Error('Nie udało się wysłać linku. Spróbuj ponownie za chwilę.');
        setNotice('Jeśli konto istnieje, otrzymasz wiadomość z linkiem do ustawienia hasła.');
      } else {
        const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        setPassword('');
        if (result.error) throw new Error('Nie udało się zalogować. Sprawdź e-mail i hasło.');
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Wystąpił błąd. Spróbuj ponownie.'); }
    finally { setBusy(false); }
  };
  return <main className="auth-page">
    <div className="auth-brand"><span className="brand-symbol"><LayoutGrid size={20} /></span> delitech<span className="muted">/ kanban</span></div>
    <section className="auth-card">
      <span className="auth-lock"><LockKeyhole size={22} /></span>
      <p className="eyebrow">WSPÓLNA PRZESTRZEŃ PRACY</p>
      <h1>{recovery ? 'Ustaw swoje hasło' : reset ? 'Odzyskaj dostęp' : 'Dobrze Cię widzieć.'}</h1>
      <p className="auth-description">{recovery ? 'Tylko Ty znasz swoje hasło.' : reset ? 'Wyślemy link na adres Twojego konta.' : 'Zaloguj się, aby przejść do tablicy zespołu.'}</p>
      {!authConfigured && <p className="notice error" role="alert">Tablica czeka na konfigurację logowania. Skontaktuj się z administratorem.</p>}
      {(error || message) && <p className="notice error" role="alert">{error || message}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}
      <form onSubmit={submit} className="form-stack">
        {!recovery && <label>E-mail<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="ty@firma.pl" required maxLength={254} disabled={busy || !authConfigured} /></label>}
        {!reset && <label>{recovery ? 'Nowe hasło' : 'Hasło'}<span className="password-field"><input type={visible ? 'text' : 'password'} autoComplete={recovery ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} minLength={recovery ? 12 : undefined} required disabled={busy || !authConfigured} /><button type="button" className="icon-button" aria-label={visible ? 'Ukryj hasło' : 'Pokaż hasło'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>}
        {recovery && <label>Powtórz hasło<input type="password" autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} minLength={12} required disabled={busy} /></label>}
        <button className="button primary auth-submit" disabled={busy || !authConfigured}>{busy ? 'Chwila…' : recovery ? 'Zapisz hasło' : reset ? 'Wyślij link' : 'Zaloguj się'}<ArrowRight size={16} /></button>
      </form>
      {!recovery && <button className="text-button auth-reset" onClick={() => { setReset(!reset); setError(''); setNotice(''); }} disabled={busy}>{reset ? 'Wróć do logowania' : 'Nie pamiętasz hasła?'}</button>}
      {(recovery || message) && <button className="text-button auth-reset" onClick={onCancel}>Wróć do logowania</button>}
    </section>
    <p className="auth-footnote">Dostęp wyłącznie dla zaproszonych osób.</p>
  </main>;
}

