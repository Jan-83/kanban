// Presentation only: routes are derived from the currently measured cards, never saved.
export interface RoutePoint { x: number; y: number; }
export interface RouteNode extends RoutePoint { id: string; width: number; height: number; }
export interface RouteLink { id: string; source: string; target: string; }
export interface CardPorts { sources: string[]; targets: string[]; }
export interface CardRoute { points: RoutePoint[]; path: string; blocked: boolean; }
interface Rect { left: number; right: number; top: number; bottom: number; }
interface Segment { a: RoutePoint; b: RoutePoint; }
const EPS = .01, LANE = 12;
export const portFraction = (index: number, count: number) => .16 + .68 * (index + 1) / (count + 1);
export const sourcePort = (target: string) => 'to:' + target;
export const targetPort = (source: string) => 'from:' + source;

export function strategyPorts(links: RouteLink[]): Map<string, CardPorts> {
  const ports = new Map<string, CardPorts>();
  const get = (id: string) => { if (!ports.has(id)) ports.set(id, { sources: [], targets: [] }); return ports.get(id)!; };
  for (const link of links) { get(link.source).sources.push(link.target); get(link.target).targets.push(link.source); }
  for (const port of ports.values()) { port.sources.sort(); port.targets.sort(); }
  return ports;
}
const rect = (n: RouteNode, gap = 0): Rect => ({ left: n.x - gap, right: n.x + n.width + gap, top: n.y - gap, bottom: n.y + n.height + gap });
const horizontal = (s: Segment) => Math.abs(s.a.y - s.b.y) < EPS;
const distance = (a: RoutePoint, b: RoutePoint) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const segments = (points: RoutePoint[]): Segment[] => points.slice(1).map((b, i) => ({ a: points[i], b }));
const overlaps = (a: number, b: number, c: number, d: number) => Math.min(Math.max(a, b), Math.max(c, d)) - Math.max(Math.min(a, b), Math.min(c, d));
const inside = (p: RoutePoint, r: Rect) => p.x > r.left + EPS && p.x < r.right - EPS && p.y > r.top + EPS && p.y < r.bottom - EPS;

function hits(s: Segment, r: Rect) {
  return horizontal(s)
    ? s.a.y > r.top + EPS && s.a.y < r.bottom - EPS && overlaps(s.a.x, s.b.x, r.left, r.right) > EPS
    : s.a.x > r.left + EPS && s.a.x < r.right - EPS && overlaps(s.a.y, s.b.y, r.top, r.bottom) > EPS;
}
function crossing(a: Segment, b: Segment): RoutePoint | null {
  if (horizontal(a) === horizontal(b)) return null;
  const h = horizontal(a) ? a : b, v = horizontal(a) ? b : a;
  const p = { x: v.a.x, y: h.a.y };
  return p.x > Math.min(h.a.x, h.b.x) + EPS && p.x < Math.max(h.a.x, h.b.x) - EPS && p.y > Math.min(v.a.y, v.b.y) + EPS && p.y < Math.max(v.a.y, v.b.y) - EPS ? p : null;
}
function segmentCost(s: Segment, obstacles: Rect[], used: Segment[]) {
  if (obstacles.some(r => hits(s, r))) return Infinity;
  let cost = distance(s.a, s.b);
  for (const other of used) {
    if (horizontal(s) === horizontal(other)) {
      const h = horizontal(s), gap = Math.abs(h ? s.a.y - other.a.y : s.a.x - other.a.x);
      if (gap >= LANE) continue;
      const overlap = h ? overlaps(s.a.x, s.b.x, other.a.x, other.b.x) : overlaps(s.a.y, s.b.y, other.a.y, other.b.y);
      if (overlap <= EPS) continue;
      // Never share a stretch of line. Nearby parallel lanes are discouraged too.
      if (gap < .5) return Infinity;
      cost += overlap * (LANE - gap) * .4;
    } else if (crossing(s, other)) cost += 36;
  }
  return cost;
}
function simplify(points: RoutePoint[]): RoutePoint[] {
  const result: RoutePoint[] = [];
  for (const p of points) {
    if (result.length && distance(result[result.length - 1], p) < EPS) continue;
    while (result.length >= 2) {
      const a = result[result.length - 2], b = result[result.length - 1];
      if ((Math.abs(a.x - b.x) < EPS && Math.abs(b.x - p.x) < EPS) || (Math.abs(a.y - b.y) < EPS && Math.abs(b.y - p.y) < EPS)) result.pop(); else break;
    }
    result.push(p);
  }
  return result;
}

