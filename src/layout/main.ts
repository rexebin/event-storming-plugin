/**
 * Event Storming — Main layout orchestrator.
 */

import { DSLModel, DSLContainer, DSLProcess, normalizeId } from '../parser/';
import type { LayoutNode, LayoutContainer, LayoutGroup, LayoutSubGroup, LayoutLink, LayoutResult } from './models.js';
import { getProcessNodes, getProcessRoots, detectSharedTargetFanIn } from './helpers.js';
import { computeSubGroupDepths, computeMaxSubGroupDepth, layoutChainFrom } from './chains.js';
import { layoutFanInProcess } from './fan-in.js';

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
      model, processNodeMap,
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

  const maxNodeRight = processNodes.reduce((max, n) => {
    const ln = allNodes.find((a) => a.id === n.id);
    return ln ? Math.max(max, ln.x + NODE_W) : max;
  }, groupInnerX);
  const initialGroupWidth = maxNodeRight + GROUP_PADDING - groupX;

  const processGroupRef: LayoutGroup = {
    id: `${container.id}_group_${processIndex}`,
    label: process.name,
    type: container.type,
    containerId: container.id,
    x: groupX,
    y: groupY,
    width: initialGroupWidth,
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

  return processGroupRef.height;
}

const UNPOSITIONED_GRID_COLS = 4;

