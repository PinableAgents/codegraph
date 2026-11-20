import type { GraphScene, GraphRelation, SceneEdge } from './graph-scene';

export type RelationshipDirection = 'in' | 'out' | 'both';

export function touchesSelection(edge: GraphRelation, selected: string | null, direction: RelationshipDirection): boolean {
  return selected !== null && ((direction !== 'in' && edge.source === selected) ||
    (direction !== 'out' && edge.target === selected));
}

/** Hide only unneeded weak lines: retain strong evidence and at least one
 * visible relation for each connected endpoint. Never edit the analysis graph. */
export function overviewEdges(scene: GraphScene): ReadonlySet<string> {
  const keep = new Set<string>(), incoming = new Set<string>(), outgoing = new Set<string>();
  const retain = (edge: SceneEdge) => {
    keep.add(edge.id);
    outgoing.add(edge.source); incoming.add(edge.target);
    if (edge.reverseCount) { outgoing.add(edge.target); incoming.add(edge.source); }
  };
  const strength = (edge: SceneEdge) => (edge.count ?? 1) + (edge.reverseCount ?? 0);
  const weak = scene.edges.filter(edge => {
    if (edge.source !== edge.target && (scene.kind === 'map'
      ? strength(edge) <= 1
      : edge.dashed === true && strength(edge) <= 1)) return true;
    retain(edge);
    return false;
  });
  weak.sort((a, b) => strength(b) - strength(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const edge of weak) {
    if (!outgoing.has(edge.source) || !incoming.has(edge.target) ||
      (edge.reverseCount && (!outgoing.has(edge.target) || !incoming.has(edge.source)))) retain(edge);
  }
  return keep;
}

/** Selection and analysis act on original directed IDs, including folded lines.
 * Presentation never changes position, geometry, grouping or path evidence. */
export function relationshipPresentation(
  scene: GraphScene,
  kept: ReadonlySet<string> | null,
  selected: string | null,
  direction: RelationshipDirection,
  highlighted: ReadonlySet<string>,
): GraphScene {
  if (scene.kind !== 'map' && scene.kind !== 'screens') return scene;
  const active = new Set<string>(), neighbours = new Set<string>();
  if (selected !== null) {
    neighbours.add(selected);
    for (const relation of scene.relations) {
      if (!touchesSelection(relation, selected, direction)) continue;
      active.add(relation.id);
      neighbours.add(relation.source); neighbours.add(relation.target);
    }
  }
  return {
    ...scene,
    nodes: scene.nodes.map(node => ({
      ...node, selected: node.id === selected,
      dimmed: selected !== null && !neighbours.has(node.id) && !node.decorative,
    })),
    edges: scene.edges.map(edge => {
      const focused = edge.originalIds.some(id => active.has(id));
      const traced = highlighted.has(edge.id) || edge.originalIds.some(id => highlighted.has(id));
      return {
        ...edge,
        hidden: kept !== null && !kept.has(edge.id) && !focused && !traced,
        hot: selected === null ? edge.hot : focused,
        dimmed: selected !== null && !focused,
      };
    }),
  };
}
