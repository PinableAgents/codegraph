export interface GraphHistory {
  recentNodes?: { id: string; label: string }[];
  relationshipLayout?: import('./relationship-layout').RelationshipLayout;
  layoutPositions?: Partial<Record<import('./relationship-layout').RelationshipLayout, Record<string, {x: number; y: number}>>>;
  collapsedGroups?: string[];
  grouping?: 'directory' | 'cycles';
  analysisDirection?: 'in' | 'out' | 'both';
  analysisFocus?: boolean;
  selected?: string | null;
  viewport?: { x: number; y: number; zoom: number };
  scroll?: number;
  picked?: string | null;
  showAll?: boolean;
  minWeight?: number;
  focusOnly?: boolean;
  focusDirection?: 'in' | 'out' | 'both';
  scope?: string;
  flowPlaying?: boolean;
  edgeStyle?: import('./map-edge-path').MapEdgeStyle;
}
const states = new Map<string, GraphHistory>();
export function readGraphHistory(key: string): GraphHistory {
  return states.get(key) ?? {};
}
export function saveGraphHistory(key: string, patch: GraphHistory): void {
  const next = { ...states.get(key), ...patch };
  if (next.relationshipLayout === undefined) delete next.relationshipLayout;
  states.set(key, next);
  // 历史仅保留轻量状态，避免长期会话无限增长。
  if (states.size > 100) states.delete(states.keys().next().value!);
}
