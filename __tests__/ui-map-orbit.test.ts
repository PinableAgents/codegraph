import { describe, expect, it } from 'vitest';
import { orbitNodes, orbitNodeSizes } from '../ui/src/lib/map-orbit';
import { calculateRenderLayout } from '../ui/src/lib/graph-layout-runner';
import { snapshotSvg } from '../ui/src/lib/graph-snapshot';
import type { GraphScene, Point, SceneNode } from '../ui/src/lib/graph-scene';

function fixture(count: number): GraphScene {
  return { kind: 'map', nodes: Array.from({ length: count }, (_, i): SceneNode => ({
    id: `n${i}`, x: i * 100, y: i * 50, width: 170, height: 44, label: `Module <${i}>`, sub: '', kind: 'module',
  })), edges: [], groups: [], relations: Array.from({ length: count - 1 }, (_, i) => ({ id: `e${i}`, source: `n${i}`, target: `n${i + 1}` })) };
}

describe('architecture constellation', () => {
  it('keeps real directions/IDs and sizes by distinct neighbours before display filtering', () => {
    const scene = fixture(6);
    scene.relations.push({ id: 'parallel', source: 'n2', target: 'n3', count: 50 }, { id: 'reverse', source: 'n3', target: 'n2' });
    const before = structuredClone(scene.relations);
    const nodes = orbitNodes(scene.nodes, orbitNodeSizes(scene));
    expect(nodes[2]!.width).toBeGreaterThan(nodes[0]!.width);
    expect(nodes[2]!.width).toBe(nodes[1]!.width);
    expect(nodes[2]!.x + nodes[2]!.width / 2).toBe(scene.nodes[2]!.x + scene.nodes[2]!.width / 2);
    expect(scene.relations).toEqual(before);
  });

  it('produces contiguous non-overlapping group placement and preserves the existing graph cap', async () => {
    const scene = fixture(400);
    scene.relations = scene.nodes.flatMap((node, i) => Array.from({ length: 5 }, (_, n) => ({
      id: `e${i}:${n}`, source: node.id, target: `n${(i + n + 1) % 400}`,
    })));
    scene.groups = Array.from({ length: 10 }, (_, i) => ({ id: `g${i}`, label: `group${i}`, members: scene.nodes.slice(i * 40, (i + 1) * 40).map(n => n.id) }));
    const input = { nodes: orbitNodes(scene.nodes, orbitNodeSizes(scene)), groups: scene.groups, relations: scene.relations };
    const positions = await calculateRenderLayout('relationships', input, { mode: 'orbit' }) as Record<string, Point>;
    expect(Object.keys(positions)).toHaveLength(400);
    for (let i = 0; i < input.nodes.length; i++) for (let j = i + 1; j < input.nodes.length; j++) {
      const a = input.nodes[i]!, b = input.nodes[j]!, p = positions[a.id]!, q = positions[b.id]!;
      if (Math.abs(p.x - q.x) < Math.min(a.width, b.width) && Math.abs(p.y - q.y) < Math.min(a.height, b.height)) throw new Error(`Overlapping nodes ${a.id} and ${b.id}`);
    }
    await expect(calculateRenderLayout('relationships', { ...input, nodes: [...input.nodes, input.nodes[0]] }, { mode: 'orbit' })).rejects.toThrow('400');
  }, 20000);

  it('exports subdued dot geometry without fabricating direction arrows', () => {
    const scene = fixture(2);
    const edge = { ...scene.relations[0]!, originalIds: ['e0'], label: '1', path: 'M 0 0 L 100 0', width: 1, reverseCount: 1 };
    const snapshot = { appearance: 'orbit' as const, nodes: orbitNodes(scene.nodes, orbitNodeSizes(scene)), edges: [edge], groups: [] };
    const quiet = snapshotSvg(snapshot);
    expect(quiet).toContain('<circle ');
    expect(quiet).toContain('Module &lt;0&gt;');
    expect(quiet).not.toContain('marker-end="url(#arrow)"');
    expect(quiet).not.toContain('marker-start="url(#arrow)"');
    const withArrows = snapshotSvg({ ...snapshot, edges: [{ ...edge, displayArrows: true }] });
    expect(withArrows).toContain('marker-end="url(#arrow)"');
    expect(withArrows).toContain('marker-start="url(#arrow)"');
  });
});
