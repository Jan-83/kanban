import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeStrategy, type RouteNode, type RouteLink, type CardRoute } from '../src/utils/strategyRouting';

const card = (id: string, x: number, y: number, height = 147): RouteNode => ({ id, x, y, width: 280, height });
const link = (source: string, target: string): RouteLink => ({ id: source + '->' + target, source, target });
function validate(nodes: RouteNode[], links: RouteLink[], routes: Map<string, CardRoute>) {
  const used: { a: { x: number; y: number }; b: { x: number; y: number } }[] = [];
  for (const l of links) {
    const r = routes.get(l.id)!;
    assert.equal(r.blocked, false, l.id + ' should have a route');
    assert.ok(r.path.startsWith('M'));
    const source = nodes.find(n => n.id === l.source)!, target = nodes.find(n => n.id === l.target)!;
    assert.equal(r.points[0].y, source.y + source.height);
    assert.equal(r.points.at(-1)!.x, target.x);
    for (let i = 1; i < r.points.length; i++) {
      const a = r.points[i - 1], b = r.points[i], horizontal = a.y === b.y;
      assert.ok(horizontal || a.x === b.x, 'orthogonal');
      for (const n of nodes) {
        const crosses = horizontal
          ? a.y > n.y + .01 && a.y < n.y + n.height - .01 && Math.min(Math.max(a.x, b.x), n.x + n.width) - Math.max(Math.min(a.x, b.x), n.x) > .01
          : a.x > n.x + .01 && a.x < n.x + n.width - .01 && Math.min(Math.max(a.y, b.y), n.y + n.height) - Math.max(Math.min(a.y, b.y), n.y) > .01;
        assert.ok(!crosses, l.id + ' crosses ' + n.id);
      }
      for (const s of used) {
        if (horizontal !== (s.a.y === s.b.y)) continue;
        const gap = Math.abs(horizontal ? a.y - s.a.y : a.x - s.a.x);
        const overlap = horizontal
          ? Math.min(Math.max(a.x, b.x), Math.max(s.a.x, s.b.x)) - Math.max(Math.min(a.x, b.x), Math.min(s.a.x, s.b.x))
          : Math.min(Math.max(a.y, b.y), Math.max(s.a.y, s.b.y)) - Math.max(Math.min(a.y, b.y), Math.min(s.a.y, s.b.y));
        assert.ok(gap >= .5 || overlap <= .01, l.id + ' overlaps an earlier connection');
      }
    }
    used.push(...r.points.slice(1).map((b, i) => ({ a: r.points[i], b })));
  }
}

test('routes around actual card bounds, tall checklists and obstacles between endpoints', () => {
  const nodes = [card('parent', 0, 0), card('child', 40, 900, 350), card('obstacle', -50, 210, 560)], links = [link('parent', 'child')];
  validate(nodes, links, routeStrategy(nodes, links));
});

test('multiple parents and children use separate ports and never share line segments', () => {
  const nodes = [card('a', 0, 0), card('b', 420, 0, 310), card('c', 840, 0), card('d', 0, 530), card('e', 420, 530, 260), card('f', 840, 530)];
  const links = ['a', 'b', 'c'].flatMap(p => ['d', 'e', 'f'].map(c => link(p, c)));
  const routes = routeStrategy(nodes, links); validate(nodes, links, routes);
  assert.equal(new Set(links.filter(l => l.source === 'a').map(l => routes.get(l.id)!.points[0].x)).size, 3);
  assert.equal(new Set(links.filter(l => l.target === 'e').map(l => routes.get(l.id)!.points.at(-1)!.y)).size, 3);
});

test('upward, leftward and long-range connections can go around neighbouring cards', () => {
  const nodes = [card('bottom', 420, 600), card('top', 420, 0), card('left', 0, 300), card('middle', 400, 250, 230), card('right', 820, 300)];
  const links = [link('bottom', 'top'), link('bottom', 'left'), link('top', 'right')];
  validate(nodes, links, routeStrategy(nodes, links));
});

test('moving or resizing an obstacle reroutes without changing model or requiring a save', () => {
  const nodes = [card('a', 0, 0), card('b', 450, 500), card('obstacle', 1000, 200)], links = [link('a', 'b')];
  const before = JSON.stringify({ nodes, links }), route = routeStrategy(nodes, links);
  assert.equal(JSON.stringify({ nodes, links }), before);
  const moved = nodes.map(n => n.id === 'obstacle' ? { ...n, x: 80, y: 220, height: 500 } : n);
  const after = routeStrategy(moved, links); validate(moved, links, after);
  assert.notEqual(after.get(links[0].id)!.path, route.get(links[0].id)!.path);
  assert.deepEqual(routeStrategy(moved, [...links].reverse()), after);
});

test('a card hiding an endpoint is reported without drawing a line through it', () => {
  const routes = routeStrategy([card('a', 0, 0), card('b', 500, 0), card('cover', 0, 100)], [link('a', 'b')]);
  assert.deepEqual(routes.get('a->b'), { points: [], path: '', blocked: true });
});

test('removing hidden cards opens the routing corridor again', () => {
  const nodes = [card('a', 0, 0), card('b', 40, 500), card('obstacle', 0, 200)];
  const links = [link('a', 'b')], a = routeStrategy(nodes, links), b = routeStrategy(nodes.slice(0, 2), links);
  validate(nodes, links, a); validate(nodes.slice(0, 2), links, b);
  assert.notEqual(a.get('a->b')!.path, b.get('a->b')!.path);
});

test('distant cards do not enlarge local searches or prevent routing on a large board', () => {
  const nodes = Array.from({ length: 1000 }, (_, i) => card('n' + i, (i % 25) * 400, Math.floor(i / 25) * 300));
  const links = Array.from({ length: 25 }, (_, i) => link('n' + i, 'n' + (i + 25)));
  validate(nodes, links, routeStrategy(nodes, links));
});