class Heap {
  values: { state: number; cost: number; score: number }[] = [];
  push(entry: { state: number; cost: number; score: number }) {
    const a = this.values; let i = a.length; a.push(entry);
    while (i) { const parent = (i - 1) >> 1; if (a[parent].score <= entry.score) break; a[i] = a[parent]; i = parent; } a[i] = entry;
  }
  pop() {
    const a = this.values, first = a[0], last = a.pop()!;
    if (a.length) { let i = 0; while (i * 2 + 1 < a.length) { let j = i * 2 + 1; if (j + 1 < a.length && a[j + 1].score < a[j].score) j++; if (a[j].score >= last.score) break; a[i] = a[j]; i = j; } a[i] = last; }
    return first;
  }
}

function search(start: RoutePoint, end: RoutePoint, obstacles: Rect[], used: Segment[], bounds: Rect): RoutePoint[] | null {
  const local = obstacles.filter(r => r.left <= bounds.right && r.right >= bounds.left && r.top <= bounds.bottom && r.bottom >= bounds.top);
  if (local.some(r => inside(start, r) || inside(end, r))) return null;
  const xs = new Set([start.x, end.x, bounds.left, bounds.right]), ys = new Set([start.y, end.y, bounds.top, bounds.bottom]);
  for (const r of local) { xs.add(r.left); xs.add(r.right); xs.add(r.left - LANE); xs.add(r.right + LANE); ys.add(r.top); ys.add(r.bottom); ys.add(r.top - LANE); ys.add(r.bottom + LANE); }
  for (const s of used) {
    if (horizontal(s)) { ys.add(s.a.y - LANE); ys.add(s.a.y + LANE); }
    else { xs.add(s.a.x - LANE); xs.add(s.a.x + LANE); }
  }
  const xx = [...xs].filter(x => x >= bounds.left && x <= bounds.right).sort((a, b) => a - b);
  const yy = [...ys].filter(y => y >= bounds.top && y <= bounds.bottom).sort((a, b) => a - b);
  // Most connections need only a dogleg. Avoid a graph search while dragging these.
  let best: RoutePoint[] | null = null, bestCost = Infinity;
  const consider = (candidate: RoutePoint[]) => {
    const points = simplify(candidate);
    let cost = Math.max(0, points.length - 2) * 24;
    for (const s of segments(points)) { cost += segmentCost(s, local, used); if (cost >= bestCost) return; }
    if (cost < bestCost) { best = points; bestCost = cost; }
  };
  for (const x of xx) consider([start, { x, y: start.y }, { x, y: end.y }, end]);
  for (const y of yy) consider([start, { x: start.x, y }, { x: end.x, y }, end]);
  if (best) return best;
  // Compressed visibility grid; two states per vertex retain incoming direction.
  const width = xx.length, size = width * yy.length;
  if (size > 60000) return null;
  const index = (p: RoutePoint) => yy.indexOf(p.y) * width + xx.indexOf(p.x);
  const point = (i: number) => ({ x: xx[i % width], y: yy[Math.floor(i / width)] });
  const begin = index(start), finish = index(end), costs = new Float64Array(size * 2).fill(Infinity), parents = new Int32Array(size * 2).fill(-1), heap = new Heap();
  for (let direction = 0; direction < 2; direction++) { costs[begin * 2 + direction] = 0; heap.push({ state: begin * 2 + direction, cost: 0, score: distance(start, end) }); }
  const cache = new Map<string, number>();
  let visited = 0;
  while (heap.values.length && visited++ < 60000) {
    const current = heap.pop(), id = current.state >> 1;
    if (current.cost !== costs[current.state]) continue;
    if (id === finish) {
      const points: RoutePoint[] = []; let state = current.state;
      while (state !== -1) { points.push(point(state >> 1)); state = parents[state]; }
      return simplify(points.reverse());
    }
    const x = id % width, y = Math.floor(id / width), a = point(id);
    for (const [next, direction] of [[x > 0 ? id - 1 : -1, 0], [x + 1 < width ? id + 1 : -1, 0], [y > 0 ? id - width : -1, 1], [y + 1 < yy.length ? id + width : -1, 1]]) {
      if (next < 0) continue;
      const b = point(next), key = Math.min(id, next) + ':' + Math.max(id, next);
      let travel = cache.get(key);
      if (travel === undefined) { travel = segmentCost({ a, b }, local, used); cache.set(key, travel); }
      const cost = current.cost + travel + (direction === (current.state & 1) ? 0 : 24), state = next * 2 + direction;
      if (cost < costs[state]) { costs[state] = cost; parents[state] = current.state; heap.push({ state, cost, score: cost + distance(b, end) }); }
    }
  }
  return null;
}

