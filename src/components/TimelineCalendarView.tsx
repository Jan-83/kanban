import { CalendarClock } from 'lucide-react';
import type { BoardData, Task } from '../types/kanban';
import { evaluateDueDate } from '../utils/dateUtils';
import { stageTitle, taskAssignees } from '../utils/board';
export function TimelineCalendarView({ data, onEdit, busy }: { data: BoardData; onEdit: (task: Task) => void; busy: boolean }) {
  const groups: { title: string; id: string; tasks: Task[] }[] = ['Po terminie', 'Dzisiaj', 'Najbliższe 48 godzin', 'Później', 'Bez terminu', 'Zakończone'].map((title, i) => ({ title, id: String(i), tasks: [] }));
  data.tasks.forEach(t => { const due = evaluateDueDate(t.dueDate); const index = t.status === 'done' ? 5 : !t.dueDate ? 4 : due.isOverdue ? 0 : due.isToday ? 1 : due.isSoon ? 2 : 3; groups[index].tasks.push(t); });
  return <div className="timeline-grid">{groups.map((g, i) => <section className="panel" key={g.id}><div className="panel-heading"><CalendarClock size={17} className={i === 0 ? 'overdue' : ''} /><h2>{g.title}</h2><span className="count">{g.tasks.length}</span></div>{g.tasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map(t => <button className="timeline-task" disabled={busy} key={t.id} onClick={() => onEdit(t)}><strong>{t.title}</strong><span>{evaluateDueDate(t.dueDate, t.status === 'done').formatted} · {stageTitle(data.stages, t.status)}</span><span>{taskAssignees(t, data.members).map(person => person.name).join(', ') || 'Nieprzypisane'}</span></button>)}{!g.tasks.length && <p className="empty-small">Brak zadań</p>}</section>)}</div>;
}

