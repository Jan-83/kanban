import { useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, LayoutGrid, LockKeyhole, ShieldCheck } from 'lucide-react';
import { api, type SessionState } from '../utils/api';

interface Props { auth: SessionState; message?: string; onAuthenticated: () => Promise<void>; onCancel: () => Promise<void>; }
export function PasswordGate({ auth, message = '', onAuthenticated, onCancel }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [reset, setReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [enrollment, setEnrollment] = useState<{secret:string; qr:string} | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [resetInfo, setResetInfo] = useState(() => {
    const params = new URLSearchParams(location.hash.slice(1));
    return params.has('reset') ? {token:params.get('reset')!,email:params.get('email') ?? ''} : null;
  });
  useEffect(() => {
    if (resetInfo) history.replaceState(null, '', location.pathname);
  }, []);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await action(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Wystąpił błąd. Spróbuj ponownie.'); }
    finally { setBusy(false); }
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (resetInfo) {
        if (password !== confirmation) throw new Error('Hasła nie są jednakowe.');
        await api('/reset-password', {method:'POST', data:{...resetInfo,password,password_confirmation:confirmation}});
        setPassword(''); setConfirmation(''); setResetInfo(null); setNotice('Hasło zapisane. Zaloguj się ponownie.');
        await onAuthenticated();
      } else if (reset) {
        const result = await api<{message:string}>('/forgot-password', {method:'POST',data:{email}});
        setNotice(result.message);
      } else if (auth.state === 'setup') {
        const result = await api<{codes:string[]}>('/mfa/confirm',{method:'POST',data:{code}});
        setCode(''); setEnrollment(null); setCodes(result.codes);
      } else if (auth.state === 'challenge') {
        await api('/mfa/challenge',{method:'POST',data:{code}}); setCode(''); await onAuthenticated();
      } else {
        try { await api('/login',{method:'POST',data:{email,password}}); await onAuthenticated(); }
        finally { setPassword(''); }
      }
    });
  };
  const secondFactor = auth.state === 'setup' || auth.state === 'challenge';
  const title = codes.length ? 'Zapisz kody awaryjne' : resetInfo ? 'Ustaw nowe hasło' : reset ? 'Odzyskaj dostęp' : auth.state === 'setup' ? 'Zabezpiecz swoje konto' : auth.state === 'challenge' ? 'Potwierdź logowanie' : 'Dobrze Cię widzieć.';
  return <main className="auth-page">
    <div className="auth-brand"><span className="brand-symbol"><LayoutGrid size={20}/></span> InteliSpaces<span className="muted">/ team</span></div>
    <section className="auth-card">
      <span className="auth-lock">{secondFactor ? <ShieldCheck size={22}/> : <LockKeyhole size={22}/>}</span>
      <p className="eyebrow">WSPÓLNA PRZESTRZEŃ PRACY</p>
      <h1>{title}</h1>
      <p className="auth-description">{codes.length ? 'Każdy kod działa jeden raz. Zachowaj je w menedżerze haseł lub w innym bezpiecznym miejscu — pozwolą wejść po utracie telefonu.' : resetInfo ? 'Użyj co najmniej 14 znaków. Po zmianie hasła nadal obowiązuje drugi składnik.' : reset ? 'Wyślemy link na adres Twojego konta.' : auth.state === 'setup' ? 'Dodaj konto do aplikacji uwierzytelniającej, np. Microsoft Authenticator, Google Authenticator lub 1Password.' : auth.state === 'challenge' ? 'Wpisz kod z aplikacji uwierzytelniającej albo jeden z kodów awaryjnych.' : 'Zaloguj się do CRM i tablic zespołu.'}</p>
      {(error || message) && <p className="notice error" role="alert">{error || message}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}
      {codes.length ? <div className="form-stack">
        <div className="recovery-codes">{codes.map(value=><code key={value}>{value}</code>)}</div>
        <label className="security-check"><input type="checkbox" checked={saved} onChange={e=>setSaved(e.target.checked)}/>Mam bezpiecznie zapisane kody.</label>
        <button className="button primary auth-submit" disabled={!saved || busy} onClick={()=>void run(async()=>{setCodes([]);await onAuthenticated();})}>Przejdź do tablicy<ArrowRight size={16}/></button>
      </div> : <>
      {auth.state === 'setup' && !resetInfo && !enrollment && <button className="button primary auth-submit" disabled={busy} onClick={()=>void run(async()=>setEnrollment(await api('/mfa/setup',{method:'POST'})))}>Skonfiguruj aplikację</button>}
      {enrollment && !resetInfo && <div className="mfa-enrollment"><img src={enrollment.qr} width="240" height="240" alt="Kod QR do dodania konta w aplikacji uwierzytelniającej"/><details><summary>Wpisz klucz ręcznie</summary><code>{enrollment.secret}</code></details><p>Po dodaniu konta wpisz aktualny sześciocyfrowy kod.</p></div>}
      {(auth.state !== 'setup' || enrollment || resetInfo) && <form onSubmit={submit} className="form-stack">
        {(!secondFactor || resetInfo) && !resetInfo && <label>E-mail<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="ty@firma.pl" required maxLength={254} disabled={busy}/></label>}
        {(resetInfo || (!secondFactor && !reset)) && <label>{resetInfo ? 'Nowe hasło' : 'Hasło'}<span className="password-field"><input type={visible?'text':'password'} autoComplete={resetInfo?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} minLength={resetInfo?14:undefined} maxLength={72} required disabled={busy}/><button type="button" className="icon-button" aria-label={visible?'Ukryj hasło':'Pokaż hasło'} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={17}/>:<Eye size={17}/>}</button></span></label>}
        {resetInfo && <label>Powtórz hasło<input type="password" autoComplete="new-password" value={confirmation} onChange={e=>setConfirmation(e.target.value)} minLength={14} maxLength={72} required disabled={busy}/></label>}
        {secondFactor && !resetInfo && <label>{auth.state==='setup'?'Kod z aplikacji':'Kod z aplikacji lub kod awaryjny'}<input autoComplete="one-time-code" inputMode={auth.state==='setup'?'numeric':'text'} value={code} onChange={e=>setCode(e.target.value)} minLength={6} maxLength={32} required disabled={busy} autoFocus/></label>}
        <button className="button primary auth-submit" disabled={busy}>{busy?'Chwila…':resetInfo?'Zapisz hasło':reset?'Wyślij link':secondFactor?'Potwierdź':'Zaloguj się'}<ArrowRight size={16}/></button>
      </form>}
      {!secondFactor && !resetInfo && (auth.resetEnabled ? <button className="text-button auth-reset" onClick={()=>{setReset(!reset);setError('');setNotice('');}} disabled={busy}>{reset?'Wróć do logowania':'Nie pamiętasz hasła?'}</button> : <p className="auth-footnote">W razie utraty hasła skontaktuj się z administratorem.</p>)}
      {(secondFactor || resetInfo) && <button className="text-button auth-reset" disabled={busy} onClick={()=>void run(async()=>{setEnrollment(null);setResetInfo(null);await onCancel();})}>Wróć do logowania</button>}
      </>}
    </section>
    <p className="auth-footnote">Dostęp wyłącznie dla zaproszonych osób · logowanie dwuetapowe</p>
  </main>;
}
