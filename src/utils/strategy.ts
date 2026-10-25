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

export function parseStrategy(value: unknown): StrategyData {
  const data = value as StrategyData;
  if (!data || data.version !== 1 || !Array.isArray(data.cards) || data.cards.length > MAX_STRATEGY_CARDS || JSON.stringify(data).length > 2000000) throw new Error('Nieprawidłowy format lub przekroczony rozmiar tablicy strategicznej.');
  const ids = new Set<string>();
  for (const card of data.cards) {
    if (!card || !card.task || !validId(card.task.id) || ids.has(card.task.id) || !(card.parentId === null || validId(card.parentId)) || !card.position || !['x', 'y'].every(k => Number.isFinite(card.position[k as 'x' | 'y']) && Math.abs(card.position[k as 'x' | 'y']) <= 10000000)) throw new Error('Nieprawidłowa karta lub jej pozycja.');
    ids.add(card.task.id);
  }
  const parents = new Map(data.cards.map(c => [c.task.id, c.parentId]));
  for (const card of data.cards) {
    const seen = new Set([card.task.id]);
    let parent = card.parentId;
    while (parent !== null) {
      if (!ids.has(parent) || seen.has(parent)) throw new Error('Powiązania kart zawierają pętlę albo brakującą kartę.');
      seen.add(parent); parent = parents.get(parent)!;
    }
  }
  // Historical assignments remain readable if a person is later removed from the team.
  // Access is always decided by protected membership rows, never these display IDs.
  const memberIds = [...new Set(data.cards.flatMap(c => [...(Array.isArray(c.task.assigneeIds) ? c.task.assigneeIds : []), ...(c.task.assigneeId ? [c.task.assigneeId] : [])]))];
  const members: TeamMember[] = memberIds.map(id => ({ id, name: id, email: '', role: '', color: '#64748b', status: 'active' }));
  const cleaned = parseBoard({ tasks: data.cards.map(c => c.task), members, stages: STRATEGY_STAGES }).tasks;
  return { version: 1, cards: data.cards.map((c, i) => ({ task: cleaned[i], parentId: c.parentId, position: { x: c.position.x, y: c.position.y } })) };
}

export function descendantIds(data: StrategyData, id: string): Set<string> {
  const byParent = new Map<string, string[]>();
  for (const card of data.cards) if (card.parentId) byParent.set(card.parentId, [...(byParent.get(card.parentId) ?? []), card.task.id]);
  const found = new Set<string>(), pending = [id];
  while (pending.length) for (const child of byParent.get(pending.pop()!) ?? []) if (!found.has(child) && child !== id) { found.add(child); pending.push(child); }
  return found;
}

export function canParent(data: StrategyData, childId: string, parentId: string | null): boolean {
  return parentId === null || (parentId !== childId && data.cards.some(c => c.task.id === parentId) && !descendantIds(data, childId).has(parentId));
}

export function cardPath(data: StrategyData, id: string): string {
  const byId = new Map(data.cards.map(c => [c.task.id, c])), seen = new Set<string>(), parts: string[] = [];
  let current = byId.get(id);
  while (current && !seen.has(current.task.id)) { parts.unshift(current.task.title); seen.add(current.task.id); current = current.parentId ? byId.get(current.parentId) : undefined; }
  return parts.join(' › ');
}

export function updateStrategyCard(data: StrategyData, original: StrategyCard | null, task: Task, parentId: string | null, position: StrategyCard['position'], colorBranch = false): StrategyData {
  const current = data.cards.find(c => c.task.id === task.id);
  if (original && (!current || !sameTask(current.task, original.task) || current.parentId !== original.parentId)) throw new Error('Ta karta została zmieniona przez drugą osobę. Twoja treść pozostaje w formularzu. Skopiuj ją i otwórz aktualną kartę ponownie.');
  if (!original && current) throw new Error('Karta o tym identyfikatorze już istnieje.');
  if (!canParent(data, task.id, parentId)) throw new Error('Nie można podpiąć karty pod nią samą lub jej podkartę.');
  const card = { task, parentId, position: current?.position ?? position };
  let next: StrategyData = { version: 1, cards: current ? data.cards.map(c => c.task.id === task.id ? card : c) : [...data.cards, card] };
  if (colorBranch) {
    const descendants = descendantIds(next, task.id);
    next = { ...next, cards: next.cards.map(c => descendants.has(c.task.id) ? { ...c, task: { ...c.task, color: task.color, updatedAt: task.updatedAt } } : c) };
  }
  return parseStrategy(next);
}