function layoutUnpositionedNodes(
  container: DSLContainer,
  model: DSLModel,
  innerX: number,
  startY: number,
  positioned: Set<string>,
  allNodes: LayoutNode[],
): void {
  const nonProcessNodes = model.nodes.filter(
    (n) => n.containerId === container.id && n.type !== 'note' && !positioned.has(n.id),
  );
  let col = 0;
  let npX = innerX;
  let npY = startY + 10;
  for (const np of nonProcessNodes) {
    allNodes.push({ ...np, x: npX, y: npY });
    col++;
    if (col >= UNPOSITIONED_GRID_COLS) {
      col = 0;
      npX = innerX;
      npY += NODE_H + NODE_GAP_Y;
    } else {
      npX += NODE_W + NODE_GAP_X;
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

// ─── Orchestrator ────────────────────────────────────────────

export function computeLayout(model: DSLModel): LayoutResult {
  const allNodes: LayoutNode[] = [];
  const allContainers: LayoutContainer[] = [];
  const allGroups: LayoutGroup[] = [];
  const allSubGroups: LayoutSubGroup[] = [];
  const allLinks: LayoutLink[] = [];

  type PendingContainer = {
    containerRef: LayoutContainer;
    treeIds: Set<string>;
    nodeIndices: number[];
    groupIndices: number[];
    subGroupIndices: number[];
  };
  const pending: PendingContainer[] = [];

  // Phase 1+2: layout each top-level container at origin (0,0), then compute real size from bounding box.
  for (const container of model.containers) {
    if (container.parentId !== null) continue;

    const treeIds = collectDescendantIds(container.id, model.containers);
    const nodesBefore = allNodes.length;
    const groupsBefore = allGroups.length;
    const subGroupsBefore = allSubGroups.length;

    const innerX = CONTAINER_PADDING;
    const innerY = CONTAINER_HEADER_H + CONTAINER_PADDING;
    const positioned = new Set<string>();
    let processY = innerY;

    container.processes.forEach((process, processIndex) => {
      const groupHeight = layoutProcessGroup(
        process, processIndex, container, model,
        innerX, processY,
        allNodes, allLinks, allGroups, allSubGroups, positioned,
      );
      processY += groupHeight + GROUP_GAP_Y;
    });

    layoutUnpositionedNodes(container, model, innerX, processY, positioned, allNodes);

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

    // Compute bounding box over all content for this container tree.
    let minX = innerX;
    let minY = innerY;
    let maxRight = 0;
    let maxBottom = 0;
    for (const n of allNodes.slice(nodesBefore)) {
      if (!treeIds.has(n.containerId!)) continue;
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxRight = Math.max(maxRight, n.x + NODE_W);
      maxBottom = Math.max(maxBottom, n.y + NODE_H);
    }
    for (const g of allGroups.slice(groupsBefore)) {
      if (g.containerId !== container.id) continue;
      minX = Math.min(minX, g.x);
      minY = Math.min(minY, g.y);
      maxRight = Math.max(maxRight, g.x + g.width);
      maxBottom = Math.max(maxBottom, g.y + g.height);
    }
    for (const sg of allSubGroups.slice(subGroupsBefore)) {
      if (sg.containerId !== container.id) continue;
      maxRight = Math.max(maxRight, sg.x + sg.width);
      maxBottom = Math.max(maxBottom, sg.y + sg.height);
    }

    // Shift content if notes overflow the container's left/top boundary.
    const overflowLeft = Math.max(0, CONTAINER_PADDING - minX);
    const overflowTop  = Math.max(0, innerY - minY);
    if (overflowLeft > 0 || overflowTop > 0) {
      for (const n of allNodes)      { if (treeIds.has(n.containerId!))     { n.x += overflowLeft; n.y += overflowTop; } }
      for (const g of allGroups)     { if (g.containerId === container.id)  { g.x += overflowLeft; g.y += overflowTop; } }
      for (const sg of allSubGroups) { if (sg.containerId === container.id) { sg.x += overflowLeft; sg.y += overflowTop; } }
      maxRight  += overflowLeft;
      maxBottom += overflowTop;
    }

    // Expand each process group to include notes attached to its nodes.
    container.processes.forEach((process, processIndex) => {
      const group = allGroups.find((g) => g.id === `${container.id}_group_${processIndex}`);
      if (!group) return;
      const stepIdSet = new Set(process.stepIds);
      const groupNotes = allNodes.filter((n) => n.type === 'note' && n.parentId && stepIdSet.has(n.parentId));
      expandGroupBoundsForNotes(group, groupNotes);
    });

    // A note can pull its owning group's top edge upward (to fit above its parent node),
    // which may push it into the group positioned right before it. Cascade a downward
    // shift through that group — and every group after it — so groups never overlap.
    let cascadeShift = 0;
    let prevGroupBottom: number | null = null;
    container.processes.forEach((process, processIndex) => {
      const group = allGroups.find((g) => g.id === `${container.id}_group_${processIndex}`);
      if (!group) return;

      const unshiftedTop = group.y + cascadeShift;
      const overlap = prevGroupBottom !== null ? Math.max(0, prevGroupBottom + GROUP_GAP_Y - unshiftedTop) : 0;
      const shiftAmount = cascadeShift + overlap;

      if (shiftAmount > 0) {
        const idsToShift = new Set(process.stepIds);
        for (const n of allNodes) {
          if (n.type === 'note' && n.parentId && idsToShift.has(n.parentId)) idsToShift.add(n.id);
        }
        for (const n of allNodes) { if (idsToShift.has(n.id)) n.y += shiftAmount; }
        group.y += shiftAmount;
        for (const sg of allSubGroups) {
          if (sg.id.startsWith(`${container.id}_subgroup_${processIndex}_`)) sg.y += shiftAmount;
        }
      }

      cascadeShift = shiftAmount;
      prevGroupBottom = group.y + group.height;
    });

    // Re-derive the outer bounds now that note expansion/cascading may have grown or moved content.
    for (const n of allNodes.slice(nodesBefore)) {
      if (!treeIds.has(n.containerId!)) continue;
      maxRight = Math.max(maxRight, n.x + NODE_W);
      maxBottom = Math.max(maxBottom, n.y + NODE_H);
    }
    for (const g of allGroups.slice(groupsBefore)) {
      if (g.containerId !== container.id) continue;
      maxRight = Math.max(maxRight, g.x + g.width);
      maxBottom = Math.max(maxBottom, g.y + g.height);
    }
    for (const sg of allSubGroups.slice(subGroupsBefore)) {
      if (sg.containerId !== container.id) continue;
      maxRight = Math.max(maxRight, sg.x + sg.width);
      maxBottom = Math.max(maxBottom, sg.y + sg.height);
    }

    const width  = maxRight  + CONTAINER_PADDING;
    const height = maxBottom + CONTAINER_PADDING + CONTAINER_BOTTOM_EXTRA;

    const containerRef: LayoutContainer = { ...container, x: 0, y: 0, width, height, notes: container.notes };
    allContainers.push(containerRef);

    pending.push({
      containerRef,
      treeIds,
      nodeIndices:     allNodes.reduce<number[]>((acc, n, i)   => { if (i >= nodesBefore      && treeIds.has(n.containerId!))     acc.push(i); return acc; }, []),
      groupIndices:    allGroups.reduce<number[]>((acc, g, i)  => { if (i >= groupsBefore     && g.containerId === container.id)  acc.push(i); return acc; }, []),
      subGroupIndices: allSubGroups.reduce<number[]>((acc, sg, i) => { if (i >= subGroupsBefore && sg.containerId === container.id) acc.push(i); return acc; }, []),
    });
  }

  // Phase 3: pack containers into rows and translate content to absolute positions.
  let x = 0;
  let y = 0;
  let rowBottom = 0;

  for (const { containerRef, nodeIndices, groupIndices, subGroupIndices } of pending) {
    if (x > 0 && x + containerRef.width > CONTAINER_GAP_X * 2 + MAX_ROW_WIDTH) {
      x = 0;
      y = rowBottom + CONTAINER_GAP_Y;
    }
    const cx = x;
    const cy = y;
    containerRef.x = cx;
    containerRef.y = cy;
    for (const i of nodeIndices)     { allNodes[i].x     += cx; allNodes[i].y     += cy; }
    for (const i of groupIndices)    { allGroups[i].x    += cx; allGroups[i].y    += cy; }
    for (const i of subGroupIndices) { allSubGroups[i].x += cx; allSubGroups[i].y += cy; }
    rowBottom = Math.max(rowBottom, cy + containerRef.height);
    x += containerRef.width + CONTAINER_GAP_X;
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
