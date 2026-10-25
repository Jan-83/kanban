import type { BoardStage, Task, TeamMember } from '../types/kanban';
import type { StrategyCard, StrategyData } from '../types/strategy';
import { DEFAULT_STAGES, parseBoard, taskAssigneeIds } from './board';

export const STRATEGY_STAGES: BoardStage[] = [
  { id: 'discuss', title: 'Do omówienia', color: '#64748b' },
  ...DEFAULT_STAGES,
  { id: 'refine', title: 'Do dopracowania', color: '#d97706' },
];
export const MAX_STRATEGY_CARDS = 1000;
const validId = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(v);
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)])) : value;
const sameTask = (a: Task, b: Task) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const sameParents = (a: string[], b: string[]) => a.length === b.length && a.every(id => b.includes(id));

export function parseStrategy(value: unknown): StrategyData {
  const input = value as { version: number; cards: (StrategyCard & { parentId?: string | null })[] };
  if (!input || ![1, 2].includes(input.version) || !Array.isArray(input.cards) || input.cards.length > MAX_STRATEGY_CARDS || JSON.stringify(input).length > 2000000) throw new Error('Nieprawidłowy format lub przekroczony rozmiar tablicy strategicznej.');
  if (input.cards.some(c => c && (input.version === 1 ? 'parentIds' in c : 'parentId' in c))) throw new Error('Nieprawidłowy format połączeń kart.');
  // Read existing trees without rewriting tasks or positions. Only a successful
  // CAS save upgrades storage; the server then rejects older single-parent writers.
  const data = { cards: input.cards.map(c => ({ ...c, parentIds: input.version === 1 ? c?.parentId === null ? [] : [c?.parentId] : c?.parentIds })) };
  const ids = new Set<string>();
  for (const card of data.cards) {
    if (!card.task || !validId(card.task.id) || ids.has(card.task.id) || !Array.isArray(card.parentIds) || !card.parentIds.every(validId) || new Set(card.parentIds).size !== card.parentIds.length || !card.position || !['x', 'y'].every(k => Number.isFinite(card.position[k as 'x' | 'y']) && Math.abs(card.position[k as 'x' | 'y']) <= 10000000)) throw new Error('Nieprawidłowa karta lub jej pozycja.');
    ids.add(card.task.id);
  }
  const children = new Map<string, string[]>(), pending = new Map(data.cards.map(c => [c.task.id, c.parentIds.length]));
  for (const card of data.cards) {
    for (const parent of card.parentIds as string[]) {
      if (!ids.has(parent)) throw new Error('Powiązania kart zawierają brakującą kartę.');
      children.set(parent, [...(children.get(parent) ?? []), card.task.id]);
    }
  }
  // Kahn's algorithm visits each card/connection once, including shared subtrees.
  const ready = data.cards.filter(c => !c.parentIds.length).map(c => c.task.id);
  for (let i = 0; i < ready.length; i++) for (const id of children.get(ready[i]) ?? []) {
    const remaining = pending.get(id)! - 1; pending.set(id, remaining);
    if (remaining === 0) ready.push(id);
  }
  if (ready.length !== data.cards.length) throw new Error('Powiązania kart zawierają pętlę.');
  // Historical assignments remain readable if a person is later removed from the team.
  // Access is always decided by protected membership rows, never these display IDs.
  const memberIds = [...new Set(data.cards.flatMap(c => [...(Array.isArray(c.task.assigneeIds) ? c.task.assigneeIds : []), ...(c.task.assigneeId ? [c.task.assigneeId] : [])]))];
  const members: TeamMember[] = memberIds.map(id => ({ id, name: id, email: '', role: '', color: '#64748b', status: 'active' }));
  const cleaned = parseBoard({ tasks: data.cards.map(c => c.task), members, stages: STRATEGY_STAGES }).tasks;
  return { version: 2, cards: data.cards.map((c, i) => ({ task: cleaned[i], parentIds: [...c.parentIds] as string[], position: { x: c.position.x, y: c.position.y } })) };
}

export function descendantIds(data: StrategyData, id: string): Set<string> {
  const byParent = new Map<string, string[]>();
  for (const card of data.cards) for (const parent of card.parentIds) byParent.set(parent, [...(byParent.get(parent) ?? []), card.task.id]);
  const found = new Set<string>(), pending = [id];
  while (pending.length) for (const child of byParent.get(pending.pop()!) ?? []) if (!found.has(child) && child !== id) { found.add(child); pending.push(child); }
  return found;
}

export function canParent(data: StrategyData, childId: string, parentId: string): boolean {
  return parentId !== childId && data.cards.some(c => c.task.id === parentId) && !descendantIds(data, childId).has(parentId);
}

export function hiddenStrategyIds(data: StrategyData, collapsed: Set<string>): Set<string> {
  const visible = new Set<string>(), pending = data.cards.filter(c => !c.parentIds.length).map(c => c.task.id);
  const children = new Map<string, string[]>();
  for (const c of data.cards) for (const parent of c.parentIds) children.set(parent, [...(children.get(parent) ?? []), c.task.id]);
  while (pending.length) {
    const id = pending.pop()!;
    if (visible.has(id)) continue;
    visible.add(id);
    if (!collapsed.has(id)) pending.push(...children.get(id) ?? []);
  }
  return new Set(data.cards.filter(c => !visible.has(c.task.id)).map(c => c.task.id));
}

