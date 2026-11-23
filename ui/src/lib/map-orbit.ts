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

/**
 * Labels are optional decoration. Reserve the focused label first and, during
 * navigation without a focus, let hubs claim space before smaller nodes.
 * Coordinates stay in graph units, so panning or zooming within one label
 * threshold does not rerun layout or change the priority order.
 */
export function orbitVisibleLabels(nodes: readonly SceneNode[], zoomed: boolean, hovered: string | null): ReadonlySet<string> {
  type Box = { x: number; y: number; w: number; h: number };
  const chosen = new Set<string>(), occupied: Box[] = [];
  const tryAdd = (node: SceneNode) => {
    if (chosen.has(node.id)) return;
    // G6 renders these single-line names at 11px in a monospace font.
    const w = Array.from(node.label).reduce((width, ch) => width + (ch.codePointAt(0)! > 255 ? 11 : 7), 10);
    const box = { x: node.x + (node.width - w) / 2, y: node.y + node.height + 2, w, h: 17 };
    if (occupied.some(other => box.x < other.x + other.w && other.x < box.x + box.w
      && box.y < other.y + other.h && other.y < box.y + box.h)) return;
    chosen.add(node.id);
    occupied.push(box);
  };
  const selected = nodes.find(node => node.selected);
  const pointer = hovered ? nodes.find(node => node.id === hovered) : undefined;
  if (selected) tryAdd(selected);
  if (pointer) tryAdd(pointer);
  if (selected || pointer || !zoomed) return chosen;
  const ranked = nodes.filter(node => !node.decorative && !node.dimmed).sort((a, b) =>
    b.width - a.width || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  for (const node of ranked) tryAdd(node);
  return chosen;
}
