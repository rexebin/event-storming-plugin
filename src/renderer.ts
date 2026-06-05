/**
 * Event Storming — D3.js Renderer
 * Renders a parsed DSL model as an interactive SVG diagram.
 */

import { parseDSL, normalizeId, DSLModel, DSLNode, DSLContainer, DSLProcess, NodeType } from './dsl.js';
import * as d3 from 'd3';

// ─── Layout interfaces ─────────────────────────────────────

interface LayoutNode extends DSLNode {
  x: number;
  y: number;
}

interface LayoutContainer {
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

interface LayoutGroup {
  id: string;
  label: string;
  containerId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  notes?: string[];
}

interface LayoutSubGroup {
  id: string;
  label: string;
  containerId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  notes?: string[];
}

interface LayoutResult {
  width: number;
  height: number;
  containers: LayoutContainer[];
  groups: LayoutGroup[];
  subGroups: LayoutSubGroup[];
  nodes: LayoutNode[];
  links: LayoutLink[];
}

interface LayoutLink {
  source: string;
  target: string;
  label: string;
  type: string;
}

// ─── Constants ──────────────────────────────────────────────

const NODE_W = 130;
const NODE_H = 120;
const NODE_FOLD = 16;
const NODE_GAP_X = 36;
const NODE_GAP_Y = 22;
const CONTAINER_PADDING = 24;
const CONTAINER_HEADER_H = 32;
const CONTAINER_GAP_X = 60;
const CONTAINER_GAP_Y = 80;
const PADDING_X = 40;
const PADDING_Y = 30;
const LINK_COLOR = '#6a737d';
const GROUP_PADDING = 16;
const GROUP_HEADER_H = 22;
const GROUP_GAP_Y = 18;
const SUB_GROUP_GAP_X = 24;

// ─── Main render function ───────────────────────────────────

export function renderEventStorming(
  container: any,
  dslText: string
): { svg: any; model: DSLModel; destroy: () => void } {
  const model = parseDSL(dslText);
  const layout = computeLayout(model);

  const svgWidth = layout.width + PADDING_X * 2;
  const svgHeight = layout.height + PADDING_Y * 2;

  // Create the SVG
  const svg = container
    .append('svg')
    .attr('width', svgWidth)
    .attr('height', svgHeight)
    .attr('viewBox', `0 0 ${svgWidth} ${svgHeight}`);

  // Defs for arrow markers
  const defs = svg.append('defs');

  // Drop shadow for post-it nodes
  const shadowFilter = defs.append('filter')
    .attr('id', 'node-shadow')
    .attr('x', '-20%')
    .attr('y', '-20%')
    .attr('width', '150%')
    .attr('height', '150%');
  shadowFilter.append('feDropShadow')
    .attr('dx', 2)
    .attr('dy', 3)
    .attr('stdDeviation', 3)
    .attr('flood-color', 'rgba(0,0,0,0.22)');

  // Shared arrow marker
  defs.append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '0 0 10 6')
    .attr('refX', 10)
    .attr('refY', 3)
    .attr('markerWidth', 8)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M 0 0 L 10 3 L 0 6 Z')
    .attr('fill', LINK_COLOR);

  // ─── Draw containers (aggregate / readModel boxes) ───

  const containersGroup = svg.append('g').attr('class', 'containers');
  const tooltip = d3.select('body').append('div').attr('class', 'es-tooltip').style('display', 'none');

