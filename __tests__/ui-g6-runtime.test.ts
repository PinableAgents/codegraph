import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

const harness = vi.hoisted(() => ({ graphs: [] as any[] }));
vi.mock('@antv/g6', () => ({
  register() {},
  ExtensionCategory: { EDGE: 'edge' },
  BaseEdge: class {},
  // The runtime routes through G6 Cubic now, not the old Polyline worker.
  Cubic: class {},
  Graph: class {
    events = new Map();
    data: any;
    render = vi.fn(async () => {});
    draw = vi.fn(async () => {});
    destroy = vi.fn();
    setElementState = vi.fn(async () => {});
    updateEdgeData = vi.fn();
    fitView = vi.fn(async () => {});
    constructor() { harness.graphs.push(this); }
    on(name: string, fn: any) { this.events.set(name, fn); }
    setData(data: any) { this.data = data; }
    setSize() {}
    setPlugins() {}
    getElementPosition(id: string) { const n = this.data.nodes.find((node: any) => node.id === id); return [n.style.x, n.style.y]; }
    getElementRenderBounds() { return { min: [0, 0], max: [500, 300] }; }
    getZoom() { return 1; }
    getViewportByCanvas() { return [0, 0]; }
    async zoomTo() {}
    async translateTo() {}
    async focusElement() {}
  },
}));

import { G6Runtime } from '../ui/src/lib/g6-runtime';
import type { GraphScene } from '../ui/src/lib/graph-scene';

const scene = (): GraphScene => ({
  kind: 'map',
  nodes: ['a', 'b'].map((id, i) => ({
    id, x: i * 300, y: 0, width: 200, height: 48, label: id, sub: '', kind: 'module',
  })),
  edges: [{ id: 'ab', source: 'a', target: 'b', originalIds: ['ab'], label: '1', width: 1.5 }],
  relations: [{ id: 'ab', source: 'a', target: 'b' }],
  groups: [],
});
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

let runtime: G6Runtime;
let errors: string[];
beforeEach(() => {
  harness.graphs = [];
  errors = [];
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '' }));
  const Observer = class { observe() {} disconnect() {} };
  vi.stubGlobal('ResizeObserver', Observer);
  vi.stubGlobal('MutationObserver', Observer);
  runtime = new G6Runtime(
    { clientWidth: 1000, clientHeight: 800, dataset: {}, parentElement: null } as any,
    { select() {}, move() {}, viewport() {}, error: message => { if (message) errors.push(message); } },
  );
});
afterEach(() => {
  runtime?.destroy();
  vi.unstubAllGlobals();
  expect(errors).toEqual([]);
});