const toward = (from: RoutePoint, to: RoutePoint, amount: number): RoutePoint => {
  const length = distance(from, to); return length ? { x: from.x + (to.x - from.x) * amount / length, y: from.y + (to.y - from.y) * amount / length } : from;
};
const xy = (p: RoutePoint) => `${+p.x.toFixed(2)},${+p.y.toFixed(2)}`;
function drawPath(points: RoutePoint[], used: Segment[], gap: number) {
  if (!points.length) return '';
  const radius = Math.min(6, gap / 2), jump = Math.min(4, gap / 2);
  let path = 'M' + xy(points[0]), from = points[0];
  for (let i = 1; i < points.length; i++) {
    const corner = points[i], next = points[i + 1];
    const r = next ? Math.min(radius, distance(points[i - 1], corner) / 2, distance(corner, next) / 2) : 0;
    const end = toward(corner, from, r), s = { a: from, b: end };
    // A small bridge distinguishes a crossing from a junction between cards.
    const crossings = jump >= 3 ? used.map(other => crossing(s, other)).filter((p): p is RoutePoint => !!p && distance(from, p) > jump * 2 && distance(end, p) > jump * 2).sort((a, b) => distance(from, a) - distance(from, b)) : [];
    let last: RoutePoint | null = null;
    for (const p of crossings) {
      if (last && distance(last, p) < jump * 3) continue;
      const before = toward(p, from, jump), after = toward(p, end, jump);
      const control = horizontal(s) ? { x: p.x, y: p.y - jump * 2 } : { x: p.x + jump * 2, y: p.y };
      path += ' L' + xy(before) + ' Q' + xy(control) + ' ' + xy(after); last = p;
    }
    path += ' L' + xy(end);
    if (next && r) { from = toward(corner, next, r); path += ' Q' + xy(corner) + ' ' + xy(from); } else from = corner;
  }
  return path;
}

export function routeStrategy(nodes: RouteNode[], links: RouteLink[]): Map<string, CardRoute> {
  const result = new Map<string, CardRoute>(), byId = new Map(nodes.map(n => [n.id, n])), ports = strategyPorts(links), used: Segment[] = [];
  const global = { left: Math.min(...nodes.map(n => n.x)) - 100, right: Math.max(...nodes.map(n => n.x + n.width)) + 100, top: Math.min(...nodes.map(n => n.y)) - 100, bottom: Math.max(...nodes.map(n => n.y + n.height)) + 100 };
  for (const link of [...links].sort((a, b) => a.id.localeCompare(b.id))) {
    const source = byId.get(link.source), target = byId.get(link.target);
    let points: RoutePoint[] | null = null, clearance = 0;
    if (source && target && source.id !== target.id) {
      const out = ports.get(source.id)!.sources, incoming = ports.get(target.id)!.targets;
      const start = { x: source.x + source.width * portFraction(out.indexOf(target.id), out.length), y: source.y + source.height };
      const end = { x: target.x, y: target.y + target.height * portFraction(incoming.indexOf(source.id), incoming.length) };
      for (const gap of [16, 8, 2, 0]) {
        const a = { x: start.x, y: start.y + gap }, b = { x: end.x - gap, y: end.y };
        const stubs = [{ a: start, b: a }, { a: b, b: end }];
        if (stubs.some((s, i) => !Number.isFinite(segmentCost(s, nodes.filter(n => n.id !== (i === 0 ? source.id : target.id)).map(n => rect(n, 1)), used)))) continue;
        const obstacles = nodes.map(n => rect(n, gap));
        for (const margin of [80, 320, Infinity]) {
          const bounds = Number.isFinite(margin) ? { left: Math.min(a.x, b.x) - margin, right: Math.max(a.x, b.x) + margin, top: Math.min(a.y, b.y) - margin, bottom: Math.max(a.y, b.y) + margin } : global;
          const middle = search(a, b, obstacles, used, bounds);
          if (middle) { points = simplify([start, ...middle, end]); clearance = gap; break; }
        }
        if (points) break;
      }
    }
    if (!points) { result.set(link.id, { points: [], path: '', blocked: true }); continue; }
    result.set(link.id, { points, path: drawPath(points, used, clearance), blocked: false });
    used.push(...segments(points));
  }
  return result;
}
