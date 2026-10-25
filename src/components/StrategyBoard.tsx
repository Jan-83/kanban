import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Background, Controls, Handle, MiniMap, Position, ReactFlow, applyNodeChanges, type Connection, type Node, type NodeProps, type ReactFlowInstance } from '@xyflow/react';
import { Check, CheckSquare, ChevronDown, ChevronRight, Download, Grip, LoaderCircle, Maximize2, MessageSquare, Minimize2, Network, Plus, RefreshCw, Scan, Unplug, X } from 'lucide-react';
import type { BoardUser, Task, TeamMember } from '../types/kanban';
import type { StrategyCard, StrategyData, StrategyRepository } from '../types/strategy';
import { canParent, cardPath, deleteStrategyCard, descendantIds, layoutStrategy, moveStrategyCards, reparentStrategyCard, strategyAssignees, STRATEGY_STAGES, updateStrategyCard } from '../utils/strategy';
import { strategyRepository } from '../utils/strategyRepository';
import { TaskModal, type TaskDraft } from './TaskModal';
import { TaskImageGallery } from './TaskImageGallery';
import { PRIORITIES } from './TaskCard';
import { useStrategyBoard } from './useStrategyBoard';
import '@xyflow/react/dist/style.css';
import '../strategy.css';

type CardNode = Node<{
  card: StrategyCard; members: TeamMember[]; count: number; collapsed: boolean; busy: boolean;
  onEdit: () => void; onAdd: () => void; onFold: () => void;
}, 'strategy'>;

const StrategyNode = memo(function StrategyNode({ data, selected }: NodeProps<CardNode>) {
  const { card, count, collapsed, busy } = data, task = card.task;
  const assigned = strategyAssignees(card, data.members);
  return <article className={'strategy-card' + (selected ? ' selected' : '') + (!card.parentId ? ' root-card' : '')} style={{ '--strategy-color': task.color ?? '#64748b' } as CSSProperties} data-strategy-card={task.id}>
    <Handle type="target" position={Position.Left} aria-label={'Podepnij kartę ' + task.title} />
    <div className="strategy-card-bar"><span>{STRATEGY_STAGES.find(s => s.id === task.status)?.title}</span><button className="icon-button nodrag" onClick={data.onAdd} disabled={busy} aria-label={'Dodaj podkartę do ' + task.title}><Plus size={17} /></button><Grip size={15} className="strategy-grip" /></div>
    <button className="strategy-card-open nodrag" onClick={data.onEdit} disabled={busy} aria-label={'Edytuj kartę ' + task.title}><strong title={task.title}>{task.title}</strong><span>{task.description || 'Dodaj opis…'}</span></button>
    {!!task.images?.length && <div className="nodrag nopan strategy-card-images"><TaskImageGallery images={task.images} compact /></div>}
    <div className="strategy-card-tags">{task.priority !== 'medium' && <span className={'priority priority-' + task.priority}>{PRIORITIES[task.priority]}</span>}{task.tags.slice(0, 2).map(tag => <span key={tag} title={tag}>{tag}</span>)}</div>
    <div className="strategy-card-bottom">{count > 0 && <button className="strategy-fold nodrag" aria-expanded={!collapsed} onClick={data.onFold}>{collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}{count} podkart</button>}{task.subtasks.length > 0 && <span title="Wykonane kroki"><CheckSquare size={13} />{task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}</span>}{!!task.statusComments?.length && <span title="Komentarze o statusie"><MessageSquare size={13} />{task.statusComments.length}</span>}<span className="strategy-people">{assigned.map(person => <span className="strategy-person" key={person.id} title={person.name} style={{ backgroundColor: person.color }}>{person.name.split(' ').map(n => n[0]).slice(0, 2).join('')}</span>)}</span></div>
    <Handle type="source" position={Position.Bottom} aria-label={'Połącz z podkartą: ' + task.title} />
  </article>;
});
const nodeTypes = { strategy: StrategyNode };
interface Props { user: BoardUser; members: TeamMember[]; onAccessLost: () => void; repository?: StrategyRepository; onBusy?: (busy: boolean) => void; }
interface Editing { original: StrategyCard | null; id: string; position: StrategyCard['position']; }
interface Dragging { anchor: string; positions: Map<string, StrategyCard['position']>; }
const EMPTY: StrategyData = { version: 1, cards: [] };

