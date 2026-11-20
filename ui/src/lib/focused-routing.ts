import type { GraphScene, SceneNode, SceneEdge } from './graph-scene';
import type { RelationshipDirection } from './relationship-focus';

type Coordinate = [number, number];
type Box = Pick<SceneNode, 'id' | 'x' | 'y' | 'width' | 'height'>;
type Wire = Pick<SceneEdge, 'id' | 'source' | 'target'>;
export type GridRoutes = Record<string, Coordinate[]>;
export type EdgePaths = Record<string, string>;
export interface FocusRoutingInput { nodes: Box[]; edges: Wire[] }
export type FocusRoutingPlan = { key: string; input: FocusRoutingInput } | 'budget' | 'folded' | null;

const MAX_NODES = 80;
const MAX_EDGES = 12;
const MAX_GRID_CELLS = 180_000;
const MARGIN = 48; // The shared router's frame around all node boxes.
const STEP = 16;

export function focusRoutingPlan(
  scene: GraphScene,
  selected: string | null,
  direction: RelationshipDirection,
  collapsed: readonly string[],
): FocusRoutingPlan {
  if ((scene.kind !== 'map' && scene.kind !== 'screens') || selected === null) return null;
  const edges = scene.edges.filter(edge => edge.hot && !edge.hidden && !edge.straight && !edge.path && edge.source !== edge.target)
    .map(({ id, source, target }) => ({ id, source, target }));
  if (!edges.length) return null;
  // Collapsed G6 combos have live, renderer-owned rectangles not present in
  // SceneNode; do not route around guessed coordinates.
  if (scene.groups.some(group => collapsed.includes(group.id))) return 'folded';

  const nodes = scene.nodes.filter(node => !node.decorative)
    .map(({ id, x, y, width, height }) => ({ id, x, y, width, height }));
  if (nodes.length < 3) return null;
  if (nodes.length > MAX_NODES || edges.length > MAX_EDGES ||
    nodes.some(n => ![n.x, n.y, n.width, n.height].every(Number.isFinite) || n.width <= 0 || n.height <= 0)) return 'budget';
  const spanX = Math.max(...nodes.map(n => n.x + n.width)) - Math.min(...nodes.map(n => n.x)) + 2 * MARGIN;
  const spanY = Math.max(...nodes.map(n => n.y + n.height)) - Math.min(...nodes.map(n => n.y)) + 2 * MARGIN;
  if ((Math.ceil(spanX / STEP) + 1) * (Math.ceil(spanY / STEP) + 1) > MAX_GRID_CELLS) return 'budget';
  const input = { nodes, edges };
  return { key: JSON.stringify([scene.kind, selected, direction, input]), input };
}

function boundary(box: Box, exit: Coordinate): Coordinate | null {
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  // The grid router supplies a horizontal or vertical stub outside the box.
  if (exit[1] === cy && (exit[0] < box.x || exit[0] > box.x + box.width)) {
    return [exit[0] < box.x ? box.x : box.x + box.width, cy];
  }
  if (exit[0] === cx && (exit[1] < box.y || exit[1] > box.y + box.height)) {
    return [cx, exit[1] < box.y ? box.y : box.y + box.height];
  }
  return null;
}

function crossesBox(a: Coordinate, b: Coordinate, box: Box): boolean {
  // Occupancy cells are sampled. Verify the continuous line as well, so two
  // clear cells cannot form a segment across a very thin intervening box.
  if (a[0] === b[0]) return a[0] >= box.x && a[0] <= box.x + box.width &&
    Math.max(a[1], b[1]) >= box.y && Math.min(a[1], b[1]) <= box.y + box.height;
  if (a[1] === b[1]) return a[1] >= box.y && a[1] <= box.y + box.height &&
    Math.max(a[0], b[0]) >= box.x && Math.min(a[0], b[0]) <= box.x + box.width;
  return true; // Do not accept nonorthogonal or malformed route segments.
}

/** Attach existing grid stubs to actual node boundaries and retain only
 * collision-free polylines. Missing/invalid routes keep the previous curve. */
export function focusedEdgePaths(input: FocusRoutingInput, routes: GridRoutes): EdgePaths {
  const nodes = new Map(input.nodes.map(node => [node.id, node]));
  const paths: EdgePaths = Object.create(null);
  for (const { id, source, target } of input.edges) {
    const route = routes[id], from = nodes.get(source), to = nodes.get(target);
    if (!from || !to || source === target || !route?.length ||
      route.some(point => point.length !== 2 || !point.every(Number.isFinite))) continue;
    const start = boundary(from, route[0]!), end = boundary(to, route[route.length - 1]!);
    if (!start || !end) continue;
    const points = [start, ...route, end];
    const obstacles = input.nodes.filter(box => box.id !== source && box.id !== target);
    if (points.some((point, i) => i > 0 && obstacles.some(box => crossesBox(points[i - 1]!, point, box)))) continue;
    paths[id] = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');
  }
  return paths;
}

export function presentFocusedRoutes(scene: GraphScene, paths?: EdgePaths): GraphScene {
  if (!paths || (scene.kind !== 'map' && scene.kind !== 'screens')) return scene;
  return {
    ...scene,
    edges: scene.edges.map(edge => edge.hot && !edge.hidden && !edge.straight && !edge.path && edge.source !== edge.target && paths[edge.id]
      ? { ...edge, avoidancePath: paths[edge.id] } : edge),
  };
}

/** Invalidate late callbacks even if an adapter cannot cancel its underlying
 * work. A failed or slow optional job must not affect the ordinary canvas. */
export function startFocusedRouting(
  start: (done: (routes: GridRoutes) => void, fail: () => void) => () => void,
  done: (routes: GridRoutes) => void,
  fail: () => void,
  timeoutMs = 2500,
): () => void {
  let active = true;
  let cancelTask = () => {};
  function finish(callback: () => void) {
    if (!active) return;
    active = false;
    clearTimeout(timeout);
    cancelTask();
    callback();
  }
  const timeout = setTimeout(() => finish(fail), timeoutMs);
  try {
    cancelTask = start(routes => finish(() => done(routes)), () => finish(fail));
    if (!active) cancelTask();
  } catch {
    finish(fail);
  }
  return () => finish(() => {});
}