  layout.containers.forEach((c) => {
    const g = containersGroup.append('g')
      .attr('transform', `translate(${c.x}, ${c.y})`)
      .attr('data-id', c.id)
      .attr('data-name', c.label);

    // Container background
    g.append('rect')
      .attr('width', c.width)
      .attr('height', c.height)
      .attr('rx', 8)
      .attr('fill', '#fafbfc')
      .attr('stroke', c.color)
      .attr('stroke-width', 3);

    // Container header (colored band)
    g.append('rect')
      .attr('width', c.width)
      .attr('height', CONTAINER_HEADER_H)
      .attr('rx', 8)
      .attr('fill', c.color);

    // Clip bottom corners of header (so only top corners are rounded)
    g.append('rect')
      .attr('x', 0)
      .attr('y', CONTAINER_HEADER_H - 8)
      .attr('width', c.width)
      .attr('height', 8)
      .attr('fill', c.color);

    // Container title
    g.append('text')
      .attr('x', 12)
      .attr('y', CONTAINER_HEADER_H - 10)
      .attr('font-size', '13px')
      .attr('font-weight', '700')
      .attr('fill', isLight(c.color) ? '#333' : '#fff')
      .text(`${c.type === 'aggregate' ? '📦' : c.type === 'readModel' ? '📊' : c.type === 'externalSystem' ? '🔌' : '🔄'} ${c.label}`);

    if (c.notes && c.notes.length > 0) {
      appendNotesBadge(g, c.width - 14, 12, c.notes, tooltip, 'es-container-note-badge');
    }
  });

  const groupsGroup = svg.append('g').attr('class', 'groups');