export function cardPath(data: StrategyData, id: string): string {
  const byId = new Map(data.cards.map(c => [c.task.id, c])), seen = new Set<string>(), parts: string[] = [];
  let current = byId.get(id);
  while (current && !seen.has(current.task.id)) { parts.unshift(current.task.title); seen.add(current.task.id); current = byId.get(current.parentIds[0]); }
  return parts.join(' › ');
}

export function updateStrategyCard(data: StrategyData, original: StrategyCard | null, task: Task, parentIds: string[], position: StrategyCard['position'], colorBranch = false): StrategyData {
  const current = data.cards.find(c => c.task.id === task.id);
  if (original && (!current || !sameTask(current.task, original.task))) throw new Error('Ta karta została zmieniona przez drugą osobę. Twoja treść pozostaje w formularzu. Skopiuj ją i otwórz aktualną kartę ponownie.');
  if (!original && current) throw new Error('Karta o tym identyfikatorze już istnieje.');
  // Apply only the editor's additions/removals; preserve links added meanwhile.
  const removed = original?.parentIds.filter(id => !parentIds.includes(id)) ?? [];
  const added = parentIds.filter(id => !original?.parentIds.includes(id));
  const mergedParents = [...new Set([...(current?.parentIds ?? []).filter(id => !removed.includes(id)), ...added])];
  if (mergedParents.some(id => !canParent(data, task.id, id))) throw new Error('Nie można podpiąć karty pod nią samą, jej podkartę lub usuniętą kartę.');
  const card = { task, parentIds: mergedParents, position: current?.position ?? position };
  let next: StrategyData = { version: 2, cards: current ? data.cards.map(c => c.task.id === task.id ? card : c) : [...data.cards, card] };
  if (colorBranch) {
    const descendants = descendantIds(next, task.id);
    next = { ...next, cards: next.cards.map(c => descendants.has(c.task.id) ? { ...c, task: { ...c.task, color: task.color, updatedAt: task.updatedAt } } : c) };
  }
  return parseStrategy(next);
}

export function setStrategySubtaskCompleted(data: StrategyData, cardId: string, subtaskId: string, completed: boolean): StrategyData {
  const card = data.cards.find(c => c.task.id === cardId);
  const step = card?.task.subtasks.find(s => s.id === subtaskId);
  if (!card || !step) throw new Error('Ten krok został usunięty przez drugą osobę. Otwórz aktualną kartę.');
  // Save the requested state, not a toggle: replaying after a CAS conflict
  // must not undo a teammate who has just checked the same step.
  if (step.completed === completed) return data;
  return { ...data, cards: data.cards.map(c => c.task.id === cardId ? { ...c, task: { ...c.task, updatedAt: new Date().toISOString(), subtasks: c.task.subtasks.map(s => s.id === subtaskId ? { ...s, completed } : s) } } : c) };
}

export function setStrategyConnection(data: StrategyData, id: string, parentId: string, connected: boolean): StrategyData {
  const card = data.cards.find(c => c.task.id === id);
  if (!card) throw new Error('Ta karta została usunięta.');
  if (connected && !canParent(data, id, parentId)) throw new Error('Nie można utworzyć pętli ani połączyć z usuniętą kartą.');
  if (card.parentIds.includes(parentId) === connected) return data;
  return { ...data, cards: data.cards.map(c => c.task.id === id ? { ...c, parentIds: connected ? [...c.parentIds, parentId] : c.parentIds.filter(p => p !== parentId) } : c) };
}

export function moveStrategyCards(data: StrategyData, ids: string[], delta: StrategyCard['position']): StrategyData {
  if (ids.some(id => !data.cards.some(c => c.task.id === id))) throw new Error('Jedna z przesuwanych kart została usunięta.');
  const selected = new Set(ids);
  return parseStrategy({ ...data, cards: data.cards.map(c => selected.has(c.task.id) ? { ...c, position: { x: c.position.x + delta.x, y: c.position.y + delta.y } } : c) });
}

export function deleteStrategyCard(data: StrategyData, original: StrategyCard): StrategyData {
  const current = data.cards.find(c => c.task.id === original.task.id);
  if (!current || !sameTask(current.task, original.task) || !sameParents(current.parentIds, original.parentIds)) throw new Error('Karta zmieniła się podczas edycji. Otwórz ją ponownie przed usunięciem.');
  // Removing a card never removes its children or unrelated Kanban tasks.
  return parseStrategy({ ...data, cards: data.cards.filter(c => c !== current).map(c => c.parentIds.includes(current.task.id) ? { ...c, parentIds: [...new Set([...c.parentIds.filter(id => id !== current.task.id), ...current.parentIds])] } : c) });
}

