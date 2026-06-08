/**
 * Event Storming — Process layout helper functions.
 */

import { DSLModel, DSLNode } from '../parser/';
import { LayoutNode } from './models.js';
import { NODE_W, NODE_GAP_X, NODE_H, NODE_GAP_Y } from './constants.js';

// ─── Process utilities ───────────────────────────────────────

export function getProcessNodes(process: import('../parser/').DSLProcess, model: DSLModel): DSLNode[] {
  return process.stepIds
    .map((id) => model.nodes.find((node) => node.id === id))
    .filter((node): node is DSLNode => !!node);
}

export function getProcessRoots(process: import('../parser/').DSLProcess, processNodeMap: Map<string, DSLNode>): DSLNode[] {
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

  const offset = node.offset ?? 0;
  const offsetX = offset > 0 ? offset * (NODE_W + NODE_GAP_X) : 0;
  const offsetY = offset < 0 ? Math.abs(offset) * (NODE_H + NODE_GAP_Y) : 0;

  allNodes.push({
    ...node,
    x: x + offsetX,
    y: y + offsetY,
    containerId,
  });
  processPositioned.add(node.id);
  positioned.add(node.id);
}
