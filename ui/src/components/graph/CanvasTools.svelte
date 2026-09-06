<script lang="ts">
  import { graphText } from '../../lib/graph-copy';
  import { onMount, untrack, tick } from 'svelte';
  import { readGraphHistory, saveGraphHistory } from '../../lib/graph-history';
  import { MiniMap, useSvelteFlow } from '@xyflow/svelte';
  let { items, selected = null, locate = null, fitRequest = null, onSelect = () => {} }: { items: { id: string; label: string }[]; selected?: string | null; locate?: { id: string } | null; fitRequest?: object | null; onSelect?: (id: string) => void } = $props();
  const flow = useSvelteFlow();
  let toolbar = $state<HTMLDivElement | null>(null);
  function fitCanvas() {
    return flow.fitView({ padding: { top: `${(toolbar?.offsetHeight ?? 48) + 24}px`, right: '24px', bottom: '24px', left: '24px' }, minZoom: .05, maxZoom: 1, duration: 0 });
  }
  onMount(() => {
    const key = location.href;
    const viewport = readGraphHistory(key).viewport;
    if (viewport) void flow.setViewport(viewport);
    return () => saveGraphHistory(key, { viewport: flow.getViewport() });
  });
  $effect(() => { const target = locate; if (target) untrack(() => focus(target.id)); });
  $effect(() => {
    if (!fitRequest) return;
    let active = true;
    // 等待拖动位置同步到绘图库，再对当前可见子图适应视野。
    void tick().then(() => { if (active) void fitCanvas(); });
    return () => { active = false; };
  });
  let query = $state('');
  let minimap = $state(false);
  const matches = $derived(query.trim() ? items.filter(n => n.label.toLowerCase().includes(query.toLowerCase())).slice(0, 20) : []);
  function focus(id: string) { onSelect(id); void flow.fitView({ nodes: [{ id }], maxZoom: 1, duration: 0, padding: .5 }); }
</script>
<div class="tools" role="toolbar" aria-label={graphText('画布工具', 'Canvas tools')} bind:this={toolbar}>
  <input aria-label={graphText('图内查找', 'Find in graph')} placeholder={graphText('图内查找…', 'Find in graph…')} bind:value={query} />
  <button onclick={() => flow.setViewport({ ...flow.getViewport(), zoom: 1 })}>100%</button>
  <button onclick={fitCanvas}>{graphText('适应画布', 'Fit view')}</button>
  <button disabled={!selected} onclick={() => selected && focus(selected)}>{graphText('定位选中', 'Focus selection')}</button>
  <button aria-pressed={minimap} onclick={() => minimap = !minimap}>{graphText('缩略图', 'MiniMap')}</button>
  {#if matches.length}<div class="results">{#each matches as item (item.id)}<button onclick={() => { focus(item.id); query = ''; }}>{item.label}</button>{/each}</div>{/if}
</div>
{#if minimap}<MiniMap pannable zoomable position="bottom-left" />{/if}
<style>
.tools{position:absolute;z-index:8;top:12px;left:12px;display:flex;flex-wrap:wrap;gap:4px;max-width:calc(100% - 24px);padding:6px;background:var(--paper-2);border:1px solid var(--rule)}
input,button{font:14px var(--sans);min-height:36px;box-sizing:border-box;color:var(--ink);background:var(--paper);border:1px solid var(--rule);padding:5px 8px}input{width:130px}button{cursor:pointer}button:disabled{opacity:.4}.results{position:absolute;top:100%;left:0;width:300px;max-height:280px;overflow:auto;background:var(--paper-2);border:1px solid var(--rule)}.results button{display:block;text-align:left;width:100%;overflow:hidden;text-overflow:ellipsis}
</style>
