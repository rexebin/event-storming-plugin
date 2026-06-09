import * as d3 from 'd3';
import { GSelection } from './models.js';
import { NODE_W, NODE_H, NODE_FOLD } from '../layout/constants.js';
import type { LayoutNode } from '../layout/models.js';
import { DSLModel } from '../parser/';
import { getNodeNotes } from '../notes.js';
import { wrapText } from '../text.js';
import { isLight } from '../utils.js';
import { computeLinkPath, getLinkLabelPosition } from '../links/index.js';

export function renderNodes(
  g: GSelection,
  nodes: LayoutNode[],
  offsetX: number,
  model: DSLModel,
): void {
  for (const node of nodes) {
    const nodeNotes = getNodeNotes(node, model);
    const ng = g.append('g')
      .attr('class', 'es-node')
      .attr('transform', `translate(${node.x + offsetX}, ${node.y})`)
      .attr('data-id', node.id)
      .on('mouseover', function (this: SVGGElement) {
        d3.select(this).raise();
      });

    // Post-it note shape: pentagon with folded lower-right corner
    const bodyPoints = `0,0 ${NODE_W},0 ${NODE_W},${NODE_H - NODE_FOLD} ${NODE_W - NODE_FOLD},${NODE_H} 0,${NODE_H}`;
    ng.append('polygon')
      .attr('points', bodyPoints)
      .attr('fill', node.color)
      .attr('filter', 'url(#node-shadow)');

    // Fold shadow triangle at the cut corner
    const foldPoints = `${NODE_W - NODE_FOLD},${NODE_H - NODE_FOLD} ${NODE_W},${NODE_H - NODE_FOLD} ${NODE_W - NODE_FOLD},${NODE_H}`;
    ng.append('polygon')
      .attr('points', foldPoints)
      .attr('fill', 'rgba(0,0,0,0.18)');

    if (nodeNotes.length > 0) {
      const badge = ng.append('g')
        .attr('class', 'es-note-badge')
        .attr('transform', `translate(${NODE_W - 12}, 12)`);

      badge.append('circle')
        .attr('r', 6)
        .attr('fill', '#FFF1AA')
        .attr('stroke', '#333')
        .attr('stroke-width', 1);

      badge.append('text')
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

    // Text label
    const textGroup = ng.append('text')
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
  }
}

export function renderLinks(
  g: GSelection,
  links: { source: string; target: string; label: string; type: string }[],
  nodes: LayoutNode[],
  offsetX: number,
): void {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  for (const link of links) {
    const source = nodeMap.get(link.source);
    const target = nodeMap.get(link.target);
    if (!source || !target) continue;

    const adjustedSource = { ...source, x: source.x + offsetX };
    const adjustedTarget = { ...target, x: target.x + offsetX };
    const pathD = computeLinkPath(adjustedSource, adjustedTarget, link.type);

    const isNoteTarget = target.type === 'note';
    g.append('path')
      .attr('class', `es-link es-link-${link.type}`)
      .attr('data-source', link.source)
      .attr('data-target', link.target)
      .attr('d', pathD)
      .attr('fill', 'none')
      .attr('stroke-width', 1.5)
      .attr('marker-end', isNoteTarget ? undefined : 'url(#arrowhead)')
      .attr('marker-start', isNoteTarget ? 'url(#arrowhead-start)' : undefined);

    if (link.label) {
      const labelPosition = getLinkLabelPosition(pathD);
      g.append('text')
        .attr('x', labelPosition.x)
        .attr('y', labelPosition.y)
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .attr('fill', '#586069')
        .attr('font-style', 'italic')
        .text(link.label);
    }
  }
}
