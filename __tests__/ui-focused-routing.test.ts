import { afterEach, describe, expect, it, vi } from 'vitest';
import { focusRoutingPlan, focusedEdgePaths, presentFocusedRoutes, startFocusedRouting } from '../ui/src/lib/focused-routing';
import { routeScene } from '../ui/src/lib/graph-routing';
import type { GraphScene, SceneNode, SceneEdge } from '../ui/src/lib/graph-scene';

function node(id: string, x: number, y: number, width: number, height: number): SceneNode {
  return { id, x, y, width, height, label: id, sub: '', kind: 'module' };
}
function scene(): GraphScene {
  const link = (id: string, source: string, target: string, styles: Partial<SceneEdge> = {}): SceneEdge => ({
    id, source, target, label: 'evidence', count: 5, width: 1.5, originalIds: [id], ...styles,
  });
  const edges = [link('ab', 'a', 'b', { hot: true, reverseCount: 1 }),
    link('aa','a','a',{ hot: true }), link('hidden','b','a',{ hot: true, hidden: true }),
    link('straight','a','b',{ hot: true, straight: true, path: 'M120,125 L360,125' }),
    link('other','middle','b')];
  return { kind: 'map', nodes: [node('a',0,100,120,50), node('middle',180,40,120,180), node('b',360,100,120,50)],
    edges, relations: edges.map(({ id, source, target, count }) => ({ id, source, target, count })), groups: [] };
}

afterEach(() => vi.useRealTimers());

describe('bounded selected relationship routing', () => {
  it('adds a full boundary-to-boundary path around an obstacle, only for eligible edges', () => {
    const graph = scene();
    const plan = focusRoutingPlan(graph, 'a', 'both', []);
    expect(plan).toBeTypeOf('object');
    if (!plan || typeof plan === 'string') throw new Error('No routing plan');
    expect(plan.input.edges).toEqual([{ id: 'ab', source: 'a', target: 'b' }]);
    const paths = focusedEdgePaths(plan.input, routeScene(plan.input.nodes, plan.input.edges));
    expect(paths.ab).toMatch(/^M(?:0,125|120,125|60,100|60,150) L/);
    expect(paths.ab).toMatch(/ L(?:360,125|480,125|420,100|420,150)$/);
    const points = [...paths.ab!.matchAll(/[ML](-?\d+),(-?\d+)/g)].map(match => [Number(match[1]), Number(match[2])]);
    expect(points.length).toBeGreaterThan(4);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!, b = points[i]!;
      expect(a[0] === b[0] || a[1] === b[1]).toBe(true);
      const crosses = a[0] === b[0]
        ? a[0]! >= 180 && a[0]! <= 300 && Math.max(a[1]!, b[1]!) >= 40 && Math.min(a[1]!, b[1]!) <= 220
        : a[1]! >= 40 && a[1]! <= 220 && Math.max(a[0]!, b[0]!) >= 180 && Math.min(a[0]!, b[0]!) <= 300;
      expect(crosses).toBe(false);
    }
    const routed = presentFocusedRoutes(graph, paths);
    expect(routed.nodes).toBe(graph.nodes);
    expect(routed.relations).toBe(graph.relations);
    expect(routed.edges[0]).toMatchObject({ avoidancePath: paths.ab, reverseCount: 1, label: 'evidence', originalIds: ['ab'] });
    expect(routed.edges.slice(1)).toEqual(graph.edges.slice(1));
    expect(presentFocusedRoutes(graph, undefined)).toBe(graph);
  });

  it('keys by actual geometry and selection, not hovered or label styles', () => {
    const graph = scene();
    const first = focusRoutingPlan(graph, 'a', 'both', []);
    graph.edges[0]!.pointed = true;
    graph.edges[0]!.label = 'temporary hover label';
    expect(focusRoutingPlan(graph, 'a', 'both', [])).toEqual(first);
    expect(focusRoutingPlan(graph, 'a', 'in', [])).not.toEqual(first);
    expect(focusRoutingPlan(graph, 'b', 'both', [])).not.toEqual(first);
    graph.nodes[1]!.x += 25;
    expect(focusRoutingPlan(graph, 'a', 'both', [])).not.toEqual(first);
  });

  it('keeps curves for unsupported, unselected, folded, over-budget, or invalid routes', () => {
    const graph = scene();
    expect(focusRoutingPlan(graph, null, 'both', [])).toBeNull();
    expect(focusRoutingPlan({ ...graph, kind: 'flow' }, 'a', 'both', [])).toBeNull();
    expect(focusRoutingPlan({ ...graph, kind: 'steps' }, 'a', 'both', [])).toBeNull();
    const folded = { ...graph, groups: [{ id: 'fold', label: 'group', members: ['middle'] }] };
    expect(focusRoutingPlan(folded, 'a', 'both', ['fold'])).toBe('folded');
    expect(focusRoutingPlan({ ...graph, nodes: [...graph.nodes, node('far',1e9,0,120,50)] }, 'a', 'both', [])).toBe('budget');
    expect(focusRoutingPlan({ ...graph, edges: Array.from({length: 13}, (_,i) => ({ ...graph.edges[0]!, id: String(i) })) }, 'a', 'both', [])).toBe('budget');
    const input = { nodes: graph.nodes, edges: [graph.edges[0]!] };
    expect(Object.keys(focusedEdgePaths(input, { ab: [[140,125],[345,125]] }))).toEqual([]);
  });

  it('invalidates canceled replies and times out to the original curve', () => {
    vi.useFakeTimers();
    const complete = vi.fn(), fail = vi.fn(), stop = vi.fn();
    let reply: (routes: {}) => void = () => {};
    const cancel = startFocusedRouting(done => { reply = done; return stop; }, complete, fail, 10);
    cancel();
    reply({});
    vi.advanceTimersByTime(20);
    expect(stop).toHaveBeenCalledOnce();
    expect(complete).not.toHaveBeenCalled();
    expect(fail).not.toHaveBeenCalled();

    const cancelSlow = startFocusedRouting(done => { reply = done; return stop; }, complete, fail, 10);
    vi.advanceTimersByTime(11);
    reply({});
    cancelSlow();
    expect(stop).toHaveBeenCalledTimes(2);
    expect(fail).toHaveBeenCalledOnce();
    expect(complete).not.toHaveBeenCalled();
  });
});
