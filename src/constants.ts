/**
 * Event Storming — Layout constants and types.
 */

import { DSLModel, DSLNode, DSLProcess } from './dsl.js';

// ─── Node dimensions ─────────────────────────────────────────

export const NODE_W = 130;
export const NODE_H = 120;
export const NODE_FOLD = 16;
export const NODE_GAP_X = 36;
export const NODE_GAP_Y = 22;

// ─── Container dimensions ────────────────────────────────────

export const CONTAINER_PADDING = 24;
export const CONTAINER_HEADER_H = 32;
export const CONTAINER_GAP_X = 60;
export const CONTAINER_GAP_Y = 80;

// ─── Group dimensions ────────────────────────────────────────

export const GROUP_PADDING = 16;
export const GROUP_HEADER_H = 22;
export const GROUP_GAP_Y = 18;

// ─── Sub-group dimensions ────────────────────────────────────

export const SUB_GROUP_GAP_X = 24;

// ─── Styling ─────────────────────────────────────────────────

export const LINK_COLOR = '#6a737d';

// ─── Layout interfaces ───────────────────────────────────────

export interface LayoutNode extends DSLNode {
  x: number;
  y: number;
}

export interface LayoutContainer {
  id: string;
  label: string;
  type: 'aggregate' | 'readModel' | 'process' | 'externalSystem';
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  nodeIds: string[];
  notes?: string[];
}

export interface LayoutGroup {
  id: string;
  label: string;
  type: 'aggregate' | 'readModel' | 'process' | 'externalSystem';
  containerId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  notes?: string[];
}

export interface LayoutSubGroup {
  id: string;
  label: string;
  type: 'aggregate' | 'readModel' | 'process' | 'externalSystem';
  containerId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  notes?: string[];
}

export interface LayoutResult {
  width: number;
  height: number;
  containers: LayoutContainer[];
  groups: LayoutGroup[];
  subGroups: LayoutSubGroup[];
  nodes: LayoutNode[];
  links: LayoutLink[];
}

export interface LayoutLink {
  source: string;
  target: string;
  label: string;
  type: string;
}

// ─── Process layout helpers ──────────────────────────────────

export function getProcessNodes(process: DSLProcess, model: DSLModel): DSLNode[] {
  return process.stepIds
    .map((id) => model.nodes.find((node) => node.id === id))
    .filter((node): node is DSLNode => !!node);
}

export function getProcessRoots(process: DSLProcess, processNodeMap: Map<string, DSLNode>): DSLNode[] {
  const incomingCounts = new Map<string, number>();

  for (const id of process.stepIds) {
    incomingCounts.set(id, 0);
  }

  for (const node of processNodeMap.values()) {
    if (node.next && processNodeMap.has(node.next)) {
      incomingCounts.set(node.next, (incomingCounts.get(node.next) || 0) + 1);
    }
    if (node.altNext && processNodeMap.has(node.altNext)) {
      incomingCounts.set(node.altNext, (incomingCounts.get(node.altNext) || 0) + 1);
    }
  }

  return process.stepIds
    .map((id) => processNodeMap.get(id))
    .filter((node): node is DSLNode => !!node && (incomingCounts.get(node.id) || 0) === 0);
}

export const CONTAINER_TYPE_LABELS: Record<string, string> = {
  aggregate: 'Aggregate',
  readModel: 'Projector',
  process: 'Process',
  externalSystem: 'External System',
};

export function detectSharedTargetFanIn(roots: DSLNode[], processNodeMap: Map<string, DSLNode>): DSLNode | null {
  if (roots.length <= 1) return null;

  const targetIds = roots.map((node) => node.next).filter((id): id is string => !!id && processNodeMap.has(id));
  if (targetIds.length !== roots.length) return null;

  const sharedTargetId = targetIds[0];
  if (targetIds.some((targetId) => targetId !== sharedTargetId)) return null;

  return processNodeMap.get(sharedTargetId) || null;
}

export function placeProcessNode(
  node: DSLNode,
  x: number,
  y: number,
  containerId: string,
  allNodes: LayoutNode[],
  processPositioned: Set<string>,
  positioned: Set<string>,
): void {
  if (processPositioned.has(node.id)) return;

  const offsetX = (node.offset ?? 0) * (NODE_W + NODE_GAP_X);

  allNodes.push({
    ...node,
    x: x + offsetX,
    y,
    containerId,
  });
  processPositioned.add(node.id);
  positioned.add(node.id);
}
