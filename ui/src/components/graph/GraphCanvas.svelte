<script lang="ts">
  import { onMount, untrack, tick } from 'svelte';
  import type { GraphController, GraphScene, Viewport } from '../../lib/graph-scene';
  import type { G6Runtime } from '../../lib/g6-runtime';
  import { directoryGroups, graphCycles, projectScene, shortestDirectedPath } from '../../lib/graph-analysis';
  import { oneHop } from '../../lib/graph-budget';
  import { readGraphHistory, saveGraphHistory } from '../../lib/graph-history';
  import { graphText as t } from '../../lib/graph-copy';

  let { scene, selected, onSelect = () => {}, onMove = () => {}, onViewport = () => {}, onReset = () => {}, onVisibleChange = () => {},
    locate = null, fitRequest = null, controller = $bindable(null), fitInitially = true,
    direction = $bindable('both'), focusOnly = $bindable(false) }:
    { scene: GraphScene; selected?: string | null; onSelect?: (id: string | null) => void;
      onMove?: (id: string, x: number, y: number) => void; onViewport?: (viewport: Viewport) => void; onReset?: () => void;
      onVisibleChange?: (counts:{nodes:number;edges:number})=>void;
      locate?: { id: string } | null; fitRequest?: object | null; controller?: GraphController | null; fitInitially?: boolean;
      direction?: 'in' | 'out' | 'both'; focusOnly?: boolean } = $props();
  let host: HTMLDivElement;
  let runtime = $state.raw<G6Runtime | null>(null);
  let error = $state('');
  let query = $state(''), from = $state(''), to = $state(''), notice = $state('');
  const key = typeof location === 'undefined' ? '' : location.href;
  const history = untrack(() => readGraphHistory(key));
  let localSelected = $state<string | null>(history.selected ?? null);
  const current = $derived(selected === undefined ? localSelected : selected);
  let collapsed = $state<string[]>(history.collapsedGroups ?? []);
  let grouping = $state<'directory' | 'cycles'>(history.grouping ?? 'directory');
  if (untrack(() => scene.kind) !== 'map') { direction = history.analysisDirection ?? 'both'; focusOnly = history.analysisFocus ?? false; }
  let minimap = $state(false);
  let highlighted = $state<string[]>([]);
  let cycleChoice = $state('');
  let zoomValue = $state(1);
  const realNodes = $derived(scene.nodes.filter(n => !n.decorative));
  const nodeIds = $derived(scene.nodes.map(n => n.id));
  const cycles = $derived(graphCycles(nodeIds, scene.relations));
  const cycleMembers = $derived(new Set(cycles.flat()));
  const groups = $derived(scene.kind === 'map'
    ? grouping === 'directory' ? directoryGroups(scene) : cycles.map((members, i) => ({ id: `cycle:${JSON.stringify(members)}`, label: `${t('循环', 'Cycle')} ${i + 1}`, members }))
    : scene.groups);
  const focus = $derived(focusOnly ? oneHop(current, scene.relations, direction) : null);
  const projected = $derived(projectScene({...scene,nodes:scene.nodes.map(n=>({...n,cyclic:cycleMembers.has(n.id)}))}, groups, new Set(collapsed), focus));
  const matches = $derived(realNodes.filter(n => n.label.toLowerCase().includes(query.toLowerCase())).slice(0, query ? 20 : 0));

  function choose(id: string | null) { localSelected = id; onSelect(id); }
  async function reveal(ids: string[]) {
    focusOnly = false;
    const set = new Set(ids);
    collapsed = collapsed.filter(id => !groups.find(g => g.id === id)?.members.some(member => set.has(member)));
    await tick(); await runtime?.settled();
    await runtime?.focus(ids);
  }
  function findPath() {
    const path = shortestDirectedPath(nodeIds, scene.relations, from, to);
    highlighted = path ? [...path.nodes, ...path.edges] : [];
    notice = path ? `${t('当前范围内最短有向路径', 'Shortest directed path in loaded scope')} · ${path.edges.length} ${t('跳', 'hops')}` : t('当前范围内未找到路径', 'No path found in the loaded scope');
    if (path) void reveal(path.nodes);
  }
  function selectCycle(index: string) {
    cycleChoice = index; const cycle = cycles[Number(index)]; if (!cycle || index === '') return;
    const members = new Set(cycle);
    highlighted = [...cycle, ...scene.relations.filter(e => members.has(e.source) && members.has(e.target)).map(e => e.id)];
    notice = t('当前范围内的循环关系；不代表运行时执行顺序。', 'Cycle in loaded scope; not runtime execution order.');
    void reveal(cycle);
  }
  function toggleGroup(id: string) { collapsed = collapsed.includes(id) ? collapsed.filter(x => x !== id) : [...collapsed, id]; }
  $effect(() => {
    const next = projected, hidden = new Set(collapsed), active = new Set(highlighted);
    if (current) active.add(current);
    void runtime?.update(next, hidden, active);
  });
  $effect(()=>{const folded=projected.groups.filter(g=>collapsed.includes(g.id));const hidden=new Set(folded.flatMap(g=>g.members));onVisibleChange({nodes:projected.nodes.filter(n=>!hidden.has(n.id)).length+folded.length,edges:projected.edges.length});});
  $effect(() => { if (runtime) runtime.setMinimap(minimap); });
  $effect(() => { if (locate && runtime) { const id = locate.id; untrack(() => void reveal([id])); } });
  $effect(() => { if (fitRequest && runtime) untrack(() => void runtime?.fit()); });
  const analysisKey = $derived(JSON.stringify([nodeIds, scene.relations]));
  $effect(() => { void analysisKey; highlighted = []; notice = ''; cycleChoice = ''; });
  $effect(()=>{if(focusOnly){void direction;void current;highlighted=[];notice='';cycleChoice='';}});
  $effect(() => saveGraphHistory(key, { selected:current,collapsedGroups: collapsed, grouping, analysisDirection: direction, analysisFocus: focusOnly }));
  onMount(() => {
    let active = true;
    void import('../../lib/g6-runtime').then(({ G6Runtime }) => {
      if (!active) return;
      runtime = new G6Runtime(host, { select: choose, move: onMove, error: message => error = message,
        viewport: view => { zoomValue = view.zoom; onViewport(view); saveGraphHistory(key, { viewport: view }); } }, history.viewport, fitInitially);
      const graph=runtime;
      controller = {fit:()=>graph.fit(),focus:reveal,zoom:value=>graph.zoom(value),viewport:()=>graph.viewport(),select:id=>graph.select(id),
        collapse:async(id,value)=>{collapsed=value?[...new Set([...collapsed,id])]:collapsed.filter(key=>key!==id);await tick();await graph.settled();},
        snapshot:()=>graph.snapshot(),exportSvg:scale=>graph.exportSvg(scale)};
    }).catch(reason => error = String(reason));
    return () => { active = false; runtime?.destroy(); runtime = null; controller = null; };
  });
