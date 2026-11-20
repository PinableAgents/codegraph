import { describe, expect, it } from 'vitest';
import { overviewEdges, relationshipPresentation } from '../ui/src/lib/relationship-focus';
import { projectScene, shortestDirectedPath } from '../ui/src/lib/graph-analysis';
import type { GraphScene, SceneEdge } from '../ui/src/lib/graph-scene';

const edge = (source: string, target: string, count: number, dashed = false): SceneEdge => ({
  id: source + target, source, target, count, dashed, label: String(count), width: 1, originalIds: [source + target],
});
function scene(kind: GraphScene['kind'], edges: SceneEdge[]): GraphScene {
  return {
    kind, edges, relations: edges.map(({ id, source, target, count }) => ({ id, source, target, count })), groups: [],
    nodes: [...new Set(edges.flatMap(e => [e.source, e.target]))].map((id, i) => ({
      id, label: id, sub: '', kind: 'node', x: i * 200, y: i * 50, width: 140, height: 44,
    })),
  };
}

describe('relationship presentation', () => {
  it('keeps strong links, cycles and the only available incoming or outgoing links', () => {
    const raw = scene('map', [
      edge('a', 'b', 5), edge('b', 'a', 5), edge('a', 'c', 1),
      edge('c', 'a', 5), edge('b', 'c', 5), edge('b', 'd', 1), edge('c', 'c', 1),
    ]);
    const keep = overviewEdges(raw);
    expect([...keep].sort()).toEqual(['ab', 'ba', 'bc', 'bd', 'ca', 'cc']);
    expect(overviewEdges({ ...raw, edges: [...raw.edges].reverse() })).toEqual(keep);
    expect(relationshipPresentation(raw, keep, null, 'both', new Set()).edges.find(e => e.id === 'ac')?.hidden).toBe(true);
    expect(relationshipPresentation(raw, null, null, 'both', new Set()).edges.some(e => e.hidden)).toBe(false);
    const path = shortestDirectedPath(raw.nodes.map(n => n.id), raw.relations, 'a', 'c');
    const revealed = relationshipPresentation(raw, keep, null, 'both', new Set(path?.edges));
    expect(revealed.edges.find(e => e.id === 'ac')?.hidden).toBe(false);
    expect(revealed.relations).toBe(raw.relations);
  });

  it('uses original direction through merged double arrows and never treats peer-to-peer links as one hop', () => {
    const raw = scene('map', [edge('a', 'b', 5), edge('b', 'a', 1), edge('a', 'c', 5), edge('b', 'c', 5), edge('d', 'a', 1)]);
    const projected = projectScene(raw, [], new Set(), null);
    const keep = overviewEdges(projected);
    const outgoing = relationshipPresentation(projected, keep, 'a', 'out', new Set());
    const incoming = relationshipPresentation(projected, keep, 'a', 'in', new Set());
    const hot = (v: GraphScene) => v.edges.filter(e => e.hot).map(e => e.originalIds);
    expect(hot(outgoing)).toEqual([['ab', 'ba'], ['ac']]);
    expect(hot(incoming)).toEqual([['ab', 'ba'], ['da']]);
    expect(outgoing.edges.find(e => e.originalIds.includes('bc'))?.dimmed).toBe(true);
    expect(outgoing.nodes.find(n => n.id === 'd')?.dimmed).toBe(true);
    expect(incoming.nodes.find(n => n.id === 'c')?.dimmed).toBe(true);
    expect(outgoing.nodes.map(({ x, y }) => [x, y])).toEqual(raw.nodes.map(({ x, y }) => [x, y]));
    expect(incoming.relations).toBe(raw.relations);
  });

  it('only quiets redundant inferred Screens transitions and never alters Flow or Steps', () => {
    const edges = [edge('a', 'b', 1), edge('b', 'c', 1), edge('a', 'c', 1, true), edge('c', 'a', 2, true)];
    const screens = scene('screens', edges);
    expect([...overviewEdges(screens)].sort()).toEqual(['ab', 'bc', 'ca']);
    const focused = relationshipPresentation(screens, overviewEdges(screens), 'a', 'out', new Set());
    expect(focused.edges.find(e => e.id === 'ac')).toMatchObject({ hot: true, hidden: false });
    for (const kind of ['flow', 'steps'] as const) {
      const same = scene(kind, edges);
      expect(relationshipPresentation(same, new Set(), 'a', 'out', new Set())).toBe(same);
    }
  });
});