export function reparentStrategyCard(data: StrategyData, id: string, parentId: string | null, expectedParent: string | null): StrategyData {
  const card = data.cards.find(c => c.task.id === id);
  if (!card || card.parentId !== expectedParent) throw new Error('Powiązanie tej karty zmieniło się. Wybierz ją ponownie.');
  if (!canParent(data, id, parentId)) throw new Error('Nie można utworzyć pętli pomiędzy kartami.');
  return { ...data, cards: data.cards.map(c => c.task.id === id ? { ...c, parentId } : c) };
}

export function moveStrategyCards(data: StrategyData, ids: string[], delta: StrategyCard['position']): StrategyData {
  if (ids.some(id => !data.cards.some(c => c.task.id === id))) throw new Error('Jedna z przesuwanych kart została usunięta.');
  const selected = new Set(ids);
  return parseStrategy({ ...data, cards: data.cards.map(c => selected.has(c.task.id) ? { ...c, position: { x: c.position.x + delta.x, y: c.position.y + delta.y } } : c) });
}

export function deleteStrategyCard(data: StrategyData, original: StrategyCard): StrategyData {
  const current = data.cards.find(c => c.task.id === original.task.id);
  if (!current || !sameTask(current.task, original.task) || current.parentId !== original.parentId) throw new Error('Karta zmieniła się podczas edycji. Otwórz ją ponownie przed usunięciem.');
  // Removing a card never removes its children or unrelated Kanban tasks.
  return { ...data, cards: data.cards.filter(c => c !== current).map(c => c.parentId === current.task.id ? { ...c, parentId: current.parentId } : c) };
}

export function layoutStrategy(data: StrategyData, columns = 3): StrategyData {
  const positions = new Map<string, StrategyCard['position']>();
  const roots = data.cards.filter(c => !c.parentId);
  let rowY = 30;
  for (let index = 0; index < roots.length; index += columns) {
    let x = 40, maxCount = 0;
    for (const root of roots.slice(index, index + columns)) {
      const stack = [{ card: root, depth: 0 }]; let count = 0, maxDepth = 0;
      while (stack.length) {
        const { card, depth } = stack.pop()!;
        positions.set(card.task.id, { x: x + depth * 36, y: rowY + count++ * 230 }); maxDepth = Math.max(maxDepth, depth);
        const children = data.cards.filter(c => c.parentId === card.task.id);
        for (const child of [...children].reverse()) stack.push({ card: child, depth: depth + 1 });
      }
      x += 320 + maxDepth * 36; maxCount = Math.max(maxCount, count);
    }
    rowY += maxCount * 230 + 55;
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
  const make = (id: string, parentId: string | null, title: string, description: string, color: string): StrategyCard => ({ parentId, position: { x: 0, y: 0 }, task: { id, title, description, status: 'discuss', priority: 'medium', dueDate: '', assigneeId: null, assigneeIds: [], tags: [], subtasks: [], statusComments: [], closingStatus: '', color, createdAt: stamp, updatedAt: stamp } });
  const cards = names.flatMap((name, i) => rows[i].map((text, j) => make(`strategy-${i}-${j}`, j ? `strategy-${i}-0` : null, j ? titles[j] : name, text, colors[j])));
  cards.push(make('strategy-light', 'strategy-0-2', 'Oświetlenie', 'Jakie sceny światła uproszczą codzienność?', '#d97706'), make('strategy-return', 'strategy-light', 'Scena „Powrót”', 'Przykład do omówienia: jedno naciśnięcie włącza wybrane światła i przywraca komfort w domu.', '#0d9488'));
  return layoutStrategy({ version: 1, cards });
}

export function strategyAssignees(card: StrategyCard, members: TeamMember[]): TeamMember[] {
  return taskAssigneeIds(card.task).flatMap(id => { const member = members.find(m => m.id === id); return member ? [member] : []; });
}