describe('G6 lifecycle and incremental state', () => {
  it('selection, hover labels and path highlighting do not rerender geometry', async () => {
    const data = scene();
    await runtime.update(data, new Set(), new Set());
    const graph = harness.graphs[0];
    data.nodes[0]!.selected = true;
    data.edges[0]!.label = '→ 8 · ← 2';
    data.edges[0]!.hot = true;
    await runtime.update(data, new Set(), new Set(['ab']));
    expect(graph.render).toHaveBeenCalledTimes(1);
    expect(graph.setElementState).toHaveBeenLastCalledWith({ a: ['selected'], ab: ['active'] }, false);
    expect(graph.updateEdgeData).toHaveBeenLastCalledWith([
      { id: 'ab', style: { labelText: '→ 8 · ← 2', label: false, lineDash: [] } },
    ]);
  });

  it('hides calm lines and pins focus through unrelated hover without relayout', async () => {
    const data = scene();
    data.edges[0]!.hidden = true;
    data.nodes.push(...data.nodes.map((node, i) => ({ ...node, id: i ? 'd' : 'c', y: 200 })));
    data.edges.push({ ...data.edges[0]!, id: 'cd', source: 'c', target: 'd', originalIds: ['cd'], hidden: false });
    await runtime.update(data, new Set(), new Set());
    const graph = harness.graphs[0];
    expect(graph.data.edges[0].style.visibility).toBe('hidden');
    expect(runtime.snapshot().edges.map(e => e.id)).toEqual(['cd']);
    data.nodes[0]!.selected = true;
    data.edges[0]!.hidden = false;
    data.edges[0]!.hot = true;
    data.nodes[2]!.dimmed = data.nodes[3]!.dimmed = data.edges[1]!.dimmed = true;
    await runtime.update(data, new Set(), new Set());
    expect(graph.updateEdgeData).toHaveBeenLastCalledWith([{ id: 'ab', style: { visibility: 'visible' } }]);
    expect(runtime.snapshot().edges.map(e => e.id)).toEqual(['ab','cd']);
    const pinned = { a: ['selected'], ab: ['active'], c: ['dimmed'], d: ['dimmed'], cd: ['dimmed'] };
    expect(graph.setElementState).toHaveBeenLastCalledWith(pinned, false);
    graph.events.get('node:pointerenter')({ target: { id: 'c' } });
    await runtime.settled();
    expect(graph.setElementState).toHaveBeenLastCalledWith(pinned, false);
    graph.events.get('edge:pointermove')({ target: { id: 'ab' } });
    await runtime.settled();
    expect(graph.setElementState).toHaveBeenLastCalledWith({ ab: ['pointed'] }, false);
    expect(graph.render).toHaveBeenCalledOnce();
    expect(graph.fitView).toHaveBeenCalledOnce();
  });

  it('drops stale queued geometry and only renders the latest scene', async () => {
    const stale = scene();
    const latest = scene();
    latest.nodes[0]!.x = 777;
    const first = runtime.update(stale, new Set(), new Set());
    const second = runtime.update(latest, new Set(), new Set());
    await Promise.all([first, second]);
    expect(harness.graphs[0].data.nodes[0].style.x).toBe(877);
    expect(harness.graphs[0].render).toHaveBeenCalledOnce();
  });

  it('serializes an in-flight render without letting its stale completion fit or apply state', async () => {
    const started = deferred();
    const release = deferred();
    const graph = harness.graphs[0];
    graph.render.mockImplementationOnce(() => { started.resolve(); return release.promise; });
    const first = runtime.update(scene(), new Set(), new Set());
    await started.promise;
    const latest = scene();
    latest.nodes[0]!.x = 777;
    const second = runtime.update(latest, new Set(), new Set());
    expect(graph.data.nodes[0].style.x).toBe(100);
    release.resolve();
    await Promise.all([first, second]);
    expect(graph.render).toHaveBeenCalledTimes(2);
    expect(graph.data.nodes[0].style.x).toBe(877);
    expect(graph.fitView).toHaveBeenCalledOnce();
    expect(graph.setElementState).toHaveBeenCalledOnce();
  });

  it('destroy is idempotent and prevents queued tasks from rendering', async () => {
    const pending = runtime.update(scene(), new Set(), new Set());
    runtime.destroy();
    runtime.destroy();
    await pending;
    expect(harness.graphs[0].destroy).toHaveBeenCalledOnce();
    expect(harness.graphs[0].render).not.toHaveBeenCalled();
  });

  it('does not fit, draw or apply state after an in-flight render completes on a destroyed runtime', async () => {
    const started = deferred();
    const release = deferred();
    const graph = harness.graphs[0];
    graph.render.mockImplementationOnce(() => { started.resolve(); return release.promise; });
    const pending = runtime.update(scene(), new Set(), new Set());
    await started.promise;
    runtime.destroy();
    release.resolve();
    await pending;
    expect(graph.destroy).toHaveBeenCalledOnce();
    expect(graph.fitView).not.toHaveBeenCalled();
    expect(graph.draw).not.toHaveBeenCalled();
    expect(graph.setElementState).not.toHaveBeenCalled();
  });
});
