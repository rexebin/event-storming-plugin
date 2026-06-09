/**
 * Event Storming — Fan-in layout.
 */

import { DSLModel, DSLNode } from '../parser/';
import type { LayoutNode, LayoutLink } from './models.js';
import { placeProcessNode } from './helpers.js';
import { NODE_H, NODE_GAP_Y, NODE_W, NODE_GAP_X, ALT_BRANCH_GAP } from './constants.js';
import { layoutAltBranch, layoutChainFrom } from './chains.js';

export function layoutFanInProcess(
  roots: DSLNode[],
  target: DSLNode,
  innerX: number,
  processY: number,
  container: import('../parser/').DSLContainer,
  processWidth: number,
  model: DSLModel,
  processNodeMap: Map<string, DSLNode>,
  allNodes: LayoutNode[],
  allLinks: LayoutLink[],
  processPositioned: Set<string>,
  positioned: Set<string>,
): number {
  const rowHeight = NODE_H + NODE_GAP_Y;
  const useTwoSidedLayout = container.type === 'projector' || target.type === 'view';

  if (useTwoSidedLayout) {
    const splitIndex = Math.ceil(roots.length / 2);
    const leftRoots = roots.slice(0, splitIndex);
    const rightRoots = roots.slice(splitIndex);
    const stackRows = Math.max(leftRoots.length, rightRoots.length);
    const targetX = innerX + (processWidth - NODE_W) / 2;
    const targetY = processY + ((stackRows - 1) * rowHeight) / 2;
    const leftX = targetX - NODE_W - NODE_GAP_X;
    const rightX = targetX + NODE_W + NODE_GAP_X;

    placeProcessNode(target, targetX, targetY, container.id, allNodes, processPositioned, positioned);

    let twoSidedAltBottom = processY + (stackRows - 1) * rowHeight + NODE_H;
    const layoutRoots = (rootList: DSLNode[], rootX: number) => {
      rootList.forEach((node, index) => {
        const rootY = processY + index * rowHeight;
        placeProcessNode(node, rootX, rootY, container.id, allNodes, processPositioned, positioned);
        allLinks.push({ source: node.id, target: target.id, label: '', type: 'default' });
        if (node.altNext && processNodeMap.has(node.altNext)) {
          const altNextNode = processNodeMap.get(node.altNext)!;
          allLinks.push({ source: node.id, target: altNextNode.id, label: '', type: 'negative' });
          if (!processPositioned.has(altNextNode.id)) {
            const bottom = layoutAltBranch(
              altNextNode, rootX, rootY + NODE_H + NODE_GAP_Y + ALT_BRANCH_GAP,
              container, model, processNodeMap, allNodes, allLinks, processPositioned, positioned, undefined,
            );
            twoSidedAltBottom = Math.max(twoSidedAltBottom, bottom);
          }
        }
      });
    };
    layoutRoots(leftRoots, leftX);
    layoutRoots(rightRoots, rightX);

    const chainBottom = layoutChainFrom(
       target,
       targetX,
       targetY,
       container,
       model,
       processNodeMap,
       allNodes,
       allLinks,
       processPositioned,
       positioned
     );

    return Math.max(chainBottom, twoSidedAltBottom);
     }

  const targetX = innerX + NODE_W + NODE_GAP_X;
  const targetY = processY + ((roots.length - 1) * rowHeight) / 2;

  placeProcessNode(target, targetX, targetY, container.id, allNodes, processPositioned, positioned);

  let altBottom = processY + (roots.length - 1) * rowHeight + NODE_H;
  roots.forEach((node, index) => {
    const rootY = processY + index * rowHeight;
    placeProcessNode(node, innerX, rootY, container.id, allNodes, processPositioned, positioned);
    allLinks.push({
       source: node.id,
       target: target.id,
       label: '',
       type: 'default',
     });
    if (node.altNext && processNodeMap.has(node.altNext)) {
      const altNextNode = processNodeMap.get(node.altNext)!;
      allLinks.push({ source: node.id, target: altNextNode.id, label: '', type: 'negative' });
      if (!processPositioned.has(altNextNode.id)) {
        const bottom = layoutAltBranch(
          altNextNode, innerX, rootY + NODE_H + NODE_GAP_Y + ALT_BRANCH_GAP,
          container, model, processNodeMap, allNodes, allLinks, processPositioned, positioned, undefined
        );
        altBottom = Math.max(altBottom, bottom);
      }
    }
   });

  const chainBottom = layoutChainFrom(
    target,
    targetX,
    targetY,
    container,
    model,
    processNodeMap,
    allNodes,
    allLinks,
    processPositioned,
    positioned
   );

  return Math.max(chainBottom, altBottom);
}

export function computeProcessColumns(processNodes: LayoutNode[], processNodeMap: Map<string, DSLNode>): number {
  if (processNodes.length === 0) return 0;

  // memo key includes starting column because the same node reached via altNext
  // starts at a deeper column than when reached via a root traversal.
  const memo = new Map<string, number>();

  // Returns the max right edge (1-based column count) for the subtree rooted at `node` placed at `col`.
  const maxRightFrom = (node: LayoutNode, col: number, path: Set<string>): number => {
    const key = `${node.id}@${col}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    if (path.has(node.id)) return col + 1;

    const nextPath = new Set(path);
    nextPath.add(node.id);

    let maxRight = col + 1;

    // next goes right (+1 column)
    const nextNode = node.next ? (processNodeMap.get(node.next) as LayoutNode | undefined) : undefined;
    if (nextNode) maxRight = Math.max(maxRight, maxRightFrom(nextNode, col + 1, nextPath));

    // altNext goes down (same column), then its own next chain extends further right
    const altNextId = processNodeMap.get(node.id)?.altNext;
    if (altNextId) {
      const altNode = processNodeMap.get(altNextId) as LayoutNode | undefined;
      if (altNode) maxRight = Math.max(maxRight, maxRightFrom(altNode, col, nextPath));
    }

    memo.set(key, maxRight);
    return maxRight;
  };

  return processNodes.reduce((max, node) => Math.max(max, maxRightFrom(node, 0, new Set<string>())), 1);
}

export function computeFanInProcessColumns(
  _roots: DSLNode[],
  target: DSLNode,
  processNodeMap: Map<string, DSLNode>,
  container: import('../parser/').DSLContainer,
): number {
  const chainColumns = computeProcessColumns([target] as LayoutNode[], processNodeMap);
  const useTwoSidedLayout = container.type === 'projector' || target.type === 'view';

  return useTwoSidedLayout ? Math.max(3, chainColumns + 1) : chainColumns + 1;
}
