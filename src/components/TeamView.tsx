import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Mail, 
  ShieldCheck, 
  Copy, 
  Check, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  Briefcase 
} from 'lucide-react';
import { TeamMember, Task } from '../types/kanban';

interface TeamViewProps {
  teamMembers: TeamMember[];
  tasks: Task[];
  onAddMember: (member: Omit<TeamMember, 'id'>) => void;
  onRemoveMember: (memberId: string) => void;
}

export const TeamView: React.FC<TeamViewProps> = ({
  teamMembers,
  tasks,
  onAddMember,
  onRemoveMember,
}) => {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Frontend Developer');
  const [copiedLink, setCopiedLink] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const inviteLink = `https://${window.location.host}/join-project?invite=kbn_${Math.random().toString(36).substring(2, 9)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;

    const colors = ['#6366F1', '#EC4899', '#06B6D4', '#10B981', '#F59E0B', '#8B5CF6'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    onAddMember({
      name: inviteName.trim(),
      email: inviteEmail.trim(),
      role: inviteRole,
      status: 'active',
      color: randomColor,
    });

    setInviteSuccess(true);
    setTimeout(() => {
      setInviteSuccess(false);
      setShowInviteModal(false);
      setInviteName('');
      setInviteEmail('');
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            Zespół Projektowy & Uprawnienia
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Zarządzaj współpracownikami, deleguj zadania oraz wysyłaj zaproszenia do tablicy.
          </p>
        </div>

        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-sm shadow-indigo-600/30 transition-all self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          Zaproś osobę do projektu
        </button>
      </div>

      {/* Quick Invite Link Banner */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-950/60 border border-indigo-800 flex items-center justify-center text-indigo-400 shrink-0">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-neutral-200">
              Szybki link zaproszenia do tablicy
            </div>
            <div className="text-[11px] text-neutral-400">
              Udostępnij ten link członkom zespołu, aby natychmiast dołączyli do projektu.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={inviteLink}
            className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs font-mono text-neutral-400 w-64 select-all focus:outline-none"
          />
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-white rounded-lg transition-colors whitespace-nowrap"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
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

      {/* Team Members Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teamMembers.map((member) => {
          const workload = getMemberWorkload(member.id);

          return (
            <div
              key={member.id}
              className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    {member.avatarUrl ? (
                      <img
                        src={member.avatarUrl}
                        alt={member.name}
                        referrerPolicy="no-referrer"
                        className="w-11 h-11 rounded-full object-cover ring-2 ring-neutral-700"
                      />
                    ) : (
                      <div
                        className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white ring-2 ring-neutral-700"
                        style={{ backgroundColor: member.color }}
                      >
                        {member.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h4 className="text-sm font-bold text-white">{member.name}</h4>
                      <p className="text-xs text-indigo-400 font-medium">{member.role}</p>
                      <p className="text-[11px] font-mono text-neutral-400 mt-0.5">{member.email}</p>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/80">
                    Aktywny
                  </span>
                </div>

                {/* Workload Progress */}
                <div className="mt-4 pt-3 border-t border-neutral-800 text-xs">
                  <div className="flex items-center justify-between text-neutral-400 mb-1.5">
                    <span>Zadania w toku:</span>
                    <span className="font-mono text-white">
                      {workload.inProgress + workload.todo} / {workload.total}
                    </span>
                  </div>
                  <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full rounded-full transition-all"
                      style={{
                        width: workload.total > 0 ? `${(workload.completed / workload.total) * 100}%` : '0%',
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-neutral-500 mt-2 font-mono">
                    <span>Ukończone: {workload.completed}</span>
                    <span>W trakcie: {workload.inProgress}</span>
                    <span>Do zrobienia: {workload.todo}</span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              {member.id !== 'user-darecki' && (
                <div className="mt-4 pt-3 border-t border-neutral-800 flex justify-end">
                  <button
                    onClick={() => {
                      if (confirm(`Czy na pewno chcesz usunąć użytkownika ${member.name} z projektu?`)) {
                        onRemoveMember(member.id);
                      }
                    }}
                    className="text-xs text-neutral-500 hover:text-rose-400 transition-colors"
                  >
                    Usuń z projektu
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-indigo-400" />
              Zaproś nowego członka zespołu
            </h3>
            <p className="text-xs text-neutral-400 mt-1 mb-4">
              Użytkownik otrzyma uprawnienia do edycji tablicy Kanban oraz powiadomienia o przydzielonych zadaniach.
            </p>

            {inviteSuccess ? (
              <div className="py-8 text-center text-emerald-400 space-y-2">
                <CheckCircle2 className="w-12 h-12 mx-auto animate-bounce" />
                <div className="text-sm font-semibold">Zaproszenie wysłane pomyślnie!</div>
                <div className="text-xs text-neutral-400">Dodano współpracownika do listy projektu.</div>
              </div>
            ) : (
              <form onSubmit={handleSendInvite} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Imię i nazwisko <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="np. Piotr Nowicki"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Adres e-mail <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="piotr.nowicki@example.com"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Rola w projekcie
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Frontend Developer">Frontend Developer</option>
                    <option value="Backend Developer">Backend Developer</option>
                    <option value="Full-Stack Developer">Full-Stack Developer</option>
                    <option value="UI/UX Designer">UI/UX Designer</option>
                    <option value="QA / Tester">QA / Tester</option>
                    <option value="DevOps Engineer">DevOps Engineer</option>
                    <option value="Product Owner">Product Owner</option>
                  </select>
                </div>

                <div className="pt-4 border-t border-neutral-800 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="px-3 py-2 text-xs text-neutral-400 hover:text-white"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Wyślij zaproszenie
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