export function StrategyBoard({ user, members, onAccessLost, repository = strategyRepository, onBusy }: Props) {
  const { snapshot, busy, error, setError, checkedAt, commit, refresh, hold } = useStrategyBoard(repository, onAccessLost);
  const data = snapshot?.data ?? EMPTY;
  const [flowNodes, setFlowNodes] = useState<CardNode[]>([]);
  const [instance, setInstance] = useState<ReactFlowInstance<CardNode> | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [moveBranch, setMoveBranch] = useState(true), [full, setFull] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [parentId, setParentId] = useState<string | null>(null), [colorBranch, setColorBranch] = useState(false);
  const [selected, setSelected] = useState<string | null>(null), [zoom, setZoom] = useState(85);
  const dragging = useRef<Dragging | null>(null), initializedView = useRef(false);
  const canvas = useRef<HTMLDivElement>(null);

  useEffect(() => { onBusy?.(busy || !!editing); }, [busy, editing, onBusy]);
  useEffect(() => { if (!full) return; const handle = (e: KeyboardEvent) => { if (e.key === 'Escape' && !editing) setFull(false); }; window.addEventListener('keydown', handle); return () => window.removeEventListener('keydown', handle); }, [full, editing]);
  const openEditor = (id?: string, parent: string | null = null) => {
    const original = id ? data.cards.find(c => c.task.id === id) : null;
    if (id && !original) return;
    const p = data.cards.find(c => c.task.id === parent);
    const view = canvas.current?.getBoundingClientRect();
    const position = original?.position ?? (p ? { x: p.position.x + 40, y: Math.max(p.position.y, ...data.cards.filter(c => c.parentId === parent).map(c => c.position.y)) + 230 } : instance && view ? instance.screenToFlowPosition({ x: view.x + view.width / 2 - 140, y: view.y + 90 }) : { x: 40, y: 30 });
    setEditing({ original: original ? structuredClone(original) : null, id: original?.task.id ?? crypto.randomUUID(), position });
    setParentId(original?.parentId ?? parent); setColorBranch(false); setError('');
  };
  const fold = (id: string) => setCollapsed(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const hidden = useMemo(() => { const ids = new Set<string>(); for (const id of collapsed) for (const child of descendantIds(data, id)) ids.add(child); return ids; }, [data, collapsed]);

  useEffect(() => {
    if (dragging.current) return;
    setFlowNodes(previous => data.cards.map(card => ({ id: card.task.id, type: 'strategy', position: card.position, hidden: hidden.has(card.task.id), selected: previous.some(n => n.id === card.task.id && n.selected), data: { card, members, count: descendantIds(data, card.task.id).size, collapsed: collapsed.has(card.task.id), busy, onEdit: () => openEditor(card.task.id), onAdd: () => openEditor(undefined, card.task.id), onFold: () => fold(card.task.id) } })));
  }, [data, members, hidden, collapsed, busy]);

  useEffect(() => {
    if (!instance || !flowNodes.length || initializedView.current) return;
    initializedView.current = true;
    let viewport = { x: 30, y: 25, zoom: .85 };
    try { const saved = JSON.parse(sessionStorage.getItem('kanban-strategy-viewport') ?? 'null'); if (saved && ['x', 'y', 'zoom'].every(k => Number.isFinite(saved[k])) && saved.zoom >= .1 && saved.zoom <= 2) viewport = saved; } catch {}
    void instance.setViewport(viewport); setZoom(Math.round(viewport.zoom * 100));
  }, [instance, flowNodes.length]);
  useEffect(() => {
    const element = canvas.current;
    if (!element || !instance) return;
    let width = element.clientWidth;
    const observer = new ResizeObserver(() => {
      const next = element.clientWidth;
      if (Math.abs(next - width) > 160) void instance.fitView({ padding: .12 });
      width = next;
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [instance]);
  const edges = useMemo(() => data.cards.filter(c => c.parentId && !hidden.has(c.task.id) && !hidden.has(c.parentId)).map(c => ({ id: c.parentId + '--' + c.task.id, source: c.parentId!, target: c.task.id, type: 'smoothstep', style: { stroke: c.task.color ?? '#64748b', strokeWidth: 2 }, deletable: false })), [data, hidden]);

  const startDrag = (card: CardNode, selectedNodes: CardNode[] = [card]) => {
    if (dragging.current || busy) return;
    const ids = new Set([card.id, ...selectedNodes.map(n => n.id)]);
    if (moveBranch) for (const id of [...ids]) for (const child of descendantIds(data, id)) ids.add(child);
    dragging.current = { anchor: card.id, positions: new Map(data.cards.filter(c => ids.has(c.task.id)).map(c => [c.task.id, { ...c.position }])) }; hold.current = true;
  };
  const drag = (card: CardNode) => {
    const state = dragging.current, origin = state?.positions.get(card.id);
    if (!state || !origin) return;
    const dx = card.position.x - origin.x, dy = card.position.y - origin.y;
    setFlowNodes(previous => previous.map(n => { const start = state.positions.get(n.id); return start ? { ...n, position: { x: start.x + dx, y: start.y + dy } } : n; }));
  };
  const stopDrag = (card: CardNode) => {
    const state = dragging.current, origin = state?.positions.get(card.id);
    dragging.current = null; hold.current = false;
    if (!state || !origin) return;
    const delta = { x: card.position.x - origin.x, y: card.position.y - origin.y };
    if (!delta.x && !delta.y) return;
    void commit(latest => moveStrategyCards(latest, [...state.positions.keys()], delta));
  };
  const connect = (connection: Connection) => {
    const child = data.cards.find(c => c.task.id === connection.target);
    if (!child || !connection.source) return;
    const parent = connection.source, childId = child.task.id, previous = child.parentId;
    void commit(latest => reparentStrategyCard(latest, childId, parent, previous));
  };
  const moveWithKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) || busy) return;
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, select, button, [contenteditable="true"]')) return;
    const id = target.closest<HTMLElement>('.react-flow__node')?.dataset.id;
    if (!id) return;
    event.preventDefault(); event.stopPropagation();
    const ids = new Set([id, ...flowNodes.filter(n => n.selected).map(n => n.id)]);
    if (moveBranch) for (const root of [...ids]) for (const child of descendantIds(data, root)) ids.add(child);
    const step = event.shiftKey ? 100 : 10;
    const delta = { x: event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0, y: event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0 };
    void commit(latest => moveStrategyCards(latest, [...ids], delta));
  };
  const save = async (draft: TaskDraft) => {
    if (!editing) return false;
    const { id: _id, newTaskId: _newId, ...fields } = draft;
    const now = new Date().toISOString();
    const task: Task = { ...fields, id: editing.id, createdAt: editing.original?.task.createdAt ?? now, updatedAt: now };
    const ok = await commit(latest => updateStrategyCard(latest, editing.original, task, parentId, editing.position, colorBranch));
    if (ok && parentId) setCollapsed(previous => { const next = new Set(previous); let p: string | null = parentId; while (p) { next.delete(p); p = data.cards.find(c => c.task.id === p)?.parentId ?? null; } return next; });
    return ok;
  };
  const exportBoard = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), revision: snapshot?.revision, ...data }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'tablica-strategiczna-' + new Date().toISOString().slice(0, 10) + '.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const selectedCard = data.cards.find(c => c.task.id === selected);
  const busyOrLoading = busy || !snapshot;
  return <section className={'strategy-board' + (full ? ' strategy-fullscreen' : '')} aria-label="Wspólna tablica strategiczna">
    <header className="strategy-heading"><div><p className="eyebrow">INTELISPACES / KIERUNKI ROZWOJU</p><h1>Pomysły, które łączą się w plan.</h1><p>Kliknij kartę, aby edytować. Przeciągnij kartę lub tło. Kółko myszy przybliża, Shift zaznacza grupę.</p></div><div className="strategy-sync" role="status">{busy ? <><LoaderCircle size={15} className="spin" />Zapisywanie…</> : snapshot ? <><Check size={15} />Zapisano wspólnie · wersja {snapshot.revision}</> : 'Wczytywanie…'}{checkedAt && <small>Sprawdzono {new Date(checkedAt).toLocaleTimeString('pl-PL')}</small>}</div></header>
    <div className="strategy-toolbar"><button className="button primary" onClick={() => openEditor()} disabled={busyOrLoading}><Plus size={16} />Nowa karta</button><button className="button" disabled={busyOrLoading} onClick={() => { if (confirm('Automatycznie ułożyć wszystkie gałęzie? Zmieni to ich zapisane pozycje dla obu osób.')) void commit(latest => layoutStrategy(latest)).then(ok => { if (ok) setTimeout(() => { void instance?.fitView({ padding: .12 }); }, 80); }); }}><Network size={16} />Ułóż gałęzie</button><button className="button" onClick={() => { void instance?.fitView({ padding: .12, duration: 250 }); }}><Scan size={16} />Cała tablica</button><button className="button" disabled={busyOrLoading || !selectedCard?.parentId} onClick={() => { if (selectedCard) void commit(latest => reparentStrategyCard(latest, selectedCard.task.id, null, selectedCard.parentId)); }}><Unplug size={15} />Odłącz kartę</button><button className="icon-button" onClick={() => { setError(''); void refresh(); }} disabled={busyOrLoading} aria-label="Odśwież strategię"><RefreshCw size={17} /></button><button className="icon-button" onClick={exportBoard} disabled={!snapshot || busy} aria-label="Pobierz kopię tablicy strategicznej"><Download size={17} /></button><button className="icon-button" onClick={() => setFull(!full)} aria-label={full ? 'Zamknij pełny ekran' : 'Pełny ekran tablicy'}>{full ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button><span className="strategy-zoom">{zoom}%</span></div>
    <div className="strategy-options"><label><input type="checkbox" checked={moveBranch} onChange={e => setMoveBranch(e.target.checked)} />Przesuwaj kartę razem z podkartami</label><span>Połącz dolny punkt karty z lewym punktem podkarty.</span></div>
    {error && <div className="notice error" role="alert"><span>{error}</span><button className="icon-button" aria-label="Zamknij komunikat strategii" onClick={() => setError('')}><X size={16} /></button></div>}
    <div className="strategy-canvas" ref={canvas} onKeyDownCapture={moveWithKeyboard}>
      {snapshot ? <ReactFlow<CardNode> nodes={flowNodes} edges={edges} nodeTypes={nodeTypes} onInit={setInstance} onNodesChange={changes => setFlowNodes(previous => applyNodeChanges(changes, previous))} onNodeDragStart={(_, n, group) => startDrag(n, group)} onNodeDrag={(_, n) => drag(n)} onNodeDragStop={(_, n) => stopDrag(n)} onSelectionDragStart={(_, group) => { if (group[0]) startDrag(group[0], group); }} onSelectionDrag={(_, group) => { if (group[0]) drag(group[0]); }} onSelectionDragStop={(_, group) => { if (group[0]) stopDrag(group[0]); }} onConnect={connect} isValidConnection={c => !!c.source && !!c.target && canParent(data, c.target, c.source)} onSelectionChange={({ nodes }) => setSelected(nodes[0]?.id ?? null)} onMoveEnd={(_, viewport) => { setZoom(Math.round(viewport.zoom * 100)); try { sessionStorage.setItem('kanban-strategy-viewport', JSON.stringify(viewport)); } catch {} }} nodesDraggable={!busy} nodesConnectable={!busy} deleteKeyCode={null} multiSelectionKeyCode={['Meta', 'Control']} selectionKeyCode="Shift" minZoom={.1} maxZoom={2} panOnDrag={[0, 1]} zoomOnScroll zoomOnPinch preventScrolling colorMode="system" ariaLabelConfig={{ 'controls.zoomIn.ariaLabel': 'Przybliż', 'controls.zoomOut.ariaLabel': 'Oddal', 'controls.fitView.ariaLabel': 'Pokaż całą tablicę', 'minimap.ariaLabel': 'Mapa tablicy strategicznej' }}>
        <Background gap={22} size={1} /><Controls showInteractive={false} /><MiniMap<CardNode> pannable zoomable nodeColor={n => n.data.card.task.color ?? '#64748b'} />
      </ReactFlow> : <div className="empty-state">{error ? 'Nie wczytano strategii. Użyj przycisku odświeżania.' : 'Wczytywanie wspólnej tablicy…'}</div>}
    </div>
    <footer className="strategy-footer"><span>{data.cards.filter(c => !c.parentId).length} głównych kart · {data.cards.length} kart łącznie</span><span>Zmiany treści i pozycji są wspólne. Powiększenie i zwinięte gałęzie są Twoim widokiem.</span></footer>
    {editing && <TaskModal isOpen onClose={() => setEditing(null)} onSave={save} onDelete={async () => !!editing.original && commit(latest => deleteStrategyCard(latest, editing.original!))} initialTask={editing.original?.task ?? null} defaultStatus="discuss" defaultNewTaskId={editing.id} teamMembers={members} stages={STRATEGY_STAGES} busy={busy} error={error} currentUser={user} strategyCard extraFields={<div className="strategy-editor-extra"><label>Karta nadrzędna<select aria-label="Karta nadrzędna" value={parentId ?? ''} onChange={e => setParentId(e.target.value || null)}><option value="">Brak — karta główna</option>{data.cards.filter(c => c.task.id !== editing.id && canParent(data, editing.id, c.task.id)).map(c => <option key={c.task.id} value={c.task.id}>{cardPath(data, c.task.id)}</option>)}</select></label><label className="strategy-checkbox"><input type="checkbox" checked={colorBranch} onChange={e => setColorBranch(e.target.checked)} />Zastosuj wybrany kolor również do wszystkich podkart</label></div>} />}
  </section>;
}
