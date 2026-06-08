import * as d3 from 'd3';
import { GSelection } from './models.js';
import { DSLModel } from '../parser/';
import type { LayoutNode } from '../layout/models.js';
import { getNodeNotes, formatNodeType } from '../notes.js';
import { escapeHtml } from '../utils.js';

export function setupZoom(
  svg: any,
  groupNames: string[],
): void {
  const zoom = d3.zoom()
    .scaleExtent([0.3, 2])
    .on('zoom', (event: any) => {
      const t = (event.transform as any).toString();
      for (const name of groupNames) {
        svg.select(`.${name}`).attr('transform', t);
      }
    });

  (svg as any).call(zoom);
}

export function setupTooltips(
  g: GSelection,
  nodes: LayoutNode[],
  model: DSLModel,
  tooltip: any,
): void {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  function buildNodeTooltip(nodeId: string) {
    const node = nodeMap.get(nodeId);
    if (!node) return '';

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

    return `<div class="es-tooltip-title">${escapeHtml(node.label)}</div>`
      + `<div class="es-tooltip-type">${formatNodeType(node.type)}</div>`
      + notesHtml
      + flowHtml;
  }

  g.selectAll('.es-node')
    .on('mouseenter', function (this: any, event: MouseEvent) {
      const nodeG = d3.select(this);
      const id = nodeG.attr('data-id') || '';
      tooltip.style('display', 'block')
        .html(buildNodeTooltip(id))
        .style('left', (event.pageX + 12) + 'px')
        .style('top', (event.pageY - 10) + 'px');
    })
    .on('mousemove', function (this: any, event: MouseEvent) {
      tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 10) + 'px');
    })
    .on('mouseleave', function () {
      tooltip.style('display', 'none');
    });
}
