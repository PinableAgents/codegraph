export interface CompactMapInput {
  nodes: { id: string; width: number; height: number }[];
  edges: { source: string; target: string }[];
  selected: string;
}

/** 聚焦节点按上游、双向、下游分组排近；使用实际尺寸，避免沿用全图中的巨大空白。 */
export function compactMapPositions({ nodes, edges, selected }: CompactMapInput): Record<string, { x: number; y: number }> {
  const anchor = nodes.find(node => node.id === selected);
  if (!anchor) throw new Error('选中节点已不在当前范围，请重新选择。');
  const incoming = new Set(edges.filter(edge => edge.target === selected).map(edge => edge.source));
  const outgoing = new Set(edges.filter(edge => edge.source === selected).map(edge => edge.target));
  const others = nodes.filter(node => node.id !== selected).sort((a, b) => a.id.localeCompare(b.id));
  const before = others.filter(node => incoming.has(node.id) && !outgoing.has(node.id));
  const mutual = others.filter(node => incoming.has(node.id) && outgoing.has(node.id));
  const after = others.filter(node => !incoming.has(node.id));
  // 双向关系仍以箭头解释；把选中节点放在这组中间，不暗示环内执行顺序。
  const middle = [...mutual]; middle.splice(Math.floor(middle.length / 2), 0, anchor);
  const groups = [before, middle, after].filter(group => group.length);
  const cellWidth = Math.max(...nodes.map(node => node.width)) + 64;
  const cellHeight = Math.max(...nodes.map(node => node.height)) + 64;
  const maxColumns = Math.max(...groups.map(group => Math.ceil(Math.sqrt(group.length))));
  const width = maxColumns * cellWidth;
  const positions: Record<string, { x: number; y: number }> = Object.create(null);
  let y = 60;
  for (const group of groups) {
    const columns = Math.ceil(Math.sqrt(group.length));
    for (let i = 0; i < group.length; i++) {
      const node = group[i]!; const row = Math.floor(i / columns);
      const rowCount = Math.min(columns, group.length - row * columns);
      positions[node.id] = { x: 40 + (width - rowCount * cellWidth) / 2 + i % columns * cellWidth + (cellWidth - node.width) / 2, y: y + row * cellHeight };
    }
    y += Math.ceil(group.length / columns) * cellHeight + 48;
  }
  return positions;
}
