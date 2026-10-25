import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Background, BaseEdge, Controls, Handle, MiniMap, Position, ReactFlow, applyNodeChanges, type Connection, type Edge, type EdgeProps, type Node, type NodeProps, type ReactFlowInstance } from '@xyflow/react';
import { Check, CheckSquare, ChevronDown, ChevronRight, CircleHelp, Copy, Download, Grip, LoaderCircle, Maximize2, MessageSquare, Minimize2, Network, Plus, RefreshCw, Scan, Unplug, Workflow, X } from 'lucide-react';
import type { BoardUser, Task, TeamMember } from '../types/kanban';
import type { StrategyCard, StrategyData, StrategyRepository } from '../types/strategy';
import { canParent, cardPath, deleteStrategyCard, descendantIds, hiddenStrategyIds, layoutStrategy, moveStrategyCards, setStrategyConnection, setStrategySubtaskCompleted, strategyAssignees, STRATEGY_STAGES, updateStrategyCard } from '../utils/strategy';
import { strategyRepository } from '../utils/strategyRepository';
import { TaskModal, type TaskDraft } from './TaskModal';
import { TaskImageGallery } from './TaskImageGallery';
import { PRIORITIES } from './TaskCard';
import { useStrategyBoard } from './useStrategyBoard';
import { StrategyCopyDialog } from './StrategyCopyDialog';
import { appendStrategyCopy, type StrategyCopyPlan } from '../utils/strategyCopy';
import { routeStrategy, type RouteNode } from '../utils/strategyRouting';
import '@xyflow/react/dist/style.css';
import '../strategy.css';

