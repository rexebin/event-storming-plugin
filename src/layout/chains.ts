/**
 * Event Storming — Chain and branch layout.
 */

import { DSLModel, DSLNode } from '../parser/';
import type { LayoutNode, LayoutLink } from './models.js';
import { placeProcessNode } from './helpers.js';
import { NODE_H, NODE_GAP_Y, NODE_W, NODE_GAP_X, SUB_GROUP_GAP_X } from './constants.js';

// ─── Sub-group depth computation ─────────────────────────────

export function computeSubGroupDepths(subGroups: { nodeIds: string[] }[]): number[] {
  const sets = subGroups.map((sg) => new Set(sg.nodeIds));
  const isStrictSubset = (a: Set<string>, b: Set<string>): boolean => {
    if (a.size >= b.size) return false;
    for (const id of a) if (!b.has(id)) return false;
    return true;
  };
  const depthBelow = new Array<number>(sets.length).fill(0);
  const order = sets.map((_: unknown, i: number) => i).sort((a: number, b: number) => sets[a].size - sets[b].size);
  for (const i of order) {
    let childMax = -1;
    for (const j of order) {
      if (i !== j && isStrictSubset(sets[j], sets[i])) {
        childMax = Math.max(childMax, depthBelow[j]);
      }
    }
    depthBelow[i] = childMax + 1;
  }
  return depthBelow;
}

export function computeMaxSubGroupDepth(subGroups: { nodeIds: string[] }[]): number {
  const depths = computeSubGroupDepths(subGroups);
  return depths.length > 0 ? Math.max(...depths) : 0;
}

// ─── Chain & branch layout ───────────────────────────────────

export function layoutAltBranch(
  node: DSLNode,
  x: number,
  y: number,
  container: import('../parser/').DSLContainer,
  model: DSLModel,
  processNodeMap: Map<string, DSLNode>,
  allNodes: LayoutNode[],
  allLinks: LayoutLink[],
  processPositioned: Set<string>,
  positioned: Set<string>,
  mainChainNextId: string | undefined,
  subGroupOf?: Map<string, string>,
): number {
  if (!processPositioned.has(node.id)) {
    placeProcessNode(node, x, y, container.id, allNodes, processPositioned, positioned);
   }
  const nodeOffset = node.offset ?? 0;
  const nodeOffsetY = nodeOffset < 0 ? Math.abs(nodeOffset) * (NODE_H + NODE_GAP_Y) : 0;
  const actualY = y + nodeOffsetY;
  let maxBottom = actualY + NODE_H;

    // altNext goes below (recursive)
  if (node.altNext && processNodeMap.has(node.altNext)) {
    const altNextNode = processNodeMap.get(node.altNext)!;
    const altNextY = actualY + NODE_H + NODE_GAP_Y;
    allLinks.push({ source: node.id, target: altNextNode.id, label: '', type: 'negative' });
    if (!processPositioned.has(altNextNode.id)) {
      const altBottom = layoutAltBranch(
        altNextNode, x, altNextY, container, model, processNodeMap,
        allNodes, allLinks, processPositioned, positioned, undefined, subGroupOf
       );
      maxBottom = Math.max(maxBottom, altBottom);
        }
      }

    // next goes right (starts a lateral chain at the same vertical level)
    // Skip if it rejoins the main chain (that node will be placed by the primary loop)
  if (node.next && processNodeMap.has(node.next)) {
    const nextNode = processNodeMap.get(node.next)!;
    allLinks.push({ source: node.id, target: nextNode.id, label: '', type: 'default' });
    const rejoinsMainChain = node.next === mainChainNextId;
    if (!rejoinsMainChain && !processPositioned.has(nextNode.id)) {
      const crossesSubGroup =
        !!subGroupOf &&
        (subGroupOf.get(node.id) ?? '') !== (subGroupOf.get(nextNode.id) ?? '');
      const nextX = x + NODE_W + NODE_GAP_X + (crossesSubGroup ? SUB_GROUP_GAP_X : 0);
      const chainBottom = layoutChainFrom(
        nextNode, nextX, actualY, container, model, processNodeMap,
        allNodes, allLinks, processPositioned, positioned, subGroupOf
       );
      maxBottom = Math.max(maxBottom, chainBottom);
        }
      }

  return maxBottom;
}

export function layoutChainFrom(
  startNode: DSLNode,
  startX: number,
  startY: number,
  container: import('../parser/').DSLContainer,
  model: DSLModel,
  processNodeMap: Map<string, DSLNode>,
  allNodes: LayoutNode[],
  allLinks: LayoutLink[],
  processPositioned: Set<string>,
  positioned: Set<string>,
  subGroupOf?: Map<string, string>,
): number {
  let current: DSLNode | undefined = startNode;
  let currentX = startX;
  let currentY = startY;
  let maxBottom = currentY + NODE_H;
  const visited = new Set<string>();

    // Pass 1: place all chain nodes left-to-right and add next-links
  const chainNodes: Array<{ node: DSLNode; x: number }> = [];
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    const nodeOffset = current.offset ?? 0;
    const nodeOffsetY = nodeOffset < 0 ? Math.abs(nodeOffset) * (NODE_H + NODE_GAP_Y) : 0;
    placeProcessNode(current, currentX, currentY, container.id, allNodes, processPositioned, positioned);
    maxBottom = Math.max(maxBottom, currentY + nodeOffsetY + NODE_H);
    chainNodes.push({ node: current, x: currentX });

    if (!current.next || !processNodeMap.has(current.next)) break;

    const nextNode: DSLNode = processNodeMap.get(current.next)!;
    allLinks.push({ source: current.id, target: nextNode.id, label: '', type: 'default' });

    const crossesSubGroup =
      !!subGroupOf &&
      (subGroupOf.get(current.id) ?? '') !== (subGroupOf.get(nextNode.id) ?? '');
    if (nodeOffset > 0) {
      // Positive offset: shift chain right so successors start after the widened gap.
      currentX += NODE_W + NODE_GAP_X + nodeOffset * (NODE_W + NODE_GAP_X) + (crossesSubGroup ? SUB_GROUP_GAP_X : 0);
    } else {
      currentX += NODE_W + NODE_GAP_X + (crossesSubGroup ? SUB_GROUP_GAP_X : 0);
      if (nodeOffset < 0) currentY += nodeOffsetY;
    }
    current = nextNode;
   }

    // Pass 2: lay out alt branches right-to-left so fan-in targets land below the
    // rightmost node that references them, not below the first one encountered.
  const negativeY = maxBottom + NODE_GAP_Y;
  for (let i = chainNodes.length - 1; i >= 0; i--) {
    const { node, x } = chainNodes[i];
    const hasAltBranch = !!node.altNext && processNodeMap.has(node.altNext);
    if (!hasAltBranch) continue;

    const negativeNode = processNodeMap.get(node.altNext!)!;
    const linkLabel = '';
    const mainChainNextId = chainNodes[i + 1]?.node.id;

    allLinks.push({ source: node.id, target: negativeNode.id, label: linkLabel, type: 'negative' });
    // Positive offset shifts the node right; negative offset shifts down (no X change).
    const parentOwnOffset = Math.max(0, node.offset ?? 0) * (NODE_W + NODE_GAP_X);
    const altBottom = layoutAltBranch(
      negativeNode, x + parentOwnOffset, negativeY, container, model, processNodeMap,
      allNodes, allLinks, processPositioned, positioned, mainChainNextId, subGroupOf
     );
    maxBottom = Math.max(maxBottom, altBottom);
     }

  return maxBottom;
}
