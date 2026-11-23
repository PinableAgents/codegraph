import type { GraphScene, SceneNode } from './graph-scene';

export const orbitLabelZoom = 1.65;

/** Size by distinct neighbouring modules, not by repeated references or display folding. */
export function orbitNodeSizes(scene: GraphScene): ReadonlyMap<string, number> {
  const neighbours = new Map(scene.nodes.map(node => [node.id, new Set<string>()]));
  for (const edge of scene.relations) {
    const source = neighbours.get(edge.source), target = neighbours.get(edge.target);
    if (!source || !target) continue;
    source.add(edge.target);
    target.add(edge.source);
  }
  return new Map([...neighbours].map(([id, adjacent]) => [id, 7 + Math.min(9, Math.sqrt(adjacent.size) * 1.9)]));
}

/** Changing appearance preserves the node centre until a worker layout is available. */
export function orbitNodes(nodes: readonly SceneNode[], sizes: ReadonlyMap<string, number>): SceneNode[] {
  return nodes.map(node => {
    const size = sizes.get(node.id) ?? 7;
    return { ...node, x: node.x + (node.width - size) / 2, y: node.y + (node.height - size) / 2, width: size, height: size };
  });
}
