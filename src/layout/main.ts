/**
 * Event Storming — Main layout orchestrator.
 */

import { DSLModel, DSLContainer, DSLProcess, normalizeId } from '../parser/';
import type { LayoutNode, LayoutContainer, LayoutGroup, LayoutSubGroup, LayoutLink, LayoutResult } from './models.js';
import { getProcessNodes, getProcessRoots, detectSharedTargetFanIn } from './helpers.js';
import { computeSubGroupDepths, computeMaxSubGroupDepth, layoutChainFrom } from './chains.js';
import { layoutFanInProcess } from './fan-in.js';
import { computeContainerWidth, computeContainerHeight } from './sizing.js';
import { layoutStandaloneNodes } from './standalone.js';
import {
  NODE_W, NODE_H, NODE_GAP_X, NODE_GAP_Y,
  CONTAINER_PADDING, CONTAINER_HEADER_H, CONTAINER_GAP_X, CONTAINER_GAP_Y,
  GROUP_PADDING, GROUP_HEADER_H, GROUP_GAP_Y,
  SUB_PAD_BASE, NESTED_GAP, CONTAINER_BOTTOM_EXTRA, MAX_ROW_WIDTH,
} from './constants.js';

// ─── Private helpers ─────────────────────────────────────────

function expandGroupBoundsForNotes(group: LayoutGroup, notes: LayoutNode[]): void {
  for (const note of notes) {
    const nTop    = note.y - GROUP_PADDING;
    const nLeft   = note.x - GROUP_PADDING;
    const nRight  = note.x + NODE_W + GROUP_PADDING;
    const nBottom = note.y + NODE_H + GROUP_PADDING;
    if (nTop    < group.y)                  { group.height += group.y - nTop;  group.y = nTop; }
    if (nLeft   < group.x)                  { group.width  += group.x - nLeft; group.x = nLeft; }
    if (nRight  > group.x + group.width)    group.width  = nRight  - group.x;
    if (nBottom > group.y + group.height)   group.height = nBottom - group.y;
  }
}

function collectDescendantIds(rootId: string, containers: DSLContainer[]): Set<string> {
  const ids = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of containers) {
      if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) {
        ids.add(c.id);
        changed = true;
      }
    }
  }
  return ids;
}

function computeProcessTopPad(process: DSLProcess): number {
  const maxSubDepth = process.subGroups ? computeMaxSubGroupDepth(process.subGroups) : 0;
  const maxSubPad = SUB_PAD_BASE + maxSubDepth * NESTED_GAP;
  return Math.max(GROUP_PADDING, maxSubPad + GROUP_HEADER_H + GROUP_PADDING);
}

function computeInterLaneGapY(process: DSLProcess): number {
  return process.subGroups
    ? Math.max(NODE_GAP_Y, 2 * SUB_PAD_BASE + GROUP_HEADER_H + 8)
    : NODE_GAP_Y;
}

function buildSubGroupBBoxes(
  process: DSLProcess,
  processIndex: number,
  container: DSLContainer,
  allNodes: LayoutNode[],
): LayoutSubGroup[] {
  if (!process.subGroups) return [];
  const sgDepths = computeSubGroupDepths(process.subGroups);
  const sgSetsList = process.subGroups.map((sg) => new Set(sg.nodeIds));
  const result: LayoutSubGroup[] = [];

  for (let sgIdx = 0; sgIdx < process.subGroups.length; sgIdx++) {
    const subGroup = process.subGroups[sgIdx];
    const subNodes = allNodes.filter((n) => sgSetsList[sgIdx].has(n.id));
    if (subNodes.length === 0) continue;

    const negIds = new Set<string>(subNodes.map((n) => n.altNext).filter((id): id is string => !!id));
    const allSub = [...subNodes, ...allNodes.filter((n) => negIds.has(n.id))];
    const pad = SUB_PAD_BASE + sgDepths[sgIdx] * NESTED_GAP;
    const minX = Math.min(...allSub.map((n) => n.x)) - pad;
    const minY = Math.min(...allSub.map((n) => n.y)) - pad - GROUP_HEADER_H;
    const maxX = Math.max(...allSub.map((n) => n.x + NODE_W)) + pad;
    const maxY = Math.max(...allSub.map((n) => n.y + NODE_H)) + pad;

    result.push({
      id: `${container.id}_subgroup_${processIndex}_${normalizeId(subGroup.name)}`,
      label: subGroup.name,
      type: container.type,
      containerId: container.id,
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      notes: subGroup.notes,
    });
  }
  return result;
}