  layout.groups.forEach((group) => {
    const g = groupsGroup
      .append('g')
      .attr('class', 'es-process-group')
      .attr('transform', `translate(${group.x}, ${group.y})`)
      .attr('data-id', group.id)
      .attr('data-container-id', group.containerId)
      .attr('data-name', group.label);

    g.append('rect')
      .attr('width', group.width)
      .attr('height', group.height)
      .attr('rx', 6)
      .attr('fill', '#ffffff')
      .attr('fill-opacity', 0.55)
      .attr('stroke', '#d0d7de')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '6 4');

    g.append('text')
      .attr('x', 12)
      .attr('y', 16)
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .attr('fill', '#57606a')
      .text(group.label);

    if (group.notes && group.notes.length > 0) {
      appendNotesBadge(g, group.width - 14, 12, group.notes, tooltip, 'es-group-note-badge');
    }
  });

  // ─── Draw sub-groups (inline nested containers) ───

  const subGroupsGroup = svg.append('g').attr('class', 'sub-groups');

  layout.subGroups.forEach((sg) => {
    const g = subGroupsGroup
      .append('g')
      .attr('class', 'es-sub-group')
      .attr('transform', `translate(${sg.x}, ${sg.y})`)
      .attr('data-name', sg.label);

    g.append('rect')
      .attr('width', sg.width)
      .attr('height', sg.height)
      .attr('rx', 4)
      .attr('fill', '#f0f4ff')
      .attr('fill-opacity', 0.7)
      .attr('stroke', '#a8b8d8')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4 3');

    g.append('text')
      .attr('x', 10)
      .attr('y', GROUP_HEADER_H - 6)
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('fill', '#7a8aaa')
      .text(sg.label);

    if (sg.notes && sg.notes.length > 0) {
      appendNotesBadge(g, sg.width - 14, 10, sg.notes, tooltip, 'es-group-note-badge');
    }
  });

  // ─── Draw nodes ───

  const nodesGroup = svg.append('g').attr('class', 'nodes');

  layout.nodes.forEach((node) => {
    const nodeNotes = getNodeNotes(node, model);
    const g = nodesGroup
      .append('g')
      .attr('class', 'es-node')
      .attr('transform', `translate(${node.x}, ${node.y})`)
      .attr('data-id', node.id)
      .on('mouseover', function (this: Element) {
        d3.select(this).raise();
      });

    // Post-it note shape: pentagon with folded lower-right corner
    const bodyPoints = `0,0 ${NODE_W},0 ${NODE_W},${NODE_H - NODE_FOLD} ${NODE_W - NODE_FOLD},${NODE_H} 0,${NODE_H}`;
    g.append('polygon')
      .attr('points', bodyPoints)
      .attr('fill', node.color)
      .attr('filter', 'url(#node-shadow)');

    // Fold shadow triangle at the cut corner
    const foldPoints = `${NODE_W - NODE_FOLD},${NODE_H - NODE_FOLD} ${NODE_W},${NODE_H - NODE_FOLD} ${NODE_W - NODE_FOLD},${NODE_H}`;
    g.append('polygon')
      .attr('points', foldPoints)
      .attr('fill', 'rgba(0,0,0,0.18)');

    if (nodeNotes.length > 0) {
      const badge = g
        .append('g')
        .attr('class', 'es-note-badge')
        .attr('transform', `translate(${NODE_W - 12}, 12)`);

      badge
        .append('circle')
        .attr('r', 6)
        .attr('fill', '#FFF1AA')
        .attr('stroke', '#333')
        .attr('stroke-width', 1);

      badge
        .append('text')
        .attr('x', 0)
        .attr('y', 0.5)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '7px')
        .attr('font-weight', '700')
        .attr('fill', '#333')
        .attr('pointer-events', 'none')
        .text('i');
    }

    // Type badge (small label in corner)
    if (node.type !== 'note') {
      g.append('text')
        .attr('x', 6)
        .attr('y', -4)
        .attr('font-size', '8px')
        .attr('font-weight', '600')
        .attr('fill', '#666')
        .text(node.type);
    }

    // Text label (centered, multi-line if needed)
    const textGroup = g
      .append('text')
      .attr('x', NODE_W / 2)
      .attr('y', NODE_H / 2 + 1)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', node.type === 'note' ? '11px' : '13px')
      .attr('font-style', node.type === 'note' ? 'italic' : 'normal')
      .attr('font-weight', node.type === 'note' ? '400' : '500')
      .attr('fill', isLight(node.color) ? '#333' : '#fff')
      .attr('pointer-events', 'none');

    wrapText(textGroup, node.label, NODE_W - 16, NODE_H);
  });

  // ─── Draw links (on top of nodes so arrowheads are visible) ───

  const linksGroup = svg.append('g').attr('class', 'links');

  layout.links.forEach((link) => {
  const source = layout.nodes.find((n) => n.id === link.source);
  const target = layout.nodes.find((n) => n.id === link.target);
  if (!source || !target) return;

  const pathD = computeLinkPath(source, target, link.type, link.label === 'no');

  linksGroup
    .append('path')
    .attr('class', `es-link es-link-${link.type}`)
    .attr('data-source', link.source)
    .attr('data-target', link.target)
    .attr('d', pathD)
    .attr('fill', 'none')
    .attr('stroke', LINK_COLOR)
    .attr('stroke-width', 1.5)
    .attr('marker-end', 'url(#arrowhead)');

  // Link label
  if (link.label) {
    const labelPosition = getLinkLabelPosition(pathD, link);
    linksGroup
      .append('text')
      .attr('x', labelPosition.x)
      .attr('y', labelPosition.y)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', '#586069')
      .attr('font-style', 'italic')
      .text(link.label);
  }
  });

  // ─── Zoom & Pan ───

  const zoom = d3
    .zoom()
    .scaleExtent([0.3, 2])
    .on('zoom', (event: any) => {
      const t = (event.transform as any).toString();
      nodesGroup.attr('transform', t);
      linksGroup.attr('transform', t);
      containersGroup.attr('transform', t);
      groupsGroup.attr('transform', t);
      subGroupsGroup.attr('transform', t);
    });

  (svg as any).call(zoom);

  // ─── Tooltip ───

  nodesGroup
    .selectAll('.es-node')
    .on('mouseenter', function (this: Element, event: MouseEvent) {
      const g = d3.select(this);
      const id: string = g.attr('data-id') || '';
      const node = layout.nodes.find((n) => n.id === id);
      if (!node) return;
      const nodeNotes = getNodeNotes(node, model);
      const notesHtml = nodeNotes.length > 0
        ? `<div class="es-tooltip-notes"><div class="es-tooltip-notes-label">Notes</div><ul>${
            nodeNotes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')
          }</ul></div>`
        : '';
      const html = `<div class="es-tooltip-title">${escapeHtml(node.label)}</div>`
        + `<div class="es-tooltip-type">${formatNodeType(node.type)}</div>`
        + notesHtml;

      tooltip
        .style('display', 'block')
        .html(html)
        .style('left', (event.pageX + 12) + 'px')
        .style('top', (event.pageY - 10) + 'px');
    })
    .on('mousemove', function (event: MouseEvent) {
      tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 10) + 'px');
    })
    .on('mouseleave', function () {
      tooltip.style('display', 'none');
    });

  const destroy = () => {
    tooltip.remove();
  };

  return { svg, model, destroy };
}

