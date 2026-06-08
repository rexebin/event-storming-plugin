import * as d3 from 'd3';
import { LINK_COLOR } from '../constants.js';

export function renderDefs(svg: any): void {
  const defs = svg.append('defs');

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
}

export function createTooltip(): any {
  return d3.select('body').append('div')
    .attr('class', 'es-tooltip')
    .style('display', 'none');
}