function layoutProcessGroup(
  process: DSLProcess,
  processIndex: number,
  container: DSLContainer,
  model: DSLModel,
  groupX: number,
  groupY: number,
  groupWidth: number,
  allNodes: LayoutNode[],
  allLinks: LayoutLink[],
  allGroups: LayoutGroup[],
  allSubGroups: LayoutSubGroup[],
  positioned: Set<string>,
): number {
  const topPad = computeProcessTopPad(process);
  const groupInnerX = groupX + GROUP_PADDING;
  const groupInnerY = groupY + GROUP_HEADER_H + topPad;
  const processNodes = getProcessNodes(process, model);
  const processNodeMap = new Map<string, import('../parser/').DSLNode>(processNodes.map((n) => [n.id, n]));
  const processPositioned = new Set<string>();
  const roots = getProcessRoots(process, processNodeMap);
  const subGroupOf = new Map<string, string>();
  if (process.subGroups) {
    for (const sg of process.subGroups) {
      for (const nid of sg.nodeIds) subGroupOf.set(nid, sg.name);
    }
  }
  const fanInTarget = detectSharedTargetFanIn(roots, processNodeMap);
  const rootSubGroup0 = subGroupOf.get(roots[0]?.id ?? '') ?? '';
  const allRootsInSameSubGroup = roots.every((r) => (subGroupOf.get(r.id) ?? '') === rootSubGroup0);

  let processBottom = groupInnerY + NODE_H;

  if (fanInTarget && allRootsInSameSubGroup) {
    processBottom = layoutFanInProcess(
      roots, fanInTarget, groupInnerX, groupInnerY, container,
      groupWidth - GROUP_PADDING * 2, model, processNodeMap,
      allNodes, allLinks, processPositioned, positioned,
    );
  } else {
    const startNodes = roots.length > 0 ? roots : processNodes;
    const interLaneGapY = computeInterLaneGapY(process);
    let laneY = groupInnerY;

    for (const startNode of startNodes) {
      if (processPositioned.has(startNode.id)) continue;
      const laneBottom = layoutChainFrom(
        startNode, groupInnerX, laneY, container, model, processNodeMap,
        allNodes, allLinks, processPositioned, positioned, subGroupOf,
      );
      processBottom = Math.max(processBottom, laneBottom);
      laneY = laneBottom + interLaneGapY;
    }

    for (const node of processNodes) {
      if (processPositioned.has(node.id)) continue;
      const laneBottom = layoutChainFrom(
        node, groupInnerX, laneY, container, model, processNodeMap,
        allNodes, allLinks, processPositioned, positioned, subGroupOf,
      );
      processBottom = Math.max(processBottom, laneBottom);
      laneY = laneBottom + interLaneGapY;
    }
  }

  const processGroupRef: LayoutGroup = {
    id: `${container.id}_group_${processIndex}`,
    label: process.name,
    type: container.type,
    containerId: container.id,
    x: groupX,
    y: groupY,
    width: groupWidth,
    height: Math.max(GROUP_HEADER_H + GROUP_PADDING * 2 + NODE_H, processBottom - groupY + GROUP_PADDING),
    notes: process.notes,
  };
  allGroups.push(processGroupRef);

  if (process.subGroups) {
    for (const sg of buildSubGroupBBoxes(process, processIndex, container, allNodes)) {
      allSubGroups.push(sg);
      const sgRight = sg.x + sg.width;
      const sgBottom = sg.y + sg.height;
      if (sgBottom + GROUP_PADDING > processGroupRef.y + processGroupRef.height)
        processGroupRef.height = sgBottom + GROUP_PADDING - processGroupRef.y;
      if (sgRight + GROUP_PADDING > processGroupRef.x + processGroupRef.width)
        processGroupRef.width = sgRight + GROUP_PADDING - processGroupRef.x;
    }
  }

  // Grow process group rightward for offset nodes that exceed its boundary.
  const maxNodeRight = processNodes.reduce((max, n) => {
    const ln = allNodes.find((a) => a.id === n.id);
    return ln ? Math.max(max, ln.x + NODE_W) : max;
  }, groupX + GROUP_PADDING);
  if (maxNodeRight + GROUP_PADDING > processGroupRef.x + processGroupRef.width)
    processGroupRef.width = maxNodeRight + GROUP_PADDING - processGroupRef.x;

  return processGroupRef.height;
}

