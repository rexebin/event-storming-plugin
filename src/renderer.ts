/**
 * Event Storming — D3.js Renderer
 * Renders a parsed DSL model as an interactive SVG diagram.
 */

import { parseDSL, DSLModel } from './parser/';
import * as d3 from 'd3';

// Module imports
import {
  NODE_W, NODE_H, NODE_FOLD,
  CONTAINER_PADDING, CONTAINER_HEADER_H,
  GROUP_HEADER_H,
  LINK_COLOR,
  CONTAINER_TYPE_LABELS,
} from './constants.js';
import { computeLayout } from './layout.js';
import { computeLinkPath, getLinkLabelPosition } from './links.js';
import { wrapText } from './text.js';
import { appendNotesBadge, getNodeNotes, formatNodeType } from './notes.js';
import { isLight, escapeHtml } from './utils.js';

// ─── Main render function ───────────────────────────────────

export function renderEventStorming(
  container: any,
  dslText: string
): { svg: any; model: DSLModel; destroy: () => void } {
  const model = parseDSL(dslText);
  const layout = computeLayout(model);

  // Use container's actual width so the SVG always fills the available space.
  // Center the diagram horizontally when it is narrower than the container.
  const contentW = layout.width + CONTAINER_PADDING * 2;
  const containerPx = container.node()?.getBoundingClientRect().width ?? 0;
  const svgWidth = Math.max(containerPx, contentW);
  const svgHeight = layout.height + CONTAINER_PADDING * 2;
  const offsetX = (svgWidth - contentW) / 2;

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
       .attr('transform', `translate(${c.x + offsetX}, ${c.y})`)
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

    // Container type badge outside the box, above the header band
    const containerTypeLabel = CONTAINER_TYPE_LABELS[c.type] ?? c.type;
    const badgePadding = 6;
    const badgeHeight = 14;
    const badgeWidths: Record<string, number> = { 'Aggregate': 76, 'Projector': 68, 'Process': 60, 'External System': 116 };
    const typeBadgeW = (badgeWidths[containerTypeLabel] ?? 82) + badgePadding * 2;
    const typeBadgeX = 8;
    const typeBadgeY = -badgeHeight - 6;

    g.append('rect')
       .attr('x', typeBadgeX)
       .attr('y', typeBadgeY)
       .attr('width', typeBadgeW)
       .attr('height', badgeHeight)
       .attr('rx', 4)
       .attr('fill', c.color);

    g.append('text')
       .attr('class', 'es-container-type-badge')
       .attr('x', typeBadgeX + typeBadgeW / 2)
       .attr('y', typeBadgeY + badgeHeight / 2 + 1)
       .attr('text-anchor', 'middle')
       .attr('dominant-baseline', 'middle')
       .attr('font-size', '9px')
       .attr('font-weight', '700')
       .attr('fill', isLight(c.color) ? '#333' : '#fff')
       .text(containerTypeLabel);

    if (c.notes && c.notes.length > 0) {
      appendNotesBadge(g, c.width - 14, 12, c.notes, tooltip, 'es-container-note-badge');
     }
  });

  const groupsGroup = svg.append('g').attr('class', 'groups');

  layout.groups.forEach((group) => {
    const g = groupsGroup
       .append('g')
       .attr('class', 'es-process-group')
       .attr('transform', `translate(${group.x + offsetX}, ${group.y})`)
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
       .attr('transform', `translate(${sg.x + offsetX}, ${sg.y})`)
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
       .attr('transform', `translate(${node.x + offsetX}, ${node.y})`)
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

  const adjustedSource = { ...source, x: source.x + offsetX };
  const adjustedTarget = { ...target, x: target.x + offsetX };
  // Adjust all nodes for the same offset so obstacle detection works correctly
  const adjustedNodes = layout.nodes.map((n) => ({ ...n, x: n.x + offsetX }));
  const pathD = computeLinkPath(
    adjustedSource,
    adjustedTarget,
    link.type,
    adjustedNodes,
    false
  );
  linksGroup
     .append('path')
     .attr('class', `es-link es-link-${link.type}`)
     .attr('data-source', link.source)
     .attr('data-target', link.target)
     .attr('d', pathD)
     .attr('fill', 'none')
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

      const flowParts: string[] = [];
      if (node.next) {
        const nextNode = model.nodes.find((n) => n.id === node.next);
        if (nextNode) flowParts.push(`→ ${escapeHtml(nextNode.label)}`);
      }
      if (node.altNext) {
        const altNextNode = model.nodes.find((n) => n.id === node.altNext);
        if (altNextNode) flowParts.push(`✕ ${escapeHtml(altNextNode.label)}`);
      }
      const flowHtml = flowParts.length > 0
         ? `<div class="es-tooltip-flow">${flowParts.join('<br>')}</div>`
         : '';

      const html = `<div class="es-tooltip-title">${escapeHtml(node.label)}</div>`
         + `<div class="es-tooltip-type">${formatNodeType(node.type)}</div>`
         + notesHtml
         + flowHtml;

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
