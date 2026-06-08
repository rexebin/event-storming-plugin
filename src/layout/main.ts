/**
 * Event Storming — Main layout orchestrator.
 */

import { DSLModel, normalizeId } from '../parser/';
import type { LayoutNode, LayoutContainer, LayoutGroup, LayoutSubGroup, LayoutLink } from './models.js';
import { getProcessNodes, getProcessRoots, detectSharedTargetFanIn, placeProcessNode } from './helpers.js';
import { computeSubGroupDepths, computeMaxSubGroupDepth, layoutAltBranch, layoutChainFrom } from './chains.js';
import { layoutFanInProcess, computeProcessColumns } from './fan-in.js';
import { computeContainerWidth, computeContainerHeight } from './sizing.js';
import { layoutStandaloneNodes } from './standalone.js';
import {
  NODE_W, NODE_H, NODE_GAP_X, NODE_GAP_Y,
  CONTAINER_PADDING, CONTAINER_HEADER_H, CONTAINER_GAP_X, CONTAINER_GAP_Y,
  GROUP_PADDING, GROUP_HEADER_H, GROUP_GAP_Y, SUB_GROUP_GAP_X,
} from './constants.js';

const SUB_PAD_BASE_PRE = 8;
const NESTED_GAP_PRE = 14;
const SUB_PAD_BASE = 8;
const NESTED_GAP = 14;

export function computeLayout(model: DSLModel): import('./models.js').LayoutResult {
  const allNodes: LayoutNode[] = [];
  const allContainers: LayoutContainer[] = [];
  const allGroups: LayoutGroup[] = [];
  const allSubGroups: LayoutSubGroup[] = [];
  const allLinks: LayoutLink[] = [];
  let x = 0;
  let y = 0;
  let rowBottom = 0;

    // 1. Render top-level containers only — skip nested child containers (parentId !== null).
    // Nested containers are rendered inside their parent's synthetic process instead.
  for (const container of model.containers) {
    if (container.parentId !== null) continue;
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
       const processNodeMap = new Map<string, import('../parser/').DSLNode>(processNodes.map((node) => [node.id, node]));
       const processPositioned = new Set<string>();
       const roots = getProcessRoots(process, processNodeMap);
       const subGroupOf = new Map<string, string>();
       if (process.subGroups) {
         for (const sg of process.subGroups) {
           for (const nid of sg.nodeIds) subGroupOf.set(nid, sg.name);
            }
            }
       const fanInTarget = detectSharedTargetFanIn(roots, processNodeMap);
       // Suppress fan-in when roots come from different sub-containers: cross-subGroup
       // "next" references are intentional flow links, not a fan-in pattern, and merging
       // them causes subGroup bounding boxes to overlap.
       const rootSubGroup0 = subGroupOf.get(roots[0]?.id ?? '') ?? '';
       const allRootsInSameSubGroup = roots.every(r => (subGroupOf.get(r.id) ?? '') === rootSubGroup0);
       let processBottom = groupInnerY + NODE_H;

       if (fanInTarget && allRootsInSameSubGroup) {
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
        type: container.type,
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
        const sgDepths = computeSubGroupDepths(process.subGroups);
        const sgSetsList = process.subGroups.map((sg) => new Set(sg.nodeIds));
        for (let sgIdx = 0; sgIdx < process.subGroups.length; sgIdx++) {
          const subGroup = process.subGroups[sgIdx];
          const sgSets = sgSetsList[sgIdx];
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
          const minX = Math.min(...allSub.map((n) => n.x)) - (SUB_PAD_BASE + sgDepths[sgIdx] * NESTED_GAP);
          const minY = Math.min(...allSub.map((n) => n.y)) - (SUB_PAD_BASE + sgDepths[sgIdx] * NESTED_GAP) - GROUP_HEADER_H;
          const maxX = Math.max(...allSub.map((n) => n.x + NODE_W)) + (SUB_PAD_BASE + sgDepths[sgIdx] * NESTED_GAP);
          const maxY = Math.max(...allSub.map((n) => n.y + NODE_H)) + (SUB_PAD_BASE + sgDepths[sgIdx] * NESTED_GAP);
          allSubGroups.push({
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

          // Grow the process group rightward for any nodes that exceed its boundary (e.g. offset).
          const maxNodeRightInProcess = processNodes.reduce((max, n) => {
            const layoutNode = allNodes.find((a) => a.id === n.id);
            return layoutNode ? Math.max(max, layoutNode.x + NODE_W) : max;
           }, groupX + GROUP_PADDING);
          if (maxNodeRightInProcess + GROUP_PADDING > processGroupRef.x + processGroupRef.width) {
            processGroupRef.width = maxNodeRightInProcess + GROUP_PADDING - processGroupRef.x;
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
       if (n.containerId === container.id) {
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