function layoutUnpositionedNodes(
  container: DSLContainer,
  model: DSLModel,
  innerX: number,
  startY: number,
  containerW: number,
  positioned: Set<string>,
  allNodes: LayoutNode[],
): void {
  const nonProcessNodes = model.nodes.filter(
    (n) => n.containerId === container.id && n.type !== 'note' && !positioned.has(n.id),
  );
  let npX = innerX;
  let npY = startY + 10;
  for (const np of nonProcessNodes) {
    allNodes.push({ ...np, x: npX, y: npY });
    npX += NODE_W + NODE_GAP_X;
    if (npX - innerX > containerW - CONTAINER_PADDING * 2 - NODE_W) {
      npX = innerX;
      npY += NODE_H + NODE_GAP_Y;
    }
  }

  // Position notes that are truly orphaned (no parentId, no parent in allNodes).
  const orphanNotes = model.nodes.filter(
    (n) => n.containerId === container.id && n.type === 'note' && !positioned.has(n.id) && !n.parentId,
  );
  for (const note of orphanNotes) {
    allNodes.push({ ...note, x: innerX, y: npY + 10 });
  }
}

function computeContainerBounds(
  treeIds: Set<string>,
  containerId: string,
  cx: number,
  cy: number,
  containerH: number,
  containerW: number,
  allNodes: LayoutNode[],
  allGroups: LayoutGroup[],
  allSubGroups: LayoutSubGroup[],
): { width: number; height: number } {
  let maxBottom = 0;
  let maxRight = 0;
  for (const n of allNodes) {
    if (treeIds.has(n.containerId!)) {
      maxBottom = Math.max(maxBottom, n.y + NODE_H);
      maxRight = Math.max(maxRight, n.x + NODE_W);
    }
  }
  for (const g of allGroups) {
    if (g.containerId === containerId) {
      maxBottom = Math.max(maxBottom, g.y + g.height);
      maxRight = Math.max(maxRight, g.x + g.width);
    }
  }
  for (const sg of allSubGroups) {
    if (sg.containerId === containerId) {
      maxBottom = Math.max(maxBottom, sg.y + sg.height);
      maxRight = Math.max(maxRight, sg.x + sg.width);
    }
  }
  return {
    height: Math.max(containerH, maxBottom - cy + CONTAINER_PADDING + CONTAINER_BOTTOM_EXTRA),
    width: Math.max(containerW, maxRight - cx + CONTAINER_PADDING),
  };
}

// ─── Orchestrator ────────────────────────────────────────────

