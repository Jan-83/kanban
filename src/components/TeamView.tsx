import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Mail, 
  ShieldCheck, 
  Copy, 
  Check, 
  CheckCircle2, 
  KeyRound, 
  Lock, 
  Eye, 
  EyeOff, 
  Plus, 
  Trash2,
  AlertCircle
} from 'lucide-react';
import { TeamMember, Task } from '../types/kanban';
import { SecurityConfig, AccessAccount } from '../utils/authStorage';

interface TeamViewProps {
  teamMembers: TeamMember[];
  tasks: Task[];
  onAddMember: (member: Omit<TeamMember, 'id'>) => void;
  onRemoveMember: (memberId: string) => void;
  securityConfig: SecurityConfig;
  onUpdateSecurityConfig: (newConfig: SecurityConfig) => void;
  currentUserId?: string;
}

export const TeamView: React.FC<TeamViewProps> = ({
  teamMembers,
  tasks,
  onAddMember,
  onRemoveMember,
  securityConfig,
  onUpdateSecurityConfig,
  currentUserId,
}) => {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Frontend Developer');
  const [invitePasscode, setInvitePasscode] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // Security gate settings
  const [showMasterPassword, setShowMasterPassword] = useState(false);
  const [masterPasswordInput, setMasterPasswordInput] = useState(securityConfig.masterPassword);
  const [isEditingMasterPass, setIsEditingMasterPass] = useState(false);
  const [saveMasterSuccess, setSaveMasterSuccess] = useState(false);

  // Editing individual passcode
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [newPasscodeValue, setNewPasscodeValue] = useState('');

  const inviteLink = `https://${window.location.host}/join-project?invite=deli_${Math.random().toString(36).substring(2, 9)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleToggleGate = (enabled: boolean) => {
    const updated: SecurityConfig = {
      ...securityConfig,
      isGateEnabled: enabled,
    };
    onUpdateSecurityConfig(updated);
  };

  const handleSaveMasterPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterPasswordInput.trim()) return;

    const updated: SecurityConfig = {
      ...securityConfig,
      masterPassword: masterPasswordInput.trim(),
    };
    onUpdateSecurityConfig(updated);
    setIsEditingMasterPass(false);
    setSaveMasterSuccess(true);
    setTimeout(() => setSaveMasterSuccess(false), 2500);
  };

  const handleSaveAccountPasscode = (accountId: string) => {
    if (!newPasscodeValue.trim()) return;

    const updatedAccounts = securityConfig.accounts.map((acc) =>
      acc.id === accountId ? { ...acc, passcode: newPasscodeValue.trim() } : acc
    );

    const updated: SecurityConfig = {
      ...securityConfig,
      accounts: updatedAccounts,
    };
    onUpdateSecurityConfig(updated);
    setEditingAccountId(null);
    setNewPasscodeValue('');
  };

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;

    const colors = ['#6366F1', '#EC4899', '#06B6D4', '#10B981', '#F59E0B', '#8B5CF6'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const assignedPasscode = invitePasscode.trim() || `deli${Math.floor(1000 + Math.random() * 9000)}`;

    // Add to Team Members
    onAddMember({
      name: inviteName.trim(),
      email: inviteEmail.trim(),
      role: inviteRole,
      status: 'active',
      color: randomColor,
    });

    // Add to Security Config Accounts
    const newAccount: AccessAccount = {
      id: `acc-${Date.now()}`,
      name: inviteName.trim(),
      email: inviteEmail.trim(),
      role: 'member',
      passcode: assignedPasscode,
      createdAt: new Date().toISOString(),
    };

    onUpdateSecurityConfig({
      ...securityConfig,
      accounts: [...securityConfig.accounts, newAccount],
    });

    setInviteSuccess(true);
    setTimeout(() => {
      setInviteSuccess(false);
      setShowInviteModal(false);
      setInviteName('');
      setInviteEmail('');
      setInvitePasscode('');
    }, 1500);
  };

  const getMemberWorkload = (memberId: string) => {
    const memberTasks = tasks.filter((t) => t.assigneeId === memberId);
    const completed = memberTasks.filter((t) => t.status === 'done').length;
    const inProgress = memberTasks.filter((t) => t.status === 'in_progress').length;
    const todo = memberTasks.filter((t) => t.status === 'todo').length;
    return { total: memberTasks.length, completed, inProgress, todo };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/90 shadow-2xs rounded-2xl p-5">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Zespół Projektowy & Ochrona Hasłem
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Zarządzaj współpracownikami, hasłami dostępu do tablicy oraz uprawnieniami zespołu.
          </p>
        </div>

        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-sm shadow-indigo-600/20 transition-all self-start sm:self-auto cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          Zaproś osobę z hasłem
        </button>
      </div>

      {/* SECURITY CONTROL PANEL */}
      <div className="bg-white border border-indigo-100 rounded-2xl p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-600 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Blokada wejścia na hasło (Wariant 2 - Password Gate)
                </h3>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                  securityConfig.isGateEnabled
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}>
                  {securityConfig.isGateEnabled ? 'AKTYWNA' : 'WYŁĄCZONA'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Gdy aktywna, każdy użytkownik wchodzący na tablicę przez przeglądarkę musi podać swoje hasło lub kod projektu.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleToggleGate(!securityConfig.isGateEnabled)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer border ${
                securityConfig.isGateEnabled
                  ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              {securityConfig.isGateEnabled ? 'Wyłącz ochronę hasłem' : 'Włącz ochronę hasłem'}
            </button>
          </div>
        </div>

        {/* Master Project Password Row */}
        <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-slate-400" />
              Główny kod projektu (Master PIN):
            </span>
            <span className="text-slate-500 text-[11px] block sm:inline sm:ml-1">
              Uniwersalny kod, którym każdy zaproszony może szybko odblokować tablicę.
            </span>
          </div>

          {isEditingMasterPass ? (
            <form onSubmit={handleSaveMasterPassword} className="flex items-center gap-2">
              <input
                type="text"
                value={masterPasswordInput}
                onChange={(e) => setMasterPasswordInput(e.target.value)}
                placeholder="Nowy kod projektu..."
                className="bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-mono"
              />
              <button
                type="submit"
                className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Zapisz
              </button>
              <button
                type="button"
                onClick={() => setIsEditingMasterPass(false)}
                className="px-2 py-1 text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Anuluj
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-mono bg-slate-100 px-2.5 py-1 rounded-lg text-slate-800 font-semibold border border-slate-200">
                {showMasterPassword ? securityConfig.masterPassword : '••••••••'}
              </span>
              <button
                type="button"
                onClick={() => setShowMasterPassword(!showMasterPassword)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                title="Pokaż / ukryj hasło"
              >
                {showMasterPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setIsEditingMasterPass(true)}
                className="text-indigo-600 hover:text-indigo-700 font-medium underline ml-1 cursor-pointer"
              >
                Zmień kod
              </button>
              {saveMasterSuccess && (
                <span className="text-emerald-600 font-medium text-[11px] flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Zapisano!
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Invite Link Banner */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-800">
              Szybki link zaproszenia do tablicy
            </div>
            <div className="text-[11px] text-slate-500">
              Udostępnij ten link współpracownikom wraz z ich hasłem lub kodem projektu.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={inviteLink}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-600 w-64 select-all focus:outline-none"
          />
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Skopiowano!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Kopiuj link</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Team Members Grid with Password management */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">
          Konta użytkowników i hasła indywidualne ({teamMembers.length})
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teamMembers.map((member) => {
            const workload = getMemberWorkload(member.id);
            const account = securityConfig.accounts.find(
              (acc) => acc.email.toLowerCase() === member.email.toLowerCase()
            );

            return (
              <div
                key={member.id}
                className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl p-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt={member.name}
                          referrerPolicy="no-referrer"
                          className="w-11 h-11 rounded-full object-cover ring-2 ring-slate-100"
                        />
                      ) : (
                        <div
                          className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white ring-2 ring-slate-100 shadow-2xs"
                          style={{ backgroundColor: member.color }}
                        >
                          {member.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{member.name}</h4>
                        <p className="text-xs text-indigo-600 font-medium">{member.role}</p>
                        <p className="text-[11px] font-mono text-slate-400 mt-0.5">{member.email}</p>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                      Aktywny
                    </span>
                  </div>

                  {/* Password Badge for Member */}
                  <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                        Hasło dostępowe:
                      </span>

                      {account ? (
                        editingAccountId === account.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={newPasscodeValue}
                              onChange={(e) => setNewPasscodeValue(e.target.value)}
                              placeholder="Nowe hasło..."
                              className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-800 font-mono w-28"
                            />
                            <button
                              onClick={() => handleSaveAccountPasscode(account.id)}
                              className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[11px] font-semibold cursor-pointer"
                            >
                              OK
                            </button>
                            <button
                              onClick={() => setEditingAccountId(null)}
                              className="text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 font-mono">
                            <span className="px-2 py-0.5 bg-white rounded border border-slate-200 font-semibold text-slate-800">
                              {account.passcode}
                            </span>
                            <button
                              onClick={() => {
                                setEditingAccountId(account.id);
                                setNewPasscodeValue(account.passcode);
                              }}
                              className="text-[11px] text-indigo-600 hover:text-indigo-700 underline font-sans cursor-pointer"
                            >
                              Zmień
                            </button>
                          </div>
                        )
                      ) : (
                        <span className="text-slate-400 text-[11px]">Brak (używa Master PIN)</span>
                      )}
                    </div>
                  </div>

                  {/* Workload Progress */}
                  <div className="mt-3 pt-3 border-t border-slate-100 text-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1.5">
                      <span>Zadania w toku:</span>
                      <span className="font-mono text-slate-800 font-medium">
                        {workload.inProgress + workload.todo} / {workload.total}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full rounded-full transition-all"
                        style={{
                          width: workload.total > 0 ? `${(workload.completed / workload.total) * 100}%` : '0%',
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 font-mono">
                      <span>Ukończone: {workload.completed}</span>
                      <span>W trakcie: {workload.inProgress}</span>
                      <span>Do zrobienia: {workload.todo}</span>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                {member.id !== 'user-darecki' && (
                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => {
                        if (confirm(`Czy na pewno chcesz usunąć użytkownika ${member.name} z projektu?`)) {
                          onRemoveMember(member.id);
                        }
                      }}
                      className="text-xs text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                    >
                      Usuń z projektu
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Invite Member Modal with Password generator */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-indigo-600" />
              Zaproś nowego członka zespołu z hasłem
            </h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Użytkownik otrzyma uprawnienia do edycji tablicy Kanban oraz indywidualne hasło dostępowe.
            </p>

            {inviteSuccess ? (
              <div className="py-8 text-center text-emerald-600 space-y-2">
                <CheckCircle2 className="w-12 h-12 mx-auto animate-bounce" />
                <div className="text-sm font-semibold">Zaproszenie wysłane pomyślnie!</div>
                <div className="text-xs text-slate-500">Dodano współpracownika i zapisano hasło.</div>
              </div>
            ) : (
              <form onSubmit={handleSendInvite} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Imię i nazwisko <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="np. Piotr Nowak"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Adres e-mail <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="piotr.nowak@firma.pl"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Rola w zespole
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none cursor-pointer"
                  >
                    <option value="Frontend Developer">Frontend Developer</option>
                    <option value="Backend Developer">Backend Developer</option>
                    <option value="Full-Stack Developer">Full-Stack Developer</option>
                    <option value="UI/UX Designer">UI/UX Designer</option>
                    <option value="QA Engineer">QA Engineer</option>
                    <option value="Product Manager">Product Manager</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Indywidualne hasło dostępowe</span>
                    <span className="text-[10px] text-slate-400">(opcjonalne – domyślnie wygenerowane)</span>
                  </label>
                  <input
                    type="text"
                    value={invitePasscode}
                    onChange={(e) => setInvitePasscode(e.target.value)}
                    placeholder="np. piotr2025"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none font-mono"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-sm shadow-indigo-600/20 transition-all cursor-pointer"
                  >
                    Dodaj i wygeneruj dostęp
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