function StrategyHelp({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="task-dialog strategy-help-dialog" aria-labelledby="strategy-help-title" onCancel={onClose}>
    <div className="dialog-heading"><h2 id="strategy-help-title">Jak korzystać z tablicy</h2><button className="icon-button" onClick={onClose} aria-label="Zamknij pomoc"><X size={20} /></button></div>
    <ul>
      <li><strong>Edycja:</strong> kliknij tytuł karty. Ikona dwóch kartek kopiuje kartę lub całą gałąź.</li>
      <li><strong>Przesuwanie:</strong> przeciągnij górny pasek karty lub tło planszy. Shift + przeciągnięcie zaznacza grupę.</li>
      <li><strong>Z podkartami:</strong> zaznacz tę opcję, aby przesuwać kartę razem z całą jej gałęzią.</li>
      <li><strong>Łączenie:</strong> przeciągnij dolny punkt karty do lewego punktu innej. Jedna karta może mieć wielu rodziców. Aby odłączyć, zaznacz linię i wybierz „Usuń połączenie”.</li>
      <li><strong>Widok:</strong> kółko myszy przybliża, „Cała tablica” pokazuje wszystkie karty. Na wąskim ekranie przewiń pasek narzędzi w bok.</li>
    </ul>
    <p>Treść i pozycje zapisują się wspólnie. Powiększenie i zwinięte gałęzie są Twoim widokiem.</p>
    <div className="dialog-actions"><span className="spacer" /><button className="button primary" onClick={onClose}>Rozumiem</button></div>
  </dialog>;
}

type CardNode = Node<{
  card: StrategyCard; members: TeamMember[]; count: number; collapsed: boolean; busy: boolean;
  onEdit: () => void; onAdd: () => void; onCopy: () => void; onFold: () => void; onSubtaskChange: (id: string, completed: boolean) => void;
}, 'strategy'>;

const StrategyNode = memo(function StrategyNode({ data, selected }: NodeProps<CardNode>) {
  const { card, count, collapsed, busy } = data, task = card.task;
  const assigned = strategyAssignees(card, data.members);
  return <article className={'strategy-card' + (selected ? ' selected' : '') + (!card.parentIds.length ? ' root-card' : '')} style={{ '--strategy-color': task.color ?? '#64748b' } as CSSProperties} data-strategy-card={task.id}>
    <Handle type="target" position={Position.Left} aria-label={'Podepnij kartę ' + task.title} />
    <div className="strategy-card-bar"><span>{STRATEGY_STAGES.find(s => s.id === task.status)?.title}</span><button className="icon-button nodrag nopan" onClick={data.onCopy} disabled={busy} aria-label={'Kopiuj kartę ' + task.title} title="Kopiuj kartę lub gałąź"><Copy size={15} /></button><button className="icon-button nodrag" onClick={data.onAdd} disabled={busy} aria-label={'Dodaj podkartę do ' + task.title}><Plus size={17} /></button><Grip size={15} className="strategy-grip" /></div>
    <button className="strategy-card-open nodrag" onClick={data.onEdit} disabled={busy} aria-label={'Edytuj kartę ' + task.title}><strong title={task.title}>{task.title}</strong><span>{task.description || 'Dodaj opis…'}</span></button>
    {!!task.images?.length && <div className="nodrag nopan strategy-card-images"><TaskImageGallery images={task.images} compact /></div>}
    <div className="strategy-card-tags">{task.priority !== 'medium' && <span className={'priority priority-' + task.priority}>{PRIORITIES[task.priority]}</span>}{task.tags.slice(0, 2).map(tag => <span key={tag} title={tag}>{tag}</span>)}</div>
    {card.parentIds.length > 1 && <button className="strategy-shared nodrag nopan" onClick={data.onEdit} disabled={busy} aria-label={'Połączenia karty ' + task.title}><Network size={13} />Wspólna dla {card.parentIds.length} kart</button>}
    {task.subtasks.length > 0 && <div className="card-subtasks-preview strategy-card-checklist nodrag nopan nowheel" aria-label={'Lista kroków: ' + task.title} onClick={event => event.stopPropagation()}>
      {task.subtasks.map(step => <label key={step.id} className={'card-subtask-item' + (step.completed ? ' is-completed' : '')}>
        <input type="checkbox" checked={step.completed} disabled={busy} aria-label={step.title} onChange={event => data.onSubtaskChange(step.id, event.target.checked)} />
        <span className="card-subtask-text" title={step.title}>{step.title}</span>
      </label>)}
    </div>}
    <div className="strategy-card-bottom">{count > 0 && <button className="strategy-fold nodrag" aria-expanded={!collapsed} onClick={data.onFold}>{collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}{count} podkart</button>}{task.subtasks.length > 0 && <span title="Wykonane kroki"><CheckSquare size={13} />{task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}</span>}{!!task.statusComments?.length && <span title="Komentarze o statusie"><MessageSquare size={13} />{task.statusComments.length}</span>}<span className="strategy-people">{assigned.map(person => <span className="strategy-person" key={person.id} title={person.name} style={{ backgroundColor: person.color }}>{person.name.split(' ').map(n => n[0]).slice(0, 2).join('')}</span>)}</span></div>
    <Handle type="source" position={Position.Bottom} aria-label={'Połącz z podkartą: ' + task.title} />
  </article>;
});
const nodeTypes = { strategy: StrategyNode };
type StrategyConnection = Edge<{ path: string }, 'strategyRoute'>;
const StrategyEdge = memo(function StrategyEdge({ id, data, style }: EdgeProps<StrategyConnection>) {
  if (!data?.path) return null;
  return <>
    <path d={data.path} className="strategy-edge-casing" fill="none" stroke="var(--column)" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
    <BaseEdge id={id} path={data.path} style={{ ...style, strokeLinecap: 'round', strokeLinejoin: 'round' }} interactionWidth={10} />
  </>;
});
const edgeTypes = { strategyRoute: StrategyEdge };
interface Props { user: BoardUser; members: TeamMember[]; onAccessLost: () => void; repository?: StrategyRepository; onBusy?: (busy: boolean) => void; }
interface Editing { original: StrategyCard | null; id: string; position: StrategyCard['position']; }
interface Dragging { anchor: string; positions: Map<string, StrategyCard['position']>; }
const EMPTY: StrategyData = { version: 2, cards: [] };

export function StrategyBoard({ user, members, onAccessLost, repository = strategyRepository, onBusy }: Props) {
  const { snapshot, busy, error, setError, checkedAt, commit, refresh, hold } = useStrategyBoard(repository, onAccessLost);
  const data = snapshot?.data ?? EMPTY;
  const [flowNodes, setFlowNodes] = useState<CardNode[]>([]);
  const [instance, setInstance] = useState<ReactFlowInstance<CardNode> | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [moveBranch, setMoveBranch] = useState(true), [full, setFull] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [copying, setCopying] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [parentIds, setParentIds] = useState<string[]>([]), [parentSearch, setParentSearch] = useState(''), [colorBranch, setColorBranch] = useState(false);
  const [selected, setSelected] = useState<string | null>(null), [zoom, setZoom] = useState(85);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const dragging = useRef<Dragging | null>(null), initializedView = useRef(false);
  const canvas = useRef<HTMLDivElement>(null);

  useEffect(() => { onBusy?.(busy || !!editing || !!copying); }, [busy, editing, copying, onBusy]);
  useEffect(() => { if (!full) return; const handle = (e: KeyboardEvent) => { if (e.key === 'Escape' && !editing && !copying && !help) setFull(false); }; window.addEventListener('keydown', handle); return () => window.removeEventListener('keydown', handle); }, [full, editing, copying, help]);
  const openCopy = (id: string) => { setError(''); setCopying(id); };
  const copyCards = async (plan: StrategyCopyPlan) => {
    const ok = await commit(latest => appendStrategyCopy(latest, plan));
    if (ok) {
      setCollapsed(previous => {
        const next = new Set(previous), pending = [...plan.cards.find(c => c.task.id === plan.rootId)!.parentIds], seen = new Set<string>();
        while (pending.length) { const id = pending.pop()!; if (seen.has(id)) continue; seen.add(id); next.delete(id); pending.push(...data.cards.find(c => c.task.id === id)?.parentIds ?? []); }
        return next;
      });
      setSelected(plan.rootId); setSelectedEdge(null);
      setTimeout(() => {
        setFlowNodes(previous => previous.map(n => ({ ...n, selected: n.id === plan.rootId })));
        void instance?.fitView({ nodes: [{ id: plan.rootId }], padding: .5, maxZoom: .9, duration: 250 });
      }, 100);
    }
    return ok;
  };
  const openEditor = (id?: string, parent: string | null = null) => {
    const original = id ? data.cards.find(c => c.task.id === id) : null;
    if (id && !original) return;
    const p = data.cards.find(c => c.task.id === parent);
    const view = canvas.current?.getBoundingClientRect();
    const position = original?.position ?? (p ? { x: p.position.x + 40, y: Math.max(p.position.y, ...data.cards.filter(c => parent && c.parentIds.includes(parent)).map(c => c.position.y)) + 230 } : instance && view ? instance.screenToFlowPosition({ x: view.x + view.width / 2 - 140, y: view.y + 90 }) : { x: 40, y: 30 });
    setEditing({ original: original ? structuredClone(original) : null, id: original?.task.id ?? crypto.randomUUID(), position });
    setParentIds([...(original?.parentIds ?? (parent ? [parent] : []))]); setParentSearch(''); setColorBranch(false); setError('');
  };
  const fold = (id: string) => setCollapsed(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const setSubtask = (cardId: string, subtaskId: string, completed: boolean) => {
    void commit(latest => setStrategySubtaskCompleted(latest, cardId, subtaskId, completed));
  };
  const hidden = useMemo(() => hiddenStrategyIds(data, collapsed), [data, collapsed]);
  const links = useMemo(() => data.cards.flatMap(c => c.parentIds.filter(parent => !hidden.has(c.task.id) && !hidden.has(parent) && !collapsed.has(parent)).map(parent => ({ id: parent + '->' + c.task.id, source: parent, target: c.task.id }))), [data, hidden, collapsed]);

  useEffect(() => {
    if (dragging.current) return;
    setFlowNodes(previous => data.cards.map(card => ({ id: card.task.id, type: 'strategy', position: card.position, hidden: hidden.has(card.task.id), measured: previous.find(n => n.id === card.task.id)?.measured, selected: previous.some(n => n.id === card.task.id && n.selected), data: { card, members, count: descendantIds(data, card.task.id).size, collapsed: collapsed.has(card.task.id), busy, onEdit: () => openEditor(card.task.id), onAdd: () => openEditor(undefined, card.task.id), onCopy: () => openCopy(card.task.id), onFold: () => fold(card.task.id), onSubtaskChange: (id, completed) => setSubtask(card.task.id, id, completed) } })));
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
  // Geometry is separate from selection/zoom/save status, so those do not reroute.
  const geometryKey = JSON.stringify(flowNodes.filter(n => !n.hidden).map(n => ({ id: n.id, x: n.position.x, y: n.position.y, width: n.measured?.width ?? 280, height: n.measured?.height ?? 147 })));
  const linksKey = JSON.stringify(links);
  const routes = useMemo(() => routeStrategy(JSON.parse(geometryKey) as RouteNode[], JSON.parse(linksKey)), [geometryKey, linksKey]);
  // Stable interactive handles create links; the router spreads their visual endpoints.
  const edges = useMemo(() => links.map(link => ({ ...link, type: 'strategyRoute', data: { path: routes.get(link.id)?.path ?? '' }, selected: selectedEdge === link.id, style: { stroke: data.cards.find(c => c.task.id === link.target)?.task.color ?? '#64748b', strokeWidth: selectedEdge === link.id ? 4 : 2 }, ariaLabel: 'Połączenie: ' + data.cards.find(c => c.task.id === link.source)?.task.title + ' → ' + data.cards.find(c => c.task.id === link.target)?.task.title, deletable: false })), [links, routes, selectedEdge, data]);
  const blockedRoutes = [...routes.values()].filter(route => route.blocked).length;

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
    const parent = connection.source, childId = child.task.id;
    void commit(latest => setStrategyConnection(latest, childId, parent, true));
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
    const ok = await commit(latest => updateStrategyCard(latest, editing.original, task, parentIds, editing.position, colorBranch));
    if (ok) setCollapsed(previous => {
      const next = new Set(previous), seen = new Set<string>(), pending = [...parentIds];
      while (pending.length) { const id = pending.pop()!; if (seen.has(id)) continue; seen.add(id); next.delete(id); pending.push(...data.cards.find(c => c.task.id === id)?.parentIds ?? []); }
      return next;
    });
    return ok;
  };
  const exportBoard = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), revision: snapshot?.revision, ...data }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'tablica-strategiczna-' + new Date().toISOString().slice(0, 10) + '.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const selectedCard = data.cards.find(c => c.task.id === selected);
  const connectionToRemove = edges.find(edge => edge.id === selectedEdge);
  const parentOptions = editing ? data.cards.filter(c => c.task.id !== editing.id && canParent(data, editing.id, c.task.id)).map(c => ({ id: c.task.id, title: c.task.title, path: cardPath(data, c.task.id) })).filter(c => c.path.toLocaleLowerCase('pl').includes(parentSearch.toLocaleLowerCase('pl'))) : [];
  const busyOrLoading = busy || !snapshot;
  return <section className={'strategy-board' + (full ? ' strategy-fullscreen' : '')} aria-label="Wspólna tablica strategiczna">
    <header className="strategy-topbar">
      <h1 className="strategy-title" title="Tablica strategiczna"><Workflow size={18} /><span>Tablica strategiczna</span></h1>
      <div className="strategy-toolbar" role="group" aria-label="Narzędzia tablicy strategicznej" tabIndex={0}>
        <button className="button primary" onClick={() => openEditor()} disabled={busyOrLoading}><Plus size={16} />Nowa karta</button>
        <button className="button" disabled={busyOrLoading || !selectedCard} onClick={() => { if (selectedCard) openCopy(selectedCard.task.id); }}><Copy size={15} />Kopiuj kartę</button>
        <button className="icon-button" title="Ułóż gałęzie" aria-label="Ułóż gałęzie" disabled={busyOrLoading} onClick={() => { if (confirm('Automatycznie ułożyć wszystkie gałęzie? Zmieni to ich zapisane pozycje dla obu osób.')) void commit(latest => layoutStrategy(latest)).then(ok => { if (ok) setTimeout(() => { void instance?.fitView({ padding: .12 }); }, 80); }); }}><Network size={16} /></button>
        <button className="button" onClick={() => { void instance?.fitView({ padding: .12, duration: 250 }); }}><Scan size={16} />Cała tablica</button>
        <button className="icon-button" title="Połączenia karty" aria-label="Połączenia karty" disabled={busyOrLoading || !selectedCard} onClick={() => { if (selectedCard) openEditor(selectedCard.task.id); }}><Workflow size={16} /></button>
        <button className="icon-button" title="Usuń połączenie" aria-label="Usuń połączenie" disabled={busyOrLoading || !connectionToRemove} onClick={() => { if (connectionToRemove) void commit(latest => setStrategyConnection(latest, connectionToRemove.target, connectionToRemove.source, false)).then(ok => { if (ok) setSelectedEdge(null); }); }}><Unplug size={16} /></button>
        <span className="strategy-tool-divider" aria-hidden="true" />
        <label className="strategy-move-option" title="Przesuwaj kartę razem z podkartami"><input type="checkbox" aria-label="Przesuwaj kartę razem z podkartami" checked={moveBranch} onChange={e => setMoveBranch(e.target.checked)} />Z podkartami</label>
        <span className="strategy-tool-divider" aria-hidden="true" />
        <button className="icon-button" onClick={() => { setError(''); void refresh(); }} disabled={busyOrLoading} title="Odśwież strategię" aria-label="Odśwież strategię"><RefreshCw size={16} /></button>
        <button className="icon-button" onClick={exportBoard} disabled={!snapshot || busy} title="Pobierz kopię tablicy strategicznej" aria-label="Pobierz kopię tablicy strategicznej"><Download size={16} /></button>
        <button className="icon-button" onClick={() => setFull(!full)} title={full ? 'Zamknij pełny ekran' : 'Pełny ekran tablicy'} aria-label={full ? 'Zamknij pełny ekran' : 'Pełny ekran tablicy'}>{full ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
        <button className="icon-button" title="Jak korzystać z tablicy" aria-label="Jak korzystać z tablicy" onClick={() => setHelp(true)}><CircleHelp size={17} /></button>
        <span className="strategy-zoom" aria-label={'Powiększenie ' + zoom + '%'}>{zoom}%</span>
      </div>
      <div className="strategy-sync" role="status" aria-label={busy ? 'Zapisywanie…' : snapshot ? 'Zapisano wspólnie · wersja ' + snapshot.revision : 'Wczytywanie…'} title={(snapshot ? 'Wersja ' + snapshot.revision + '. ' : '') + (checkedAt ? 'Sprawdzono ' + new Date(checkedAt).toLocaleTimeString('pl-PL') : 'Trwa wczytywanie')}>
        {busy || !snapshot ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />}<span className="strategy-sync-text">{busy ? 'Zapisywanie…' : snapshot ? 'Zapisano · v.' + snapshot.revision : 'Wczytywanie…'}</span>
      </div>
    </header>
    {error && <div className="notice error" role="alert"><span>{error}</span><button className="icon-button" aria-label="Zamknij komunikat strategii" onClick={() => setError('')}><X size={16} /></button></div>}
    <div className="strategy-canvas" ref={canvas} onKeyDownCapture={moveWithKeyboard}>
      {snapshot ? <ReactFlow<CardNode> nodes={flowNodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onInit={setInstance} onNodesChange={changes => setFlowNodes(previous => applyNodeChanges(changes, previous))} onNodeDragStart={(_, n, group) => startDrag(n, group)} onNodeDrag={(_, n) => drag(n)} onNodeDragStop={(_, n) => stopDrag(n)} onSelectionDragStart={(_, group) => { if (group[0]) startDrag(group[0], group); }} onSelectionDrag={(_, group) => { if (group[0]) drag(group[0]); }} onSelectionDragStop={(_, group) => { if (group[0]) stopDrag(group[0]); }} onConnect={connect} onEdgeClick={(_, edge) => setSelectedEdge(edge.id)} onNodeClick={() => setSelectedEdge(null)} onPaneClick={() => setSelectedEdge(null)} isValidConnection={c => !!c.source && !!c.target && canParent(data, c.target, c.source) && !data.cards.find(card => card.task.id === c.target)?.parentIds.includes(c.source)} onSelectionChange={({ nodes }) => setSelected(nodes[0]?.id ?? null)} onMoveEnd={(_, viewport) => { setZoom(Math.round(viewport.zoom * 100)); try { sessionStorage.setItem('kanban-strategy-viewport', JSON.stringify(viewport)); } catch {} }} nodesDraggable={!busy} nodesConnectable={!busy} deleteKeyCode={null} multiSelectionKeyCode={['Meta', 'Control']} selectionKeyCode="Shift" minZoom={.1} maxZoom={2} panOnDrag={[0, 1]} zoomOnScroll zoomOnPinch preventScrolling colorMode="system" ariaLabelConfig={{ 'controls.zoomIn.ariaLabel': 'Przybliż', 'controls.zoomOut.ariaLabel': 'Oddal', 'controls.fitView.ariaLabel': 'Pokaż całą tablicę', 'minimap.ariaLabel': 'Mapa tablicy strategicznej' }}>
        <Background gap={22} size={1} /><Controls showInteractive={false} /><MiniMap<CardNode> pannable zoomable nodeColor={n => n.data.card.task.color ?? '#64748b'} />
      </ReactFlow> : <div className="empty-state">{error ? 'Nie wczytano strategii. Użyj przycisku odświeżania.' : 'Wczytywanie wspólnej tablicy…'}</div>}
    </div>
    <footer className="strategy-footer"><span>{data.cards.filter(c => !c.parentIds.length).length} głównych kart · {data.cards.length} kart łącznie{blockedRoutes > 0 && <strong className="strategy-route-warning" title="Połączenia są zachowane. Rozsuń nachodzące na siebie karty, aby odsłonić ich punkty połączeń."> · Rozsuń kafelki: {blockedRoutes} połączeń bez wolnego przejścia</strong>}</span><span>Zmiany treści i pozycji są wspólne. Powiększenie i zwinięte gałęzie są Twoim widokiem.</span></footer>
    {help && <StrategyHelp onClose={() => setHelp(false)} />}
    {copying && <StrategyCopyDialog data={data} sourceId={copying} error={error} onCopy={copyCards} onClose={() => setCopying(null)} />}
    {editing && <TaskModal isOpen onClose={() => setEditing(null)} onSave={save} onDelete={async () => !!editing.original && commit(latest => deleteStrategyCard(latest, editing.original!))} initialTask={editing.original?.task ?? null} defaultStatus="discuss" defaultNewTaskId={editing.id} teamMembers={members} stages={STRATEGY_STAGES} busy={busy} error={error} currentUser={user} strategyCard extraFields={<div className="strategy-editor-extra">
      <fieldset className="strategy-parent-picker" disabled={busy}>
        <legend>Podepnij pod karty · {parentIds.length}</legend>
        <p>Zaznacz jedną lub kilka kart. Każda będzie prowadzić do tej samej treści i listy kroków.</p>
        <div className="strategy-parent-chips">{parentIds.map(id => <button type="button" key={id} className="strategy-parent-chip" onClick={() => setParentIds(previous => previous.filter(p => p !== id))} aria-label={'Odłącz od: ' + (data.cards.find(c => c.task.id === id)?.task.title ?? id)}>{data.cards.find(c => c.task.id === id)?.task.title ?? 'Usunięta karta'}<X size={13} /></button>)}{!parentIds.length && <span>Brak połączeń nadrzędnych — karta główna.</span>}</div>
        <input type="search" aria-label="Szukaj kart do podpięcia" placeholder="Szukaj kart…" value={parentSearch} onChange={e => setParentSearch(e.target.value)} />
        <div className="strategy-parent-list">{parentOptions.map(option => <label key={option.id} className="strategy-parent-option"><input type="checkbox" checked={parentIds.includes(option.id)} aria-label={'Podepnij pod: ' + option.title} onChange={e => setParentIds(previous => e.target.checked ? [...previous, option.id] : previous.filter(id => id !== option.id))} /><span><strong>{option.title}</strong><small>{option.path}</small></span></label>)}{!parentOptions.length && <p>Brak pasujących kart.</p>}</div>
      </fieldset>
      <label className="strategy-checkbox"><input type="checkbox" checked={colorBranch} onChange={e => setColorBranch(e.target.checked)} />Zastosuj wybrany kolor również do wszystkich podkart, w tym współdzielonych</label>
    </div>} />}
  </section>;
}