export function computeLayout(model: DSLModel): LayoutResult {
  const allNodes: LayoutNode[] = [];
  const allContainers: LayoutContainer[] = [];
  const allGroups: LayoutGroup[] = [];
  const allSubGroups: LayoutSubGroup[] = [];
  const allLinks: LayoutLink[] = [];
  let x = 0;
  let y = 0;
  let rowBottom = 0;

  // Render top-level containers only — nested child containers are rendered inside
  // their parent's synthetic process instead.
  for (const container of model.containers) {
    if (container.parentId !== null) continue;
    const containerW = computeContainerWidth(container, model);
    const containerH = computeContainerHeight(container, model);

    if (x > 0 && x + containerW > (CONTAINER_GAP_X * 2 + MAX_ROW_WIDTH)) {
      x = 0;
      y = rowBottom + CONTAINER_GAP_Y;
    }

    const cx = x;
    const cy = y;
    const containerRef: LayoutContainer = { ...container, x: cx, y: cy, width: containerW, height: containerH, notes: container.notes };
    allContainers.push(containerRef);

    const innerX = cx + CONTAINER_PADDING;
    const innerY = cy + CONTAINER_HEADER_H + CONTAINER_PADDING;
    const positioned = new Set<string>();
    let processY = innerY;

    container.processes.forEach((process, processIndex) => {
      const groupX = innerX;
      const groupY = processY;
      const groupWidth = containerW - CONTAINER_PADDING * 2;
      const groupHeight = layoutProcessGroup(
        process, processIndex, container, model,
        groupX, groupY, groupWidth,
        allNodes, allLinks, allGroups, allSubGroups, positioned,
      );
      processY = groupY + groupHeight + GROUP_GAP_Y;
    });

    layoutUnpositionedNodes(container, model, innerX, processY, containerW, positioned, allNodes);

    const treeIds = collectDescendantIds(container.id, model.containers);

    // Position notes for this container tree before computing bounds, then create their links.
    for (const note of model.nodes) {
      if (!treeIds.has(note.containerId!) || note.type !== 'note' || !note.parentId) continue;
      if (allNodes.some((n) => n.id === note.id)) continue;
      const parent = allNodes.find((n) => n.id === note.parentId!);
      if (!parent) continue;
      const noteX = note.noteX ?? 0;
      const noteY = note.noteY ?? -1;
      allNodes.push({ ...note, x: parent.x + noteX * (NODE_W + NODE_GAP_X), y: parent.y - noteY * (NODE_H + NODE_GAP_Y) });
      allLinks.push({ source: note.id, target: note.parentId!, label: '', type: 'default', noteX: note.noteX, noteY: note.noteY });
    }

    // Correct top/left overflow: shift all container tree contents down/right if notes extend outside.
    const containerNotes = allNodes.filter((n) => treeIds.has(n.containerId!) && n.type === 'note');
    if (containerNotes.length > 0) {
      const minNoteY = Math.min(...containerNotes.map((n) => n.y));
      const minNoteX = Math.min(...containerNotes.map((n) => n.x));
      const topOverflow  = Math.max(0, (cy + CONTAINER_HEADER_H + CONTAINER_PADDING) - minNoteY);
      const leftOverflow = Math.max(0, (cx + CONTAINER_PADDING) - minNoteX);
      if (topOverflow > 0 || leftOverflow > 0) {
        for (const n of allNodes)      { if (treeIds.has(n.containerId!))    { n.y += topOverflow; n.x += leftOverflow; } }
        for (const g of allGroups)     { if (g.containerId === container.id) { g.y += topOverflow; g.x += leftOverflow; } }
        for (const sg of allSubGroups) { if (sg.containerId === container.id){ sg.y += topOverflow; sg.x += leftOverflow; } }
        containerRef.height += topOverflow;
        containerRef.width  += leftOverflow;
      }
    }

    // Expand each process group to include notes attached to its nodes.
    container.processes.forEach((process, processIndex) => {
      const group = allGroups.find((g) => g.id === `${container.id}_group_${processIndex}`);
      if (!group) return;
      const stepIdSet = new Set(process.stepIds);
      const groupNotes = allNodes.filter((n) => n.type === 'note' && n.parentId && stepIdSet.has(n.parentId));
      expandGroupBoundsForNotes(group, groupNotes);
    });

    const bounds = computeContainerBounds(
      treeIds, container.id, cx, cy, containerRef.height, containerRef.width, allNodes, allGroups, allSubGroups,
    );
    containerRef.width = bounds.width;
    containerRef.height = bounds.height;
    rowBottom = Math.max(rowBottom, cy + bounds.height);
    x += bounds.width + CONTAINER_GAP_X;
  }

  const standaloneNodes = model.nodes.filter((n) => !n.containerId);
  if (standaloneNodes.length > 0) {
    const startY = y > 0 ? y + CONTAINER_GAP_Y : 0;
    layoutStandaloneNodes(standaloneNodes as LayoutNode[], allNodes, 0, startY);
  }

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

  return { width: totalWidth, height: totalHeight, containers: allContainers, groups: allGroups, subGroups: allSubGroups, nodes: allNodes, links: allLinks };
}
