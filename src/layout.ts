/**
 * Event Storming — Layout computation.
 * Orchestrates positioning of nodes, containers, groups, and sub-groups.
 */

import { DSLModel, DSLNode, DSLContainer, normalizeId } from './dsl.js';
import {
  LayoutNode,
  LayoutContainer,
  LayoutGroup,
  LayoutSubGroup,
  LayoutResult,
  LayoutLink,
  NODE_W,
  NODE_H,
  NODE_GAP_X,
  NODE_GAP_Y,
  CONTAINER_PADDING,
  CONTAINER_HEADER_H,
  CONTAINER_GAP_X,
  CONTAINER_GAP_Y,
  GROUP_PADDING,
  GROUP_HEADER_H,
  GROUP_GAP_Y,
  SUB_GROUP_GAP_X,
} from './constants.js';
import {
  getProcessNodes,
  getProcessRoots,
  detectSharedTargetFanIn,
  placeProcessNode,
  getOrCreateNegativeNode,
} from './constants.js';

// ─── Sub-group depth ─────────────────────────────────────────

const SUB_PAD_BASE_PRE = 8;
const NESTED_GAP_PRE = 14;
const SUB_PAD_BASE = 8;
const NESTED_GAP = 14;

function computeMaxSubGroupDepth(subGroups: { nodeIds: string[] }[]): number {
  const sets = subGroups.map((sg) => new Set(sg.nodeIds));
  const isStrictSubset = (a: Set<string>, b: Set<string>): boolean => {
    if (a.size >= b.size) return false;
    for (const id of a) if (!b.has(id)) return false;
    return true;
   };
  const depthBelow = new Array<number>(sets.length).fill(0);
  const order = sets.map((_: unknown, i: number) => i).sort((a: number, b: number) => a - b);
  let maxDepth = 0;
  for (const i of order) {
    let childMax = -1;
    for (const j of order) {
      if (i !== j && isStrictSubset(sets[j], sets[i])) {
        childMax = Math.max(childMax, depthBelow[j]);
        }
      }
    depthBelow[i] = childMax + 1;
    maxDepth = Math.max(maxDepth, depthBelow[i]);
     }
  return maxDepth;
}

// ─── Chain & branch layout ───────────────────────────────────