export function layoutStrategy(data: StrategyData, columns = 3): StrategyData {
  const positions = new Map<string, StrategyCard['position']>();
  const roots = data.cards.filter(c => !c.parentIds.length);
  let rowY = 30;
  for (let index = 0; index < roots.length; index += columns) {
    let x = 40, maxHeight = 0;
    for (const root of roots.slice(index, index + columns)) {
      const stack = [{ card: root, depth: 0 }]; let height = 0, maxDepth = 0;
      while (stack.length) {
        const { card, depth } = stack.pop()!;
        if (positions.has(card.task.id)) continue;
        positions.set(card.task.id, { x: x + depth * 36, y: rowY + height }); maxDepth = Math.max(maxDepth, depth);
        height += 230 + (card.parentIds.length > 1 ? 27 : 0) + (card.task.subtasks.length ? Math.min(140, card.task.subtasks.length * 17 + 16) + 6 : 0);
        const children = data.cards.filter(c => c.parentIds.includes(card.task.id));
        for (const child of [...children].reverse()) stack.push({ card: child, depth: depth + 1 });
      }
      x += 320 + maxDepth * 36; maxHeight = Math.max(maxHeight, height);
    }
    rowY += maxHeight + 55;
  }
  return { ...data, cards: data.cards.map(c => ({ ...c, position: positions.get(c.task.id)! })) };
}

export function createStrategySeed(): StrategyData {
  const names = ['Mieszkanie', 'Dom', 'Willa', 'Małe biuro', 'Mały budynek biurowy', 'Większe biuro'];
  const rows = [
    ['Prosta obsługa i wygoda na co dzień.', 'Światło, temperatura, prywatność — czego potrzebują mieszkańcy?', 'Sceny światła, rolety i komfort cieplny. Zakres do wspólnego wyboru.', 'Potwierdźmy funkcje, urządzenia i efekt, za które weźmiemy odpowiedzialność.', 'Budżet, okablowanie i ograniczenia instalacji do sprawdzenia.'],
    ['Wspólny rytm domu i jego mieszkańców.', 'Poranek, wyjście i noc. Co ma działać jednym przyciskiem?', 'Światło, osłony, ogrzewanie i wybrane funkcje ogrodu.', 'Uzgodnijmy konkretny zakres i etapy uruchomienia.', 'Które istniejące urządzenia możemy połączyć?'],
    ['Komfort, prywatność i dopracowany detal.', 'Strefy i indywidualne sceny dla wszystkich domowników.', 'Oświetlenie, klimat, osłony i audio dobrane do stylu życia.', 'Potwierdźmy działanie scen i zakres serwisu.', 'Nietypowe integracje i wymagania projektanta.'],
    ['Wygodna praca niewielkiego zespołu.', 'Komfort pracy, spotkania, łatwe zamknięcie biura.', 'Sceny spotkań, światło, temperatura, tryb poza godzinami.', 'Ustalmy podstawowy pakiet oraz odpowiedzialność za obsługę.', 'Najem czy własność? Możliwe zmiany instalacji.'],
    ['Uporządkowane zarządzanie przestrzenią.', 'Potrzeby użytkowników, administratora i najemców.', 'Strefy, harmonogramy, wybrane pomiary.', 'Spiszmy zakres wspólny, zakres najemców i plan uruchomienia.', 'Istniejąca automatyka oraz podział odpowiedzialności.'],
    ['Spójna obsługa wielu stref i zespołów.', 'Sale spotkań, strefy pracy, zmienne obłożenie.', 'Sceny sal, sterowanie strefowe, harmonogramy, pomiary.', 'Ustalmy zakres pilotażu, odbioru i późniejszego utrzymania.', 'BMS, rezerwacje sal, AV — co wymaga sprawdzenia?'],
  ];
  const titles = ['', 'Potrzeby użytkownika', 'Co możemy dostarczyć', 'Co dowieziemy', 'Do dopracowania'];
  const colors = ['#6366f1', '#0284c7', '#6366f1', '#10b981', '#d97706'];
  const stamp = '2026-10-25T00:00:00.000Z';
  const make = (id: string, parentId: string | null, title: string, description: string, color: string): StrategyCard => ({ parentIds: parentId ? [parentId] : [], position: { x: 0, y: 0 }, task: { id, title, description, status: 'discuss', priority: 'medium', dueDate: '', assigneeId: null, assigneeIds: [], tags: [], subtasks: [], statusComments: [], closingStatus: '', color, createdAt: stamp, updatedAt: stamp } });
  const cards = names.flatMap((name, i) => rows[i].map((text, j) => make(`strategy-${i}-${j}`, j ? `strategy-${i}-0` : null, j ? titles[j] : name, text, colors[j])));
  cards.push(make('strategy-light', 'strategy-0-2', 'Oświetlenie', 'Jakie sceny światła uproszczą codzienność?', '#d97706'), make('strategy-return', 'strategy-light', 'Scena „Powrót”', 'Przykład do omówienia: jedno naciśnięcie włącza wybrane światła i przywraca komfort w domu.', '#0d9488'));
  return layoutStrategy({ version: 2, cards });
}

export function strategyAssignees(card: StrategyCard, members: TeamMember[]): TeamMember[] {
  return taskAssigneeIds(card.task).flatMap(id => { const member = members.find(m => m.id === id); return member ? [member] : []; });
}
