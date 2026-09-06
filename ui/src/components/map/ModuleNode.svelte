<script lang="ts">
  /** 每个模块只保留两个连接锚点；曲线的扇出位置由纯布局端口计算。 */
  import { Handle, Position, type NodeProps } from '@xyflow/svelte';
  import { moduleMetaLabel, type MapNodeLayout } from '../../lib/map-model';

  let { data }: NodeProps = $props();

  const node = $derived(
    data as unknown as {
      layout: MapNodeLayout;
      selected: boolean;
      dimmed: boolean;
      onSelect: (id: string) => void;
      onMove: (id: string, dx: number, dy: number) => void;
    }
  );
  const layout = $derived(node.layout);
  const module = $derived(layout.module);

</script>

<Handle aria-hidden="true" tabindex={-1} role="presentation" type="target" id="in" position={Position.Top} isConnectable={false} />

<button
  class="mnode"
  class:sel={node.selected}
  class:dimmed={node.dimmed}
  class:test={module.test}
  class:gen={layout.generated}
  style={`width:${layout.width}px;height:${layout.height}px`}
  onclick={() => node.onSelect(layout.id)}
  onkeydown={(event) => {
    if (!event.altKey) return;
    const direction: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const delta = direction[event.key];
    if (!delta) return;
    event.preventDefault(); event.stopPropagation();
    const step = event.shiftKey ? 50 : 10;
    node.onMove(layout.id, delta[0] * step, delta[1] * step);
  }}
  aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown"
  aria-pressed={node.selected}
  title={`${module.id} — ${module.symbols} symbols in ${module.files} file${
    module.files === 1 ? '' : 's'
  }${layout.island ? '. Nothing in the index depends on it.' : ''}${
    layout.generated ? '. Every file in it is tool-generated.' : ''
  }`}
>
  <span class="name">{module.id}</span>
  <!-- The same string nodeWidth() sized the box for; they must not drift. -->
  <span class="count" class:island={layout.island}
    >{moduleMetaLabel(module, layout.island)}</span
  >
</button>

<Handle aria-hidden="true" tabindex={-1} role="presentation" type="source" id="out" position={Position.Bottom} isConnectable={false} />

<style>
  .mnode {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 1px;
    box-sizing: border-box;
    padding: 0 9px;
    border: 1px solid var(--rule-soft);
    border-radius: 0;
    background: var(--paper);
    text-align: left;
    cursor: grab;
    font: inherit;
    color: var(--ink);
    box-shadow: inset 3px 0 0 var(--route-branch);
    transition: background 150ms ease, border-color 150ms ease, box-shadow 150ms ease, color 150ms ease;
  }
  .mnode::before {
    content: '';
    position: absolute;
    left: -5px;
    top: 50%;
    width: 8px;
    height: 8px;
    border: 2px solid var(--route-branch);
    border-radius: 50% !important;
    background: var(--paper);
    transform: translateY(-50%);
    transition: border-color 150ms ease, background 150ms ease;
  }
  .mnode:active { cursor: grabbing; }
  .mnode:hover,
  .mnode.sel {
    border-color: var(--route-main);
    box-shadow: inset 3px 0 0 var(--route-main), 0 0 0 1px var(--route-main);
    background: var(--route-band);
  }
  .mnode:hover::before,
  .mnode.sel::before {
    border-color: var(--route-main);
    background: var(--route-main);
  }
  .mnode.dimmed {
    border-color: var(--rule-faint);
    color: var(--ink-4);
    box-shadow: inset 3px 0 0 var(--route-muted);
  }
  .mnode.dimmed::before {
    border-color: var(--route-muted);
  }
  .mnode.dimmed .count {
    color: var(--ink-4);
  }
  /* Nothing depends on it — the stroke stays normal (it is not a lesser module,
     it is an unreached one); only the count line changes what it says. */
  .count.island {
    color: var(--ink-2);
  }
  /* Generated code: nobody wrote it by hand and nobody deletes it by hand. */
  .mnode.gen {
    color: var(--ink-4);
    border-color: var(--rule-soft);
    box-shadow: inset 3px 0 0 var(--route-muted);
  }
  .mnode.gen .count {
    color: var(--ink-4);
  }
  /* Test modules read as scaffolding, not as part of the program. */
  .mnode.test {
    border-style: dashed;
    border-color: var(--ink-3);
  }
  .mnode.gen:hover,
  .mnode.gen.sel,
  .mnode.test:hover,
  .mnode.test.sel {
    border-color: var(--route-main);
    box-shadow: inset 3px 0 0 var(--route-main), 0 0 0 1px var(--route-main);
  }
  .mnode.gen:hover::before,
  .mnode.gen.sel::before,
  .mnode.test:hover::before,
  .mnode.test.sel::before {
    border-color: var(--route-main);
    background: var(--route-main);
  }
  .mnode:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  .name {
    font: 500 13px var(--mono);
    line-height: 15px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .count {
    font: 400 11px var(--sans);
    line-height: 13px;
    color: var(--ink-3);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
