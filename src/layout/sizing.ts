/**
 * Event Storming — Container sizing.
 */

import type { DSLModel } from '../parser/';
import type { DSLContainer } from '../parser/';
import { DSLNode } from '../parser/';
import { getProcessNodes, getProcessRoots, detectSharedTargetFanIn } from './helpers.js';
import { computeProcessColumns, computeFanInProcessColumns } from './fan-in.js';
import { computeMaxSubGroupDepth } from './chains.js';
import { NODE_W, NODE_GAP_X, CONTAINER_PADDING, GROUP_PADDING, SUB_GROUP_GAP_X, NODE_H, NODE_GAP_Y, CONTAINER_HEADER_H, NESTED_GAP } from './constants.js';

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
       : computeProcessColumns(startNodes as import('./models.js').LayoutNode[], processNodeMap);
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

      w += computeMaxSubGroupDepth(proc.subGroups) * NESTED_GAP * 2;
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
  const negativeOffsetRows = container.processes.reduce((total, process) => {
    const shift = process.stepIds
      .map(id => model.nodes.find(n => n.id === id)?.offset ?? 0)
      .filter(o => o < 0)
      .reduce((sum, o) => sum + Math.abs(o), 0);
    return total + shift;
  }, 0);
  return CONTAINER_HEADER_H + CONTAINER_PADDING * 2 +
     (processRows + nonProcessRows + negativeOffsetRows) * (NODE_H + NODE_GAP_Y) + 10;
}
