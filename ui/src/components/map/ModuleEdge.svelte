<script lang="ts">
  /**
   * One dependency link on the Map (design spec §3.6).
   *
   * 曲线与直线共用端口路径，箭头、流动效果和悬停区域
   * 保持一致。边宽按依赖数量的对数增长，避免大权重遮盖细节。
   *
   * A second, transparent, 12px-wide copy of the same path is the hit target —
   * a 1px stroke is not something anyone can hover on purpose.
   *
   * Back-edges (a mutual dependency's lighter direction, or a link with nothing
   * declared behind it) are dashed in the accent. They point *up* the layering,
   * which is exactly why they are worth marking rather than straightening out.
   */
  import { BaseEdge, type EdgeProps } from '@xyflow/svelte';
  import { mapEdgePath, type MapEdgeStyle } from '../../lib/map-edge-path';
  import type { MapEdgeLayout } from '../../lib/map-model';

  let { id, data }: EdgeProps = $props();

  const d = $derived(
    data as unknown as {
      edge: MapEdgeLayout;
      points: { source: { x: number; y: number }; target: { x: number; y: number } };
      hot: boolean;
      dimmed: boolean;
      flowing?: boolean;
      edgeStyle?: MapEdgeStyle;
      onHover: (edge: MapEdgeLayout | null, event: MouseEvent | null) => void;
    }
  );

  // 按码点编码，保留含空格、分隔符及非ASCII边ID的唯一性。
  const markerId = $derived(`map-arrow-${Array.from(id, char => char.codePointAt(0)!.toString(16)).join('-')}`);
  const color = $derived(d.edge.back ? 'var(--route-return)' : d.hot ? 'var(--route-main)' : 'var(--route-branch)');
  const path = $derived(mapEdgePath(d.points, d.edgeStyle));
</script>

<defs>
  <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto">
    <path d="M1,1 L9,5 L1,9 Z" fill={color} pointer-events="none" />
  </marker>
</defs>
<BaseEdge
  markerEnd={`url(#${markerId})`}
  interactionWidth={0}
  {path}
  class={`medge${d.edge.back ? ' back' : ''}${d.hot ? ' hot' : ''}${d.dimmed ? ' dimmed' : ''}`}
  style={`stroke-width:${d.edge.width}px`}
/>
{#if d.flowing}
  <path class="flowing" d={path} pathLength="100" aria-hidden="true" pointer-events="none" style={`stroke:${color};stroke-width:${Math.max(2, d.edge.width)}px`} />
{/if}
<path
  class="hit"
  d={path}
  role="presentation"
  onmousemove={(event) => d.onHover(d.edge, event)}
  onmouseleave={() => d.onHover(null, null)}
/>

<style>
  .flowing {
    fill: none;
    stroke-linecap: round;
    stroke-dasharray: 1 11;
    stroke-opacity: 0.95;
    pointer-events: none;
    animation: map-flow 1.2s linear infinite;
  }
  /* 负偏移沿路径定义方向行进，回边仍由source流向target。 */
  @keyframes map-flow { to { stroke-dashoffset: -12; } }
  @media (prefers-reduced-motion: reduce) {
    .flowing { animation: none; display: none; }
  }

  :global(.svelte-flow__edge-path.medge) {
    stroke: var(--route-branch);
    stroke-opacity: 0.48;
    fill: none;
    transition: stroke 150ms ease, stroke-opacity 150ms ease;
  }
  :global(.svelte-flow__edge-path.medge.hot) {
    stroke: var(--route-main);
    stroke-opacity: 0.95;
  }
  :global(.svelte-flow__edge-path.medge.dimmed) {
    stroke-opacity: 0.06;
  }
  :global(.svelte-flow__edge-path.medge.back) {
    stroke: var(--route-return);
    stroke-opacity: 0.82;
    stroke-dasharray: 4 3;
  }
  .hit {
    stroke: transparent;
    stroke-width: 12;
    fill: none;
    pointer-events: stroke;
    cursor: crosshair;
  }
</style>
