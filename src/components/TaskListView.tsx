import { useState } from 'react';
import type { BoardData, Task } from '../types/kanban';
import { evaluateDueDate } from '../utils/dateUtils';
import { PRIORITIES } from './TaskCard';
interface Props { data: BoardData; onEdit: (task: Task) => void; onMove: (id: string, stage: string) => void; busy: boolean; }
export function TaskListView({ data, onEdit, onMove, busy }: Props) {
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState('');
  const [sort, setSort] = useState('order');
  const weights = { urgent: 0, high: 1, medium: 2, low: 3 };
  const tasks = data.tasks.filter(t => (!stage || t.status === stage) && t.title.toLocaleLowerCase('pl').includes(query.toLocaleLowerCase('pl')));
  if (sort === 'date') tasks.sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  if (sort === 'priority') tasks.sort((a, b) => weights[a.priority] - weights[b.priority]);
  return <><div className="board-toolbar"><input placeholder="Szukaj zadania…" aria-label="Szukaj na liście" value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="Filtr etapu" value={stage} onChange={e => setStage(e.target.value)}><option value="">Wszystkie etapy</option>{data.stages.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select><select aria-label="Sortowanie listy" value={sort} onChange={e => setSort(e.target.value)}><option value="order">Kolejność na tablicy</option><option value="date">Termin</option><option value="priority">Priorytet</option></select><span className="muted">{tasks.length} zadań</span></div>
  <div className="table-scroll"><table className="task-table"><thead><tr><th>Zadanie</th><th>Etap</th><th>Priorytet</th><th>Osoba</th><th>Termin</th></tr></thead><tbody>{tasks.map(t => { const due = evaluateDueDate(t.dueDate, t.status === 'done'); return <tr key={t.id}><td><button className="table-title" disabled={busy} onClick={() => onEdit(t)}>{t.title}</button>{t.tags.length > 0 && <div className="muted table-tags">{t.tags.join(' · ')}</div>}</td><td><select value={t.status} disabled={busy} aria-label={'Etap: ' + t.title} onChange={e => onMove(t.id, e.target.value)}>{data.stages.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></td><td><span className={'priority ' + t.priority}><span />{PRIORITIES[t.priority]}</span></td><td>{data.members.find(m => m.id === t.assigneeId)?.name ?? '—'}</td><td className={due.isOverdue ? 'overdue' : ''}>{due.formatted}</td></tr>; })}</tbody></table>{!tasks.length && <div className="empty-state">Brak zadań pasujących do filtrów.</div>}</div></>;
}