// ─── Layout Computation ─────────────────────────────────────

function computeLayout(model: DSLModel): LayoutResult {
  const allNodes: LayoutNode[] = [];
  const allContainers: LayoutContainer[] = [];
  const allGroups: LayoutGroup[] = [];
  const allSubGroups: LayoutSubGroup[] = [];
  const allLinks: LayoutLink[] = [];
  let x = PADDING_X;
  let y = PADDING_Y;
  let rowBottom = PADDING_Y;

  // 1. Render containers (aggregates + readModels + processes)
  for (const container of model.containers) {
    const containerW = computeContainerWidth(container, model);
    const containerH = computeContainerHeight(container, model);

    if (x > PADDING_X && x + containerW > (PADDING_X * 2 + 1200)) {
      x = PADDING_X;
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
       // still sits inside the process group.
       const SUB_PAD_BASE_PRE = 8;
       const NESTED_GAP_PRE = 14;
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
        const SUB_PAD_BASE = 8;
        const NESTED_GAP = 14;

        // Compute nesting depth from below: max depth of any sub-group strictly contained in this one + 1.
        // Used to inflate outer sub-group padding so its border sits clear of nested sub-group borders.
        const sgList = process.subGroups;
        const sgSets = sgList.map((sg) => new Set(sg.nodeIds));
        const isStrictSubset = (a: Set<string>, b: Set<string>): boolean => {
          if (a.size >= b.size) return false;
          for (const id of a) if (!b.has(id)) return false;
          return true;
        };
        const depthBelow = new Array<number>(sgList.length).fill(0);
        // Order by size ascending so child depths are known before parents.
        const order = sgList.map((_, i) => i).sort((a, b) => sgSets[a].size - sgSets[b].size);
        for (const i of order) {
          let maxChildDepth = -1;
          for (const j of order) {
            if (i === j) continue;
            if (isStrictSubset(sgSets[j], sgSets[i])) {
              maxChildDepth = Math.max(maxChildDepth, depthBelow[j]);
            }
          }
          depthBelow[i] = maxChildDepth + 1;
        }

        for (let sgIdx = 0; sgIdx < sgList.length; sgIdx++) {
          const subGroup = sgList[sgIdx];
          const SUB_PAD = SUB_PAD_BASE + depthBelow[sgIdx] * NESTED_GAP;
          const subNodeIdSet = sgSets[sgIdx];
          const subNodes = allNodes.filter((n) => subNodeIdSet.has(n.id));
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
          const minX = Math.min(...allSub.map((n) => n.x)) - SUB_PAD;
          const minY = Math.min(...allSub.map((n) => n.y)) - SUB_PAD - GROUP_HEADER_H;
          const maxX = Math.max(...allSub.map((n) => n.x + NODE_W)) + SUB_PAD;
          const maxY = Math.max(...allSub.map((n) => n.y + NODE_H)) + SUB_PAD;
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
    const containerNodes = allNodes.filter((n) => n.containerId === container.id || (n as any)._cx !== undefined);
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
    const startY = y > PADDING_Y ? y + CONTAINER_GAP_Y : PADDING_Y;
    layoutStandaloneNodes(standaloneNodes, allNodes, PADDING_X, startY);
  }

  // Compute total dimensions
  let totalWidth = 0;
  let totalHeight = 0;
  for (const n of allNodes) {
    totalWidth = Math.max(totalWidth, n.x + NODE_W + PADDING_X);
    totalHeight = Math.max(totalHeight, n.y + NODE_H + PADDING_Y);
  }
  for (const c of allContainers) {
    totalWidth = Math.max(totalWidth, c.x + c.width + PADDING_X);
    totalHeight = Math.max(totalHeight, c.y + c.height + PADDING_Y);
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

function getProcessNodes(process: DSLProcess, model: DSLModel): DSLNode[] {
  return process.stepIds
    .map((id) => model.nodes.find((node) => node.id === id))
    .filter((node): node is DSLNode => !!node);
}

function getProcessRoots(process: DSLProcess, processNodeMap: Map<string, DSLNode>): DSLNode[] {
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

function detectSharedTargetFanIn(roots: DSLNode[], processNodeMap: Map<string, DSLNode>): DSLNode | null {
  if (roots.length <= 1) return null;

  const targetIds = roots.map((node) => node.next).filter((id): id is string => !!id && processNodeMap.has(id));
  if (targetIds.length !== roots.length) return null;

  const sharedTargetId = targetIds[0];
  if (targetIds.some((targetId) => targetId !== sharedTargetId)) return null;

  return processNodeMap.get(sharedTargetId) || null;
}

function placeProcessNode(
  node: DSLNode,
  x: number,
  y: number,
  containerId: string,
  allNodes: LayoutNode[],
  processPositioned: Set<string>,
  positioned: Set<string>
): void {
  if (processPositioned.has(node.id)) return;

  allNodes.push({
    ...node,
    x,
    y,
    containerId,
  });
  processPositioned.add(node.id);
  positioned.add(node.id);
}

function getOrCreateNegativeNode(
  node: DSLNode,
  container: DSLContainer,
  model: DSLModel,
  processNodeMap: Map<string, DSLNode>
): DSLNode {
  if (node.altNext && processNodeMap.has(node.altNext)) {
    return processNodeMap.get(node.altNext)!;
  }

  const errorId = `error_default_${node.id}`;
  const existing = model.nodes.find((candidate) => candidate.id === errorId);
  if (existing) {
    processNodeMap.set(existing.id, existing);
    return existing;
  }

  const errorNode: DSLNode = {
    id: errorId,
    label: node.altNextText || node.label,
    type: 'error' as NodeType,
    color: '#8DCFF9',
    containerId: container.id,
    processIndex: -1,
    noteTarget: null,
    next: undefined,
    altNext: undefined,
    notes: [],
  };

  model.nodes.push(errorNode);
  processNodeMap.set(errorNode.id, errorNode);
  return errorNode;
}

function layoutChainFrom(
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
  subGroupOf?: Map<string, string>
): number {
  let current: DSLNode | undefined = startNode;
  let currentX = startX;
  const currentY = startY;
  let maxBottom = currentY + NODE_H;
  const visited = new Set<string>();

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    placeProcessNode(current, currentX, currentY, container.id, allNodes, processPositioned, positioned);
    maxBottom = Math.max(maxBottom, currentY + NODE_H);

    if (current.type === 'policy') {
       const negativeNode = getOrCreateNegativeNode(current, container, model, processNodeMap);
       const negativeY = currentY + NODE_H + NODE_GAP_Y + 20;

       placeProcessNode(negativeNode, currentX, negativeY, container.id, allNodes, processPositioned, positioned);
       allLinks.push({
       source: current.id,
       target: negativeNode.id,
       label: 'no',
       type: 'negative',
       });
       maxBottom = Math.max(maxBottom, negativeY + NODE_H);

       if (negativeNode.next && processNodeMap.has(negativeNode.next)) {
       const altNextNode = processNodeMap.get(negativeNode.next)!;
       const rejoinsMainFlow = current.next === altNextNode.id;

       if (!rejoinsMainFlow && !processPositioned.has(altNextNode.id)) {
         const altNextY = negativeY + NODE_H + NODE_GAP_Y + 20;

         placeProcessNode(altNextNode, currentX, altNextY, container.id, allNodes, processPositioned, positioned);
         maxBottom = Math.max(maxBottom, altNextY + NODE_H);
       }

       allLinks.push({
         source: negativeNode.id,
         target: altNextNode.id,
         label: '',
         type: 'negative',
       });
       }
    }

    if (!current.next || !processNodeMap.has(current.next)) {
       break;
    }

    const nextNode: DSLNode = processNodeMap.get(current.next)!;
    allLinks.push({
       source: current.id,
       target: nextNode.id,
       label: '',
       type: 'default',
    });

    const crossesSubGroup =
      !!subGroupOf &&
      (subGroupOf.get(current.id) ?? '') !== (subGroupOf.get(nextNode.id) ?? '');
    currentX += NODE_W + NODE_GAP_X + (crossesSubGroup ? SUB_GROUP_GAP_X : 0);
    current = nextNode;
  }

  return maxBottom;
}

function layoutFanInProcess(
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
  positioned: Set<string>
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

function computeMaxSubGroupDepth(subGroups: { nodeIds: string[] }[]): number {
  const sets = subGroups.map((sg) => new Set(sg.nodeIds));
  const isStrictSubset = (a: Set<string>, b: Set<string>): boolean => {
    if (a.size >= b.size) return false;
    for (const id of a) if (!b.has(id)) return false;
    return true;
  };
  const depthBelow = new Array<number>(sets.length).fill(0);
  const order = sets.map((_, i) => i).sort((a, b) => sets[a].size - sets[b].size);
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

function computeContainerWidth(container: DSLContainer, model: DSLModel): number {
  let maxW = 0;

  for (const proc of container.processes) {
    const processNodes = getProcessNodes(proc, model);
    const processNodeMap = new Map(processNodes.map((node) => [node.id, node]));
    const roots = getProcessRoots(proc, processNodeMap);
    const fanInTarget = detectSharedTargetFanIn(roots, processNodeMap);
    const startNodes = roots.length > 0 ? roots : processNodes;
    const columns = fanInTarget
      ? computeFanInProcessColumns(roots, fanInTarget, processNodeMap, container)
      : computeProcessColumns(startNodes, processNodeMap);
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
      const NESTED_GAP = 14;
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

function computeContainerHeight(container: DSLContainer, model: DSLModel): number {
  const processRows = container.processes.length;
  const nonProcess = model.nodes.filter((n) => n.containerId === container.id && !container.processes.some(p => p.stepIds.includes(n.id)));
  const nonProcessRows = Math.ceil(nonProcess.length / 4);
  return CONTAINER_HEADER_H + CONTAINER_PADDING * 2 +
    (processRows + nonProcessRows) * (NODE_H + NODE_GAP_Y) + 10;
}

function layoutStandaloneNodes(nodes: DSLNode[], allNodes: LayoutNode[], startX: number, startY: number) {
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

function computeProcessColumns(processNodes: DSLNode[], processNodeMap: Map<string, DSLNode>): number {
  if (processNodes.length === 0) return 0;

  const memo = new Map<string, number>();

  const visit = (node: DSLNode, path: Set<string>): number => {
    const cached = memo.get(node.id);
    if (cached !== undefined) return cached;
    if (path.has(node.id)) return 0;

    const nextPath = new Set(path);
    nextPath.add(node.id);

    const nextNode = node.next ? processNodeMap.get(node.next) : undefined;
    const length = nextNode ? 1 + visit(nextNode, nextPath) : 1;

    memo.set(node.id, length);
    return length;
  };

  return processNodes.reduce((max, node) => Math.max(max, visit(node, new Set<string>())), 1);
}

function computeFanInProcessColumns(
  roots: DSLNode[],
  target: DSLNode,
  processNodeMap: Map<string, DSLNode>,
  container: DSLContainer
): number {
  const chainColumns = computeProcessColumns([target], processNodeMap);
  const useTwoSidedLayout = container.type === 'readModel' || target.type === 'view';

  return useTwoSidedLayout ? Math.max(3, chainColumns + 1) : chainColumns + 1;
}

// ─── Link Path ─────────────────────────────────────────────

function computeLinkPath(source: LayoutNode, target: LayoutNode, type: string, isNegative: boolean = false): string {
  if (isNegative) {
    const sourceCenterX = source.x + NODE_W / 2;
    const sourceBottomY = source.y + NODE_H;
    const targetCenterX = target.x + NODE_W / 2;
    const targetTopY = target.y;

    return `M ${sourceCenterX} ${sourceBottomY} L ${targetCenterX} ${targetTopY}`;
  }

  const sourceIsLeft = source.x <= target.x;
  const sourceX = sourceIsLeft ? source.x + NODE_W : source.x;
  const targetX = sourceIsLeft ? target.x : target.x + NODE_W;
  const sourceY = source.y + NODE_H / 2;
  const targetY = target.y + NODE_H / 2;

  if (sourceY !== targetY) {
    const sourceIsBelowTarget = sourceY > targetY;
    const targetAnchorY = target.y + (sourceIsBelowTarget ? NODE_H * 0.75 : NODE_H * 0.25);
    const targetApproachY = targetAnchorY + (sourceY - targetAnchorY) * 0.45;
    const horizontalDistance = Math.abs(targetX - sourceX);

    if (horizontalDistance < 1) {
      const curveDirection = type === 'negative' ? 1 : -1;
      const sourceCenterX = source.x + NODE_W / 2;
      const targetCenterX = target.x + NODE_W / 2;
      const controlOffset = Math.max(28, NODE_GAP_X);
      const controlX = sourceCenterX + curveDirection * controlOffset;

      return `M ${sourceCenterX} ${sourceY} C ${controlX} ${sourceY}, ${controlX} ${targetApproachY}, ${targetCenterX} ${targetAnchorY}`;
    }

    const controlOffset = Math.max(32, horizontalDistance * 0.45);
    const controlX1 = sourceX + (sourceIsLeft ? controlOffset : -controlOffset);
    const controlX2 = targetX - (sourceIsLeft ? controlOffset : -controlOffset);

    return `M ${sourceX} ${sourceY} C ${controlX1} ${sourceY}, ${controlX2} ${targetApproachY}, ${targetX} ${targetAnchorY}`;
  }

  return `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
}

function getPointOnPath(d: string, t: number): { x: number; y: number } {
  // Handle cubic bezier
  const bezierMatch = d.match(/M ([\d.]+) ([\d.]+) C ([\d.]+) ([\d.]+), ([\d.]+) ([\d.]+), ([\d.]+) ([\d.]+)/);
  if (bezierMatch) {
    const x0 = parseFloat(bezierMatch[1]), y0 = parseFloat(bezierMatch[2]);
    const cx1 = parseFloat(bezierMatch[3]), cy1 = parseFloat(bezierMatch[4]);
    const cx2 = parseFloat(bezierMatch[5]), cy2 = parseFloat(bezierMatch[6]);
    const x3 = parseFloat(bezierMatch[7]), y3 = parseFloat(bezierMatch[8]);
    const u = 1 - t;
    return {
      x: u*u*u*x0 + 3*u*u*t*cx1 + 3*u*t*t*cx2 + t*t*t*x3,
      y: u*u*u*y0 + 3*u*u*t*cy1 + 3*u*t*t*cy2 + t*t*t*y3,
    };
  }
  // Fallback: straight line
  const lineMatch = d.match(/M ([\d.]+) ([\d.]+) L ([\d.]+) ([\d.]+)/);
  if (lineMatch) {
    const x1 = parseFloat(lineMatch[1]), y1 = parseFloat(lineMatch[2]);
    const x2 = parseFloat(lineMatch[3]), y2 = parseFloat(lineMatch[4]);
    return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t };
  }
  return { x: 0, y: 0 };
}

function getLinkLabelPosition(d: string, link: LayoutLink): { x: number; y: number } {
  const mid = getPointOnPath(d, 0.5);

  if (link.label === 'no') {
    return {
      x: mid.x + 14,
      y: mid.y - 10,
    };
  }

  return {
    x: mid.x,
    y: mid.y - 6,
  };
}

// ─── Text Wrapping ─────────────────────────────────────────

function wrapText(
  textGroup: any,
  text: string,
  maxWidth: number,
  maxHeight: number
): void {
  const maxCharsPerLine = Math.floor(maxWidth / 6.5);
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? current + ' ' + word : word;
    if (test.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }

  if (current) lines.push(current);

  const displayLines = lines.slice(0, 4);
  const lineHeight = 15;
  // Center the text block vertically: first line starts so the whole block is centered
  const totalBlockHeight = (displayLines.length - 1) * lineHeight;
  const startY = -totalBlockHeight / 2;

  displayLines.forEach((line, i) => {
   textGroup
      .append('tspan')
      .attr('x', NODE_W / 2)
      .attr('dy', i === 0 ? `${startY}` : `${lineHeight}`)
      .text(line);
  });

  if (lines.length > 2) {
    textGroup
      .append('tspan')
      .attr('x', NODE_W / 2)
      .attr('dy', `${lineHeight}`)
      .text('…');
  }
}

function appendNotesBadge(
  parent: any,
  x: number,
  y: number,
  notes: string[],
  tooltip: any,
  className: string
): void {
  const badge = parent
    .append('g')
    .attr('class', className)
    .attr('transform', `translate(${x}, ${y})`);

  badge
    .append('circle')
    .attr('r', 6)
    .attr('fill', '#FFF1AA')
    .attr('stroke', '#333')
    .attr('stroke-width', 1);

  badge
    .append('text')
    .attr('x', 0)
    .attr('y', 0.5)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('font-size', '7px')
    .attr('font-weight', '700')
    .attr('fill', '#333')
    .attr('pointer-events', 'none')
    .text('i');

  badge
    .on('mouseenter', function (event: MouseEvent) {
      tooltip
        .style('display', 'block')
        .html(buildNotesHtml(notes))
        .style('left', (event.pageX + 12) + 'px')
        .style('top', (event.pageY - 10) + 'px');
    })
    .on('mousemove', function (event: MouseEvent) {
      tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 10) + 'px');
    })
    .on('mouseleave', function () {
      tooltip.style('display', 'none');
    });
}

function buildNotesHtml(notes: string[]): string {
  return `<div class="es-tooltip-notes"><div class="es-tooltip-notes-label">Notes</div><ul>${
    notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')
  }</ul></div>`;
}

function formatNodeType(type: string): string {
  const labels: Record<string, string> = {
    event: 'Domain Event', command: 'Command', aggregate: 'Aggregate',
    actor: 'Actor', policy: 'Policy', readModel: 'Read Model',
    externalSystem: 'External System', tempObject: 'Object', note: 'Note',
    query: 'Query', view: 'View', error: 'Error',
  };
  return labels[type] ?? type;
}

// ─── Color Helpers ─────────────────────────────────────────

function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getNodeNotes(node: DSLNode, model: DSLModel): string[] {
  const directNotes = node.notes || [];
  const attachedNotes = model.nodes
    .filter((candidate) => candidate.type === 'note')
    .filter((candidate) => isAttachedNote(candidate, node))
    .map((candidate) => candidate.label);

  return [...new Set([...directNotes, ...attachedNotes])];
}

function isAttachedNote(noteNode: DSLNode, node: DSLNode): boolean {
  if (noteNode.type !== 'note' || !noteNode.noteTarget) return false;
  if (noteNode.containerId !== node.containerId) return false;

  return noteNode.noteTarget === node.id || noteNode.noteTarget === normalizeId(node.label);
}