export function layoutAltBranch(
  node: DSLNode,
  x: number,
  y: number,
  container: DSLContainer,
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
  let maxBottom = y + NODE_H;

    // altNext goes below (recursive)
  if (node.altNext && processNodeMap.has(node.altNext)) {
    const altNextNode = processNodeMap.get(node.altNext)!;
    const altNextY = y + NODE_H + NODE_GAP_Y + 20;
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
    allLinks.push({ source: node.id, target: nextNode.id, label: '', type: 'negative' });
    const rejoinsMainChain = node.next === mainChainNextId;
    if (!rejoinsMainChain && !processPositioned.has(nextNode.id)) {
      const crossesSubGroup =
        !!subGroupOf &&
        (subGroupOf.get(node.id) ?? '') !== (subGroupOf.get(nextNode.id) ?? '');
      const nextX = x + NODE_W + NODE_GAP_X + (crossesSubGroup ? SUB_GROUP_GAP_X : 0);
      const chainBottom = layoutChainFrom(
        nextNode, nextX, y, container, model, processNodeMap,
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
  container: DSLContainer,
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
  const currentY = startY;
  let maxBottom = currentY + NODE_H;
  const visited = new Set<string>();

    // Pass 1: place all chain nodes left-to-right and add next-links
  const chainNodes: Array<{ node: DSLNode; x: number }> = [];
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    placeProcessNode(current, currentX, currentY, container.id, allNodes, processPositioned, positioned);
    maxBottom = Math.max(maxBottom, currentY + NODE_H);
    chainNodes.push({ node: current, x: currentX });

    if (!current.next || !processNodeMap.has(current.next)) break;

    const nextNode: DSLNode = processNodeMap.get(current.next)!;
    allLinks.push({ source: current.id, target: nextNode.id, label: '', type: 'default' });

    const crossesSubGroup =
      !!subGroupOf &&
      (subGroupOf.get(current.id) ?? '') !== (subGroupOf.get(nextNode.id) ?? '');
    currentX += NODE_W + NODE_GAP_X + (crossesSubGroup ? SUB_GROUP_GAP_X : 0);
    current = nextNode;
   }

    // Pass 2: lay out alt branches right-to-left so fan-in targets land below the
    // rightmost node that references them, not below the first one encountered.
  const negativeY = currentY + NODE_H + NODE_GAP_Y + 20;
  for (let i = chainNodes.length - 1; i >= 0; i--) {
    const { node, x } = chainNodes[i];
    const hasAltBranch =
      node.type === 'policy' || (!!node.altNext && processNodeMap.has(node.altNext));
    if (!hasAltBranch) continue;

    const negativeNode =
      node.type === 'policy'
         ? getOrCreateNegativeNode(node, container, model, processNodeMap)
         : processNodeMap.get(node.altNext!)!;
    const linkLabel = node.type === 'policy' ? 'no' : '';
    const mainChainNextId = chainNodes[i + 1]?.node.id;

    allLinks.push({ source: node.id, target: negativeNode.id, label: linkLabel, type: 'negative' });
    const altBottom = layoutAltBranch(
      negativeNode, x, negativeY, container, model, processNodeMap,
      allNodes, allLinks, processPositioned, positioned, mainChainNextId, subGroupOf
     );
    maxBottom = Math.max(maxBottom, altBottom);
     }

  return maxBottom;
}

// ─── Fan-in layout ───────────────────────────────────────────

export function layoutFanInProcess(
  roots: DSLNode[],
  target: DSLNode,
  innerX: number,
  processY: number,
  container: DSLContainer,
  processWidth: number,
  model: DSLModel,
  processNodeMap: Map<string, DSLNode>,
  allNodes: LayoutNode[],
  allLinks: LayoutLink[],
  processPositioned: Set<string>,
  positioned: Set<string>,
): number {
  const rowHeight = NODE_H + NODE_GAP_Y;
  const useTwoSidedLayout = container.type === 'readModel' || target.type === 'view';

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

    leftRoots.forEach((node, index) => {
       placeProcessNode(node, leftX, processY + index * rowHeight, container.id, allNodes, processPositioned, positioned);
       allLinks.push({
       source: node.id,
       target: target.id,
       label: '',
       type: 'default',
        });
      });

    rightRoots.forEach((node, index) => {
       placeProcessNode(node, rightX, processY + index * rowHeight, container.id, allNodes, processPositioned, positioned);
       allLinks.push({
       source: node.id,
       target: target.id,
       label: '',
       type: 'default',
        });
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

    return Math.max(chainBottom, processY + (stackRows - 1) * rowHeight + NODE_H);
     }

  const targetX = innerX + NODE_W + NODE_GAP_X;
  const targetY = processY + ((roots.length - 1) * rowHeight) / 2;

  placeProcessNode(target, targetX, targetY, container.id, allNodes, processPositioned, positioned);

  roots.forEach((node, index) => {
    placeProcessNode(node, innerX, processY + index * rowHeight, container.id, allNodes, processPositioned, positioned);
    allLinks.push({
       source: node.id,
       target: target.id,
       label: '',
       type: 'default',
     });
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

  return Math.max(chainBottom, processY + (roots.length - 1) * rowHeight + NODE_H);
}

// ─── Column computation ──────────────────────────────────────

export function computeProcessColumns(processNodes: LayoutNode[], processNodeMap: Map<string, DSLNode>): number {
  if (processNodes.length === 0) return 0;

  const memo = new Map<string, number>();

  const visit = (node: LayoutNode, path: Set<string>): number => {
    const cached = memo.get(node.id);
    if (cached !== undefined) return cached;
    if (path.has(node.id)) return 0;

    const nextPath = new Set(path);
    nextPath.add(node.id);

    const nextNode = node.next ? (processNodeMap.get(node.next) as LayoutNode | undefined) : undefined;
    const length = nextNode ? 1 + visit(nextNode, nextPath) : 1;

    memo.set(node.id, length);
    return length;
     };

  return processNodes.reduce((max, node) => Math.max(max, visit(node, new Set<string>())), 1);
}

export function computeFanInProcessColumns(
  _roots: DSLNode[],
  target: DSLNode,
  processNodeMap: Map<string, DSLNode>,
  container: DSLContainer,
): number {
  const chainColumns = computeProcessColumns([target] as LayoutNode[], processNodeMap);
  const useTwoSidedLayout = container.type === 'readModel' || target.type === 'view';

  return useTwoSidedLayout ? Math.max(3, chainColumns + 1) : chainColumns + 1;
}

// ─── Container sizing ────────────────────────────────────────

export function computeContainerWidth(container: DSLContainer, model: DSLModel): number {
  let maxW = 0;

  for (const proc of container.processes) {
    const processNodes = getProcessNodes(proc, model);
    const processNodeMap = new Map(processNodes.map((node) => [node.id, node]));
    const roots = getProcessRoots(proc, processNodeMap);
    const fanInTarget = detectSharedTargetFanIn(roots, processNodeMap);
    const startNodes = roots.length > 0 ? roots : processNodes;
    const columns = fanInTarget
       ? computeFanInProcessColumns(roots, fanInTarget, processNodeMap, container)
       : computeProcessColumns(startNodes as LayoutNode[], processNodeMap);
    let w = columns > 0 ? columns * (NODE_W + NODE_GAP_X) - NODE_GAP_X : 0;

    if (!fanInTarget && proc.subGroups && proc.subGroups.length > 0) {
      const subGroupOf = new Map<string, string>();
      for (const sg of proc.subGroups) {
        for (const nid of sg.nodeIds) subGroupOf.set(nid, sg.name);
        }
      let transitions = 0;
      let lastInSubGroup = false;
      let firstInSubGroup = false;
      for (const start of startNodes) {
        let curr: DSLNode | undefined = start;
        const seen = new Set<string>();
        let isFirst = true;
        while (curr && !seen.has(curr.id)) {
          seen.add(curr.id);
          if (isFirst && subGroupOf.has(curr.id)) firstInSubGroup = true;
          const nxt: DSLNode | undefined = curr.next ? processNodeMap.get(curr.next) : undefined;
          if (nxt && (subGroupOf.get(curr.id) ?? '') !== (subGroupOf.get(nxt.id) ?? '')) {
            transitions++;
            }
          if (!nxt && subGroupOf.has(curr.id)) lastInSubGroup = true;
          curr = nxt;
          isFirst = false;
            }
          }
      w += transitions * SUB_GROUP_GAP_X;
      if (firstInSubGroup) w += SUB_GROUP_GAP_X;
      if (lastInSubGroup) w += SUB_GROUP_GAP_X;

          // Reserve room for nested sub-group padding (the outermost sub-group's bbox extends
          // beyond its inner nodes by depth * NESTED_GAP on each side).
      const sgSets = proc.subGroups.map((sg) => new Set(sg.nodeIds));
      const isStrictSubset = (a: Set<string>, b: Set<string>): boolean => {
        if (a.size >= b.size) return false;
        for (const id of a) if (!b.has(id)) return false;
        return true;
         };
      let maxDepth = 0;
      const depthBelow = new Array<number>(sgSets.length).fill(0);
      const order = sgSets.map((_, i) => i).sort((a, b) => sgSets[a].size - sgSets[b].size);
      for (const i of order) {
        let childMax = -1;
        for (const j of order) {
          if (i !== j && isStrictSubset(sgSets[j], sgSets[i])) {
            childMax = Math.max(childMax, depthBelow[j]);
            }
            }
        depthBelow[i] = childMax + 1;
        maxDepth = Math.max(maxDepth, depthBelow[i]);
          }
      w += maxDepth * NESTED_GAP * 2;
         }

    maxW = Math.max(maxW, w);
     }

  const nonProcess = model.nodes.filter(
     (n) => n.containerId === container.id && !container.processes.some((process) => process.stepIds.includes(n.id))
   );
  const gridCols = Math.min(nonProcess.length, 4);
  const gridW = gridCols > 0 ? gridCols * (NODE_W + NODE_GAP_X) - NODE_GAP_X : 0;
  const processPadding = container.processes.length > 0 ? GROUP_PADDING * 2 : 0;

  return Math.max(maxW + processPadding, gridW) + CONTAINER_PADDING * 2;
}

export function computeContainerHeight(container: DSLContainer, model: DSLModel): number {
  const processRows = container.processes.length;
  const nonProcess = model.nodes.filter((n) => n.containerId === container.id && !container.processes.some(p => p.stepIds.includes(n.id)));
  const nonProcessRows = Math.ceil(nonProcess.length / 4);
  return CONTAINER_HEADER_H + CONTAINER_PADDING * 2 +
     (processRows + nonProcessRows) * (NODE_H + NODE_GAP_Y) + 10;
}

// ─── Standalone nodes ────────────────────────────────────────

function layoutStandaloneNodes(nodes: LayoutNode[], allNodes: LayoutNode[], startX: number, startY: number) {
  const COLS = 5;
  let cx = startX;
  let cy = startY;

  for (let i = 0; i < nodes.length; i++) {
    if (i % COLS !== 0) {
      cx += NODE_W + NODE_GAP_X;
        } else {
      cx = startX;
      cy += NODE_H + NODE_GAP_Y;
        }
    allNodes.push({ ...nodes[i], x: cx, y: cy });
     }
}

// ─── Main layout orchestrator ────────────────────────────────

export function computeLayout(model: DSLModel): LayoutResult {
  const allNodes: LayoutNode[] = [];
  const allContainers: LayoutContainer[] = [];
  const allGroups: LayoutGroup[] = [];
  const allSubGroups: LayoutSubGroup[] = [];
  const allLinks: LayoutLink[] = [];
  let x = 0;
  let y = 0;
  let rowBottom = 0;

    // 1. Render containers (aggregates + readModels + processes)
  for (const container of model.containers) {
    const containerW = computeContainerWidth(container, model);
    const containerH = computeContainerHeight(container, model);

    if (x > 0 && x + containerW > (60 * 2 + 1200)) {
      x = 0;
      y = rowBottom + CONTAINER_GAP_Y;
        }

    const cx = x;
    const cy = y;

    allContainers.push({
       ...container,
      x: cx,
      y: cy,
      width: containerW,
      height: containerH,
      notes: container.notes,
        });

        // Position nodes inside the container
    const innerX = cx + CONTAINER_PADDING;
    const innerY = cy + CONTAINER_HEADER_H + CONTAINER_PADDING;

        // Track positioned nodes to avoid duplicates (for non-process nodes only)
    const positioned = new Set<string>();

        // Layout each process group — each process is INDEPENDENT with its own positioned scope
    let processY = innerY;
    container.processes.forEach((process, processIndex) => {
           const groupX = innerX;
       const groupY = processY;
       const groupWidth = containerW - CONTAINER_PADDING * 2;
        // When nested sub-groups exist, the outermost sub-group's bbox extends above its nodes
        // by (SUB_PAD + GROUP_HEADER_H). Push the first row of nodes down so that bbox top
        // still sits inside the process group's header.
       const maxSubDepth = process.subGroups
          ? computeMaxSubGroupDepth(process.subGroups)
          : 0;
       const maxSubPad = SUB_PAD_BASE_PRE + maxSubDepth * NESTED_GAP_PRE;
        // Sub-group bbox top = node.y - SUB_PAD - GROUP_HEADER_H. For it to clear the outer
        // process group's header (height GROUP_HEADER_H), topPad must be at least
        // GROUP_HEADER_H + SUB_PAD + clearance.
       const topPad = Math.max(GROUP_PADDING, maxSubPad + GROUP_HEADER_H + GROUP_PADDING);
       const groupInnerX = groupX + GROUP_PADDING;
       const groupInnerY = groupY + GROUP_HEADER_H + topPad;
       const processNodes = getProcessNodes(process, model);
       const processNodeMap = new Map(processNodes.map((node) => [node.id, node]));
       const processPositioned = new Set<string>();
       const roots = getProcessRoots(process, processNodeMap);
       const subGroupOf = new Map<string, string>();
       if (process.subGroups) {
         for (const sg of process.subGroups) {
           for (const nid of sg.nodeIds) subGroupOf.set(nid, sg.name);
            }
            }
       const fanInTarget = detectSharedTargetFanIn(roots, processNodeMap);
       let processBottom = groupInnerY + NODE_H;

       if (fanInTarget) {
       processBottom = layoutFanInProcess(
         roots,
         fanInTarget,
         groupInnerX,
         groupInnerY,
         container,
         groupWidth - GROUP_PADDING * 2,
         model,
         processNodeMap,
         allNodes,
         allLinks,
         processPositioned,
         positioned
        );
        } else {
       let laneY = groupInnerY;
       const startNodes = roots.length > 0 ? roots : processNodes;
        // When sub-groups are present, sub-group boxes extend SUB_PAD below the last node of
        // the upper lane and SUB_PAD + GROUP_HEADER_H above the first node of the lower lane.
        // The inter-lane gap must be at least 2*SUB_PAD + GROUP_HEADER_H to prevent overlap.
       const interLaneGapY = process.subGroups
          ? Math.max(NODE_GAP_Y, 2 * SUB_PAD_BASE_PRE + GROUP_HEADER_H + 8)
          : NODE_GAP_Y;

       for (const startNode of startNodes) {
         if (processPositioned.has(startNode.id)) continue;
         const laneBottom = layoutChainFrom(
           startNode,
           groupInnerX,
           laneY,
           container,
           model,
           processNodeMap,
           allNodes,
           allLinks,
           processPositioned,
           positioned,
           subGroupOf
          );
         processBottom = Math.max(processBottom, laneBottom);
         laneY = laneBottom + interLaneGapY;
            }

       for (const node of processNodes) {
         if (processPositioned.has(node.id)) continue;
         const laneBottom = layoutChainFrom(
           node,
           groupInnerX,
           laneY,
           container,
           model,
           processNodeMap,
           allNodes,
           allLinks,
           processPositioned,
           positioned,
           subGroupOf
          );
         processBottom = Math.max(processBottom, laneBottom);
         laneY = laneBottom + interLaneGapY;
            }
            }

      let groupHeight = Math.max(
        GROUP_HEADER_H + GROUP_PADDING * 2 + NODE_H,
        processBottom - groupY + GROUP_PADDING
       );

      const processGroupRef = {
        id: `${container.id}_group_${processIndex}`,
        label: process.name,
        containerId: container.id,
        x: groupX,
        y: groupY,
        width: groupWidth,
        height: groupHeight,
        notes: process.notes,
           };
      allGroups.push(processGroupRef);

           // Compute bounding boxes for inline sub-groups
      if (process.subGroups) {
        for (let sgIdx = 0; sgIdx < process.subGroups.length; sgIdx++) {
          const subGroup = process.subGroups[sgIdx];
          const depthBelowArr = new Array<number>(process.subGroups.length).fill(0);
          const sgSets = new Set(process.subGroups[sgIdx].nodeIds);
          const subNodes = allNodes.filter((n) => sgSets.has(n.id));
          if (subNodes.length === 0) continue;
           // Also include negative/error nodes: either explicitly defined (altNext id)
           // or auto-generated (error_default_<policyId>)
          const negIds = new Set<string>();
          for (const n of subNodes) {
            if (n.altNext) negIds.add(n.altNext);
            negIds.add(`error_default_${n.id}`);
             }
          const negNodes = allNodes.filter((n) => negIds.has(n.id));
          const allSub = [...subNodes, ...negNodes];
          const minX = Math.min(...allSub.map((n) => n.x)) - (SUB_PAD_BASE + depthBelowArr[sgIdx] * NESTED_GAP);
          const minY = Math.min(...allSub.map((n) => n.y)) - (SUB_PAD_BASE + depthBelowArr[sgIdx] * NESTED_GAP) - GROUP_HEADER_H;
          const maxX = Math.max(...allSub.map((n) => n.x + NODE_W)) + (SUB_PAD_BASE + depthBelowArr[sgIdx] * NESTED_GAP);
          const maxY = Math.max(...allSub.map((n) => n.y + NODE_H)) + (SUB_PAD_BASE + depthBelowArr[sgIdx] * NESTED_GAP);
          allSubGroups.push({
            id: `${container.id}_subgroup_${processIndex}_${normalizeId(subGroup.name)}`,
            label: subGroup.name,
            containerId: container.id,
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            notes: subGroup.notes,
               });

               // Grow the process group so its bbox fully contains every sub-group bbox.
          const sgRight = maxX;
          const sgBottom = maxY;
          if (sgBottom + GROUP_PADDING > processGroupRef.y + processGroupRef.height) {
            processGroupRef.height = sgBottom + GROUP_PADDING - processGroupRef.y;
               }
          if (sgRight + GROUP_PADDING > processGroupRef.x + processGroupRef.width) {
            processGroupRef.width = sgRight + GROUP_PADDING - processGroupRef.x;
               }
            }
        groupHeight = processGroupRef.height;
         }

      processY = groupY + groupHeight + GROUP_GAP_Y;
         });

        // Layout non-process nodes below processes
    const nonProcessNodes = model.nodes.filter(
        (n) => n.containerId === container.id && n.type !== 'note' && !positioned.has(n.id)
     );
    let npX = innerX;
    let npY = processY + 10;
    for (const np of nonProcessNodes) {
           allNodes.push({ ...np, x: npX, y: npY });
           npX += NODE_W + NODE_GAP_X;
           if (npX - innerX > containerW - CONTAINER_PADDING * 2 - NODE_W) {
           npX = innerX;
           npY += NODE_H + NODE_GAP_Y;
            }
         }

         // Layout notes near their targets
    const notes = model.nodes.filter(
       (n) => n.containerId === container.id && n.type === 'note' && !positioned.has(n.id)
     );
    for (const note of notes) {
           const target = allNodes.find((n) => n.id === note.noteTarget);
           if (target) {
           allNodes.push({
              ...note,
             x: target.x + NODE_W + 8,
             y: target.y - 8,
                });
                 } else {
           allNodes.push({
              ...note,
             x: innerX,
             y: npY + 10,
                });
                 }
             }

         // Adjust container width/height to fit everything (nodes, process groups, sub-group bboxes)
    let maxNodeBottom = 0;
    let maxNodeRight = 0;
    for (const n of allNodes) {
       if (n.x >= cx && n.x < cx + containerW) {
           maxNodeBottom = Math.max(maxNodeBottom, n.y + NODE_H);
           maxNodeRight = Math.max(maxNodeRight, n.x + NODE_W);
            }
             }
    for (const group of allGroups) {
      if (group.containerId === container.id) {
           maxNodeBottom = Math.max(maxNodeBottom, group.y + group.height);
           maxNodeRight = Math.max(maxNodeRight, group.x + group.width);
            }
             }
    for (const sg of allSubGroups) {
      if (sg.containerId === container.id) {
           maxNodeBottom = Math.max(maxNodeBottom, sg.y + sg.height);
           maxNodeRight = Math.max(maxNodeRight, sg.x + sg.width);
            }
             }
    const finalContainer = allContainers[allContainers.length - 1];
         // Update container height
    finalContainer.height = Math.max(
      containerH,
         maxNodeBottom - cy + CONTAINER_PADDING + 20
     );
         // Update container width
    const grownW = Math.max(containerW, maxNodeRight - cx + CONTAINER_PADDING);
    finalContainer.width = grownW;
    rowBottom = Math.max(rowBottom, cy + finalContainer.height);

    x += grownW + CONTAINER_GAP_X;
        }

    // 2. Render standalone nodes (not in any container)
  const standaloneNodes = model.nodes.filter((n) => !n.containerId);
  if (standaloneNodes.length > 0) {
    const startY = y > 0 ? y + CONTAINER_GAP_Y : 0;
    layoutStandaloneNodes(standaloneNodes as LayoutNode[], allNodes, 0, startY);
        }

    // Compute total dimensions
  let totalWidth = 0;
  let totalHeight = 0;
  for (const n of allNodes) {
    totalWidth = Math.max(totalWidth, n.x + NODE_W);
    totalHeight = Math.max(totalHeight, n.y + NODE_H);
        }
  for (const c of allContainers) {
    totalWidth = Math.max(totalWidth, c.x + c.width);
    totalHeight = Math.max(totalHeight, c.y + c.height);
        }

  return {
    width: totalWidth,
    height: totalHeight,
    containers: allContainers,
    groups: allGroups,
    subGroups: allSubGroups,
    nodes: allNodes,
    links: allLinks,
        };
}
