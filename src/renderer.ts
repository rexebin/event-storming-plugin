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
}

interface LayoutResult {
  width: number;
  height: number;
  containers: LayoutContainer[];
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

const NODE_W = 140;
const NODE_H = 36;
const NODE_GAP_X = 36;
const NODE_GAP_Y = 22;
const CONTAINER_PADDING = 24;
const CONTAINER_HEADER_H = 32;
const CONTAINER_GAP_X = 60;
const CONTAINER_GAP_Y = 80;
const PADDING_X = 40;
const PADDING_Y = 30;
const LINK_COLOR = '#6a737d';

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

  layout.containers.forEach((c) => {
    const g = containersGroup.append('g')
      .attr('transform', `translate(${c.x}, ${c.y})`);

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

    // All shapes are color-filled rectangles with black border
    g.append('rect')
      .attr('width', NODE_W)
      .attr('height', NODE_H)
      .attr('rx', 4)
      .attr('fill', node.color)
      .attr('stroke', '#000000')
      .attr('stroke-width', 1.5);

    if (node.type !== 'note' && nodeNotes.length > 0) {
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
      .attr('font-size', node.type === 'note' ? '9px' : '11px')
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
    .attr('d', pathD)
    .attr('stroke', LINK_COLOR)
    .attr('marker-end', 'url(#arrowhead)');

  // Link label
  if (link.label) {
    const mid = getPointOnPath(pathD, 0.5);
    linksGroup
      .append('text')
      .attr('x', mid.x)
      .attr('y', mid.y - 6)
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
    });

  (svg as any).call(zoom);

  // ─── Tooltip ───

  const tooltip = d3.select('body').append('div').attr('class', 'es-tooltip').style('display', 'none');

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

      tooltip
        .style('display', 'block')
        .html(
          `<div class="es-tooltip-type">${node.type}</div>` +
          `<div class="es-tooltip-title">${escapeHtml(node.label)}</div>` +
          (node.containerId ? `<div class="es-tooltip-container">in: ${node.containerId}</div>` : '') +
          notesHtml
        );
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
  const allLinks: LayoutLink[] = [];
  let x = PADDING_X;
  let y = PADDING_Y;

  // 1. Render containers (aggregates + readModels + processes)
  for (const container of model.containers) {
    const containerW = computeContainerWidth(container, model);
    const containerH = computeContainerHeight(container, model);

    const cx = x;
    const cy = y;

    allContainers.push({
      ...container,
      x: cx,
      y: cy,
      width: containerW,
      height: containerH,
    });

    // Position nodes inside the container
    const innerX = cx + CONTAINER_PADDING;
    const innerY = cy + CONTAINER_HEADER_H + CONTAINER_PADDING;

    // Track positioned nodes to avoid duplicates (for non-process nodes only)
    const positioned = new Set<string>();

    // Layout each process group — each process is INDEPENDENT with its own positioned scope
    let processY = innerY;
    for (const process of container.processes) {
       const processNodes = getProcessNodes(process, model);
       const processNodeMap = new Map(processNodes.map((node) => [node.id, node]));
       const processPositioned = new Set<string>();
       const roots = getProcessRoots(process, processNodeMap);
       const fanInTarget = detectSharedTargetFanIn(roots, processNodeMap);
       let processBottom = processY + NODE_H;

       if (fanInTarget) {
       processBottom = layoutFanInProcess(
         roots,
         fanInTarget,
         innerX,
         processY,
         container,
         containerW,
         model,
         processNodeMap,
         allNodes,
         allLinks,
         processPositioned,
         positioned
       );
       } else {
       let laneY = processY;
       const startNodes = roots.length > 0 ? roots : processNodes;

       for (const startNode of startNodes) {
         if (processPositioned.has(startNode.id)) continue;
         const laneBottom = layoutChainFrom(
           startNode,
           innerX,
           laneY,
           container,
           model,
           processNodeMap,
           allNodes,
           allLinks,
           processPositioned,
           positioned
         );
         processBottom = Math.max(processBottom, laneBottom);
         laneY = laneBottom + NODE_GAP_Y;
       }

       for (const node of processNodes) {
         if (processPositioned.has(node.id)) continue;
         const laneBottom = layoutChainFrom(
           node,
           innerX,
           laneY,
           container,
           model,
           processNodeMap,
           allNodes,
           allLinks,
           processPositioned,
           positioned
         );
         processBottom = Math.max(processBottom, laneBottom);
         laneY = laneBottom + NODE_GAP_Y;
       }
       }

       processY = processBottom + NODE_GAP_Y;
    }

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
    const notes = model.nodes.filter((n) => n.containerId === container.id && n.type === 'note');
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

    // Adjust container height to fit everything
    const containerNodes = allNodes.filter((n) => n.containerId === container.id || (n as any)._cx !== undefined);
    let maxNodeBottom = 0;
    for (const n of allNodes) {
       if (n.x >= cx && n.x < cx + containerW) {
       maxNodeBottom = Math.max(maxNodeBottom, n.y + NODE_H);
       }
    }
    // Update container height
    allContainers[allContainers.length - 1].height = Math.max(
       containerH,
       maxNodeBottom - cy + CONTAINER_PADDING + 20
    );

    x += containerW + CONTAINER_GAP_X;
    y = PADDING_Y; // reset Y for next container in row

    // Wrap to next row if too wide
    if (x + containerW > (PADDING_X * 2 + 1200)) {
       x = PADDING_X;
       y = Math.max(PADDING_Y, maxNodeBottom + CONTAINER_GAP_Y);
    }
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
    if (node.negativeNext && processNodeMap.has(node.negativeNext)) {
       incomingCounts.set(node.negativeNext, (incomingCounts.get(node.negativeNext) || 0) + 1);
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
  if (node.negativeNext && processNodeMap.has(node.negativeNext)) {
    return processNodeMap.get(node.negativeNext)!;
  }

  const errorId = `error_default_${node.id}`;
  const existing = model.nodes.find((candidate) => candidate.id === errorId);
  if (existing) {
    processNodeMap.set(existing.id, existing);
    return existing;
  }

  const errorNode: DSLNode = {
    id: errorId,
    label: node.negativeNextText || node.label,
    type: 'error' as NodeType,
    color: '#8DCFF9',
    containerId: container.id,
    processIndex: -1,
    noteTarget: null,
    next: undefined,
    negativeNext: undefined,
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
  positioned: Set<string>
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
       const negativeNextNode = processNodeMap.get(negativeNode.next)!;
       const rejoinsMainFlow = current.next === negativeNextNode.id;

       if (!rejoinsMainFlow && !processPositioned.has(negativeNextNode.id)) {
         const negativeNextY = negativeY + NODE_H + NODE_GAP_Y + 20;

         placeProcessNode(negativeNextNode, currentX, negativeNextY, container.id, allNodes, processPositioned, positioned);
         maxBottom = Math.max(maxBottom, negativeNextY + NODE_H);
       }

       allLinks.push({
         source: negativeNode.id,
         target: negativeNextNode.id,
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

    currentX += NODE_W + NODE_GAP_X;
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
  containerWidth: number,
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
    const targetX = innerX + (containerWidth - CONTAINER_PADDING * 2 - NODE_W) / 2;
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

function computeContainerWidth(container: DSLContainer, model: DSLModel): number {
  // Width = max of all process row widths
  let maxW = 0;
  for (const proc of container.processes) {
    const w = proc.stepIds.length * (NODE_W + NODE_GAP_X) - NODE_GAP_X;
    maxW = Math.max(maxW, w);
  }
  // Also consider non-process nodes
  const nonProcess = model.nodes.filter((n) => n.containerId === container.id);
  const gridW = Math.min(nonProcess.length, 4) * (NODE_W + NODE_GAP_X);
  return Math.max(maxW, gridW) + CONTAINER_PADDING * 2;
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

  const displayLines = lines.slice(0, 2);
  const lineHeight = 13;
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
