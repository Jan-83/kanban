import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, UserRound } from 'lucide-react';
import type { TeamMember } from '../types/kanban';

interface OptionsProps {
  members: TeamMember[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function TaskAssigneeOptions({ members, value, onChange, disabled }: OptionsProps) {
  return <div className="assignee-options">
    {members.map(member => <label key={member.id} className={'assignee-option' + (value.includes(member.id) ? ' selected' : '')}>
      <input type="checkbox" aria-label={'Odpowiedzialny: ' + member.name} checked={value.includes(member.id)} disabled={disabled}
        onChange={event => onChange(event.target.checked ? [...value, member.id] : value.filter(id => id !== member.id))} />
      <span className="avatar small" style={{ '--person-color': member.color } as CSSProperties}>{member.name.split(' ').map(x => x[0]).slice(0, 2).join('')}</span>
      <span>{member.name}</span>
    </label>)}
    {!members.length && <p className="muted hint-small">Dodaj osoby w widoku „Zespół”.</p>}
  </div>;
}

interface PickerProps extends OptionsProps { taskTitle: string; compact?: boolean; }
export function TaskAssigneePicker({ members, value, onChange, disabled, taskTitle, compact }: PickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [position, setPosition] = useState<CSSProperties>({});
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const originalSelection = useRef('');
  const popupId = useId();
  const selectionKey = JSON.stringify(value);
  const people = value.flatMap(id => { const member = members.find(m => m.id === id); return member ? [member] : []; });
  const names = people.map(m => m.name).join(', ') || 'Nieprzypisane';
  const close = (restoreFocus = false) => { setOpen(false); if (restoreFocus) trigger.current?.focus(); };

  useEffect(() => {
    if (open && (disabled || originalSelection.current !== selectionKey)) setOpen(false);
  }, [disabled, selectionKey, open]);
  useEffect(() => {
    if (!open) return;
    popup.current?.querySelector<HTMLInputElement>('input')?.focus();
    const outside = (event: PointerEvent) => {
      if (!popup.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close(true); } };
    const scroll = (event: Event) => { if (!popup.current?.contains(event.target as Node)) close(); };
    const resize = () => close();
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    document.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', resize);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      document.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', resize);
    };
  }, [open]);

  const toggle = () => {
    if (open) { close(); return; }
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(280, window.innerWidth - 24);
    const below = window.innerHeight - rect.bottom >= Math.min(220, 100 + members.length * 40);
    setPosition({ width, left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
      top: below ? rect.bottom + 6 : rect.top - 6, ...(below ? {} : { transform: 'translateY(-100%)' }) });
    originalSelection.current = selectionKey;
    setDraft([...value]);
    setOpen(true);
  };
  return <>
    <button ref={trigger} type="button" className={'card-assignee-pill' + (compact ? '' : ' list-assignees')} title={'Osoby odpowiedzialne: ' + names}
      aria-label={'Zmień osoby dla zadania: ' + taskTitle} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? popupId : undefined}
      disabled={disabled} onClick={event => { event.stopPropagation(); toggle(); }}>
      <span className="assignee-avatars" aria-hidden="true">{people.length ? people.slice(0, 2).map(person => <span key={person.id} className="avatar small" style={{ '--person-color': person.color } as CSSProperties}>{person.name.split(' ').map(x => x[0]).slice(0, 2).join('')}</span>) : <span className="avatar small"><UserRound size={11} /></span>}</span>
      <span className="card-assignee-name">{people.length ? names : 'Przypisz'}</span>
      <ChevronDown size={11} className="card-assignee-arrow" />
    </button>
    {open && createPortal(<div ref={popup} id={popupId} className="assignee-popup" role="dialog" aria-label={'Osoby odpowiedzialne: ' + taskTitle} style={position}>
      <fieldset><legend className="field-label">Osoby odpowiedzialne</legend><p className="muted hint-small">Możesz wybrać kilka osób.</p>
        <TaskAssigneeOptions members={members} value={draft} onChange={setDraft} />
      </fieldset>
      <div className="assignee-popup-actions"><button type="button" className="button" onClick={() => setDraft([])}>Wyczyść</button><button type="button" className="button primary" onClick={() => { onChange(draft); close(true); }}>Zastosuj osoby</button></div>
    </div>, document.body)}
  </>;
}