</script>

<div class="graph-canvas" data-graph-engine="g6">
  <div class="surface" bind:this={host}></div>
  <div class="toolbar" role="toolbar" aria-label={t('图分析工具', 'Graph analysis tools')}>
    <div class="find">
      <input aria-label={t('图内查找', 'Find in graph')} placeholder={t('图内查找…', 'Find in graph…')} bind:value={query} />
      {#if matches.length}<div class="results">{#each matches as n (n.id)}<button onclick={() => { choose(n.id); void reveal([n.id]); query = ''; }}>{n.label}</button>{/each}</div>{/if}
    </div>
    <button onclick={() => runtime?.zoom(1)}>100%</button>
    <button onclick={() => runtime?.fit()}>{t('适应画布', 'Fit view')}</button>
    <button disabled={!current} onclick={() => current && reveal([current])}>{t('定位选中', 'Focus selection')}</button>
    <button aria-pressed={minimap} onclick={() => minimap = !minimap}>{t('缩略图', 'Minimap')}</button>
    <button onclick={async()=>{onReset();collapsed=[];focusOnly=false;await tick();await runtime?.settled();await runtime?.fit();}}>{t('恢复布局', 'Restore layout')}</button>
    <details>
      <summary>{t('分析', 'Analyze')}</summary>
      <div class="analysis">
        <label>{t('上下游', 'Direction')}<select bind:value={direction}><option value="both">{t('双向', 'Both')}</option><option value="in">{t('上游', 'Incoming')}</option><option value="out">{t('下游', 'Outgoing')}</option></select></label>
        <label><input type="checkbox" bind:checked={focusOnly} />{t('只看一跳聚焦', 'Focus one hop')}</label>
        <label>{t('起点', 'From')}<select bind:value={from}><option value="">—</option>{#each realNodes as n (n.id)}<option value={n.id}>{n.label}</option>{/each}</select></label>
        <label>{t('终点', 'To')}<select bind:value={to}><option value="">—</option>{#each realNodes as n (n.id)}<option value={n.id}>{n.label}</option>{/each}</select></label>
        <button disabled={!from || !to} onclick={findPath}>{t('查找当前范围路径', 'Find path in scope')}</button>
        <label>{t('循环定位', 'Locate cycle')} ↻ <select value={cycleChoice} onchange={e => selectCycle(e.currentTarget.value)}><option value="">{cycles.length} {t('组', 'groups')}</option>{#each cycles as cycle, i}<option value={i}>{cycle.map(id => scene.nodes.find(n => n.id === id)?.label ?? id).join(' ↔ ')}</option>{/each}</select></label>
        <button onclick={() => { highlighted = []; notice = ''; cycleChoice = ''; }}>{t('清除分析高亮', 'Clear analysis')}</button>
      </div>
    </details>
    <details>
      <summary>{t('分组', 'Groups')}</summary>
      <div class="analysis">
        {#if scene.kind === 'map'}<select aria-label={t('分组方式', 'Group by')} bind:value={grouping}><option value="directory">{t('目录', 'Directory')}</option><option value="cycles">{t('循环', 'Cycles')}</option></select>{/if}
        {#each groups as group (group.id)}<button aria-expanded={!collapsed.includes(group.id)} onclick={() => toggleGroup(group.id)}>{collapsed.includes(group.id) ? '▸' : '▾'} {group.label} · {group.members.length}</button>{/each}
        {#if !groups.length}<span>{t('当前范围没有可折叠分组', 'No groups in this scope')}</span>{/if}
        <button onclick={() => collapsed = []}>{t('展开所有分组', 'Expand all')}</button>
      </div>
    </details>
  </div>
  {#if notice}<div class="notice" role="status">{notice}</div>{/if}
  {#if error}<div class="error" role="alert">{error}</div>{/if}
  <div class="zoom"><button aria-label={t('放大', 'Zoom in')} onclick={() => runtime?.zoom(zoomValue * 1.25)}>＋</button><button aria-label={t('缩小', 'Zoom out')} onclick={() => runtime?.zoom(zoomValue / 1.25)}>−</button></div>
  <details class="accessible"><summary>{t('节点列表／键盘导航', 'Node list / keyboard navigation')}</summary><div class="analysis">{#each realNodes as n (n.id)}<button aria-pressed={n.id === current} onclick={() => { choose(n.id); void reveal([n.id]); }} onkeydown={e => {
    if (!e.altKey || !n.draggable) return;
    const delta: Record<string, [number, number]> = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] };
    const d = delta[e.key]; if (d) { e.preventDefault(); onMove(n.id, n.x + d[0], n.y + d[1]); }
  }}>{n.label}</button>{/each}</div></details>
</div>

<style>
  .graph-canvas,.surface{position:absolute;inset:0}.graph-canvas{background:var(--paper);overflow:hidden}.surface{touch-action:none}
  .surface :global([data-graph-cycle=true])::after{content:'↻';position:absolute;right:4px;top:-15px;font:14px monospace;color:var(--ink-2);background:var(--paper)}
  .toolbar{position:absolute;z-index:10;top:12px;left:12px;right:12px;display:flex;flex-wrap:wrap;gap:5px;pointer-events:none}.toolbar>*{pointer-events:auto}
  input,button,select,summary{font:12px var(--sans);color:var(--ink);background:var(--paper-2);border:1px solid var(--rule-soft);border-radius:4px;padding:7px;box-sizing:border-box;min-height:32px}
  button,summary{cursor:pointer}button:disabled{opacity:.4}button[aria-pressed=true]{border-color:var(--route-main)}
  select{max-width:300px}.find{position:relative}.find input{width:130px}.results,.analysis{background:var(--paper-2);border:1px solid var(--rule-soft);padding:8px;max-height:50vh;overflow:auto;display:flex;flex-direction:column;gap:7px}
  .results{position:absolute;width:280px}.results button{text-align:left}details{position:relative}details>.analysis{position:absolute;right:0;top:100%;width:310px}label{display:flex;gap:8px;align-items:center}label select{min-width:0;flex:1}
  .notice,.error{position:absolute;top:60px;left:12px;max-width:75%;padding:8px;background:var(--paper-2);border:1px solid var(--rule-soft);font:12px var(--sans);z-index:6}.error{top:100px;color:var(--route-return)}
  .zoom{position:absolute;right:12px;bottom:12px;display:flex;flex-direction:column}.accessible{position:absolute;bottom:12px;left:12px;z-index:8}.accessible>.analysis{top:auto;bottom:100%;left:0}
</style>
