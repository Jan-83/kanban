import { useState } from 'react';
import { Check, Pencil, Plus, Trash2, Users, X } from 'lucide-react';
import type { BoardData, TeamMember } from '../types/kanban';
import { STAGE_COLORS } from '../utils/board';

interface Props {
  data: BoardData;
  onAdd: (member: TeamMember) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
  onUpdate: (member: TeamMember) => Promise<boolean>;
  busy: boolean;
}

export function TeamView({ data, onAdd, onRemove, onUpdate, busy }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('');

  const startEdit = (m: TeamMember) => {
    setEditingId(m.id);
    setEditName(m.name);
    setEditEmail(m.email || '');
    setEditRole(m.role || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (e: React.FormEvent, m: TeamMember) => {
    e.preventDefault();
    const trimmed = editName.trim();
    if (!trimmed) return;
    const ok = await onUpdate({
      ...m,
      name: trimmed,
      email: editEmail.trim(),
      role: editRole.trim(),
    });
    if (ok !== false) {
      setEditingId(null);
    }
  };

  return (
    <div className="team-layout">
      <section className="panel">
        <div className="panel-heading">
          <Users size={17} />
          <h2>Osoby w projekcie</h2>
          <span className="count">{data.members.length}</span>
        </div>
        <p className="panel-description">
          Lista osób, którym można przypisywać zadania. Dostęp do logowania nadaje osobno administrator.
        </p>
        {data.members.map(m => {
          if (editingId === m.id) {
            return (
              <form key={m.id} className="person-edit-form" onSubmit={e => void saveEdit(e, m)}>
                <div className="person-edit-inputs">
                  <label className="person-edit-label">
                    <span>Imię i nazwisko</span>
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      maxLength={120}
                      required
                      autoFocus
                      disabled={busy}
                      placeholder="Imię i nazwisko"
                    />
                  </label>
                  <label className="person-edit-label">
                    <span>Rola w projekcie</span>
                    <input
                      value={editRole}
                      onChange={e => setEditRole(e.target.value)}
                      maxLength={120}
                      disabled={busy}
                      placeholder="np. Projektant"
                    />
                  </label>
                  <label className="person-edit-label">
                    <span>E-mail <span className="muted">(opcjonalnie)</span></span>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={e => setEditEmail(e.target.value)}
                      maxLength={254}
                      disabled={busy}
                      placeholder="np. jan@firma.pl"
                    />
                  </label>
                </div>
                <div className="person-edit-actions">
                  <button type="button" className="button secondary compact" disabled={busy} onClick={cancelEdit}>
                    <X size={14} /> Anuluj
                  </button>
                  <button type="submit" className="button primary compact" disabled={busy || !editName.trim()}>
                    <Check size={14} /> Zapisz
                  </button>
                </div>
              </form>
            );
          }
          return (
            <div className="person-row" key={m.id}>
              <span className="avatar" style={{ background: m.color + '18', color: m.color }}>
                {m.name.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <strong>{m.name}</strong>
                <p>{m.role || 'Zespół'}{m.email && ' · ' + m.email}</p>
              </div>
              <span className="count">
                {data.tasks.filter(t => t.assigneeId === m.id && t.status !== 'done').length} aktywnych
              </span>
              <div className="person-actions">
                <button
                  type="button"
                  className="icon-button"
                  disabled={busy}
                  aria-label={'Edytuj osobę: ' + m.name}
                  title={'Edytuj osobę: ' + m.name}
                  onClick={() => startEdit(m)}
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  className="icon-button danger"
                  disabled={busy}
                  aria-label={'Usuń osobę: ' + m.name}
                  title={'Usuń osobę: ' + m.name}
                  onClick={() => {
                    if (confirm('Usunąć osobę z listy? Jej zadania pozostaną bez przypisania. To nie cofa dostępu do logowania.')) {
                      void onRemove(m.id);
                    }
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
        {!data.members.length && <div className="empty-state">Dodaj pierwszą osobę do listy projektu.</div>}
      </section>
      <section className="panel">
        <h2>Dodaj osobę do listy</h2>
        <form
          className="form-stack"
          onSubmit={async e => {
            e.preventDefault();
            if (await onAdd({
              id: crypto.randomUUID(),
              name: name.trim(),
              email: email.trim(),
              role: role.trim(),
              color: STAGE_COLORS[data.members.length % STAGE_COLORS.length],
              status: 'active'
            })) {
              setName('');
              setEmail('');
              setRole('');
            }
          }}
        >
          <label>
            Imię i nazwisko
            <input value={name} onChange={e => setName(e.target.value)} maxLength={120} required />
          </label>
          <label>
            E-mail <span className="muted">(opcjonalnie)</span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} />
          </label>
          <label>
            Rola w projekcie
            <input value={role} onChange={e => setRole(e.target.value)} placeholder="np. Projektant" maxLength={120} />
          </label>
          <button className="button primary" disabled={busy || data.members.length >= 200}>
            <Plus size={16} />Dodaj osobę
          </button>
        </form>
        <p className="panel-description">Dodanie osoby nie wysyła zaproszenia i nie tworzy konta.</p>
      </section>
    </div>
  );
}

